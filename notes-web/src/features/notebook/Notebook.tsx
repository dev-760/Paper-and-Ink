import React, { useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { COVER_PALETTE } from '../../types/notebook';
import { useNotesStore } from '../../store/useNotesStore';
import { PageListItem } from '../../components/PageListItem';
import { Pill } from '../../components/Pill';

export interface NotebookProps {
  compactRail?: boolean;
  showBackToShelf?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

function formatPageDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildPreview(content: string): string {
  const cleaned = content
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^[-*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/\*/g, '')
    .trim();
  return cleaned;
}

export const Notebook: React.FC<NotebookProps> = ({
  compactRail = false,
  showBackToShelf = true,
  searchInputRef,
}) => {
  const notebooks = useNotesStore((s) => s.notebooks);
  const pages = useNotesStore((s) => s.pages);
  const activeNotebookId = useNotesStore((s) => s.activeNotebookId);
  const activePageId = useNotesStore((s) => s.activePageId);
  const pageSearchQuery = useNotesStore((s) => s.pageSearchQuery);

  const goToShelf = useNotesStore((s) => s.goToShelf);
  const openPage = useNotesStore((s) => s.openPage);
  const setPageSearchQuery = useNotesStore((s) => s.setPageSearchQuery);
  const createNewPage = useNotesStore((s) => s.createNewPage);

  const localSearchRef = useRef<HTMLInputElement>(null);
  const resolvedSearchRef = searchInputRef ?? localSearchRef;

  const notebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) ?? notebooks[0] ?? null,
    [notebooks, activeNotebookId]
  );

  const notebookPages = useMemo(() => {
    if (!notebook) return [];
    return pages
      .filter((p) => p.notebookId === notebook.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [pages, notebook]);

  const filteredPages = useMemo(() => {
    const q = pageSearchQuery.trim().toLowerCase();
    if (!q) return notebookPages;
    return notebookPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notebookPages, pageSearchQuery]);

  if (!notebook) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)]">
        Select a notebook from the shelf.
      </div>
    );
  }

  const cover = COVER_PALETTE[notebook.coverColor];

  return (
    <div
      className={`flex flex-col h-full ${
        compactRail ? '' : 'max-w-[780px] mx-auto px-5 sm:px-8 pt-6 pb-20'
      }`}
    >
      {/* Top navigation & notebook header */}
      <header className={compactRail ? 'px-4 pt-5 pb-4' : 'pb-5'}>
        {showBackToShelf && (
          <button
            type="button"
            onClick={goToShelf}
            className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 rounded-full text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Your shelf</span>
          </button>
        )}

        <div className="mt-2 flex items-start gap-3.5">
          {/* Tactile cover color bookmark ribbon */}
          <div
            aria-hidden="true"
            style={{ backgroundColor: cover.bgVar }}
            className="w-3 self-stretch rounded-full shrink-0 mt-1"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[var(--text-muted)] pi-label-micro">
              <span>{notebook.category}</span>
              <span aria-hidden="true">·</span>
              <span className="pi-tabular">
                {notebookPages.length}{' '}
                {notebookPages.length === 1 ? 'page' : 'pages'}
              </span>
            </div>
            <h1
              className={`text-[var(--text-primary)] mt-1 ${
                compactRail ? 'pi-heading-section text-[1.5rem]' : 'pi-heading-notebook'
              }`}
            >
              {notebook.title}
            </h1>
            {notebook.subtitle && (
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                {notebook.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Page search + New page bar */}
        <div className="mt-5 flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              ref={resolvedSearchRef}
              type="search"
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="Filter pages or tags…"
              aria-label="Filter pages in this notebook"
              className="pi-focusable w-full min-h-[44px] pl-10 pr-9 rounded-full bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            {pageSearchQuery && (
              <button
                type="button"
                aria-label="Clear page search"
                onClick={() => setPageSearchQuery('')}
                className="pi-focusable absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-pill)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Pill
            variant="dark"
            onClick={() =>
              createNewPage({ notebookId: notebook.id, mode: 'typing' })
            }
            aria-label="Create new page in this notebook"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className={compactRail ? 'hidden sm:inline' : ''}>
              New page
            </span>
          </Pill>
        </div>
      </header>

      {/* Hairline divider */}
      <div className="h-px bg-[var(--border-hairline)] mx-4 sm:mx-0" />

      {/* Editorial Table of Contents list */}
      <div
        className={`flex-1 overflow-y-auto ${
          compactRail ? 'px-2 py-2' : 'pt-3 space-y-1'
        }`}
      >
        {filteredPages.length > 0 ? (
          <div role="list" aria-label="Notebook table of contents">
            {filteredPages.map((page, index) => (
              <div key={page.id} role="listitem">
                <PageListItem
                  pageNumber={index + 1}
                  title={page.title}
                  dateLabel={formatPageDate(page.updatedAt)}
                  tags={page.tags}
                  hasInk={page.inkStrokes.length > 0}
                  hasOrganizedVersion={Boolean(page.conversionResult)}
                  preview={buildPreview(page.content)}
                  active={activePageId === page.id}
                  onSelect={() => openPage(page.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 px-4 text-center">
            <p className="pi-ui-body text-[var(--text-secondary)]">
              {pageSearchQuery
                ? `No pages match “${pageSearchQuery}”.`
                : 'This notebook has no pages yet.'}
            </p>
            {pageSearchQuery ? (
              <button
                type="button"
                onClick={() => setPageSearchQuery('')}
                className="pi-focusable mt-3 text-[13px] font-medium text-[var(--accent-primary)] underline underline-offset-4 cursor-pointer"
              >
                Reset filter
              </button>
            ) : (
              <div className="mt-4">
                <Pill
                  active
                  onClick={() =>
                    createNewPage({ notebookId: notebook.id, mode: 'typing' })
                  }
                >
                  Write the first page
                </Pill>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
