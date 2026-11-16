import React from 'react';

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <hr
    className={`border-0 border-t ${className}`}
    style={{ borderColor: 'var(--pi-border, rgba(31,42,58,0.1))' }}
  />
);

export const LoadingState: React.FC<{
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ label = 'Loading…', size = 'md', className = '' }) => (
  <div
    className={`inline-flex items-center gap-2.5 ${className}`}
    style={{ color: 'var(--pi-text-muted)', fontFamily: 'var(--pi-font-sans)' }}
    role="status"
    aria-live="polite"
  >
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${
        size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
      }`}
    />
    <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{label}</span>
  </div>
);
