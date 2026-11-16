export type InkTool = 'pen' | 'marker' | 'eraser';

export type InkColorId = 'navy' | 'terracotta' | 'forest';

/**
 * Logical coordinate space for vector strokes so handwriting scales
 * proportionally across phones, tablets, and laptops without clipping.
 */
export const INK_LOGICAL_WIDTH = 800;
export const INK_LOGICAL_HEIGHT = 1120;

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface InkStroke {
  id: string;
  tool: 'pen' | 'marker';
  color: InkColorId;
  baseSize: number;
  points: InkPoint[];
  createdAt: number;
}

export interface InkColorMeta {
  id: InkColorId;
  label: string;
  cssVar: string;
  lightHex: string;
  darkHex: string;
}

export const INK_COLORS: Record<InkColorId, InkColorMeta> = {
  navy: {
    id: 'navy',
    label: 'Fountain Navy',
    cssVar: 'var(--ink-navy)',
    lightHex: '#1F2A3A',
    darkHex: '#EDE4D3',
  },
  terracotta: {
    id: 'terracotta',
    label: 'Sienna Ink',
    cssVar: 'var(--ink-terracotta)',
    lightHex: '#9A3B19',
    darkHex: '#E88964',
  },
  forest: {
    id: 'forest',
    label: 'Botanical Green',
    cssVar: 'var(--ink-forest)',
    lightHex: '#2A4730',
    darkHex: '#9BBF9E',
  },
};
