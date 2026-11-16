import React from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Sparkles,
} from 'lucide-react';
import {
  INK_COLORS,
  type InkColorId,
  type InkTool,
} from '../../types/ink';
import { FloatingToolbar } from '../../components/FloatingToolbar';
import { ToolButton } from '../../components/ToolButton';

export interface InkToolbarProps {
  activeTool: InkTool;
  activeColor: InkColorId;
  canUndo: boolean;
  canRedo: boolean;
  isConverting: boolean;
  theme: 'light' | 'dark';
  onSelectTool: (tool: InkTool) => void;
  onSelectColor: (color: InkColorId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onConvert: () => void;
}

export const InkToolbar: React.FC<InkToolbarProps> = ({
  activeTool,
  activeColor,
  canUndo,
  canRedo,
  isConverting,
  theme,
  onSelectTool,
  onSelectColor,
  onUndo,
  onRedo,
  onConvert,
}) => {
  return (
    <FloatingToolbar ariaLabel="Handwriting pen tools">
      {/* Primary drawing tools */}
      <ToolButton
        label="Pen"
        active={activeTool === 'pen'}
        icon={<PenTool className="w-4 h-4" aria-hidden="true" />}
        showLabel
        onClick={() => onSelectTool('pen')}
      />
      <ToolButton
        label="Marker"
        active={activeTool === 'marker'}
        icon={<Highlighter className="w-4 h-4" aria-hidden="true" />}
        showLabel
        onClick={() => onSelectTool('marker')}
      />
      <ToolButton
        label="Erase"
        active={activeTool === 'eraser'}
        icon={<Eraser className="w-4 h-4" aria-hidden="true" />}
        showLabel
        onClick={() => onSelectTool('eraser')}
      />

      {/* Divider */}
      <div
        aria-hidden="true"
        className="w-px h-6 bg-white/15 mx-0.5 shrink-0"
      />

      {/* Three accessible ink colors */}
      <div
        role="group"
        aria-label="Ink color"
        className="flex items-center gap-1.5 px-1 shrink-0"
      >
        {(Object.keys(INK_COLORS) as InkColorId[]).map((colorId) => {
          const meta = INK_COLORS[colorId];
          const swatchHex = theme === 'dark' ? meta.darkHex : meta.lightHex;
          const isSelected = activeColor === colorId && activeTool !== 'eraser';
          return (
            <button
              key={colorId}
              type="button"
              aria-label={`Ink color: ${meta.label}`}
              aria-pressed={isSelected}
              title={meta.label}
              onClick={() => {
                onSelectColor(colorId);
                if (activeTool === 'eraser') {
                  onSelectTool('pen');
                }
              }}
              className="pi-focusable inline-flex items-center justify-center min-h-[44px] min-w-[36px] px-1 rounded-full cursor-pointer"
            >
              <span
                style={{ backgroundColor: swatchHex }}
                className={`w-5 h-5 rounded-full border border-white/40 transition-transform ${
                  isSelected
                    ? 'scale-115 ring-2 ring-[var(--bg-toolbar-active)] ring-offset-2 ring-offset-[var(--bg-toolbar)]'
                    : 'opacity-80 hover:opacity-100'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div
        aria-hidden="true"
        className="w-px h-6 bg-white/15 mx-0.5 shrink-0"
      />

      {/* Undo / Redo */}
      <ToolButton
        label="Undo"
        icon={<Undo2 className="w-4 h-4" aria-hidden="true" />}
        disabled={!canUndo}
        onClick={onUndo}
      />
      <ToolButton
        label="Redo"
        icon={<Redo2 className="w-4 h-4" aria-hidden="true" />}
        disabled={!canRedo}
        onClick={onRedo}
      />

      {/* Divider */}
      <div
        aria-hidden="true"
        className="w-px h-6 bg-white/15 mx-0.5 shrink-0"
      />

      {/* Convert / Organize action */}
      <button
        type="button"
        onClick={onConvert}
        disabled={isConverting}
        aria-label="Convert and organize handwriting"
        className="pi-focusable inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full bg-[var(--accent-surface)] text-white text-[13px] font-medium whitespace-nowrap shrink-0 hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        <span>{isConverting ? 'Organizing…' : 'Convert'}</span>
      </button>
    </FloatingToolbar>
  );
};
