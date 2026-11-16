import { getStroke } from 'perfect-freehand';
import { INK_COLORS, type InkColorId, type InkPoint } from '../../types/ink';

function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return '';
  const d: Array<string | number> = ['M', points[0][0], points[0][1], 'Q'];
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  d.push('Z');
  return d.join(' ');
}

function hasVaryingPressure(points: InkPoint[]): boolean {
  if (points.length === 0) return false;
  const first = points[0].pressure;
  for (let i = 0; i < points.length; i++) {
    const p = points[i].pressure;
    if (p > 0 && p !== 0.5 && Math.abs(p - first) > 0.015) {
      return true;
    }
  }
  return points.some((pt) => pt.pressure > 0 && pt.pressure !== 0.5);
}

export function renderStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: {
    tool: 'pen' | 'marker';
    color: InkColorId;
    baseSize: number;
    points: InkPoint[];
  },
  scaleX: number,
  scaleY: number,
  theme: 'light' | 'dark',
) {
  if (stroke.points.length === 0) return;

  const isMarker = stroke.tool === 'marker';
  const useHardwarePressure = hasVaryingPressure(stroke.points);

  let tiltBonus = 0;
  if (isMarker) {
    let totalTilt = 0;
    for (let i = 0; i < stroke.points.length; i++) {
      totalTilt += Math.hypot(stroke.points[i].tiltX, stroke.points[i].tiltY);
    }
    const avgTilt = totalTilt / stroke.points.length;
    tiltBonus = Math.min(8, avgTilt * 0.14);
  }

  const inputPoints = stroke.points.map((pt) => [
    pt.x * scaleX,
    pt.y * scaleY,
    pt.pressure > 0 ? pt.pressure : 0.5,
  ]);

  const scaleAvg = (scaleX + scaleY) / 2;
  const outlinePoints = getStroke(inputPoints, {
    size: (stroke.baseSize + tiltBonus) * scaleAvg,
    thinning: isMarker ? 0.18 : 0.58,
    smoothing: isMarker ? 0.65 : 0.52,
    streamline: isMarker ? 0.6 : 0.48,
    easing: (t) => t,
    simulatePressure: !useHardwarePressure,
    start: {
      cap: !isMarker,
      taper: isMarker ? 0 : 8,
    },
    end: {
      cap: !isMarker,
      taper: isMarker ? 0 : 10,
    },
  });

  if (outlinePoints.length === 0) return;
  const pathData = getSvgPathFromStroke(outlinePoints);
  if (!pathData) return;

  const colorMeta = INK_COLORS[stroke.color] ?? INK_COLORS.navy;
  const fillHex = theme === 'dark' ? colorMeta.darkHex : colorMeta.lightHex;

  ctx.save();
  ctx.fillStyle = fillHex;
  ctx.globalAlpha = isMarker ? 0.38 : 0.96;
  ctx.fill(new Path2D(pathData));
  ctx.restore();
}
