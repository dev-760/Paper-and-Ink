import { serverConfig } from '../../config.ts';
import { extractJsonObject, runModelCompletion } from '../ai/client.ts';
import { fetchFullArticleText } from './articleFetcher.ts';
import type { EnrichedNewsStory, NormalizedArticle, WritingStyle } from './types.ts';

export interface VoiceRewriteResult {
  summary: string;
  bodyParagraphs: string[];
  pullQuote?: string;
}

const VOICE_INSTRUCTIONS: Record<WritingStyle, string> = {
  brief:
    'VOICE = BRIEF: Write like a crisp Reuters/AP senior wire editor. Front-load the essential who, what, when, and where with economy and precision — clean declarative sentences, exact attribution, zero filler adjectives.',
  explainer:
    'VOICE = EXPLAINER: Write with the calm analytical clarity of a top explanatory desk. Unpack (1) what just happened, (2) the institutional, historical, or economic context behind it, and (3) what stakeholders or readers should watch next.',
  witty:
    'VOICE = WITTY: Write with dry, understated, literary magazine wit (think The New Yorker "Talk of the Town" or FT Notebook) — perceptive, crisp, and lightly ironic only where the facts naturally invite it; never cheesy, never slangy, never glib on human tragedy.',
  plain:
    'VOICE = PLAIN-ENGLISH: Write in warm, direct, everyday prose accessible to any reader. Translate legal, policy, financial, or scientific jargon cleanly into clear human meaning without talking down.',
};

// In-memory cache keyed by `${articleId}:${voice}` so switching back to a voice is instant.
const voiceCache = new Map<string, VoiceRewriteResult>();
const fullVoiceCache = new Map<string, VoiceRewriteResult & { fullArticleLoaded: boolean }>();

interface BatchRewriteItem {
  id?: string;
  summary?: string;
  pullQuote?: string;
  bodyParagraphs?: string[];
}

interface BatchRewriteResponse {
  articles?: BatchRewriteItem[];
}

function buildFallbackRewrite(article: NormalizedArticle, voice: WritingStyle): VoiceRewriteResult {
  const lead = article.description || article.headline;
  const trimmedLead = lead.length > 280 ? `${lead.slice(0, 277).trim()}...` : lead;

  const summaryMap: Record<WritingStyle, string> = {
    brief: trimmedLead,
    explainer: `${article.source} reports in ${article.topic}: ${trimmedLead}`,
    witty: `${trimmedLead} — via today's ${article.topic.toLowerCase()} dispatch from ${article.source}.`,
    plain: `In short: ${trimmedLead}`,
  };

  return {
    summary: summaryMap[voice],
    bodyParagraphs: [
      article.description
        ? article.description
        : `${article.source} published coverage on "${article.headline}" under ${article.topic}.`,
    ],
  };
}

export function buildStoryForVoice(
  article: NormalizedArticle,
  voice: WritingStyle,
  index: number,
): EnrichedNewsStory {
  const layoutVariant: EnrichedNewsStory['layoutVariant'] =
    index === 0 ? 'featured' : article.imageUrl ? 'image' : 'typography';

  const summaryByStyle = {
    brief: buildFallbackRewrite(article, 'brief').summary,
    explainer: buildFallbackRewrite(article, 'explainer').summary,
    witty: buildFallbackRewrite(article, 'witty').summary,
    plain: buildFallbackRewrite(article, 'plain').summary,
  };
  const bodyByStyle: Partial<Record<WritingStyle, string[]>> = {};
  const rewrittenVoices: WritingStyle[] = [];
  let pullQuote: string | undefined;

  for (const v of ['brief', 'explainer', 'witty', 'plain'] as const) {
    const fullCached = fullVoiceCache.get(`${article.id}:${v}`);
    const cached = fullCached || voiceCache.get(`${article.id}:${v}`);
    if (cached) {
      summaryByStyle[v] = cached.summary;
      bodyByStyle[v] = cached.bodyParagraphs;
      rewrittenVoices.push(v);
      if (v === voice && cached.pullQuote) {
        pullQuote = cached.pullQuote;
      }
    }
  }

  const activeFull = fullVoiceCache.get(`${article.id}:${voice}`);
  const activeCached = activeFull || voiceCache.get(`${article.id}:${voice}`);
  const bodyParagraphs = activeCached?.bodyParagraphs || buildFallbackRewrite(article, voice).bodyParagraphs;

  return {
    id: article.id,
    provider: article.provider,
    topic: article.topic,
    source: article.source,
    originalUrl: article.originalUrl,
    headline: article.headline,
    summaryByStyle,
    bodyByStyle,
    rewrittenVoices,
    imageUrl: article.imageUrl,
    imageAlt: article.headline,
    pullQuote,
    bodyParagraphs,
    publishedAt: article.publishedAt,
    readMinutes: Math.max(1, Math.min(8, Math.ceil(bodyParagraphs.join(' ').split(/\s+/).length / 130) || 2)),
    layoutVariant,
    aiGenerated: rewrittenVoices.includes(voice),
    fullArticleLoaded: Boolean(activeFull?.fullArticleLoaded),
  };
}

