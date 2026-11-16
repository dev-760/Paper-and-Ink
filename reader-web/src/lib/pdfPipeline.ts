import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ShelfTone } from '../design-system/tokens';
import type { Book, Chapter, Shelf } from '../types/reader';
import { requestBookBrief } from './bookBrief';
import {
  estimateReadingMinutes,
  parseFilenameTitleAuthor,
  pickDeterministicCover,
  suggestShelf,
} from './bookImportUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ImportStage =
  | 'idle'
  | 'extracting'
  | 'finding_chapters'
  | 'building_cover'
  | 'categorizing'
  | 'ready'
  | 'scanned_warning';

export interface PdfImportProgress {
  stage: ImportStage;
  currentPage?: number;
  totalPages?: number;
  detail: string;
}

export interface PdfImportResult {
  book?: Book;
  pdfBuffer?: ArrayBuffer;
  suggestedShelfId?: string;
  suggestedTone?: ShelfTone;
  isScannedPdf: boolean;
  usedAiOcr: boolean;
  warnings: string[];
}

export interface PdfImportPipeline {
  importPdf(
    file: File,
    shelves: Shelf[],
    options: {
      allowAiOcrForScanned?: boolean;
      maxPagesForAi?: number;
      onProgress?: (progress: PdfImportProgress) => void;
    },
  ): Promise<PdfImportResult>;
}

function isChapterHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  return (
    /^(?:prologue|epilogue|introduction|preface|foreword|afterword|مقدمة|تمهيد|خاتمة)$/i.test(trimmed) ||
    /^(?:the\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:notebook|chapter|part|book|section|letter|act)(?:[:.\s-].*)?$/i.test(
      trimmed,
    ) ||
    /^(?:chapter|part|section|book|letter|epilogue|prologue|notebook|act)\s+(?:[ivxlcdm]+|\d+|[a-z]+)(?:[:.\s-].*)?$/i.test(
      trimmed,
    ) ||
    /^(?:الفصل|الجزء|الباب|القسم|الكتاب)\s+.{1,45}$/.test(trimmed)
  );
}

function splitTextIntoParagraphs(pageText: string): string[] {
  const normalized = pageText.replace(/\r\n/g, '\n').replace(/-\n([a-z])/g, '$1');

  // If the text already uses double-newline paragraph breaks (e.g. from AI OCR), preserve them while separating headings.
  const rawBlocks = normalized.split(/\n{2,}/);
  if (rawBlocks.length > 1) {
    const out: string[] = [];
    for (const block of rawBlocks) {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      let acc: string[] = [];
      for (const line of lines) {
        if (isChapterHeadingLine(line)) {
          if (acc.length > 0) {
            out.push(acc.join(' ').replace(/\s+/g, ' ').trim());
            acc = [];
          }
          out.push(line);
        } else {
          acc.push(line);
        }
      }
      if (acc.length > 0) {
        out.push(acc.join(' ').replace(/\s+/g, ' ').trim());
      }
    }
    return out.filter(Boolean);
  }

  // Single-newline embedded PDF text: detect heading lines and paragraph breaks at sentence boundaries.
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    if (isChapterHeadingLine(line)) {
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(' ').trim());
        buffer = [];
      }
      paragraphs.push(line);
      continue;
    }

    buffer.push(line);
    const endsParagraph = /[.!?"'”’»\])؟]$/.test(line) && buffer.join(' ').length >= 160 && line.length < 56;
    if (endsParagraph) {
      paragraphs.push(buffer.join(' ').trim());
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    paragraphs.push(buffer.join(' ').trim());
  }

  return paragraphs.filter(Boolean);
}

interface RawExtractedPage {
  pageNumber: number;
  text: string;
  chapterHeading?: string | null;
}

