import type { Layout, Surface } from '@mgc/layout';
import type { Frame } from './metronome';
import { placementSentence } from './placement';

const MINOR_MM = 10;
const MAJOR_MM = 50;

/** `index.html`'s `--bg`, `--fg` and `--fg-2`. */
const GROUND = '#121212';
const FG = '#f2f0ea';
const FG_2 = '#a8a59c';
const FACE = 'system-ui, sans-serif';

/** Kept clear at the top and the bottom of the screen: a Peer's strip, the Host's folded sheet bar. */
const CLEAR_PX = 64;
/** How wide the Tile number is drawn, as a share of the screen's width. */
const NUMBER_WIDTH = 0.6;
/** The pictogram's box, as shares of the screen's width and height. */
const PICTO_W = 0.5;
const PICTO_H = 0.16;
/** Between the number, the sentence and the pictogram. */
const GAP_PX = 24;
/** Each phone outline of the pictogram is drawn this far inside its Tile, so neighbours stay apart. */
const PICTO_INSET_PX = 2;

/**
 * The lobby's placement preview on this Device: a millimetre grid continuous across bezels and the World bounds,
 * then this phone's placement cue: its Tile number across most of the screen's width, the sentence saying where
 * to lay it, and a pictogram of the Layout with this phone filled.
 */
export function drawPreview(frame: Frame, surface: Surface, layout: Layout): void {
  const { ctx, w, h, dpr } = frame;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, w, h);

  // Everything up to the cue is in world millimetres; the surface transform clips it to this screen.
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const index = layout.devices.findIndex((d) => d.id === surface.rect.id);
  if (index >= 0) drawCue(ctx, w, h, layout, index);
}

/** The placement cue in CSS px, stacked and centred between the strip and the sheet bar. */
function drawCue(ctx: CanvasRenderingContext2D, w: number, h: number, layout: Layout, index: number): void {
  const sentence = placementSentence(layout, index);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // The sentence: one line, shrunk only when the screen is too narrow for it.
  ctx.font = `500 100px ${FACE}`;
  const sentenceSize = Math.min(Math.max(w * 0.06, 16), 26, (100 * w * 0.9) / ctx.measureText(sentence).width);
  ctx.font = `500 ${sentenceSize}px ${FACE}`;
  const s = ctx.measureText(sentence);
  const sentenceH = s.actualBoundingBoxAscent + s.actualBoundingBoxDescent;

  // The pictogram: the Layout's bounds scaled into its box.
  const b = layout.bounds;
  const scale = Math.min((w * PICTO_W) / b.w, (h * PICTO_H) / b.h);
  const pictoW = b.w * scale;
  const pictoH = b.h * scale;

  // The number: its ink NUMBER_WIDTH of the screen's width, unless the screen is too short for it. Measured on as
  // many 8s, a full-width digit, so a narrow 1 is drawn as large as a 2 and not larger.
  const label = String(index + 1);
  ctx.font = `600 100px ${FACE}`;
  const ref = ctx.measureText('8'.repeat(label.length));
  const refH = ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent;
  const numberRoom = h - 2 * CLEAR_PX - 2 * GAP_PX - sentenceH - pictoH;
  const k = Math.min((w * NUMBER_WIDTH) / (ref.actualBoundingBoxLeft + ref.actualBoundingBoxRight), numberRoom / refH);
  const numberH = refH * k;

  let y = Math.max(CLEAR_PX, (h - (numberH + GAP_PX + sentenceH + GAP_PX + pictoH)) / 2);
  ctx.fillStyle = FG;
  ctx.font = `600 ${100 * k}px ${FACE}`;
  ctx.fillText(label, w / 2, y + ref.actualBoundingBoxAscent * k);
  y += numberH + GAP_PX;
  ctx.font = `500 ${sentenceSize}px ${FACE}`;
  ctx.fillText(sentence, w / 2, y + s.actualBoundingBoxAscent);
  y += sentenceH + GAP_PX;

  // One outline per Tile at its place in the World, this phone's filled; each carries its number when there is room.
  const x0 = (w - pictoW) / 2;
  const digits = Math.min(13, Math.min(...layout.devices.map((d) => Math.min(d.w, d.h))) * scale * 0.6);
  ctx.lineWidth = 1.5;
  layout.devices.forEach((d, i) => {
    const cx = x0 + (d.x - b.x) * scale;
    const cy = y + (d.y - b.y) * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(d.rot);
    const rw = d.w * scale - 2 * PICTO_INSET_PX;
    const rh = d.h * scale - 2 * PICTO_INSET_PX;
    if (i === index) {
      ctx.fillStyle = FG;
      ctx.fillRect(PICTO_INSET_PX, PICTO_INSET_PX, rw, rh);
    } else {
      ctx.strokeStyle = FG_2;
      ctx.strokeRect(PICTO_INSET_PX, PICTO_INSET_PX, rw, rh);
    }
    if (digits >= 9) {
      ctx.fillStyle = i === index ? GROUND : FG_2;
      ctx.font = `600 ${digits}px ${FACE}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), (d.w * scale) / 2, (d.h * scale) / 2);
    }
    ctx.restore();
  });
}
