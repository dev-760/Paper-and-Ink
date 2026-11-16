import { create } from 'zustand';
import { scopedStorageKey } from '@paper-and-ink/auth';
import {
  NOTEBOOK_CATEGORIES,
  type CoverColor,
  type Notebook,
  type NotebookCategory,
  type ShelfFilter,
} from '../types/notebook';
import type { ConversionResult, EditorMode, NotePage } from '../types/note';
import type { InkStroke } from '../types/ink';
import { storageAdapter } from '../lib/indexedDbStorage';
import { organizeNote } from '../features/organize/organizeNote';
import {
  deleteNotebookInDb,
  deletePageInDb,
  getSignedInUserId,
  pullNotesFromDb,
  pushNotebooksAndPagesToDb,
  upsertNotebookInDb,
  upsertPageInDb,
} from '../lib/notesSync';

export type AppScreen = 'shelf' | 'notebook' | 'editor';
export type ThemeMode = 'light' | 'dark';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type CloudSyncState = 'local' | 'syncing' | 'synced' | 'error';

const ONBOARDING_STORAGE_KEY = 'paper-and-ink:onboarding-complete';
const BASE_THEME_STORAGE_KEY = 'paper-and-ink:notes-theme';
const BASE_SHELVES_STORAGE_KEY = 'paper-and-ink:notes-shelves';

function normalizeShelfList(raw: unknown, notebooks: Notebook[] = []): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (val: unknown) => {
    if (typeof val !== 'string') return;
    const trimmed = val.trim().slice(0, 60);
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || key === 'all') return;
    seen.add(key);
    result.push(trimmed);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) add(item);
  }
  if (result.length === 0) {
    for (const def of NOTEBOOK_CATEGORIES) add(def);
  }
  for (const nb of notebooks) {
    add(nb.category);
  }
  return result;
}

function readShelvesFlag(notebooks: Notebook[] = []): string[] {
  try {
    if (typeof window === 'undefined') return [...NOTEBOOK_CATEGORIES];
    const raw = window.localStorage.getItem(scopedStorageKey(BASE_SHELVES_STORAGE_KEY));
    if (!raw) return normalizeShelfList(NOTEBOOK_CATEGORIES, notebooks);
    return normalizeShelfList(JSON.parse(raw), notebooks);
  } catch {
    return normalizeShelfList(NOTEBOOK_CATEGORIES, notebooks);
  }
}

function writeShelvesFlag(shelves: string[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      scopedStorageKey(BASE_SHELVES_STORAGE_KEY),
      JSON.stringify(shelves),
    );
  } catch {
    // Ignore storage restriction
  }
}

function readThemeFlag(): ThemeMode {
  try {
    if (typeof window === 'undefined') return 'light';
    const val = window.localStorage.getItem(scopedStorageKey(BASE_THEME_STORAGE_KEY));
    return val === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function writeThemeFlag(theme: ThemeMode) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(scopedStorageKey(BASE_THEME_STORAGE_KEY), theme);
  } catch {
    // Ignore storage restriction
  }
}

function readOnboardingFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeOnboardingFlag(done: boolean) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, String(done));
  } catch {
    // Ignore storage restriction
  }
}

interface NotesState {
  hasCompletedOnboarding: boolean;
  notebooks: Notebook[];
  pages: NotePage[];
  shelves: string[];
  isInitialized: boolean;
  isLoading: boolean;
  storageError: string | null;
  saveState: SaveState;
  lastSavedAt: string | null;
  cloudSyncState: CloudSyncState;
  cloudSyncMessage: string | null;
  lastSyncedAt: string | null;

  theme: ThemeMode;
  shelfFilter: ShelfFilter;
  activeScreen: AppScreen;
  activeNotebookId: string | null;
  activePageId: string | null;
  editorMode: EditorMode;
  pageSearchQuery: string;
  isConverting: boolean;

