import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  AlignLeft,
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Quote as QuoteIcon,
  Search,
  Sun,
  Timer,
  Type,
  X,
} from 'lucide-react';
import { freeDictionaryProvider, type DictionaryEntry } from '../lib/dictionary';
import type {
  Book,
  Quote,
  ReaderAlignment,
  ReaderFontChoice,
  ReaderFontSize,
  ReaderLineHeight,
  ReaderSettings,
  SavedWord,
} from '../types/reader';
import type { ReaderTheme } from '../design-system/tokens';

interface ReaderViewProps {
  book: Book;
  initialChapterId?: string;
  initialScrollRatio?: number;
  settings: ReaderSettings;
  quotes?: Quote[];
  savedWords?: SavedWord[];
  isBookmarked: (chapterId: string) => boolean;
  onToggleBookmark: (chapterId: string, label: string) => void;
  onSaveQuote?: (quote: Quote) => Promise<void>;
  onSaveWord?: (word: SavedWord) => Promise<void>;
  onUpdateSettings: (next: ReaderSettings) => void;
  onProgressChange: (chapterId: string, progressPercent: number, scrollRatio?: number) => void;
  onBackToLibrary: () => void;
}

type ActivePopover = 'none' | 'chapters' | 'theme' | 'typography';

const THEME_SURFACE: Record<
  ReaderTheme,
  {
    page: string;
    text: string;
    muted: string;
    sheet: string;
    pill: string;
    divider: string;
    fade: string;
  }
> = {
  paper: {
    page: 'bg-[#F6EFE4] text-[#1F2A3A]',
    text: 'text-[#1F2A3A]',
    muted: 'text-[#525E6E]',
    sheet: 'bg-[#FBF7F0] text-[#1F2A3A] border-[#1F2A3A]/15',
    pill: 'bg-[#1F2A3A] text-[#F6EFE4] border-[#F6EFE4]/15',
    divider: 'border-[#1F2A3A]/12',
    fade: 'bg-gradient-to-t from-[#F6EFE4] via-[#F6EFE4]/85 to-transparent',
  },
  sepia: {
    page: 'bg-[#ECE0CB] text-[#261F17]',
    text: 'text-[#261F17]',
    muted: 'text-[#594B3A]',
    sheet: 'bg-[#F4EAD8] text-[#261F17] border-[#261F17]/15',
    pill: 'bg-[#261F17] text-[#F4EAD8] border-[#F4EAD8]/15',
    divider: 'border-[#261F17]/12',
    fade: 'bg-gradient-to-t from-[#ECE0CB] via-[#ECE0CB]/85 to-transparent',
  },
  dark: {
    page: 'bg-[#141A16] text-[#ECE7DC]',
    text: 'text-[#ECE7DC]',
    muted: 'text-[#A9B1A8]',
    sheet: 'bg-[#1B231E] text-[#ECE7DC] border-[#ECE7DC]/15',
    pill: 'bg-[#ECE7DC] text-[#141A16] border-[#141A16]/15',
    divider: 'border-[#ECE7DC]/14',
    fade: 'bg-gradient-to-t from-[#141A16] via-[#141A16]/85 to-transparent',
  },
};

const FONT_SIZE_CLASS: Record<ReaderFontSize, string> = {
  sm: 'text-[17px]',
  md: 'text-[19px]',
  lg: 'text-[21px]',
  xl: 'text-[23px]',
};

const LINE_HEIGHT_CLASS: Record<ReaderLineHeight, string> = {
  snug: 'leading-[1.6]',
  relaxed: 'leading-[1.78]',
  airy: 'leading-[1.95]',
};

