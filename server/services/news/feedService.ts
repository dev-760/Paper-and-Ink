import { serverConfig } from '../../config.ts';
import { fetchMediastackArticles, fetchNewsdataArticles } from './providers.ts';
import { rewriteArticlesForVoice } from './summarizer.ts';
import {
  normalizeCountryCode,
  type EnrichedNewsStory,
  type NewsTopic,
  type NormalizedArticle,
  type ProviderFetchResult,
  type WritingStyle,
} from './types.ts';

export interface LiveFeedBundle {
  stories: EnrichedNewsStory[];
  editionDate: string;
  country: string;
  voice: WritingStyle;
  providers: {
    newsdata: { status: ProviderFetchResult['status']; count: number; message?: string };
    mediastack: { status: ProviderFetchResult['status']; count: number; message?: string };
  };
  aiModel: string;
  aiSummarizedCount: number;
  cached: boolean;
}

const RAW_CACHE_TTL_MS = 15 * 60 * 1000;

interface CachedRawEdition {
  country: string;
  articles: NormalizedArticle[];
  providers: LiveFeedBundle['providers'];
  editionDate: string;
  expiresAt: number;
}

const cachedRawByCountry = new Map<string, CachedRawEdition>();
const inFlightRawFetchByCountry = new Map<string, Promise<CachedRawEdition>>();
const inFlightVoiceEnrichment = new Map<string, Promise<LiveFeedBundle>>();

function normalizeHeadlineKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function deduplicateAndSelect(articles: NormalizedArticle[], maxTotal = 14): NormalizedArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: NormalizedArticle[] = [];

  const ranked = [...articles].sort((a, b) => {
    const scoreA = (a.description.length > 40 ? 2 : 0) + (a.imageUrl ? 1 : 0);
    const scoreB = (b.description.length > 40 ? 2 : 0) + (b.imageUrl ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.publishedIso.localeCompare(a.publishedIso);
  });

  for (const item of ranked) {
    const urlKey = item.originalUrl.replace(/[?#].*$/, '').toLowerCase();
    const titleKey = normalizeHeadlineKey(item.headline);
    if (seenUrls.has(urlKey) || (titleKey && seenTitles.has(titleKey))) continue;
    seenUrls.add(urlKey);
    if (titleKey) seenTitles.add(titleKey);
    unique.push(item);
  }

  const topicOrder: NewsTopic[] = ['Top Story', 'Tech', 'Politics', 'Science', 'Culture', 'Sports'];
  const buckets = new Map<NewsTopic, NormalizedArticle[]>();
  for (const topic of topicOrder) buckets.set(topic, []);
  for (const item of unique) buckets.get(item.topic)?.push(item);

  const selected: NormalizedArticle[] = [];
  let added = true;
  while (selected.length < maxTotal && added) {
    added = false;
    for (const topic of topicOrder) {
      const next = buckets.get(topic)?.shift();
      if (next && selected.length < maxTotal) {
        selected.push(next);
        added = true;
      }
    }
  }

  return selected;
}

async function fetchRawEdition(
  country: string,
  forceRefresh: boolean,
): Promise<{ raw: CachedRawEdition; fromCache: boolean }> {
  const now = Date.now();
  const cached = cachedRawByCountry.get(country);
  if (!forceRefresh && cached && now < cached.expiresAt) {
    return { raw: cached, fromCache: true };
  }

  const existingInFlight = inFlightRawFetchByCountry.get(country);
  if (existingInFlight) {
    return { raw: await existingInFlight, fromCache: false };
  }

  const fetchTask = (async () => {
    const [mediastackRes, newsdataRes] = await Promise.all([
      fetchMediastackArticles(serverConfig.mediastackApiKey, country),
      fetchNewsdataArticles(serverConfig.newsdataApiKey, country),
    ]);

    const combined = [...newsdataRes.articles, ...mediastackRes.articles];
    const articles = deduplicateAndSelect(combined, 14);
    const editionDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const edition: CachedRawEdition = {
      country,
      articles,
      editionDate,
      providers: {
        newsdata: {
          status: newsdataRes.status,
          count: newsdataRes.articles.length,
          ...(newsdataRes.message ? { message: newsdataRes.message } : {}),
        },
        mediastack: {
          status: mediastackRes.status,
          count: mediastackRes.articles.length,
          ...(mediastackRes.message ? { message: mediastackRes.message } : {}),
        },
      },
      expiresAt: Date.now() + RAW_CACHE_TTL_MS,
    };

    if (articles.length > 0) {
      cachedRawByCountry.set(country, edition);
    }
    return edition;
  })().finally(() => {
    inFlightRawFetchByCountry.delete(country);
  });

  inFlightRawFetchByCountry.set(country, fetchTask);
  return { raw: await fetchTask, fromCache: false };
}

export async function getLiveNewsFeed(options?: {
  forceRefresh?: boolean;
  voice?: WritingStyle;
  country?: string;
}): Promise<LiveFeedBundle> {
  const voice: WritingStyle = options?.voice || 'brief';
  const country = normalizeCountryCode(options?.country);
  const forceRefresh = Boolean(options?.forceRefresh);
  const lockKey = `${country}:${voice}:${forceRefresh ? 'refresh' : 'read'}`;

  const existingLock = inFlightVoiceEnrichment.get(lockKey);
  if (existingLock) return existingLock;

  const task = (async () => {
    const { raw, fromCache } = await fetchRawEdition(country, forceRefresh);
    const stories = await rewriteArticlesForVoice(raw.articles, voice, 6);

    return {
      stories,
      editionDate: raw.editionDate,
      country,
      voice,
      providers: raw.providers,
      aiModel: serverConfig.geminiModel,
      aiSummarizedCount: stories.filter((s) => s.aiGenerated).length,
      cached: fromCache,
    };
  })().finally(() => {
    inFlightVoiceEnrichment.delete(lockKey);
  });

  inFlightVoiceEnrichment.set(lockKey, task);
  return task;
}
