import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import {
  UnifiedOnboardingModal,
  type UnifiedOnboardingSlide,
} from '@paper-and-ink/design-system';
import {
  NEWS_COUNTRIES,
  TOPICS,
  WRITING_STYLES,
  type NewsCountry,
  type Topic,
  type WritingStyle,
} from '../types/news';
import { useNewsStore } from '../store/useNewsStore';

interface OnboardingProps {
  open: boolean;
  auth: PaperInkAuthState;
  completeLabel?: string;
  onContinueAsGuest: () => void;
  onFinished?: () => void;
}

const DailyEditionIllustration: React.FC = () => (
  <svg viewBox="0 0 180 68" fill="none" aria-hidden="true" className="w-36 h-16 mx-auto">
    <line
      x1="18"
      y1="56"
      x2="162"
      y2="56"
      stroke="currentColor"
      strokeOpacity="0.24"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    <rect x="44" y="10" width="72" height="46" rx="4" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="M116 19H130C132.2 19 134 20.8 134 23V51C134 53.8 131.8 56 129 56H116"
      stroke="currentColor"
      strokeOpacity="0.6"
      strokeWidth="1.2"
    />
    <circle
      cx="66"
      cy="34"
      r="11"
      stroke="var(--accent-primary, var(--pi-accent))"
      strokeWidth="1.25"
    />
    <ellipse
      cx="66"
      cy="34"
      rx="5"
      ry="11"
      stroke="var(--accent-primary, var(--pi-accent))"
      strokeWidth="1"
    />
    <line
      x1="55"
      y1="34"
      x2="77"
      y2="34"
      stroke="var(--accent-primary, var(--pi-accent))"
      strokeWidth="1"
    />
    <line
      x1="84"
      y1="26"
      x2="106"
      y2="26"
      stroke="currentColor"
      strokeOpacity="0.6"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <line
      x1="84"
      y1="34"
      x2="106"
      y2="34"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <line
      x1="84"
      y1="42"
      x2="100"
      y2="42"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

const BeatsIllustration: React.FC = () => (
  <svg viewBox="0 0 180 62" fill="none" aria-hidden="true" className="w-36 h-14 mx-auto">
    <circle cx="90" cy="31" r="21" stroke="currentColor" strokeWidth="1.3" />
    <circle
      cx="90"
      cy="31"
      r="14"
      stroke="currentColor"
      strokeOpacity="0.22"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <polygon
      points="90,15 95,31 90,47 85,31"
      stroke="var(--accent-primary, var(--pi-accent))"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <circle cx="90" cy="31" r="2" fill="currentColor" />
  </svg>
);

const VoiceIllustration: React.FC = () => (
  <svg viewBox="0 0 180 62" fill="none" aria-hidden="true" className="w-36 h-14 mx-auto">
    <path
      d="M36 44C52 34 62 50 78 38C92 26 102 44 120 32"
      stroke="var(--accent-primary, var(--pi-accent))"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
    <path
      d="M120 32L129 14L140 9L144 14L137 23L120 32Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <line
      x1="28"
      y1="52"
      x2="152"
      y2="52"
      stroke="currentColor"
      strokeOpacity="0.22"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

export const Onboarding: React.FC<OnboardingProps> = ({
  open,
  auth,
  completeLabel = 'Open edition',
  onContinueAsGuest,
  onFinished,
}) => {
  const storedInterests = useNewsStore((s) => s.interests);
  const storedStyle = useNewsStore((s) => s.writingStyle);
  const storedCountry = useNewsStore((s) => s.country);
  const theme = useNewsStore((s) => s.theme);
  const toggleDark = useNewsStore((s) => s.toggleDark);
  const completeOnboarding = useNewsStore((s) => s.completeOnboarding);

  const [selectedCountry, setSelectedCountry] = useState<NewsCountry>(storedCountry);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(storedInterests);
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle>(storedStyle);

  useEffect(() => {
    if (!open) return;
    setSelectedCountry(storedCountry);
    setSelectedTopics(storedInterests);
    setSelectedStyle(storedStyle);
  }, [open, storedCountry, storedInterests, storedStyle]);

  const toggleTopic = (topicId: Topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  };

  const slides: UnifiedOnboardingSlide[] = [
    {
      title: 'Choose your country edition',
      body: 'A calmer morning paper tuned to reporting from your selected country or global edition, with zero feed clutter.',
      illustration: <DailyEditionIllustration />,
      content: (
        <div
          role="listbox"
          aria-label="News country edition"
          className="max-h-[154px] overflow-y-auto px-1 py-0.5 flex flex-wrap justify-center gap-1.5"
        >
          {NEWS_COUNTRIES.map((item) => {
            const active = selectedCountry === item.code;
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setSelectedCountry(item.code)}
                className="pi-focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border"
                style={{
                  backgroundColor: active
                    ? 'var(--pi-text, #1F2A3A)'
                    : 'var(--pi-bg, #F6EFE4)',
                  color: active ? 'var(--pi-bg, #F6EFE4)' : 'var(--pi-text, #1F2A3A)',
                  borderColor: active
                    ? 'transparent'
                    : 'var(--pi-border-strong, rgba(31, 42, 58, 0.2))',
                }}
              >
                <span className="text-[10px] font-semibold tracking-wider opacity-75">
                  {item.shortCode}
                </span>
                <span>{item.label}</span>
                {active && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Follow your beats',
      body: 'Select the subjects you want woven into your daily edition. You can refine them anytime.',
      illustration: <BeatsIllustration />,
      content: (
        <div className="flex flex-wrap justify-center gap-2 px-1">
          {TOPICS.map((topic) => {
            const selected = selectedTopics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                aria-pressed={selected}
                className="pi-focus-ring inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-all cursor-pointer border"
                style={{
                  backgroundColor: selected
                    ? 'var(--pi-text, #1F2A3A)'
                    : 'var(--pi-bg, #F6EFE4)',
                  color: selected ? 'var(--pi-bg, #F6EFE4)' : 'var(--pi-text, #1F2A3A)',
                  borderColor: selected
                    ? 'transparent'
                    : 'var(--pi-border-strong, rgba(31, 42, 58, 0.2))',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: selected ? 'currentColor' : topic.colorToken }}
                />
                <span>{topic.label}</span>
                {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Choose your editorial voice',
      body: 'Pick the tone used when rewriting news briefings across your edition. Original source links remain one tap away.',
      illustration: <VoiceIllustration />,
      content: (
        <div className="grid gap-2.5 sm:grid-cols-2 px-1">
          {WRITING_STYLES.map((style) => {
            const active = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setSelectedStyle(style.id)}
                aria-pressed={active}
                className="pi-focus-ring rounded-[14px] border p-3 text-left transition-all cursor-pointer"
                style={{
                  backgroundColor: active
                    ? 'var(--pi-surface-muted, #ECE3D4)'
                    : 'var(--pi-bg, #F6EFE4)',
                  borderColor: active
                    ? 'var(--pi-accent, #C4572F)'
                    : 'var(--pi-border, rgba(31, 42, 58, 0.12))',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{style.label}</span>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--pi-accent, #C4572F)' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p
                  className="mt-1 text-[11.5px] leading-snug"
                  style={{ color: 'var(--pi-text-muted)' }}
                >
                  {style.description}
                </p>
              </button>
            );
          })}
        </div>
      ),
    },
  ];

  const handleComplete = () => {
    completeOnboarding(selectedTopics, selectedStyle, selectedCountry);
    onFinished?.();
  };

  return (
    <UnifiedOnboardingModal
      open={open}
      appName="News"
      slides={slides}
      completeLabel={completeLabel}
      isDark={theme === 'dark'}
      onToggleDark={toggleDark}
      profile={auth.profile}
      onLogin={auth.login}
      onRegister={auth.register}
      onContinueAsGuest={onContinueAsGuest}
      onComplete={handleComplete}
    />
  );
};
