import React, { useEffect, useState } from 'react';

export interface ReadingProgressBarProps {
  targetRef?: React.RefObject<HTMLElement | null>;
}

/**
 * @paper-and-ink/design-system primitive
 * Subtle, slim fixed reading progress bar tracking scroll depth across a detailed article.
 */
export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  targetRef,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const computeProgress = () => {
      rafId = 0;

      const element = targetRef?.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const elementBottom = elementTop + element.offsetHeight;
        const maxScrollable = Math.max(
          elementBottom - window.innerHeight,
          1,
        );
        const startOffset = Math.max(elementTop - 72, 0);
        const span = Math.max(maxScrollable - startOffset, 1);
        const ratio = (window.scrollY - startOffset) / span;
        setProgress(Math.min(1, Math.max(0, ratio)));
        return;
      }

      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) {
        setProgress(1);
        return;
      }
      const ratio = window.scrollY / scrollableHeight;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(computeProgress);
    };

    computeProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [targetRef]);

  const percentage = Math.round(progress * 100);

  return (
    <div
      role="progressbar"
      aria-label="Article reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 h-[3px]"
      style={{
        backgroundColor: 'rgba(234, 223, 203, 0.12)',
      }}
    >
      <div
        className="h-full w-full origin-left transition-transform duration-75 ease-out"
        style={{
          transform: `scaleX(${progress})`,
          backgroundColor: 'var(--pi-accent-on-dark)',
        }}
      />
    </div>
  );
};
