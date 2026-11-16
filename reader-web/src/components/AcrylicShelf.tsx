import React from 'react';
import { Pencil } from 'lucide-react';
import { PAPER_AND_INK_TOKENS, type ShelfTone } from '../design-system/tokens';
import type { Book, Shelf } from '../types/reader';
import { BookCover } from './BookCover';

interface AcrylicShelfProps {
  shelf: Shelf;
  books: Book[];
  onSelectBook: (book: Book) => void;
  onInspectBook: (book: Book) => void;
  onEditShelf?: (shelf: Shelf) => void;
}

export const AcrylicShelf: React.FC<AcrylicShelfProps> = ({
  shelf,
  books,
  onSelectBook,
  onInspectBook,
  onEditShelf,
}) => {
  const acrylicClass = PAPER_AND_INK_TOKENS.acrylicShelves[shelf.tone].className;

  return (
    <section aria-labelledby={`shelf-heading-${shelf.id}`} className="relative">
      {/* Category Row Header: Title left, Edit + "N books" right */}
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--pi-hairline)] pb-2.5">
        <div className="min-w-0">
          <h2
            id={`shelf-heading-${shelf.id}`}
            className="font-headline truncate text-xl font-semibold tracking-tight text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)] sm:text-2xl"
          >
            {shelf.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)] whitespace-nowrap">
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </span>
          {onEditShelf && (
            <button
              type="button"
              onClick={() => onEditShelf(shelf)}
              aria-label={`Customize ${shelf.title} shelf`}
              title="Customize shelf"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--pi-ink-muted)] transition-colors hover:bg-[var(--pi-paper-muted)] hover:text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10 dark:hover:text-[var(--pi-ink-on-dark)] cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Shelf Stage: Horizontally scrolling book covers + overlapping translucent acrylic shelf */}
      <div className="relative">
        {books.length > 0 ? (
          <div className="pi-shelf-scroll relative z-0 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pt-2 pb-1 sm:gap-6 sm:px-6">
            {books.map((book) => (
              <BookCover
                key={book.id}
                book={book}
                onSelect={onSelectBook}
                onInspect={onInspectBook}
              />
            ))}
          </div>
        ) : (
          <div className="relative z-0 flex h-[212px] items-center justify-center px-6 sm:h-[242px]">
            <p className="text-sm text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
              No books on this shelf yet.
            </p>
          </div>
        )}

        {/* Translucent Acrylic Shelf Bar overlapping lower third of covers with two small screw dots */}
        <div
          aria-hidden="true"
          className={`pi-acrylic-shelf pointer-events-none absolute right-0 bottom-2 left-0 z-10 h-[58px] rounded-[14px] sm:h-[66px] ${acrylicClass}`}
        >
          {/* Left screw dot */}
          <span className="pi-screw-dot absolute top-1/2 left-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
            <span className="h-[1px] w-1.5 rotate-45 bg-black/35" />
          </span>
          {/* Right screw dot */}
          <span className="pi-screw-dot absolute top-1/2 right-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
            <span className="h-[1px] w-1.5 -rotate-12 bg-black/35" />
          </span>
        </div>
      </div>
    </section>
  );
};

interface AcrylicShelfSkeletonProps {
  tone?: ShelfTone;
  coverCount?: number;
}

export const AcrylicShelfSkeleton: React.FC<AcrylicShelfSkeletonProps> = ({
  tone = 'sage',
  coverCount = 4,
}) => {
  const acrylicClass = PAPER_AND_INK_TOKENS.acrylicShelves[tone].className;

  return (
    <section aria-hidden="true" className="relative">
      {/* Shelf Header Skeleton */}
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--pi-hairline)] pb-2.5">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)] sm:h-8 sm:w-56" />
        <div className="h-3.5 w-14 animate-pulse rounded-md bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)]" />
      </div>

      {/* Shelf Stage Skeleton */}
      <div className="relative">
        <div className="pi-shelf-scroll relative z-0 flex gap-5 overflow-hidden px-4 pt-2 pb-1 sm:gap-6 sm:px-6">
          {Array.from({ length: coverCount }).map((_, idx) => (
            <div
              key={idx}
              className="pi-book-cover relative flex h-[212px] w-[144px] shrink-0 flex-col justify-between overflow-hidden rounded-[12px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-3.5 pr-9 dark:bg-[var(--pi-desk-elevated)] sm:h-[242px] sm:w-[164px] sm:p-4 sm:pr-10"
            >
              <div className="pointer-events-none absolute inset-y-0 left-2.5 w-px bg-current opacity-10" />
              <div className="space-y-2 pl-2">
                <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--pi-paper-muted)] dark:bg-white/10" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--pi-paper-muted)] dark:bg-white/15" />
                <div className="h-4 w-18 animate-pulse rounded bg-[var(--pi-paper-muted)] dark:bg-white/10" />
              </div>
              <div className="ml-2 h-[72px] w-[88%] animate-pulse rounded-lg bg-[var(--pi-paper-muted)]/70 dark:bg-white/5 sm:h-[84px]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/10 dark:bg-white/10" />
            </div>
          ))}
        </div>

        {/* Translucent Acrylic Shelf Bar */}
        <div
          className={`pi-acrylic-shelf pointer-events-none absolute right-0 bottom-2 left-0 z-10 h-[58px] rounded-[14px] sm:h-[66px] ${acrylicClass}`}
        >
          <span className="pi-screw-dot absolute top-1/2 left-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
            <span className="h-[1px] w-1.5 rotate-45 bg-black/35" />
          </span>
          <span className="pi-screw-dot absolute top-1/2 right-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
            <span className="h-[1px] w-1.5 -rotate-12 bg-black/35" />
          </span>
        </div>
      </div>
    </section>
  );
};