export async function rewriteArticlesForVoice(
  articles: NormalizedArticle[],
  voice: WritingStyle,
  maxAiArticles = 6,
): Promise<EnrichedNewsStory[]> {
  if (serverConfig.geminiApiKey && articles.length > 0) {
    const missingForVoice = articles
      .slice(0, maxAiArticles)
      .filter((a) => !voiceCache.has(`${a.id}:${voice}`));

    // Process up to 4 articles in a single call to respect Gemini free-tier RPM/RPD limits.
    const chunks: NormalizedArticle[][] = [];
    for (let i = 0; i < missingForVoice.length; i += 4) {
      chunks.push(missingForVoice.slice(i, i + 4));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const payload = chunk.map((a) => ({
            id: a.id,
            topic: a.topic,
            source: a.source,
            headline: a.headline,
            snippet: a.description || '(Headline-only dispatch)',
          }));

          const raw = await runModelCompletion({
            jsonMode: true,
            temperature: voice === 'witty' ? 0.5 : 0.3,
            maxTokens: 4096,
            messages: [
              {
                role: 'system',
                content: [
                  'You are the Managing Desk Editor for Paper & Ink News — a calm, print-inspired daily edition.',
                  VOICE_INSTRUCTIONS[voice],
                  'For each article, craft a punchy 1–2 sentence card lead ("summary"), 1 memorable factual "pullQuote" (grounded in real facts or direct quotes from the source), and 3 cohesive editorial paragraphs ("bodyParagraphs").',
                  'JOURNALISTIC INTEGRITY: Every name, number, date, location, and quote must come strictly from the provided source material — attribute claims cleanly ("officials said", "according to...") and never fabricate statistics, motives, or quotes.',
                  'HYGIENE & LANGUAGE: Omit cookie prompts, newsletter CTAs, and meta-mentions of NewsData or Mediastack. Preserve non-English regional editions in their source language when supplied.',
                  'Respond strictly as JSON: {"articles":[{"id":"...","summary":string,"pullQuote":string,"bodyParagraphs":string[]}]}. Keep the exact id for every item. Never output reasoning.',
                ].join(' '),
              },
              {
                role: 'user',
                content: JSON.stringify({ voice, articles: payload }),
              },
            ],
          });

          const parsed = extractJsonObject<BatchRewriteResponse>(raw);
          for (const item of parsed?.articles || []) {
            if (!item || typeof item.id !== 'string') continue;
            const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
            const paragraphs = Array.isArray(item.bodyParagraphs)
              ? item.bodyParagraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 12).slice(0, 4)
              : [];
            if (!summary && paragraphs.length === 0) continue;

            const srcArticle = chunk.find((c) => c.id === item.id);
            const fallback = srcArticle ? buildFallbackRewrite(srcArticle, voice) : null;
            voiceCache.set(`${item.id}:${voice}`, {
              summary: summary || fallback?.summary || '',
              bodyParagraphs: paragraphs.length > 0 ? paragraphs : fallback?.bodyParagraphs || [],
              pullQuote:
                typeof item.pullQuote === 'string' && item.pullQuote.trim().length > 8
                  ? item.pullQuote.trim()
                  : undefined,
            });
          }
        } catch (err) {
          console.warn(`[News AI ${voice} batch skipped]`, err instanceof Error ? err.message : err);
        }
      }),
    );
  }

  return articles.map((article, idx) => buildStoryForVoice(article, voice, idx));
}

