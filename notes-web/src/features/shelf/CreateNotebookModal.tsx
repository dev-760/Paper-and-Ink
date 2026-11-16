import React, { useEffect, useState } from 'react';
import { BookPlus, Check, Plus, X } from 'lucide-react';
import {
  COVER_PALETTE,
  type CoverColor,
  type NotebookCategory,
} from '../../types/notebook';
import { Pill } from '../../components/Pill';
import { PaperSurface } from '../../components/PaperSurface';

interface CreateNotebookModalProps {
  open: boolean;
  shelves: string[];
  defaultShelf?: string;
  onClose: () => void;
  onCreateShelf: (name: string) => string;
  onCreate: (input: {
    title: string;
    subtitle?: string;
    category: NotebookCategory;
    coverColor: CoverColor;
  }) => Promise<void>;
}

export const CreateNotebookModal: React.FC<CreateNotebookModalProps> = ({
  open,
  shelves,
  defaultShelf,
  onClose,
  onCreateShelf,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<NotebookCategory>(
    defaultShelf || shelves[0] || 'Personal',
  );
  const [addingShelf, setAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [coverColor, setCoverColor] = useState<CoverColor>('terracotta');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(
      defaultShelf && defaultShelf !== 'All'
        ? defaultShelf
        : shelves[0] || 'Personal',
    );
    setAddingShelf(false);
    setNewShelfName('');
  }, [open, defaultShelf, shelves]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({ title, subtitle, category, coverColor });
      setTitle('');
      setSubtitle('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-notebook-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[var(--bg-scrim)]"
      onClick={onClose}
    >
      <PaperSurface elevated className="w-full max-w-md p-6 sm:p-7">
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="pi-label-micro text-[var(--accent-primary)]">New Volume</span>
              <h2 id="create-notebook-title" className="pi-heading-section text-[var(--text-primary)] mt-1">
                Create a notebook
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close new notebook dialog"
              onClick={onClose}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-[var(--text-muted)]">Notebook title</span>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Autumn Sketchbook"
              className="w-full h-10 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-[var(--text-muted)]">Subtitle (optional)</span>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Field observations & sketches"
              className="w-full h-10 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
            />
          </label>

          <div className="space-y-1.5 text-xs">
            <span className="font-medium text-[var(--text-muted)]">Shelf</span>
            <div className="flex flex-wrap gap-1.5">
              {shelves.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    category === cat
                      ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)]'
                      : 'bg-[var(--bg-pill)] border border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {!addingShelf && (
                <button
                  type="button"
                  onClick={() => setAddingShelf(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[var(--border-strong)] text-[var(--accent-primary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>New shelf</span>
                </button>
              )}
            </div>
            {addingShelf && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newShelfName}
                  maxLength={60}
                  onChange={(e) => setNewShelfName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newShelfName.trim()) {
                        const created = onCreateShelf(newShelfName);
                        setCategory(created);
                        setNewShelfName('');
                        setAddingShelf(false);
                      }
                    }
                  }}
                  placeholder="Shelf name…"
                  className="flex-1 h-9 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newShelfName.trim()) {
                      const created = onCreateShelf(newShelfName);
                      setCategory(created);
                    }
                    setNewShelfName('');
                    setAddingShelf(false);
                  }}
                  className="h-9 px-3 rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] text-xs font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="font-medium text-[var(--text-muted)]">Cloth binding</span>
            <div className="flex items-center flex-wrap gap-2">
              {(Object.keys(COVER_PALETTE) as CoverColor[]).map((colorKey) => {
                const swatch = COVER_PALETTE[colorKey];
                const selected = coverColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    aria-label={swatch.label}
                    onClick={() => setCoverColor(colorKey)}
                    style={{ backgroundColor: swatch.swatchHex }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                      selected ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] scale-105' : ''
                    }`}
                  >
                    {selected && <Check className="w-4 h-4" style={{ color: swatch.inkVar }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Pill variant="outline" onClick={onClose}>
              Cancel
            </Pill>
            <Pill type="submit" variant="dark" disabled={saving || !title.trim()}>
              <BookPlus className="w-4 h-4" aria-hidden="true" />
              <span>{saving ? 'Creating…' : 'Create notebook'}</span>
            </Pill>
          </div>
        </form>
      </PaperSurface>
    </div>
  );
};
