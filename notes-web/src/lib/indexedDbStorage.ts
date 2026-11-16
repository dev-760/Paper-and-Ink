import {
  claimLegacyGuestNamespaceOnce,
  getActiveAccountScope,
} from '@paper-and-ink/auth';
import type { Notebook } from '../types/notebook';
import type { ConversionResult, NotePage } from '../types/note';
import type { InkStroke } from '../types/ink';
import type { NotesStorageAdapter } from './storage';

const LEGACY_DB_NAME = 'paper-and-ink-notes-db';
const DB_VERSION = 1;
const STORE_NOTEBOOKS = 'notebooks';
const STORE_PAGES = 'pages';

function dbNameForScope(scope: string): string {
  return scope === 'guest' ? LEGACY_DB_NAME : `${LEGACY_DB_NAME}_${scope}`;
}

function openDatabaseByName(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser environment.'));
      return;
    }

    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PAGES)) {
        const pageStore = db.createObjectStore(STORE_PAGES, { keyPath: 'id' });
        pageStore.createIndex('notebookId', 'notebookId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB database.'));
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

const migratedScopes = new Set<string>();

export class IndexedDbStorageAdapter implements NotesStorageAdapter {
  private dbs = new Map<string, Promise<IDBDatabase>>();

  private async getDb(): Promise<IDBDatabase> {
    const scope = getActiveAccountScope();
    const dbName = dbNameForScope(scope);
    let dbPromise = this.dbs.get(dbName);
    if (!dbPromise) {
      dbPromise = openDatabaseByName(dbName);
      this.dbs.set(dbName, dbPromise);
    }
    const db = await dbPromise;

    if (scope !== 'guest' && !migratedScopes.has(scope)) {
      migratedScopes.add(scope);
      if (claimLegacyGuestNamespaceOnce(scope)) {
        try {
          const checkTx = db.transaction(STORE_NOTEBOOKS, 'readonly');
          const existingNbs = (await reqToPromise(
            checkTx.objectStore(STORE_NOTEBOOKS).getAll(),
          )) as Notebook[];
          await txDone(checkTx);

          if (existingNbs.length === 0) {
            const legacyDb = await openDatabaseByName(LEGACY_DB_NAME);
            const rTx = legacyDb.transaction([STORE_NOTEBOOKS, STORE_PAGES], 'readonly');
            const [legacyNbs, legacyPages] = await Promise.all([
              reqToPromise(rTx.objectStore(STORE_NOTEBOOKS).getAll()) as Promise<Notebook[]>,
              reqToPromise(rTx.objectStore(STORE_PAGES).getAll()) as Promise<NotePage[]>,
            ]);
            await txDone(rTx);
            legacyDb.close();

            if (legacyNbs.length > 0 || legacyPages.length > 0) {
              const wTx = db.transaction([STORE_NOTEBOOKS, STORE_PAGES], 'readwrite');
              for (const nb of legacyNbs) wTx.objectStore(STORE_NOTEBOOKS).put(nb);
              for (const pg of legacyPages) wTx.objectStore(STORE_PAGES).put(pg);
              await txDone(wTx);
            }
          }
        } catch {
          // Non-fatal fallback: user DB will seed cleanly
        }
      }
    }

    return db;
  }

  async init(): Promise<void> {
    await this.getDb();
  }

  async getAllNotebooks(): Promise<Notebook[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
    const store = tx.objectStore(STORE_NOTEBOOKS);
    const items = (await reqToPromise(store.getAll())) as Notebook[];
    await txDone(tx);
    return items;
  }

