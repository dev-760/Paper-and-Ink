const ACTIVE_SCOPE_KEY = 'paper_and_ink:active_account_scope';
const CLAIMED_GUEST_KEY = 'paper_and_ink:legacy_guest_claimed_by';

type ScopeListener = (scope: string) => void;
const listeners = new Set<ScopeListener>();

export function scopeForUserId(userId?: string | null): string {
  return userId ? `user_${userId}` : 'guest';
}

export function getActiveAccountScope(): string {
  try {
    return window.localStorage.getItem(ACTIVE_SCOPE_KEY) || 'guest';
  } catch {
    return 'guest';
  }
}

export function setActiveAccountScope(userId?: string | null): string {
  const nextScope = scopeForUserId(userId);
  const current = getActiveAccountScope();
  try {
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, nextScope);
  } catch {
    // ignore storage quota / private mode
  }
  if (current !== nextScope) {
    for (const listener of listeners) {
      listener(nextScope);
    }
  }
  return nextScope;
}

export function onAccountScopeChange(listener: ScopeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function scopedStorageKey(baseKey: string, scope = getActiveAccountScope()): string {
  return `${baseKey}::${scope}`;
}

/**
 * Ensures pre-auth guest/legacy data can be claimed safely at most once by the first
 * authenticated user if that user has not initialized their own local namespace yet.
 * Subsequent accounts always start isolated so users never inherit another user's local data.
 */
export function claimLegacyGuestNamespaceOnce(userScope: string): boolean {
  if (userScope === 'guest') return false;
  try {
    const claimedBy = window.localStorage.getItem(CLAIMED_GUEST_KEY);
    if (claimedBy && claimedBy !== userScope) {
      return false;
    }
    if (!claimedBy) {
      window.localStorage.setItem(CLAIMED_GUEST_KEY, userScope);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