function assembleChapters(pages: RawExtractedPage[], bookId: string): Chapter[] {
  const chapters: Chapter[] = [];
  let currentLabel = 'Section I';
  let currentTitle = 'Opening';
  let currentParagraphs: string[] = [];

  const flushChapter = () => {
    if (currentParagraphs.length === 0) return;
    const index = chapters.length;
    chapters.push({
      id: `${bookId}-ch-${index + 1}`,
      index,
      label: currentLabel,
      title: currentTitle,
      paragraphs: currentParagraphs,
      estimatedMinutes: estimateReadingMinutes(currentParagraphs),
    });
    currentParagraphs = [];
  };

  for (const page of pages) {
    if (page.chapterHeading && currentParagraphs.length > 0) {
      flushChapter();
      currentLabel = `Chapter ${chapters.length + 1}`;
      currentTitle = page.chapterHeading;
    } else if (page.chapterHeading && currentParagraphs.length === 0) {
      currentLabel = `Chapter ${chapters.length + 1}`;
      currentTitle = page.chapterHeading;
    }

    const paragraphs = splitTextIntoParagraphs(page.text);
    for (const para of paragraphs) {
      if (isChapterHeadingLine(para) && currentParagraphs.length >= 2) {
        flushChapter();
        currentLabel = `Chapter ${chapters.length + 1}`;
        currentTitle = para;
      } else if (isChapterHeadingLine(para) && currentParagraphs.length === 0 && chapters.length === 0) {
        currentLabel = 'Chapter 1';
        currentTitle = para;
      } else {
        currentParagraphs.push(para);
      }
    }

    // Break large monolithic text into comfortable ~12-page chapters if no headings appear
    if (currentParagraphs.length >= 45) {
      flushChapter();
      currentLabel = `Section ${chapters.length + 1}`;
      currentTitle = `Pages ${Math.max(1, page.pageNumber - 10)}–${page.pageNumber}`;
    }
  }

  flushChapter();

  if (chapters.length === 0) {
    chapters.push({
      id: `${bookId}-ch-1`,
      index: 0,
      label: 'Chapter 1',
      title: 'Document Text',
      paragraphs: ['No readable text could be extracted from this PDF.'],
      estimatedMinutes: 1,
    });
  }

  return chapters;
}