  async createNotebook(notebook: Notebook): Promise<Notebook> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    tx.objectStore(STORE_NOTEBOOKS).put(notebook);
    await txDone(tx);
    return notebook;
  }

  async updateNotebook(notebook: Notebook): Promise<Notebook> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    tx.objectStore(STORE_NOTEBOOKS).put(notebook);
    await txDone(tx);
    return notebook;
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    const db = await this.getDb();
    const pages = await this.getPagesByNotebook(notebookId);
    const tx = db.transaction([STORE_NOTEBOOKS, STORE_PAGES], 'readwrite');
    tx.objectStore(STORE_NOTEBOOKS).delete(notebookId);
    const pageStore = tx.objectStore(STORE_PAGES);
    for (const p of pages) {
      pageStore.delete(p.id);
    }
    await txDone(tx);
  }

  async getAllPages(): Promise<NotePage[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_PAGES, 'readonly');
    const store = tx.objectStore(STORE_PAGES);
    const items = (await reqToPromise(store.getAll())) as NotePage[];
    await txDone(tx);
    return items;
  }

  async getPagesByNotebook(notebookId: string): Promise<NotePage[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_PAGES, 'readonly');
    const index = tx.objectStore(STORE_PAGES).index('notebookId');
    const items = (await reqToPromise(index.getAll(notebookId))) as NotePage[];
    await txDone(tx);
    return items;
  }

  async getPage(pageId: string): Promise<NotePage | null> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_PAGES, 'readonly');
    const item = (await reqToPromise(
      tx.objectStore(STORE_PAGES).get(pageId)
    )) as NotePage | undefined;
    await txDone(tx);
    return item ?? null;
  }

  async createPage(page: NotePage): Promise<NotePage> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_PAGES, STORE_NOTEBOOKS], 'readwrite');
    tx.objectStore(STORE_PAGES).put(page);

    const nbStore = tx.objectStore(STORE_NOTEBOOKS);
    const nb = (await reqToPromise(nbStore.get(page.notebookId))) as
      | Notebook
      | undefined;
    if (nb && !nb.pageIds.includes(page.id)) {
      nbStore.put({
        ...nb,
        pageIds: [page.id, ...nb.pageIds],
        updatedAt: page.updatedAt,
      });
    }

    await txDone(tx);
    return page;
  }

  async updatePage(page: NotePage): Promise<NotePage> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_PAGES, 'readwrite');
    tx.objectStore(STORE_PAGES).put(page);
    await txDone(tx);
    return page;
  }

  async deletePage(pageId: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_PAGES, STORE_NOTEBOOKS], 'readwrite');
    const pageStore = tx.objectStore(STORE_PAGES);
    const existing = (await reqToPromise(pageStore.get(pageId))) as
      | NotePage
      | undefined;

    pageStore.delete(pageId);

    if (existing) {
      const nbStore = tx.objectStore(STORE_NOTEBOOKS);
      const nb = (await reqToPromise(nbStore.get(existing.notebookId))) as
        | Notebook
        | undefined;
      if (nb) {
        nbStore.put({
          ...nb,
          pageIds: nb.pageIds.filter((id) => id !== pageId),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await txDone(tx);
  }

  async saveInkStrokes(pageId: string, strokes: InkStroke[]): Promise<NotePage> {
    const existing = await this.getPage(pageId);
    if (!existing) {
      throw new Error(`Cannot save ink strokes: page "${pageId}" not found.`);
    }
    const updated: NotePage = {
      ...existing,
      inkStrokes: strokes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    };
    return this.updatePage(updated);
  }

  async saveConversionResult(
    pageId: string,
    result: ConversionResult
  ): Promise<NotePage> {
    const existing = await this.getPage(pageId);
    if (!existing) {
      throw new Error(
        `Cannot save conversion result: page "${pageId}" not found.`
      );
    }
    // Critical preservation rule: never overwrite existing inkStrokes or originalImage
    const updated: NotePage = {
      ...existing,
      conversionResult: result,
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    };
    return this.updatePage(updated);
  }

  async seedIfEmpty(
    seedNotebooks: Notebook[],
    seedPages: NotePage[]
  ): Promise<{ notebooks: Notebook[]; pages: NotePage[] }> {
    const existingNotebooks = await this.getAllNotebooks();
    const existingPages = await this.getAllPages();

    if (existingNotebooks.length > 0 || existingPages.length > 0) {
      return { notebooks: existingNotebooks, pages: existingPages };
    }

    const db = await this.getDb();
    const tx = db.transaction([STORE_NOTEBOOKS, STORE_PAGES], 'readwrite');
    const nbStore = tx.objectStore(STORE_NOTEBOOKS);
    const pageStore = tx.objectStore(STORE_PAGES);

    for (const nb of seedNotebooks) {
      nbStore.put(nb);
    }
    for (const page of seedPages) {
      pageStore.put(page);
    }

    await txDone(tx);
    return { notebooks: seedNotebooks, pages: seedPages };
  }

  async replaceAll(notebooks: Notebook[], pages: NotePage[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_NOTEBOOKS, STORE_PAGES], 'readwrite');
    const nbStore = tx.objectStore(STORE_NOTEBOOKS);
    const pageStore = tx.objectStore(STORE_PAGES);

    nbStore.clear();
    pageStore.clear();
    for (const nb of notebooks) nbStore.put(nb);
    for (const pg of pages) pageStore.put(pg);

    await txDone(tx);
  }
}

export const storageAdapter: NotesStorageAdapter = new IndexedDbStorageAdapter();
