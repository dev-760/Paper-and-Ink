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
        'Remove running headers, page numbers, and hyphenated line-break artifacts where obvious, joining broken lines into natural paragraphs separated by blank lines (\\n\\n).',
        'Preserve exact book meaning without summarizing or omitting text.',
        'Identify any chapter heading starting on a page (or null if none).',
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
        content:
          'You are a careful editorial book-digitization assistant for Paper & Ink Reader. Output clean, faithful plain-text book prose structured strictly as valid JSON. Never include chain-of-thought or commentary.',
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
