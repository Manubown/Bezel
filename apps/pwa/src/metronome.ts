export const BEAT_MS = 1000;
const FLASH_MS = 80;

export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** CSS px */
  w: number;
  h: number;
  dpr: number;
}

/**
 * Hi-DPI aware requestAnimationFrame loop; `draw` gets a context reset to CSS px.
 * The canvas is sized to the visual viewport: iOS Safari lays out `position: fixed`
 * against the large viewport, so `height: 100%` would extend under the bottom toolbar.
 */
export function startCanvasLoop(canvas: HTMLCanvasElement, draw: (f: Frame) => void): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D unavailable');
  let raf = 0;
  const frame: Frame = { ctx, w: 0, h: 0, dpr: 1 };
  const vv = window.visualViewport;

  const resize = () => {
    frame.dpr = window.devicePixelRatio || 1;
    frame.w = vv?.width ?? canvas.clientWidth;
    frame.h = vv?.height ?? canvas.clientHeight;
    canvas.style.width = `${frame.w}px`;
    canvas.style.height = `${frame.h}px`;
    canvas.width = Math.round(frame.w * frame.dpr);
    canvas.height = Math.round(frame.h * frame.dpr);
  };
  resize();
  (vv ?? window).addEventListener('resize', resize);

  const tick = () => {
    ctx.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    draw(frame);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    (vv ?? window).removeEventListener('resize', resize);
  };
}

/**
 * Sync probe shown before a layout exists: every phone flashes and counts on
 * the same shared-time beat, so misalignment is visible at a glance.
 */
export function drawMetronome({ ctx, w, h }: Frame, t: number, synced: boolean): void {
  const beat = Math.floor(t / BEAT_MS);
  const flash = synced && t - beat * BEAT_MS < FLASH_MS;
  const phase = (t - beat * BEAT_MS) / BEAT_MS;

  ctx.fillStyle = flash ? '#f2f0ea' : '#121212';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = synced ? '#5bc46a' : '#3a3a3a';
  ctx.fillRect(0, h - 6, w * phase, 6);

  ctx.fillStyle = flash ? '#121212' : synced ? '#f2f0ea' : '#4a4a4a';
  ctx.font = `600 ${Math.min(w, h) * 0.38}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(beat % 100).padStart(2, '0'), w / 2, h / 2);
}
