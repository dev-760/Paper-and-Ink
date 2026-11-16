import type { ReaderTheme, ShelfTone } from '../design-system/tokens';

export type CoverPattern = 'arch' | 'grid' | 'waves' | 'horizon' | 'botanical' | 'folio';

export type CoverPalette =
  | 'terracotta-cream'
  | 'navy-gold'
  | 'sage-linen'
  | 'ochre-espresso'
  | 'slate-ivory'
  | 'plum-parchment'
  | 'forest-sand'
  | 'rust-charcoal';

export interface BookCoverSpec {
  palette: CoverPalette;
  pattern: CoverPattern;
  editionNote?: string;
}

export interface Chapter {
  id: string;
  index: number;
  label: string; // e.g., "Chapter I"
  title: string;
  paragraphs: string[];
  estimatedMinutes: number;
}

export interface Book {
  id: string;
  shelfId: string;
  title: string;
  subtitle?: string;
  author: string;
  year?: string;
  description: string;
  totalPages: number;
  isFullSample?: boolean;
  progressPercent: number;
  lastOpenedAt?: number;
  cover: BookCoverSpec;
  chapters: Chapter[];
}

export interface Shelf {
  id: string;
  title: string;
  tone: ShelfTone;
  description?: string;
}

export interface ReadingPosition {
  bookId: string;
  chapterId: string;
  charOffset: number;
  progressPercent: number;
  updatedAt: number;
}

export interface Quote {
  id: string;
  bookId: string;
  chapterId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  note?: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string;
  charOffset: number;
  label: string;
  createdAt: number;
}

export interface SavedWord {
  word: string;
  partOfSpeech: string;
  definition: string;
  bookId: string;
  savedAt: number;
}

export type ReaderFontChoice = 'source-serif' | 'lora';
export type ReaderFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type ReaderLineHeight = 'snug' | 'relaxed' | 'airy';
export type ReaderAlignment = 'left' | 'justify';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontChoice;
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  alignment: ReaderAlignment;
  hyphenation: boolean;
}
