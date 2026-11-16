import React from 'react';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import {
  UnifiedOnboardingModal,
  type UnifiedOnboardingSlide,
} from '@paper-and-ink/design-system';
import { useNotesStore } from '../../store/useNotesStore';

export interface OnboardingModalProps {
  open: boolean;
  auth: PaperInkAuthState;
  onContinueAsGuest: () => void;
  onComplete: () => void;
}

const SLIDES: UnifiedOnboardingSlide[] = [
  {
    title: 'The digital desk',
    body: 'Digital tools should preserve the quiet warmth of physical stationery. Your notebooks rest on open shelves—tactile, unhurried, and free of workspace clutter.',
    footnote: 'Six bound covers · Light paper & dark desk themes',
    illustration: (
      <svg
        viewBox="0 0 180 96"
        fill="none"
        aria-hidden="true"
        className="w-40 h-24 mx-auto"
      >
        <line
          x1="18"
          y1="78"
          x2="162"
          y2="78"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <rect
          x="42"
          y="20"
          width="54"
          height="58"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <line
          x1="51"
          y1="20"
          x2="51"
          y2="78"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />
        <line
          x1="61"
          y1="38"
          x2="84"
          y2="38"
          stroke="var(--accent-primary)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <line
          x1="61"
          y1="46"
          x2="78"
          y2="46"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <rect
          x="104"
          y="32"
          width="36"
          height="46"
          rx="4"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="1.25"
        />
        <circle
          cx="122"
          cy="52"
          r="6"
          stroke="var(--accent-primary)"
          strokeOpacity="0.75"
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    title: 'Handwritten craft',
    body: 'Compose in calm serif prose or sketch directly on ruled paper with a stylus. Smooth vector ink honors pen pressure while finger touch scrolls naturally.',
    footnote: 'Pointer Events · Pressure-sensitive vector ink',
    illustration: (
      <svg
        viewBox="0 0 180 96"
        fill="none"
        aria-hidden="true"
        className="w-40 h-24 mx-auto"
      >
        <line
          x1="24"
          y1="66"
          x2="156"
          y2="66"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <line
          x1="24"
          y1="78"
          x2="156"
          y2="78"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <path
          d="M32 68C48 48 60 72 78 58C92 46 100 66 118 54"
          stroke="var(--accent-primary)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M118 54L129 28L142 20L148 26L140 39L118 54Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <line
          x1="118"
          y1="54"
          x2="134"
          y2="36"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.1"
        />
        <circle cx="135" cy="35" r="2" fill="currentColor" fillOpacity="0.65" />
      </svg>
    ),
  },
  {
    title: 'Thoughtful organization',
    body: 'Structure ideas gently with page numbers, tags, and clean summaries. Your original handwriting is never overwritten—every stroke remains preserved beside your drafts.',
    footnote: 'Cross-device DB sync · Original ink always preserved',
    illustration: (
      <svg
        viewBox="0 0 180 96"
        fill="none"
        aria-hidden="true"
        className="w-40 h-24 mx-auto"
      >
        <rect
          x="32"
          y="22"
          width="50"
          height="58"
          rx="4"
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="1.25"
        />
        <path
          d="M42 42C48 36 56 46 64 40C68 37 71 42 73 41"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M42 54C50 50 58 56 70 52"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <rect
          x="96"
          y="18"
          width="52"
          height="62"
          rx="4"
          fill="var(--bg-paper-elevated)"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <path
          d="M132 18V36L137 32L142 36V18"
          stroke="var(--accent-primary)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <line
          x1="106"
          y1="36"
          x2="124"
          y2="36"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <line
          x1="106"
          y1="47"
          x2="138"
          y2="47"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="106"
          y1="56"
          x2="134"
          y2="56"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="106"
          y1="65"
          x2="128"
          y2="65"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  auth,
  onContinueAsGuest,
  onComplete,
}) => {
  const theme = useNotesStore((s) => s.theme);
  const toggleTheme = useNotesStore((s) => s.toggleTheme);

  return (
    <UnifiedOnboardingModal
      open={open}
      appName="Notes"
      slides={SLIDES}
      completeLabel="Open shelf"
      isDark={theme === 'dark'}
      onToggleDark={toggleTheme}
      profile={auth.profile}
      onLogin={auth.login}
      onRegister={auth.register}
      onContinueAsGuest={onContinueAsGuest}
      onComplete={onComplete}
      authFootnote="Username & password only — signed-in notebooks and notes sync across devices."
    />
  );
};
