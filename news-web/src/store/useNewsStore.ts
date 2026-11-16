import { create } from 'zustand';
import {
  fetchLiveFeed,
  getFeed,
  summarizeStoryWithAi,
  type FeedProviderSummary,
} from '../api/feed';
import {
  detectDefaultCountry,
  isValidNewsCountry,
  TOPICS,
  type NewsCountry,
  type Story,
  type Topic,
  type TopicFilter,
  type WritingStyle,
} from '../types/news';
import { STORAGE_KEYS, storageAdapter } from '../lib/storage';

export type NewsTheme = 'paper' | 'sepia' | 'dark';
export type NewsFontSize = 'sm' | 'md' | 'lg';
export type NewsFontFamily = 'source-serif' | 'lora';

interface PersistedPreferences {
  selectedTopic: TopicFilter;
  writingStyle: WritingStyle;
  country: NewsCountry;
  interests: Topic[];
  hasCompletedOnboarding: boolean;
}

interface PersistedTypography {
  fontSize: NewsFontSize;
  fontFamily: NewsFontFamily;
}

const VALID_TOPIC_IDS: Topic[] = TOPICS.map((t) => t.id);
const VALID_FILTERS: TopicFilter[] = ['All', 'For You', 'Saved', ...VALID_TOPIC_IDS];
const VALID_STYLES: WritingStyle[] = ['brief', 'explainer', 'witty', 'plain'];

function loadInitialPreferences(): PersistedPreferences {
  const defaultCountry = detectDefaultCountry();
  const raw = storageAdapter.getItem(STORAGE_KEYS.PREFERENCES);
  if (!raw) {
    return {
      selectedTopic: 'All',
      writingStyle: 'brief',
      country: defaultCountry,
      interests: [...VALID_TOPIC_IDS],
      hasCompletedOnboarding: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
    const selectedTopic =
      parsed.selectedTopic && VALID_FILTERS.includes(parsed.selectedTopic)
        ? parsed.selectedTopic
        : 'All';
    const writingStyle =
      parsed.writingStyle && VALID_STYLES.includes(parsed.writingStyle)
        ? parsed.writingStyle
        : 'brief';
    const country = isValidNewsCountry(parsed.country) ? parsed.country : defaultCountry;
    const interests = Array.isArray(parsed.interests)
      ? Array.from(
          new Set(
            parsed.interests.filter((t): t is Topic =>
              VALID_TOPIC_IDS.includes(t as Topic),
            ),
          ),
        )
      : [...VALID_TOPIC_IDS];
    const hasCompletedOnboarding =
      typeof parsed.hasCompletedOnboarding === 'boolean'
        ? parsed.hasCompletedOnboarding
        : true;

    return {
      selectedTopic:
        selectedTopic === 'For You' && interests.length === 0 ? 'All' : selectedTopic,
      writingStyle,
      country,
      interests,
      hasCompletedOnboarding,
    };
  } catch {
    return {
      selectedTopic: 'All',
      writingStyle: 'brief',
      country: defaultCountry,
      interests: [...VALID_TOPIC_IDS],
      hasCompletedOnboarding: false,
    };
  }
}

function savePreferences(prefs: PersistedPreferences): void {
  storageAdapter.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
}

function loadSavedStoryIds(): string[] {
  const raw = storageAdapter.getItem(STORAGE_KEYS.READING_LIST);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    );
  } catch {
    return [];
  }
}

function loadSavedStoriesMap(): Record<string, Story> {
  const raw = storageAdapter.getItem(STORAGE_KEYS.SAVED_STORIES);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, Story>;
  } catch {
    return {};
  }
}

function saveSavedStoriesData(ids: string[], map: Record<string, Story>): void {
  storageAdapter.setItem(STORAGE_KEYS.READING_LIST, JSON.stringify(ids));
  storageAdapter.setItem(STORAGE_KEYS.SAVED_STORIES, JSON.stringify(map));
}

function loadTheme(): NewsTheme {
  const raw = storageAdapter.getItem(STORAGE_KEYS.THEME);
  if (raw === 'dark' || raw === 'sepia' || raw === 'paper') return raw;
  return 'paper';
}

