import type { Notebook } from '../types/notebook';
import type { ConversionResult, NotePage } from '../types/note';
import type { InkStroke } from '../types/ink';

export interface NotesStorageAdapter {
  init(): Promise<void>;
  getAllNotebooks(): Promise<Notebook[]>;
  createNotebook(notebook: Notebook): Promise<Notebook>;
  updateNotebook(notebook: Notebook): Promise<Notebook>;
  deleteNotebook(notebookId: string): Promise<void>;
  getAllPages(): Promise<NotePage[]>;
  getPagesByNotebook(notebookId: string): Promise<NotePage[]>;
  getPage(pageId: string): Promise<NotePage | null>;
  createPage(page: NotePage): Promise<NotePage>;
  updatePage(page: NotePage): Promise<NotePage>;
  deletePage(pageId: string): Promise<void>;
  saveInkStrokes(pageId: string, strokes: InkStroke[]): Promise<NotePage>;
  saveConversionResult(
    pageId: string,
    result: ConversionResult
  ): Promise<NotePage>;
  seedIfEmpty(
    seedNotebooks: Notebook[],
    seedPages: NotePage[]
  ): Promise<{ notebooks: Notebook[]; pages: NotePage[] }>;
  replaceAll(notebooks: Notebook[], pages: NotePage[]): Promise<void>;
}
