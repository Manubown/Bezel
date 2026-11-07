import { aabbOf, unionRect } from './surface';
import type { DeviceRect, DeviceSize, Layout, TemplateId } from './types';

/** Typical phone bezel + case edge, per side. */
export const DEFAULT_GAP_MM = 4;

export const TEMPLATE_IDS: readonly TemplateId[] = ['row', 'column', 'grid'];

type Placer = (sizes: DeviceSize[], gap: number) => DeviceRect[];

/** Devices side by side, left to right, vertically centred on the tallest. */
const row: Placer = (sizes, gap) => {
  const maxH = Math.max(...sizes.map((s) => s.h));
  let x = 0;
  return sizes.map((s) => {
    const r = { ...s, x, y: (maxH - s.h) / 2, rot: 0 };
    x += s.w + gap;
    return r;
  });
};

/** Devices stacked top to bottom, horizontally centred on the widest. */
const column: Placer = (sizes, gap) => {
  const maxW = Math.max(...sizes.map((s) => s.w));
  let y = 0;
  return sizes.map((s) => {
    const r = { ...s, x: (maxW - s.w) / 2, y, rot: 0 };
    y += s.h + gap;
    return r;
  });
};

/** Near-square grid, row-major; each cell is the max size of its column/row. */
const grid: Placer = (sizes, gap) => {
  const cols = Math.ceil(Math.sqrt(sizes.length));
  const rows = Math.ceil(sizes.length / cols);
  const colW = new Array<number>(cols).fill(0);
  const rowH = new Array<number>(rows).fill(0);
  sizes.forEach((s, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    colW[c] = Math.max(colW[c]!, s.w);
    rowH[r] = Math.max(rowH[r]!, s.h);
  });
  const colX = colW.map((_, c) => colW.slice(0, c).reduce((a, w) => a + w + gap, 0));
  const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, h) => a + h + gap, 0));
  return sizes.map((s, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      ...s,
      x: colX[c]! + (colW[c]! - s.w) / 2,
      y: rowY[r]! + (rowH[r]! - s.h) / 2,
      rot: 0,
    };
  });
};

const PLACERS: Record<TemplateId, Placer> = { row, column, grid };

export function buildLayout(template: TemplateId, sizes: DeviceSize[], gap = DEFAULT_GAP_MM): Layout {
  const devices = sizes.length === 0 ? [] : PLACERS[template](sizes, gap);
  return { template, devices, bounds: unionRect(devices.map((d) => aabbOf(d))) };
}