function loadTypography(): PersistedTypography {
  const raw = storageAdapter.getItem(STORAGE_KEYS.TYPOGRAPHY);
  if (!raw) return { fontSize: 'md', fontFamily: 'source-serif' };
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTypography>;
    return {
      fontSize:
        parsed.fontSize === 'sm' || parsed.fontSize === 'md' || parsed.fontSize === 'lg'
          ? parsed.fontSize
          : 'md',
      fontFamily:
        parsed.fontFamily === 'lora' || parsed.fontFamily === 'source-serif'
          ? parsed.fontFamily
          : 'source-serif',
    };
  } catch {
    return { fontSize: 'md', fontFamily: 'source-serif' };
  }
}

function safeLoadFeed(params: {
  topic: TopicFilter;
  writingStyle: WritingStyle;
  interests: Topic[];
  savedStoryIds: string[];
  savedStoriesMap: Record<string, Story>;
  sourcePool: Story[];
}): { stories: Story[]; editionDate: string; error: string | null } {
  try {
    const res = getFeed(params);
    return {
      stories: res.stories,
      editionDate: res.editionDate,
      error: null,
    };
  } catch {
    return {
      stories: [],
      editionDate: 'Today',
      error: 'We hit a snag preparing your edition.',
    };
  }
}

interface NewsState {
  livePool: Story[];
  stories: Story[];
  editionDate: string;
  selectedTopic: TopicFilter;
  writingStyle: WritingStyle;
  country: NewsCountry;
  interests: Topic[];
  savedStoryIds: string[];
  savedStoriesMap: Record<string, Story>;
  hasCompletedOnboarding: boolean;
  activeStoryId: string | null;
  searchQuery: string;
  isStyleModalOpen: boolean;
  isCountryModalOpen: boolean;
  isLoadingFeed: boolean;
  isRefreshingFeed: boolean;
  enrichingStoryIds: Record<string, boolean>;
  feedError: string | null;
  providerStatus: {
    mode: 'curated' | 'live';
    newsdata?: FeedProviderSummary;
    mediastack?: FeedProviderSummary;
    aiModel?: string;
    aiSummarizedCount?: number;
  };
  theme: NewsTheme;
  fontSize: NewsFontSize;
  fontFamily: NewsFontFamily;

  loadLiveFeed: (options?: {
    forceRefresh?: boolean;
    voice?: WritingStyle;
    country?: NewsCountry;
  }) => Promise<void>;
  enrichStoryWithAi: (storyId: string, voice?: WritingStyle) => Promise<void>;
  setTopic: (topic: TopicFilter) => void;
  setWritingStyle: (style: WritingStyle) => void;
  setCountry: (country: NewsCountry) => void;
  setSearchQuery: (query: string) => void;
  setTheme: (theme: NewsTheme) => void;
  toggleDark: () => void;
  setFontSize: (size: NewsFontSize) => void;
  setFontFamily: (family: NewsFontFamily) => void;
  toggleSaveStory: (storyId: string) => void;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  openStyleModal: () => void;
  closeStyleModal: () => void;
  openCountryModal: () => void;
  closeCountryModal: () => void;
  completeOnboarding: (
    nextInterests: Topic[],
    nextStyle: WritingStyle,
    nextCountry: NewsCountry,
  ) => void;
  skipOnboarding: () => void;
  reopenOnboarding: () => void;
  retryFeed: () => void;
  reloadForScope: () => void;
}

function buildScopedState(existingLivePool: Story[] = []) {
  const prefs = loadInitialPreferences();
  const savedStoryIds = loadSavedStoryIds();
  const savedStoriesMap = loadSavedStoriesMap();
  const theme = loadTheme();
  const typo = loadTypography();
  const feed = safeLoadFeed({
    topic: prefs.selectedTopic,
    writingStyle: prefs.writingStyle,
    interests: prefs.interests,
    savedStoryIds,
    savedStoriesMap,
    sourcePool: existingLivePool,
  });

  return {
    livePool: existingLivePool,
    stories: feed.stories,
    editionDate: feed.editionDate,
    selectedTopic: prefs.selectedTopic,
    writingStyle: prefs.writingStyle,
    country: prefs.country,
    interests: prefs.interests,
    savedStoryIds,
    savedStoriesMap,
    hasCompletedOnboarding: prefs.hasCompletedOnboarding,
    activeStoryId: null,
    searchQuery: '',
    isStyleModalOpen: false,
    isCountryModalOpen: false,
    feedError: feed.error,
    theme,
    fontSize: typo.fontSize,
    fontFamily: typo.fontFamily,
  };
}

