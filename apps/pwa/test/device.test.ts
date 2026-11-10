import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageZoom, viewportSettled } from '../src/device';

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

describe('viewportSettled', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  /** A window whose `resize` listeners the test fires by hand. */
  function fakeWindow() {
    const listeners = new Set<() => void>();
    const target = { addEventListener: (_: string, h: () => void) => void listeners.add(h), removeEventListener: (_: string, h: () => void) => void listeners.delete(h) };
    return { win: { ...target, visualViewport: null } as unknown as Window, resize: () => listeners.forEach((h) => h()), listeners };
  }
  /** Whether `p` has resolved by now. */
  async function resolved(p: Promise<void>): Promise<boolean> {
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    return done;
  }

  it('resolves after the quiet time when the viewport does not change', async () => {
    const { win } = fakeWindow();
    const settled = viewportSettled(win, 120, 600);
    await vi.advanceTimersByTimeAsync(119);
    expect(await resolved(settled)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await resolved(settled)).toBe(true);
  });

  it('waits for the quiet time after the last resize: the zoom that lands 33 ms after load is in', async () => {
    const { win, resize, listeners } = fakeWindow();
    const settled = viewportSettled(win, 120, 600);
    await vi.advanceTimersByTimeAsync(33);
    resize();
    await vi.advanceTimersByTimeAsync(119);
    expect(await resolved(settled)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await resolved(settled)).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it('gives up waiting at the limit when the viewport never rests', async () => {
    const { win, resize } = fakeWindow();
    const settled = viewportSettled(win, 120, 600);
    // A resize every 50 ms, the last at 550 ms: never 120 ms of quiet before the limit.
    for (let t = 50; t <= 550; t += 50) {
      await vi.advanceTimersByTimeAsync(50);
      resize();
    }
    expect(await resolved(settled)).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(await resolved(settled)).toBe(true);
  });
});
