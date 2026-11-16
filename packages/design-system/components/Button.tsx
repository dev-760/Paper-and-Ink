import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ink' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  pill = false,
  className = '',
  style,
  children,
  ...props
}) => {
  const sizeClass =
    size === 'sm'
      ? 'h-8 px-3 text-xs gap-1.5'
      : size === 'lg'
        ? 'h-11 px-5 text-sm gap-2'
        : 'h-9 px-4 text-[13px] gap-2';

  const radiusStyle = pill ? '9999px' : 'var(--pi-radius-control, 12px)';

  const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--pi-accent, #C4572F)',
      color: 'var(--pi-accent-contrast, #FBF7F0)',
      border: '1px solid transparent',
      boxShadow: 'var(--pi-shadow-soft)',
    },
    secondary: {
      backgroundColor: 'var(--pi-surface, #FBF7F0)',
      color: 'var(--pi-text, #1F2A3A)',
      border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
      boxShadow: 'var(--pi-shadow-soft)',
    },
    ink: {
      backgroundColor: '#1F2A3A',
      color: '#FBF7F0',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'var(--pi-shadow-card)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--pi-text, #1F2A3A)',
      border: '1px solid transparent',
    },
    danger: {
      backgroundColor: '#B83B2B',
      color: '#FBF7F0',
      border: '1px solid transparent',
    },
  };

  return (
    <button
      {...props}
      className={`pi-focus-ring inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeClass} ${className}`}
      style={{
        fontFamily: 'var(--pi-font-sans)',
        borderRadius: radiusStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
};
