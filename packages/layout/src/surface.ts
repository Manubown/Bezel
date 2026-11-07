import type { DeviceRect, Rect, Vec2 } from './types';

/**
 * Maps between world millimetres and one device's local space / canvas pixels.
 * Games draw in world coordinates; `applyTo` configures a Canvas2D context so
 * that world-space drawing lands on the right part of this device's screen.
 */
export class Surface {
  private readonly cos: number;
  private readonly sin: number;

  constructor(
    readonly rect: DeviceRect,
    /** CSS pixels per millimetre for this device. */
    readonly pxPerMm: number,
  ) {
    this.cos = Math.cos(rect.rot);
    this.sin = Math.sin(rect.rot);
  }

  localToWorld(p: Vec2): Vec2 {
    return {
      x: this.rect.x + p.x * this.cos - p.y * this.sin,
      y: this.rect.y + p.x * this.sin + p.y * this.cos,
    };
  }

  worldToLocal(p: Vec2): Vec2 {
    const dx = p.x - this.rect.x;
    const dy = p.y - this.rect.y;
    return {
      x: dx * this.cos + dy * this.sin,
      y: -dx * this.sin + dy * this.cos,
    };
  }

  /** World point → CSS pixel position on this device's canvas. */
  worldToPx(p: Vec2): Vec2 {
    const l = this.worldToLocal(p);
    return { x: l.x * this.pxPerMm, y: l.y * this.pxPerMm };
  }

  /** CSS pixel position (e.g. a touch) → world point. */
  pxToWorld(p: Vec2): Vec2 {
    return this.localToWorld({ x: p.x / this.pxPerMm, y: p.y / this.pxPerMm });
  }

  /** Axis-aligned world box covering this screen (exact when rot = 0). */
  worldAabb(): Rect {
    return aabbOf(this.rect, this);
  }

  /** Set the context transform so subsequent drawing is in world millimetres. */
  applyTo(ctx: CanvasRenderingContext2D, dpr: number): void {
    const s = dpr * this.pxPerMm;
    // px = s * R(-rot) * (world - origin)
    const a = s * this.cos;
    const b = -s * this.sin;
    const c = s * this.sin;
    const d = s * this.cos;
    const e = -(a * this.rect.x + c * this.rect.y);
    const f = -(b * this.rect.x + d * this.rect.y);
    ctx.setTransform(a, b, c, d, e, f);
  }
}

export function aabbOf(rect: DeviceRect, surface = new Surface(rect, 1)): Rect {
  const corners = [
    { x: 0, y: 0 },
    { x: rect.w, y: 0 },
    { x: 0, y: rect.h },
    { x: rect.w, y: rect.h },
  ].map((c) => surface.localToWorld(c));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function unionRect(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
