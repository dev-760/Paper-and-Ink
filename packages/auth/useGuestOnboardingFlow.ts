import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaperInkAuthState } from './usePaperInkAuth';

function readGuestDismissed(appId: string): boolean {
  try {
    return window.sessionStorage.getItem(`paper_and_ink:guest_gate_done:${appId}`) === 'true';
  } catch {
    return false;
  }
}

function writeGuestDismissed(appId: string, dismissed: boolean): void {
  try {
    const key = `paper_and_ink:guest_gate_done:${appId}`;
    if (dismissed) {
      window.sessionStorage.setItem(key, 'true');
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

export interface GuestOnboardingFlow {
  /** Whether the unified welcome & account onboarding modal is active. */
  showOnboarding: boolean;
  finishOnboarding: () => void;
  continueAsGuest: () => void;
  openManualOnboarding: () => void;
}

/**
 * Coordinates the unified Paper & Ink welcome & account flow across apps:
 * 1. If not signed in (and not already continued as guest in this browser session),
 *    opens the unified onboarding modal containing the app slides + Sign In / Create Account.
 * 2. Signing in or entering as guest enters the workspace cleanly; signing out resets it.
 */
export function useGuestOnboardingFlow(
  appId: string,
  auth: PaperInkAuthState,
): GuestOnboardingFlow {
  const [guestDismissed, setGuestDismissed] = useState<boolean>(() => readGuestDismissed(appId));
  const [manualOnboarding, setManualOnboarding] = useState(false);
  const prevProfileRef = useRef<string | null>(auth.profile?.id ?? null);

  // Reset welcome gate back to onboarding when a user explicitly signs out.
  useEffect(() => {
    const currentId = auth.profile?.id ?? null;
    if (prevProfileRef.current && !currentId) {
      writeGuestDismissed(appId, false);
      setGuestDismissed(false);
      setManualOnboarding(false);
    }
    prevProfileRef.current = currentId;
  }, [appId, auth.profile?.id]);

  const finishOnboarding = useCallback(() => {
    setManualOnboarding(false);
    if (!auth.profile) {
      writeGuestDismissed(appId, true);
      setGuestDismissed(true);
    }
  }, [appId, auth.profile]);

  const continueAsGuest = useCallback(() => {
    writeGuestDismissed(appId, true);
    setGuestDismissed(true);
    setManualOnboarding(false);
  }, [appId]);

  const openManualOnboarding = useCallback(() => {
    setManualOnboarding(true);
  }, []);

  const isUnauthenticatedReady = !auth.isLoading && !auth.profile;
  const showOnboarding = manualOnboarding || (isUnauthenticatedReady && !guestDismissed);

  return {
    showOnboarding,
    finishOnboarding,
    continueAsGuest,
    openManualOnboarding,
  };
}
