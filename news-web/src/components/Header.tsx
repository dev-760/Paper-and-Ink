import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { AccountMenu } from '@paper-and-ink/design-system';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import { useNewsStore } from '../store/useNewsStore';

interface HeaderProps {
  auth: PaperInkAuthState;
}

export const Header: React.FC<HeaderProps> = ({ auth }) => {
  const editionDate = useNewsStore((s) => s.editionDate);
  const theme = useNewsStore((s) => s.theme);
  const toggleDark = useNewsStore((s) => s.toggleDark);
  const isDark = theme === 'dark';

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 pt-4 pb-2 sm:gap-3 sm:px-8 sm:pt-8">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="pi-label text-[var(--pi-text-muted)] whitespace-nowrap">
          Paper &amp; Ink
        </span>
        <span className="hidden sm:inline text-xs opacity-35" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline text-xs font-medium text-[var(--pi-text-muted)] truncate">
          {editionDate}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <AccountMenu
          profile={auth.profile}
          isLoading={auth.isLoading}
          onLogin={auth.login}
          onRegister={auth.register}
          onUpdateProfile={auth.updateProfile}
          onLogout={auth.logout}
        />
        <button
          type="button"
          onClick={toggleDark}
          aria-label={isDark ? 'Switch to Paper Cream theme' : 'Switch to Dark Desk theme'}
          title={isDark ? 'Paper Cream' : 'Dark Desk'}
          className="pi-focus-ring flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full border border-[var(--pi-hairline)] bg-[var(--pi-surface)] text-[var(--pi-text)] transition-colors hover:bg-[var(--pi-surface-muted)] cursor-pointer"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
