import React from 'react';

export interface PaperSurfaceProps {
  children: React.ReactNode;
  lined?: boolean;
  showMarginLine?: boolean;
  elevated?: boolean;
  rounded?: 'card' | 'none';
  className?: string;
}

export const PaperSurface: React.FC<PaperSurfaceProps> = ({
  children,
  lined = false,
  showMarginLine = false,
  elevated = false,
  rounded = 'card',
  className = '',
}) => {
  const bgClass = elevated
    ? 'bg-[var(--bg-paper-elevated)]'
    : 'bg-[var(--bg-paper)]';
  const radiusClass = rounded === 'card' ? 'rounded-[24px]' : 'rounded-none';

  return (
    <div
      className={`relative pi-paper-grain ${bgClass} ${
        lined ? 'pi-paper-lined' : ''
      } ${radiusClass} border border-[var(--border-hairline)] shadow-[var(--paper-shadow)] ${className}`}
    >
      {showMarginLine && (
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute top-0 bottom-0 left-12 w-px bg-[var(--paper-margin-line)]"
        />
      )}
      {children}
    </div>
  );
};
