import React, { useEffect, useState } from 'react';
import { Check, Layers, Trash2, X } from 'lucide-react';
import { PAPER_AND_INK_TOKENS, type ShelfTone } from '../design-system/tokens';
import type { Shelf } from '../types/reader';

interface ShelfModalProps {
  open: boolean;
  editingShelf: Shelf | null;
  canDelete: boolean;
  onClose: () => void;
  onSave: (input: { id?: string; title: string; description?: string; tone: ShelfTone }) => Promise<void>;
  onDelete?: (shelfId: string) => Promise<void>;
}

const TONE_OPTIONS: Array<{ id: ShelfTone; label: string; swatch: string }> = [
  { id: 'sage', label: 'Sage', swatch: '#587660' },
  { id: 'terracotta', label: 'Terracotta', swatch: '#C4572F' },
  { id: 'navy', label: 'Navy', swatch: '#1F2A3A' },
  { id: 'tan', label: 'Archival Tan', swatch: '#AB885C' },
];

export const ShelfModal: React.FC<ShelfModalProps> = ({
  open,
  editingShelf,
  canDelete,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<ShelfTone>('sage');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editingShelf?.title ?? '');
    setDescription(editingShelf?.description ?? '');
    setTone(editingShelf?.tone ?? 'sage');
    setConfirmDelete(false);
  }, [open, editingShelf]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave({
        ...(editingShelf ? { id: editingShelf.id } : {}),
        title: trimmed,
        description: description.trim() || undefined,
        tone,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-shelf-modal-title"
      onClick={() => !saving && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-6 text-[var(--pi-ink)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)] sm:rounded-[24px] sm:p-7 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="pi-label text-[var(--pi-terracotta)]">
              {editingShelf ? 'Edit Shelf' : 'Custom Shelf'}
            </p>
            <h2
              id="reader-shelf-modal-title"
              className="font-headline mt-1 text-2xl font-semibold tracking-tight"
            >
              {editingShelf ? 'Customize shelf' : 'Create a shelf'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close shelf modal"
            onClick={() => !saving && onClose()}
            className="flex min-h-[44px] min-w-[44px] -mr-2 -mt-2 items-center justify-center rounded-full text-[var(--pi-ink-muted)] hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium opacity-75">Shelf name</span>
          <input
            type="text"
            required
            autoFocus
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Architecture & Essays"
            className="h-10 w-full rounded-xl border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] px-3 text-sm dark:bg-[var(--pi-desk-dark)]"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-medium opacity-75">Note (optional)</span>
          <input
            type="text"
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description for this shelf"
            className="h-10 w-full rounded-xl border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] px-3 text-sm dark:bg-[var(--pi-desk-dark)]"
          />
        </label>

        <div className="space-y-1.5 text-xs">
          <span className="font-medium opacity-75">Acrylic shelf tint</span>
          <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((item) => {
              const selected = tone === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTone(item.id)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'border-[var(--pi-terracotta)] bg-[var(--pi-paper-muted)] dark:bg-white/10'
                      : 'border-[var(--pi-hairline)] bg-[var(--pi-paper)] dark:bg-[var(--pi-desk-dark)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span>{PAPER_AND_INK_TOKENS.acrylicShelves[item.id].label}</span>
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" />}
                </button>
              );
            })}
          </div>
        </div>

        {editingShelf && canDelete && onDelete && (
          <div className="border-t border-[var(--pi-hairline)] pt-3">
            {confirmDelete ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#B83B2B] font-medium">
                  Remove shelf? Books move to another shelf.
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-full border border-[var(--pi-hairline-strong)] px-3 py-1 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onDelete(editingShelf.id);
                        onClose();
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="rounded-full bg-[#B83B2B] px-3 py-1 text-xs text-white cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B83B2B] hover:underline cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete shelf…</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="min-h-[42px] rounded-full border border-[var(--pi-hairline-strong)] px-4 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[var(--pi-terracotta)] px-5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{saving ? 'Saving…' : editingShelf ? 'Save shelf' : 'Create shelf'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