const FONT_FAMILY_CLASS: Record<ReaderFontChoice, string> = {
  'source-serif': 'font-reading-serif',
  lora: 'font-reading-lora',
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  initialChapterId,
  initialScrollRatio = 0,
  settings,
  quotes = [],
  savedWords = [],
  isBookmarked,
  onToggleBookmark,
  onSaveQuote,
  onSaveWord,
  onUpdateSettings,
  onProgressChange,
  onBackToLibrary,
}) => {
  const initialIndex = useMemo(() => {
    if (!initialChapterId) return 0;
    const idx = book.chapters.findIndex((c) => c.id === initialChapterId);
    return idx >= 0 ? idx : 0;
  }, [book.chapters, initialChapterId]);

  const [chapterIndex, setChapterIndex] = useState(initialIndex);
  const [activePopover, setActivePopover] = useState<ActivePopover>('none');
  const [dashboardTab, setDashboardTab] = useState<'chapters' | 'notes'>('chapters');
  const [selectedSnippet, setSelectedSnippet] = useState<string>('');
  const [dictionaryEntry, setDictionaryEntry] = useState<DictionaryEntry | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryError, setDictionaryError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [chapterSeconds, setChapterSeconds] = useState(0);
  const [chapterScrollRatio, setChapterScrollRatio] = useState(initialScrollRatio);

  const scrollTimerRef = useRef<number | null>(null);
  const progressSaveTimerRef = useRef<number | null>(null);
  const restoredInitialScrollRef = useRef(false);
  const pendingProgressRef = useRef<{
    chapterId: string;
    pct: number;
    ratio: number;
  } | null>(null);
  const chapter = book.chapters[chapterIndex] ?? book.chapters[0];
  const theme = THEME_SURFACE[settings.theme];

  const chapterWordCount = useMemo(() => {
    if (!chapter) return 0;
    return chapter.paragraphs
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [chapter]);

  const chapterEstimatedSeconds = useMemo(() => {
    if (!chapter) return 60;
    // Derive from real word count at ~210 WPM, bounded nicely with chapter metadata
    const byWords = Math.round((chapterWordCount / 210) * 60);
    return Math.max(45, byWords);
  }, [chapter, chapterWordCount]);

  const chapterSecondsLeft = useMemo(() => {
    return Math.max(0, Math.round(chapterEstimatedSeconds * (1 - chapterScrollRatio)));
  }, [chapterEstimatedSeconds, chapterScrollRatio]);

  const chapterMinutesLeftDisplay = useMemo(() => {
    if (chapterSecondsLeft === 0) return 'Done';
    if (chapterSecondsLeft < 60) return '< 1m';
    return `${Math.ceil(chapterSecondsLeft / 60)}m`;
  }, [chapterSecondsLeft]);

  const totalBookMinutes = useMemo(
    () => book.chapters.reduce((sum, ch) => sum + ch.estimatedMinutes, 0),
    [book.chapters]
  );

  const remainingBookMinutes = useMemo(() => {
    const futureChaptersMinutes = book.chapters
      .slice(chapterIndex + 1)
      .reduce((sum, ch) => sum + ch.estimatedMinutes, 0);
    const currentChapterMinutesLeft = Math.ceil(chapterSecondsLeft / 60);
    return futureChaptersMinutes + currentChapterMinutesLeft;
  }, [book.chapters, chapterIndex, chapterSecondsLeft]);

  // Live reading session & current-chapter timer (pauses when tab is hidden)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setSessionSeconds((s) => s + 1);
        setChapterSeconds((s) => s + 1);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Reset per-chapter elapsed timer on chapter change
  useEffect(() => {
    setChapterSeconds(0);
  }, [chapter?.id]);

  // Restore saved scroll ratio when re-opening a chapter
  useEffect(() => {
    if (restoredInitialScrollRef.current) return;
    restoredInitialScrollRef.current = true;
    if (initialScrollRatio <= 0) return;

    const frame = window.requestAnimationFrame(() => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 24) {
        window.scrollTo({ top: Math.round(docHeight * initialScrollRatio) });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialScrollRatio]);

  // Track chapter scroll ratio + show bottom blur fade ONLY while actively scrolling
  useEffect(() => {
    const computeRatio = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 24) return 1;
      return Math.min(1, Math.max(0, window.scrollY / docHeight));
    };

    const scheduleProgressSave = (ratio: number) => {
      if (!chapter || book.chapters.length === 0) return;
      const pct = Math.round(((chapterIndex + ratio) / book.chapters.length) * 100);
      pendingProgressRef.current = { chapterId: chapter.id, pct, ratio };
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
      }
      progressSaveTimerRef.current = window.setTimeout(() => {
        pendingProgressRef.current = null;
        onProgressChange(chapter.id, pct, ratio);
      }, 240);
    };

    const handleScroll = () => {
      const ratio = computeRatio();
      setChapterScrollRatio(ratio);
      scheduleProgressSave(ratio);
      setIsScrolling(true);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 420);
    };

    const handleResize = () => {
      setChapterScrollRatio(computeRatio());
    };

    setChapterScrollRatio(computeRatio());
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
        progressSaveTimerRef.current = null;
      }
      if (pendingProgressRef.current) {
        const { chapterId, pct, ratio } = pendingProgressRef.current;
        pendingProgressRef.current = null;
        onProgressChange(chapterId, pct, ratio);
      }
    };
  }, [book.chapters.length, chapter, chapterIndex, onProgressChange]);

  // Close open dashboard/settings overlay on Escape
  useEffect(() => {
    if (activePopover === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePopover('none');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePopover]);

  const formatDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatTimeLeft = (totalSecs: number) => {
    if (totalSecs <= 0) return 'Finished';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins === 0) return `${secs}s left`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  const goToChapter = (nextIdx: number) => {
    const clampedIdx = Math.min(Math.max(0, nextIdx), Math.max(0, book.chapters.length - 1));
    const nextChapter = book.chapters[clampedIdx];
    setChapterIndex(clampedIdx);
    setChapterScrollRatio(0);
    setActivePopover('none');
    if (nextChapter && book.chapters.length > 0) {
      const pct = Math.round((clampedIdx / book.chapters.length) * 100);
      onProgressChange(nextChapter.id, pct, 0);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bookmarked = chapter ? isBookmarked(chapter.id) : false;

  const alignmentClass: Record<ReaderAlignment, string> = {
    left: 'text-left',
    justify: settings.hyphenation ? 'text-justify hyphens-auto' : 'text-justify',
  };

  return (
    <div className={`min-h-dvh transition-colors duration-200 ${theme.page}`}>
      {/* Minimal Top Bar */}
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur-md transition-colors ${theme.divider} ${
          settings.theme === 'paper'
            ? 'bg-[#F6EFE4]/90'
            : settings.theme === 'sepia'
              ? 'bg-[#ECE0CB]/90'
              : 'bg-[#141A16]/90'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onBackToLibrary}
            aria-label="Back to Library"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-opacity hover:opacity-75 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Library</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActivePopover((prev) => (prev === 'chapters' ? 'none' : 'chapters'))
            }
            className="min-h-[44px] max-w-[200px] truncate px-2 text-center text-xs font-medium tracking-wide opacity-85 hover:opacity-100 sm:max-w-xs"
          >
            {book.title}
          </button>

          <button
            type="button"
            onClick={() => chapter && onToggleBookmark(chapter.id, `${chapter.label}: ${chapter.title}`)}
            aria-label={bookmarked ? 'Remove chapter bookmark' : 'Bookmark this chapter'}
            aria-pressed={bookmarked}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-opacity hover:opacity-75 shrink-0"
          >
            <Bookmark
              className={`h-4 w-4 ${bookmarked ? 'fill-[var(--pi-terracotta)] text-[var(--pi-terracotta)]' : ''}`}
            />
          </button>
        </div>
      </header>

      {/* Main Reading Column */}
      <main className="mx-auto max-w-[65ch] px-6 pt-10 pb-36 sm:px-8 sm:pt-14 sm:pb-40">
        {chapter && chapter.paragraphs.length > 0 ? (
          <article aria-labelledby="chapter-title">
            {/* Centered Chapter Label + Bold Chapter Title */}
            <div className="mb-10 text-center sm:mb-12">
              <p className={`pi-label ${theme.muted}`}>{chapter.label}</p>
              <h1
                id="chapter-title"
                className="font-headline mt-2.5 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                {chapter.title}
              </h1>
              {!book.isFullSample && (
                <p className={`mt-3 text-xs ${theme.muted}`}>
                  Opening excerpt · Add Books supports full PDF import
                </p>
              )}
            </div>

            {/* Reflowable Serif Paragraphs with Drop Cap on First Paragraph */}
            <div
              onMouseUp={() => {
                const text = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() || '';
                setSelectedSnippet(text.slice(0, 480));
                setDictionaryEntry(null);
                setDictionaryError(null);
              }}
              onTouchEnd={() => {
                window.setTimeout(() => {
                  const text = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() || '';
                  setSelectedSnippet(text.slice(0, 480));
                }, 40);
              }}
              className={`space-y-6 ${FONT_FAMILY_CLASS[settings.fontFamily]} ${FONT_SIZE_CLASS[settings.fontSize]} ${LINE_HEIGHT_CLASS[settings.lineHeight]} ${alignmentClass[settings.alignment]}`}
            >
              {chapter.paragraphs.map((paragraph, index) => (
                <p key={`${chapter.id}-p-${index}`} className={index === 0 ? 'pi-dropcap' : ''}>
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Chapter Navigation Footer */}
            <nav
              aria-label="Chapter navigation"
              className={`mt-14 flex items-center justify-between gap-4 border-t pt-6 ${theme.divider}`}
            >
              <button
                type="button"
                disabled={chapterIndex === 0}
                onClick={() => goToChapter(chapterIndex - 1)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-current/15 px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Previous</span>
              </button>

              <span className={`text-xs tabular-nums ${theme.muted}`}>
                {chapterIndex + 1} of {book.chapters.length}
              </span>

              <button
                type="button"
                disabled={chapterIndex >= book.chapters.length - 1}
                onClick={() => goToChapter(chapterIndex + 1)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-current/15 px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                <span>Next chapter</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          </article>
        ) : (
          <div className={`rounded-[24px] border p-8 text-center ${theme.divider}`}>
            <h1 className="font-headline text-2xl font-semibold">Chapter unavailable</h1>
            <p className={`mt-2 text-sm ${theme.muted}`}>
              This chapter does not contain readable text yet.
            </p>
            <button
              type="button"
              onClick={onBackToLibrary}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--pi-terracotta)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--pi-terracotta-hover)]"
            >
              Return to Library
            </button>
          </div>
        )}
      </main>

      {/* Soft Bottom Blur Fade — Visible ONLY While Scrolling */}
      <div
        aria-hidden="true"
        className={`pi-scroll-blur-fade pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 transition-opacity duration-200 ${theme.fade} ${
          isScrolling ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Popover Sheets / Reading Dashboard Overlay Anchored Above the Floating Control Pill */}
      {activePopover !== 'none' && (
        <div
          onClick={() => setActivePopover('none')}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 px-4 pb-22 backdrop-blur-[1px]"
        >
          <div
            role="dialog"
            aria-label={
              activePopover === 'chapters' ? 'Reading dashboard' : 'Reader settings'
            }
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[24px] border p-5 backdrop-blur-md ${theme.sheet}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="pi-label opacity-75">
                {activePopover === 'chapters'
                  ? 'Reading Dashboard'
                  : activePopover === 'theme'
                    ? 'Paper & Light'
                    : 'Typography'}
              </span>
              <button
                type="button"
                onClick={() => setActivePopover('none')}
                aria-label="Close panel"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activePopover === 'chapters' && chapter && (
              <div className="space-y-4">
                {/* Live Reading Time & Chapter Time Left Metric Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className={`rounded-2xl border p-3.5 ${theme.divider}`}>
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" aria-hidden="true" />
                      <span className={`text-[11px] font-medium ${theme.muted}`}>
                        Reading time
                      </span>
                    </div>
                    <p className="font-headline mt-1.5 text-2xl font-semibold tabular-nums">
                      {formatDuration(sessionSeconds)}
                    </p>
                    <p className={`mt-0.5 text-[11px] tabular-nums ${theme.muted}`}>
                      {formatDuration(chapterSeconds)} in chapter
                    </p>
                  </div>

                  <div className={`rounded-2xl border p-3.5 ${theme.divider}`}>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" aria-hidden="true" />
                      <span className={`text-[11px] font-medium ${theme.muted}`}>
                        Left in chapter
                      </span>
                    </div>
                    <p className="font-headline mt-1.5 text-2xl font-semibold tabular-nums">
                      {formatTimeLeft(chapterSecondsLeft)}
                    </p>
                    <p className={`mt-0.5 text-[11px] tabular-nums ${theme.muted}`}>
                      {chapterWordCount.toLocaleString()} words ·{' '}
                      {Math.round(chapterScrollRatio * 100)}% read
                    </p>
                  </div>
                </div>

                {/* Chapter Progress Bar */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs tabular-nums">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--pi-terracotta)]" aria-hidden="true" />
                      <span className="truncate">
                        {chapter.label}: {chapter.title}
                      </span>
                    </span>
                    <span className={`shrink-0 ${theme.muted}`}>
                      {remainingBookMinutes}m of {totalBookMinutes}m book
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 100 4"
                    preserveAspectRatio="none"
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="4"
                      rx="2"
                      fill="currentColor"
                      fillOpacity="0.12"
                    />
                    <rect
                      x="0"
                      y="0"
                      width={Math.max(4, Math.round(chapterScrollRatio * 100))}
                      height="4"
                      rx="2"
                      fill="#C4572F"
                    />
                  </svg>
                </div>

                {/* Chapter Switcher & Saved Notes Tabs */}
                <div className={`border-t pt-3 ${theme.divider}`}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDashboardTab('chapters')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        dashboardTab === 'chapters'
                          ? 'bg-[var(--pi-terracotta)] text-white'
                          : 'border border-current/15 opacity-75 hover:opacity-100'
                      }`}
                    >
                      Chapters
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('notes')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        dashboardTab === 'notes'
                          ? 'bg-[var(--pi-terracotta)] text-white'
                          : 'border border-current/15 opacity-75 hover:opacity-100'
                      }`}
                    >
                      Quotes &amp; Words ({quotes.length + savedWords.length})
                    </button>
                  </div>

                  {dashboardTab === 'chapters' ? (
                    <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {book.chapters.map((ch, idx) => (
                        <li key={ch.id}>
                          <button
                            type="button"
                            onClick={() => goToChapter(idx)}
                            className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2 text-left text-sm transition-colors ${
                              idx === chapterIndex
                                ? 'bg-[var(--pi-terracotta)] text-white'
                                : 'hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate font-medium">
                              {ch.label}. {ch.title}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums opacity-80">
                              {ch.estimatedMinutes}m
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1 text-xs">
                      {quotes.length === 0 && savedWords.length === 0 ? (
                        <p className={`py-4 text-center ${theme.muted}`}>
                          Highlight any passage or word while reading to look up definitions or save quotes locally.
                        </p>
                      ) : (
                        <>
                          {quotes.map((q) => (
                            <div key={q.id} className={`rounded-2xl border p-3 ${theme.divider}`}>
                              <p className="font-reading-serif italic leading-relaxed">“{q.text}”</p>
                            </div>
                          ))}
                          {savedWords.map((w) => (
                            <div key={w.word} className={`rounded-2xl border p-3 ${theme.divider}`}>
                              <div className="flex items-baseline gap-2">
                                <span className="font-medium capitalize">{w.word}</span>
                                <span className={`italic ${theme.muted}`}>{w.partOfSpeech}</span>
                              </div>
                              <p className={`mt-1 leading-relaxed ${theme.muted}`}>{w.definition}</p>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePopover === 'theme' && (
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { id: 'paper', label: 'Paper', swatch: 'bg-[#F6EFE4] text-[#1F2A3A]' },
                    { id: 'sepia', label: 'Sepia', swatch: 'bg-[#ECE0CB] text-[#261F17]' },
                    { id: 'dark', label: 'Desk', swatch: 'bg-[#141A16] text-[#ECE7DC]' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, theme: item.id })}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border text-xs font-medium transition-transform active:scale-95 ${
                      item.swatch
                    } ${
                      settings.theme === item.id
                        ? 'ring-2 ring-[var(--pi-terracotta)] ring-offset-2'
                        : 'border-black/15'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activePopover === 'typography' && (
              <div className="space-y-4">
                {/* Font Size */}
                <div>
                  <span className={`mb-1.5 block text-xs ${theme.muted}`}>Text size</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, fontSize: sz })}
                        className={`min-h-[44px] rounded-xl border text-xs font-medium uppercase ${
                          settings.fontSize === sz
                            ? 'border-[var(--pi-terracotta)] bg-[var(--pi-terracotta)] text-white'
                            : 'border-current/15 hover:bg-black/5'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Serif Face */}
                <div>
                  <span className={`mb-1.5 block text-xs ${theme.muted}`}>Reading serif</span>
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
                        onClick={() => onUpdateSettings({ ...settings, fontFamily: face.id })}
                        className={`min-h-[44px] rounded-xl border px-3 text-xs font-medium ${
                          settings.fontFamily === face.id
                            ? 'border-[var(--pi-terracotta)] bg-[var(--pi-terracotta)] text-white'
                            : 'border-current/15 hover:bg-black/5'
                        }`}
                      >
                        {face.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alignment + Hyphenation */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, alignment: 'left', hyphenation: false })
                    }
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${
                      settings.alignment === 'left'
                        ? 'border-[var(--pi-terracotta)] bg-[var(--pi-terracotta)] text-white'
                        : 'border-current/15 hover:bg-black/5'
                    }`}
                  >
                    <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, alignment: 'justify', hyphenation: true })
                    }
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${
                      settings.alignment === 'justify'
                        ? 'border-[var(--pi-terracotta)] bg-[var(--pi-terracotta)] text-white'
                        : 'border-current/15 hover:bg-black/5'
                    }`}
                  >
                    <AlignJustify className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Justified</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dictionary / Quote Selection Bar (appears cleanly when text is highlighted) */}
      {(selectedSnippet || dictionaryEntry || dictionaryLoading || dictionaryError || actionFeedback) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-3 sm:px-4">
          <div
            className={`pointer-events-auto max-w-md w-full rounded-[20px] border p-3.5 shadow-lg backdrop-blur-md ${theme.sheet}`}
          >
            {actionFeedback && (
              <p className="text-xs font-medium text-[#526B59] text-center">{actionFeedback}</p>
            )}

            {dictionaryLoading && (
              <p className={`text-xs ${theme.muted}`}>Looking up definition…</p>
            )}

            {dictionaryError && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={theme.muted}>{dictionaryError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDictionaryError(null);
                    setSelectedSnippet('');
                  }}
                  className="p-1 opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {dictionaryEntry && (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-headline text-base font-semibold capitalize">
                      {dictionaryEntry.word}
                    </span>
                    {dictionaryEntry.phonetic && (
                      <span className={`ml-2 font-mono text-[11px] ${theme.muted}`}>
                        {dictionaryEntry.phonetic}
                      </span>
                    )}
                    <span className="ml-2 italic text-[var(--pi-terracotta)]">
                      {dictionaryEntry.partOfSpeech}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDictionaryEntry(null);
                      setSelectedSnippet('');
                    }}
                    className="p-1 opacity-70 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="leading-relaxed opacity-90">{dictionaryEntry.definition}</p>
                {dictionaryEntry.example && (
                  <p className={`italic ${theme.muted}`}>“{dictionaryEntry.example}”</p>
                )}
                {onSaveWord && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void onSaveWord({
                          word: dictionaryEntry.word,
                          partOfSpeech: dictionaryEntry.partOfSpeech,
                          definition: dictionaryEntry.definition,
                          bookId: book.id,
                          savedAt: Date.now(),
                        });
                        setActionFeedback(`Saved “${dictionaryEntry.word}” to vocabulary`);
                        setDictionaryEntry(null);
                        setSelectedSnippet('');
                        window.setTimeout(() => setActionFeedback(null), 2200);
                      }}
                      className="rounded-full bg-[var(--pi-terracotta)] px-3 py-1 text-[11px] font-medium text-white cursor-pointer"
                    >
                      Save to vocabulary
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedSnippet && !dictionaryEntry && !dictionaryLoading && !dictionaryError && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`min-w-0 flex-1 truncate text-xs italic ${theme.muted}`}>
                  “{selectedSnippet}”
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedSnippet.split(/\s+/).length <= 2 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const cleanedWord = selectedSnippet.replace(/[^a-zA-Z-]/g, '');
                        if (!cleanedWord) return;
                        setDictionaryLoading(true);
                        setDictionaryError(null);
                        const entry = await freeDictionaryProvider.lookup(cleanedWord);
                        setDictionaryLoading(false);
                        if (entry) {
                          setDictionaryEntry(entry);
                        } else {
                          setDictionaryError(`No dictionary entry found for “${cleanedWord}”.`);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-current/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      <Search className="h-3 w-3" />
                      Define
                    </button>
                  )}
                  {onSaveQuote && chapter && (
                    <button
                      type="button"
                      onClick={() => {
                        void onSaveQuote({
                          id: `${book.id}-${chapter.id}-${Date.now()}`,
                          bookId: book.id,
                          chapterId: chapter.id,
                          startOffset: 0,
                          endOffset: selectedSnippet.length,
                          text: selectedSnippet,
                          createdAt: Date.now(),
                        });
                        setSelectedSnippet('');
                        window.getSelection()?.removeAllRanges();
                        setActionFeedback('Quote saved locally');
                        window.setTimeout(() => setActionFeedback(null), 2200);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--pi-terracotta)] px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                    >
                      <QuoteIcon className="h-3 w-3" />
                      Save quote
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Clear selection bar"
                    onClick={() => setSelectedSnippet('')}
                    className="p-1 opacity-70 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom Control Pill: Clock, Brightness, Text Size */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-2 px-3 sm:px-4">
        <div
          role="toolbar"
          aria-label="Reading controls"
          className={`pointer-events-auto flex max-w-full items-center gap-1 rounded-full border px-2 py-1 ${theme.pill}`}
        >
          {/* 1. Clock / Reading Dashboard */}
          <button
            type="button"
            onClick={() =>
              setActivePopover((prev) => (prev === 'chapters' ? 'none' : 'chapters'))
            }
            aria-label="Open reading time dashboard"
            aria-expanded={activePopover === 'chapters'}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium tabular-nums transition-colors ${
              activePopover === 'chapters'
                ? 'bg-[var(--pi-terracotta)] text-white'
                : 'hover:opacity-80'
            }`}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>{chapterMinutesLeftDisplay}</span>
          </button>

          {/* 2. Brightness / Paper Theme */}
          <button
            type="button"
            onClick={() => setActivePopover((prev) => (prev === 'theme' ? 'none' : 'theme'))}
            aria-label="Paper theme and brightness"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-opacity hover:opacity-80"
          >
            <Sun className="h-4 w-4" />
          </button>

          {/* 4. Text Size & Typography */}
          <button
            type="button"
            onClick={() =>
              setActivePopover((prev) => (prev === 'typography' ? 'none' : 'typography'))
            }
            aria-label="Text size and typography settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-opacity hover:opacity-80"
          >
            <Type className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
