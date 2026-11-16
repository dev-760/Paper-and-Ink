import React from 'react';
import { COVER_PALETTE, type CoverColor } from '../types/notebook';

export interface NotebookCoverProps {
  title: string;
  subtitle?: string;
  category: string;
  coverColor: CoverColor;
  pageCount: number;
  updatedLabel: string;
  compact?: boolean;
  className?: string;
  actionSlot?: React.ReactNode;
}

const CoverMotif: React.FC<{ coverColor: CoverColor; strokeColor: string }> = ({
  coverColor,
  strokeColor,
}) => {
  if (coverColor === 'sage') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="w-24 h-24 opacity-25"
      >
        <path
          d="M60 108V32M60 72C42 70 30 56 32 42C46 42 58 54 60 72ZM60 56C78 54 90 40 88 26C74 26 62 38 60 56Z"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="48" cy="24" r="3" stroke={strokeColor} strokeWidth="1.4" />
      </svg>
    );
  }

  if (coverColor === 'forest') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="w-24 h-24 opacity-22"
      >
        <circle cx="60" cy="84" r="46" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="60" cy="84" r="32" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="60" cy="84" r="18" stroke={strokeColor} strokeWidth="1.5" />
      </svg>
    );
  }

  if (coverColor === 'navy') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="w-24 h-24 opacity-20"
      >
        <path
          d="M28 104V58C28 40.327 42.327 26 60 26C77.673 26 92 40.327 92 58V104"
          stroke={strokeColor}
          strokeWidth="1.6"
        />
        <path
          d="M42 104V60C42 50.059 50.059 42 60 42C69.941 42 78 50.059 78 60V104"
          stroke={strokeColor}
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (coverColor === 'terracotta') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="w-24 h-24 opacity-22"
      >
        <rect
          x="26"
          y="34"
          width="68"
          height="68"
          rx="4"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        <line x1="26" y1="58" x2="94" y2="58" stroke={strokeColor} strokeWidth="1.3" />
        <line x1="60" y1="34" x2="60" y2="102" stroke={strokeColor} strokeWidth="1.3" />
      </svg>
    );
  }

  if (coverColor === 'tan') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className="w-24 h-24 opacity-24"
      >
        <path
          d="M60 24L78 66L60 98L42 66L60 24Z"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="60" y1="24" x2="60" y2="62" stroke={strokeColor} strokeWidth="1.4" />
        <circle cx="60" cy="65" r="3.5" stroke={strokeColor} strokeWidth="1.4" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="w-24 h-24 opacity-22"
    >
      <path
        d="M28 48C42 36 56 36 60 48C64 36 78 36 92 48V94C78 84 64 84 60 94C56 84 42 84 28 94V48Z"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="60" y1="48" x2="60" y2="94" stroke={strokeColor} strokeWidth="1.4" />
    </svg>
  );
};

export const NotebookCover: React.FC<NotebookCoverProps> = ({
  title,
  subtitle,
  category,
  coverColor,
  pageCount,
  updatedLabel,
  compact = false,
  className = '',
  actionSlot,
}) => {
  const palette = COVER_PALETTE[coverColor];

  return (
    <div
      style={{
        backgroundColor: palette.bgVar,
        color: palette.inkVar,
        borderTopLeftRadius: '6px',
        borderBottomLeftRadius: '6px',
        borderTopRightRadius: compact ? '12px' : '12px',
        borderBottomRightRadius: compact ? '12px' : '12px',
      }}
      className={`relative flex flex-col justify-between select-none overflow-hidden shadow-[var(--cover-shadow)] ${
        compact
          ? 'min-h-[150px] p-4 pl-6'
          : 'h-[212px] w-full sm:h-[242px] p-3.5 sm:p-4 pl-5 sm:pl-6 pb-[74px] sm:pb-[84px]'
      } ${className}`}
    >
      {/* Physical book spine & vertical crease highlight */}
      <div
        aria-hidden="true"
        style={{ backgroundColor: palette.spineVar }}
        className="absolute inset-y-0 left-0 w-3 sm:w-3.5 opacity-95"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-3 sm:left-3.5 w-[2px] bg-white/22"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-[14px] sm:left-[16px] w-px bg-black/14"
      />

      {/* Subtle inner page-edge trim along bottom-left */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-3.5 right-4 h-1 bg-[var(--accent-surface)] opacity-85 rounded-t-[2px]"
      />

      {/* Delicate embossed line-art motif in lower cover field */}
      {!compact && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center pl-2"
        >
          <CoverMotif coverColor={coverColor} strokeColor={palette.inkVar} />
        </div>
      )}

      {/* Top row: Category micro label + circular options badge */}
      <div className="relative z-10 flex items-center justify-between gap-1">
        <span
          style={{ color: palette.mutedVar }}
          className="pi-label-micro !text-[10px] !tracking-[0.11em] truncate pt-0.5"
        >
          {category}
        </span>
        {actionSlot && (
          <div className="relative z-20 -mr-2.5 -mt-2 shrink-0">
            {actionSlot}
          </div>
        )}
      </div>

      {/* Main Editorial Title & Italic Subtitle */}
      <div className="relative z-10 mt-1.5 mb-auto">
        <h3
          style={{
            fontFamily: 'var(--pi-font-serif)',
            color: palette.inkVar,
          }}
          className={`font-semibold leading-[1.12] tracking-[-0.015em] ${
            compact
              ? 'text-[1.125rem]'
              : 'text-[1.15rem] sm:text-[1.35rem] line-clamp-2'
          }`}
        >
          {title}
        </h3>
        {subtitle && !compact && (
          <p
            style={{
              fontFamily: 'var(--pi-font-serif)',
              color: palette.mutedVar,
            }}
            className="mt-1 italic text-[12.5px] sm:text-[13.5px] leading-snug line-clamp-1"
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Quiet metadata line seated safely above shelf rail */}
      <div
        style={{ color: palette.mutedVar }}
        className="relative z-10 flex items-center gap-1.5 text-[11px] pi-tabular pt-1"
      >
        <span>
          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{updatedLabel}</span>
      </div>
    </div>
  );
};
