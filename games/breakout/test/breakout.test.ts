import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, Game, MatchInfo, Rect, Tile } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import breakout, { BREAKOUT, type BreakoutState } from '../src';

/** Four phones in a 2×2 grid, 70 × 150 mm with 4 mm gaps, in Layout order d0 d1 over d2 d3; Ann seated at d2, Bo at d3. */
const TILES: Tile[] = [0, 1, 2, 3].map((i) => ({ deviceId: `d${i}`, x: (i % 2) * 74, y: Math.floor(i / 2) * 154, w: 70, h: 150, rot: 0 }));
const GRID: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 60,
  players: [
    { playerId: 'p-ann', name: 'Ann', deviceId: 'd2' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'd3' },
  ],
  devices: TILES.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles: TILES,
  bounds: { x: 0, y: 0, w: 144, h: 304 },
};
const DEVICES = TILES.map((t) => t.deviceId);
const B = GRID.bounds;
const { ball: R, paddle: P, brick: K } = BREAKOUT;
const STEP_MS = 1000 / 60;
/** The bottom row, a paddle each: d2's is paddle 0, d3's paddle 1. */
const BOTTOM = [TILES[2]!, TILES[3]!];
/** Where a ball's centre is when it touches a bottom paddle's face. */
const CONTACT = B.y + B.h - P.inset - P.h - R;

/** The brick of `wall`'s cell (r, c): the grid is centred across the bounds, `K.top` below their top. */
function brickAt(wall: readonly string[], r: number, c: number): Rect {
  const cols = wall[0]!.length;
  const x0 = B.x + (B.w - (cols * (K.w + K.gap) - K.gap)) / 2;
  return { x: x0 + c * (K.w + K.gap), y: B.y + K.top + r * (K.h + K.gap), w: K.w, h: K.h };
}
const onTile = (k: Rect, t: Tile): boolean => k.x >= t.x && k.y >= t.y && k.x + k.w <= t.x + t.w && k.y + k.h <= t.y + t.h;
const bricksIn = (wall: readonly string[]): number => wall.join('').split('1').length - 1;

