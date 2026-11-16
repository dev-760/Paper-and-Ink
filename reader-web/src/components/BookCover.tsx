import React, { useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import type { Book, CoverPalette, CoverPattern } from '../types/reader';

interface PaletteClasses {
  bg: string;
  text: string;
  subtext: string;
  accent: string;
  border: string;
}

const PALETTE_MAP: Record<CoverPalette, PaletteClasses> = {
  'sage-linen': {
    bg: 'bg-[#DDE3D5]',
    text: 'text-[#1E2B22]',
    subtext: 'text-[#425447]',
    accent: 'text-[#526B59]',
    border: 'border-[#B8C4AE]',
  },
  'forest-sand': {
    bg: 'bg-[#2C4235]',
    text: 'text-[#F5EFE4]',
    subtext: 'text-[#D0D8CB]',
    accent: 'text-[#C8A97E]',
    border: 'border-[#3E5A49]',
  },
  'ochre-espresso': {
    bg: 'bg-[#D7B98A]',
    text: 'text-[#281E14]',
    subtext: 'text-[#523E29]',
    accent: 'text-[#8C3D20]',
    border: 'border-[#BC9B68]',
  },
  'terracotta-cream': {
    bg: 'bg-[#B8502B]',
    text: 'text-[#FDF7EF]',
    subtext: 'text-[#F4DDD2]',
    accent: 'text-[#F6EFE4]',
    border: 'border-[#963E1E]',
  },
  'rust-charcoal': {
    bg: 'bg-[#242B28]',
    text: 'text-[#F4ECE0]',
    subtext: 'text-[#C5BEB2]',
    accent: 'text-[#D96B43]',
    border: 'border-[#39433E]',
  },
  'navy-gold': {
    bg: 'bg-[#1F2A3A]',
    text: 'text-[#F6EFE4]',
    subtext: 'text-[#C8D0DC]',
    accent: 'text-[#D4A76A]',
    border: 'border-[#33435A]',
  },
  'plum-parchment': {
    bg: 'bg-[#46313E]',
    text: 'text-[#F8F0E8]',
    subtext: 'text-[#DACBD4]',
    accent: 'text-[#DE9A78]',
    border: 'border-[#5D4454]',
  },
  'slate-ivory': {
    bg: 'bg-[#E9E2D4]',
    text: 'text-[#1F2A3A]',
    subtext: 'text-[#4E5A6A]',
    accent: 'text-[#C4572F]',
    border: 'border-[#CEC4B2]',
  },
};

const CoverArtwork: React.FC<{ pattern: CoverPattern; accentClass: string }> = ({
  pattern,
  accentClass,
}) => {
  switch (pattern) {
    case 'botanical':
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-30 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M80 112V24M80 90C60 88 46 74 44 54C64 56 76 68 80 90ZM80 72C100 70 114 56 116 36C96 38 84 50 80 72ZM80 48C66 46 56 36 54 20C68 22 78 32 80 48Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="18" r="4" fill="currentColor" />
        </svg>
      );
    case 'arch':
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-28 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M24 116V64C24 33.072 49.072 8 80 8C110.928 8 136 33.072 136 64V116"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M44 116V66C44 46.118 60.118 30 80 30C99.882 30 116 46.118 116 66V116"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="80" cy="68" r="14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'waves':
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-28 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 32C26 16 54 16 80 32C106 48 134 48 160 32"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M0 56C26 40 54 40 80 56C106 72 134 72 160 56"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M0 80C26 64 54 64 80 80C106 96 134 96 160 80"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M0 104C26 88 54 88 80 104C106 120 134 120 160 104"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      );
    case 'horizon':
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-30 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <circle cx="80" cy="58" r="24" stroke="currentColor" strokeWidth="1.75" />
          <line x1="12" y1="58" x2="148" y2="58" stroke="currentColor" strokeWidth="1.5" />
          <line x1="28" y1="74" x2="132" y2="74" stroke="currentColor" strokeWidth="1.25" />
          <line x1="44" y1="90" x2="116" y2="90" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      );
    case 'grid':
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-25 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <rect x="20" y="14" width="120" height="92" stroke="currentColor" strokeWidth="1.25" />
          <line x1="60" y1="14" x2="60" y2="106" stroke="currentColor" strokeWidth="1" />
          <line x1="100" y1="14" x2="100" y2="106" stroke="currentColor" strokeWidth="1" />
          <line x1="20" y1="45" x2="140" y2="45" stroke="currentColor" strokeWidth="1" />
          <line x1="20" y1="75" x2="140" y2="75" stroke="currentColor" strokeWidth="1" />
          <circle cx="80" cy="60" r="10" fill="currentColor" fillOpacity="0.45" />
        </svg>
      );
    case 'folio':
    default:
      return (
        <svg
          viewBox="0 0 160 120"
          className={`h-full w-full opacity-28 ${accentClass}`}
          fill="none"
          aria-hidden="true"
        >
          <rect x="28" y="16" width="104" height="88" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <rect x="40" y="28" width="80" height="64" rx="2" stroke="currentColor" strokeWidth="1.1" />
          <path d="M80 28V92M40 60H120" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
  }
};

