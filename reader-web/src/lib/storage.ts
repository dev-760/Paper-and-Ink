import {
  claimLegacyGuestNamespaceOnce,
  getActiveAccountScope,
  scopedStorageKey,
} from '@paper-and-ink/auth';
import type {
  Book,
  Bookmark,
  Quote,
  ReaderSettings,
  ReadingPosition,
  SavedWord,
  Shelf,
} from '../types/reader';

export interface StorageAdapter {
  getShelves(): Promise<Shelf[]>;
  saveShelves(shelves: Shelf[]): Promise<void>;
  getBooks(): Promise<Book[]>;
  saveImportedBook(book: Book, pdfData?: ArrayBuffer): Promise<void>;
  moveBookToShelf(bookId: string, shelfId: string): Promise<void>;
  deleteImportedBook(bookId: string): Promise<void>;
  getPdfFile(bookId: string): Promise<ArrayBuffer | null>;
  getPosition(bookId: string): Promise<ReadingPosition | null>;
  savePosition(position: ReadingPosition): Promise<void>;
  getSettings(): Promise<ReaderSettings>;
  saveSettings(settings: ReaderSettings): Promise<void>;
  getBookmarks(bookId: string): Promise<Bookmark[]>;
  toggleBookmark(bookmark: Bookmark): Promise<boolean>;
  getQuotes(bookId?: string): Promise<Quote[]>;
  saveQuote(quote: Quote): Promise<void>;
  getSavedWords(): Promise<SavedWord[]>;
  saveWord(word: SavedWord): Promise<void>;
}

const LEGACY_DB_NAME = 'paper_and_ink_reader_db';
const DB_VERSION = 2;
const BASE_SETTINGS_KEY = 'paper_and_ink_reader_settings';
const BASE_SHELVES_KEY = 'paper_and_ink_reader_shelves';

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'paper',
  fontFamily: 'source-serif',
  fontSize: 'md',
  lineHeight: 'relaxed',
  alignment: 'left',
  hyphenation: false,
};

function dbNameForScope(scope: string): string {
  return scope === 'guest' ? LEGACY_DB_NAME : `${LEGACY_DB_NAME}_${scope}`;
}

function settingsKeyForScope(scope: string): string {
  return scope === 'guest' ? BASE_SETTINGS_KEY : scopedStorageKey(BASE_SETTINGS_KEY, scope);
}

function shelvesKeyForScope(scope: string): string {
  return scope === 'guest' ? BASE_SHELVES_KEY : scopedStorageKey(BASE_SHELVES_KEY, scope);
}

function sanitizeShelves(raw: unknown, fallback: Shelf[]): Shelf[] {
  if (!Array.isArray(raw)) return fallback;
  const cleaned: Shelf[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<Shelf>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const tone =
      candidate.tone === 'terracotta' ||
      candidate.tone === 'sage' ||
      candidate.tone === 'navy' ||
      candidate.tone === 'tan'
        ? candidate.tone
        : 'sage';
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    cleaned.push({
      id,
      title,
      tone,
      ...(typeof candidate.description === 'string' && candidate.description.trim()
        ? { description: candidate.description.trim() }
        : {}),
    });
  }
  return cleaned.length > 0 ? cleaned : fallback;
}

const openPromises = new Map<string, Promise<IDBDatabase>>();

