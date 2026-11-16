import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';

export type PaperInkAppId = 'reader' | 'notes' | 'news';

export interface AppSwitcherProps {
  activeApp: PaperInkAppId;
  className?: string;
}

interface AppDescriptor {
  id: PaperInkAppId;
  name: string;
  tagline: string;
  url: string;
  iconSrc: string;
  fallbackMark: string;
}

function resolveAppUrls(): Record<PaperInkAppId, string> {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return {
    reader: (env.VITE_READER_URL || '').trim().replace(/\/$/, ''),
    notes: (env.VITE_NOTES_URL || '').trim().replace(/\/$/, ''),
    news: (env.VITE_NEWS_URL || '').trim().replace(/\/$/, ''),
  };
}

export const AppSwitcher: React.FC<AppSwitcherProps> = ({ activeApp, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const urls = resolveAppUrls();

  const allApps: AppDescriptor[] = [
    {
      id: 'reader',
      name: 'Reader',
      tagline: 'Books & quiet reading',
      url: urls.reader,
      iconSrc: activeApp === 'reader' ? './icon.png' : urls.reader ? `${urls.reader}/icon.png` : '',
      fallbackMark: 'R',
    },
    {
      id: 'notes',
      name: 'Notes',
      tagline: 'Notebooks & ink',
      url: urls.notes,
      iconSrc: activeApp === 'notes' ? './icon.png' : urls.notes ? `${urls.notes}/icon.png` : '',
      fallbackMark: 'N',
    },
    {
      id: 'news',
      name: 'News',
      tagline: 'Daily calm briefing',
      url: urls.news,
      iconSrc: activeApp === 'news' ? './icon.png' : urls.news ? `${urls.news}/icon.png` : '',
      fallbackMark: 'E',
    },
  ];

  // When hosted standalone without sibling app URLs configured, show only the active app mark.
  const apps = allApps.filter((app) => app.id === activeApp || Boolean(app.url));
  const hasSiblingLinks = apps.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeDescriptor = apps.find((a) => a.id === activeApp) ?? apps[0];

  if (!hasSiblingLinks) {
    return (
      <div
        className={`inline-flex items-center gap-2 h-9 px-2.5 rounded-full text-xs font-medium ${className}`}
        style={{
          backgroundColor: 'var(--pi-surface, #FBF7F0)',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
          boxShadow: 'var(--pi-shadow-soft)',
          fontFamily: 'var(--pi-font-sans)',
        }}
      >
        {!failedIcons[activeDescriptor.id] ? (
          <img
            src={activeDescriptor.iconSrc}
            alt=""
            className="w-5 h-5 rounded-md object-cover shrink-0"
            onError={() => setFailedIcons((prev) => ({ ...prev, [activeDescriptor.id]: true }))}
          />
        ) : (
          <LayoutGrid size={14} style={{ color: 'var(--pi-accent)' }} />
        )}
        <span className="hidden sm:inline">{activeDescriptor.name}</span>
      </div>
    );
  }

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch Paper & Ink application"
        className="pi-focus-ring inline-flex items-center gap-2 h-9 px-2.5 rounded-full text-xs font-medium transition-all cursor-pointer active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--pi-surface, #FBF7F0)',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
          boxShadow: 'var(--pi-shadow-soft)',
          fontFamily: 'var(--pi-font-sans)',
        }}
      >
        {!failedIcons[activeDescriptor.id] ? (
          <img
            src={activeDescriptor.iconSrc}
            alt=""
            className="w-5 h-5 rounded-md object-cover shrink-0"
            onError={() => setFailedIcons((prev) => ({ ...prev, [activeDescriptor.id]: true }))}
          />
        ) : (
          <LayoutGrid size={14} style={{ color: 'var(--pi-accent)' }} />
        )}
        <span className="hidden sm:inline">{activeDescriptor.name}</span>
        <ChevronDown
          size={13}
          className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 p-1.5 z-50"
          style={{
            backgroundColor: 'var(--pi-surface, #FBF7F0)',
            color: 'var(--pi-text, #1F2A3A)',
            border: '1px solid var(--pi-border, rgba(31,42,58,0.12))',
            borderRadius: '18px',
            boxShadow: 'var(--pi-shadow-float)',
            fontFamily: 'var(--pi-font-sans)',
          }}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider opacity-55">
            Paper &amp; Ink Suite
          </div>
          {apps.map((app) => {
            const isCurrent = app.id === activeApp;
            return (
              <a
                key={app.id}
                href={isCurrent ? '#' : app.url}
                onClick={(e) => {
                  if (isCurrent) {
                    e.preventDefault();
                  }
                  setOpen(false);
                }}
                role="menuitem"
                className="flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors"
                style={{
                  backgroundColor: isCurrent ? 'var(--pi-surface-muted, #ECE3D4)' : 'transparent',
                }}
              >
                {!failedIcons[app.id] ? (
                  <img
                    src={app.iconSrc}
                    alt={`${app.name} icon`}
                    className="w-8 h-8 rounded-lg object-cover shrink-0 border border-black/10"
                    onError={() => setFailedIcons((prev) => ({ ...prev, [app.id]: true }))}
                  />
                ) : (
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: 'var(--pi-surface-muted)',
                      color: 'var(--pi-accent)',
                      fontFamily: 'var(--pi-font-display)',
                    }}
                  >
                    {app.fallbackMark}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      Paper &amp; Ink {app.name}
                    </span>
                    {isCurrent && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: 'var(--pi-accent, #C4572F)' }}
                      />
                    )}
                  </div>
                  <p className="text-[11px] truncate opacity-60">{app.tagline}</p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
