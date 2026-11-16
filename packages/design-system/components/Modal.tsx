import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full ${maxWidthClass} max-h-[92dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7`}
        style={{
          backgroundColor: 'var(--pi-surface, #FBF7F0)',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid var(--pi-border, rgba(31,42,58,0.12))',
          boxShadow: 'var(--pi-shadow-float)',
          fontFamily: 'var(--pi-font-sans)',
        }}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              {title && (
                <h2
                  className="text-xl font-medium tracking-tight"
                  style={{ fontFamily: 'var(--pi-font-display)' }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs mt-1" style={{ color: 'var(--pi-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <IconButton label="Close dialog" size="sm" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
