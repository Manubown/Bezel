import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inProcessLink, runMatch, type MatchHandle, type MatchInfo, type NetFrame, type Tile } from '@mgc/sdk';
import tracer from '../src';

const R = 6;
/** Two 70 × 150 mm Tiles in a row with a 4 mm bezel gap between x = 70 and x = 74. */
const TILES: Tile[] = [
  { deviceId: 'd0', x: 0, y: 0, w: 70, h: 150, rot: 0 },
  { deviceId: 'd1', x: 74, y: 0, w: 70, h: 150, rot: 0 },
];
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 60,
  players: [
    { playerId: 'p-ann', name: 'Ann' },
    { playerId: 'p-bo', name: 'Bo' },
  ],
  devices: TILES.map((tile) => ({ deviceId: tile.deviceId, role: 'tile' as const, name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles: TILES,
  bounds: { x: 0, y: 0, w: 144, h: 150 },
};
const FRAME_MS = 17;
/** What the SDK itself does to the canvas around `draw`. */
const SDK_OPS: Record<string, true> = { setTransform: true, clearRect: true, save: true, restore: true };

type Ball = { x: number; y: number; vx: number; vy: number };
type Op = [string, ...unknown[]];

/** A headless mount: animation frames fire when the test says so; the 2D context records every call. */
function headless() {
  const ops: Op[] = [];
  const g = new Proxy(
    {},
    {
      get: (_, k) => (...args: unknown[]) => void ops.push([String(k), ...args]),
      set: (_, k, v) => (ops.push([`${String(k)}=`, v]), true),
    },
  );
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const win = {
    devicePixelRatio: 1,
    requestAnimationFrame: (cb: FrameRequestCallback) => (frames.set(++next, cb), next),
    cancelAnimationFrame: (id: number) => void frames.delete(id),
  };
  const doc = { defaultView: win, createElement: (tag: string) => element(tag) };
  function element(tag: string) {
    return {
      ownerDocument: doc,
      style: { cssText: '' },
      clientWidth: 420,
      clientHeight: 900,
      width: 0,
      height: 0,
      append() {},
      prepend() {},
      remove() {},
      getContext: () => (tag === 'canvas' ? g : null),
    };
  }
  return {
    mount: element('div') as unknown as HTMLElement,
    /** Frames the SDK painted (cleared) so far. */
    painted: () => ops.filter(([op]) => op === 'clearRect').length,
    /** Canvas calls that are the game's, not the SDK's. */
    drawn: () => ops.filter(([op]) => !SDK_OPS[op]),
    async frame(ms: number): Promise<void> {
      await vi.advanceTimersByTimeAsync(ms);
      const due = [...frames.values()];
      frames.clear();
      for (const cb of due) cb(performance.now());
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

/** The Host Device of MATCH alone, running the tracer through the SDK; `states` is what it sent to the other Tile. */
function hostAlone() {
  const screen = headless();
  const states: Ball[] = [];
  const handle: MatchHandle = runMatch({
    link: inProcessLink(() => Promise.resolve({ default: tracer })),
    match: MATCH,
    self: { deviceId: 'd0', pxPerMm: 6, mount: screen.mount },
    now: () => Date.now(),
    send: (f: NetFrame) => {
      if (f.t === 'state') states.push(f.state as Ball);
    },
    onEvent: () => {},
    authority: true,
  });
  return { screen, states, handle };
}

describe('the tracer Game', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('imports nothing but the SDK', () => {
    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    const specifiers = files.flatMap((f) =>
      [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    );
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: object };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@mgc/sdk']);
  });

  it('draws nothing until its first state, then the ball where the host published it', async () => {
    const { screen, states, handle } = hostAlone();
    await screen.frame(0); // links ready, init posted
    await screen.frame(0); // no fixed step is due yet
    await screen.frame(0);
    expect(states).toEqual([]);
    expect(screen.painted()).toBeGreaterThanOrEqual(2); // the SDK ran draw on a cleared canvas…
    expect(screen.drawn()).toEqual([]); // …and the tracer drew nothing

    await screen.frame(FRAME_MS); // one fixed step: the host publishes
    await screen.frame(0); // the Host's own view draws it
    expect(states).toHaveLength(1);
    const arcs = screen.drawn().filter(([op]) => op === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    const [, x, y, r] = arcs.at(-1) as [string, number, number, number];
    expect(r).toBe(R);
    // Extrapolated by at most one frame at 120 mm/s.
    expect(Math.abs(x - states[0]!.x)).toBeLessThanOrEqual(2.1);
    expect(Math.abs(y - states[0]!.y)).toBeLessThanOrEqual(2.1);
    handle.stop('aborted');
  });

  it('moves the ball continuously inside the Layout bounds, across the bezel both ways', async () => {
    const { screen, states, handle } = hostAlone();
    await screen.frame(0);
    for (let i = 0; i < 300; i++) await screen.frame(FRAME_MS);
    handle.stop('aborted');

    expect(states.length).toBeGreaterThan(290);
    const { w, h } = MATCH.bounds;
    for (const b of states) {
      expect(b.x).toBeGreaterThanOrEqual(R - 1e-9);
      expect(b.x).toBeLessThanOrEqual(w - R + 1e-9);
      expect(b.y).toBeGreaterThanOrEqual(R - 1e-9);
      expect(b.y).toBeLessThanOrEqual(h - R + 1e-9);
    }
    // One fixed step never moves it further than its speed allows: no jumps.
    states.slice(1).forEach((b, i) => {
      expect(Math.abs(b.x - states[i]!.x)).toBeLessThanOrEqual(120 / 60 + 1e-9);
      expect(Math.abs(b.y - states[i]!.y)).toBeLessThanOrEqual((120 * 0.618) / 60 + 1e-9);
    });
    // Wholly on the right Tile at some point, and back wholly on the left one later.
    const right = states.findIndex((b) => b.x - R > TILES[1]!.x);
    expect(right).toBeGreaterThanOrEqual(0);
    expect(states.slice(right).some((b) => b.x + R < TILES[0]!.x + TILES[0]!.w)).toBe(true);
  });
});
