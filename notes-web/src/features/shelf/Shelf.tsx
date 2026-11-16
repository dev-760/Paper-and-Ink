import React, { useMemo, useState } from 'react';
import { Plus, Camera, Sun, Moon, BookPlus, Cloud, CloudOff, FolderPlus, Pencil, RefreshCw } from 'lucide-react';
import { AccountMenu } from '@paper-and-ink/design-system';
import type { PaperInkAuthState } from '@paper-and-ink/auth';
import { useNotesStore } from '../../store/useNotesStore';
import { Pill } from '../../components/Pill';
import { ShelfBar } from '../../components/ShelfBar';
import { NotebookCard } from '../../components/NotebookCard';
import { FloatingToolbar } from '../../components/FloatingToolbar';
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
  const theme = useNotesStore((s) => s.theme);
  const cloudSyncState = useNotesStore((s) => s.cloudSyncState);
  const cloudSyncMessage = useNotesStore((s) => s.cloudSyncMessage);
  const syncWithCloud = useNotesStore((s) => s.syncWithCloud);
  const toggleTheme = useNotesStore((s) => s.toggleTheme);
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

  const pageCountsByNotebook = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pages) {
      counts.set(p.notebookId, (counts.get(p.notebookId) ?? 0) + 1);
    }
    return counts;
  }, [pages]);

  const handleNewNoteFromShelf = async () => {
    let targetNb = notebooks[0];
    if (!targetNb) {
      targetNb = await createNotebook({
        title: 'Field Notes',
        category: shelves[0] || 'Personal',
        coverColor: 'terracotta',
      });
    }
    await createNewPage({
      notebookId: targetNb.id,
      mode: 'typing',
      title: 'Untitled Note',
    });
  };

  const visibleShelves = useMemo(() => {
    return shelves.length > 0 ? shelves : ['Personal'];
  }, [shelves]);

  const notebooksByShelf = useMemo(() => {
    const grouped = new Map<string, typeof notebooks>();
    for (const shelfName of visibleShelves) {
      grouped.set(shelfName, []);
    }
    for (const nb of notebooks) {
      const list = grouped.get(nb.category) ?? [];
      list.push(nb);
      grouped.set(nb.category, list);
    }
    return grouped;
  }, [visibleShelves, notebooks]);

  return (
    <div className="min-h-screen pb-32">
      {/* Header zone with hairline separator matching Paper & Ink family */}
      <div className="border-b border-[var(--border-hairline)]">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-8 pt-5 sm:pt-9 pb-4 sm:pb-6">
          <header className="flex items-start justify-between gap-4">
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="pi-label-micro text-[var(--text-muted)]">
                  Paper &amp; Ink
                </p>
                {auth.profile && (
                  <button
                    type="button"
                    onClick={() => void syncWithCloud()}
                    title={cloudSyncMessage || 'Synced with Supabase DB across devices'}
                    className="pi-focusable inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
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
              </div>
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

          {/* Customize Shelves + New Notebook */}
          <div className="mt-4 flex items-center justify-end gap-2">
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
              aria-label="New notebook"
              title="New notebook"
              className="shrink-0"
            >
              <BookPlus className="w-3.5 h-3.5" aria-hidden="true" />
            </Pill>
          </div>
        </div>
      </div>

      {/* Main Shelf Gallery — each shelf stacked cleanly one above another */}
      <main className="max-w-[1060px] mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-28 sm:pb-32">
        <div className="space-y-10 sm:space-y-12">
          {visibleShelves.map((shelfName) => {
            const shelfNotebooks = notebooksByShelf.get(shelfName) ?? [];
            return (
              <section key={shelfName} aria-labelledby={`notes-shelf-${shelfName}`}>
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-2.5">
                  <h2
                    id={`notes-shelf-${shelfName}`}
                    className="pi-heading-section truncate text-[var(--text-primary)]"
                  >
                    {shelfName}
                  </h2>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="pi-meta pi-tabular text-[var(--text-muted)] whitespace-nowrap">
                      {shelfNotebooks.length}{' '}
                      {shelfNotebooks.length === 1 ? 'notebook' : 'notebooks'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setManageShelvesOpen(true)}
                      aria-label={`Customize ${shelfName} shelf`}
                      title="Customize shelves"
                      className="pi-focusable inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-pill-hover)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <ShelfBar emptyText="No notebooks on this shelf yet.">
                  {shelfNotebooks.map((notebook) => (
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
              </section>
            );
          })}
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
        defaultShelf={shelves[0]}
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
        defaultNotebookId={notebooks[0]?.id}
        onClose={() => setScanModalOpen(false)}
        onSaveScannedPage={async (payload) => {
          let notebookId = payload.notebookId;
          if (!notebookId) {
            const created = await createNotebook({
              title: 'Scanned Notes',
              category: shelves[0] || 'Personal',
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
