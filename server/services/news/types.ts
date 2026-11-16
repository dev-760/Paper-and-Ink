export type NewsTopic =
  | 'Top Story'
  | 'Tech'
  | 'Politics'
  | 'Culture'
  | 'Sports'
  | 'Science';

export type WritingStyle = 'brief' | 'explainer' | 'witty' | 'plain';

export function normalizeCountryCode(raw: unknown): string {
  if (typeof raw !== 'string') return 'us';
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'world' || cleaned === 'all') return 'world';
  if (/^[a-z]{2}$/.test(cleaned)) return cleaned;
  return 'us';
}

export interface SummaryByStyle {
  brief: string;
  explainer: string;
  witty: string;
  plain: string;
}

export interface NormalizedArticle {
  id: string;
  provider: 'newsdata' | 'mediastack';
  topic: NewsTopic;
  source: string;
  originalUrl: string;
  headline: string;
  description: string;
  imageUrl: string | null;
  publishedAt: string;
  publishedIso: string;
}

export interface EnrichedNewsStory {
  id: string;
  provider: 'newsdata' | 'mediastack';
  topic: NewsTopic;
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
  layoutVariant: 'featured' | 'image' | 'typography';
  aiGenerated: boolean;
  fullArticleLoaded?: boolean;
}

export interface ProviderFetchResult {
  provider: 'newsdata' | 'mediastack';
  status: 'ok' | 'error' | 'unconfigured';
  articles: NormalizedArticle[];
  message?: string;
}

export function sanitizeNewsText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const stripped = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return '';
  if (/^ONLY AVAILABLE IN PAID PLANS$/i.test(stripped)) return '';
  return stripped;
}

export function mapCategoriesToTopic(rawCategories: Array<string | undefined | null>, headline = ''): NewsTopic {
  const joined = `${rawCategories.filter(Boolean).join(' ')} ${headline}`.toLowerCase();

  if (/\b(tech|technology|software|ai|cyber|silicon|apple|google|microsoft|chip|digital|robotics)\b/.test(joined)) {
    return 'Tech';
  }
  if (/\b(science|environment|climate|space|nasa|physics|biology|health|medicine|research)\b/.test(joined)) {
    return 'Science';
  }
  if (/\b(politics|government|election|parliament|senate|congress|diplomacy|policy|minister)\b/.test(joined)) {
    return 'Politics';
  }
  if (/\b(sports|football|soccer|nba|tennis|olympic|formula 1|f1|cricket|premier league|champions)\b/.test(joined)) {
    return 'Sports';
  }
  if (/\b(culture|entertainment|art|arts|music|film|cinema|book|books|museum|lifestyle|design|architecture)\b/.test(joined)) {
    return 'Culture';
  }
  return 'Top Story';
}

export function formatRelativePublished(dateInput: string | undefined): { label: string; iso: string } {
  if (!dateInput) {
    return { label: 'Today', iso: new Date().toISOString() };
  }
  const normalized = dateInput.includes('T') ? dateInput : dateInput.replace(' ', 'T') + 'Z';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Today', iso: new Date().toISOString() };
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / 3_600_000));
  if (diffHours < 1) return { label: 'Just now', iso: parsed.toISOString() };
  if (diffHours < 24) return { label: `${diffHours}h ago`, iso: parsed.toISOString() };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return { label: 'Yesterday', iso: parsed.toISOString() };
  return {
    label: parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    iso: parsed.toISOString(),
  };
}
