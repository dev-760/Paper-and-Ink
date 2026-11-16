import { extractJsonObject, runModelCompletion } from './client.ts';

export interface OcrTaskItem {
  text: string;
  done: boolean;
}

export interface HandwrittenOcrResult {
  rawTranscript: string;
  cleanedText: string;
  titleSuggestion: string;
  summary: string;
  keyPoints: string[];
  tasks: OcrTaskItem[];
}

const IMAGE_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_DATA_URL_CHARS = 8_000_000;

export async function transcribeHandwrittenNote(options: {
  imageDataUrl: string;
  pageTitle?: string;
  typedContext?: string;
}): Promise<HandwrittenOcrResult> {
  const { imageDataUrl, pageTitle, typedContext } = options;

  if (!IMAGE_DATA_URL_REGEX.test(imageDataUrl)) {
    throw new Error('Handwriting image must be a valid PNG, JPEG, or WebP data URL.');
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
    throw new Error('Handwriting image is too large (maximum ~6 MB).');
  }

  const contextHint = [
    pageTitle ? `Page title: ${pageTitle.slice(0, 120)}` : '',
    typedContext ? `Typed context on the page:\n${typedContext.slice(0, 1500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const rawResponse = await runModelCompletion({
    jsonMode: true,
    temperature: 0.15,
    maxTokens: 3200,
    messages: [
      {
        role: 'system',
        content: [
          'You are a careful handwriting OCR and note-structuring assistant for Paper & Ink Notes.',
          'Read the handwritten page or ink strokes image accurately without inventing facts.',
          'Preserve the author voice, punctuation, headings, bullet points, and checkboxes where visible.',
          'If parts are illegible, transcribe best effort without fabricating content.',
          'Respond strictly as valid JSON with keys:',
          '{"rawTranscript": string, "cleanedText": string, "titleSuggestion": string, "summary": string, "keyPoints": string[], "tasks": [{"text": string, "done": boolean}]}.',
          'Never include reasoning or markdown fences outside the JSON object.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: contextHint
              ? `Transcribe and lightly structure the handwritten notes in this image.\n\n${contextHint}`
              : 'Transcribe and lightly structure all handwritten notes visible in this image.',
          },
          {
            type: 'image_url',
            imageUrl: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
  });

  const parsed = extractJsonObject<Partial<HandwrittenOcrResult>>(rawResponse);
  if (parsed && (typeof parsed.cleanedText === 'string' || typeof parsed.rawTranscript === 'string')) {
    const rawTranscript = (parsed.rawTranscript || parsed.cleanedText || '').trim();
    const cleanedText = (parsed.cleanedText || parsed.rawTranscript || '').trim();
    return {
      rawTranscript,
      cleanedText,
      titleSuggestion:
        typeof parsed.titleSuggestion === 'string' && parsed.titleSuggestion.trim()
          ? parsed.titleSuggestion.trim().slice(0, 120)
          : pageTitle || 'Handwritten Note',
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .slice(0, 12)
        : [],
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks
            .filter(
              (t): t is OcrTaskItem =>
                typeof t === 'object' &&
                t !== null &&
                typeof t.text === 'string' &&
                t.text.trim().length > 0,
            )
            .map((t) => ({ text: t.text.trim(), done: Boolean(t.done) }))
            .slice(0, 20)
        : [],
    };
  }

  return {
    rawTranscript: rawResponse.trim(),
    cleanedText: rawResponse.trim(),
    titleSuggestion: pageTitle || 'Handwritten Note',
    summary: '',
    keyPoints: [],
    tasks: [],
  };
}
