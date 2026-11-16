import {
  claimLegacyGuestNamespaceOnce,
  getActiveAccountScope,
  scopedStorageKey,
} from '@paper-and-ink/auth';

export const STORAGE_KEYS = {
  PREFERENCES: 'paper_and_ink_news:preferences_v1',
  READING_LIST: 'paper_and_ink_news:reading_list_v1',
  SAVED_STORIES: 'paper_and_ink_news:saved_stories_v1',
  THEME: 'paper_and_ink_news:theme_v1',
  TYPOGRAPHY: 'paper_and_ink_news:typography_v1',
} as const;

const memoryFallback = new Map<string, string>();
const migratedScopes = new Set<string>();

function resolveScopedKey(baseKey: string): string {
  const scope = getActiveAccountScope();
  if (scope !== 'guest' && !migratedScopes.has(scope)) {
    migratedScopes.add(scope);
    if (claimLegacyGuestNamespaceOnce(scope)) {
      try {
        for (const k of Object.values(STORAGE_KEYS)) {
          const target = scopedStorageKey(k, scope);
          const legacyVal = window.localStorage.getItem(k);
          if (legacyVal !== null && window.localStorage.getItem(target) === null) {
            window.localStorage.setItem(target, legacyVal);
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
  }
  return scope === 'guest' ? baseKey : scopedStorageKey(baseKey, scope);
}

export const storageAdapter = {
  getItem(key: string): string | null {
    const resolved = resolveScopedKey(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(resolved);
        return val ?? memoryFallback.get(resolved) ?? null;
      }
    } catch {
      // Fallback to memory when localStorage is blocked
    }
    return memoryFallback.get(resolved) ?? null;
  },

  setItem(key: string, value: string): void {
    const resolved = resolveScopedKey(key);
    memoryFallback.set(resolved, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(resolved, value);
      }
    } catch {
      // Quota or privacy-mode fallback
    }
  },
};
