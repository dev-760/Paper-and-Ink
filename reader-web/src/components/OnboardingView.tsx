import React from 'react';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import {
  UnifiedOnboardingModal,
  type UnifiedOnboardingSlide,
} from '@paper-and-ink/design-system';

export interface OnboardingViewProps {
  open: boolean;
  isDark: boolean;
  auth: PaperInkAuthState;
  completeLabel?: string;
  onToggleDark: () => void;
  onContinueAsGuest: () => void;
  onComplete: () => void;
}

const SLIDES: UnifiedOnboardingSlide[] = [
  {
    title: 'The quiet shelves',
    body: 'Your EPUB and PDF volumes rest horizontally on translucent acrylic shelves—browse curated sections or filter instantly without workspace noise.',
    footnote: 'Acrylic shelves · Paper, Sepia & Dark Desk lighting',
    illustration: (
      <svg viewBox="0 0 180 96" fill="none" aria-hidden="true" className="w-40 h-24 mx-auto">
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
        <rect x="34" y="24" width="22" height="54" rx="3" stroke="currentColor" strokeWidth="1.35" />
        <line
          x1="40"
          y1="34"
          x2="50"
          y2="34"
          stroke="var(--accent-primary, var(--pi-accent))"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <rect
          x="61"
          y="18"
          width="26"
          height="60"
          rx="3"
          stroke="currentColor"
          strokeOpacity="0.78"
          strokeWidth="1.3"
        />
        <rect
          x="92"
          y="30"
          width="20"
          height="48"
          rx="3"
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="1.25"
        />
        <path
          d="M118 78L130 28L148 33L136 78Z"
          stroke="var(--accent-primary, var(--pi-accent))"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Reflowable serif craft',
    body: 'Read in Source Serif 4 or Lora with classic chapter drop caps, comfortable line measures, and balanced lighting crafted for unhurried sessions.',
    footnote: 'Custom type size & spacing · Highlights & dictionary lookup',
    illustration: (
      <svg viewBox="0 0 180 96" fill="none" aria-hidden="true" className="w-40 h-24 mx-auto">
        <path
          d="M28 22C50 18 72 20 90 28C108 20 130 18 152 22V74C130 70 108 72 90 78C72 72 50 70 28 74V22Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <line
          x1="90"
          y1="28"
          x2="90"
          y2="78"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.1"
        />
        <rect
          x="42"
          y="34"
          width="11"
          height="13"
          rx="2"
          stroke="var(--accent-primary, var(--pi-accent))"
          strokeWidth="1.25"
        />
        <line
          x1="58"
          y1="37"
          x2="78"
          y2="37"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="58"
          y1="45"
          x2="76"
          y2="45"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="42"
          y1="56"
          x2="78"
          y2="56"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="103"
          y1="37"
          x2="138"
          y2="37"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="103"
          y1="47"
          x2="136"
          y2="47"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M126 20V38L131 34L136 38V20"
          stroke="var(--accent-primary, var(--pi-accent))"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Unhurried reading pace',
    body: 'Keep your place with chapter-anchored bookmarks, collect favorite quotes along the way, and glance at live chapter pace whenever you choose.',
    footnote: 'Private local library · Instant chapter resume',
    illustration: (
      <svg viewBox="0 0 180 96" fill="none" aria-hidden="true" className="w-40 h-24 mx-auto">
        <circle cx="90" cy="48" r="28" stroke="currentColor" strokeWidth="1.35" />
        <circle
          cx="90"
          cy="48"
          r="21"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M90 31V48L102 54"
          stroke="var(--accent-primary, var(--pi-accent))"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="90" cy="48" r="2.2" fill="currentColor" />
        <line
          x1="84"
          y1="14"
          x2="96"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <line x1="90" y1="14" x2="90" y2="20" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  open,
  isDark,
  auth,
  completeLabel = 'Open library',
  onToggleDark,
  onContinueAsGuest,
  onComplete,
}) => {
  return (
    <UnifiedOnboardingModal
      open={open}
      appName="Reader"
      slides={SLIDES}
      completeLabel={completeLabel}
      isDark={isDark}
      onToggleDark={onToggleDark}
      profile={auth.profile}
      onLogin={auth.login}
      onRegister={auth.register}
      onContinueAsGuest={onContinueAsGuest}
      onComplete={onComplete}
    />
  );
};
