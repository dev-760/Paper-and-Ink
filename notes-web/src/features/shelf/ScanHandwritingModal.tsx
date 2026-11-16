import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FileUp,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { Notebook } from '../../types/notebook';
import type { ConversionResult } from '../../types/note';
import { Pill } from '../../components/Pill';
import { PaperSurface } from '../../components/PaperSurface';
import { runServerHandwritingOcr } from '../organize/organizeNote';

interface ScanHandwritingModalProps {
  open: boolean;
  notebooks: Notebook[];
  defaultNotebookId?: string;
  onClose: () => void;
  onSaveScannedPage: (payload: {
    notebookId: string;
    title: string;
    content: string;
    originalImage?: string;
    conversionResult?: ConversionResult | null;
  }) => Promise<void>;
}

const DIRECT_OCR_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_CANVAS_EDGE = 2000;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Text file must be 2 MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}

function readRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

function renderToJpegDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not initialize image canvas.'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () =>
      reject(new Error('Please select a PNG, JPEG, or WebP photo of your handwritten notes.'));
    img.src = src;
  });
}

async function normalizeImageFileToDataUrl(file: File): Promise<string> {
  const raw = await readRawDataUrl(file);
  if (DIRECT_OCR_MIME.has(file.type) && file.size <= MAX_IMAGE_BYTES) {
    return raw;
  }
  const normalized = await renderToJpegDataUrl(raw);
  if (normalized.length > 7_800_000) {
    throw new Error('Handwriting photo is too large (maximum 6 MB).');
  }
  return normalized;
}

