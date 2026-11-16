import type { Book, Chapter } from '../types/reader';

export interface GeneratedBookBrief {
  brief: string;
  themes: string[];
}

export function buildBookExcerpt(chapters: Chapter[], maxChars = 6500): string {
  if (chapters.length === 0) return '';

  // Prefer substantive prose chapters over frontmatter/copyright pages when sampling.
  const proseChapters = chapters.filter(
    (c) =>
      !/^(?:cover|copyright|title page|contents|table of contents|dedication|about the author|acknowledgments?)$/i.test(
        c.title.trim(),
      ) && c.paragraphs.join(' ').trim().length > 140,
  );
  const pool = proseChapters.length > 0 ? proseChapters : chapters;

  const sampled: Chapter[] = [];
  if (pool[0]) sampled.push(pool[0]);
  if (pool[1]) sampled.push(pool[1]);
  if (pool.length > 3) {
    sampled.push(pool[Math.floor(pool.length / 2)]);
  }

  const parts: string[] = [];
  let total = 0;

  for (const ch of sampled) {
    const header = `${ch.label}: ${ch.title}\n`;
    const body = ch.paragraphs.slice(0, 6).join('\n\n');
    const chunk = `${header}${body}`.trim();
    if (!chunk) continue;
    if (total + chunk.length > maxChars) {
      const remaining = Math.max(0, maxChars - total);
      if (remaining > 120) {
        parts.push(chunk.slice(0, remaining));
      }
      break;
    }
    parts.push(chunk);
    total += chunk.length + 2;
  }

  return parts.join('\n\n').trim();
}

export async function requestBookBrief(input: {
  title: string;
  author?: string;
  totalPages?: number;
  chapters: Chapter[];
}): Promise<GeneratedBookBrief> {
  const excerpt = buildBookExcerpt(input.chapters);
  if (!excerpt) {
    throw new Error('Book has no extracted text to summarize.');
  }

  const apiBase = (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || ''
  )
    .trim()
    .replace(/\/$/, '');

  const response = await fetch(`${apiBase}/api/ai/book-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      author: input.author,
      totalPages: input.totalPages,
      chapterTitles: input.chapters.slice(0, 20).map((c) => `${c.label}: ${c.title}`),
      excerpt,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<GeneratedBookBrief> & {
    error?: string;
  };
  if (!response.ok || typeof data.brief !== 'string' || !data.brief.trim()) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not generate AI book brief.');
  }

  return {
    brief: data.brief.trim(),
    themes: Array.isArray(data.themes)
      ? data.themes.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : [],
  };
}

export function applyBriefToBook(book: Book, result: GeneratedBookBrief): Book {
  return {
    ...book,
    description: result.brief,
    aiBrief: result.brief,
    aiThemes: result.themes,
  };
}
