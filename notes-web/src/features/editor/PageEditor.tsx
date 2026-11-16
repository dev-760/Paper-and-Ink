import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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
import { BoundNotebookSheet } from '../../components/BoundNotebookSheet';
import { TypingEditor } from './TypingEditor';
import { InkCanvas } from './InkCanvas';

function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

  const goToShelf = useNotesStore((s) => s.goToShelf);
  const goToNotebook = useNotesStore((s) => s.goToNotebook);
  const openPage = useNotesStore((s) => s.openPage);
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
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

  if (!notebook) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <PaperSurface className="max-w-md w-full p-8 text-center">
          <p className="pi-label-micro text-[var(--text-muted)]">
            Empty desk
          </p>
          <h2 className="pi-heading-section text-[var(--text-primary)] mt-2">
            Pick up a notebook from your shelf
          </h2>
        </PaperSurface>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[860px] mx-auto px-4 sm:px-8 lg:px-10 pt-4 sm:pt-8 pb-24">
          {showBackToNotebook && (
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goToShelf}
                className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-2.5 -ml-2.5 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Shelf</span>
              </button>
              <button
                type="button"
                onClick={goToNotebook}
                className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Index</span>
              </button>
            </div>
          )}

          <BoundNotebookSheet coverColor={notebook.coverColor} pageKey={`blank-${notebook.id}`}>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3 text-[var(--text-muted)] pi-label-micro">
              <span>{notebook.title}</span>
              <span className="pi-tabular">Page 01</span>
            </div>

            <div className="min-h-[380px] flex flex-col items-center justify-center text-center py-10">
              <p className="pi-label-micro text-[var(--text-muted)]">
                Fresh notebook
              </p>
              <h2 className="pi-heading-section text-[var(--text-primary)] mt-2">
                {notebook.title} is open to Page 1
              </h2>
              <p className="pi-ui-body text-[var(--text-secondary)] mt-2 max-w-md">
                Turn to a ruled typing sheet or pull out a pen to write directly in this notebook.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <Pill
                  variant="dark"
                  onClick={() =>
                    createNewPage({ notebookId: notebook.id, mode: 'typing' })
                  }
                >
                  <Keyboard className="w-4 h-4" aria-hidden="true" />
                  <span>Write Page 1</span>
                </Pill>
                <Pill
                  variant="outline"
                  onClick={() =>
                    createNewPage({ notebookId: notebook.id, mode: 'ink' })
                  }
                >
                  <PenTool className="w-4 h-4" aria-hidden="true" />
                  <span>Draw Page 1</span>
                </Pill>
              </div>
            </div>
          </BoundNotebookSheet>
        </div>
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

  const prevPage = pageNumber > 1 ? notebookPages[pageNumber - 2] ?? null : null;
  const nextPage = pageNumber < notebookPages.length ? notebookPages[pageNumber] ?? null : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[880px] mx-auto px-3 sm:px-8 lg:px-10 pt-3.5 sm:pt-7 pb-24">
        {/* Quiet Desk Controls above the Physical Notebook */}
        <header className="mb-3.5 sm:mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {showBackToNotebook && (
              <>
                <button
                  type="button"
                  onClick={goToShelf}
                  aria-label="Back to shelf"
                  className="pi-focusable inline-flex items-center gap-1.5 min-h-[42px] px-2.5 -ml-2 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Shelf</span>
                </button>
                <button
                  type="button"
                  onClick={goToNotebook}
                  aria-label="Notebook table of contents"
                  className="pi-focusable inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-full bg-[var(--bg-pill)] border border-[var(--border-hairline)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Index</span>
                </button>
              </>
            )}
            <span
              title={cloudSyncMessage || undefined}
              className="hidden sm:inline-block text-[12px] text-[var(--text-muted)] pi-tabular ml-1"
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
                        ? 'Saved locally'
                        : 'Saved locally'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Mode switcher: Typing / Ink */}
            <div
              role="tablist"
              aria-label="Page editing mode"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[var(--bg-pill)] border border-[var(--border-hairline)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={editorMode === 'typing'}
                onClick={() => setEditorMode('typing')}
                className={`pi-focusable inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
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
                className={`pi-focusable inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
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

            <Pill
              size="sm"
              variant="outline"
              onClick={handleRunConvert}
              disabled={isConverting}
              aria-label="Organize and convert note"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{isConverting ? 'Organizing…' : 'Organize'}</span>
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
                  className="pi-focusable inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full bg-[var(--accent-primary)] text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel delete page"
                  onClick={() => setConfirmDelete(false)}
                  className="pi-focusable inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Delete this page"
                onClick={() => setConfirmDelete(true)}
                className="pi-focusable inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-pill)] transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Physical Bound Notebook Sheet */}
        <BoundNotebookSheet coverColor={notebook.coverColor} pageKey={page.id}>
          {/* Journal Top Rule: Date, Notebook Name & Page Number */}
          <div className="flex items-center justify-between gap-2 pb-2.5 text-[11px] uppercase tracking-[0.11em] text-[var(--text-muted)] border-b border-[var(--paper-margin-line)]">
            <span className="truncate font-medium min-w-0">
              {notebook.title} · {formatEntryDate(page.createdAt)}
            </span>
            <span className="pi-tabular font-semibold shrink-0 pr-6 sm:pr-8 whitespace-nowrap">
              Page {String(pageNumber).padStart(2, '0')} of{' '}
              {String(notebookPages.length).padStart(2, '0')}
            </span>
          </div>

          {/* Notebook Entry Title directly on the paper top line */}
          <div className="pt-3 pb-2 border-b border-[var(--border-hairline)]">
            <input
              type="text"
              value={page.title}
              onChange={(e) =>
                updatePageContent(page.id, { title: e.target.value })
              }
              aria-label="Page title"
              placeholder="Untitled Note"
              className="pi-focusable w-full bg-transparent border-0 outline-none pi-heading-page text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 rounded-[6px]"
            />

            {/* Inline Page Tags */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {page.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 min-h-[26px] pl-2.5 pr-1.5 rounded-full bg-[var(--bg-paper-subtle)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-secondary)]"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    className="pi-focusable inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
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
                    className="pi-focusable w-28 min-h-[30px] px-2.5 py-0.5 text-[11px] rounded-full bg-[var(--bg-paper-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    aria-label="Add tag"
                    className="pi-focusable inline-flex items-center justify-center min-h-[30px] px-2.5 rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] text-[11px] font-medium cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTag(true)}
                  className="pi-focusable inline-flex items-center gap-1 min-h-[28px] px-2 rounded-full text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-paper-subtle)] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>Tag</span>
                </button>
              )}
            </div>
          </div>

          {/* Original vs Organized Comparison Drawer (when generated) */}
          {page.conversionResult && (
            <section className="my-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowComparePanel((v) => !v)}
                  aria-expanded={showComparePanel}
                  className="pi-focusable inline-flex items-center gap-2 min-h-[38px] px-3 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-[12px] font-medium cursor-pointer"
                >
                  <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
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
                <PaperSurface elevated className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:pr-4 md:border-r md:border-[var(--border-hairline)]">
                      <span className="pi-label-micro text-[var(--text-muted)]">
                        Original preserved source
                      </span>
                      {page.originalImage && (
                        <img
                          src={page.originalImage}
                          alt="Preserved original handwritten note"
                          className="w-full max-h-44 object-contain rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-paper)]"
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

                    <div className="space-y-2">
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
                        className="text-[1.1rem] font-medium text-[var(--text-primary)]"
                      >
                        {page.conversionResult.title}
                      </h3>
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-paper-subtle)] p-3 rounded-[14px] border border-[var(--border-hairline)] max-h-44 overflow-y-auto">
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

          {/* Active Paper Body directly on the Ruled Bound Leaf */}
          <main className="mt-4">
            {editorMode === 'typing' ? (
              <TypingEditor
                barePaper
                content={page.content}
                onChange={(next) =>
                  updatePageContent(page.id, { content: next })
                }
              />
            ) : (
              <InkCanvas
                barePaper
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

          {/* Physical Page-Turn Footer on Lower Margin */}
          <nav
            aria-label="Turn notebook pages"
            className="mt-6 pt-3.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-[12px]"
          >
            <button
              type="button"
              disabled={!prevPage}
              onClick={() => prevPage && openPage(prevPage.id)}
              className="pi-focusable inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-paper-subtle)] hover:text-[var(--text-primary)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Previous page</span>
            </button>

            <span className="pi-meta pi-tabular text-[var(--text-muted)]">
              Page {pageNumber} of {notebookPages.length}
            </span>

            {nextPage ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openPage(nextPage.id)}
                  className="pi-focusable inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-paper-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <span>Next page</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void createNewPage({ notebookId: notebook.id, mode: editorMode })}
                  aria-label="Add a blank page to notebook"
                  title="New page"
                  className="pi-focusable inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full bg-[var(--bg-pill)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void createNewPage({ notebookId: notebook.id, mode: editorMode })}
                className="pi-focusable inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full bg-[var(--bg-pill-active)] text-[var(--text-on-pill-active)] font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Turn to new page</span>
              </button>
            )}
          </nav>
        </BoundNotebookSheet>
      </div>
    </div>
  );
};
