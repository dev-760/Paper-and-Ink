import React from 'react';

export interface FloatingToolbarProps {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  children,
  ariaLabel,
  className = '',
}) => {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--bg-toolbar)] text-[var(--text-on-toolbar)] shadow-[var(--toolbar-shadow)] border border-white/10 max-w-full overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
};
