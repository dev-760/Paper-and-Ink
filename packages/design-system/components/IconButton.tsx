import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  variant?: 'surface' | 'ghost';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  size = 'md',
  variant = 'surface',
  className = '',
  style,
  children,
  ...props
}) => {
  const dims = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const baseStyle: React.CSSProperties =
    variant === 'surface'
      ? {
          backgroundColor: 'var(--pi-surface, #FBF7F0)',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
          boxShadow: 'var(--pi-shadow-soft)',
        }
      : {
          backgroundColor: 'transparent',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid transparent',
        };

  return (
    <button
      type="button"
      aria-label={label}
      title={props.title ?? label}
      {...props}
      className={`pi-focus-ring inline-flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${dims} ${className}`}
      style={{
        ...baseStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
};