async function renderPdfPageToJpegDataUrl(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: 1.35 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering context is unavailable.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

export const localAndAiPdfPipeline: PdfImportPipeline = {
  async importPdf(file, shelves, options) {
    const { allowAiOcrForScanned = true, maxPagesForAi = 24, onProgress } = options;
    const warnings: string[] = [];

    onProgress?.({ stage: 'extracting', detail: `Reading ${file.name} locally…` });
    const rawBuffer = await file.arrayBuffer();
    const pdfCopyForStorage = rawBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(rawBuffer) });
    const pdfDoc = await loadingTask.promise;

    const totalPages = pdfDoc.numPages;
    const metadataResult = await pdfDoc.getMetadata().catch(() => null);
    const info = (metadataResult?.info || {}) as Record<string, unknown>;
    const metaTitle = typeof info.Title === 'string' && info.Title.trim() ? info.Title.trim() : '';
    const metaAuthor = typeof info.Author === 'string' && info.Author.trim() ? info.Author.trim() : '';

    const extractedPages: RawExtractedPage[] = [];
    let totalChars = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.({
        stage: 'extracting',
        currentPage: pageNumber,
        totalPages,
        detail: `Extracting page ${pageNumber} of ${totalPages}…`,
      });
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          currentLine += item.str;
          if ('hasEOL' in item && item.hasEOL) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = '';
          } else {
            currentLine += ' ';
          }
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      const pageText = lines.join('\n').replace(/[ \t]+/g, ' ').trim();
      totalChars += pageText.length;
      extractedPages.push({ pageNumber, text: pageText });
    }

    const avgCharsPerPage = totalPages > 0 ? totalChars / totalPages : 0;
    const isScannedPdf = avgCharsPerPage < 60;
    let usedAiOcr = false;
    let aiTitle: string | undefined;
    let aiAuthor: string | undefined;

    if (isScannedPdf && !allowAiOcrForScanned) {
      return {
        isScannedPdf: true,
        usedAiOcr: false,
        pdfBuffer: pdfCopyForStorage,
        warnings: ['This PDF appears to be image-based or scanned with little embedded text.'],
      };
    }

    // For scanned PDFs, render page batches and send to Google Gemini API (gemini-4-hydrogen)
    if (isScannedPdf && allowAiOcrForScanned) {
      usedAiOcr = true;
      const pagesToOcr = Math.min(totalPages, maxPagesForAi);
      if (totalPages > maxPagesForAi) {
        warnings.push(
          `OCR extracted the first ${maxPagesForAi} of ${totalPages} scanned pages in this pass. Your complete original PDF remains saved locally.`,
        );
      }

      const aiPages: RawExtractedPage[] = [];
      const batchSize = 4;

      for (let start = 1; start <= pagesToOcr; start += batchSize) {
        const end = Math.min(pagesToOcr, start + batchSize - 1);
        onProgress?.({
          stage: 'finding_chapters',
          currentPage: end,
          totalPages: pagesToOcr,
          detail: `Reading scanned pages ${start}–${end} of ${pagesToOcr} via Gemini AI…`,
        });

        const batchInputs: Array<{ pageNumber: number; imageDataUrl: string; rawText?: string }> = [];
        for (let p = start; p <= end; p++) {
          const page = await pdfDoc.getPage(p);
          const imageDataUrl = await renderPdfPageToJpegDataUrl(page);
          batchInputs.push({
            pageNumber: p,
            imageDataUrl,
            rawText: extractedPages[p - 1]?.text || undefined,
          });
        }

        const apiBase = (
          (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || ''
        )
          .trim()
          .replace(/\/$/, '');

        const parsedHint = parseFilenameTitleAuthor(file.name);
        const res = await fetch(`${apiBase}/api/ai/pdf-extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titleHint: metaTitle || parsedHint.title,
            pages: batchInputs,
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'AI PDF extraction failed.');
        }

        if (!aiTitle && typeof payload?.detectedTitle === 'string') {
          aiTitle = payload.detectedTitle;
        }
        if (!aiAuthor && typeof payload?.detectedAuthor === 'string') {
          aiAuthor = payload.detectedAuthor;
        }
        if (Array.isArray(payload?.pages)) {
          for (const outPage of payload.pages) {
            aiPages.push({
              pageNumber: Number(outPage.pageNumber) || aiPages.length + 1,
              text: String(outPage.text || ''),
              chapterHeading: typeof outPage.chapterHeading === 'string' ? outPage.chapterHeading : null,
            });
          }
        }
      }

      if (aiPages.length > 0) {
        extractedPages.splice(0, extractedPages.length, ...aiPages);
      }
    }

    onProgress?.({ stage: 'building_cover', detail: 'Structuring chapters and designing cover…' });
    const bookId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const chapters = assembleChapters(extractedPages, bookId);
    const parsedFilename = parseFilenameTitleAuthor(file.name);
    const title = aiTitle || metaTitle || parsedFilename.title || 'Imported Book';
    const author = aiAuthor || metaAuthor || parsedFilename.author || 'Imported PDF';

    onProgress?.({ stage: 'categorizing', detail: 'Matching shelf and formatting typography…' });
    const sampleText = chapters[0]?.paragraphs.slice(0, 3).join(' ') || '';
    const shelf = suggestShelf(title, sampleText, shelves);
    const coverSpec = pickDeterministicCover(`${title}-${author}`);

    const wordCount = chapters.reduce(
      (sum, ch) => sum + ch.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
      0,
    );

    const fallbackDescription = `${usedAiOcr ? 'OCR-digitized from PDF' : 'Imported from PDF'} · ${totalPages} PDF pages · ~${wordCount.toLocaleString()} words stored locally.`;
    let aiBrief: string | undefined;
    let aiThemes: string[] | undefined;

    onProgress?.({ stage: 'categorizing', detail: 'Drafting AI brief about your book…' });
    try {
      const briefResult = await requestBookBrief({
        title,
        author,
        totalPages,
        chapters,
      });
      aiBrief = briefResult.brief;
      aiThemes = briefResult.themes;
    } catch {
      // Keep graceful local summary when AI is offline or unavailable.
    }

    const book: Book = {
      id: bookId,
      shelfId: shelf?.id || shelves[0]?.id || 'literature',
      title,
      author,
      year: String(new Date().getFullYear()),
      description: aiBrief || fallbackDescription,
      ...(aiBrief ? { aiBrief } : {}),
      ...(aiThemes && aiThemes.length > 0 ? { aiThemes } : {}),
      totalPages,
      isFullSample: true,
      progressPercent: 0,
      lastOpenedAt: Date.now(),
      cover: {
        palette: coverSpec.palette,
        pattern: coverSpec.pattern,
        editionNote: usedAiOcr ? 'AI OCR PDF Edition' : 'Local PDF Edition',
      },
      chapters,
    };

    onProgress?.({ stage: 'ready', detail: 'Ready for review.' });

    return {
      book,
      pdfBuffer: pdfCopyForStorage,
      suggestedShelfId: book.shelfId,
      suggestedTone: shelf?.tone,
      isScannedPdf,
      usedAiOcr,
      warnings,
    };
  },
};
