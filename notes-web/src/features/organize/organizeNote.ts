import type { InkStroke } from '../../types/ink';
import type { ConversionResult } from '../../types/note';
import { renderInkStrokesToPngDataUrl } from './inkSnapshot';

export interface OrganizeNoteInput {
  pageId: string;
  currentTitle: string;
  notebookTitle: string;
  typedContent: string;
  inkStrokes: InkStroke[];
  originalImage?: string | null;
}

export interface OrganizeNoteOutput {
  title: string;
  cleanedMarkdown: string;
  tags: string[];
  suggestedNotebook: string;
  confidence: number;
}

export interface ServerOcrResponse {
  rawTranscript: string;
  cleanedText: string;
  titleSuggestion: string;
  summary: string;
  keyPoints: string[];
  tasks: Array<{ text: string; done: boolean }>;
}

function getApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return (env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

export async function runServerHandwritingOcr(options: {
  imageDataUrl: string;
  pageTitle?: string;
  typedContext?: string;
}): Promise<ServerOcrResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/ai/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl: options.imageDataUrl,
      pageTitle: options.pageTitle,
      typedContext: options.typedContext,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Could not transcribe handwriting via AI.',
    );
  }
  return data as ServerOcrResponse;
}

/**
 * Transcribes handwritten ink strokes or scanned notebook images via the trusted
 * Paper & Ink API (/api/ai/ocr using Google Gemini Flash)
 * while always preserving original ink strokes and captured images locally.
 */
export async function organizeNote(input: OrganizeNoteInput): Promise<ConversionResult> {
  const snapshotDataUrl = input.originalImage || renderInkStrokesToPngDataUrl(input.inkStrokes);

  if (!snapshotDataUrl) {
    throw new Error('Draw handwritten ink strokes or attach a handwritten photo to transcribe with AI OCR.');
  }

  const ocr = await runServerHandwritingOcr({
    imageDataUrl: snapshotDataUrl,
    pageTitle: input.currentTitle,
    typedContext: input.typedContent,
  });

  const markdownSections: string[] = [];
  if (ocr.summary) {
    markdownSections.push(`## Summary\n${ocr.summary}`);
  }
  if (ocr.cleanedText) {
    markdownSections.push(`## Transcribed Notes\n${ocr.cleanedText}`);
  }
  if (ocr.keyPoints.length > 0) {
    markdownSections.push(
      `## Key Points\n${ocr.keyPoints.map((pt) => `- ${pt}`).join('\n')}`,
    );
  }
  if (ocr.tasks.length > 0) {
    markdownSections.push(
      `## Action Items\n${ocr.tasks
        .map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`)
        .join('\n')}`,
    );
  }

  return {
    title: ocr.titleSuggestion || input.currentTitle || 'Handwritten Note',
    cleanedMarkdown: markdownSections.join('\n\n') || ocr.rawTranscript,
    tags: ['handwriting-ocr'],
    suggestedNotebook: input.notebookTitle,
    confidence: 0.92,
    convertedAt: new Date().toISOString(),
    sourceStrokeCount: input.inkStrokes.length,
    sourceExcerpt:
      ocr.rawTranscript.slice(0, 260) ||
      `${input.inkStrokes.length} ink strokes preserved alongside transcript.`,
    pipelineNote: 'Transcribed via Google Gemini (gemini-4-hydrogen)',
  };
}
