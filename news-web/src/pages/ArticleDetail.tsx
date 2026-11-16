import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Clock,
  Sparkles,
  Sun,
  Type,
  X,
} from 'lucide-react';
import { ReadingProgressBar } from '../components/ReadingProgressBar';
import { TOPICS, WRITING_STYLES, type Story } from '../types/news';
import { useNewsStore, type NewsFontFamily, type NewsFontSize, type NewsTheme } from '../store/useNewsStore';

interface ArticleDetailProps {
  story: Story;
}

type ActivePopover = 'none' | 'voice' | 'theme' | 'typography';

const THEME_CLASSES: Record<
  NewsTheme,
  { page: string; header: string; muted: string; sheet: string; pill: string; divider: string }
> = {
  paper: {
    page: 'bg-[#F6EFE4] text-[#1F2A3A]',
    header: 'bg-[#F6EFE4]/92',
    muted: 'text-[#525E6E]',
    sheet: 'bg-[#FBF7F0] text-[#1F2A3A] border-[#1F2A3A]/15',
    pill: 'bg-[#1F2A3A] text-[#F6EFE4] border-[#F6EFE4]/15',
    divider: 'border-[#1F2A3A]/12',
  },
  sepia: {
    page: 'bg-[#ECE0CB] text-[#261F17]',
    header: 'bg-[#ECE0CB]/92',
    muted: 'text-[#594B3A]',
    sheet: 'bg-[#F4EAD8] text-[#261F17] border-[#261F17]/15',
    pill: 'bg-[#261F17] text-[#F4EAD8] border-[#F4EAD8]/15',
    divider: 'border-[#261F17]/12',
  },
  dark: {
    page: 'bg-[#141A16] text-[#ECE5D8]',
    header: 'bg-[#141A16]/92',
    muted: 'text-[#A9B1A8]',
    sheet: 'bg-[#1B231E] text-[#ECE5D8] border-[#ECE5D8]/15',
    pill: 'bg-[#ECE5D8] text-[#141A16] border-[#141A16]/15',
    divider: 'border-[#ECE5D8]/14',
  },
};

const FONT_SIZE_CLASSES: Record<NewsFontSize, string> = {
  sm: 'text-[17px]',
  md: 'text-[19px]',
  lg: 'text-[21px]',
};

