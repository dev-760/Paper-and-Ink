import { getSupabaseBrowserClient } from './supabaseClient';
import type { AuthPayload, AuthSession, LoginInput, RegisterInput, UpdateProfileInput, UserProfile } from './types';

const OFFLINE_PROFILE_CACHE_KEY = 'paper_and_ink:cached_auth_profile';
const SESSION_FALLBACK_KEY = 'paper_and_ink:auth_session';

function getApiBaseUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return (metaEnv.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Authentication request failed.');
  }
  return data as T;
}

export function saveCachedProfile(profile: UserProfile | null): void {
  try {
    if (profile) {
      window.localStorage.setItem(OFFLINE_PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(OFFLINE_PROFILE_CACHE_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

export function readCachedProfile(): UserProfile | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveFallbackSession(session: AuthSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_FALLBACK_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_FALLBACK_KEY);
    }
  } catch {
    // ignore
  }
}

export function readFallbackSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

async function applySessionToClient(session: AuthSession): Promise<void> {
  saveFallbackSession(session);
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }
}

export async function getActiveAccessToken(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (client) {
    const { data } = await client.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
    const fallback = readFallbackSession();
    if (fallback?.access_token && fallback?.refresh_token) {
      await client.auth.setSession({
        access_token: fallback.access_token,
        refresh_token: fallback.refresh_token,
      }).catch(() => undefined);
      return fallback.access_token;
    }
  }
  return readFallbackSession()?.access_token ?? null;
}

export async function registerWithUsername(input: RegisterInput): Promise<AuthPayload> {
  const payload = await requestJson<AuthPayload>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username,
      name: input.name,
      password: input.password,
      avatarDataUrl: input.avatarDataUrl || undefined,
    }),
  });
  await applySessionToClient(payload.session);
  saveCachedProfile(payload.profile);
  return payload;
}

export async function loginWithUsername(input: LoginInput): Promise<AuthPayload> {
  const payload = await requestJson<AuthPayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username,
      password: input.password,
    }),
  });
  await applySessionToClient(payload.session);
  saveCachedProfile(payload.profile);
  return payload;
}

export async function fetchCurrentProfile(): Promise<UserProfile | null> {
  const token = await getActiveAccessToken();
  if (!token) return null;

  try {
    const res = await requestJson<{ profile: UserProfile }>('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    saveCachedProfile(res.profile);
    return res.profile;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/invalid or expired|authentication required|not found/i.test(msg)) {
      await signOutAccount();
      return null;
    }
    // Offline/API unavailable: return cached identity so local Notes & Reader keep working seamlessly.
    return readCachedProfile();
  }
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const token = await getActiveAccessToken();
  if (!token) {
    throw new Error('Sign in required to update profile.');
  }
  const res = await requestJson<{ profile: UserProfile }>('/api/auth/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  saveCachedProfile(res.profile);
  return res.profile;
}

export async function signOutAccount(): Promise<void> {
  saveCachedProfile(null);
  saveFallbackSession(null);
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.signOut().catch(() => undefined);
  }
}
