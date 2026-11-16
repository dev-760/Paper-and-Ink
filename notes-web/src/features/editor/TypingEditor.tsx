import React, { useMemo, useRef } from 'react';
import { CheckSquare, Heading2, List, Square } from 'lucide-react';
import { PaperSurface } from '../../components/PaperSurface';

export interface TypingEditorProps {
  content: string;
  barePaper?: boolean;
  onChange: (nextContent: string) => void;
}

interface ChecklistEntry {
  lineIndex: number;
  checked: boolean;
  label: string;
}

export const TypingEditor: React.FC<TypingEditorProps> = ({
  content,
  barePaper = false,
  onChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const checklistEntries = useMemo<ChecklistEntry[]>(() => {
    const lines = content.split('\n');
    const items: ChecklistEntry[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.*)$/);
      if (match) {
        items.push({
          lineIndex: idx,
          checked: match[1].toLowerCase() === 'x',
          label: match[2],
        });
      }
    });
    return items;
  }, [content]);

  const toggleChecklistLine = (lineIndex: number) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    if (line === undefined) return;
    lines[lineIndex] = line.replace(
      /^(\s*-\s+\[)([ xX])(\]\s+)/,
      (_, prefix, state, suffix) =>
        `${prefix}${state.toLowerCase() === 'x' ? ' ' : 'x'}${suffix}`
    );
    onChange(lines.join('\n'));
  };

  const insertPrefixAtCursor = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      onChange(`${content}${separator}${prefix}`);
      return;
    }

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertion = `${needsNewline ? '\n' : ''}${prefix}`;
    const next = `${before}${insertion}${after}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const nextCursor = before.length + insertion.length;
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const editorInner = (
    <div className={barePaper ? 'w-full' : 'max-w-[68ch] mx-auto'}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Note body"
        placeholder="Begin writing on the page… Use ## for headings, - for bullets, or - [ ] for checkboxes."
        rows={14}
        className="pi-focusable w-full min-h-[380px] sm:min-h-[460px] bg-transparent border-0 resize-y outline-none pi-prose text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/75 leading-[32px]"
      />

      {/* Quiet minimal block helpers tucked at bottom of sheet */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => insertPrefixAtCursor('## ')}
            className="pi-focusable inline-flex items-center gap-1.5 min-h-[38px] px-2.5 rounded-full text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
          >
            <Heading2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Heading</span>
          </button>
          <button
            type="button"
            onClick={() => insertPrefixAtCursor('- ')}
            className="pi-focusable inline-flex items-center gap-1.5 min-h-[38px] px-2.5 rounded-full text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
          >
            <List className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Bullet</span>
          </button>
          <button
            type="button"
            onClick={() => insertPrefixAtCursor('- [ ] ')}
            className="pi-focusable inline-flex items-center gap-1.5 min-h-[38px] px-2.5 rounded-full text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Checkbox</span>
          </button>
        </div>

        <span className="pi-meta pi-tabular text-[var(--text-muted)]">
          {content.trim() ? `${content.trim().split(/\s+/).length} words` : 'Blank page'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {barePaper ? (
        editorInner
      ) : (
        <PaperSurface lined showMarginLine className="px-5 sm:px-14 py-7 sm:py-9">
          {editorInner}
        </PaperSurface>
      )}

      {/* Interactive checklist toggles synced with markdown lines */}
      {checklistEntries.length > 0 && (
        <PaperSurface className="px-5 sm:px-8 py-4">
          <p className="pi-label-micro text-[var(--text-muted)] mb-2.5">
            Page checkboxes
          </p>
          <ul className="space-y-1">
            {checklistEntries.map((item) => (
              <li key={item.lineIndex}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  onClick={() => toggleChecklistLine(item.lineIndex)}
                  className="pi-focusable w-full flex items-center gap-3 min-h-[44px] px-2.5 py-1.5 rounded-[12px] text-left hover:bg-[var(--bg-paper-subtle)] transition-colors cursor-pointer"
                >
                  {item.checked ? (
                    <CheckSquare
                      className="w-4 h-4 text-[var(--accent-primary)] shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="w-4 h-4 text-[var(--text-muted)] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`pi-prose text-[15.5px] leading-snug ${
                      item.checked
                        ? 'line-through text-[var(--text-muted)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PaperSurface>
      )}
    </div>
  );
};
