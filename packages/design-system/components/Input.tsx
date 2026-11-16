import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, className = '', style, ...props }, ref) => {
    const inputId = id || (label ? `pi-input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[12px] font-medium"
            style={{ color: 'var(--pi-text-muted)', fontFamily: 'var(--pi-font-sans)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={`pi-focus-ring w-full h-10 px-3.5 text-sm transition-colors ${className}`}
          style={{
            backgroundColor: 'var(--pi-bg, #F6EFE4)',
            color: 'var(--pi-text, #1F2A3A)',
            border: error
              ? '1px solid #B83B2B'
              : '1px solid var(--pi-border-strong, rgba(31,42,58,0.18))',
            borderRadius: 'var(--pi-radius-control, 12px)',
            fontFamily: 'var(--pi-font-sans)',
            ...style,
          }}
        />
        {error ? (
          <p className="text-xs text-[#B83B2B]" style={{ fontFamily: 'var(--pi-font-sans)' }}>
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs" style={{ color: 'var(--pi-text-muted)', fontFamily: 'var(--pi-font-sans)' }}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
