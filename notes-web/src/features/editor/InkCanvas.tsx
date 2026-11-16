import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import {
  INK_COLORS,
  INK_LOGICAL_HEIGHT,
  INK_LOGICAL_WIDTH,
  type InkColorId,
  type InkPoint,
  type InkStroke,
  type InkTool,
} from '../../types/ink';
import { PaperSurface } from '../../components/PaperSurface';
import { InkToolbar } from './InkToolbar';
import { renderStrokeToContext } from './renderStroke';

export interface InkCanvasProps {
  pageId: string;
  strokes: InkStroke[];
  theme: 'light' | 'dark';
  isConverting: boolean;
  barePaper?: boolean;
  onStrokesChange: (nextStrokes: InkStroke[]) => void;
  onConvert: () => void;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({
  pageId,
  strokes,
  theme,
  isConverting,
  barePaper = false,
  onStrokesChange,
  onConvert,
}) => {
  const [activeTool, setActiveTool] = useState<InkTool>('pen');
  const [activeColor, setActiveColor] = useState<InkColorId>('navy');
  const [allowMouseFallback, setAllowMouseFallback] = useState(false);

  // Undo / Redo stacks scoped to the current pageId
  const [undoStack, setUndoStack] = useState<InkStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<InkStroke[][]>([]);

  const stageRef = useRef<HTMLDivElement>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for zero-lag transient stroke drawing (no React renders on pointermove)
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointsRef = useRef<InkPoint[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const eraseSnapshotTakenRef = useRef(false);
  const strokesRef = useRef<InkStroke[]>(strokes);
  strokesRef.current = strokes;

  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: INK_LOGICAL_WIDTH,
    height: INK_LOGICAL_HEIGHT,
  });

