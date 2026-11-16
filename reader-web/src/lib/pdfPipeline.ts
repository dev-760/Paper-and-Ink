import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ShelfTone } from '../design-system/tokens';
import type { Book, Chapter, CoverPalette, CoverPattern, Shelf } from '../types/reader';

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

const COVER_PALETTES: CoverPalette[] = [
  'terracotta-cream',
  'navy-gold',
  'sage-linen',
  'ochre-espresso',
  'slate-ivory',
  'plum-parchment',
  'forest-sand',
  'rust-charcoal',
];

const COVER_PATTERNS: CoverPattern[] = ['arch', 'grid', 'waves', 'horizon', 'botanical', 'folio'];

function pickDeterministicCover(seed: string): { palette: CoverPalette; pattern: CoverPattern } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return {
    palette: COVER_PALETTES[hash % COVER_PALETTES.length],
    pattern: COVER_PATTERNS[(hash >> 3) % COVER_PATTERNS.length],
  };
}

function cleanFilenameToTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function isChapterHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  return /^(?:chapter|part|section|book|letter|epilogue|prologue)\s+(?:[ivxlcdm]+|\d+|[a-z]+)(?:[:.\s-].*)?$/i.test(
    trimmed,
  );
}

function splitTextIntoParagraphs(pageText: string): string[] {
  const normalized = pageText.replace(/\r\n/g, '\n').replace(/-\n([a-z])/g, '$1');
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 0);
  if (blocks.length > 0) return blocks;
  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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

function suggestShelf(title: string, textSample: string, shelves: Shelf[]): Shelf | undefined {
  const combined = `${title} ${textSample}`.toLowerCase();
  const findByIdOrKeyword = (keywords: string[]) =>
    shelves.find((s) => keywords.some((kw) => s.title.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw)));

  if (/chapter|novel|poem|story|fiction|tale|sonnet/.test(combined)) {
    return findByIdOrKeyword(['literature', 'classic', 'fiction']) || shelves[0];
  }
  if (/essay|philosophy|letter|journal|memoir|ethics|art|history/.test(combined)) {
    return findByIdOrKeyword(['essay', 'philosophy', 'history', 'nonfiction']) || shelves[1] || shelves[0];
  }
  if (/theorem|algorithm|design|system|architecture|physics|research|study/.test(combined)) {
    return findByIdOrKeyword(['craft', 'design', 'science', 'reference']) || shelves[2] || shelves[0];
  }
  return shelves[0];
}

async function renderPdfPageToPngDataUrl(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering context is unavailable.');
  }
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/png');
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
          const imageDataUrl = await renderPdfPageToPngDataUrl(page);
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

        const res = await fetch(`${apiBase}/api/ai/pdf-extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titleHint: metaTitle || cleanFilenameToTitle(file.name),
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
    const title = aiTitle || metaTitle || cleanFilenameToTitle(file.name) || 'Imported Book';
    const author = aiAuthor || metaAuthor || 'Imported PDF';

    onProgress?.({ stage: 'categorizing', detail: 'Matching shelf and formatting typography…' });
    const sampleText = chapters[0]?.paragraphs.slice(0, 3).join(' ') || '';
    const shelf = suggestShelf(title, sampleText, shelves);
    const coverSpec = pickDeterministicCover(`${title}-${author}`);

    const wordCount = chapters.reduce(
      (sum, ch) => sum + ch.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
      0,
    );

    const book: Book = {
      id: bookId,
      shelfId: shelf?.id || shelves[0]?.id || 'literature',
      title,
      author,
      year: String(new Date().getFullYear()),
      description: `${usedAiOcr ? 'OCR-digitized from PDF' : 'Imported from PDF'} · ${totalPages} PDF pages · ~${wordCount.toLocaleString()} words stored locally.`,
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
