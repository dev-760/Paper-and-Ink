import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { AccountMenu } from '@paper-and-ink/design-system';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import type { ShelfTone } from '../design-system/tokens';
import type { Book, Shelf } from '../types/reader';
import { AcrylicShelf, AcrylicShelfSkeleton } from './AcrylicShelf';
import { BookDetailsModal } from './BookDetailsModal';
import { PdfImportModal } from './PdfImportModal';
import { ShelfModal } from './ShelfModal';

interface LibraryViewProps {
  shelves: Shelf[];
  books: Book[];
  isDark: boolean;
  isLoading?: boolean;
  errorNotice?: string | null;
  auth: PaperInkAuthState;
  onDismissError?: () => void;
  onToggleDark: () => void;
  onSelectBook: (book: Book) => void;
  onImportBook: (book: Book, pdfBuffer?: ArrayBuffer) => Promise<void>;
  onDownloadOriginalPdf?: (book: Book) => Promise<boolean>;
  onSaveShelf: (input: {
    id?: string;
    title: string;
    description?: string;
    tone: ShelfTone;
  }) => Promise<void>;
  onDeleteShelf: (shelfId: string) => Promise<void>;
  onMoveBookToShelf: (bookId: string, shelfId: string) => Promise<void>;
  onUpdateBookBrief: (book: Book) => Promise<void>;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  shelves,
  books,
  isDark,
  isLoading = false,
  errorNotice,
  auth,
  onDismissError,
  onToggleDark,
  onSelectBook,
  onImportBook,
  onDownloadOriginalPdf,
  onSaveShelf,
  onDeleteShelf,
  onMoveBookToShelf,
  onUpdateBookBrief,
}) => {
  const [showAddBooksModal, setShowAddBooksModal] = useState(false);
  const [shelfModalOpen, setShelfModalOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [isAddPillHidden, setIsAddPillHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 64) {
        setIsAddPillHidden(false);
      } else if (delta > 8) {
        setIsAddPillHidden(true);
      } else if (delta < -8) {
        setIsAddPillHidden(false);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!showAddBooksModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddBooksModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddBooksModal]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredBooks = useMemo(() => {
    if (!normalizedQuery) return books;
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(normalizedQuery) ||
        (book.subtitle?.toLowerCase().includes(normalizedQuery) ?? false) ||
        book.author.toLowerCase().includes(normalizedQuery)
    );
  }, [books, normalizedQuery]);

  const visibleShelves = useMemo(() => {
    const grouped = shelves.map((shelf) => ({
      shelf,
      books: filteredBooks.filter((book) => book.shelfId === shelf.id),
    }));
    if (normalizedQuery) {
      return grouped.filter((group) => group.books.length > 0);
    }
    return grouped;
  }, [filteredBooks, normalizedQuery, shelves]);

  const detailShelf = detailBook
    ? shelves.find((s) => s.id === detailBook.shelfId)
    : undefined;

  return (
    <div className="min-h-dvh bg-[var(--pi-paper)] text-[var(--pi-ink)] transition-colors duration-200 dark:bg-[var(--pi-desk-dark)] dark:text-[var(--pi-ink-on-dark)]">
      {/* Compact Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 pt-4 pb-2 sm:gap-3 sm:px-8 sm:pt-8">
        <span className="pi-label text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)] whitespace-nowrap">
          Paper &amp; Ink
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <AccountMenu
            profile={auth.profile}
            isLoading={auth.isLoading}
            onLogin={auth.login}
            onRegister={auth.register}
            onUpdateProfile={auth.updateProfile}
            onLogout={auth.logout}
          />
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? 'Switch to Paper Cream theme' : 'Switch to Dark Desk theme'}
            className="flex min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] items-center justify-center rounded-full border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-white/10"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Library Content */}
      <main className="mx-auto max-w-6xl px-4 pt-2 pb-28 sm:px-8 sm:pb-32">
        <div className="mb-4 flex flex-col gap-2.5 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark)] sm:text-5xl">
              Library
            </h1>
          </div>
        </div>

        {/* Sticky Top Search Bar */}
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-[var(--pi-hairline)] bg-[var(--pi-paper)]/92 px-4 py-2.5 backdrop-blur-md transition-colors dark:bg-[var(--pi-desk-dark)]/92 sm:-mx-8 sm:mb-10 sm:px-8 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]"
              />
              <label htmlFor="library-search-input" className="sr-only">
                Search books by title or author
              </label>
              <input
                id="library-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or author..."
                className="min-h-[44px] w-full rounded-full border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper-elevated)] pr-12 pl-11 text-sm text-[var(--pi-ink)] placeholder:text-[var(--pi-ink-subtle)] focus:border-[var(--pi-terracotta)] focus:outline-none dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] dark:placeholder:text-[var(--pi-ink-on-dark-muted)] [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-0.5 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-[var(--pi-ink-muted)] hover:text-[var(--pi-ink)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:text-[var(--pi-ink-on-dark)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {normalizedQuery && (
                <p className="text-xs font-medium tabular-nums text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
                  {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} matching &ldquo;
                  {searchQuery.trim()}&rdquo;
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingShelf(null);
                  setShelfModalOpen(true);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper-elevated)] px-3.5 py-1.5 text-xs font-medium text-[var(--pi-ink)] transition-colors hover:bg-[var(--pi-paper-muted)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] dark:hover:bg-white/10 cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" aria-hidden="true" />
                <span>New shelf</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Shelves or Empty Search State */}
        {errorNotice && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-[var(--pi-terracotta)]/35 bg-[var(--pi-paper-elevated)] px-4 py-3 text-sm text-[var(--pi-ink)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)]"
          >
            <span>{errorNotice}</span>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss notice"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--pi-ink-muted)] hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading library shelves"
            className="space-y-12 sm:space-y-14"
          >
            {(shelves.length > 0
              ? shelves.map((s) => s.tone)
              : (['sage', 'terracotta', 'navy'] as const)
            ).map((tone, idx) => (
              <AcrylicShelfSkeleton key={`skeleton-${idx}`} tone={tone} coverCount={4} />
            ))}
          </div>
        ) : visibleShelves.length > 0 && (books.length > 0 || shelves.length > 0) ? (
          <div className="space-y-9 sm:space-y-14">
            {visibleShelves.map(({ shelf, books: shelfBooks }) => (
              <AcrylicShelf
                key={shelf.id}
                shelf={shelf}
                books={shelfBooks}
                onSelectBook={onSelectBook}
                onInspectBook={(book) => setDetailBook(book)}
                onEditShelf={(target) => {
                  setEditingShelf(target);
                  setShelfModalOpen(true);
                }}
              />
            ))}
          </div>
        ) : !normalizedQuery ? (
          <div className="rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-7 sm:p-10 text-center max-w-lg mx-auto mt-4 dark:bg-[var(--pi-desk-elevated)]">
            <h2 className="font-headline text-2xl font-semibold">Your library is empty</h2>
            <p className="mt-2 text-sm text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)] leading-relaxed">
              Import a PDF, EPUB, or TXT book to place it onto your shelves. All books and reading progress remain stored locally on this device.
            </p>
            <button
              type="button"
              onClick={() => setShowAddBooksModal(true)}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[var(--pi-terracotta)] px-5 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-92 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Import your first book</span>
            </button>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-8 text-center dark:bg-[var(--pi-desk-elevated)]">
            <h2 className="font-headline text-xl font-semibold">No books found</h2>
            <p className="mt-1.5 text-sm text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
              Nothing in your library matched &ldquo;{searchQuery.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--pi-hairline-strong)] px-5 py-2 text-xs font-medium transition-colors hover:bg-[var(--pi-paper-muted)] dark:hover:bg-white/10"
            >
              Clear search
            </button>
          </div>
        )}
      </main>

      {/* Floating Black Pill "Add Books" CTA — hides on scroll down or when modal is open, reopens on scroll up */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setShowAddBooksModal((prev) => !prev)}
          aria-hidden={isAddPillHidden || showAddBooksModal}
          tabIndex={isAddPillHidden || showAddBooksModal ? -1 : 0}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--pi-ink)] px-6 py-3 text-sm font-medium text-[var(--pi-paper)] transition-[transform,opacity] duration-200 ease-out dark:bg-[var(--pi-paper)] dark:text-[var(--pi-ink)] whitespace-nowrap ${
            isAddPillHidden || showAddBooksModal
              ? 'pointer-events-none translate-y-20 opacity-0'
              : 'pointer-events-auto translate-y-0 opacity-100 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Books</span>
        </button>
      </div>

      {/* Book Details Modal (Long-press or Info Button) */}
      <BookDetailsModal
        book={detailBook}
        shelf={detailShelf}
        shelves={shelves}
        onMoveToShelf={async (bookId, shelfId) => {
          await onMoveBookToShelf(bookId, shelfId);
          setDetailBook((prev) => (prev && prev.id === bookId ? { ...prev, shelfId } : prev));
        }}
        onUpdateBookBrief={async (updatedBook) => {
          await onUpdateBookBrief(updatedBook);
          setDetailBook((prev) => (prev && prev.id === updatedBook.id ? updatedBook : prev));
        }}
        onClose={() => setDetailBook(null)}
        onReadBook={(book) => {
          setDetailBook(null);
          onSelectBook(book);
        }}
        onDownloadPdf={onDownloadOriginalPdf}
      />

      {/* Local PDF + AI Scanned OCR Import Modal */}
      <PdfImportModal
        open={showAddBooksModal}
        shelves={shelves}
        onClose={() => setShowAddBooksModal(false)}
        onConfirmImport={onImportBook}
      />

      {/* Custom Shelf Create / Edit Modal */}
      <ShelfModal
        open={shelfModalOpen}
        editingShelf={editingShelf}
        canDelete={shelves.length > 1}
        onClose={() => setShelfModalOpen(false)}
        onSave={onSaveShelf}
        onDelete={onDeleteShelf}
      />
    </div>
  );
};