export async function rewriteSingleStoryForVoice(article: {
  id: string;
  topic: string;
  source: string;
  headline: string;
  snippet: string;
  originalUrl?: string;
  voice: WritingStyle;
}): Promise<{
  voice: WritingStyle;
  summary: string;
  bodyParagraphs: string[];
  pullQuote?: string;
  aiGenerated: boolean;
  fullArticleLoaded: boolean;
}> {
  const cacheKey = `${article.id}:${article.voice}`;
  const fullCached = fullVoiceCache.get(cacheKey);
  if (fullCached) {
    return {
      voice: article.voice,
      summary: fullCached.summary,
      bodyParagraphs: fullCached.bodyParagraphs,
      pullQuote: fullCached.pullQuote,
      aiGenerated: true,
      fullArticleLoaded: fullCached.fullArticleLoaded,
    };
  }

  const fetchedArticle = await fetchFullArticleText(article.originalUrl);
  const hasFullPublisherText = Boolean(fetchedArticle && fetchedArticle.paragraphs.length >= 2);
  const sourceBody = hasFullPublisherText ? fetchedArticle!.fullText : article.snippet;

  try {
    const raw = await runModelCompletion({
      jsonMode: true,
      temperature: article.voice === 'witty' ? 0.45 : 0.25,
      maxTokens: 5000,
      messages: [
        {
          role: 'system',
          content: [
            'You are the Senior Feature & Dispatch Writer for Paper & Ink News.',
            VOICE_INSTRUCTIONS[article.voice],
            hasFullPublisherText
              ? 'You are provided the complete reporting fetched from the publisher. Compose a complete, deeply readable 5 to 9 paragraph article in the requested voice, preserving all key facts, timeline developments, named sources, figures, and direct quotes cleanly with varied narrative rhythm.'
              : 'Craft BOTH a crisp 1–2 sentence lead ("summary") and a clean 3-paragraph editorial dispatch grounded strictly in the provided facts.',
            'JOURNALISTIC INTEGRITY & HYGIENE: Never invent facts, numbers, or quotes absent from the source text; preserve nuanced attribution ("according to...", "officials said"). Strip all subscription prompts, inbox newsletter banners, cookie notices, or references to wire aggregators.',
            'Also choose 1 incisive factual highlight or real quoted line for "pullQuote" (or empty string if none fits). Preserve the source article language when non-English.',
            'Respond strictly as JSON: {"summary":string,"pullQuote":string,"bodyParagraphs":string[]}. Never output chain-of-thought.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            topic: article.topic,
            source: article.source,
            headline: article.headline,
            voice: article.voice,
            ...(hasFullPublisherText
              ? { fullArticleText: sourceBody }
              : { snippet: sourceBody || article.headline }),
          }),
        },
      ],
    });

    const parsed = extractJsonObject<{
      summary?: string;
      pullQuote?: string;
      bodyParagraphs?: string[];
    }>(raw);

    const fallbackParagraphs =
      hasFullPublisherText && fetchedArticle
        ? fetchedArticle.paragraphs.slice(0, 18)
        : [article.snippet || article.headline];

    const summary =
      typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallbackParagraphs[0];
    const aiParagraphs = Array.isArray(parsed?.bodyParagraphs)
      ? parsed.bodyParagraphs
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 16)
          .slice(0, 12)
      : [];

    const bodyParagraphs =
      hasFullPublisherText && aiParagraphs.length < 3 && fetchedArticle
        ? fetchedArticle.paragraphs.slice(0, 18)
        : aiParagraphs.length > 0
          ? aiParagraphs
          : fallbackParagraphs;

    const pullQuote =
      typeof parsed?.pullQuote === 'string' && parsed.pullQuote.trim().length > 8
        ? parsed.pullQuote.trim()
        : undefined;

    const entry = {
      summary,
      bodyParagraphs,
      pullQuote,
      fullArticleLoaded: true,
    };
    fullVoiceCache.set(cacheKey, entry);

    return {
      voice: article.voice,
      summary,
      bodyParagraphs,
      pullQuote,
      aiGenerated: true,
      fullArticleLoaded: true,
    };
  } catch {
    if (hasFullPublisherText && fetchedArticle) {
      const entry = {
        summary: article.snippet || fetchedArticle.paragraphs[0],
        bodyParagraphs: fetchedArticle.paragraphs.slice(0, 18),
        fullArticleLoaded: true,
      };
      fullVoiceCache.set(cacheKey, entry);
      return {
        voice: article.voice,
        ...entry,
        aiGenerated: false,
      };
    }

    // Never fail an article open with HTTP 502 if publisher blocks scraping or AI quota is temporarily exhausted.
    return {
      voice: article.voice,
      summary: article.snippet || article.headline,
      bodyParagraphs: [article.snippet || article.headline],
      aiGenerated: false,
      fullArticleLoaded: true,
    };
  }
}