interface BookCoverProps {
  book: Book;
  onSelect: (book: Book) => void;
  onInspect: (book: Book) => void;
}

export const BookCover: React.FC<BookCoverProps> = ({ book, onSelect, onInspect }) => {
  const palette = PALETTE_MAP[book.cover.palette];
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    longPressTriggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onInspect(book);
    }, 480);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearLongPress();
    }
  };

  const handleCoverClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onSelect(book);
  };

  return (
    <div className="group relative flex w-[144px] shrink-0 snap-start flex-col transition-transform duration-200 ease-out hover:-translate-y-1.5 focus-within:-translate-y-1.5 sm:w-[164px]">
      {/* Primary Cover Button (tap to read, long-press to inspect metadata) */}
      <button
        type="button"
        onClick={handleCoverClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={(e) => {
          if (longPressTriggeredRef.current) {
            e.preventDefault();
          }
        }}
        aria-label={`Read ${book.title} by ${book.author}`}
        className="w-full text-left"
      >
        <div
          className={`pi-book-cover relative flex h-[212px] w-full flex-col justify-between overflow-hidden rounded-[12px] border p-3.5 pr-9 sm:h-[242px] sm:p-4 sm:pr-10 ${palette.bg} ${palette.border}`}
        >
          {/* Spine groove accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-2.5 w-px bg-current opacity-15"
          />

          {/* Top typographic block */}
          <div className="relative z-10 pl-2">
            <p className={`pi-label truncate ${palette.subtext}`}>{book.author}</p>
            <h3
              className={`font-headline mt-1.5 line-clamp-3 text-[17px] leading-[1.15] font-semibold tracking-tight sm:text-[19px] ${palette.text}`}
            >
              {book.title}
            </h3>
            {book.subtitle && (
              <p className={`mt-1 line-clamp-1 font-reading-serif text-xs italic ${palette.subtext}`}>
                {book.subtitle}
              </p>
            )}
          </div>

          {/* Pattern ornament tucked into the lower half */}
          <div className="pointer-events-none relative mt-2 h-[86px] w-full pl-2 sm:h-[96px]">
            <CoverArtwork pattern={book.cover.pattern} accentClass={palette.accent} />
          </div>

          {/* Subtle reading progress bar along the base of the book cover */}
          <div
            aria-label={
              book.progressPercent > 0
                ? `${book.progressPercent}% read`
                : 'Not started'
            }
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[3px] bg-black/10"
          >
            <svg
              viewBox="0 0 100 3"
              preserveAspectRatio="none"
              className="block h-full w-full"
              aria-hidden="true"
            >
              <rect
                x="0"
                y="0"
                width={Math.min(100, Math.max(0, book.progressPercent))}
                height="3"
                fill="var(--pi-terracotta)"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* Sibling Info Button (44px accessible hitbox, solid paper backing for AA contrast) */}
      <button
        type="button"
        onClick={() => onInspect(book)}
        aria-label={`Details for ${book.title}`}
        className="absolute top-0 right-0 z-20 flex min-h-[44px] min-w-[44px] items-start justify-end p-2"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1F2A3A]/15 bg-[#F6EFE4]/95 text-[#1F2A3A] transition-colors hover:bg-white">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
};
