import type { Book, CoverPalette, CoverPattern, Shelf } from '../types/reader';

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

/** Pick a deterministic editorial cover palette and pattern from book metadata. */
export function pickDeterministicCover(seed: string): { palette: CoverPalette; pattern: CoverPattern } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return {
    palette: COVER_PALETTES[hash % COVER_PALETTES.length],
    pattern: COVER_PATTERNS[(hash >> 3) % COVER_PATTERNS.length],
  };
}

/** Estimate reading duration in minutes from paragraph prose. */
export function estimateReadingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Parse clean title and optional author from an uploaded book filename. */
export function parseFilenameTitleAuthor(filename: string): { title: string; author?: string } {
  const stem = filename
    .replace(/\.(pdf|epub)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stem) {
    return { title: 'Imported Book' };
  }

  const parts = stem.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const first = parts[0].trim();
    const second = parts.slice(1).join(' - ').trim();
    if (first && second) {
      return { title: first, author: second };
    }
  }

  return { title: stem };
}

/** Match an imported book to the closest shelf based on title and prose sample. */
export function suggestShelf(title: string, textSample: string, shelves: Shelf[]): Shelf | undefined {
  const combined = `${title} ${textSample}`.toLowerCase();
  const findByIdOrKeyword = (keywords: string[]) =>
    shelves.find((s) =>
      keywords.some((kw) => s.title.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw)),
    );

  if (/chapter|novel|poem|story|fiction|tale|sonnet|library|coffee|human|رواية|قصة|الفصل/.test(combined)) {
    return findByIdOrKeyword(['literature', 'classic', 'fiction']) || shelves[0];
  }
  if (/essay|philosophy|letter|journal|memoir|ethics|art|history|فلسفة|مقال/.test(combined)) {
    return findByIdOrKeyword(['essay', 'philosophy', 'history', 'nonfiction']) || shelves[1] || shelves[0];
  }
  if (/theorem|algorithm|design|system|architecture|physics|research|study|علم|هندسة/.test(combined)) {
    return findByIdOrKeyword(['craft', 'design', 'science', 'reference']) || shelves[2] || shelves[0];
  }
  return shelves[0];
}

/** Detect whether text is predominantly right-to-left script (Arabic, Hebrew, Persian, Urdu). */
export function isRtlText(text: string | undefined | null): boolean {
  if (!text) return false;
  const rtlMatches = text.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g);
  const ltrMatches = text.match(/[A-Za-z]/g);
  const rtlCount = rtlMatches ? rtlMatches.length : 0;
  const ltrCount = ltrMatches ? ltrMatches.length : 0;
  return rtlCount > 0 && rtlCount >= ltrCount * 0.4;
}

/** Infer whether a whole book uses RTL typography based on its title and opening chapter. */
export function isRtlBook(book: Pick<Book, 'title' | 'chapters'>): boolean {
  const sample = [
    book.title,
    book.chapters[0]?.title || '',
    book.chapters[0]?.paragraphs.slice(0, 3).join(' ') || '',
  ].join(' ');
  return isRtlText(sample);
}
