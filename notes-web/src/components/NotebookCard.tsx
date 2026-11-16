import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Check, Plus, X } from 'lucide-react';
import {
  COVER_PALETTE,
  NOTEBOOK_CATEGORIES,
  type CoverColor,
  type Notebook,
  type NotebookCategory,
} from '../types/notebook';
import { NotebookCover } from './NotebookCover';

export interface NotebookCardProps {
  notebook: Notebook;
  pageCount: number;
  updatedLabel: string;
  shelves?: string[];
  onCreateShelf?: (name: string) => string;
  onOpen: (notebookId: string) => void;
  onRename: (notebookId: string, newTitle: string) => void;
  onChangeColor: (notebookId: string, color: CoverColor) => void;
  onMoveCategory: (notebookId: string, category: NotebookCategory) => void;
  onDelete?: (notebookId: string) => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
  notebook,
  pageCount,
  updatedLabel,
  shelves = NOTEBOOK_CATEGORIES,
  onCreateShelf,
  onOpen,
  onRename,
  onChangeColor,
  onMoveCategory,
  onDelete,
}) => {
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingShelf, setAddingShelf] = useState(false);
  const [newShelfDraft, setNewShelfDraft] = useState('');
  const [draftTitle, setDraftTitle] = useState(notebook.title);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(notebook.title);
  }, [notebook.title]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftTitle(notebook.title);
        setMenuOpen(false);
        setIsRenaming(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [menuOpen, notebook.title]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-notebook-action]')) {
      return;
    }
    longPressTriggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMenuOpen(true);
    }, 520);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  };

  const triggerOpen = () => {
    if (menuOpen || isPickingUp) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onOpen(notebook.id);
      return;
    }

    setIsPickingUp(true);
    setTimeout(() => {
      onOpen(notebook.id);
      setIsPickingUp(false);
    }, 200);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-notebook-action]')) return;
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    triggerOpen();
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRename(notebook.id, trimmed);
      setIsRenaming(false);
      setMenuOpen(false);
    } else {
      setDraftTitle(notebook.title);
      setIsRenaming(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="group relative flex w-[144px] shrink-0 snap-start flex-col sm:w-[164px]"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${notebook.title}, ${notebook.category} notebook, ${pageCount} pages. Hold or activate info button to edit.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if ((e.target as HTMLElement).closest('[data-notebook-action]')) {
              return;
            }
            e.preventDefault();
            triggerOpen();
          }
        }}
        className={`pi-focusable w-full rounded-r-[12px] rounded-l-[6px] cursor-pointer transition-transform duration-200 ease-[var(--pi-ease-settle)] hover:-translate-y-1.5 ${
          isPickingUp ? 'pi-book-picking-up' : ''
        }`}
      >
        <NotebookCover
          title={notebook.title}
          subtitle={notebook.subtitle}
          category={notebook.category}
          coverColor={notebook.coverColor}
          pageCount={pageCount}
          updatedLabel={updatedLabel}
          actionSlot={
            <button
              type="button"
              data-notebook-action="true"
              aria-label={`Notebook details and options for ${notebook.title}`}
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
                setIsRenaming(false);
              }}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full cursor-pointer group/info"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-paper)] text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-xs group-hover/info:scale-105 transition-transform">
                <Info className="w-4 h-4" aria-hidden="true" />
              </span>
            </button>
          }
        />
      </div>

      {/* Long-press / options modal dialog (portaled to body so shelf bar never overlaps) */}
      {menuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-notebook-action="true"
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${notebook.title}`}
            onClick={() => {
              setDraftTitle(notebook.title);
              setMenuOpen(false);
              setIsRenaming(false);
              setConfirmDelete(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-scrim)] backdrop-blur-[2px]"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] rounded-[20px] bg-[var(--bg-paper-elevated)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-[var(--toolbar-shadow)] p-5"
            >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
            <span className="pi-label-micro text-[var(--text-muted)]">
              Notebook details
            </span>
            <button
              type="button"
              aria-label="Close notebook options"
              onClick={() => {
                setDraftTitle(notebook.title);
                setMenuOpen(false);
                setIsRenaming(false);
              }}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rename section */}
          <div className="pt-3">
            {isRenaming ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  aria-label="Notebook title"
                  autoFocus
                  className="pi-focusable flex-1 min-w-0 min-h-[44px] px-3 py-2 text-sm rounded-[10px] bg-[var(--bg-paper)] border border-[var(--border-strong)] text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  aria-label="Save notebook title"
                  className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsRenaming(true)}
                className="pi-focusable w-full text-left px-3 py-2 min-h-[44px] rounded-[12px] text-[14px] font-medium hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
              >
                Rename notebook…
              </button>
            )}
          </div>

          {/* Cover color swatches */}
          <div className="pt-3">
            <div className="pi-label-micro text-[var(--text-muted)] mb-1.5">
              Cover cloth
            </div>
            <div className="flex items-center flex-wrap gap-1">
              {(Object.keys(COVER_PALETTE) as CoverColor[]).map((colorKey) => {
                const swatch = COVER_PALETTE[colorKey];
                const isSelected = notebook.coverColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    aria-label={`Set cover color to ${swatch.label}`}
                    aria-pressed={isSelected}
                    title={swatch.label}
                    onClick={() => onChangeColor(notebook.id, colorKey)}
                    className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full cursor-pointer"
                  >
                    <span
                      style={{ backgroundColor: swatch.swatchHex }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] ring-offset-[var(--bg-paper-elevated)] scale-105'
                          : 'hover:scale-105'
                      }`}
                    >
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5"
                          style={{ color: swatch.inkVar }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category shelf mover */}
          <div className="pt-2">
            <div className="pi-label-micro text-[var(--text-muted)] mb-2">
              Move to shelf
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shelves.map((cat) => {
                const isCurrent = notebook.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={isCurrent}
                    onClick={() => {
                      onMoveCategory(notebook.id, cat);
                      setMenuOpen(false);
                    }}
                    className={`pi-focusable px-3.5 py-1.5 min-h-[40px] rounded-full text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)]'
                        : 'bg-[var(--bg-pill)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
              {onCreateShelf && !addingShelf && (
                <button
                  type="button"
                  onClick={() => setAddingShelf(true)}
                  className="pi-focusable inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] rounded-full text-[12px] font-medium border border-dashed border-[var(--border-strong)] text-[var(--accent-primary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>New shelf</span>
                </button>
              )}
            </div>
            {onCreateShelf && addingShelf && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newShelfDraft}
                  maxLength={60}
                  onChange={(e) => setNewShelfDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newShelfDraft.trim()) {
                        const created = onCreateShelf(newShelfDraft);
                        onMoveCategory(notebook.id, created);
                        setNewShelfDraft('');
                        setAddingShelf(false);
                        setMenuOpen(false);
                      }
                    }
                  }}
                  placeholder="Shelf name…"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newShelfDraft.trim()) {
                      const created = onCreateShelf(newShelfDraft);
                      onMoveCategory(notebook.id, created);
                      setMenuOpen(false);
                    }
                    setNewShelfDraft('');
                    setAddingShelf(false);
                  }}
                  className="h-9 px-3 rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] text-xs font-medium cursor-pointer"
                >
                  Move
                </button>
              </div>
            )}
          </div>

          {onDelete && (
            <div className="pt-3 mt-3 border-t border-[var(--border-hairline)]">
              {confirmDelete ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#B83B2B] font-medium">
                    Delete notebook &amp; {pageCount} {pageCount === 1 ? 'page' : 'pages'}?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 text-xs rounded-full border border-[var(--border-hairline)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(false);
                        onDelete(notebook.id);
                      }}
                      className="px-2.5 py-1 text-xs rounded-full bg-[#B83B2B] text-white cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="pi-focusable w-full text-left px-3 py-2 min-h-[40px] rounded-[12px] text-[13px] font-medium text-[#B83B2B] hover:bg-[#B83B2B]/10 transition-colors cursor-pointer"
                >
                  Delete notebook…
                </button>
              )}
            </div>
          )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
