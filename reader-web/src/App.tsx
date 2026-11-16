import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGuestOnboardingFlow, usePaperInkAuth } from '@paper-and-ink/auth';
import { LibraryView } from './components/LibraryView';
import { OnboardingView } from './components/OnboardingView';
import { ReaderView } from './components/ReaderView';
import { DEFAULT_SHELVES } from './data/shelves';
import { createIndexedDBAdapter, DEFAULT_READER_SETTINGS } from './lib/storage';
import type { ShelfTone } from './design-system/tokens';
import type { Book, Bookmark, Quote, ReaderSettings, SavedWord, Shelf } from './types/reader';

export default function App() {
  const auth = usePaperInkAuth();
  const welcomeFlow = useGuestOnboardingFlow('reader', auth);
  const storage = useMemo(
    () => createIndexedDBAdapter(DEFAULT_SHELVES, [], auth.accountScope),
    [auth.accountScope],
  );

  const [shelves, setShelves] = useState<Shelf[]>(DEFAULT_SHELVES);
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeInitialChapterId, setActiveInitialChapterId] = useState<string | undefined>(undefined);
  const [activeInitialScrollRatio, setActiveInitialScrollRatio] = useState<number>(0);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoadingLibrary(true);
    setActiveBookId(null);

    Promise.all([
      storage.getShelves(),
      storage.getBooks(),
      storage.getSettings(),
      storage.getQuotes(),
      storage.getSavedWords(),
    ])
      .then(([loadedShelves, loadedBooks, loadedSettings, loadedQuotes, loadedWords]) => {
        if (!mounted) return;
        setShelves(loadedShelves);
        setBooks(loadedBooks);
        setSettings(loadedSettings);
        setQuotes(loadedQuotes);
        setSavedWords(loadedWords);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorNotice('Could not load saved reading progress; using local defaults.');
      })
      .finally(() => {
        if (mounted) setIsLoadingLibrary(false);
      });

    return () => {
      mounted = false;
    };
  }, [storage]);

  useEffect(() => {
    const isDark = settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        settings.theme === 'dark' ? '#141A16' : settings.theme === 'sepia' ? '#ECE0CB' : '#F6EFE4',
      );
    }
  }, [settings.theme]);

  const activeBook = useMemo(() => books.find((b) => b.id === activeBookId) ?? null, [books, activeBookId]);

  const handleSelectBook = useCallback(
    async (book: Book) => {
      try {
        const [pos, bookMarks] = await Promise.all([
          storage.getPosition(book.id),
          storage.getBookmarks(book.id),
        ]);
        const now = Date.now();
        setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, lastOpenedAt: now } : b)));
        setActiveInitialChapterId(pos?.chapterId);
        setActiveInitialScrollRatio(pos ? Math.min(1, Math.max(0, pos.charOffset / 1000)) : 0);
        setBookmarks(bookMarks);
        setActiveBookId(book.id);
        window.scrollTo({ top: 0 });
      } catch {
        setActiveInitialChapterId(undefined);
        setActiveInitialScrollRatio(0);
        setBookmarks([]);
        setActiveBookId(book.id);
        setErrorNotice('Saved progress for this book could not be loaded.');
        window.scrollTo({ top: 0 });
      }
    },
    [storage],
  );

  const handleImportBook = useCallback(
    async (book: Book, pdfBuffer?: ArrayBuffer) => {
      await storage.saveImportedBook(book, pdfBuffer);
      const updated = await storage.getBooks();
      setBooks(updated);
    },
    [storage],
  );

  const handleSaveShelf = useCallback(
    async (input: { id?: string; title: string; description?: string; tone: ShelfTone }) => {
      const nextShelves = input.id
        ? shelves.map((s) =>
            s.id === input.id
              ? { ...s, title: input.title, description: input.description, tone: input.tone }
              : s,
          )
        : [
            ...shelves,
            {
              id: `shelf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              title: input.title,
              description: input.description,
              tone: input.tone,
            },
          ];
      setShelves(nextShelves);
      await storage.saveShelves(nextShelves);
    },
    [shelves, storage],
  );

  const handleDeleteShelf = useCallback(
    async (shelfId: string) => {
      if (shelves.length <= 1) return;
      const nextShelves = shelves.filter((s) => s.id !== shelfId);
      const fallbackShelfId = nextShelves[0].id;
      const affectedBooks = books.filter((b) => b.shelfId === shelfId);
      setShelves(nextShelves);
      setBooks((prev) =>
        prev.map((b) => (b.shelfId === shelfId ? { ...b, shelfId: fallbackShelfId } : b)),
      );
      await storage.saveShelves(nextShelves);
      await Promise.all(
        affectedBooks.map((b) => storage.moveBookToShelf(b.id, fallbackShelfId)),
      );
    },
    [books, shelves, storage],
  );

  const handleMoveBookToShelf = useCallback(
    async (bookId: string, shelfId: string) => {
      setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, shelfId } : b)));
      await storage.moveBookToShelf(bookId, shelfId);
    },
    [storage],
  );

  const handleUpdateBookBrief = useCallback(
    async (updatedBook: Book) => {
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      await storage.saveImportedBook(updatedBook);
    },
    [storage],
  );

  const handleDownloadOriginalPdf = useCallback(
    async (book: Book) => {
      const buffer = await storage.getPdfFile(book.id);
      if (!buffer) return false;
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${book.title.replace(/[^\w\s-]/g, '').trim() || 'book'}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    },
    [storage],
  );

  const handleUpdateSettings = useCallback(
    (next: ReaderSettings) => {
      setSettings(next);
      void storage.saveSettings(next);
    },
    [storage],
  );

  const handleToggleDark = useCallback(() => {
    const nextTheme = settings.theme === 'dark' ? 'paper' : 'dark';
    handleUpdateSettings({ ...settings, theme: nextTheme });
  }, [handleUpdateSettings, settings]);

  const handleProgressChange = useCallback(
    (chapterId: string, progressPercent: number, scrollRatio = 0) => {
      if (!activeBookId) return;
      const now = Date.now();
      const clampedPct = Math.min(100, Math.max(0, Math.round(progressPercent)));
      const normalizedOffset = Math.min(1000, Math.max(0, Math.round(scrollRatio * 1000)));
      void storage.savePosition({
        bookId: activeBookId,
        chapterId,
        charOffset: normalizedOffset,
        progressPercent: clampedPct,
        updatedAt: now,
      });
      setBooks((prev) =>
        prev.map((b) =>
          b.id === activeBookId ? { ...b, progressPercent: clampedPct, lastOpenedAt: now } : b,
        ),
      );
    },
    [activeBookId, storage],
  );

  const handleToggleBookmark = useCallback(
    async (chapterId: string, label: string) => {
      if (!activeBookId) return;
      const newBookmark: Bookmark = {
        id: `${activeBookId}:${chapterId}`,
        bookId: activeBookId,
        chapterId,
        charOffset: 0,
        label,
        createdAt: Date.now(),
      };
      try {
        const added = await storage.toggleBookmark(newBookmark);
        setBookmarks((prev) =>
          added
            ? [...prev.filter((b) => b.chapterId !== chapterId), newBookmark]
            : prev.filter((b) => b.chapterId !== chapterId),
        );
      } catch {
        setErrorNotice('Could not update bookmark. Please try again.');
      }
    },
    [activeBookId, storage],
  );

  const handleSaveQuote = useCallback(
    async (quote: Quote) => {
      await storage.saveQuote(quote);
      setQuotes((prev) => [quote, ...prev.filter((q) => q.id !== quote.id)]);
    },
    [storage],
  );

  const handleSaveWord = useCallback(
    async (word: SavedWord) => {
      await storage.saveWord(word);
      setSavedWords((prev) => [word, ...prev.filter((w) => w.word !== word.word)]);
    },
    [storage],
  );

  const isBookmarked = useCallback(
    (chapterId: string) => bookmarks.some((b) => b.chapterId === chapterId),
    [bookmarks],
  );

  const handleCompleteOnboarding = useCallback(() => {
    welcomeFlow.finishOnboarding();
  }, [welcomeFlow]);

  const handleBackToLibrary = useCallback(() => {
    setActiveBookId(null);
    window.scrollTo({ top: 0 });
  }, []);

  const content = activeBook ? (
    <ReaderView
      book={activeBook}
      initialChapterId={activeInitialChapterId}
      initialScrollRatio={activeInitialScrollRatio}
      settings={settings}
      quotes={quotes.filter((q) => q.bookId === activeBook.id)}
      savedWords={savedWords}
      isBookmarked={isBookmarked}
      onToggleBookmark={handleToggleBookmark}
      onSaveQuote={handleSaveQuote}
      onSaveWord={handleSaveWord}
      onUpdateSettings={handleUpdateSettings}
      onProgressChange={handleProgressChange}
      onBackToLibrary={handleBackToLibrary}
    />
  ) : (
    <LibraryView
      shelves={shelves}
      books={books}
      isDark={settings.theme === 'dark'}
      isLoading={isLoadingLibrary}
      errorNotice={errorNotice}
      auth={auth}
      onDismissError={() => setErrorNotice(null)}
      onToggleDark={handleToggleDark}
      onSelectBook={handleSelectBook}
      onImportBook={handleImportBook}
      onDownloadOriginalPdf={handleDownloadOriginalPdf}
      onSaveShelf={handleSaveShelf}
      onDeleteShelf={handleDeleteShelf}
      onMoveBookToShelf={handleMoveBookToShelf}
      onUpdateBookBrief={handleUpdateBookBrief}
    />
  );

  return (
    <>
      {content}
      <OnboardingView
        open={welcomeFlow.showOnboarding}
        isDark={settings.theme === 'dark'}
        auth={auth}
        completeLabel="Open library"
        onToggleDark={handleToggleDark}
        onContinueAsGuest={welcomeFlow.continueAsGuest}
        onComplete={handleCompleteOnboarding}
      />
    </>
  );
}
