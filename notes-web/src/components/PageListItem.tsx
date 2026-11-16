import React from 'react';
import { PenTool } from 'lucide-react';

export interface PageListItemProps {
  title: string;
  dateLabel: string;
  tags: string[];
  hasInk: boolean;
  hasOrganizedVersion?: boolean;
  preview?: string;
  active?: boolean;
  pageNumber?: number;
  onSelect: () => void;
}

export const PageListItem: React.FC<PageListItemProps> = ({
  title,
  dateLabel,
  tags,
  hasInk,
  hasOrganizedVersion = false,
  preview,
  active = false,
  pageNumber,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={`pi-focusable w-full text-left px-4 py-4 min-h-[56px] border-b border-[var(--border-hairline)] transition-colors duration-150 cursor-pointer rounded-[14px] ${
        active
          ? 'bg-[var(--bg-paper-elevated)] shadow-[var(--paper-shadow)] border-transparent'
          : 'hover:bg-[var(--bg-paper-subtle)]/70'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {typeof pageNumber === 'number' && (
            <span className="pi-meta pi-tabular text-[var(--text-muted)] shrink-0">
              {String(pageNumber).padStart(2, '0')}
            </span>
          )}
          <h4
            style={{ fontFamily: 'var(--pi-font-serif)' }}
            className={`text-[1.125rem] leading-snug truncate ${
              active
                ? 'font-medium text-[var(--text-primary)]'
                : 'font-normal text-[var(--text-primary)]'
            }`}
          >
            {title || 'Untitled Note'}
          </h4>
        </div>

        {hasInk && (
          <span
            title="Contains handwritten ink"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] shrink-0"
          >
            <PenTool className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ink</span>
          </span>
        )}
      </div>

      {preview && (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
          {preview}
        </p>
      )}

      {/* Clean unboxed editorial metadata with typographic separators */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)] pi-tabular">
        <span>{dateLabel}</span>
        {tags.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{tags.slice(0, 3).join(', ')}</span>
          </>
        )}
        {hasOrganizedVersion && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--accent-primary)] font-medium">
              Organized draft
            </span>
          </>
        )}
      </div>
    </button>
  );
};
