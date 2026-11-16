import React, { useRef, useState } from 'react';
import { BookOpen, Check, FileText, Sparkles, Upload, X } from 'lucide-react';
import { localAndAiPdfPipeline, type PdfImportProgress } from '../lib/pdfPipeline';
import type { Book, CoverPalette, Shelf } from '../types/reader';

interface PdfImportModalProps {
  open: boolean;
  shelves: Shelf[];
  onClose: () => void;
  onConfirmImport: (book: Book, pdfBuffer?: ArrayBuffer) => Promise<void>;
}

const PALETTE_OPTIONS: Array<{ id: CoverPalette; label: string; swatch: string }> = [
  { id: 'terracotta-cream', label: 'Terracotta', swatch: '#C4572F' },
  { id: 'navy-gold', label: 'Deep Ink', swatch: '#1F2A3A' },
  { id: 'sage-linen', label: 'Sage Cloth', swatch: '#526B59' },
  { id: 'ochre-espresso', label: 'Warm Tan', swatch: '#9D7B52' },
  { id: 'plum-parchment', label: 'Wine', swatch: '#7A3229' },
  { id: 'forest-sand', label: 'Forest', swatch: '#2E4738' },
];

export const PdfImportModal: React.FC<PdfImportModalProps> = ({
  open,
  shelves,
  onClose,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<PdfImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [draftBook, setDraftBook] = useState<Book | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | undefined>(undefined);
  const [usedAiOcr, setUsedAiOcr] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const resetState = () => {
    setProgress(null);
    setError(null);
    setWarnings([]);
    setDraftBook(null);
    setPdfBuffer(undefined);
    setUsedAiOcr(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    resetState();
    onClose();
  };

  const handleFilePicked = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Please choose a PDF (.pdf) file.');
      return;
    }

    setError(null);
    setWarnings([]);
    setDraftBook(null);

    try {
      const result = await localAndAiPdfPipeline.importPdf(file, shelves, {
        allowAiOcrForScanned: true,
        onProgress: (p) => setProgress(p),
      });

      if (result.book) {
        setDraftBook(result.book);
        setPdfBuffer(result.pdfBuffer);
        setUsedAiOcr(result.usedAiOcr);
        setWarnings(result.warnings);
      }
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Could not extract text from this PDF.');
    }
  };

  const handleSaveBook = async () => {
    if (!draftBook) return;
    setIsSaving(true);
    try {
      await onConfirmImport(draftBook, pdfBuffer);
      resetState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save imported book locally.');
    } finally {
      setIsSaving(false);
    }
  };

  const isProcessing = progress !== null && progress.stage !== 'ready' && !draftBook;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-books-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-xs sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-paper-elevated)] p-6 text-[var(--pi-ink)] dark:bg-[var(--pi-desk-elevated)] dark:text-[var(--pi-ink-on-dark)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="pi-label text-[var(--pi-terracotta)]">Local Library · PDF Import</p>
            <h2 id="add-books-title" className="font-headline mt-1 text-2xl font-semibold">
              {draftBook ? 'Review Imported Book' : 'Add a PDF Book'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Add Books dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--pi-ink-muted)] hover:bg-[var(--pi-paper-muted)] dark:text-[var(--pi-ink-on-dark-muted)] dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!draftBook && !isProcessing && (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
              Import a PDF into reflowable chapters. Digital PDFs extract directly in your browser;
              scanned pages can use Gemini OCR (<span className="font-mono text-xs">gemini-4-hydrogen</span>)
              to digitize readable prose. Original PDFs always stay saved locally on your device.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => void handleFilePicked(e.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFilePicked(e.dataTransfer.files?.[0]);
              }}
              className="w-full rounded-[20px] border-2 border-dashed border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)]/60 px-6 py-10 text-center transition-colors hover:border-[var(--pi-terracotta)] dark:bg-white/[0.03] cursor-pointer"
            >
              <Upload className="mx-auto h-7 w-7 text-[var(--pi-terracotta)]" />
              <p className="mt-3 text-sm font-medium">Choose a PDF file or drop it here</p>
              <p className="mt-1 text-xs text-[var(--pi-ink-muted)] dark:text-[var(--pi-ink-on-dark-muted)]">
                Stored strictly inside IndexedDB on this browser
              </p>
            </button>
          </div>
        )}

        {isProcessing && progress && (
          <div className="mt-6 rounded-[18px] border border-[var(--pi-hairline)] bg-[var(--pi-paper)]/70 p-5 space-y-3 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--pi-terracotta)]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                {progress.stage === 'finding_chapters' ? 'AI Scanned Page OCR' : 'Processing PDF'}
              </span>
              {progress.currentPage && progress.totalPages && (
                <span className="tabular-nums">
                  Page {progress.currentPage} / {progress.totalPages}
                </span>
              )}
            </div>
            <p className="text-sm">{progress.detail}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--pi-terracotta)] transition-all duration-300"
                style={{
                  width:
                    progress.currentPage && progress.totalPages
                      ? `${Math.max(10, Math.round((progress.currentPage / progress.totalPages) * 100))}%`
                      : '45%',
                }}
              />
            </div>
          </div>
        )}

        {draftBook && (
          <div className="mt-5 space-y-4">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-600/25 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed"
              >
                {w}
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="font-medium opacity-70">Book Title</span>
                <input
                  type="text"
                  value={draftBook.title}
                  onChange={(e) => setDraftBook({ ...draftBook, title: e.target.value })}
                  className="h-10 w-full rounded-xl border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] px-3 text-sm dark:bg-[var(--pi-desk-dark)]"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium opacity-70">Author</span>
                <input
                  type="text"
                  value={draftBook.author}
                  onChange={(e) => setDraftBook({ ...draftBook, author: e.target.value })}
                  className="h-10 w-full rounded-xl border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] px-3 text-sm dark:bg-[var(--pi-desk-dark)]"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="font-medium opacity-70">Shelf</span>
                <select
                  value={draftBook.shelfId}
                  onChange={(e) => setDraftBook({ ...draftBook, shelfId: e.target.value })}
                  className="h-10 w-full rounded-xl border border-[var(--pi-hairline-strong)] bg-[var(--pi-paper)] px-3 text-sm dark:bg-[var(--pi-desk-dark)]"
                >
                  {shelves.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1 text-xs">
                <span className="font-medium opacity-70">Cover Cloth</span>
                <div className="flex items-center gap-2 pt-1.5">
                  {PALETTE_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.label}
                      onClick={() =>
                        setDraftBook({
                          ...draftBook,
                          cover: { ...draftBook.cover, palette: p.id },
                        })
                      }
                      className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                        draftBook.cover.palette === p.id
                          ? 'border-[var(--pi-terracotta)] scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: p.swatch }}
                    >
                      {draftBook.cover.palette === p.id && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--pi-hairline)] bg-[var(--pi-paper)]/65 p-3.5 text-xs space-y-2 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[var(--pi-terracotta)]" />
                  {draftBook.chapters.length} {draftBook.chapters.length === 1 ? 'chapter' : 'chapters'}{' '}
                  extracted ({draftBook.totalPages} PDF pages)
                </span>
                {usedAiOcr && (
                  <span className="rounded-full bg-[var(--pi-terracotta)]/12 px-2 py-0.5 text-[11px] text-[var(--pi-terracotta)]">
                    AI OCR text
                  </span>
                )}
              </div>
              <p className="line-clamp-3 leading-relaxed opacity-75 font-serif text-[13px]">
                {draftBook.chapters[0]?.paragraphs[0] || ''}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {draftBook ? (
            <>
              <button
                type="button"
                onClick={resetState}
                className="min-h-[44px] rounded-full border border-[var(--pi-hairline-strong)] px-4 text-xs font-medium hover:bg-[var(--pi-paper-muted)] dark:hover:bg-white/10"
              >
                Choose another PDF
              </button>
              <button
                type="button"
                disabled={isSaving || !draftBook.title.trim()}
                onClick={() => void handleSaveBook()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--pi-terracotta)] px-5 text-xs font-medium text-white hover:opacity-95 disabled:opacity-50 cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving to Library…' : 'Add to Library'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-full bg-[var(--pi-ink)] px-5 py-2 text-xs font-medium text-[var(--pi-paper)] dark:bg-[var(--pi-paper)] dark:text-[var(--pi-ink)]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
