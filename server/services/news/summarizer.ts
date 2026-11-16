import { serverConfig } from '../../config.ts';
import { extractJsonObject, runModelCompletion } from '../ai/client.ts';
import type { EnrichedNewsStory, NormalizedArticle, WritingStyle } from './types.ts';

export interface VoiceRewriteResult {
  summary: string;
  bodyParagraphs: string[];
  pullQuote?: string;
}

const VOICE_INSTRUCTIONS: Record<WritingStyle, string> = {
  brief:
    'VOICE = BRIEF: Rewrite as a crisp wire-service dispatch. Use a tight 1-2 sentence summary and 2-3 short, direct paragraphs delivering the core facts cleanly without fluff.',
  explainer:
    'VOICE = EXPLAINER: Rewrite as a calm, structured explainer. Write a 2-sentence summary plus 3 clear paragraphs covering (1) what is happening, (2) why it matters and its context, and (3) what to watch next.',
  witty:
    'VOICE = WITTY: Rewrite in a dry, restrained, literary editorial voice (like The New Yorker "Talk of the Town" — clever and perceptive, never goofy or slapstick). Write a wry 1-2 sentence lead and 2-3 vivid, engaging paragraphs grounded in the facts.',
  plain:
    'VOICE = PLAIN-ENGLISH: Rewrite in warm, everyday plain English free of bureaucratic or technical jargon. Use a simple 1-2 sentence takeaway and 2-3 clear, approachable paragraphs anyone can follow immediately.',
};

// In-memory cache keyed by `${articleId}:${voice}` so switching back to a voice is instant.
const voiceCache = new Map<string, VoiceRewriteResult>();

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
      `Reported via ${article.provider === 'newsdata' ? 'NewsData.io' : 'Mediastack'} (${article.publishedAt}). Open the publisher link below for the complete reporting.`,
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
    const cached = voiceCache.get(`${article.id}:${v}`);
    if (cached) {
      summaryByStyle[v] = cached.summary;
      bodyByStyle[v] = cached.bodyParagraphs;
      rewrittenVoices.push(v);
      if (v === voice && cached.pullQuote) {
        pullQuote = cached.pullQuote;
      }
    }
  }

  const activeCached = voiceCache.get(`${article.id}:${voice}`);
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
    readMinutes: Math.max(1, Math.min(4, Math.ceil(bodyParagraphs.join(' ').split(/\s+/).length / 130) || 2)),
    layoutVariant,
    aiGenerated: rewrittenVoices.includes(voice),
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

    // Process 2 articles per call so each batch completes reliably within output token budget.
    const chunks: NormalizedArticle[][] = [];
    for (let i = 0; i < missingForVoice.length; i += 2) {
      chunks.push(missingForVoice.slice(i, i + 2));
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
                  'You are the lead editorial rewriter for Paper & Ink News.',
                  VOICE_INSTRUCTIONS[voice],
                  'You MUST rewrite BOTH the card summary and the full multi-paragraph article prose directly in the requested voice.',
                  'STRICT ACCURACY RULE: Base every fact strictly on the provided headline, topic, source, and snippet. Never invent statistics, quotes, or fake interviews.',
                  'Respond strictly as JSON: {"articles":[{"id":"...","summary":"rewritten 1-2 sentence card lead in the chosen voice","pullQuote":"1 crisp sentence takeaway in the chosen voice","bodyParagraphs":["Rewritten paragraph 1","Rewritten paragraph 2","Rewritten paragraph 3"]}]}',
                  'Keep the exact id for every article. Never output reasoning.',
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
  voice: WritingStyle;
}): Promise<{
  voice: WritingStyle;
  summary: string;
  bodyParagraphs: string[];
  pullQuote?: string;
  aiGenerated: boolean;
}> {
  const cacheKey = `${article.id}:${article.voice}`;
  const cached = voiceCache.get(cacheKey);
  if (cached) {
    return {
      voice: article.voice,
      summary: cached.summary,
      bodyParagraphs: cached.bodyParagraphs,
      pullQuote: cached.pullQuote,
      aiGenerated: true,
    };
  }

  const raw = await runModelCompletion({
    jsonMode: true,
    temperature: article.voice === 'witty' ? 0.5 : 0.3,
    maxTokens: 4096,
    messages: [
      {
        role: 'system',
        content: [
          'You are the lead editorial rewriter for Paper & Ink News.',
          VOICE_INSTRUCTIONS[article.voice],
          'Rewrite BOTH the short summary and the complete article body directly in the requested voice.',
          'Base every fact strictly on the provided headline, source, topic, and snippet without inventing quotes or numbers.',
          'Respond strictly as JSON: {"summary":string,"pullQuote":string,"bodyParagraphs":string[]}.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify(article),
      },
    ],
  });

  const parsed = extractJsonObject<{
    summary?: string;
    pullQuote?: string;
    bodyParagraphs?: string[];
  }>(raw);

  const fallbackText = article.snippet || article.headline;
  const summary =
    typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallbackText;
  const bodyParagraphs = Array.isArray(parsed?.bodyParagraphs)
    ? parsed.bodyParagraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 10).slice(0, 4)
    : [fallbackText];
  const pullQuote =
    typeof parsed?.pullQuote === 'string' && parsed.pullQuote.trim().length > 8
      ? parsed.pullQuote.trim()
      : undefined;

  voiceCache.set(cacheKey, { summary, bodyParagraphs, pullQuote });

  return {
    voice: article.voice,
    summary,
    bodyParagraphs,
    pullQuote,
    aiGenerated: true,
  };
}
