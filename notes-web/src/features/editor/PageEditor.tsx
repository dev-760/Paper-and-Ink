import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Keyboard,
  PenTool,
  Sparkles,
  Trash2,
  Plus,
  X,
  Check,
  Columns2,
} from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';
import { Pill } from '../../components/Pill';
import { PaperSurface } from '../../components/PaperSurface';
import { TypingEditor } from './TypingEditor';
import { InkCanvas } from './InkCanvas';

export interface PageEditorProps {
  showBackToNotebook?: boolean;
}

export const PageEditor: React.FC<PageEditorProps> = ({
  showBackToNotebook = false,
}) => {
  const notebooks = useNotesStore((s) => s.notebooks);
  const pages = useNotesStore((s) => s.pages);
  const activeNotebookId = useNotesStore((s) => s.activeNotebookId);
  const activePageId = useNotesStore((s) => s.activePageId);
  const editorMode = useNotesStore((s) => s.editorMode);
  const theme = useNotesStore((s) => s.theme);
  const saveState = useNotesStore((s) => s.saveState);
  const cloudSyncState = useNotesStore((s) => s.cloudSyncState);
  const cloudSyncMessage = useNotesStore((s) => s.cloudSyncMessage);
  const isConverting = useNotesStore((s) => s.isConverting);

  const goToNotebook = useNotesStore((s) => s.goToNotebook);
  const setEditorMode = useNotesStore((s) => s.setEditorMode);
  const updatePageContent = useNotesStore((s) => s.updatePageContent);
  const savePageInk = useNotesStore((s) => s.savePageInk);
  const deletePage = useNotesStore((s) => s.deletePage);
  const convertPage = useNotesStore((s) => s.convertPage);
  const createNewPage = useNotesStore((s) => s.createNewPage);

  const [newTagText, setNewTagText] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showComparePanel, setShowComparePanel] = useState(false);

  const page = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId]
  );

  const notebook = useMemo(
    () =>
      notebooks.find((n) => n.id === (page?.notebookId ?? activeNotebookId)) ??
      null,
    [notebooks, page, activeNotebookId]
  );

  const notebookPages = useMemo(() => {
    if (!notebook) return [];
    return pages
      .filter((p) => p.notebookId === notebook.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, notebook]);

  const pageNumber = useMemo(() => {
    if (!page) return 1;
    const idx = notebookPages.findIndex((p) => p.id === page.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [notebookPages, page]);

  useEffect(() => {
    setConfirmDelete(false);
    setAddingTag(false);
    setNewTagText('');
    setShowComparePanel(Boolean(page?.conversionResult));
  }, [page?.id]);

  if (!page || !notebook) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <PaperSurface className="max-w-md w-full p-8 text-center">
          <p className="pi-label-micro text-[var(--text-muted)]">
            Empty desk
          </p>
          <h2 className="pi-heading-section text-[var(--text-primary)] mt-2">
            Open or start a page
          </h2>
          <p className="pi-ui-body text-[var(--text-secondary)] mt-2">
            Select any page from the notebook table of contents, or begin a
            fresh sheet.
          </p>
          {notebook && (
            <div className="mt-5">
              <Pill
                variant="dark"
                onClick={() =>
                  createNewPage({ notebookId: notebook.id, mode: 'typing' })
                }
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>New page</span>
              </Pill>
            </div>
          )}
        </PaperSurface>
      </div>
    );
  }

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagText.trim().toLowerCase().replace(/^#/, '');
    if (cleaned && !page.tags.includes(cleaned)) {
      updatePageContent(page.id, { tags: [...page.tags, cleaned] });
    }
    setNewTagText('');
    setAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updatePageContent(page.id, {
      tags: page.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleRunConvert = async () => {
    const res = await convertPage(page.id);
    if (res) {
      setShowComparePanel(true);
    }
  };

  const handleApplyOrganizedDraft = () => {
    if (!page.conversionResult) return;
    // Never discard original inkStrokes; only update typed draft cleanly
    const preservedSeparator = page.content.trim()
      ? `${page.content.trim()}\n\n---\n\n`
      : '';
    updatePageContent(page.id, {
      title: page.conversionResult.title,
      content: `${preservedSeparator}${page.conversionResult.cleanedMarkdown}`,
      tags: Array.from(new Set([...page.tags, ...page.conversionResult.tags])),
    });
    setEditorMode('typing');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[860px] mx-auto px-4 sm:px-8 lg:px-10 pt-4 sm:pt-8 pb-24">
        {/* Top Page Metadata & Mode Controls */}
        <header className="space-y-3.5 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {showBackToNotebook && (
                <button
                  type="button"
                  onClick={goToNotebook}
                  aria-label="Back to notebook table of contents"
                  className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-2.5 -ml-2.5 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Pages</span>
                </button>
              )}
              <div className="flex items-center gap-2 min-w-0 text-[var(--text-muted)] pi-label-micro">
                <span className="truncate">{notebook.title}</span>
                <span aria-hidden="true">·</span>
                <span className="pi-tabular shrink-0">
                  Page {String(pageNumber).padStart(2, '0')} of{' '}
                  {String(notebookPages.length).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Quiet autosave + DB sync indicator + Organize + Delete */}
            <div className="flex items-center gap-2">
              <span
                title={cloudSyncMessage || undefined}
                className="text-[12px] text-[var(--text-muted)] pi-tabular mr-1"
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save issue'
                    : cloudSyncState === 'syncing'
                      ? 'Syncing DB…'
                      : cloudSyncState === 'synced'
                        ? 'Synced to DB'
                        : cloudSyncState === 'error'
                          ? 'Saved locally (DB sync offline)'
                          : 'Saved locally'}
              </span>

              <Pill
                size="sm"
                variant="outline"
                onClick={handleRunConvert}
                disabled={isConverting}
                aria-label="Organize and convert note"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isConverting ? 'Organizing…' : 'Organize'}</span>
              </Pill>

              {confirmDelete ? (
                <div className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-paper-elevated)] border border-[var(--border-strong)] px-2 py-0.5">
                  <span className="text-[12px] text-[var(--text-secondary)] px-1.5">
                    Delete?
                  </span>
                  <button
                    type="button"
                    aria-label="Confirm delete page"
                    onClick={() => deletePage(page.id)}
                    className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full bg-[var(--accent-primary)] text-white cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel delete page"
                    onClick={() => setConfirmDelete(false)}
                    className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Delete this page"
                  onClick={() => setConfirmDelete(true)}
                  className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Large Serif Page Title */}
          <div>
            <input
              type="text"
              value={page.title}
              onChange={(e) =>
                updatePageContent(page.id, { title: e.target.value })
              }
              aria-label="Page title"
              placeholder="Untitled Note"
              className="pi-focusable w-full bg-transparent border-0 outline-none pi-heading-page text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 rounded-[8px]"
            />
          </div>

          {/* Tag pills + Editing Mode Switch (Typing vs Ink) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {page.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 min-h-[30px] pl-3 pr-2 rounded-full bg-[var(--bg-pill)] text-[12px] font-medium text-[var(--text-secondary)]"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    className="pi-focusable inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {addingTag ? (
                <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setNewTagText('');
                        setAddingTag(false);
                      }
                    }}
                    placeholder="tag name"
                    aria-label="New tag name"
                    autoFocus
                    onBlur={() => {
                      if (!newTagText.trim()) setAddingTag(false);
                    }}
                    className="pi-focusable w-32 min-h-[36px] px-3 py-1 text-[12px] rounded-full bg-[var(--bg-paper)] border border-[var(--border-strong)] text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    aria-label="Add tag"
                    className="pi-focusable inline-flex items-center justify-center min-h-[36px] px-2.5 rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] text-[12px] font-medium cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTag(true)}
                  className="pi-focusable inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>Add tag</span>
                </button>
              )}
            </div>

            {/* Mode switcher: Typing / Ink */}
            <div
              role="tablist"
              aria-label="Page editing mode"
              className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--bg-pill)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={editorMode === 'typing'}
                onClick={() => setEditorMode('typing')}
                className={`pi-focusable inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  editorMode === 'typing'
                    ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Typing</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editorMode === 'ink'}
                onClick={() => setEditorMode('ink')}
                className={`pi-focusable inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  editorMode === 'ink'
                    ? 'bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  Ink{page.inkStrokes.length > 0 ? ` (${page.inkStrokes.length})` : ''}
                </span>
              </button>
            </div>
          </div>

          {/* Thin hairline divider */}
          <div className="h-px bg-[var(--border-hairline)]" />
        </header>

        {/* Original vs Organized Mock Conversion Panel */}
        {page.conversionResult && (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowComparePanel((v) => !v)}
                aria-expanded={showComparePanel}
                className="pi-focusable inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-[13px] font-medium cursor-pointer"
              >
                <Columns2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {showComparePanel
                    ? 'Hide Original vs. Organized view'
                    : 'View Original vs. Organized conversion'}
                </span>
              </button>
              <span className="pi-meta pi-tabular text-[var(--text-muted)]">
                Confidence {Math.round(page.conversionResult.confidence * 100)}%
              </span>
            </div>

            {showComparePanel && (
              <PaperSurface elevated className="p-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Original preserved layer */}
                  <div className="space-y-2 md:pr-4 md:border-r md:border-[var(--border-hairline)]">
                    <span className="pi-label-micro text-[var(--text-muted)]">
                      Original preserved source
                    </span>
                    {page.originalImage && (
                      <img
                        src={page.originalImage}
                        alt="Preserved original handwritten note"
                        className="w-full max-h-48 object-contain rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-paper)]"
                      />
                    )}
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                      {page.conversionResult.sourceExcerpt}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] pi-tabular">
                      Vector strokes preserved:{' '}
                      {page.inkStrokes.length} (never overwritten)
                    </p>
                  </div>

                  {/* AI OCR & Organized Output */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="pi-label-micro text-[var(--accent-primary)]">
                        AI OCR &amp; Organized Output
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)]">
                        Shelf: {page.conversionResult.suggestedNotebook}
                      </span>
                    </div>
                    <h3
                      style={{ fontFamily: 'var(--pi-font-serif)' }}
                      className="text-[1.15rem] font-medium text-[var(--text-primary)]"
                    >
                      {page.conversionResult.title}
                    </h3>
                    <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-paper-subtle)] p-3 rounded-[14px] border border-[var(--border-hairline)] max-h-48 overflow-y-auto">
                      {page.conversionResult.cleanedMarkdown}
                    </pre>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[12px] text-[var(--text-muted)]">
                        Suggested tags: {page.conversionResult.tags.join(', ')}
                      </span>
                      <Pill size="sm" variant="outline" onClick={handleApplyOrganizedDraft}>
                        Append to typed draft
                      </Pill>
                    </div>
                  </div>
                </div>
              </PaperSurface>
            )}
          </section>
        )}

        {/* Active Paper Editing Area (data preserved across mode switches) */}
        <main className="mt-6">
          {editorMode === 'typing' ? (
            <TypingEditor
              content={page.content}
              onChange={(next) =>
                updatePageContent(page.id, { content: next })
              }
            />
          ) : (
            <InkCanvas
              pageId={page.id}
              strokes={page.inkStrokes}
              theme={theme}
              isConverting={isConverting}
              onStrokesChange={(nextStrokes) =>
                savePageInk(page.id, nextStrokes)
              }
              onConvert={handleRunConvert}
            />
          )}
        </main>
      </div>
    </div>
  );
};
