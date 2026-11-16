import React from 'react';

export interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor?: string;
}

/**
 * @paper-and-ink/design-system primitive
 * Horizontally scrollable filter chip with >= 44px touch target.
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  active,
  onClick,
  accentColor,
}) => {
  const isNeutralAll = !accentColor;

  const activeStyle: React.CSSProperties = isNeutralAll
    ? {
        backgroundColor: 'var(--pi-paper)',
        color: 'var(--pi-ink-strong)',
        borderColor: 'var(--pi-paper)',
      }
    : {
        backgroundColor: `color-mix(in srgb, ${accentColor} 26%, var(--pi-desk-elevated))`,
        color: 'var(--pi-text-on-desk)',
        borderColor: accentColor,
      };

  const inactiveStyle: React.CSSProperties = {
    backgroundColor: 'var(--pi-desk-elevated)',
    color: 'var(--pi-text-on-desk-muted)',
    borderColor: 'var(--pi-border-desk)',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium tracking-[0.02em] whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.98] hover:text-[var(--pi-text-on-desk)]"
      style={{
        fontFamily: 'var(--font-sans)',
        ...(active ? activeStyle : inactiveStyle),
      }}
    >
      {accentColor ? (
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-1.5 shrink-0 rounded-[2px]"
          style={{
            backgroundColor: accentColor,
          }}
        />
      ) : null}
      <span>{label}</span>
    </button>
  );
};