function openDbByName(name: string): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  const existing = openPromises.get(name);
  if (existing) return existing;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains('bookmarks')) {
        db.createObjectStore('bookmarks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quotes')) {
        db.createObjectStore('quotes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('words')) {
        db.createObjectStore('words', { keyPath: 'word' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('importedBooks')) {
        db.createObjectStore('importedBooks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pdfFiles')) {
        db.createObjectStore('pdfFiles', { keyPath: 'bookId' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        openPromises.delete(name);
      };
      db.onclose = () => {
        openPromises.delete(name);
      };
      resolve(db);
    };
    req.onerror = () => {
      openPromises.delete(name);
      reject(req.error ?? new Error('Failed to open IndexedDB'));
    };
    req.onblocked = () => {
      openPromises.delete(name);
      reject(new Error('IndexedDB connection blocked'));
    };
  });

  openPromises.set(name, promise);
  return promise;
}

function readStoreAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

function writeStoreItems<T>(db: IDBDatabase, storeName: string, items: T[]): Promise<void> {
  if (items.length === 0 || !db.objectStoreNames.contains(storeName)) return Promise.resolve();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

const migratedScopes = new Set<string>();

async function ensureLegacyMigrationForScope(scope: string): Promise<void> {
  if (scope === 'guest' || migratedScopes.has(scope)) return;
  migratedScopes.add(scope);

  if (!claimLegacyGuestNamespaceOnce(scope)) return;

  try {
    const targetDb = await openDbByName(dbNameForScope(scope));
    const existingPositions = await readStoreAll<ReadingPosition>(targetDb, 'positions');
    const existingBooks = await readStoreAll<Book>(targetDb, 'importedBooks');
    if (existingPositions.length > 0 || existingBooks.length > 0) return;

    const legacyDb = await openDbByName(LEGACY_DB_NAME);
    const [positions, bookmarks, quotes, words, importedBooks, pdfFiles] = await Promise.all([
      readStoreAll<ReadingPosition>(legacyDb, 'positions'),
      readStoreAll<Bookmark>(legacyDb, 'bookmarks'),
      readStoreAll<Quote>(legacyDb, 'quotes'),
      readStoreAll<SavedWord>(legacyDb, 'words'),
      readStoreAll<Book>(legacyDb, 'importedBooks'),
      readStoreAll<{ bookId: string; data: ArrayBuffer }>(legacyDb, 'pdfFiles'),
    ]);

    await Promise.all([
      writeStoreItems(targetDb, 'positions', positions),
      writeStoreItems(targetDb, 'bookmarks', bookmarks),
      writeStoreItems(targetDb, 'quotes', quotes),
      writeStoreItems(targetDb, 'words', words),
      writeStoreItems(targetDb, 'importedBooks', importedBooks),
      writeStoreItems(targetDb, 'pdfFiles', pdfFiles),
    ]);

    const legacySettings = localStorage.getItem(BASE_SETTINGS_KEY);
    if (legacySettings && !localStorage.getItem(settingsKeyForScope(scope))) {
      localStorage.setItem(settingsKeyForScope(scope), legacySettings);
    }
  } catch {
    // Non-fatal; user DB starts clean if legacy copy fails
  }
}

function sanitizeSettings(raw: unknown): ReaderSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_READER_SETTINGS;
  const candidate = raw as Partial<ReaderSettings>;
  const theme =
    candidate.theme === 'paper' || candidate.theme === 'sepia' || candidate.theme === 'dark'
      ? candidate.theme
      : DEFAULT_READER_SETTINGS.theme;
  const fontFamily =
    candidate.fontFamily === 'source-serif' || candidate.fontFamily === 'lora'
      ? candidate.fontFamily
      : DEFAULT_READER_SETTINGS.fontFamily;
  const fontSize =
    candidate.fontSize === 'sm' ||
    candidate.fontSize === 'md' ||
    candidate.fontSize === 'lg' ||
    candidate.fontSize === 'xl'
      ? candidate.fontSize
      : DEFAULT_READER_SETTINGS.fontSize;
  const lineHeight =
    candidate.lineHeight === 'snug' ||
    candidate.lineHeight === 'relaxed' ||
    candidate.lineHeight === 'airy'
      ? candidate.lineHeight
      : DEFAULT_READER_SETTINGS.lineHeight;
  const alignment =
    candidate.alignment === 'left' || candidate.alignment === 'justify'
      ? candidate.alignment
      : DEFAULT_READER_SETTINGS.alignment;
  const hyphenation =
    typeof candidate.hyphenation === 'boolean'
      ? candidate.hyphenation
      : DEFAULT_READER_SETTINGS.hyphenation;

  return { theme, fontFamily, fontSize, lineHeight, alignment, hyphenation };
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createIndexedDBAdapter(
  seedShelves: Shelf[],
  seedBooks: Book[],
  explicitScope?: string,
): StorageAdapter {
  const scope = explicitScope ?? getActiveAccountScope();
  const dbName = dbNameForScope(scope);
  const settingsKey = settingsKeyForScope(scope);
  const shelvesKey = shelvesKeyForScope(scope);

  const memoryPositions = new Map<string, ReadingPosition>();
  const memoryBookmarks = new Map<string, Bookmark>();
  const memoryQuotes = new Map<string, Quote>();
  const memoryWords = new Map<string, SavedWord>();
  const memoryImportedBooks = new Map<string, Book>();
  const memoryPdfFiles = new Map<string, ArrayBuffer>();

  const getDb = async () => {
    await ensureLegacyMigrationForScope(scope);
    return openDbByName(dbName);
  };

  const readLocalSettings = (): ReaderSettings | null => {
    try {
      const raw = localStorage.getItem(settingsKey);
      if (!raw) return null;
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  return {
    async getShelves() {
      try {
        const db = await getDb();
        const kvEntries = await readStoreAll<{ key: string; value: unknown }>(db, 'kv');
        const found = kvEntries.find((e) => e.key === 'shelves');
        if (found) {
          return sanitizeShelves(found.value, seedShelves);
        }
      } catch {
        // ignore and check localStorage
      }
      try {
        const raw = localStorage.getItem(shelvesKey);
        if (raw) {
          return sanitizeShelves(JSON.parse(raw), seedShelves);
        }
      } catch {
        // ignore
      }
      return seedShelves;
    },

    async saveShelves(nextShelves: Shelf[]) {
      const cleaned = sanitizeShelves(nextShelves, seedShelves);
      try {
        localStorage.setItem(shelvesKey, JSON.stringify(cleaned));
      } catch {
        // ignore
      }
      try {
        const db = await getDb();
        await writeStoreItems(db, 'kv', [{ key: 'shelves', value: cleaned }]);
      } catch {
        // ignore
      }
    },

    async getBooks() {
      let imported: Book[] = Array.from(memoryImportedBooks.values());
      try {
        const db = await getDb();
        imported = await readStoreAll<Book>(db, 'importedBooks');
      } catch {
        // fallback to memory
      }

      const combined = [...imported, ...seedBooks];
      return Promise.all(
        combined.map(async (book) => {
          const pos = await this.getPosition(book.id);
          return pos
            ? {
                ...book,
                progressPercent: clampProgress(pos.progressPercent),
                lastOpenedAt: pos.updatedAt,
              }
            : book;
        }),
      );
    },

    async saveImportedBook(book: Book, pdfData?: ArrayBuffer) {
      memoryImportedBooks.set(book.id, book);
      if (pdfData) {
        memoryPdfFiles.set(book.id, pdfData);
      }
      try {
        const db = await getDb();
        await writeStoreItems(db, 'importedBooks', [book]);
        if (pdfData) {
          await writeStoreItems(db, 'pdfFiles', [{ bookId: book.id, data: pdfData }]);
        }
      } catch {
        // already stored in memory
      }
    },

    async moveBookToShelf(bookId: string, shelfId: string) {
      const memBook = memoryImportedBooks.get(bookId);
      if (memBook) {
        memoryImportedBooks.set(bookId, { ...memBook, shelfId });
      }
      try {
        const db = await getDb();
        const existing = await readStoreAll<Book>(db, 'importedBooks');
        const found = existing.find((b) => b.id === bookId);
        if (found) {
          await writeStoreItems(db, 'importedBooks', [{ ...found, shelfId }]);
        }
      } catch {
        // ignore
      }
    },

    async deleteImportedBook(bookId: string) {
      memoryImportedBooks.delete(bookId);
      memoryPdfFiles.delete(bookId);
      try {
        const db = await getDb();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(['importedBooks', 'pdfFiles', 'positions'], 'readwrite');
          tx.objectStore('importedBooks').delete(bookId);
          tx.objectStore('pdfFiles').delete(bookId);
          tx.objectStore('positions').delete(bookId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch {
        // ignore
      }
    },

    async getPdfFile(bookId: string) {
      try {
        const db = await getDb();
        return await new Promise<ArrayBuffer | null>((resolve) => {
          const tx = db.transaction('pdfFiles', 'readonly');
          const req = tx.objectStore('pdfFiles').get(bookId);
          req.onsuccess = () => {
            const record = req.result as { bookId: string; data: ArrayBuffer } | undefined;
            resolve(record?.data ?? memoryPdfFiles.get(bookId) ?? null);
          };
          req.onerror = () => resolve(memoryPdfFiles.get(bookId) ?? null);
        });
      } catch {
        return memoryPdfFiles.get(bookId) ?? null;
      }
    },

    async getPosition(bookId: string) {
      try {
        const db = await getDb();
        return await new Promise<ReadingPosition | null>((resolve) => {
          const tx = db.transaction('positions', 'readonly');
          const req = tx.objectStore('positions').get(bookId);
          req.onsuccess = () => resolve((req.result as ReadingPosition) ?? null);
          req.onerror = () => resolve(memoryPositions.get(bookId) ?? null);
        });
      } catch {
        return memoryPositions.get(bookId) ?? null;
      }
    },

    async savePosition(position: ReadingPosition) {
      const normalized: ReadingPosition = {
        ...position,
        charOffset: Math.max(0, Math.round(position.charOffset)),
        progressPercent: clampProgress(position.progressPercent),
      };
      memoryPositions.set(normalized.bookId, normalized);
      try {
        const db = await getDb();
        await writeStoreItems(db, 'positions', [normalized]);
      } catch {
        // Fallback already stored in memory
      }
    },

    async getSettings() {
      try {
        const db = await getDb();
        const stored = await new Promise<ReaderSettings | null>((resolve) => {
          const tx = db.transaction('kv', 'readonly');
          const req = tx.objectStore('kv').get(settingsKey);
          req.onsuccess = () => {
            const record = req.result as { key: string; value: unknown } | undefined;
            resolve(record?.value ? sanitizeSettings(record.value) : null);
          };
          req.onerror = () => resolve(null);
        });
        return stored ?? readLocalSettings() ?? DEFAULT_READER_SETTINGS;
      } catch {
        return readLocalSettings() ?? DEFAULT_READER_SETTINGS;
      }
    },

    async saveSettings(settings: ReaderSettings) {
      const sanitized = sanitizeSettings(settings);
      try {
        localStorage.setItem(settingsKey, JSON.stringify(sanitized));
      } catch {
        // Ignore storage quota errors
      }
      try {
        const db = await getDb();
        await writeStoreItems(db, 'kv', [{ key: settingsKey, value: sanitized }]);
      } catch {
        // Fallback already written to localStorage
      }
    },

    async getBookmarks(bookId: string) {
      try {
        const db = await getDb();
        const all = await readStoreAll<Bookmark>(db, 'bookmarks');
        return all.filter((b) => b.bookId === bookId);
      } catch {
        return Array.from(memoryBookmarks.values()).filter((b) => b.bookId === bookId);
      }
    },

    async toggleBookmark(bookmark: Bookmark) {
      const existing = await this.getBookmarks(bookmark.bookId);
      const match = existing.find((b) => b.chapterId === bookmark.chapterId);
      if (match) {
        memoryBookmarks.delete(match.id);
        try {
          const db = await getDb();
          await new Promise<void>((resolve) => {
            const tx = db.transaction('bookmarks', 'readwrite');
            tx.objectStore('bookmarks').delete(match.id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        } catch {
          // Fallback already updated
        }
        return false;
      }
      memoryBookmarks.set(bookmark.id, bookmark);
      try {
        const db = await getDb();
        await writeStoreItems(db, 'bookmarks', [bookmark]);
      } catch {
        // Fallback already updated
      }
      return true;
    },

    async getQuotes(bookId?: string) {
      try {
        const db = await getDb();
        const all = await readStoreAll<Quote>(db, 'quotes');
        return bookId ? all.filter((q) => q.bookId === bookId) : all;
      } catch {
        const all = Array.from(memoryQuotes.values());
        return bookId ? all.filter((q) => q.bookId === bookId) : all;
      }
    },

    async saveQuote(quote: Quote) {
      memoryQuotes.set(quote.id, quote);
      try {
        const db = await getDb();
        await writeStoreItems(db, 'quotes', [quote]);
      } catch {
        // Fallback already stored
      }
    },

    async getSavedWords() {
      try {
        const db = await getDb();
        return await readStoreAll<SavedWord>(db, 'words');
      } catch {
        return Array.from(memoryWords.values());
      }
    },

    async saveWord(word: SavedWord) {
      memoryWords.set(word.word, word);
      try {
        const db = await getDb();
        await writeStoreItems(db, 'words', [word]);
      } catch {
        // Fallback already stored
      }
    },
  };
}
