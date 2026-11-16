import React from 'react';

export interface PillProps {
  label: string;
  secondaryLabel?: string;
  accentColor?: string;
  featuredLabel?: string;
}

/**
 * @paper-and-ink/design-system primitive
 * Small outlined editorial category & source pill with high-contrast ink.
 */
export const Pill: React.FC<PillProps> = ({
  label,
  secondaryLabel,
  accentColor = 'var(--pi-topic-top-story)',
  featuredLabel,
}) => {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span
        className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] leading-none"
        style={{
          fontFamily: 'var(--font-sans)',
          color: 'var(--pi-text-on-paper)',
          border: '1px solid var(--pi-border-paper)',
          backgroundColor: `color-mix(in srgb, ${accentColor} 22%, var(--pi-paper))`,
        }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-1.5 shrink-0 rounded-[2px]"
          style={{
            backgroundColor: accentColor,
            boxShadow: 'inset 0 0 0 1px rgba(31, 42, 58, 0.22)',
          }}
        />
        <span className="shrink-0 whitespace-nowrap">{label}</span>
        {secondaryLabel ? (
          <>
            <span aria-hidden="true" className="shrink-0 opacity-45">
              ·
            </span>
            <span className="min-w-0 truncate font-medium opacity-80">
              {secondaryLabel}
            </span>
          </>
        ) : null}
      </span>

      {featuredLabel ? (
        <span
          className="pi-meta-label whitespace-nowrap"
          style={{ color: 'var(--pi-accent-ink)' }}
        >
          {featuredLabel}
        </span>
      ) : null}
    </div>
  );
};
