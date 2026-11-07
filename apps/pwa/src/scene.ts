import type { Layout, Surface } from '@mgc/layout';
import type { Frame } from './metronome';

const MINOR_MM = 10;
const MAJOR_MM = 50;

/**
 * The lobby's placement preview on this Device: a millimetre grid continuous
 * across bezels, the World bounds, and each phone's number at its centre.
 * Everything after `applyTo` is in world millimetres; the surface transform
 * clips it to this screen.
 */
export function drawPreview(frame: Frame, surface: Surface, layout: Layout): void {
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