const FONT_FAMILY_CLASSES: Record<NewsFontFamily, string> = {
  'source-serif': 'font-reading-serif',
  lora: 'font-reading-lora',
};

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ story }) => {
  const writingStyle = useNewsStore((s) => s.writingStyle);
  const savedStoryIds = useNewsStore((s) => s.savedStoryIds);
  const stories = useNewsStore((s) => s.stories);
  const livePool = useNewsStore((s) => s.livePool);
  const enrichingStoryIds = useNewsStore((s) => s.enrichingStoryIds);
  const theme = useNewsStore((s) => s.theme);
  const fontSize = useNewsStore((s) => s.fontSize);
  const fontFamily = useNewsStore((s) => s.fontFamily);

  const setWritingStyle = useNewsStore((s) => s.setWritingStyle);
  const toggleSaveStory = useNewsStore((s) => s.toggleSaveStory);
  const closeStory = useNewsStore((s) => s.closeStory);
  const openStory = useNewsStore((s) => s.openStory);
  const enrichStoryWithAi = useNewsStore((s) => s.enrichStoryWithAi);
  const setTheme = useNewsStore((s) => s.setTheme);
  const setFontSize = useNewsStore((s) => s.setFontSize);
  const setFontFamily = useNewsStore((s) => s.setFontFamily);

  const [activePopover, setActivePopover] = useState<ActivePopover>('none');
  const [imageFailed, setImageFailed] = useState(false);

  const isEnriching = Boolean(enrichingStoryIds[`${story.id}:${writingStyle}`]);
  const isSaved = savedStoryIds.includes(story.id);
  const topicMeta = TOPICS.find((t) => t.id === story.topic);
  const activeVoice = WRITING_STYLES.find((v) => v.id === writingStyle) ?? WRITING_STYLES[0];
  const palette = THEME_CLASSES[theme];
  const activeParagraphs =
    story.bodyByStyle?.[writingStyle] && story.bodyByStyle[writingStyle]!.length > 0
      ? story.bodyByStyle[writingStyle]!
      : story.bodyParagraphs;
  const activeLead = story.summaryByStyle[writingStyle] || story.summaryByStyle.brief;

  useEffect(() => {
    setImageFailed(false);
    if (!story.rewrittenVoices?.includes(writingStyle)) {
      void enrichStoryWithAi(story.id, writingStyle);
    }
  }, [story.id, writingStyle, story.rewrittenVoices, enrichStoryWithAi]);

  const nextStory = useMemo(() => {
    const pool = stories.length > 1 ? stories : livePool;
    if (pool.length <= 1) return null;
    const idx = pool.findIndex((s) => s.id === story.id);
    if (idx === -1) return null;
    return pool[(idx + 1) % pool.length] ?? null;
  }, [stories, livePool, story.id]);

  useEffect(() => {
    if (activePopover === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePopover]);

  return (
    <div className={`min-h-dvh transition-colors duration-200 ${palette.page}`}>
      <ReadingProgressBar />

      {/* Minimal Sticky Reading Bar modeled directly on Paper & Ink Reader */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-md transition-colors ${palette.divider} ${palette.header}`}>
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={closeStory}
            aria-label="Back to Daily Edition"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-opacity hover:opacity-75 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Edition</span>
          </button>

          <span className="max-w-[220px] truncate text-center text-xs font-medium tracking-wide opacity-80 sm:max-w-sm">
            {story.source} · {story.topic}
          </span>

          <button
            type="button"
            onClick={() => toggleSaveStory(story.id)}
            aria-label={isSaved ? 'Remove from saved stories' : 'Save story'}
            aria-pressed={isSaved}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-opacity hover:opacity-75 shrink-0 cursor-pointer"
          >
            <Bookmark
              className={`h-4 w-4 ${isSaved ? 'fill-[var(--pi-accent)] text-[var(--pi-accent)]' : ''}`}
            />
          </button>
        </div>
      </header>

      {/* Main 65ch Reading Column */}
      <main className="mx-auto max-w-[65ch] px-4 pt-7 pb-32 sm:px-8 sm:pt-14 sm:pb-40">
        <article>
          {/* Story Masthead */}
          <header className="mb-6 sm:mb-8 space-y-3.5 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: topicMeta?.colorToken || 'var(--pi-accent)' }}
              />
              <span className="pi-label" style={{ color: topicMeta?.colorToken || 'var(--pi-accent)' }}>
                {story.topic}
              </span>
              <span className="opacity-35">·</span>
              <span className={palette.muted}>{story.source}</span>
            </div>

            <h1 className="font-headline text-[27px] leading-[1.16] sm:text-[40px] sm:leading-[1.12] font-semibold tracking-tight">
              {story.headline}
            </h1>

            <div className={`flex flex-wrap items-center justify-between gap-3 border-y py-3 text-xs ${palette.divider} ${palette.muted}`}>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {story.readMinutes} min read
                </span>
                <span>{story.publishedAt}</span>
              </div>

              <a
                href={story.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--pi-accent)] hover:underline"
              >
                Original reporting at {story.source}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </header>

          {/* Editorial Photography */}
          {story.imageUrl && !imageFailed && (
            <figure className="mb-8">
              <div className={`overflow-hidden rounded-[20px] border ${palette.divider}`}>
                <img
                  src={story.imageUrl}
                  alt={story.imageAlt || story.headline}
                  onError={() => setImageFailed(true)}
                  className="w-full h-auto max-h-[420px] object-cover"
                />
              </div>
              {story.imageCaption && (
                <figcaption className={`mt-2.5 text-xs leading-relaxed ${palette.muted}`}>
                  {story.imageCaption}
                </figcaption>
              )}
            </figure>
          )}

          {/* Voice Selection & AI Rewrite Indicator */}
          <div className={`mb-7 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border px-4 py-3 ${palette.sheet}`}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--pi-accent)]">
              <Sparkles className={`h-3.5 w-3.5 ${isEnriching ? 'animate-pulse' : ''}`} />
              {isEnriching
                ? `Rewriting in ${activeVoice.label} Voice…`
                : `Written in ${activeVoice.label} Voice`}
            </span>

            <div className="flex flex-wrap items-center gap-1">
              {WRITING_STYLES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setWritingStyle(v.id)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    writingStyle === v.id
                      ? 'bg-[var(--pi-accent)] text-white'
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {activeLead && activeParagraphs[0] !== activeLead && (
            <p className={`mb-6 font-headline text-lg sm:text-xl leading-relaxed ${palette.muted}`}>
              {activeLead}
            </p>
          )}

          {/* Voice-Rewritten Reporting Prose */}
          <div
            className={`space-y-6 leading-[1.78] ${FONT_FAMILY_CLASSES[fontFamily]} ${FONT_SIZE_CLASSES[fontSize]}`}
          >
            {activeParagraphs.map((paragraph, idx) => (
              <React.Fragment key={idx}>
                <p className={idx === 0 ? 'pi-dropcap' : ''}>{paragraph}</p>
                {idx === 1 && story.pullQuote && (
                  <blockquote className={`my-8 border-l-2 border-[var(--pi-accent)] pl-5 font-headline text-xl italic leading-snug ${palette.muted}`}>
                    “{story.pullQuote}”
                  </blockquote>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Bottom Next Story Navigation */}
          {nextStory && nextStory.id !== story.id && (
            <nav
              aria-label="Continue reading"
              className={`mt-14 border-t pt-8 ${palette.divider}`}
            >
              <span className={`pi-label block mb-2 ${palette.muted}`}>Next in edition</span>
              <button
                type="button"
                onClick={() => openStory(nextStory.id)}
                className={`w-full rounded-[20px] border p-5 text-left flex items-center justify-between gap-4 transition-transform hover:-translate-y-0.5 cursor-pointer ${palette.sheet}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--pi-accent)]">
                    {nextStory.topic} · {nextStory.source}
                  </p>
                  <h2 className="font-headline text-lg font-semibold mt-1 truncate">
                    {nextStory.headline}
                  </h2>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-[var(--pi-accent)]" />
              </button>
            </nav>
          )}
        </article>
      </main>

      {/* Popovers above Floating Bottom Pill */}
      {activePopover !== 'none' && (
        <div
          onClick={() => setActivePopover('none')}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 px-0 pb-20 sm:px-4 sm:pb-22 backdrop-blur-[1px]"
        >
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-[24px] sm:rounded-[24px] border p-5 backdrop-blur-md ${palette.sheet}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="pi-label opacity-75">
                {activePopover === 'voice'
                  ? 'Summary Voice'
                  : activePopover === 'theme'
                    ? 'Paper & Light'
                    : 'Typography'}
              </span>
              <button
                type="button"
                onClick={() => setActivePopover('none')}
                aria-label="Close panel"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full hover:bg-black/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activePopover === 'voice' && (
              <div className="space-y-2">
                {WRITING_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setWritingStyle(style.id);
                      setActivePopover('none');
                    }}
                    className={`w-full rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                      writingStyle === style.id
                        ? 'border-[var(--pi-accent)] bg-[var(--pi-accent)]/10'
                        : 'border-current/12 hover:bg-black/5'
                    }`}
                  >
                    <div className="text-sm font-semibold">{style.label}</div>
                    <p className={`text-xs mt-0.5 ${palette.muted}`}>{style.description}</p>
                  </button>
                ))}
              </div>
            )}

            {activePopover === 'theme' && (
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { id: 'paper', label: 'Paper', swatch: 'bg-[#F6EFE4] text-[#1F2A3A]' },
                    { id: 'sepia', label: 'Sepia', swatch: 'bg-[#ECE0CB] text-[#261F17]' },
                    { id: 'dark', label: 'Desk', swatch: 'bg-[#141A16] text-[#ECE5D8]' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border text-xs font-medium cursor-pointer ${
                      item.swatch
                    } ${theme === item.id ? 'ring-2 ring-[var(--pi-accent)] ring-offset-2' : 'border-black/15'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activePopover === 'typography' && (
              <div className="space-y-4">
                <div>
                  <span className={`mb-1.5 block text-xs ${palette.muted}`}>Text size</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setFontSize(sz)}
                        className={`min-h-[42px] rounded-xl border text-xs font-medium uppercase cursor-pointer ${
                          fontSize === sz
                            ? 'border-[var(--pi-accent)] bg-[var(--pi-accent)] text-white'
                            : 'border-current/15'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={`mb-1.5 block text-xs ${palette.muted}`}>Reading serif</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'source-serif', label: 'Source Serif' },
                        { id: 'lora', label: 'Lora' },
                      ] as const
                    ).map((face) => (
                      <button
                        key={face.id}
                        type="button"
                        onClick={() => setFontFamily(face.id)}
                        className={`min-h-[42px] rounded-xl border px-3 text-xs font-medium cursor-pointer ${
                          fontFamily === face.id
                            ? 'border-[var(--pi-accent)] bg-[var(--pi-accent)] text-white'
                            : 'border-current/15'
                        }`}
                      >
                        {face.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Dark Control Pill matching ReaderView */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 sm:px-4">
        <div
          role="toolbar"
          aria-label="Article reading controls"
          className={`pointer-events-auto flex max-w-full items-center gap-1 rounded-full border px-2 py-1 ${palette.pill}`}
        >
          <button
            type="button"
            onClick={() => setActivePopover((prev) => (prev === 'voice' ? 'none' : 'voice'))}
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-3 text-xs font-medium cursor-pointer ${
              activePopover === 'voice' ? 'bg-[var(--pi-accent)] text-white' : 'hover:opacity-80'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{activeVoice.label}</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((prev) => (prev === 'theme' ? 'none' : 'theme'))}
            aria-label="Paper theme"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full hover:opacity-80 cursor-pointer"
          >
            <Sun className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((prev) => (prev === 'typography' ? 'none' : 'typography'))}
            aria-label="Typography settings"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full hover:opacity-80 cursor-pointer"
          >
            <Type className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
