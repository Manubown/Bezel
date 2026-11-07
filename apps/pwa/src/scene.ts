import type { Layout, Surface } from '@mgc/layout';
import type { Frame } from './metronome';

const BALL_R_MM = 6;
const BALL_SPEED_MM_S = 120;
const TRAIL = 8;
const TRAIL_STEP_MS = 28;
const MINOR_MM = 10;
const MAJOR_MM = 50;

/** Triangle wave in [0, 1] with period `period`. */
function tri(t: number, period: number): number {
  const p = (t / period) % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** Ball position is a pure function of shared time: no state to sync. */
export function ballAt(layout: Layout, tMs: number): { x: number; y: number } {
  const { x, y, w, h } = layout.bounds;
  const rangeX = Math.max(w - 2 * BALL_R_MM, 0);
  const rangeY = Math.max(h - 2 * BALL_R_MM, 0);
  const periodX = (2 * rangeX) / BALL_SPEED_MM_S || 1;
  // Incommensurate periods so the path doesn't repeat visibly.
  const periodY = (2 * rangeY) / (BALL_SPEED_MM_S * 0.618) || 1;
  const t = tMs / 1000;
  return {
    x: x + BALL_R_MM + rangeX * tri(t, periodX),
    y: y + BALL_R_MM + rangeY * tri(t, periodY),
  };
}

/**
 * Draws the shared world on this device. Everything after `applyTo` is in
 * world millimetres; the surface transform clips it to this screen.
 */
export function drawScene(frame: Frame, surface: Surface, layout: Layout, tMs: number): void {
  const { ctx, w, h, dpr } = frame;
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, w, h);

  surface.applyTo(ctx, dpr);
  const b = layout.bounds;
  const mmPx = 1 / surface.pxPerMm; // 1 CSS px expressed in mm

  // Grid: continuous across bezels, the alignment check a human can read.
  ctx.lineWidth = mmPx;
  for (let gx = Math.ceil(b.x / MINOR_MM) * MINOR_MM; gx <= b.x + b.w; gx += MINOR_MM) {
    ctx.strokeStyle = gx % MAJOR_MM === 0 ? '#3a3a3a' : '#222';
    ctx.beginPath();
    ctx.moveTo(gx, b.y);
    ctx.lineTo(gx, b.y + b.h);
    ctx.stroke();
  }
  for (let gy = Math.ceil(b.y / MINOR_MM) * MINOR_MM; gy <= b.y + b.h; gy += MINOR_MM) {
    ctx.strokeStyle = gy % MAJOR_MM === 0 ? '#3a3a3a' : '#222';
    ctx.beginPath();
    ctx.moveTo(b.x, gy);
    ctx.lineTo(b.x + b.w, gy);
    ctx.stroke();
  }

  // World bounds.
  ctx.strokeStyle = '#5bc46a';
  ctx.lineWidth = 2 * mmPx;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

  // Each device's number at its centre; only the one on this screen is visible.
  layout.devices.forEach((d, i) => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = '#2a2a2a';
    ctx.font = `600 ${Math.min(d.w, d.h) * 0.5}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), d.w / 2, d.h / 2);
    ctx.restore();
  });

  // Ball with a short trail; position is deterministic in shared time.
  for (let k = TRAIL; k >= 1; k--) {
    const p = ballAt(layout, tMs - k * TRAIL_STEP_MS);
    ctx.fillStyle = `rgba(242, 240, 234, ${0.35 * (1 - k / (TRAIL + 1))})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R_MM * (1 - k / (TRAIL + 2)), 0, Math.PI * 2);
    ctx.fill();
  }
  const p = ballAt(layout, tMs);
  ctx.fillStyle = '#f2f0ea';
  ctx.beginPath();
  ctx.arc(p.x, p.y, BALL_R_MM, 0, Math.PI * 2);
  ctx.fill();

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
