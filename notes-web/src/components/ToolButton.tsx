import React from 'react';

export interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  icon?: React.ReactNode;
  variant?: 'toolbar' | 'surface';
  showLabel?: boolean;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  label,
  active = false,
  icon,
  variant = 'toolbar',
  showLabel = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const variantClasses =
    variant === 'toolbar'
      ? active
        ? 'bg-[var(--bg-toolbar-active)] text-[var(--text-on-toolbar-active)]'
        : 'text-[var(--text-on-toolbar)]/85 hover:text-[var(--text-on-toolbar)] hover:bg-white/10'
      : active
        ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)]';

  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`pi-focusable inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${variantClasses} ${className}`}
      {...rest}
    >
      {icon}
      {showLabel && <span>{label}</span>}
      {children}
    </button>
  );
};
