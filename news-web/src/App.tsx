import React, { useEffect, useMemo, useRef } from 'react';
import { useGuestOnboardingFlow, usePaperInkAuth } from '@paper-and-ink/auth';
import { ArticleDetail } from './pages/ArticleDetail';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { useNewsStore } from './store/useNewsStore';

export default function App() {
  const auth = usePaperInkAuth();
  const welcomeFlow = useGuestOnboardingFlow('news', auth);
  const hasCompletedOnboarding = useNewsStore((s) => s.hasCompletedOnboarding);
  const activeStoryId = useNewsStore((s) => s.activeStoryId);
  const stories = useNewsStore((s) => s.stories);
  const livePool = useNewsStore((s) => s.livePool);
  const savedStoriesMap = useNewsStore((s) => s.savedStoriesMap);
  const theme = useNewsStore((s) => s.theme);
  const toggleDark = useNewsStore((s) => s.toggleDark);
  const reloadForScope = useNewsStore((s) => s.reloadForScope);
  const loadLiveFeed = useNewsStore((s) => s.loadLiveFeed);
  const prevScopeRef = useRef<string>(auth.accountScope);

  useEffect(() => {
    void loadLiveFeed();
  }, [loadLiveFeed]);

  useEffect(() => {
    if (prevScopeRef.current !== auth.accountScope) {
      prevScopeRef.current = auth.accountScope;
      reloadForScope();
    }
  }, [auth.accountScope, reloadForScope]);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute(
      'data-theme',
      theme === 'dark' ? 'dark' : theme === 'sepia' ? 'sepia' : 'light',
    );
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        theme === 'dark' ? '#141A16' : theme === 'sepia' ? '#ECE0CB' : '#F6EFE4',
      );
    }
  }, [theme]);

  const activeStory = useMemo(() => {
    if (!activeStoryId) return null;
    return (
      stories.find((s) => s.id === activeStoryId) ??
      livePool.find((s) => s.id === activeStoryId) ??
      savedStoriesMap[activeStoryId] ??
      null
    );
  }, [activeStoryId, stories, livePool, savedStoriesMap]);

  const content = activeStory ? (
    <ArticleDetail story={activeStory} />
  ) : (
    <Home auth={auth} />
  );

  return (
    <>
      {content}
      <Onboarding
        open={welcomeFlow.showOnboarding || (!auth.isLoading && !hasCompletedOnboarding)}
        auth={auth}
        completeLabel="Open edition"
        onContinueAsGuest={welcomeFlow.continueAsGuest}
        onFinished={welcomeFlow.finishOnboarding}
      />
    </>
  );
}
