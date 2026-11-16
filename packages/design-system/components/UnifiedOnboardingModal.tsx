import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  LogIn,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { AuthModalProps, SharedUserProfile } from './AuthModal';

export interface UnifiedOnboardingSlide {
  title: string;
  body: string;
  footnote?: string;
  illustration?: React.ReactNode;
  content?: React.ReactNode;
}

export interface UnifiedOnboardingModalProps {
  open: boolean;
  appName: string;
  slides: UnifiedOnboardingSlide[];
  completeLabel?: string;
  isDark: boolean;
  onToggleDark?: () => void;
  profile: SharedUserProfile | null;
  onLogin: AuthModalProps['onLogin'];
  onRegister: AuthModalProps['onRegister'];
  onContinueAsGuest?: () => void;
  onComplete: () => void;
  authFootnote?: string;
}

const LOGO_URL =
  'https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/Paper%20&%20Ink.png';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PAPER_GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.032'/%3E%3C/svg%3E\")";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_MIME.has(file.type)) {
      reject(new Error('Please choose a PNG, JPEG, or WebP image.'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error('Profile photo must be 2 MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

const AccountCrestIllustration: React.FC = () => (
  <svg viewBox="0 0 180 68" fill="none" aria-hidden="true" className="w-36 h-16 mx-auto">
    <line
      x1="22"
      y1="52"
      x2="158"
      y2="52"
      stroke="currentColor"
      strokeOpacity="0.22"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    <rect
      x="56"
      y="10"
      width="68"
      height="42"
      rx="6"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <circle
      cx="90"
      cy="31"
      r="11"
      stroke="var(--accent-primary, var(--pi-accent, #C4572F))"
      strokeWidth="1.35"
    />
    <path
      d="M86 31.5L89 34.5L94.5 28"
      stroke="var(--accent-primary, var(--pi-accent, #C4572F))"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UnifiedOnboardingModal: React.FC<UnifiedOnboardingModalProps> = ({
  open,
  appName: _appName,
  slides,
  completeLabel = 'Open app',
  isDark,
  profile,
  onLogin,
  onRegister,
  onContinueAsGuest,
  onComplete,
  authFootnote = 'Username & password only — no email or phone required.',
}) => {
  const includeAuthStep = !profile;
  const totalSteps = slides.length + (includeAuthStep ? 1 : 0);

  const [stepIndex, setStepIndex] = useState(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setAuthError(null);
    setPassword('');
  }, [open]);

  const clampedIndex = Math.min(stepIndex, Math.max(0, totalSteps - 1));
  const isAuthStep = includeAuthStep && clampedIndex === slides.length;
  const isLastSlideBeforeDone = !includeAuthStep && clampedIndex === slides.length - 1;
  const activeSlide = !isAuthStep ? slides[clampedIndex] : null;

  const handleSkipOrClose = () => {
    if (includeAuthStep && !isAuthStep) {
      setStepIndex(slides.length);
      return;
    }
    if (includeAuthStep && onContinueAsGuest) {
      onContinueAsGuest();
    }
    onComplete();
  };

  const handleGuestEntry = () => {
    onContinueAsGuest?.();
    onComplete();
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        handleSkipOrClose();
        return;
      }
      if (inField) return;
      if (e.key === 'ArrowRight') {
        setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (!open) return null;

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setAuthError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid photo selection.');
    }
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (authMode === 'login') {
        await onLogin({ username: username.trim().toLowerCase(), password });
      } else {
        await onRegister({
          username: username.trim().toLowerCase(),
          name: displayName.trim(),
          password,
          avatarDataUrl,
        });
      }
      setPassword('');
      onComplete();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not complete authentication.');
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-paper, var(--pi-bg, #F6EFE4))',
    borderColor: 'var(--border-strong, var(--pi-border-strong, rgba(31, 42, 58, 0.2)))',
    color: 'var(--text-primary, var(--pi-text, #1F2A3A))',
  };

  const outlineButtonStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-paper, var(--pi-bg, #F6EFE4))',
    borderColor: 'var(--border-strong, var(--pi-border-strong, rgba(31, 42, 58, 0.22)))',
    color: 'var(--text-primary, var(--pi-text, #1F2A3A))',
  };

  const darkButtonStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-toolbar, var(--pi-text, #1F2A3A))',
    color: 'var(--text-on-toolbar, var(--pi-bg, #F6EFE4))',
    boxShadow: 'var(--pi-shadow-soft)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pi-unified-onboarding-title"
      className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-[2px]"
      style={{
        backgroundColor: isDark
          ? 'var(--bg-scrim, rgba(7, 10, 8, 0.72))'
          : 'var(--bg-scrim, rgba(20, 26, 22, 0.42))',
      }}
      onClick={handleSkipOrClose}
    >
      <div className="flex min-h-full items-center justify-center p-3.5 sm:p-6">
        <div className="w-full max-w-[508px]" onClick={(e) => e.stopPropagation()}>
          <div
            className="relative overflow-hidden rounded-[24px] border p-5 sm:p-8"
            style={{
              backgroundColor: 'var(--bg-paper-elevated, var(--pi-surface, #FBF7F0))',
              backgroundImage: PAPER_GRAIN_BG,
              borderColor: 'var(--border-hairline, var(--pi-border, rgba(31, 42, 58, 0.12)))',
              color: 'var(--text-primary, var(--pi-text, #1F2A3A))',
              boxShadow: 'var(--toolbar-shadow, var(--pi-shadow-float))',
              fontFamily: 'var(--pi-font-sans)',
            }}
          >
            {/* Blind-debossed inner stationery frame */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-3 rounded-[16px] border"
              style={{
                borderColor:
                  'var(--border-hairline, var(--pi-border, rgba(31, 42, 58, 0.11)))',
              }}
            />

            <div className="relative z-10 flex flex-col">
              {/* Greeting Card Top Header: Wordmark logo + Close */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={LOGO_URL}
                    alt="Paper & Ink"
                    className="h-7 w-7 shrink-0 rounded-full object-cover border"
                    style={{
                      borderColor: 'var(--border-hairline, var(--pi-border, rgba(31, 42, 58, 0.12)))',
                    }}
                  />
                  <span
                    className="truncate text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                  >
                    Paper &amp; Ink
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 -mr-1.5 -mt-1.5">
                  <button
                    type="button"
                    aria-label={
                      includeAuthStep && !isAuthStep
                        ? 'Skip to sign in'
                        : 'Close onboarding dialog'
                    }
                    onClick={handleSkipOrClose}
                    className="pi-focus-ring inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isAuthStep ? (
                /* Integrated Stationery Sign In / Create Account Step */
                <div className="mt-3">
                  <div className="py-1">
                    <AccountCrestIllustration />
                  </div>

                  <div className="text-center px-1 sm:px-3">
                    <h1
                      id="pi-unified-onboarding-title"
                      className="text-[1.65rem] sm:text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em]"
                      style={{
                        fontFamily: 'var(--pi-font-serif, var(--pi-font-display))',
                        color: 'var(--text-primary, var(--pi-text))',
                      }}
                    >
                      {authMode === 'login' ? 'Sign in to your space' : 'Create your account'}
                    </h1>
                    <p
                      className="mt-1.5 text-[14.5px] leading-relaxed"
                      style={{
                        fontFamily: 'var(--pi-font-serif)',
                        color: 'var(--text-secondary, var(--pi-text-muted))',
                      }}
                    >
                      {authFootnote}
                    </p>
                  </div>

                  {/* Mode Segmented Toggle */}
                  <div
                    className="mt-4 grid grid-cols-2 rounded-full p-1 border"
                    style={{
                      backgroundColor: 'var(--bg-paper-subtle, var(--pi-surface-muted, #ECE3D4))',
                      borderColor: 'var(--border-hairline, var(--pi-border))',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className="pi-focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor:
                          authMode === 'login'
                            ? 'var(--bg-paper-elevated, var(--pi-surface, #FBF7F0))'
                            : 'transparent',
                        color:
                          authMode === 'login'
                            ? 'var(--text-primary, var(--pi-text))'
                            : 'var(--text-muted, var(--pi-text-muted))',
                        boxShadow: authMode === 'login' ? 'var(--pi-shadow-soft)' : undefined,
                      }}
                    >
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign in</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      className="pi-focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor:
                          authMode === 'register'
                            ? 'var(--bg-paper-elevated, var(--pi-surface, #FBF7F0))'
                            : 'transparent',
                        color:
                          authMode === 'register'
                            ? 'var(--text-primary, var(--pi-text))'
                            : 'var(--text-muted, var(--pi-text-muted))',
                        boxShadow: authMode === 'register' ? 'var(--pi-shadow-soft)' : undefined,
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Create account</span>
                    </button>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
                    <div>
                      <label
                        htmlFor="pi-onboard-username"
                        className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-1"
                        style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                      >
                        Username
                      </label>
                      <input
                        id="pi-onboard-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. ada_lovelace"
                        autoComplete="username"
                        required
                        style={fieldStyle}
                        className="pi-focus-ring w-full h-10 px-3.5 rounded-[12px] border text-sm placeholder:opacity-50"
                      />
                      {authMode === 'register' && (
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                        >
                          3–24 lowercase letters, numbers, or underscores.
                        </p>
                      )}
                    </div>

                    {authMode === 'register' && (
                      <div>
                        <label
                          htmlFor="pi-onboard-name"
                          className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-1"
                          style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                        >
                          Name
                        </label>
                        <input
                          id="pi-onboard-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your display name"
                          maxLength={60}
                          required
                          style={fieldStyle}
                          className="pi-focus-ring w-full h-10 px-3.5 rounded-[12px] border text-sm placeholder:opacity-50"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="pi-onboard-password"
                        className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-1"
                        style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                      >
                        Password
                      </label>
                      <input
                        id="pi-onboard-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          authMode === 'register' ? 'At least 8 characters' : 'Enter your password'
                        }
                        autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                        minLength={8}
                        maxLength={128}
                        required
                        style={fieldStyle}
                        className="pi-focus-ring w-full h-10 px-3.5 rounded-[12px] border text-sm placeholder:opacity-50"
                      />
                    </div>

                    {authMode === 'register' && (
                      <div className="flex items-center gap-3 pt-0.5">
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor:
                              'var(--bg-paper-subtle, var(--pi-surface-muted, #ECE3D4))',
                            borderColor: 'var(--border-hairline, var(--pi-border))',
                          }}
                        >
                          {avatarDataUrl ? (
                            <img
                              src={avatarDataUrl}
                              alt="Avatar preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-4 h-4 opacity-50" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium cursor-pointer border hover:opacity-85 transition-opacity"
                            style={outlineButtonStyle}
                          >
                            <span>
                              {avatarDataUrl ? 'Change photo' : 'Profile photo (optional)'}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={(e) => void handlePhotoSelect(e)}
                            />
                          </label>
                          {avatarDataUrl && (
                            <button
                              type="button"
                              onClick={() => setAvatarDataUrl(null)}
                              className="text-xs font-medium px-2 py-1 rounded-full hover:opacity-75 cursor-pointer"
                              style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {authError && (
                      <p role="alert" className="text-xs font-medium text-[#B83B2B]">
                        {authError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      style={darkButtonStyle}
                      className="pi-focus-ring w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-medium transition-opacity hover:opacity-92 disabled:opacity-50 cursor-pointer"
                    >
                      {authMode === 'login' ? (
                        <LogIn className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <UserPlus className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>
                        {busy
                          ? 'Please wait…'
                          : authMode === 'login'
                            ? 'Sign in'
                            : 'Create account'}
                      </span>
                    </button>

                    <div
                      className="flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-[11.5px] leading-relaxed"
                      style={{
                        backgroundColor:
                          'var(--bg-paper-subtle, var(--pi-surface-muted, #ECE3D4))',
                        color: 'var(--text-muted, var(--pi-text-muted))',
                      }}
                    >
                      <ShieldCheck
                        className="h-4 w-4 shrink-0 mt-0.5 text-[#526B59]"
                        aria-hidden="true"
                      />
                      <span>
                        Secured with Supabase Auth. Sign in once to keep your space personal, or
                        enter locally as a guest below.
                      </span>
                    </div>
                  </form>
                </div>
              ) : activeSlide ? (
                /* Editorial Stationery Slide */
                <div>
                  {activeSlide.illustration && (
                    <div
                      className="mt-4 mb-3 py-2"
                      style={{ color: 'var(--text-primary, var(--pi-text))' }}
                    >
                      {activeSlide.illustration}
                    </div>
                  )}

                  <div className="text-center px-1 sm:px-3 space-y-2.5">
                    <h1
                      id="pi-unified-onboarding-title"
                      className="text-[1.75rem] sm:text-[2.15rem] font-semibold leading-[1.14] tracking-[-0.02em]"
                      style={{
                        fontFamily: 'var(--pi-font-serif, var(--pi-font-display))',
                        color: 'var(--text-primary, var(--pi-text))',
                        textWrap: 'balance',
                      }}
                    >
                      {activeSlide.title}
                    </h1>

                    <p
                      className="text-[16px] leading-[1.62] max-w-[39ch] mx-auto"
                      style={{
                        fontFamily: 'var(--pi-font-serif)',
                        color: 'var(--text-secondary, var(--pi-text-muted))',
                      }}
                    >
                      {activeSlide.body}
                    </p>
                  </div>

                  {activeSlide.content && <div className="mt-4">{activeSlide.content}</div>}

                  {activeSlide.footnote && (
                    <p
                      className="mt-3 text-center text-[12px]"
                      style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                    >
                      {activeSlide.footnote}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Hairline rule & Greeting Card Navigation Footer */}
              <div
                className="mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-3"
                style={{
                  borderColor: 'var(--border-hairline, var(--pi-border, rgba(31, 42, 58, 0.12)))',
                }}
              >
                {/* Slide indicator dots */}
                <div role="tablist" aria-label="Onboarding steps" className="flex items-center gap-2">
                  {Array.from({ length: totalSteps }).map((_, idx) => {
                    const active = idx === clampedIndex;
                    const dotLabel =
                      idx < slides.length
                        ? `Slide ${idx + 1}: ${slides[idx].title}`
                        : `Slide ${idx + 1}: Account sign in`;
                    return (
                      <button
                        key={dotLabel}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={dotLabel}
                        onClick={() => setStepIndex(idx)}
                        className="pi-focus-ring h-2.5 rounded-full transition-all cursor-pointer"
                        style={{
                          width: active ? '28px' : '10px',
                          backgroundColor: active
                            ? 'var(--accent-primary, var(--pi-accent, #C4572F))'
                            : 'var(--border-strong, var(--pi-border-strong, rgba(31, 42, 58, 0.22)))',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Back / Skip / Next / Enter as guest */}
                <div className="flex items-center gap-2 ml-auto">
                  {clampedIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                      aria-label="Previous step"
                      style={outlineButtonStyle}
                      className="pi-focus-ring inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-full border text-[13px] font-medium hover:opacity-85 transition-opacity cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSkipOrClose}
                      className="pi-focus-ring min-h-[40px] px-3 rounded-full text-[13px] font-medium hover:opacity-75 transition-opacity cursor-pointer"
                      style={{ color: 'var(--text-muted, var(--pi-text-muted))' }}
                    >
                      Skip
                    </button>
                  )}

                  {isAuthStep ? (
                    <button
                      type="button"
                      onClick={handleGuestEntry}
                      className="pi-focus-ring inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold hover:opacity-80 transition-opacity cursor-pointer"
                      style={{ color: 'var(--accent-primary, var(--pi-accent, #C4572F))' }}
                    >
                      <span>Enter as guest</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : isLastSlideBeforeDone ? (
                    <button
                      type="button"
                      onClick={onComplete}
                      style={darkButtonStyle}
                      className="pi-focus-ring inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-1.5 rounded-full text-[13px] font-medium hover:opacity-92 transition-opacity cursor-pointer"
                    >
                      <span>{completeLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStepIndex((i) => Math.min(totalSteps - 1, i + 1))}
                      style={darkButtonStyle}
                      className="pi-focus-ring inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-1.5 rounded-full text-[13px] font-medium hover:opacity-92 transition-opacity cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