  initialize: () => Promise<void>;
  syncWithCloud: () => Promise<void>;
  reloadForScope: () => Promise<void>;
  flushPendingSaves: () => Promise<void>;
  completeOnboarding: () => void;
  reopenOnboarding: () => void;
  clearStorageError: () => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  setShelfFilter: (filter: ShelfFilter) => void;
  createShelf: (name: string) => string;
  renameShelf: (oldName: string, newName: string) => Promise<void>;
  deleteShelf: (name: string) => Promise<void>;
  openNotebook: (notebookId: string) => void;
  openPage: (pageId: string, preferredMode?: EditorMode) => void;
  goToShelf: () => void;
  goToNotebook: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setPageSearchQuery: (query: string) => void;

  createNotebook: (input: {
    title: string;
    subtitle?: string;
    category: NotebookCategory;
    coverColor: CoverColor;
  }) => Promise<Notebook>;
  deleteNotebook: (notebookId: string) => Promise<void>;
  renameNotebook: (notebookId: string, title: string) => Promise<void>;
  changeNotebookColor: (
    notebookId: string,
    coverColor: CoverColor
  ) => Promise<void>;
  moveNotebookCategory: (
    notebookId: string,
    category: NotebookCategory
  ) => Promise<void>;

  createNewPage: (options?: {
    notebookId?: string;
    mode?: EditorMode;
    title?: string;
    content?: string;
    inkStrokes?: InkStroke[];
    originalImage?: string | null;
    conversionResult?: ConversionResult | null;
    tags?: string[];
  }) => Promise<NotePage | null>;

  updatePageContent: (
    pageId: string,
    patch: Partial<Pick<NotePage, 'title' | 'content' | 'tags'>>
  ) => void;

  savePageInk: (pageId: string, strokes: InkStroke[]) => void;
  deletePage: (pageId: string) => Promise<void>;
  convertPage: (pageId: string) => Promise<ConversionResult | null>;
}

const pageTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPageCallbacks = new Map<string, () => Promise<void>>();

function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#141A16' : '#F6EFE4');
  }
}

function formatCloudErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Cloud database sync unavailable.';
  if (/relation .* does not exist|schema cache|42P01/i.test(msg)) {
    return 'Database tables (notebooks/note_pages) not applied yet. Run migration SQL in Supabase.';
  }
  return msg;
}

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(
  localItems: T[],
  remoteItems: T[],
  isLocalUnsynced: (item: T) => boolean,
): { merged: T[]; toPush: T[] } {
  const remoteMap = new Map(remoteItems.map((r) => [r.id, r]));
  const localMap = new Map(localItems.map((l) => [l.id, l]));
  const merged: T[] = [];
  const toPush: T[] = [];

  for (const remote of remoteItems) {
    const local = localMap.get(remote.id);
    if (local && local.updatedAt > remote.updatedAt && isLocalUnsynced(local)) {
      merged.push(local);
      toPush.push(local);
    } else {
      merged.push(remote);
    }
  }

  for (const local of localItems) {
    if (!remoteMap.has(local.id) && isLocalUnsynced(local)) {
      merged.push(local);
      toPush.push(local);
    }
  }

  return {
    merged: merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    toPush,
  };
}

