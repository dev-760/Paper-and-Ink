export type Topic =
  | 'Top Story'
  | 'Tech'
  | 'Politics'
  | 'Culture'
  | 'Sports'
  | 'Science';

export type TopicFilter = 'All' | 'For You' | 'Saved' | Topic;

export type WritingStyle = 'brief' | 'explainer' | 'witty' | 'plain';

export type NewsCountry =
  | 'world'
  | 'ma'
  | 'us'
  | 'gb'
  | 'tr'
  | 'om'
  | 'jp'
  | 'kr'
  | 'fr';

export interface CountryMeta {
  code: NewsCountry;
  shortCode: string;
  label: string;
}

export const NEWS_COUNTRIES: CountryMeta[] = [
  { code: 'world', shortCode: 'GL', label: 'Global' },
  { code: 'ma', shortCode: 'MA', label: 'Morocco' },
  { code: 'us', shortCode: 'US', label: 'United States' },
  { code: 'gb', shortCode: 'GB', label: 'United Kingdom' },
  { code: 'tr', shortCode: 'TR', label: 'Turkey' },
  { code: 'om', shortCode: 'OM', label: 'Oman' },
  { code: 'jp', shortCode: 'JP', label: 'Japan' },
  { code: 'kr', shortCode: 'KR', label: 'South Korea' },
  { code: 'fr', shortCode: 'FR', label: 'France' },
];

const VALID_COUNTRY_SET = new Set<NewsCountry>(NEWS_COUNTRIES.map((c) => c.code));

export function isValidNewsCountry(value: unknown): value is NewsCountry {
  return typeof value === 'string' && VALID_COUNTRY_SET.has(value as NewsCountry);
}

export function getCountryMeta(code: NewsCountry): CountryMeta {
  return (
    NEWS_COUNTRIES.find((c) => c.code === code) ??
    NEWS_COUNTRIES.find((c) => c.code === 'us') ??
    NEWS_COUNTRIES[0]
  );
}

export function detectDefaultCountry(): NewsCountry {
  if (typeof navigator === 'undefined') return 'us';
  const lang = navigator.language || '';
  const parts = lang.split('-');
  const region = parts[1]?.toLowerCase();
  if (region && VALID_COUNTRY_SET.has(region as NewsCountry)) {
    return region as NewsCountry;
  }
  return 'us';
}

export type StoryLayoutVariant = 'featured' | 'image' | 'typography';

export interface SummaryByStyle {
  brief: string;
  explainer: string;
  witty: string;
  plain: string;
}

export interface Story {
  id: string;
  provider?: 'newsdata' | 'mediastack';
  aiGenerated?: boolean;
  fullArticleLoaded?: boolean;
  topic: Topic;
  source: string;
  originalUrl: string;
  headline: string;
  summaryByStyle: SummaryByStyle;
  bodyByStyle?: Partial<Record<WritingStyle, string[]>>;
  rewrittenVoices?: WritingStyle[];
  imageUrl: string | null;
  imageAlt?: string;
  imageCaption?: string;
  pullQuote?: string;
  bodyParagraphs: string[];
  publishedAt: string;
  readMinutes: number;
  layoutVariant: StoryLayoutVariant;
}

export interface TopicMeta {
  id: Topic;
  label: string;
  shortLabel: string;
  colorToken: string;
}

export const TOPICS: TopicMeta[] = [
  {
    id: 'Top Story',
    label: 'Top Story',
    shortLabel: 'Top Story',
    colorToken: 'var(--pi-topic-top-story)',
  },
  {
    id: 'Tech',
    label: 'Tech',
    shortLabel: 'Tech',
    colorToken: 'var(--pi-topic-tech)',
  },
  {
    id: 'Politics',
    label: 'Politics',
    shortLabel: 'Politics',
    colorToken: 'var(--pi-topic-politics)',
  },
  {
    id: 'Culture',
    label: 'Culture',
    shortLabel: 'Culture',
    colorToken: 'var(--pi-topic-culture)',
  },
  {
    id: 'Sports',
    label: 'Sports',
    shortLabel: 'Sports',
    colorToken: 'var(--pi-topic-sports)',
  },
  {
    id: 'Science',
    label: 'Science',
    shortLabel: 'Science',
    colorToken: 'var(--pi-topic-science)',
  },
];

export const WRITING_STYLES: Array<{
  id: WritingStyle;
  label: string;
  description: string;
}> = [
  {
    id: 'brief',
    label: 'Brief',
    description: 'Wire-service clarity in one or two crisp sentences.',
  },
  {
    id: 'explainer',
    label: 'Explainer',
    description: 'Measured context detailing how and why it matters.',
  },
  {
    id: 'witty',
    label: 'Witty',
    description: 'Dry literary observation with editorial restraint.',
  },
  {
    id: 'plain',
    label: 'Plain-English',
    description: 'Direct everyday language without institutional jargon.',
  },
];

export const TOPIC_COLOR_MAP: Record<Topic, string> = {
  'Top Story': 'var(--pi-topic-top-story)',
  Tech: 'var(--pi-topic-tech)',
  Politics: 'var(--pi-topic-politics)',
  Culture: 'var(--pi-topic-culture)',
  Sports: 'var(--pi-topic-sports)',
  Science: 'var(--pi-topic-science)',
};
