import React from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@paper-and-ink/design-system';
import { NEWS_COUNTRIES, type NewsCountry } from '../types/news';

interface CountrySelectorProps {
  open: boolean;
  currentCountry: NewsCountry;
  onSelect: (country: NewsCountry) => void;
  onClose: () => void;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  open,
  currentCountry,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Country Edition"
      subtitle="Select the country or global edition for live reporting in your Daily Edition."
      maxWidthClass="max-w-md"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {NEWS_COUNTRIES.map((country) => {
          const active = country.code === currentCountry;
          return (
            <button
              key={country.code}
              type="button"
              onClick={() => {
                onSelect(country.code);
                onClose();
              }}
              className="pi-focus-ring flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer border"
              style={{
                backgroundColor: active ? 'var(--pi-surface-muted)' : 'var(--pi-bg)',
                borderColor: active ? 'var(--pi-accent)' : 'var(--pi-hairline)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md border border-[var(--pi-hairline-strong)] px-1.5 text-[10px] font-semibold tracking-wider text-[var(--pi-text-muted)]">
                  {country.shortCode}
                </span>
                <span className="text-sm font-medium text-[var(--pi-text)] truncate">
                  {country.label}
                </span>
              </div>
              {active && (
                <span className="w-5 h-5 rounded-full bg-[var(--pi-accent)] text-white flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
