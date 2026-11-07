import { describe, expect, it } from 'vitest';
import { Surface, buildLayout, isLayout, type DeviceSize } from '../src';

const phone = (id: string, w = 70, h = 150): DeviceSize => ({ id, w, h });

describe('templates', () => {
  it('row places devices left to right with the gap and centres shorter ones', () => {
    const l = buildLayout('row', [phone('a'), phone('b', 60, 120), phone('c')], 4);
    expect(l.devices.map((d) => d.x)).toEqual([0, 74, 138]);
    expect(l.devices[1]!.y).toBe(15);
    expect(l.bounds).toEqual({ x: 0, y: 0, w: 208, h: 150 });
  });

  it('column stacks top to bottom', () => {
    const l = buildLayout('column', [phone('a'), phone('b')], 4);
    expect(l.devices.map((d) => d.y)).toEqual([0, 154]);
    expect(l.bounds.h).toBe(304);
  });

  it('grid lays 4 devices as 2x2 and 3 devices as 2+1', () => {
    const four = buildLayout('grid', ['a', 'b', 'c', 'd'].map((id) => phone(id)), 4);
    expect(four.devices.map((d) => [d.x, d.y])).toEqual([
      [0, 0],
      [74, 0],
      [0, 154],
      [74, 154],
    ]);
    const three = buildLayout('grid', ['a', 'b', 'c'].map((id) => phone(id)), 4);
    expect(three.devices[2]).toMatchObject({ x: 0, y: 154 });
  });

  it('empty input yields an empty layout', () => {
    expect(buildLayout('row', [])).toEqual({ template: 'row', devices: [], bounds: { x: 0, y: 0, w: 0, h: 0 } });
  });
});

describe('Surface', () => {
  it('a world point on the shared edge maps to the right edge of A and the left edge of B', () => {
    const l = buildLayout('row', [phone('a'), phone('b')], 4);
    const a = new Surface(l.devices[0]!, 6);
    const b = new Surface(l.devices[1]!, 6);
    // ball centre crossing the bezel: world x in the gap
    expect(a.worldToPx({ x: 70, y: 75 })).toEqual({ x: 420, y: 450 });
    expect(b.worldToPx({ x: 74, y: 75 })).toEqual({ x: 0, y: 450 });
    // continuity: 1 mm past A's edge is 1 mm before B's edge (gap 4 = 24 px)
    expect(b.worldToPx({ x: 71, y: 0 }).x).toBeCloseTo(-18);
  });

  it('round-trips world↔local↔px under rotation', () => {
    const s = new Surface({ id: 'r', x: 30, y: 10, w: 70, h: 150, rot: Math.PI / 3 }, 6.3);
    const p = { x: 12.5, y: 99 };
    const back = s.worldToLocal(s.localToWorld(p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    const w = { x: -5, y: 42 };
    const w2 = s.pxToWorld(s.worldToPx(w));
    expect(w2.x).toBeCloseTo(w.x, 9);
    expect(w2.y).toBeCloseTo(w.y, 9);
  });

  it('a 90° rotated device has a transposed world bounding box', () => {
    const s = new Surface({ id: 'r', x: 0, y: 0, w: 70, h: 150, rot: Math.PI / 2 }, 1);
    const box = s.worldAabb();
    expect(box.w).toBeCloseTo(150);
    expect(box.h).toBeCloseTo(70);
    expect(box.x).toBeCloseTo(-150);
  });

  it('applyTo produces the same pixel as worldToPx', () => {
    const s = new Surface({ id: 'r', x: 20, y: 5, w: 70, h: 150, rot: 0.4 }, 6);
    const calls: number[][] = [];
    const ctx = { setTransform: (...m: number[]) => calls.push(m) } as unknown as CanvasRenderingContext2D;
    s.applyTo(ctx, 2);
    const [a, b, c, d, e, f] = calls[0]!;
    const w = { x: 33, y: 71 };
    const px = s.worldToPx(w);
    expect(a! * w.x + c! * w.y + e!).toBeCloseTo(px.x * 2, 9);
    expect(b! * w.x + d! * w.y + f!).toBeCloseTo(px.y * 2, 9);
  });
});

describe('isLayout', () => {
  it('accepts built layouts and rejects malformed ones', () => {
    expect(isLayout(buildLayout('grid', [phone('a')]))).toBe(true);
    expect(isLayout({ template: 'spiral', devices: [], bounds: { x: 0, y: 0, w: 0, h: 0 } })).toBe(false);
    expect(isLayout({ template: 'row', devices: [{ id: 'a', x: 0, y: 0, w: 1 }], bounds: { x: 0, y: 0, w: 0, h: 0 } })).toBe(false);
  });
});
