import React from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@paper-and-ink/design-system';
import { WRITING_STYLES, type WritingStyle } from '../types/news';

interface StyleSelectorProps {
  open: boolean;
  currentStyle: WritingStyle;
  onSelect: (style: WritingStyle) => void;
  onClose: () => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  open,
  currentStyle,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Summary Voice"
      subtitle="Choose how AI briefing summaries present each story before you read the full reporting."
      maxWidthClass="max-w-md"
    >
      <div className="space-y-2.5">
        {WRITING_STYLES.map((style) => {
          const active = style.id === currentStyle;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                onSelect(style.id);
                onClose();
              }}
              className="pi-focus-ring w-full flex items-start justify-between gap-3 p-4 rounded-2xl text-left transition-all cursor-pointer border"
              style={{
                backgroundColor: active ? 'var(--pi-surface-muted)' : 'var(--pi-bg)',
                borderColor: active ? 'var(--pi-accent)' : 'var(--pi-hairline)',
              }}
            >
              <div>
                <div className="text-sm font-semibold text-[var(--pi-text)]">{style.label}</div>
                <p className="text-xs mt-1 leading-relaxed text-[var(--pi-text-muted)]">
                  {style.description}
                </p>
              </div>
              {active && (
                <span className="w-6 h-6 rounded-full bg-[var(--pi-accent)] text-white flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