  // Reset undo/redo stacks when switching pages
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    activePointsRef.current = [];
  }, [pageId]);

  // Measure responsive canvas container
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Redraw committed strokes whenever strokes, dimensions, or theme change
  useEffect(() => {
    const canvas = committedCanvasRef.current;
    const activeCanvas = activeCanvasRef.current;
    if (!canvas || !activeCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelW = Math.max(1, Math.round(stageSize.width * dpr));
    const pixelH = Math.max(1, Math.round(stageSize.height * dpr));

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    if (activeCanvas.width !== pixelW || activeCanvas.height !== pixelH) {
      activeCanvas.width = pixelW;
      activeCanvas.height = pixelH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelW, pixelH);
    ctx.scale(dpr, dpr);

    const scaleX = stageSize.width / INK_LOGICAL_WIDTH;
    const scaleY = stageSize.height / INK_LOGICAL_HEIGHT;

    for (let i = 0; i < strokes.length; i++) {
      renderStrokeToContext(ctx, strokes[i], scaleX, scaleY, theme);
    }
  }, [strokes, stageSize, theme]);

  const drawActiveFrame = useCallback(() => {
    rafIdRef.current = null;
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activePointsRef.current.length === 0 || activeTool === 'eraser') {
      return;
    }

    ctx.scale(dpr, dpr);
    const scaleX = stageSize.width / INK_LOGICAL_WIDTH;
    const scaleY = stageSize.height / INK_LOGICAL_HEIGHT;

    renderStrokeToContext(
      ctx,
      {
        tool: activeTool === 'marker' ? 'marker' : 'pen',
        color: activeColor,
        baseSize: activeTool === 'marker' ? 16 : 5,
        points: activePointsRef.current,
      },
      scaleX,
      scaleY,
      theme
    );
  }, [activeTool, activeColor, stageSize, theme]);

  const scheduleActiveDraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(drawActiveFrame);
  }, [drawActiveFrame]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Guard against Safari/iPadOS cancelling vertical Apple Pencil strokes while keeping finger scrolling intact
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const handleTouchStart = (ev: TouchEvent) => {
      const primary = ev.touches[0] as (Touch & { touchType?: string }) | undefined;
      if (primary && primary.touchType === 'stylus') {
        ev.preventDefault();
      }
    };
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => canvas.removeEventListener('touchstart', handleTouchStart);
  }, []);

  const toLogicalPoint = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): InkPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * INK_LOGICAL_WIDTH;
    const normY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * INK_LOGICAL_HEIGHT;
    return {
      x: Math.max(0, Math.min(INK_LOGICAL_WIDTH, Math.round(normX * 10) / 10)),
      y: Math.max(0, Math.min(INK_LOGICAL_HEIGHT, Math.round(normY * 10) / 10)),
      pressure: typeof e.pressure === 'number' ? e.pressure : 0.5,
      tiltX: typeof e.tiltX === 'number' ? e.tiltX : 0,
      tiltY: typeof e.tiltY === 'number' ? e.tiltY : 0,
      timestamp: Date.now(),
    };
  };

  const eraseAtLogicalPoint = (pt: InkPoint) => {
    const current = strokesRef.current;
    const hitRadius = 20;
    const hitRadiusSq = hitRadius * hitRadius;

    let hitAny = false;
    const remaining = current.filter((stroke) => {
      const hit = stroke.points.some((sp) => {
        const dx = sp.x - pt.x;
        const dy = sp.y - pt.y;
        return dx * dx + dy * dy <= hitRadiusSq;
      });
      if (hit) hitAny = true;
      return !hit;
    });

    if (hitAny) {
      if (!eraseSnapshotTakenRef.current) {
        setUndoStack((prev) => [...prev, current]);
        setRedoStack([]);
        eraseSnapshotTakenRef.current = true;
      }
      strokesRef.current = remaining;
      onStrokesChange(remaining);
    }
  };

  const isInputAllowed = (pointerType: string): boolean => {
    if (pointerType === 'pen') return true;
    if (pointerType === 'mouse' && allowMouseFallback) return true;
    // Touch/finger must always scroll rather than draw ink
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInputAllowed(e.pointerType)) {
      return;
    }

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture error if pointer already released
    }

    isDrawingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    eraseSnapshotTakenRef.current = false;

    const pt = toLogicalPoint(e);

    if (activeTool === 'eraser') {
      eraseAtLogicalPoint(pt);
      return;
    }

    activePointsRef.current = [pt];
    scheduleActiveDraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) {
      return;
    }
    if (!isInputAllowed(e.pointerType)) {
      return;
    }

    e.preventDefault();
    const pt = toLogicalPoint(e);

    if (activeTool === 'eraser') {
      eraseAtLogicalPoint(pt);
      return;
    }

    // Coalesce high-frequency stylus events when available for ultra-smooth curves
    const nativeEvt = e.nativeEvent;
    const coalesced =
      typeof nativeEvt.getCoalescedEvents === 'function'
        ? nativeEvt.getCoalescedEvents()
        : null;

    if (coalesced && coalesced.length > 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      for (const ce of coalesced) {
        const cx =
          ((ce.clientX - rect.left) / Math.max(1, rect.width)) *
          INK_LOGICAL_WIDTH;
        const cy =
          ((ce.clientY - rect.top) / Math.max(1, rect.height)) *
          INK_LOGICAL_HEIGHT;
        activePointsRef.current.push({
          x: Math.max(0, Math.min(INK_LOGICAL_WIDTH, Math.round(cx * 10) / 10)),
          y: Math.max(0, Math.min(INK_LOGICAL_HEIGHT, Math.round(cy * 10) / 10)),
          pressure: typeof ce.pressure === 'number' ? ce.pressure : pt.pressure,
          tiltX: typeof ce.tiltX === 'number' ? ce.tiltX : pt.tiltX,
          tiltY: typeof ce.tiltY === 'number' ? ce.tiltY : pt.tiltY,
          timestamp: Date.now(),
        });
      }
    } else {
      activePointsRef.current.push(pt);
    }

    scheduleActiveDraw();
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) {
      return;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe no-op
    }

    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    eraseSnapshotTakenRef.current = false;

    if (activeTool === 'eraser') {
      activePointsRef.current = [];
      return;
    }

    const points = activePointsRef.current;
    activePointsRef.current = [];

    // Clear active overlay canvas immediately
    const activeCanvas = activeCanvasRef.current;
    if (activeCanvas) {
      const actx = activeCanvas.getContext('2d');
      actx?.setTransform(1, 0, 0, 1, 0, 0);
      actx?.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    }

    if (points.length === 0) return;

    const committedStroke: InkStroke = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool: activeTool === 'marker' ? 'marker' : 'pen',
      color: activeColor,
      baseSize: activeTool === 'marker' ? 16 : 5,
      points:
        points.length === 1
          ? [points[0], { ...points[0], x: points[0].x + 0.5, y: points[0].y + 0.5 }]
          : points,
      createdAt: Date.now(),
    };

    const prevStrokes = strokesRef.current;
    const nextStrokes = [...prevStrokes, committedStroke];
    setUndoStack((prev) => [...prev, prevStrokes]);
    setRedoStack([]);
    onStrokesChange(nextStrokes);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, strokesRef.current]);
    onStrokesChange(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, strokesRef.current]);
    onStrokesChange(next);
  };

  const inkStage = (
    <div
      ref={stageRef}
      className="relative w-full aspect-[800/1120] select-none"
    >
      <canvas
        ref={committedCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={activeCanvasRef}
        role="img"
        aria-label="Handwriting ink canvas. Use a stylus to draw, or finger touch to scroll the page."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        style={{
          // Finger scrolling remains natural (pan-y); stylus events are captured in JS
          touchAction: 'pan-y',
          cursor:
            activeTool === 'eraser'
              ? 'cell'
              : allowMouseFallback
                ? 'crosshair'
                : 'default',
        }}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );

  return (
    <div className="relative pb-24">
      {/* Quiet hardware capability & palm-rejection bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
        <span className="pi-tabular">
          {allowMouseFallback
            ? 'Stylus + mouse fallback active · Finger touch scrolls'
            : 'Stylus-only ink · Finger touch scrolls'}
          {' · '}
          {strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}
        </span>

        <button
          type="button"
          aria-pressed={allowMouseFallback}
          onClick={() => setAllowMouseFallback((v) => !v)}
          className={`pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
            allowMouseFallback
              ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
              : 'bg-[var(--bg-pill)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-pill-hover)]'
          }`}
        >
          <MousePointer2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {allowMouseFallback ? 'Mouse ink on' : 'Draw with mouse'}
          </span>
        </button>
      </div>

      {/* Lined Paper Writing Surface */}
      {barePaper ? (
        inkStage
      ) : (
        <PaperSurface lined showMarginLine className="overflow-hidden">
          {inkStage}
        </PaperSurface>
      )}

      {/* Floating black pill toolbar positioned in thumb-friendly lower zone */}
      <div className="sticky bottom-4 z-20 mt-4 flex justify-center md:justify-end pointer-events-none">
        <div className="pointer-events-auto max-w-full">
          <InkToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            isConverting={isConverting}
            theme={theme}
            onSelectTool={setActiveTool}
            onSelectColor={setActiveColor}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onConvert={onConvert}
          />
        </div>
      </div>
    </div>
  );
};
