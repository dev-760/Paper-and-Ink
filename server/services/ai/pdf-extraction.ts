import { extractJsonObject, runModelCompletion, type AiContentPart } from './client.ts';

export interface PdfExtractPageInput {
  pageNumber: number;
  imageDataUrl?: string;
  rawText?: string;
}

export interface PdfExtractedPage {
  pageNumber: number;
  text: string;
  chapterHeading: string | null;
}

export interface PdfExtractionResult {
  detectedTitle?: string;
  detectedAuthor?: string;
  pages: PdfExtractedPage[];
}

const IMAGE_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_BATCH_PAGES = 6;

export async function extractPdfPagesWithAi(options: {
  titleHint?: string;
  pages: PdfExtractPageInput[];
}): Promise<PdfExtractionResult> {
  const { titleHint, pages } = options;

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('Provide at least one PDF page for extraction.');
  }
  if (pages.length > MAX_BATCH_PAGES) {
    throw new Error(`Process at most ${MAX_BATCH_PAGES} PDF pages per request.`);
  }

  const contentParts: AiContentPart[] = [
    {
      type: 'text',
      text: [
        titleHint ? `Document filename/title hint: ${titleHint.slice(0, 140)}` : '',
        'Extract clean, readable book prose from each PDF page below.',
        'Always preserve the exact original script and language of the book (e.g. Arabic, Japanese, English) without translating.',
        'Remove running headers, page numbers, and hyphenated line-break artifacts where obvious, joining broken lines into natural paragraphs separated by blank lines (\\n\\n).',
        'Preserve exact book meaning, dialogue punctuation, and wording without summarizing or omitting text.',
        'Identify any chapter, part, prologue, or epilogue heading starting on a page in the original language (e.g. "PROLOGUE", "THE FIRST NOTEBOOK", "الفصل الأول", or null if none).',
        'Return strict JSON with keys:',
        '{"detectedTitle": string | null, "detectedAuthor": string | null, "pages": [{"pageNumber": number, "chapterHeading": string | null, "text": string}]}.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  for (const page of pages) {
    if (
      typeof page.pageNumber !== 'number' ||
      !Number.isFinite(page.pageNumber) ||
      page.pageNumber < 1
    ) {
      throw new Error('Each page must have a valid positive pageNumber.');
    }

    const labelParts = [`--- Page ${page.pageNumber} ---`];
    if (page.rawText && page.rawText.trim()) {
      labelParts.push(`Embedded PDF text:\n${page.rawText.slice(0, 10000)}`);
    }
    contentParts.push({
      type: 'text',
      text: labelParts.join('\n'),
    });

    if (page.imageDataUrl) {
      if (!IMAGE_DATA_URL_REGEX.test(page.imageDataUrl) || page.imageDataUrl.length > 6_000_000) {
        throw new Error(`Invalid or oversized image on page ${page.pageNumber}.`);
      }
      contentParts.push({
        type: 'image_url',
        imageUrl: {
          url: page.imageDataUrl,
        },
      });
    }
  }

  const rawResponse = await runModelCompletion({
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 6000,
    messages: [
      {
        role: 'system',
        content: [
          'You are an archival book-digitization and scholarly typesetting specialist for Paper & Ink Reader.',
          'Accurately transcribe and reconstruct clean, book-grade reflowable prose from scanned page images or messy embedded PDF text.',
          'FIDELITY & SCRIPT RULE: Preserve the exact original language, script, spelling, punctuation, dialogue marks, and Arabic diacritics/tashkeel where present — never translate, summarize, modernize, or invent missing lines.',
          'LAYOUT CLEANUP: Read multi-column pages in true reading order, strip running page headers/footers and isolated page numbers, rejoin end-of-line hyphenated words where clearly split, and separate natural paragraphs with double newlines (\\n\\n).',
          'BOOK STRUCTURE: Populate "detectedTitle" and "detectedAuthor" ONLY when visibly printed on a cover, title page, or running book plate (otherwise null). Identify any chapter, prologue, epilogue, notebook, or part heading starting on a page in its original script inside "chapterHeading" (otherwise null).',
          'Output strictly valid JSON matching the requested schema. Never include chain-of-thought or commentary.',
        ].join(' '),
      },
      {
        role: 'user',
        content: contentParts,
      },
    ],
  });

  const parsed = extractJsonObject<{
    detectedTitle?: string | null;
    detectedAuthor?: string | null;
    pages?: Array<{ pageNumber?: number; chapterHeading?: string | null; text?: string }>;
  }>(rawResponse);

  if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
    const normalizedPages: PdfExtractedPage[] = parsed.pages.map((p, index) => ({
      pageNumber:
        typeof p.pageNumber === 'number' ? p.pageNumber : pages[index]?.pageNumber ?? index + 1,
      chapterHeading:
        typeof p.chapterHeading === 'string' && p.chapterHeading.trim()
          ? p.chapterHeading.trim()
          : null,
      text: typeof p.text === 'string' ? p.text.trim() : '',
    }));

    return {
      detectedTitle:
        typeof parsed.detectedTitle === 'string' && parsed.detectedTitle.trim()
          ? parsed.detectedTitle.trim()
          : undefined,
      detectedAuthor:
        typeof parsed.detectedAuthor === 'string' && parsed.detectedAuthor.trim()
          ? parsed.detectedAuthor.trim()
          : undefined,
      pages: normalizedPages,
    };
  }

  if (pages.length === 1) {
    return {
      pages: [
        {
          pageNumber: pages[0].pageNumber,
          chapterHeading: null,
          text: rawResponse.trim(),
        },
      ],
    };
  }

  throw new Error('Could not parse structured PDF extraction output.');
}
