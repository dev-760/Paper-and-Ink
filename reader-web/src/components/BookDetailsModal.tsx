import React, { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { Book, Shelf } from '../types/reader';

interface BookDetailsModalProps {
  book: Book | null;
  shelf?: Shelf;
  shelves?: Shelf[];
  onMoveToShelf?: (bookId: string, shelfId: string) => void;
  onClose: () => void;
  onReadBook: (book: Book) => void;
  onDownloadPdf?: (book: Book) => Promise<boolean>;
}

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  book,
  shelf,
  shelves = [],
  onMoveToShelf,
  onClose,
  onReadBook,
  onDownloadPdf,
}) => {
  useEffect(() => {
    if (!book) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [book, onClose]);

  if (!book) return null;

  const totalMinutes = book.chapters.reduce((sum, ch) => sum + ch.estimatedMinutes, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-details-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] px-6 pt-3 pb-7 text-[var(--pi-ink)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] sm:rounded-[24px] sm:p-7"
      >
        {/* Mobile Drag Handle Affordance */}
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[var(--pi-ink)]/20 dark:bg-[var(--pi-ink-on-dark)]/20 sm:hidden"
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {shelf && (
              <p className="pi-label text-[var(--pi-terracotta)]">{shelf.title}</p>
            )}
            <h2
              id="book-details-title"
              className="font-headline mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {book.title}
            </h2>
            {book.subtitle && (
              <p className="font-reading-serif mt-0.5 text-sm italic text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
                {book.subtitle}
              </p>
            )}
            <p className="mt-1.5 text-sm font-medium text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)]">
              by {book.author}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close book details"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--pi-ink-muted)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Unboxed Metadata Row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-[var(--pi-hairline)] py-3 text-xs font-medium tabular-nums text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
          {book.year && (
            <>
              <span>{book.year}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{book.totalPages} pages</span>
          <span aria-hidden="true">·</span>
          <span>
            {book.chapters.length} {book.chapters.length === 1 ? 'excerpt' : 'chapters'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{totalMinutes} min read</span>
          {book.progressPercent > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--pi-terracotta)]">{book.progressPercent}% read</span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="mt-4 font-reading-serif text-[16px] leading-relaxed text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)]">
          {book.description}
        </p>

        {!book.isFullSample && (
          <p className="mt-3 text-xs text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
            Opening excerpt included. Use Add Books below to import your own PDFs locally.
          </p>
        )}

        {shelves.length > 0 && onMoveToShelf && (
          <div className="mt-5 border-t border-[var(--pi-hairline)] pt-4">
            <p className="pi-label text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)] mb-2">
              Shelf
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shelves.map((s) => {
                const active = s.id === book.shelfId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onMoveToShelf(book.id, s.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--pi-terracotta)] text-white'
                        : 'border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] text-[var(--pi-ink)] hover:bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-dark)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-white/10'
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => onReadBook(book)}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-[var(--pi-terracotta)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--pi-terracotta-hover)]"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>{book.progressPercent > 0 ? 'Continue Reading' : 'Read Book'}</span>
          </button>
          {book.id.startsWith('pdf-') && onDownloadPdf && (
            <button
              type="button"
              onClick={() => void onDownloadPdf(book)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[var(--pi-hairline-strong)] px-4 py-3 text-xs font-medium text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-white/10"
            >
              Save Original PDF
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[var(--pi-hairline-strong)] px-5 py-3 text-sm font-medium text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
