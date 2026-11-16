import type {
  NewsCountry,
  Story,
  Topic,
  TopicFilter,
  WritingStyle,
} from '../types/news';

export interface FeedPreferences {
  topic: TopicFilter;
  writingStyle: WritingStyle;
  interests?: Topic[];
  savedStoryIds?: string[];
  savedStoriesMap?: Record<string, Story>;
  sourcePool?: Story[];
}

export interface FeedProviderSummary {
  status: 'ok' | 'error' | 'unconfigured';
  count: number;
  message?: string;
}

export interface LiveFeedResponse {
  stories: Story[];
  editionDate: string;
  country: string;
  voice: WritingStyle;
  providers: {
    newsdata: FeedProviderSummary;
    mediastack: FeedProviderSummary;
  };
  aiModel: string;
  aiSummarizedCount: number;
  cached: boolean;
}

export interface FeedResponse {
  stories: Story[];
  editionDate: string;
  appliedTopic: TopicFilter;
  appliedStyle: WritingStyle;
}

function getApiBaseUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return (metaEnv.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

/**
 * Fetches live stories from our Express backend (/api/news/feed),
 * rewritten in the user's selected reading Voice.
 */
export async function fetchLiveFeed(options?: {
  forceRefresh?: boolean;
  voice?: WritingStyle;
  country?: NewsCountry;
}): Promise<LiveFeedResponse> {
  const params = new URLSearchParams();
  if (options?.country) params.set('country', options.country);
  if (options?.voice) params.set('voice', options.voice);
  if (options?.forceRefresh) params.set('refresh', '1');
  const qs = params.toString();

  const response = await fetch(`${getApiBaseUrl()}/api/news/feed${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = (await response.json().catch(() => ({}))) as Partial<LiveFeedResponse> & { error?: string };
  if (!response.ok || !Array.isArray(data.stories)) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to reach Paper & Ink live news server.');
  }
  return data as LiveFeedResponse;
}

export async function summarizeStoryWithAi(
  story: Story,
  voice: WritingStyle,
): Promise<{
  voice: WritingStyle;
  summary: string;
  bodyParagraphs: string[];
  pullQuote?: string;
  aiGenerated: boolean;
}> {
  const snippet = story.bodyParagraphs[0] || story.summaryByStyle.brief || '';
  const response = await fetch(`${getApiBaseUrl()}/api/news/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: story.id,
      topic: story.topic,
      source: story.source,
      headline: story.headline,
      snippet,
      voice,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'AI rewrite request failed.');
  }
  return data;
}

/**
 * Filters loaded live stories or locally persisted saved stories.
 */
export function getFeed(preferences: FeedPreferences): FeedResponse {
  const pool = preferences.sourcePool ?? [];

  let filteredStories: Story[];

  if (preferences.topic === 'Saved') {
    const savedIds = preferences.savedStoryIds ?? [];
    const byId = new Map<string, Story>();
    for (const item of Object.values(preferences.savedStoriesMap || {})) {
      byId.set(item.id, item);
    }
    for (const item of pool) {
      byId.set(item.id, item);
    }
    filteredStories = savedIds
      .map((id) => byId.get(id))
      .filter((s): s is Story => Boolean(s));
  } else if (preferences.topic === 'For You') {
    const activeInterests = preferences.interests ?? [];
    filteredStories =
      activeInterests.length > 0
        ? pool.filter((story) => activeInterests.includes(story.topic))
        : pool;
  } else if (preferences.topic === 'All') {
    filteredStories = pool;
  } else {
    filteredStories = pool.filter((story) => story.topic === preferences.topic);
  }

  return {
    stories: filteredStories,
    editionDate: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    appliedTopic: preferences.topic,
    appliedStyle: preferences.writingStyle,
  };
}
