import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowIOSGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIOSGuide]);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper-elevated)] px-3 py-2 text-xs font-medium text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-[#232D27] sm:gap-2 sm:px-4 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper-elevated)] px-3 py-2 text-xs font-medium text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-[#232D27] sm:gap-2 sm:px-4 whitespace-nowrap shrink-0"
        >
          <Share className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-xs sm:items-center"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-6 text-[var(--pi-ink)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="pi-label text-[var(--pi-terracotta)]">Offline Reader</p>
                  <h2 id="ios-install-title" className="font-headline mt-1 text-xl font-semibold">
                    Install Paper &amp; Ink
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--pi-ink-muted)] hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
                <li>
                  1. Tap the <strong className="font-semibold text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)]">Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  2. Scroll down and tap{' '}
                  <strong className="font-semibold text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)]">
                    Add to Home Screen
                  </strong>
                  .
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-full bg-[var(--pi-ink)] px-5 py-2.5 text-sm font-medium text-[var(--pi-paper)] transition-colors hover:opacity-90 dark:bg-[var(--pi-paper)] dark:text-[var(--pi-ink)]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
