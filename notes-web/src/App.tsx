import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { useGuestOnboardingFlow, usePaperInkAuth } from '@paper-and-ink/auth';
import { COVER_PALETTE } from './types/notebook';
import { useNotesStore } from './store/useNotesStore';
import { Shelf } from './features/shelf/Shelf';
import { Notebook } from './features/notebook/Notebook';
import { PageEditor } from './features/editor/PageEditor';
import { OnboardingModal } from './features/onboarding/OnboardingModal';

type ViewportTier = 'phone' | 'tablet' | 'laptop';

function getViewportTier(): ViewportTier {
  if (typeof window === 'undefined') return 'laptop';
  if (window.matchMedia('(min-width: 1280px)').matches) return 'laptop';
  if (window.matchMedia('(min-width: 960px)').matches) return 'tablet';
  return 'phone';
}

function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(getViewportTier);

  useEffect(() => {
    const mqLaptop = window.matchMedia('(min-width: 1280px)');
    const mqTablet = window.matchMedia('(min-width: 960px)');

    const update = () => setTier(getViewportTier());
    mqLaptop.addEventListener('change', update);
    mqTablet.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mqLaptop.removeEventListener('change', update);
      mqTablet.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return tier;
}

export default function App() {
  const auth = usePaperInkAuth();
  const welcomeFlow = useGuestOnboardingFlow('notes', auth);
  const initialize = useNotesStore((s) => s.initialize);
  const syncWithCloud = useNotesStore((s) => s.syncWithCloud);
  const reloadForScope = useNotesStore((s) => s.reloadForScope);
  const flushPendingSaves = useNotesStore((s) => s.flushPendingSaves);
  const prevScopeRef = useRef<string>(auth.accountScope);
  const hasCompletedOnboarding = useNotesStore((s) => s.hasCompletedOnboarding);
  const completeOnboarding = useNotesStore((s) => s.completeOnboarding);
  const isLoading = useNotesStore((s) => s.isLoading);
  const storageError = useNotesStore((s) => s.storageError);
  const clearStorageError = useNotesStore((s) => s.clearStorageError);

  const notebooks = useNotesStore((s) => s.notebooks);
  const pages = useNotesStore((s) => s.pages);
  const activeScreen = useNotesStore((s) => s.activeScreen);
  const activeNotebookId = useNotesStore((s) => s.activeNotebookId);
  const activePageId = useNotesStore((s) => s.activePageId);
  const theme = useNotesStore((s) => s.theme);

  const toggleTheme = useNotesStore((s) => s.toggleTheme);
  const goToShelf = useNotesStore((s) => s.goToShelf);
  const openNotebook = useNotesStore((s) => s.openNotebook);
  const createNewPage = useNotesStore((s) => s.createNewPage);
  const convertPage = useNotesStore((s) => s.convertPage);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const viewportTier = useViewportTier();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (prevScopeRef.current !== auth.accountScope) {
      prevScopeRef.current = auth.accountScope;
      void reloadForScope();
    }
  }, [auth.accountScope, reloadForScope]);

  // Pull cross-device DB updates when returning to the tab or regaining network
  useEffect(() => {
    if (!auth.profile) return;
    const handleSyncTrigger = () => {
      if (document.visibilityState === 'visible') {
        void syncWithCloud();
      }
    };
    window.addEventListener('focus', handleSyncTrigger);
    window.addEventListener('online', handleSyncTrigger);
    return () => {
      window.removeEventListener('focus', handleSyncTrigger);
      window.removeEventListener('online', handleSyncTrigger);
    };
  }, [auth.profile, syncWithCloud]);

  // Flush debounced IndexedDB writes when tab hides or page unloads
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingSaves();
      }
    };
    const handlePageHide = () => {
      void flushPendingSaves();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushPendingSaves]);

  // Keyboard shortcuts: New page (Alt+N / Ctrl+Shift+N), Search (Cmd/Ctrl+K), Convert (Alt+O / Ctrl+Shift+O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeScreen === 'shelf' || !hasCompletedOnboarding) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (
        (e.altKey && e.key.toLowerCase() === 'n') ||
        (isMod && e.shiftKey && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        void createNewPage({
          notebookId: activeNotebookId ?? undefined,
          mode: 'typing',
        });
        return;
      }

      if (
        (e.altKey && e.key.toLowerCase() === 'o') ||
        (isMod && e.shiftKey && e.key.toLowerCase() === 'o')
      ) {
        if (activePageId) {
          e.preventDefault();
          void convertPage(activePageId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeScreen,
    hasCompletedOnboarding,
    activeNotebookId,
    activePageId,
    createNewPage,
    convertPage,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="text-center space-y-2">
          <p className="pi-label-micro text-[var(--text-muted)]">
            Paper &amp; Ink Notes
          </p>
          <p className="pi-heading-section text-[var(--text-primary)]">
            Opening your shelf…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <OnboardingModal
        open={
          welcomeFlow.showOnboarding ||
          (!auth.isLoading && !auth.profile && !hasCompletedOnboarding)
        }
        auth={auth}
        onContinueAsGuest={welcomeFlow.continueAsGuest}
        onComplete={() => {
          completeOnboarding();
          welcomeFlow.finishOnboarding();
        }}
      />

      {/* Visible Storage Error Banner */}
      {storageError && (
        <div
          role="alert"
          className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-[var(--accent-surface)] text-white text-[13px] font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{storageError}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss storage error"
            onClick={clearStorageError}
            className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full hover:bg-black/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeScreen === 'shelf' ? (
        <Shelf auth={auth} />
      ) : viewportTier === 'phone' ? (
        /* PHONE (< 768px): Single-column screen navigation */
        <div className="min-h-screen">
          {activeScreen === 'notebook' ? (
            <Notebook showBackToShelf searchInputRef={searchInputRef} />
          ) : (
            <PageEditor showBackToNotebook />
          )}
        </div>
      ) : viewportTier === 'tablet' ? (
        /* TABLET (768px - 1279px): 2-Column Split Layout — Notebook TOC left, Active Page right */
        <div className="flex h-screen overflow-hidden">
          <aside
            aria-label="Notebook table of contents"
            className="w-[310px] shrink-0 h-full border-r border-[var(--border-hairline)] bg-[var(--bg-paper-subtle)]/50 overflow-hidden"
          >
            <Notebook
              compactRail
              showBackToShelf
              searchInputRef={searchInputRef}
            />
          </aside>
          <main className="flex-1 min-w-0 h-full overflow-hidden">
            <PageEditor showBackToNotebook={false} />
          </main>
        </div>
      ) : (
        /* LAPTOP (>= 1280px): 3-Column Workspace — Shelf rail, Notebook TOC, Active Editor */
        <div className="flex h-screen overflow-hidden">
          <aside
            aria-label="Shelf navigation"
            className="w-[248px] shrink-0 h-full border-r border-[var(--border-hairline)] bg-[var(--bg-paper-subtle)]/65 flex flex-col"
          >
            <div className="px-4 pt-5 pb-3 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={goToShelf}
                className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-2.5 -ml-2 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Shelf gallery</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'light'
                    ? 'Switch to dark desk theme'
                    : 'Switch to light paper theme'
                }
                className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Sun className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="px-4 pt-4 pb-2">
              <span className="pi-label-micro text-[var(--text-muted)]">
                Notebooks
              </span>
            </div>

            <nav
              aria-label="Switch notebook"
              className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1"
            >
              {notebooks.map((nb) => {
                const palette = COVER_PALETTE[nb.coverColor];
                const isActive = nb.id === activeNotebookId;
                const count = pages.filter((p) => p.notebookId === nb.id).length;
                return (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => openNotebook(nb.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`pi-focusable w-full flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-[14px] text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--bg-paper-elevated)] shadow-[var(--paper-shadow)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: palette.bgVar }}
                      className="w-3 h-7 rounded-[4px] shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        style={{ fontFamily: 'var(--pi-font-serif)' }}
                        className="text-[15px] leading-tight truncate font-medium"
                      >
                        {nb.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] pi-tabular mt-0.5">
                        {nb.category} · {count}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="px-4 py-3 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] space-y-1">
              <div className="flex justify-between">
                <span>New page</span>
                <span className="pi-tabular">Alt + N</span>
              </div>
              <div className="flex justify-between">
                <span>Search pages</span>
                <span className="pi-tabular">⌘ / Ctrl + K</span>
              </div>
              <div className="flex justify-between">
                <span>Organize</span>
                <span className="pi-tabular">Alt + O</span>
              </div>
            </div>
          </aside>

          <aside
            aria-label="Notebook pages"
            className="w-[310px] shrink-0 h-full border-r border-[var(--border-hairline)] bg-[var(--bg-paper-subtle)]/30 overflow-hidden"
          >
            <Notebook
              compactRail
              showBackToShelf={false}
              searchInputRef={searchInputRef}
            />
          </aside>

          <main className="flex-1 min-w-0 h-full overflow-hidden">
            <PageEditor showBackToNotebook={false} />
          </main>
        </div>
      )}
    </div>
  );
}
