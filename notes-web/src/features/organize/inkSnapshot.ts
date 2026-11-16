import { INK_LOGICAL_HEIGHT, INK_LOGICAL_WIDTH, type InkStroke } from '../../types/ink';
import { renderStrokeToContext } from '../editor/renderStroke';

/**
 * Renders vector ink strokes onto a crisp offscreen cream-paper PNG data URL
 * so server-side OpenRouter OCR can transcribe canvas handwriting accurately.
 */
export function renderInkStrokesToPngDataUrl(strokes: InkStroke[]): string | null {
  if (typeof document === 'undefined' || strokes.length === 0) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = INK_LOGICAL_WIDTH;
  canvas.height = INK_LOGICAL_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FBF7F0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    renderStrokeToContext(ctx, stroke, 1, 1, 'light');
  }

  return canvas.toDataURL('image/png');
}
