import { describe, expect, it } from 'vitest';
import { pageZoom } from '../src/device';

const win = (innerWidth: number, innerHeight: number, width: number, height: number) => ({ innerWidth, innerHeight, screen: { width, height } as Screen });

describe('pageZoom', () => {
  it('is 1 at 100 %, and a zoom step when the viewport is the screen scaled by one', () => {
    expect(pageZoom(win(390, 699, 390, 844))).toBe(1);
    // Safari Page Zoom 75 % on an iPhone 12 (live test 1): 520 CSS px across a 390 px screen.
    expect(pageZoom(win(520, 932, 390, 844))).toBe(1.333);
    // Landscape: the screen is reported portrait on iOS; the shorter sides are compared.
    expect(pageZoom(win(932, 520, 390, 844))).toBe(1.333);
    expect(pageZoom(win(293, 633, 390, 844))).toBe(0.75);
  });

  it('is 1 when the viewport is not the screen at a zoom step (a desktop window, an emulated phone) or unknown', () => {
    expect(pageZoom(win(420, 860, 800, 948))).toBe(1); // 0.525: no step within 1.5 %
    expect(pageZoom(win(1200, 900, 1920, 1080))).toBe(1); // 0.833
    expect(pageZoom(win(0, 0, 390, 844))).toBe(1);
  });
});