export const ScanHandwritingModal: React.FC<ScanHandwritingModalProps> = ({
  open,
  notebooks,
  defaultNotebookId,
  onClose,
  onSaveScannedPage,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [textFileName, setTextFileName] = useState<string | null>(null);
  const [targetNotebookId, setTargetNotebookId] = useState<string>(
    defaultNotebookId || notebooks[0]?.id || '',
  );
  const [draftTitle, setDraftTitle] = useState('Scanned Handwritten Note');
  const [draftText, setDraftText] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrCompleted, setOcrCompleted] = useState(false);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  useEffect(() => {
    if (open && !targetNotebookId && notebooks[0]) {
      setTargetNotebookId(defaultNotebookId || notebooks[0].id);
    }
    if (!open) {
      stopCameraStream();
    }
  }, [open, notebooks, defaultNotebookId, targetNotebookId, stopCameraStream]);

  useEffect(() => {
    if (
      cameraActive &&
      videoRef.current &&
      streamRef.current &&
      videoRef.current.srcObject !== streamRef.current
    ) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraActive, cameraLoading]);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  if (!open) return null;

  const reset = () => {
    stopCameraStream();
    setImageDataUrl(null);
    setTextFileName(null);
    setDraftTitle('Scanned Handwritten Note');
    setDraftText('');
    setSummary('');
    setIsProcessing(false);
    setError(null);
    setOcrCompleted(false);
  };

  const handleClose = () => {
    if (isProcessing || isSaving) return;
    reset();
    onClose();
  };

  const processImageDataUrl = async (dataUrl: string, titleHint: string) => {
    setError(null);
    setTextFileName(null);
    setOcrCompleted(false);
    setImageDataUrl(dataUrl);
    setIsProcessing(true);
    try {
      const result = await runServerHandwritingOcr({
        imageDataUrl: dataUrl,
        pageTitle: titleHint,
      });
      setDraftTitle(result.titleSuggestion || titleHint || 'Handwritten Note');
      setDraftText(result.cleanedText || result.rawTranscript || '');
      setSummary(result.summary || '');
      setOcrCompleted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Handwriting OCR could not complete. Your photo is preserved and you can still save or retry.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const titleHint = file.name.replace(/\.[^.]+$/, '') || 'Scanned Note';
    const isTextLike =
      file.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(file.name);

    if (isTextLike) {
      try {
        const text = await readFileAsText(file);
        setImageDataUrl(null);
        setTextFileName(file.name);
        setDraftTitle(titleHint);
        setDraftText(text);
        setSummary('');
        setOcrCompleted(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read the selected text file.');
      }
      return;
    }

    try {
      const dataUrl = await normalizeImageFileToDataUrl(file);
      await processImageDataUrl(dataUrl, titleHint);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Please choose a supported image (PNG, JPEG, WebP) or text file (.txt, .md).',
      );
    }
  };

  const handleStartCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    setCameraLoading(true);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      stopCameraStream();
      // Fall back gracefully to OS camera input (which prompts camera on mobile or file picker).
      cameraInputRef.current?.click();
    } finally {
      setCameraLoading(false);
    }
  };

  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera is still warming up. Try again in a moment.');
      return;
    }

    const scale = Math.min(
      1,
      MAX_CANVAS_EDGE / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not capture frame from camera.');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCameraStream();
    await processImageDataUrl(capturedDataUrl, 'Camera Note');
  };

  const handleSave = async () => {
    if (!imageDataUrl && !textFileName) return;
    const nbId = targetNotebookId || notebooks[0]?.id || '';

    setIsSaving(true);
    try {
      const nb = notebooks.find((n) => n.id === nbId);
      const conversion: ConversionResult | null = ocrCompleted
        ? {
            title: draftTitle.trim() || 'Handwritten Note',
            cleanedMarkdown: summary ? `## Summary\n${summary}\n\n${draftText}` : draftText,
            tags: ['handwriting-ocr'],
            suggestedNotebook: nb?.title || 'Notebook',
            confidence: 0.92,
            convertedAt: new Date().toISOString(),
            sourceStrokeCount: 0,
            sourceExcerpt: draftText.slice(0, 220),
            pipelineNote: 'Transcribed via Google Gemini (gemini-4-hydrogen)',
          }
        : null;

      await onSaveScannedPage({
        notebookId: nbId,
        title: draftTitle.trim() || 'Handwritten Note',
        content: draftText,
        originalImage: imageDataUrl ?? undefined,
        conversionResult: conversion,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save scanned page locally.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasReadyDraft = Boolean(imageDataUrl || textFileName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-handwriting-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[var(--bg-scrim)]"
      onClick={handleClose}
    >
      <PaperSurface elevated className="w-full max-w-lg p-6 sm:p-7 max-h-[90dvh] overflow-y-auto">
        <div onClick={(e) => e.stopPropagation()} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="pi-label-micro text-[var(--accent-primary)]">
                Handwriting OCR · Gemini AI
              </span>
              <h2
                id="scan-handwriting-title"
                className="pi-heading-section text-[var(--text-primary)] mt-1"
              >
                Scan physical handwriting
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close scan handwriting dialog"
              onClick={handleClose}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-full hover:bg-[var(--bg-pill-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dedicated inputs for Camera fallback, Photo library, and File browser */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileChange(file);
            }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileChange(file);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.txt,.md,text/plain,text/markdown,application/octet-stream"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void handleFileChange(file);
            }}
          />

          {cameraActive ? (
            /* Live In-Modal Camera Capture */
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-[18px] border border-[var(--border-hairline)] bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs font-medium">
                    Starting camera…
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="pi-focusable min-h-[40px] px-3.5 rounded-full text-xs font-medium border border-[var(--border-strong)] bg-[var(--bg-paper)] text-[var(--text-primary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
                >
                  Back to options
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      cameraInputRef.current?.click();
                    }}
                    className="pi-focusable min-h-[40px] px-3.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)] cursor-pointer"
                  >
                    Use device camera app
                  </button>
                  <Pill variant="dark" size="sm" onClick={() => void handleCaptureFrame()}>
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Capture photo</span>
                  </Pill>
                </div>
              </div>
            </div>
          ) : !hasReadyDraft ? (
            /* 3-Way Source Chooser: Camera · Photo · File */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartCamera()}
                  className="pi-focusable flex sm:flex-col items-center sm:justify-center gap-3.5 sm:gap-2 rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-paper-subtle)] p-4 sm:py-6 text-left sm:text-center hover:border-[var(--accent-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-paper-elevated)] border border-[var(--border-hairline)] text-[var(--accent-primary)] shadow-xs">
                    <Camera className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Camera</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Take a photo now
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="pi-focusable flex sm:flex-col items-center sm:justify-center gap-3.5 sm:gap-2 rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-paper-subtle)] p-4 sm:py-6 text-left sm:text-center hover:border-[var(--accent-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-paper-elevated)] border border-[var(--border-hairline)] text-[var(--accent-primary)] shadow-xs">
                    <ImageIcon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Photo</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      From photo library
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="pi-focusable flex sm:flex-col items-center sm:justify-center gap-3.5 sm:gap-2 rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-paper-subtle)] p-4 sm:py-6 text-left sm:text-center hover:border-[var(--accent-primary)] hover:bg-[var(--bg-pill-hover)] transition-colors cursor-pointer"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-paper-elevated)] border border-[var(--border-hairline)] text-[var(--accent-primary)] shadow-xs">
                    <FileUp className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">File</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Browse device files
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-center text-xs text-[var(--text-muted)]">
                Original image is always preserved alongside your editable transcript.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border-hairline)] bg-[var(--bg-paper-subtle)] p-2.5">
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt="Captured handwriting"
                    className="w-20 h-24 object-cover rounded-lg border border-black/10 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper-elevated)] flex items-center justify-center shrink-0">
                    <FileUp className="w-6 h-6 text-[var(--accent-primary)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {imageDataUrl ? 'Original photo preserved' : `Imported file: ${textFileName}`}
                  </p>
                  {isProcessing ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      Transcribing handwriting via AI…
                    </p>
                  ) : ocrCompleted ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-[#526B59]">
                      <Check className="w-3.5 h-3.5" />
                      Ready for review &amp; editing
                    </p>
                  ) : null}
                  {!isProcessing && (
                    <div>
                      <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                        <span>Choose another camera, photo, or file</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-[var(--text-muted)]">Page title</span>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-[var(--text-muted)]">Notebook</span>
                  {notebooks.length > 0 ? (
                    <select
                      value={targetNotebookId}
                      onChange={(e) => setTargetNotebookId(e.target.value)}
                      className="w-full h-10 px-3 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)]"
                    >
                      {notebooks.map((nb) => (
                        <option key={nb.id} value={nb.id}>
                          {nb.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex h-10 items-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-paper)] px-3 text-sm text-[var(--text-secondary)]">
                      Will create “Scanned Notes” notebook
                    </div>
                  )}
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="font-medium text-[var(--text-muted)]">
                  Review &amp; edit transcribed text
                </span>
                <textarea
                  rows={6}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={
                    isProcessing
                      ? 'Transcribing handwriting…'
                      : 'Review or refine the extracted text before saving'
                  }
                  className="w-full p-3 rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-paper)] text-sm text-[var(--text-primary)] leading-relaxed"
                />
              </label>
            </div>
          )}

          {error && (
            <p className="text-xs text-[#B83B2B] bg-[#B83B2B]/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <Pill variant="outline" onClick={handleClose}>
              Cancel
            </Pill>
            {hasReadyDraft && (
              <Pill
                variant="dark"
                onClick={() => void handleSave()}
                disabled={isProcessing || isSaving}
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>{isSaving ? 'Saving…' : 'Save page to notebook'}</span>
              </Pill>
            )}
          </div>
        </div>
      </PaperSurface>
    </div>
  );
};
