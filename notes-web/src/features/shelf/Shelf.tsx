import React, { useMemo, useState } from 'react';
import { Plus, Camera, Sun, Moon, BookPlus, Cloud, CloudOff, FolderPlus, RefreshCw } from 'lucide-react';
import { AccountMenu } from '@paper-and-ink/design-system';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import { useNotesStore } from '../../store/useNotesStore';
import { Pill } from '../../components/Pill';
import { ShelfBar } from '../../components/ShelfBar';
import { NotebookCard } from '../../components/NotebookCard';
import { FloatingToolbar } from '../../components/FloatingToolbar';
import { PaperSurface } from '../../components/PaperSurface';
import { CreateNotebookModal } from './CreateNotebookModal';
import { ManageShelvesModal } from './ManageShelvesModal';
import { ScanHandwritingModal } from './ScanHandwritingModal';

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const Shelf: React.FC<{ auth: PaperInkAuthState }> = ({ auth }) => {
  const notebooks = useNotesStore((s) => s.notebooks);
  const pages = useNotesStore((s) => s.pages);
  const shelves = useNotesStore((s) => s.shelves);
  const shelfFilter = useNotesStore((s) => s.shelfFilter);
  const theme = useNotesStore((s) => s.theme);
  const cloudSyncState = useNotesStore((s) => s.cloudSyncState);
  const cloudSyncMessage = useNotesStore((s) => s.cloudSyncMessage);
  const syncWithCloud = useNotesStore((s) => s.syncWithCloud);
  const toggleTheme = useNotesStore((s) => s.toggleTheme);
  const setShelfFilter = useNotesStore((s) => s.setShelfFilter);
  const createShelf = useNotesStore((s) => s.createShelf);
  const renameShelf = useNotesStore((s) => s.renameShelf);
  const deleteShelf = useNotesStore((s) => s.deleteShelf);
  const openNotebook = useNotesStore((s) => s.openNotebook);
  const createNotebook = useNotesStore((s) => s.createNotebook);
  const deleteNotebook = useNotesStore((s) => s.deleteNotebook);
  const renameNotebook = useNotesStore((s) => s.renameNotebook);
  const changeNotebookColor = useNotesStore((s) => s.changeNotebookColor);
  const moveNotebookCategory = useNotesStore((s) => s.moveNotebookCategory);
  const createNewPage = useNotesStore((s) => s.createNewPage);

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [newNotebookOpen, setNewNotebookOpen] = useState(false);
  const [manageShelvesOpen, setManageShelvesOpen] = useState(false);

  const notebookCountsByShelf = useMemo(() => {
    const counts = new Map<string, number>();
    for (const nb of notebooks) {
      counts.set(nb.category, (counts.get(nb.category) ?? 0) + 1);
    }
    return counts;
  }, [notebooks]);

  const shelfFilterPills = useMemo(() => ['All', ...shelves], [shelves]);

  const pageCountsByNotebook = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pages) {
      counts.set(p.notebookId, (counts.get(p.notebookId) ?? 0) + 1);
    }
    return counts;
  }, [pages]);

  const filteredNotebooks = useMemo(() => {
    if (shelfFilter === 'All') return notebooks;
    return notebooks.filter((nb) => nb.category === shelfFilter);
  }, [notebooks, shelfFilter]);

  const handleNewNoteFromShelf = async () => {
    let targetNb = filteredNotebooks[0] ?? notebooks[0];
    if (!targetNb) {
      targetNb = await createNotebook({
        title: 'Field Notes',
        category: shelfFilter === 'All' ? 'Personal' : shelfFilter,
        coverColor: 'terracotta',
      });
    }
    await createNewPage({
      notebookId: targetNb.id,
      mode: 'typing',
      title: 'Untitled Note',
    });
  };

  const sectionLabel =
    shelfFilter === 'All' ? 'All Notebooks' : `${shelfFilter} Shelf`;

  return (
    <div className="min-h-screen pb-32">
      {/* Header zone with hairline separator matching Paper & Ink family */}
      <div className="border-b border-[var(--border-hairline)]">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-8 pt-5 sm:pt-9 pb-4 sm:pb-6">
          <header className="flex items-start justify-between gap-4">
            <div className="pt-1">
              <p className="pi-label-micro text-[var(--text-muted)]">
                Paper &amp; Ink
              </p>
              <h1 className="pi-heading-shelf text-[var(--text-primary)] mt-2">
                Your shelf
              </h1>
            </div>

            {/* Crisp circular icon buttons & Paper & Ink account controls */}
            <div className="flex items-center gap-2 shrink-0">
              <AccountMenu
                profile={auth.profile}
                isLoading={auth.isLoading}
                onLogin={auth.login}
                onRegister={auth.register}
                onUpdateProfile={auth.updateProfile}
                onLogout={auth.logout}
              />

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'light'
                    ? 'Switch to dark desk theme'
                    : 'Switch to light paper theme'
                }
                title={theme === 'light' ? 'Dark desk' : 'Light paper'}
                className="pi-focusable inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
              >
                {theme === 'light' ? (
                  <Moon className="w-[17px] h-[17px]" aria-hidden="true" />
                ) : (
                  <Sun className="w-[17px] h-[17px]" aria-hidden="true" />
                )}
              </button>
            </div>
          </header>

          {/* Horizontal Category Pill Filters + Customize Shelves + New Notebook */}
          <nav
            aria-label="Notebook shelf filters"
            className="mt-5 flex items-center justify-between gap-2.5"
          >
            <div className="pi-shelf-scroll flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {shelfFilterPills.map((filter) => (
                <Pill
                  key={filter}
                  active={shelfFilter === filter}
                  onClick={() => setShelfFilter(filter)}
                >
                  {filter}
                </Pill>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Pill
                variant="outline"
                size="sm"
                onClick={() => setManageShelvesOpen(true)}
                aria-label="Customize shelves"
                title="Customize shelves"
                className="shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Shelves</span>
              </Pill>
              <Pill
                variant="outline"
                size="sm"
                onClick={() => setNewNotebookOpen(true)}
                className="shrink-0"
              >
                <BookPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  New<span className="hidden sm:inline"> notebook</span>
                </span>
              </Pill>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Shelf Gallery */}
      <main className="max-w-[1060px] mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-28 sm:pb-32">
        {/* Editorial Section Heading + Sync + Count + Hairline Divider */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)] mb-6 sm:mb-7">
          <h2 className="pi-heading-section text-[var(--text-primary)]">
            {sectionLabel}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {auth.profile && (
              <button
                type="button"
                onClick={() => void syncWithCloud()}
                title={cloudSyncMessage || 'Synced with Supabase DB across devices'}
                className="pi-focusable inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
              >
                {cloudSyncState === 'syncing' ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-[var(--accent-primary)]" />
                ) : cloudSyncState === 'error' ? (
                  <CloudOff className="w-3 h-3 text-[#B83B2B]" />
                ) : (
                  <Cloud className="w-3 h-3 text-[#526B59]" />
                )}
                <span>
                  {cloudSyncState === 'syncing'
                    ? 'Syncing…'
                    : cloudSyncState === 'error'
                      ? 'Sync issue'
                      : 'DB Synced'}
                </span>
              </button>
            )}
            <span className="pi-meta pi-tabular text-[var(--text-muted)] shrink-0">
              {filteredNotebooks.length}{' '}
              {filteredNotebooks.length === 1 ? 'notebook' : 'notebooks'}
            </span>
          </div>
        </div>

        <div className="space-y-10">
          {filteredNotebooks.length > 0 ? (
            <ShelfBar>
              {filteredNotebooks.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  pageCount={pageCountsByNotebook.get(notebook.id) ?? 0}
                  updatedLabel={formatShortDate(notebook.updatedAt)}
                  shelves={shelves}
                  onCreateShelf={createShelf}
                  onOpen={openNotebook}
                  onRename={renameNotebook}
                  onChangeColor={changeNotebookColor}
                  onMoveCategory={moveNotebookCategory}
                  onDelete={(id) => void deleteNotebook(id)}
                />
              ))}
            </ShelfBar>
          ) : (
            <PaperSurface className="p-7 sm:p-10 text-center max-w-lg mx-auto mt-4">
              <p className="pi-label-micro text-[var(--text-muted)]">
                Empty shelf
              </p>
              <h3 className="pi-heading-section text-[var(--text-primary)] mt-2">
                {notebooks.length === 0
                  ? 'Your desk is ready for your first notebook'
                  : `No notebooks in ${shelfFilter}`}
              </h3>
              <p className="pi-ui-body text-[var(--text-secondary)] mt-2">
                {notebooks.length === 0
                  ? 'Create a bound notebook for typing or handwriting, or scan handwritten pages with AI OCR.'
                  : 'Create a notebook on this shelf or switch back to see all notebooks.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Pill active onClick={() => setNewNotebookOpen(true)}>
                  Create notebook
                </Pill>
                {notebooks.length > 0 && shelfFilter !== 'All' && (
                  <Pill variant="outline" onClick={() => setShelfFilter('All')}>
                    Show all notebooks
                  </Pill>
                )}
              </div>
            </PaperSurface>
          )}
        </div>
      </main>

      {/* Bottom Floating Dark Action Pills */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-0 z-30 flex justify-center px-3 sm:px-4 pointer-events-none">
        <FloatingToolbar
          ariaLabel="Shelf quick actions"
          className="pointer-events-auto max-w-full gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1.5"
        >
          <button
            type="button"
            onClick={handleNewNoteFromShelf}
            className="pi-focusable inline-flex items-center gap-1.5 sm:gap-2 min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 rounded-full bg-[var(--bg-toolbar-active)] text-[var(--text-on-toolbar-active)] text-[13px] sm:text-[14px] font-medium whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New note</span>
          </button>

          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="pi-focusable inline-flex items-center gap-1.5 sm:gap-2 min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-4 rounded-full text-[var(--text-on-toolbar)] hover:bg-white/10 text-[13px] sm:text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>Scan handwriting</span>
          </button>
        </FloatingToolbar>
      </div>

      <CreateNotebookModal
        open={newNotebookOpen}
        shelves={shelves}
        defaultShelf={shelfFilter === 'All' ? shelves[0] : shelfFilter}
        onClose={() => setNewNotebookOpen(false)}
        onCreateShelf={createShelf}
        onCreate={async (input) => {
          await createNotebook(input);
        }}
      />

      <ManageShelvesModal
        open={manageShelvesOpen}
        shelves={shelves}
        notebookCounts={notebookCountsByShelf}
        onClose={() => setManageShelvesOpen(false)}
        onCreateShelf={createShelf}
        onRenameShelf={renameShelf}
        onDeleteShelf={deleteShelf}
      />

      <ScanHandwritingModal
        open={scanModalOpen}
        notebooks={notebooks}
        defaultNotebookId={(filteredNotebooks[0] ?? notebooks[0])?.id}
        onClose={() => setScanModalOpen(false)}
        onSaveScannedPage={async (payload) => {
          let notebookId = payload.notebookId;
          if (!notebookId) {
            const created = await createNotebook({
              title: 'Scanned Notes',
              category: shelfFilter === 'All' ? 'Personal' : shelfFilter,
              coverColor: 'sage',
            });
            notebookId = created.id;
          }
          await createNewPage({
            notebookId,
            mode: 'typing',
            title: payload.title,
            content: payload.content,
            originalImage: payload.originalImage,
            conversionResult: payload.conversionResult,
            tags: ['handwriting-ocr'],
          });
        }}
      />
    </div>
  );
};
