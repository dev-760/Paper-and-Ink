import { createHash } from 'node:crypto';
import {
  formatRelativePublished,
  mapCategoriesToTopic,
  sanitizeNewsText,
  type NormalizedArticle,
  type ProviderFetchResult,
} from './types.ts';

function stableId(prefix: string, seed: string): string {
  return `${prefix}-${createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
}

function normalizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

interface NewsdataRawItem {
  article_id?: string;
  link?: string;
  title?: string;
  description?: string | null;
  content?: string | null;
  category?: string[];
  pubDate?: string;
  image_url?: string | null;
  source_name?: string;
  source_id?: string;
  duplicate?: boolean;
}

interface NewsdataResponse {
  status?: string;
  results?: NewsdataRawItem[];
  message?: string;
}

export async function fetchNewsdataArticles(
  apiKey: string,
  country = 'us',
): Promise<ProviderFetchResult> {
  if (!apiKey) {
    return { provider: 'newsdata', status: 'unconfigured', articles: [] };
  }

  // Two balanced category requests give live coverage across all Paper & Ink topics.
  const batches = [
    'top,politics,science',
    'technology,entertainment,sports',
  ];

  const collected: NormalizedArticle[] = [];
  const errors: string[] = [];

  const runBatches = async (withEnglishFilter: boolean) => {
    for (const categories of batches) {
      try {
        const url = new URL('https://newsdata.io/api/1/latest');
        url.searchParams.set('apikey', apiKey);
        if (withEnglishFilter) {
          url.searchParams.set('language', 'en');
        }
        if (country && country !== 'world') {
          url.searchParams.set('country', country);
        }
        url.searchParams.set('category', categories);
        url.searchParams.set('size', '10');

        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = (await response.json()) as NewsdataResponse;

        if (!response.ok || data.status !== 'success') {
          errors.push(data.message || `HTTP ${response.status}`);
          continue;
        }

        for (const item of data.results || []) {
          if (item.duplicate) continue;
          const headline = sanitizeNewsText(item.title);
          const originalUrl = typeof item.link === 'string' ? item.link.trim() : '';
          if (!headline || !originalUrl || !/^https?:\/\//i.test(originalUrl)) continue;

          const desc = sanitizeNewsText(item.description) || sanitizeNewsText(item.content);
          const timing = formatRelativePublished(item.pubDate);
          const cats = Array.isArray(item.category) ? item.category : [];

          collected.push({
            id: stableId('nd', item.article_id || originalUrl),
            provider: 'newsdata',
            topic: mapCategoriesToTopic(cats, headline),
            source: sanitizeNewsText(item.source_name || item.source_id) || 'Wire Report',
            originalUrl,
            headline,
            description: desc,
            imageUrl: normalizeImageUrl(item.image_url),
            publishedAt: timing.label,
            publishedIso: timing.iso,
          });
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Request failed');
      }
    }
  };

  await runBatches(true);
  // If a non-English country returned zero English articles, retry without restricting language.
  if (collected.length === 0 && country && country !== 'world') {
    await runBatches(false);
  }

  if (collected.length === 0 && errors.length > 0) {
    return {
      provider: 'newsdata',
      status: 'error',
      articles: [],
      message: errors[0],
    };
  }

  return {
    provider: 'newsdata',
    status: 'ok',
    articles: collected,
    ...(errors.length > 0 ? { message: errors[0] } : {}),
  };
}

interface MediastackRawItem {
  title?: string;
  description?: string;
  url?: string;
  source?: string;
  image?: string | null;
  category?: string;
  published_at?: string;
}

interface MediastackResponse {
  data?: MediastackRawItem[];
  error?: { code?: string; message?: string };
}

export async function fetchMediastackArticles(
  apiKey: string,
  country = 'us',
): Promise<ProviderFetchResult> {
  if (!apiKey) {
    return { provider: 'mediastack', status: 'unconfigured', articles: [] };
  }

  // Free Mediastack plans use HTTP; try HTTP first then HTTPS if needed.
  const endpoints = [
    'http://api.mediastack.com/v1/news',
    'https://api.mediastack.com/v1/news',
  ];

  let lastError = 'Mediastack request failed.';

  for (const base of endpoints) {
    try {
      const url = new URL(base);
      url.searchParams.set('access_key', apiKey);
      url.searchParams.set('languages', 'en');
      if (country && country !== 'world') {
        url.searchParams.set('countries', country);
      }
      url.searchParams.set('sort', 'published_desc');
      url.searchParams.set('limit', '15');

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = (await response.json()) as MediastackResponse;

      if (!response.ok || data.error) {
        lastError = data.error?.message || `HTTP ${response.status}`;
        if (data.error?.code === 'invalid_access_key') {
          return {
            provider: 'mediastack',
            status: 'error',
            articles: [],
            message: lastError,
          };
        }
        continue;
      }

      const collected: NormalizedArticle[] = [];
      for (const item of data.data || []) {
        const headline = sanitizeNewsText(item.title);
        const originalUrl = typeof item.url === 'string' ? item.url.trim() : '';
        if (!headline || !originalUrl || !/^https?:\/\//i.test(originalUrl)) continue;

        const desc = sanitizeNewsText(item.description);
        const timing = formatRelativePublished(item.published_at);

        collected.push({
          id: stableId('ms', originalUrl),
          provider: 'mediastack',
          topic: mapCategoriesToTopic([item.category], headline),
          source: sanitizeNewsText(item.source) || 'Mediastack Wire',
          originalUrl,
          headline,
          description: desc,
          imageUrl: normalizeImageUrl(item.image),
          publishedAt: timing.label,
          publishedIso: timing.iso,
        });
      }

      return {
        provider: 'mediastack',
        status: 'ok',
        articles: collected,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Request failed';
    }
  }

  return {
    provider: 'mediastack',
    status: 'error',
    articles: [],
    message: lastError,
  };
}
