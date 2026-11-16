import type { InkStroke } from './ink';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';

export type EditorMode = 'typing' | 'ink';

export interface ConversionResult {
  title: string;
  cleanedMarkdown: string;
  tags: string[];
  suggestedNotebook: string;
  confidence: number;
  convertedAt: string;
  sourceStrokeCount: number;
  sourceExcerpt: string;
  pipelineNote: string;
}

export interface NotePage {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  inkStrokes: InkStroke[];
  originalImage?: string | null;
  tags: string[];
  conversionResult?: ConversionResult | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}
