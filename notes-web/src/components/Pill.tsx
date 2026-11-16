import React from 'react';

export interface PillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'filter' | 'dark' | 'outline';
  size?: 'sm' | 'md';
}

export const Pill: React.FC<PillProps> = ({
  active = false,
  variant = 'filter',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'min-h-[40px] px-3.5 py-1.5 text-[13px]'
      : 'min-h-[44px] px-4 py-2 text-[14px]';

  let styleClasses = '';
  if (variant === 'dark') {
    styleClasses =
      'bg-[var(--bg-toolbar)] text-[var(--text-on-toolbar)] shadow-[var(--toolbar-shadow)] hover:opacity-95 border border-white/10';
  } else if (variant === 'outline') {
    styleClasses = active
      ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] border border-transparent'
      : 'bg-[var(--bg-paper)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--bg-pill-hover)]';
  } else {
    styleClasses = active
      ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] border border-transparent'
      : 'bg-[var(--bg-pill)] text-[var(--text-secondary)] border border-[var(--border-hairline)] hover:bg-[var(--bg-pill-hover)] hover:text-[var(--text-primary)]';
  }

  return (
    <button
      type={type}
      aria-pressed={variant === 'filter' ? active : undefined}
      className={`pi-focusable inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${sizeClasses} ${styleClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