/** One finger on a Tile's screen, put down on first use, moved along x at the Tile's middle height. */
function finger(t: TestMatch<BreakoutState>, deviceId: DeviceId) {
  const tile = TILES.find((x) => x.deviceId === deviceId)!;
  let down = false;
  return async (x: number): Promise<void> => {
    await t.input(deviceId, down ? 'move' : 'down', { x: clamp(x, tile.x, tile.x + tile.w), y: tile.y + tile.h / 2 });
    down = true;
  };
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const fold = (p: number, lo: number, hi: number): number => {
  const span = hi - lo;
  const u = (((p - lo) % (2 * span)) + 2 * span) % (2 * span);
  return u <= span ? lo + u : hi - (u - span);
};

/** Where a human's finger puts the paddle on `tile`, given the state it sees. */
type Hand = (s: BreakoutState, tile: Tile, step: number) => number;

/** Where the ball due soonest over `tile` crosses the paddles' face (bounces off the bounds' sides folded in), if one is. */
function crossing(s: BreakoutState, tile: Tile): number | undefined {
  let best: number | undefined;
  let soonest = Infinity;
  for (const b of s.world.balls) {
    if (b.vy <= 0 || b.y > CONTACT) continue;
    const time = (CONTACT - b.y) / b.vy;
    const x = fold(b.x + b.vx * time, B.x + R, B.x + B.w - R);
    if (x >= tile.x - R && x <= tile.x + tile.w + R && b.wait + time < soonest) [best, soonest] = [x, b.wait + time];
  }
  return best;
}
/** A Player who meets every ball coming down over their Tile `off` mm left of the paddle's centre (so it leaves to the left). */
const tracks =
  (off = 0): Hand =>
  (s, tile) =>
    (crossing(s, tile) ?? tile.x + tile.w / 2) + off;
/** A Player who meets every ball, off a different part of the paddle each time, so the returns spread over the wall. */
const sweeps: Hand = (s, tile, step) => tracks(Math.sin(step / 23) * (P.w / 2))(s, tile, step);
/** A Player who keeps the paddle at the far end of their Tile from where the next ball comes down over it. */
const dodges: Hand = (s, tile) => ((crossing(s, tile) ?? tile.x) < tile.x + tile.w / 2 ? tile.x + tile.w : tile.x);

/**
 * The fingers on the Tiles `hands` names moving as they say before every step,
 * for at most `ms`, until `done`, or until the Match ends. Returns the state
 * the Host's own view held after each step.
 */
async function play(t: TestMatch<BreakoutState>, hands: Partial<Record<DeviceId, Hand>>, ms: number, done: (s: BreakoutState) => boolean = () => false): Promise<BreakoutState[]> {
  const fingers = Object.keys(hands).map((d) => ({ tile: TILES.find((x) => x.deviceId === d)!, hand: hands[d]!, move: finger(t, d) }));
  const states: BreakoutState[] = [];
  for (let k = 0; k < ms / STEP_MS && !t.result(); k++) {
    const s = t.state('d0')!;
    for (const f of fingers) await f.move(f.hand(s, f.tile, k));
    await t.tick(STEP_MS);
    states.push(t.state('d0')!);
    if (done(states.at(-1)!)) break;
  }
  return states;
}

/**
 * A Match of Breakout with every view's draw watched: after each frame, how
 * many bricks (fills of a brick's size) the view drew. The SDK's headless
 * canvas records every call in `ops` and never lets one go, which runs a long
 * Match of a few hundred bricks a frame out of memory, and `createTestMatch`
 * exposes neither; so each view is wrapped to read the calls off its frame's
 * context and empty the record after each frame.
 */
async function start(match: MatchInfo = GRID): Promise<{ t: TestMatch<BreakoutState>; drawn: Map<DeviceId, number> }> {
  const drawn = new Map<DeviceId, number>();
  const game: Game = {
    ...breakout,
    view(ctx) {
      const h = breakout.view(ctx);
      return {
        ...h,
        draw(f) {
          // The recording context answers `ops` through a Proxy `get` only (no `has` trap), so `'ops' in` would say no.
          const ops: unknown = Reflect.get(f.ctx, 'ops');
          if (!Array.isArray(ops)) throw new Error('not the headless recording canvas');
          ops.length = 0;
          h.draw!(f);
          drawn.set(ctx.deviceId, ops.filter((op: unknown[]) => op[0] === 'fillRect' && op[3] === K.w && op[4] === K.h).length);
          ops.length = 0;
        },
      };
    },
  };
  return { t: await createTestMatch<BreakoutState>({ game, match }), drawn };
}

describe('Breakout', () => {
  it('declares 1–4 Tiles, no Controllers, 1–4 Players, bots, the row and grid templates, 60 Hz, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, templates, bots, tickHz } = breakout.manifest;
    expect({ tiles, controllers, players, templates, bots, tickHz }).toEqual({
      tiles: { min: 1, max: 4 },
      controllers: { min: 0, max: 0 },
      players: { min: 1, max: 4 },
      templates: ['row', 'grid'],
      bots: true,
      tickHz: 60,
    });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: object };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@mgc/sdk']);
  });

  it('lays the wall over the top of the bounds and never places a brick across the gap between two Tiles', async () => {
    const { t } = await start();
    const wall = t.state('d0')!.wall!;
    for (const d of DEVICES) expect(t.state(d)!.wall).toEqual(wall);
    expect(wall.length).toBeGreaterThanOrEqual(10);
    expect(new Set(wall.map((row) => row.length)).size).toBe(1);

    const cells = wall.flatMap((row, r) => [...row].map((v, c) => ({ v, k: brickAt(wall, r, c) })));
    for (const { v, k } of cells) {
      // Inside the bounds' top `wallFraction`, below the text margin.
      expect(k.x).toBeGreaterThanOrEqual(B.x + K.side - 1e-9);
      expect(k.x + k.w).toBeLessThanOrEqual(B.x + B.w - K.side + 1e-9);
      expect(k.y).toBeGreaterThanOrEqual(B.y + K.top - 1e-9);
      expect(k.y + k.h).toBeLessThanOrEqual(B.y + B.h * BREAKOUT.wallFraction + 1e-9);
      // A brick exactly where it lies wholly on one Tile: none across the 4 mm gap, none missing elsewhere.
      expect(v).toBe(TILES.some((tile) => onTile(k, tile)) ? '1' : '0');
    }
    // The grid runs across the gap between d0 and d1: some cells there are left out, and both phones have bricks.
    const across = cells.filter(({ k }) => k.x < 74 && k.x + k.w > 70);
    expect(across.length).toBeGreaterThan(0);
    expect(across.every(({ v }) => v === '0')).toBe(true);
    for (const tile of [TILES[0]!, TILES[1]!]) expect(cells.filter(({ v, k }) => v === '1' && onTile(k, tile)).length).toBeGreaterThan(80);
    expect(bricksIn(wall)).toBeGreaterThan(200);
    await t.stop();
  });

  it('moves the bottom Tiles’ paddles along x only, with d2’s and d3’s fingers, each held to its own Tile; other Tiles move none', async () => {
    const { t } = await start();
    expect(t.state('d0')!.world.paddles).toEqual([35, 109]); // each in the middle of its Tile

    await t.input('d2', 'down', { x: 30, y: 250 });
    await t.input('d3', 'down', { x: 120, y: 200 });
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(t.state(d)!.world.paddles).toEqual([30, 120]);

    // Up and down the screen changes nothing but x.
    await t.input('d2', 'move', { x: 40, y: 160 });
    await t.input('d3', 'move', { x: 120, y: 300 });
    await t.tick(STEP_MS);
    expect(t.state('d1')!.world.paddles).toEqual([40, 120]);

    // To a Tile's edge: the paddle stops flush with its own Tile's side.
    await t.input('d2', 'move', { x: 1, y: 250 });
    await t.input('d3', 'move', { x: 143, y: 250 });
    await t.tick(STEP_MS);
    expect(t.state('d2')!.world.paddles).toEqual([P.w / 2, B.w - P.w / 2]);

    // The top Tiles are field only.
    await t.input('d0', 'down', { x: 35, y: 100 });
    await t.input('d1', 'down', { x: 100, y: 100 });
    await t.input('d0', 'move', { x: 60, y: 100 });
    await t.tick(STEP_MS);
    expect(t.state('d3')!.world.paddles).toEqual([P.w / 2, B.w - P.w / 2]);
    await t.stop();
  });

  it('plays every bottom Tile that seats nobody with a bot, at most at its speed, returning balls', async () => {
    // As the lobby seats them with Player 2 a bot: Ann at the first Tile (top left, field only), the bot at no Tile.
    const lobby: MatchInfo = { ...GRID, players: [{ ...GRID.players[0]!, deviceId: 'd0' }, { playerId: 'bot:1', name: 'Bot', bot: true }] };
    const { t } = await start(lobby);
    const states = [t.state('d0')!, ...(await play(t, { d0: dodges }, 60_000))];
    const returns = [0, 0];
    for (const [i, s] of states.slice(1).entries()) {
      const prev = states[i]!.world;
      for (const k of [0, 1]) {
        // At most its speed, whatever Ann's finger on d0 does.
        expect(Math.abs(s.world.paddles[k]! - prev.paddles[k]!)).toBeLessThanOrEqual(BREAKOUT.bot.speed / 60 + 1e-9);
      }
      s.world.balls.forEach((b, j) => {
        if (b.vy < 0 && (prev.balls[j]?.vy ?? 0) > 0 && b.y > CONTACT - 5) returns[b.x < 72 ? 0 : 1]!++;
      });
    }
    expect(returns[0]).toBeGreaterThanOrEqual(3);
    expect(returns[1]).toBeGreaterThanOrEqual(3);
    await t.stop();
  }, 60_000);

  it('costs every Device a life when a ball is lost under d2, and serves another', async () => {
    const { t } = await start();
    const states = await play(t, { d2: dodges, d3: sweeps }, 120_000, (s) => s.world.lives < BREAKOUT.lives);
    const lost = states.findIndex((s) => s.world.lives < BREAKOUT.lives);
    expect(lost).toBeGreaterThan(0);
    const before = states[lost - 1]!.world;
    expect(before.balls).toHaveLength(1);
    expect(before.balls[0]!.y).toBeGreaterThan(CONTACT); // past the paddles' face
    // It came down past the face where only d2's paddle reaches (d2's right edge plus the ball's radius).
    const above = states.slice(0, lost).filter((s) => s.world.balls[0]!.y <= CONTACT).at(-1)!.world.balls[0]!;
    expect(above.vy).toBeGreaterThan(0);
    expect(above.x + (above.vx * (CONTACT - above.y)) / above.vy).toBeLessThanOrEqual(BOTTOM[0]!.x + BOTTOM[0]!.w + R);
    for (const d of DEVICES) expect(t.state(d)!.world.lives).toBe(BREAKOUT.lives - 1);
    const [served] = t.state('d0')!.world.balls;
    expect(served!.wait).toBe(BREAKOUT.serveWait);
    expect(BOTTOM.some((tile) => served!.x === tile.x + tile.w / 2 && served!.y === tile.y + tile.h / 2)).toBe(true);
    expect(t.result()).toBeUndefined();
    await t.stop();
  }, 60_000);

  it('carries the wall in the state after a brick broke and not in the next, else only as a keyframe, and every view keeps drawing the last wall', async () => {
    const { t, drawn } = await start();
    const full = bricksIn(t.state('d0')!.wall!);
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(t.state(d)!.wall).toBeUndefined();
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(drawn.get(d)).toBe(full); // drawn from a state without the wall

    // Up to the first break, a state carries the wall only as a keyframe: all of it, `wallEveryMs` after the last.
    const walls = [{ at: 0, bricks: full }];
    await play(t, { d2: tracks(), d3: tracks() }, 30_000, (s) => {
      if (s.wall) walls.push({ at: t.now(), bricks: bricksIn(s.wall) });
      return s.wall !== undefined && bricksIn(s.wall) < full;
    });
    const keyframes = walls.slice(1, -1);
    expect(keyframes.length).toBeGreaterThanOrEqual(2);
    keyframes.forEach((k, i) => {
      expect(k.bricks).toBe(full);
      expect(k.at - walls[i]!.at).toBeGreaterThanOrEqual(BREAKOUT.wallEveryMs - 1e-6);
      expect(k.at - walls[i]!.at).toBeLessThan(BREAKOUT.wallEveryMs + STEP_MS);
    });
    for (const d of DEVICES) expect(bricksIn(t.state(d)!.wall!)).toBe(full - 1);
    const hit = t.state('d1')!.wall!;

    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(t.state(d)!.wall).toBeUndefined();
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(drawn.get(d)).toBe(bricksIn(hit));
    await t.stop();
  });

  it('serves a second ball at 20 bricks, speeds up every 10, and ends the Match with every Player ranked when the wall is cleared', async () => {
    const { t } = await start();
    const full = bricksIn(t.state('d0')!.wall!);
    let left = full;
    const states = await play(t, { d2: sweeps, d3: sweeps }, 1_200_000, (s) => {
      if (s.wall) left = bricksIn(s.wall);
      const broken = full - left;
      // One ball until 20 bricks, then two; every ball at the speed of the bricks broken so far.
      expect(s.world.balls).toHaveLength(broken >= BREAKOUT.secondBallAt ? 2 : 1);
      const v = Math.min(BREAKOUT.maxSpeed, BREAKOUT.speed * BREAKOUT.speedUp ** Math.floor(broken / BREAKOUT.speedEvery));
      for (const b of s.world.balls) expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(v, 6);
      return false;
    });
    expect(left).toBe(0);
    expect(states.at(-1)!.world.lives).toBeGreaterThan(0);
    expect(t.result()).toEqual({ ranking: ['p-ann', 'p-bo'] });
    expect(t.events('d1').map((e) => e.t)).toEqual(['started', 'ended', 'closed']);
  }, 120_000);

  it('ends the Match when the third ball is lost', async () => {
    const { t } = await start();
    const states = await play(t, { d2: dodges, d3: dodges }, 120_000);
    expect(states.map((s) => s.world.lives).filter((n, i, all) => n !== all[i - 1])).toEqual([3, 2, 1, 0]);
    const last = states.at(-1)!.world;
    expect(last.balls).toEqual([]);
    for (const d of DEVICES) expect(t.state(d)!.world.lives).toBe(0);
    expect(t.result()).toEqual({});
    expect(t.events('d3').map((e) => e.t)).toEqual(['started', 'ended', 'closed']);
  });
});
