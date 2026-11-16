import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'terracotta' | 'sage' | 'tan';
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'neutral',
  className = '',
  style,
}) => {
  const toneStyles: Record<NonNullable<BadgeProps['tone']>, React.CSSProperties> = {
    neutral: {
      backgroundColor: 'var(--pi-surface-muted, #ECE3D4)',
      color: 'var(--pi-text-muted, rgba(31,42,58,0.7))',
      border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
    },
    terracotta: {
      backgroundColor: 'rgba(196, 87, 47, 0.12)',
      color: '#C4572F',
      border: '1px solid rgba(196, 87, 47, 0.24)',
    },
    sage: {
      backgroundColor: 'rgba(82, 107, 89, 0.14)',
      color: '#526B59',
      border: '1px solid rgba(82, 107, 89, 0.26)',
    },
    tan: {
      backgroundColor: 'rgba(157, 123, 82, 0.14)',
      color: '#8B6842',
      border: '1px solid rgba(157, 123, 82, 0.28)',
    },
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight ${className}`}
      style={{
        fontFamily: 'var(--pi-font-sans)',
        ...toneStyles[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  accentColor?: string;
}

export const Chip: React.FC<ChipProps> = ({
  selected = false,
  accentColor,
  className = '',
  style,
  children,
  ...props
}) => {
  const activeBg = accentColor || 'var(--pi-accent, #C4572F)';

  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={`pi-focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all cursor-pointer active:scale-[0.98] ${className}`}
      style={{
        fontFamily: 'var(--pi-font-sans)',
        backgroundColor: selected ? activeBg : 'var(--pi-surface, #FBF7F0)',
        color: selected ? '#FBF7F0' : 'var(--pi-text, #1F2A3A)',
        border: selected ? '1px solid transparent' : '1px solid var(--pi-border, rgba(31,42,58,0.12))',
        boxShadow: selected ? 'var(--pi-shadow-soft)' : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
};
