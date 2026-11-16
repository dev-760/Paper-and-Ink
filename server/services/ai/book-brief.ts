import { extractJsonObject, runModelCompletion } from './client.ts';

export interface BookBriefResult {
  brief: string;
  themes: string[];
}

export async function generateBookBrief(options: {
  title: string;
  author?: string;
  totalPages?: number;
  chapterTitles?: string[];
  excerpt: string;
}): Promise<BookBriefResult> {
  const title = options.title.trim().slice(0, 160);
  const author = (options.author || '').trim().slice(0, 120);
  const excerpt = options.excerpt.trim().slice(0, 7500);
  const chapterList = Array.isArray(options.chapterTitles)
    ? options.chapterTitles
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        .slice(0, 20)
    : [];

  if (!title || !excerpt) {
    throw new Error('Book title and text excerpt are required to generate a brief.');
  }

  const rawResponse = await runModelCompletion({
    jsonMode: true,
    temperature: 0.25,
    maxTokens: 4096,
    messages: [
      {
        role: 'system',
        content: [
          'You are the Senior Literary Editor for Paper & Ink Reader — a calm, thoughtful independent reading salon.',
          'Write a refined, deeply engaging editorial brief (2 to 4 crisp, evocative sentences) introducing the imported book strictly from its title, author, chapter titles, and excerpt.',
          'Structure the brief so it naturally conveys: (1) the book’s central premise, setting, or core inquiry; (2) its narrative voice, style, or intellectual lens; and (3) what makes it compelling for the reader — without spoilers or invented plot claims.',
          'Avoid hollow clichés ("In this compelling masterpiece", "must-read", "delves into") and write concrete, vivid prose.',
          'LANGUAGE RULE: Always write the brief and theme tags in the primary script and language of the book’s title and excerpt (e.g., fluent literary Arabic for an Arabic book, natural editorial English for an English book).',
          'Also provide 2 to 4 sharp, specific thematic tags (1 to 3 words each; Title Case in English) avoiding generic tags like "Book", "Reading", or "Story".',
          'Respond strictly as valid JSON: {"brief": string, "themes": string[]}. Never include commentary or chain-of-thought.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          title,
          ...(author ? { author } : {}),
          ...(options.totalPages ? { totalPages: options.totalPages } : {}),
          ...(chapterList.length > 0 ? { chapterTitles: chapterList } : {}),
          excerpt,
        }),
      },
    ],
  });

  const parsed = extractJsonObject<Partial<BookBriefResult>>(rawResponse);
  const brief =
    typeof parsed?.brief === 'string' && parsed.brief.trim().length > 15
      ? parsed.brief.trim()
      : rawResponse.trim();

  const themes = Array.isArray(parsed?.themes)
    ? parsed.themes
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 32))
        .slice(0, 4)
    : [];

  if (!brief) {
    throw new Error('Could not generate a brief for this book.');
  }

  return { brief, themes };
}
