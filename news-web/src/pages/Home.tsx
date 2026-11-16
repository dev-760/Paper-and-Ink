import React from 'react';
import { Globe, RefreshCw, Sparkles } from 'lucide-react';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import { CountrySelector } from '../components/CountrySelector';
import { Header } from '../components/Header';
import { StoryCard } from '../components/StoryCard';
import { StyleSelector } from '../components/StyleSelector';
import { getCountryMeta, WRITING_STYLES } from '../types/news';
import { useNewsStore } from '../store/useNewsStore';

interface HomeProps {
  auth: PaperInkAuthState;
}

export const Home: React.FC<HomeProps> = ({ auth }) => {
  const editionDate = useNewsStore((s) => s.editionDate);
  const stories = useNewsStore((s) => s.stories);
  const selectedTopic = useNewsStore((s) => s.selectedTopic);
  const writingStyle = useNewsStore((s) => s.writingStyle);
  const country = useNewsStore((s) => s.country);
  const savedStoryIds = useNewsStore((s) => s.savedStoryIds);
  const isStyleModalOpen = useNewsStore((s) => s.isStyleModalOpen);
  const isCountryModalOpen = useNewsStore((s) => s.isCountryModalOpen);
  const isLoadingFeed = useNewsStore((s) => s.isLoadingFeed);
  const isRefreshingFeed = useNewsStore((s) => s.isRefreshingFeed);
  const feedError = useNewsStore((s) => s.feedError);

  const setTopic = useNewsStore((s) => s.setTopic);
  const setWritingStyle = useNewsStore((s) => s.setWritingStyle);
  const setCountry = useNewsStore((s) => s.setCountry);
  const toggleSaveStory = useNewsStore((s) => s.toggleSaveStory);
  const openStory = useNewsStore((s) => s.openStory);
  const openStyleModal = useNewsStore((s) => s.openStyleModal);
  const closeStyleModal = useNewsStore((s) => s.closeStyleModal);
  const openCountryModal = useNewsStore((s) => s.openCountryModal);
  const closeCountryModal = useNewsStore((s) => s.closeCountryModal);
  const loadLiveFeed = useNewsStore((s) => s.loadLiveFeed);
  const retryFeed = useNewsStore((s) => s.retryFeed);

  const activeVoiceLabel =
    WRITING_STYLES.find((v) => v.id === writingStyle)?.label || 'Brief';
  const activeCountryMeta = getCountryMeta(country);

  const showLeadCard =
    (selectedTopic === 'All' || selectedTopic === 'For You') &&
    stories.length > 0;

  const leadStory = showLeadCard ? stories[0] : null;
  const gridStories = showLeadCard ? stories.slice(1) : stories;

  return (
    <div className="min-h-dvh bg-[var(--pi-bg)] text-[var(--pi-text)] transition-colors duration-200">
      <Header auth={auth} />

      <main className="mx-auto max-w-6xl px-4 pt-2 pb-16 sm:px-8 sm:pb-20">
        {/* Masthead */}
        <div className="mb-6 pb-5 border-b border-[var(--pi-hairline)] flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sm:hidden text-[11px] font-medium uppercase tracking-wider text-[var(--pi-text-muted)] mb-1">
              {editionDate}
            </p>
            <h1 className="font-headline text-3xl font-semibold tracking-tight sm:text-5xl">
              Daily Edition
            </h1>
            <p className="mt-1 text-sm text-[var(--pi-text-muted)]">
              Live reporting rewritten in your chosen {activeVoiceLabel} voice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={openCountryModal}
              aria-label="Change country edition"
              className="pi-focus-ring inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[var(--pi-hairline)] bg-[var(--pi-surface)] px-3.5 py-2 text-xs font-medium text-[var(--pi-text)] hover:bg-[var(--pi-surface-muted)] transition-colors cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-[var(--pi-accent)]" />
              <span>{activeCountryMeta.label}</span>
            </button>

            <button
              type="button"
              onClick={() => void loadLiveFeed({ forceRefresh: true })}
              disabled={isLoadingFeed || isRefreshingFeed}
              title="Refresh live stories"
              className="pi-focus-ring inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[var(--pi-hairline)] bg-[var(--pi-surface)] px-3.5 py-2 text-xs font-medium text-[var(--pi-text)] hover:bg-[var(--pi-surface-muted)] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[var(--pi-accent)] ${
                  isLoadingFeed || isRefreshingFeed ? 'animate-spin' : ''
                }`}
              />
              <span>{isRefreshingFeed ? 'Refreshing…' : isLoadingFeed ? 'Updating…' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={openStyleModal}
              className="pi-focus-ring inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[var(--pi-hairline)] bg-[var(--pi-surface)] px-3.5 py-2 text-xs font-medium text-[var(--pi-text)] hover:bg-[var(--pi-surface-muted)] transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--pi-accent)]" />
              <span>Voice: {activeVoiceLabel}</span>
            </button>
          </div>
        </div>

        {/* Feed Error State */}
        {feedError && (
          <div className="mb-8 rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-surface)] p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm">{feedError}</p>
            <button
              type="button"
              onClick={retryFeed}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pi-accent)] px-4 py-2 text-xs font-medium text-white cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Stories Feed */}
        {isLoadingFeed && stories.length === 0 ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading live daily edition">
            <div className="rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-surface)] p-5 sm:p-7 animate-pulse space-y-4">
              <div className="h-48 sm:h-60 rounded-[16px] bg-[var(--pi-surface-muted)]" />
              <div className="h-4 w-32 rounded-full bg-[var(--pi-surface-muted)]" />
              <div className="h-7 w-4/5 rounded-lg bg-[var(--pi-surface-muted)]" />
              <div className="h-4 w-full rounded bg-[var(--pi-surface-muted)]" />
            </div>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className="rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-surface)] p-5 animate-pulse space-y-3"
                >
                  <div className="h-36 rounded-[16px] bg-[var(--pi-surface-muted)]" />
                  <div className="h-4 w-28 rounded-full bg-[var(--pi-surface-muted)]" />
                  <div className="h-6 w-5/6 rounded-lg bg-[var(--pi-surface-muted)]" />
                </div>
              ))}
            </div>
          </div>
        ) : stories.length > 0 ? (
          <div className="space-y-8">
            {leadStory && (
              <StoryCard
                story={leadStory}
                writingStyle={writingStyle}
                isSaved={savedStoryIds.includes(leadStory.id)}
                featured
                onOpen={openStory}
                onToggleSave={toggleSaveStory}
              />
            )}

            {gridStories.length > 0 && (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                {gridStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    writingStyle={writingStyle}
                    isSaved={savedStoryIds.includes(story.id)}
                    onOpen={openStory}
                    onToggleSave={toggleSaveStory}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-surface)] p-8 sm:p-10 text-center max-w-lg mx-auto mt-8">
            <h2 className="font-headline text-2xl font-semibold">
              {selectedTopic === 'Saved'
                ? 'Your saved reading list is empty'
                : 'No stories available'}
            </h2>
            <p className="mt-2 text-sm text-[var(--pi-text-muted)] leading-relaxed">
              {selectedTopic === 'Saved'
                ? 'Bookmark stories from the edition to read them quietly later on this device.'
                : 'Refresh the edition or switch back to all stories.'}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {selectedTopic !== 'All' ? (
                <button
                  type="button"
                  onClick={() => setTopic('All')}
                  className="rounded-full bg-[var(--pi-accent)] px-5 py-2 text-xs font-medium text-white cursor-pointer"
                >
                  Browse All Stories
                </button>
              ) : (
                <button
                  type="button"
                  onClick={retryFeed}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pi-accent)] px-5 py-2 text-xs font-medium text-white cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Edition
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <StyleSelector
        open={isStyleModalOpen}
        currentStyle={writingStyle}
        onSelect={setWritingStyle}
        onClose={closeStyleModal}
      />

      <CountrySelector
        open={isCountryModalOpen}
        currentCountry={country}
        onSelect={setCountry}
        onClose={closeCountryModal}
      />
    </div>
  );
};