export const useNotesStore = create<NotesState>((set, get) => ({
  hasCompletedOnboarding: readOnboardingFlag(),
  notebooks: [],
  pages: [],
  shelves: readShelvesFlag(),
  isInitialized: false,
  isLoading: true,
  storageError: null,
  saveState: 'idle',
  lastSavedAt: null,
  cloudSyncState: getSignedInUserId() ? 'syncing' : 'local',
  cloudSyncMessage: null,
  lastSyncedAt: null,

  theme: readThemeFlag(),
  shelfFilter: 'All',
  activeScreen: 'shelf',
  activeNotebookId: null,
  activePageId: null,
  editorMode: 'typing',
  pageSearchQuery: '',
  isConverting: false,

  initialize: async () => {
    if (get().isInitialized) return;
    const savedTheme = readThemeFlag();
    set({ isLoading: true, storageError: null, theme: savedTheme });
    applyThemeToDom(savedTheme);

    try {
      await storageAdapter.init();
      const { notebooks, pages } = await storageAdapter.seedIfEmpty([], []);

      const sortedNotebooks = [...notebooks].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
      const sortedPages = [...pages].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );

      const nextShelves = readShelvesFlag(sortedNotebooks);
      writeShelvesFlag(nextShelves);

      set({
        notebooks: sortedNotebooks,
        pages: sortedPages,
        shelves: nextShelves,
        isInitialized: true,
        isLoading: false,
        saveState: 'saved',
        lastSavedAt: new Date().toISOString(),
      });

      if (getSignedInUserId()) {
        await get().syncWithCloud();
      } else {
        set({ cloudSyncState: 'local', cloudSyncMessage: null });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'IndexedDB storage could not be initialized.';
      set({
        notebooks: [],
        pages: [],
        isInitialized: true,
        isLoading: false,
        storageError: `Local IndexedDB error: ${message}. Working in temporary session memory.`,
        saveState: 'error',
      });
    }
  },

  syncWithCloud: async () => {
    const userId = getSignedInUserId();
    if (!userId) {
      set({ cloudSyncState: 'local', cloudSyncMessage: null });
      return;
    }

    set({ cloudSyncState: 'syncing', cloudSyncMessage: null });

    try {
      const remote = await pullNotesFromDb(userId);
      const localNbs = get().notebooks;
      const localPages = get().pages;
      const localUnsyncedPageNbIds = new Set(
        localPages.filter((p) => p.syncStatus !== 'synced').map((p) => p.notebookId),
      );
      const remoteNbIds = new Set(remote.notebooks.map((n) => n.id));

      const nbMerge = mergeByUpdatedAt(
        localNbs,
        remote.notebooks,
        (nb) => !remoteNbIds.has(nb.id) || localUnsyncedPageNbIds.has(nb.id),
      );
      const pageMerge = mergeByUpdatedAt(
        localPages,
        remote.pages,
        (pg) => pg.syncStatus !== 'synced',
      );

      if (nbMerge.toPush.length > 0 || pageMerge.toPush.length > 0) {
        const pushNbMap = new Map(nbMerge.toPush.map((nb) => [nb.id, nb]));
        for (const pg of pageMerge.toPush) {
          const parent = nbMerge.merged.find((n) => n.id === pg.notebookId);
          if (parent && !pushNbMap.has(parent.id)) pushNbMap.set(parent.id, parent);
        }
        await pushNotebooksAndPagesToDb(
          userId,
          Array.from(pushNbMap.values()),
          pageMerge.toPush,
        );
      }

      const syncedPages: NotePage[] = pageMerge.merged.map((p) => ({
        ...p,
        syncStatus: 'synced',
      }));
      await storageAdapter.replaceAll(nbMerge.merged, syncedPages);

      const mergedShelves = normalizeShelfList(get().shelves, nbMerge.merged);
      writeShelvesFlag(mergedShelves);

      set({
        notebooks: nbMerge.merged,
        pages: syncedPages,
        shelves: mergedShelves,
        cloudSyncState: 'synced',
        cloudSyncMessage: null,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err) {
      set({
        cloudSyncState: 'error',
        cloudSyncMessage: formatCloudErrorMessage(err),
      });
    }
  },

  reloadForScope: async () => {
    await get().flushPendingSaves();
    const savedTheme = readThemeFlag();
    const savedShelves = readShelvesFlag();
    applyThemeToDom(savedTheme);
    set({
      notebooks: [],
      pages: [],
      shelves: savedShelves,
      shelfFilter: 'All',
      isInitialized: false,
      isLoading: true,
      activeScreen: 'shelf',
      activeNotebookId: null,
      activePageId: null,
      theme: savedTheme,
      cloudSyncState: getSignedInUserId() ? 'syncing' : 'local',
      cloudSyncMessage: null,
    });
    await get().initialize();
  },

  flushPendingSaves: async () => {
    const callbacks = Array.from(pendingPageCallbacks.values());
    for (const [key, timer] of pageTimers.entries()) {
      clearTimeout(timer);
      pageTimers.delete(key);
    }
    pendingPageCallbacks.clear();
    if (callbacks.length > 0) {
      await Promise.allSettled(callbacks.map((fn) => fn()));
    }
  },

  completeOnboarding: () => {
    writeOnboardingFlag(true);
    set({ hasCompletedOnboarding: true });
  },

  reopenOnboarding: () => {
    set({ hasCompletedOnboarding: false });
  },

  clearStorageError: () => set({ storageError: null }),

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'light' ? 'dark' : 'light';
    writeThemeFlag(next);
    applyThemeToDom(next);
    set({ theme: next });
  },

  setTheme: (theme) => {
    writeThemeFlag(theme);
    applyThemeToDom(theme);
    set({ theme });
  },

  setShelfFilter: (shelfFilter) => set({ shelfFilter }),

  createShelf: (name) => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed || trimmed.toLowerCase() === 'all') {
      return get().shelves[0] ?? 'Personal';
    }
    const existing = get().shelves.find(
      (s) => s.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;

    const nextShelves = [...get().shelves, trimmed];
    writeShelvesFlag(nextShelves);
    set({ shelves: nextShelves });
    return trimmed;
  },

  renameShelf: async (oldName, newName) => {
    const trimmed = newName.trim().slice(0, 60);
    if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed === oldName) return;

    const { shelves, notebooks, shelfFilter } = get();
    const withoutOld = shelves.map((s) => (s === oldName ? trimmed : s));
    const nextShelves = normalizeShelfList(withoutOld);
    writeShelvesFlag(nextShelves);

    const now = new Date().toISOString();
    const affected = notebooks
      .filter((n) => n.category === oldName)
      .map((n) => ({ ...n, category: trimmed, updatedAt: now }));

    set((state) => ({
      shelves: nextShelves,
      shelfFilter: shelfFilter === oldName ? trimmed : state.shelfFilter,
      notebooks: state.notebooks.map((n) =>
        n.category === oldName ? { ...n, category: trimmed, updatedAt: now } : n,
      ),
    }));

    if (affected.length > 0) {
      await Promise.all(affected.map((nb) => storageAdapter.updateNotebook(nb)));
      const userId = getSignedInUserId();
      if (userId) {
        try {
          set({ cloudSyncState: 'syncing' });
          await Promise.all(affected.map((nb) => upsertNotebookInDb(userId, nb)));
          set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
        } catch (err) {
          set({ cloudSyncState: 'error', cloudSyncMessage: formatCloudErrorMessage(err) });
        }
      }
    }
  },

  deleteShelf: async (name) => {
    const { shelves, notebooks, shelfFilter } = get();
    if (shelves.length <= 1) return;
    const nextShelves = shelves.filter((s) => s !== name);
    const fallback = nextShelves[0] ?? 'Personal';
    writeShelvesFlag(nextShelves);

    const now = new Date().toISOString();
    const affected = notebooks
      .filter((n) => n.category === name)
      .map((n) => ({ ...n, category: fallback, updatedAt: now }));

    set((state) => ({
      shelves: nextShelves,
      shelfFilter: shelfFilter === name ? 'All' : state.shelfFilter,
      notebooks: state.notebooks.map((n) =>
        n.category === name ? { ...n, category: fallback, updatedAt: now } : n,
      ),
    }));

    if (affected.length > 0) {
      await Promise.all(affected.map((nb) => storageAdapter.updateNotebook(nb)));
      const userId = getSignedInUserId();
      if (userId) {
        try {
          set({ cloudSyncState: 'syncing' });
          await Promise.all(affected.map((nb) => upsertNotebookInDb(userId, nb)));
          set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
        } catch (err) {
          set({ cloudSyncState: 'error', cloudSyncMessage: formatCloudErrorMessage(err) });
        }
      }
    }
  },

  openNotebook: (notebookId) => {
    const { pages } = get();
    const notebookPages = pages
      .filter((p) => p.notebookId === notebookId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const firstPage = notebookPages[0] ?? null;

    set({
      activeNotebookId: notebookId,
      activePageId: firstPage ? firstPage.id : null,
      activeScreen: 'notebook',
      pageSearchQuery: '',
      editorMode:
        firstPage && firstPage.inkStrokes.length > 0 && !firstPage.content.trim()
          ? 'ink'
          : 'typing',
    });
  },

  openPage: (pageId, preferredMode) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) return;
    set({
      activeNotebookId: page.notebookId,
      activePageId: page.id,
      activeScreen: 'editor',
      editorMode:
        preferredMode ??
        (page.inkStrokes.length > 0 && page.content.trim().length < 20
          ? 'ink'
          : 'typing'),
    });
  },

  goToShelf: () =>
    set({
      activeScreen: 'shelf',
    }),

  goToNotebook: () =>
    set({
      activeScreen: 'notebook',
    }),

  setEditorMode: (editorMode) => set({ editorMode }),

  setPageSearchQuery: (pageSearchQuery) => set({ pageSearchQuery }),

  createNotebook: async (input) => {
    const now = new Date().toISOString();
    const cleanCategory =
      input.category.trim().slice(0, 60) || get().shelves[0] || 'Personal';
    const nextShelves = normalizeShelfList([...get().shelves, cleanCategory]);
    writeShelvesFlag(nextShelves);
    const newNotebook: Notebook = {
      id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim() || 'Untitled Notebook',
      subtitle: input.subtitle?.trim() || undefined,
      category: cleanCategory,
      coverColor: input.coverColor,
      createdAt: now,
      updatedAt: now,
      pageIds: [],
    };
    set((state) => ({
      shelves: nextShelves,
      notebooks: [newNotebook, ...state.notebooks],
      saveState: 'saving',
    }));
    try {
      await storageAdapter.createNotebook(newNotebook);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await upsertNotebookInDb(userId, newNotebook);
        set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
      }
      set({ saveState: 'saved', lastSavedAt: now });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
    return newNotebook;
  },

  deleteNotebook: async (notebookId) => {
    set((state) => ({
      notebooks: state.notebooks.filter((n) => n.id !== notebookId),
      pages: state.pages.filter((p) => p.notebookId !== notebookId),
      activeNotebookId: state.activeNotebookId === notebookId ? null : state.activeNotebookId,
      activePageId:
        state.pages.find((p) => p.id === state.activePageId)?.notebookId === notebookId
          ? null
          : state.activePageId,
      activeScreen: state.activeNotebookId === notebookId ? 'shelf' : state.activeScreen,
      saveState: 'saving',
    }));
    try {
      await storageAdapter.deleteNotebook(notebookId);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await deleteNotebookInDb(userId, notebookId);
        set({
          cloudSyncState: 'synced',
          cloudSyncMessage: null,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      set({ saveState: 'saved', lastSavedAt: new Date().toISOString() });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
  },

  renameNotebook: async (notebookId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const current = get().notebooks.find((n) => n.id === notebookId);
    if (!current) return;

    const updated: Notebook = {
      ...current,
      title: trimmed,
      updatedAt: now,
    };

    set((state) => ({
      notebooks: state.notebooks.map((n) =>
        n.id === notebookId ? updated : n
      ),
      saveState: 'saving',
    }));

    try {
      await storageAdapter.updateNotebook(updated);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await upsertNotebookInDb(userId, updated);
        set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
      }
      set({ saveState: 'saved', lastSavedAt: now });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
  },

  changeNotebookColor: async (notebookId, coverColor) => {
    const now = new Date().toISOString();
    const current = get().notebooks.find((n) => n.id === notebookId);
    if (!current) return;

    const updated: Notebook = {
      ...current,
      coverColor,
      updatedAt: now,
    };

    set((state) => ({
      notebooks: state.notebooks.map((n) =>
        n.id === notebookId ? updated : n
      ),
      saveState: 'saving',
    }));

    try {
      await storageAdapter.updateNotebook(updated);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await upsertNotebookInDb(userId, updated);
        set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
      }
      set({ saveState: 'saved', lastSavedAt: now });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
  },

  moveNotebookCategory: async (notebookId, category) => {
    const now = new Date().toISOString();
    const cleanCategory =
      category.trim().slice(0, 60) || get().shelves[0] || 'Personal';
    const current = get().notebooks.find((n) => n.id === notebookId);
    if (!current) return;

    const nextShelves = normalizeShelfList([...get().shelves, cleanCategory]);
    writeShelvesFlag(nextShelves);

    const updated: Notebook = {
      ...current,
      category: cleanCategory,
      updatedAt: now,
    };

    set((state) => ({
      shelves: nextShelves,
      notebooks: state.notebooks.map((n) =>
        n.id === notebookId ? updated : n
      ),
      saveState: 'saving',
    }));

    try {
      await storageAdapter.updateNotebook(updated);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await upsertNotebookInDb(userId, updated);
        set({ cloudSyncState: 'synced', cloudSyncMessage: null, lastSyncedAt: now });
      }
      set({ saveState: 'saved', lastSavedAt: now });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
  },

  createNewPage: async (options) => {
    const state = get();
    const targetNotebookId =
      options?.notebookId ??
      state.activeNotebookId ??
      state.notebooks[0]?.id ??
      null;

    if (!targetNotebookId) return null;

    const now = new Date().toISOString();
    const newPage: NotePage = {
      id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      notebookId: targetNotebookId,
      title: options?.title ?? 'Untitled Note',
      content: options?.content ?? '',
      inkStrokes: options?.inkStrokes ?? [],
      originalImage: options?.originalImage ?? null,
      tags: options?.tags ?? [],
      conversionResult: options?.conversionResult ?? null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'local',
    };

    set((prev) => ({
      pages: [newPage, ...prev.pages],
      notebooks: prev.notebooks.map((nb) =>
        nb.id === targetNotebookId
          ? {
              ...nb,
              pageIds: [newPage.id, ...nb.pageIds],
              updatedAt: now,
            }
          : nb
      ),
      activeNotebookId: targetNotebookId,
      activePageId: newPage.id,
      activeScreen: 'editor',
      editorMode: options?.mode ?? 'typing',
      saveState: 'saving',
    }));

    try {
      await storageAdapter.createPage(newPage);
      const parentNb = get().notebooks.find((n) => n.id === targetNotebookId);
      if (parentNb) await storageAdapter.updateNotebook(parentNb);

      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        if (parentNb) await upsertNotebookInDb(userId, parentNb);
        await upsertPageInDb(userId, newPage);
        set((prev) => ({
          pages: prev.pages.map((p) => (p.id === newPage.id ? { ...p, syncStatus: 'synced' } : p)),
          cloudSyncState: 'synced',
          cloudSyncMessage: null,
          lastSyncedAt: now,
        }));
      }
      set({ saveState: 'saved', lastSavedAt: now });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }

    return newPage;
  },

  updatePageContent: (pageId, patch) => {
    const now = new Date().toISOString();

    set((state) => {
      const targetPage = state.pages.find((p) => p.id === pageId);
      return {
        pages: state.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                ...patch,
                updatedAt: now,
                syncStatus: 'local',
              }
            : p
        ),
        notebooks: targetPage
          ? state.notebooks.map((nb) =>
              nb.id === targetPage.notebookId
                ? { ...nb, updatedAt: now }
                : nb
            )
          : state.notebooks,
        saveState: 'saving',
      };
    });

    const key = `content:${pageId}`;
    const existingTimer = pageTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const persist = async () => {
      pageTimers.delete(key);
      pendingPageCallbacks.delete(key);
      const latestPage = get().pages.find((p) => p.id === pageId);
      if (!latestPage) return;
      try {
        await storageAdapter.updatePage(latestPage);
        const parentNb = get().notebooks.find(
          (n) => n.id === latestPage.notebookId
        );
        if (parentNb) {
          await storageAdapter.updateNotebook(parentNb);
        }
        const userId = getSignedInUserId();
        if (userId) {
          set({ cloudSyncState: 'syncing' });
          if (parentNb) await upsertNotebookInDb(userId, parentNb);
          await upsertPageInDb(userId, latestPage);
          const syncedPage: NotePage = { ...latestPage, syncStatus: 'synced' };
          await storageAdapter.updatePage(syncedPage);
          set((prev) => ({
            pages: prev.pages.map((p) => (p.id === pageId ? syncedPage : p)),
            cloudSyncState: 'synced',
            cloudSyncMessage: null,
            lastSyncedAt: new Date().toISOString(),
          }));
        }
        set({ saveState: 'saved', lastSavedAt: new Date().toISOString() });
      } catch (err) {
        const msg = formatCloudErrorMessage(err);
        set({
          saveState: getSignedInUserId() ? 'saved' : 'error',
          ...(getSignedInUserId()
            ? { cloudSyncState: 'error', cloudSyncMessage: msg }
            : { storageError: msg }),
        });
      }
    };

    pendingPageCallbacks.set(key, persist);
    pageTimers.set(key, setTimeout(persist, 320));
  },

  savePageInk: (pageId, inkStrokes) => {
    const now = new Date().toISOString();

    set((state) => {
      const targetPage = state.pages.find((p) => p.id === pageId);
      return {
        pages: state.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                inkStrokes,
                updatedAt: now,
                syncStatus: 'local',
              }
            : p
        ),
        notebooks: targetPage
          ? state.notebooks.map((nb) =>
              nb.id === targetPage.notebookId
                ? { ...nb, updatedAt: now }
                : nb
            )
          : state.notebooks,
        saveState: 'saving',
      };
    });

    const key = `ink:${pageId}`;
    const existingTimer = pageTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const persist = async () => {
      pageTimers.delete(key);
      pendingPageCallbacks.delete(key);
      const latestPage = get().pages.find((p) => p.id === pageId);
      if (!latestPage) return;
      try {
        await storageAdapter.saveInkStrokes(pageId, latestPage.inkStrokes);
        const parentNb = get().notebooks.find(
          (n) => n.id === latestPage.notebookId
        );
        if (parentNb) {
          await storageAdapter.updateNotebook(parentNb);
        }
        const userId = getSignedInUserId();
        if (userId) {
          set({ cloudSyncState: 'syncing' });
          if (parentNb) await upsertNotebookInDb(userId, parentNb);
          await upsertPageInDb(userId, latestPage);
          const syncedPage: NotePage = { ...latestPage, syncStatus: 'synced' };
          await storageAdapter.updatePage(syncedPage);
          set((prev) => ({
            pages: prev.pages.map((p) => (p.id === pageId ? syncedPage : p)),
            cloudSyncState: 'synced',
            cloudSyncMessage: null,
            lastSyncedAt: new Date().toISOString(),
          }));
        }
        set({ saveState: 'saved', lastSavedAt: new Date().toISOString() });
      } catch (err) {
        const msg = formatCloudErrorMessage(err);
        set({
          saveState: getSignedInUserId() ? 'saved' : 'error',
          ...(getSignedInUserId()
            ? { cloudSyncState: 'error', cloudSyncMessage: msg }
            : { storageError: msg }),
        });
      }
    };

    pendingPageCallbacks.set(key, persist);
    pageTimers.set(key, setTimeout(persist, 240));
  },

  deletePage: async (pageId) => {
    for (const prefix of ['content:', 'ink:']) {
      const key = `${prefix}${pageId}`;
      const timer = pageTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        pageTimers.delete(key);
      }
      pendingPageCallbacks.delete(key);
    }

    const state = get();
    const target = state.pages.find((p) => p.id === pageId);
    if (!target) return;

    const remainingInNotebook = state.pages
      .filter((p) => p.notebookId === target.notebookId && p.id !== pageId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    set((prev) => ({
      pages: prev.pages.filter((p) => p.id !== pageId),
      notebooks: prev.notebooks.map((nb) =>
        nb.id === target.notebookId
          ? {
              ...nb,
              pageIds: nb.pageIds.filter((id) => id !== pageId),
              updatedAt: new Date().toISOString(),
            }
          : nb
      ),
      activePageId:
        prev.activePageId === pageId
          ? remainingInNotebook[0]?.id ?? null
          : prev.activePageId,
      activeScreen:
        prev.activeScreen === 'editor' && remainingInNotebook.length === 0
          ? 'notebook'
          : prev.activeScreen,
      saveState: 'saving',
    }));

    try {
      await storageAdapter.deletePage(pageId);
      const userId = getSignedInUserId();
      if (userId) {
        set({ cloudSyncState: 'syncing' });
        await deletePageInDb(userId, pageId);
        const parentNb = get().notebooks.find((n) => n.id === target.notebookId);
        if (parentNb) await upsertNotebookInDb(userId, parentNb);
        set({
          cloudSyncState: 'synced',
          cloudSyncMessage: null,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      set({ saveState: 'saved', lastSavedAt: new Date().toISOString() });
    } catch (err) {
      const msg = formatCloudErrorMessage(err);
      set({
        saveState: getSignedInUserId() ? 'saved' : 'error',
        ...(getSignedInUserId()
          ? { cloudSyncState: 'error', cloudSyncMessage: msg }
          : { storageError: msg }),
      });
    }
  },

  convertPage: async (pageId) => {
    const state = get();
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return null;
    const notebook = state.notebooks.find((n) => n.id === page.notebookId);

    set({ isConverting: true });

    try {
      const result = await organizeNote({
        pageId: page.id,
        currentTitle: page.title,
        notebookTitle: notebook?.title ?? 'Personal Shelf',
        typedContent: page.content,
        inkStrokes: page.inkStrokes,
        originalImage: page.originalImage,
      });

      const now = new Date().toISOString();
      set((prev) => ({
        pages: prev.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                conversionResult: result,
                updatedAt: now,
                syncStatus: 'local',
              }
            : p
        ),
        isConverting: false,
        saveState: 'saving',
      }));

      await storageAdapter.saveConversionResult(pageId, result);
      const userId = getSignedInUserId();
      const latestPage = get().pages.find((p) => p.id === pageId);
      if (userId && latestPage) {
        try {
          set({ cloudSyncState: 'syncing' });
          await upsertPageInDb(userId, latestPage);
          const syncedPage: NotePage = { ...latestPage, syncStatus: 'synced' };
          await storageAdapter.updatePage(syncedPage);
          set((prev) => ({
            pages: prev.pages.map((p) => (p.id === pageId ? syncedPage : p)),
            cloudSyncState: 'synced',
            cloudSyncMessage: null,
            lastSyncedAt: now,
          }));
        } catch (syncErr) {
          set({
            cloudSyncState: 'error',
            cloudSyncMessage: formatCloudErrorMessage(syncErr),
          });
        }
      }
      set({ saveState: 'saved', lastSavedAt: now });
      return result;
    } catch (err) {
      set({
        isConverting: false,
        saveState: 'error',
        storageError:
          err instanceof Error
            ? err.message
            : 'Handwriting OCR conversion failed.',
      });
      return null;
    }
  },
}));