export const useNewsStore = create<NewsState>((set, get) => ({
  ...buildScopedState([]),
  isLoadingFeed: true,
  isRefreshingFeed: false,
  enrichingStoryIds: {},
  providerStatus: { mode: 'live' },

  loadLiveFeed: async (options) => {
    const isRefresh = Boolean(options?.forceRefresh);
    const requestedVoice = options?.voice || get().writingStyle;
    const requestedCountry = options?.country || get().country;
    set(
      isRefresh
        ? { isRefreshingFeed: true, feedError: null }
        : {
            isLoadingFeed: get().livePool.length === 0,
            isRefreshingFeed: get().livePool.length > 0,
            feedError: null,
          },
    );

    try {
      const bundle = await fetchLiveFeed({
        forceRefresh: isRefresh,
        voice: requestedVoice,
        country: requestedCountry,
      });

      // Ignore stale responses if the user switched country while this request was in flight.
      if (get().country !== requestedCountry) {
        return;
      }

      const { selectedTopic, writingStyle, interests, savedStoryIds, savedStoriesMap } = get();
      const nextPool = bundle.stories;
      const feed = safeLoadFeed({
        topic: selectedTopic,
        writingStyle,
        interests,
        savedStoryIds,
        savedStoriesMap,
        sourcePool: nextPool,
      });

      set({
        livePool: nextPool,
        stories: feed.stories,
        editionDate: bundle.editionDate || feed.editionDate,
        feedError: bundle.stories.length === 0 ? 'Live news providers returned no articles for this country.' : null,
        isLoadingFeed: false,
        isRefreshingFeed: false,
        providerStatus: {
          mode: 'live',
          newsdata: bundle.providers.newsdata,
          mediastack: bundle.providers.mediastack,
          aiModel: bundle.aiModel,
          aiSummarizedCount: bundle.aiSummarizedCount,
        },
      });
    } catch (err) {
      if (get().country !== requestedCountry) {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unable to fetch live edition.';
      set({
        isLoadingFeed: false,
        isRefreshingFeed: false,
        feedError: msg,
      });
    }
  },

  enrichStoryWithAi: async (storyId, voiceOverride) => {
    const targetVoice = voiceOverride || get().writingStyle;
    const lockKey = `${storyId}:${targetVoice}`;
    const { livePool, savedStoriesMap, enrichingStoryIds } = get();
    if (enrichingStoryIds[lockKey]) return;

    const story =
      livePool.find((s) => s.id === storyId) ??
      savedStoriesMap[storyId] ??
      null;
    if (!story || (story.fullArticleLoaded && story.rewrittenVoices?.includes(targetVoice))) return;

    set({ enrichingStoryIds: { ...enrichingStoryIds, [lockKey]: true } });

    try {
      const enriched = await summarizeStoryWithAi(story, targetVoice);
      const patchStory = (item: Story): Story => {
        if (item.id !== storyId) return item;
        const nextParagraphs =
          enriched.bodyParagraphs.length > 0 ? enriched.bodyParagraphs : item.bodyParagraphs;
        const nextReadMinutes = Math.max(
          1,
          Math.min(10, Math.ceil(nextParagraphs.join(' ').split(/\s+/).length / 160) || item.readMinutes),
        );
        return {
          ...item,
          summaryByStyle: {
            ...item.summaryByStyle,
            [targetVoice]: enriched.summary || item.summaryByStyle[targetVoice],
          },
          bodyByStyle: {
            ...(item.bodyByStyle || {}),
            [targetVoice]: nextParagraphs,
          },
          rewrittenVoices: Array.from(new Set([...(item.rewrittenVoices || []), targetVoice])),
          bodyParagraphs: nextParagraphs,
          pullQuote: enriched.pullQuote || item.pullQuote,
          readMinutes: nextReadMinutes,
          aiGenerated: enriched.aiGenerated,
          fullArticleLoaded: Boolean(enriched.fullArticleLoaded ?? true),
        };
      };

      const nextPool = get().livePool.map(patchStory);
      const nextStories = get().stories.map(patchStory);
      const nextSavedMap = { ...get().savedStoriesMap };
      if (nextSavedMap[storyId]) {
        nextSavedMap[storyId] = patchStory(nextSavedMap[storyId]);
        saveSavedStoriesData(get().savedStoryIds, nextSavedMap);
      }

      const nextEnriching = { ...get().enrichingStoryIds };
      delete nextEnriching[lockKey];

      set({
        livePool: nextPool,
        stories: nextStories,
        savedStoriesMap: nextSavedMap,
        enrichingStoryIds: nextEnriching,
      });
    } catch {
      const nextEnriching = { ...get().enrichingStoryIds };
      delete nextEnriching[lockKey];
      set({ enrichingStoryIds: nextEnriching });
    }
  },

  reloadForScope: () => {
    const prevCountry = get().country;
    const currentPool = get().livePool;
    const nextState = buildScopedState(currentPool);
    const countryChanged = nextState.country !== prevCountry;
    set({
      ...nextState,
      ...(countryChanged ? { livePool: [], stories: [], isLoadingFeed: true } : {}),
    });
    if (countryChanged) {
      void get().loadLiveFeed({ country: nextState.country, voice: nextState.writingStyle });
    }
  },

  setTopic: (topic) => {
    const {
      writingStyle,
      country,
      interests,
      savedStoryIds,
      savedStoriesMap,
      hasCompletedOnboarding,
      livePool,
    } = get();
    const feed = safeLoadFeed({
      topic,
      writingStyle,
      interests,
      savedStoryIds,
      savedStoriesMap,
      sourcePool: livePool,
    });
    savePreferences({
      selectedTopic: topic,
      writingStyle,
      country,
      interests,
      hasCompletedOnboarding,
    });
    set({
      selectedTopic: topic,
      stories: feed.stories,
      feedError: feed.error,
      activeStoryId: null,
    });
  },

  setWritingStyle: (style) => {
    const {
      selectedTopic,
      country,
      interests,
      hasCompletedOnboarding,
      livePool,
      activeStoryId,
    } = get();
    savePreferences({
      selectedTopic,
      writingStyle: style,
      country,
      interests,
      hasCompletedOnboarding,
    });
    set({ writingStyle: style });

    if (activeStoryId) {
      void get().enrichStoryWithAi(activeStoryId, style);
    }

    const needsFeedRewrite =
      livePool.length > 0 &&
      livePool.slice(0, 4).some((item) => !item.rewrittenVoices?.includes(style));
    if (needsFeedRewrite) {
      void get().loadLiveFeed({ voice: style, country });
    }
  },

  setCountry: (country) => {
    const { selectedTopic, writingStyle, interests, hasCompletedOnboarding } = get();
    savePreferences({
      selectedTopic,
      writingStyle,
      country,
      interests,
      hasCompletedOnboarding,
    });
    set({
      country,
      livePool: [],
      stories: [],
      activeStoryId: null,
      isLoadingFeed: true,
      feedError: null,
    });
    void get().loadLiveFeed({ country, voice: writingStyle });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setTheme: (theme) => {
    storageAdapter.setItem(STORAGE_KEYS.THEME, theme);
    set({ theme });
  },

  toggleDark: () => {
    const next: NewsTheme = get().theme === 'dark' ? 'paper' : 'dark';
    storageAdapter.setItem(STORAGE_KEYS.THEME, next);
    set({ theme: next });
  },

  setFontSize: (fontSize) => {
    const nextTypo = { fontSize, fontFamily: get().fontFamily };
    storageAdapter.setItem(STORAGE_KEYS.TYPOGRAPHY, JSON.stringify(nextTypo));
    set({ fontSize });
  },

  setFontFamily: (fontFamily) => {
    const nextTypo = { fontSize: get().fontSize, fontFamily };
    storageAdapter.setItem(STORAGE_KEYS.TYPOGRAPHY, JSON.stringify(nextTypo));
    set({ fontFamily });
  },

  toggleSaveStory: (storyId) => {
    const { savedStoryIds, savedStoriesMap, selectedTopic, writingStyle, interests, livePool, stories } = get();
    const exists = savedStoryIds.includes(storyId);
    const nextSaved = exists
      ? savedStoryIds.filter((id) => id !== storyId)
      : [storyId, ...savedStoryIds];

    const nextMap = { ...savedStoriesMap };
    if (exists) {
      delete nextMap[storyId];
    } else {
      const found =
        stories.find((s) => s.id === storyId) ??
        livePool.find((s) => s.id === storyId);
      if (found) {
        nextMap[storyId] = found;
      }
    }

    saveSavedStoriesData(nextSaved, nextMap);

    if (selectedTopic === 'Saved') {
      const feed = safeLoadFeed({
        topic: 'Saved',
        writingStyle,
        interests,
        savedStoryIds: nextSaved,
        savedStoriesMap: nextMap,
        sourcePool: livePool,
      });
      set({
        savedStoryIds: nextSaved,
        savedStoriesMap: nextMap,
        stories: feed.stories,
        feedError: feed.error,
      });
    } else {
      set({ savedStoryIds: nextSaved, savedStoriesMap: nextMap });
    }
  },

  openStory: (storyId) => {
    set({ activeStoryId: storyId });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  closeStory: () => {
    set({ activeStoryId: null });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  openStyleModal: () => set({ isStyleModalOpen: true }),
  closeStyleModal: () => set({ isStyleModalOpen: false }),
  openCountryModal: () => set({ isCountryModalOpen: true }),
  closeCountryModal: () => set({ isCountryModalOpen: false }),

  completeOnboarding: (nextInterests, nextStyle, nextCountry) => {
    const { savedStoryIds, savedStoriesMap, livePool, country: prevCountry } = get();
    const validNext = nextInterests.filter((t) => VALID_TOPIC_IDS.includes(t));
    const cleanInterests = validNext.length > 0 ? validNext : [...VALID_TOPIC_IDS];
    const nextTopic: TopicFilter =
      cleanInterests.length < VALID_TOPIC_IDS.length ? 'For You' : 'All';
    const countryChanged = nextCountry !== prevCountry;
    const pool = countryChanged ? [] : livePool;

    const feed = safeLoadFeed({
      topic: nextTopic,
      writingStyle: nextStyle,
      interests: cleanInterests,
      savedStoryIds,
      savedStoriesMap,
      sourcePool: pool,
    });

    savePreferences({
      selectedTopic: nextTopic,
      writingStyle: nextStyle,
      country: nextCountry,
      interests: cleanInterests,
      hasCompletedOnboarding: true,
    });

    set({
      interests: cleanInterests,
      writingStyle: nextStyle,
      country: nextCountry,
      selectedTopic: nextTopic,
      hasCompletedOnboarding: true,
      activeStoryId: null,
      livePool: pool,
      stories: countryChanged ? [] : feed.stories,
      feedError: countryChanged ? null : feed.error,
      ...(countryChanged ? { isLoadingFeed: true } : {}),
    });

    void get().loadLiveFeed({ voice: nextStyle, country: nextCountry });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  skipOnboarding: () => {
    const { savedStoryIds, savedStoriesMap, writingStyle, country, livePool } = get();
    const allTopics = [...VALID_TOPIC_IDS];
    const feed = safeLoadFeed({
      topic: 'All',
      writingStyle,
      interests: allTopics,
      savedStoryIds,
      savedStoriesMap,
      sourcePool: livePool,
    });

    savePreferences({
      selectedTopic: 'All',
      writingStyle,
      country,
      interests: allTopics,
      hasCompletedOnboarding: true,
    });

    set({
      interests: allTopics,
      selectedTopic: 'All',
      hasCompletedOnboarding: true,
      activeStoryId: null,
      stories: feed.stories,
      feedError: feed.error,
    });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  reopenOnboarding: () => {
    set({
      hasCompletedOnboarding: false,
      activeStoryId: null,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  retryFeed: () => {
    void get().loadLiveFeed({ forceRefresh: true });
  },
}));
