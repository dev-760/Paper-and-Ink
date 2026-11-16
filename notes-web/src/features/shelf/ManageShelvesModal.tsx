import React, { useState } from 'react';
import { Check, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { PaperSurface } from '../../components/PaperSurface';
import { Pill } from '../../components/Pill';

interface ManageShelvesModalProps {
  open: boolean;
  shelves: string[];
  notebookCounts: Map<string, number>;
  onClose: () => void;
  onCreateShelf: (name: string) => string;
  onRenameShelf: (oldName: string, newName: string) => Promise<void>;
  onDeleteShelf: (name: string) => Promise<void>;
}

export const ManageShelvesModal: React.FC<ManageShelvesModalProps> = ({
  open,
  shelves,
  notebookCounts,
  onClose,
  onCreateShelf,
  onRenameShelf,
  onDeleteShelf,
}) => {
  const [newName, setNewName] = useState('');
  const [editingShelf, setEditingShelf] = useState<string | null>(null);
  const [draftRename, setDraftRename] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateShelf(newName);
    setNewName('');
  };

  const handleRenameSubmit = async (oldName: string) => {
    const trimmed = draftRename.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingShelf(null);
      return;
    }
    setBusy(true);
    try {
      await onRenameShelf(oldName, trimmed);
      setEditingShelf(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-shelves-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[var(--bg-scrim)] backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <PaperSurface elevated className="w-full max-w-md p-6 sm:p-7 max-h-[85dvh] overflow-y-auto">
        <div onClick={(e) => e.stopPropagation()} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="pi-label-micro text-[var(--accent-primary)]">Customize</span>
              <h2
                id="manage-shelves-title"
                className="pi-heading-section text-[var(--text-primary)] mt-1"
              >
                Your shelves
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close customize shelves dialog"
              onClick={() => !busy && onClose()}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder="New shelf name…"
              aria-label="New shelf name"
              className="pi-focusable flex-1 h-10 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
            />
            <Pill type="submit" variant="dark" size="sm" disabled={!newName.trim() || busy}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add</span>
            </Pill>
          </form>

          <div className="space-y-2 pt-1">
            {shelves.map((shelf) => {
              const count = notebookCounts.get(shelf) ?? 0;
              const isEditing = editingShelf === shelf;
              return (
                <div
                  key={shelf}
                  className="flex items-center justify-between gap-2 rounded-[14px] border border-[var(--border-hairline)] bg-[var(--bg-paper-subtle)] px-3.5 py-2.5"
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={draftRename}
                        autoFocus
                        maxLength={60}
                        onChange={(e) => setDraftRename(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleRenameSubmit(shelf);
                          } else if (e.key === 'Escape') {
                            setEditingShelf(null);
                          }
                        }}
                        className="pi-focusable flex-1 min-w-0 h-9 px-2.5 rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        aria-label="Save shelf name"
                        disabled={busy}
                        onClick={() => void handleRenameSubmit(shelf)}
                        className="pi-focusable inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {shelf}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] pi-tabular">
                          {count} {count === 1 ? 'notebook' : 'notebooks'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label={`Rename ${shelf}`}
                          onClick={() => {
                            setEditingShelf(shelf);
                            setDraftRename(shelf);
                          }}
                          className="pi-focusable inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {shelves.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Delete ${shelf}`}
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await onDeleteShelf(shelf);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="pi-focusable inline-flex h-9 w-9 items-center justify-center rounded-full text-[#B83B2B] hover:bg-[#B83B2B]/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Shelves appear as tabs above
            </span>
            <Pill variant="outline" size="sm" onClick={() => !busy && onClose()}>
              Done
            </Pill>
          </div>
        </div>
      </PaperSurface>
    </div>
  );
};
