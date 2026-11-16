import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  radius?: 'sheet' | 'card' | 'control';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  radius = 'card',
  padding = 'md',
  className = '',
  style,
  children,
  ...props
}) => {
  const paddingClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-3.5'
        : padding === 'lg'
          ? 'p-6 sm:p-8'
          : 'p-5';

  const borderRadius =
    radius === 'sheet'
      ? 'var(--pi-radius-sheet, 24px)'
      : radius === 'control'
        ? 'var(--pi-radius-control, 12px)'
        : 'var(--pi-radius-card, 16px)';

  return (
    <div
      {...props}
      className={`${paddingClass} ${className}`}
      style={{
        backgroundColor: 'var(--pi-surface, #FBF7F0)',
        color: 'var(--pi-text, #1F2A3A)',
        border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
        boxShadow: 'var(--pi-shadow-soft)',
        borderRadius,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
