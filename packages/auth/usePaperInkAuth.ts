import { useCallback, useEffect, useState } from 'react';
import {
  fetchCurrentProfile,
  loginWithUsername,
  readCachedProfile,
  registerWithUsername,
  signOutAccount,
  updateUserProfile,
} from './authApi';
import {
  getActiveAccountScope,
  onAccountScopeChange,
  setActiveAccountScope,
} from './accountScope';
import type { LoginInput, RegisterInput, UpdateProfileInput, UserProfile } from './types';

export interface PaperInkAuthState {
  profile: UserProfile | null;
  accountScope: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<UserProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePaperInkAuth(): PaperInkAuthState {
  const [profile, setProfile] = useState<UserProfile | null>(() => readCachedProfile());
  const [accountScope, setAccountScope] = useState<string>(() => getActiveAccountScope());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncScopeFromProfile = useCallback((nextProfile: UserProfile | null) => {
    setProfile(nextProfile);
    const scope = setActiveAccountScope(nextProfile?.id ?? null);
    setAccountScope(scope);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const current = await fetchCurrentProfile();
      syncScopeFromProfile(current);
    } finally {
      setIsLoading(false);
    }
  }, [syncScopeFromProfile]);

  useEffect(() => {
    void refresh();
    return onAccountScopeChange((scope) => {
      setAccountScope(scope);
    });
  }, [refresh]);

  const login = useCallback(
    async (input: LoginInput): Promise<UserProfile> => {
      const payload = await loginWithUsername(input);
      syncScopeFromProfile(payload.profile);
      return payload.profile;
    },
    [syncScopeFromProfile],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<UserProfile> => {
      const payload = await registerWithUsername(input);
      syncScopeFromProfile(payload.profile);
      return payload.profile;
    },
    [syncScopeFromProfile],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<UserProfile> => {
      const updated = await updateUserProfile(input);
      syncScopeFromProfile(updated);
      return updated;
    },
    [syncScopeFromProfile],
  );

  const logout = useCallback(async () => {
    await signOutAccount();
    syncScopeFromProfile(null);
  }, [syncScopeFromProfile]);

  return {
    profile,
    accountScope,
    isLoading,
    isAuthenticated: Boolean(profile),
    login,
    register,
    updateProfile,
    logout,
    refresh,
  };
}
