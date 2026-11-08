import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, MatchInfo, Player, Rect, Tile } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import breakout, { BREAKOUT, type BreakoutState } from '../src';

const { ball: R, paddle: P, brick: K } = BREAKOUT;
const STEP_MS = 1000 / 60;

/** A Match over `tiles` as the lobby builds it: every Tile a Device, the Host first, `bounds` the box around them. */
function matchOf(tiles: Tile[], players: Player[], seed = 1): MatchInfo {
  const x = Math.min(...tiles.map((t) => t.x));
  const y = Math.min(...tiles.map((t) => t.y));
  const bounds = { x, y, w: Math.max(...tiles.map((t) => t.x + t.w)) - x, h: Math.max(...tiles.map((t) => t.y + t.h)) - y };
  return {
    matchId: 'match-1',
    seed,
    tickHz: 60,
    players,
    devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    tiles,
    bounds,
  };
}
const BOTS: Player[] = [
  { playerId: 'bot:0', name: 'Bot', bot: true },
  { playerId: 'bot:1', name: 'Bot', bot: true },
];

/** Four phones in a 2×2 grid, 70 × 150 mm with 4 mm gaps, in Layout order d0 d1 over d2 d3; Ann seated at d2, Bo at d3. */
const TILES: Tile[] = [0, 1, 2, 3].map((i) => ({ deviceId: `d${i}`, x: (i % 2) * 74, y: Math.floor(i / 2) * 154, w: 70, h: 150, rot: 0 }));
const GRID = matchOf(TILES, [
  { playerId: 'p-ann', name: 'Ann', deviceId: 'd2' },
  { playerId: 'p-bo', name: 'Bo', deviceId: 'd3' },
]);
const DEVICES = TILES.map((t) => t.deviceId);
const B = GRID.bounds;
/** The bottom row, a paddle each: d2's is paddle 0, d3's paddle 1. */
const BOTTOM = [TILES[2]!, TILES[3]!];

/**
 * Three phones in a row as the lobby lays them out (`packages/layout/src/templates.ts`): 64 × 139, 71 × 153 and
 * 64 × 139 mm, 4 mm apart, each centred on the tallest, so the short ones' bottoms are 7 mm above the tall one's
 * and the bounds'. Ann at d0 and Bo at d2, as the lobby seats Players at the first and last Tile; d1 seats nobody.
 */
const ROW_TILES: Tile[] = [
  { deviceId: 'd0', x: 0, y: 7, w: 64, h: 139, rot: 0 },
  { deviceId: 'd1', x: 68, y: 0, w: 71, h: 153, rot: 0 },
  { deviceId: 'd2', x: 143, y: 7, w: 64, h: 139, rot: 0 },
];
const ROW = matchOf(ROW_TILES, [
  { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
  { playerId: 'p-bo', name: 'Bo', deviceId: 'd2' },
]);

/** Where a ball's centre is when it touches the face of `tile`'s paddle: the paddle sits `inset` above the Tile's own bottom. */
const contactOf = (tile: Tile): number => tile.y + tile.h - P.inset - P.h - R;
/** Where it is at a bottom paddle of the grid. */
const CONTACT = contactOf(BOTTOM[0]!);

/** The brick of `wall`'s cell (r, c): the grid is centred across the bounds, `K.top` below their top. */
function brickAt(wall: readonly string[], r: number, c: number): Rect {
  const cols = wall[0]!.length;
  const x0 = B.x + (B.w - (cols * (K.w + K.gap) - K.gap)) / 2;
  return { x: x0 + c * (K.w + K.gap), y: B.y + K.top + r * (K.h + K.gap), w: K.w, h: K.h };
}
const onTile = (k: Rect, t: Tile): boolean => k.x >= t.x && k.y >= t.y && k.x + k.w <= t.x + t.w && k.y + k.h <= t.y + t.h;
const bricksIn = (wall: readonly string[]): number => wall.join('').split('1').length - 1;
/** How many bricks (fills of a brick's size) a view drew in its last frame. */
const bricksDrawn = (t: TestMatch<BreakoutState>, d: DeviceId): number => t.drawn(d).filter((op) => op[0] === 'fillRect' && op[3] === K.w && op[4] === K.h).length;
/** The words a view drew in its last frame. */
const words = (t: TestMatch<BreakoutState>, d: DeviceId): unknown[] => t.drawn(d).flatMap((op) => (op[0] === 'fillText' ? [op[1]] : []));

/** One finger on a Tile's screen, put down on first use, moved along x at the Tile's middle height. */
function finger(t: TestMatch<BreakoutState>, tile: Tile) {
  let down = false;
  return async (x: number): Promise<void> => {
    await t.input(tile.deviceId, down ? 'move' : 'down', { x: clamp(x, tile.x, tile.x + tile.w), y: tile.y + tile.h / 2 });
    down = true;
  };
}
/** A tap on a Tile's middle: down and straight up again. */
async function tap(t: TestMatch<BreakoutState>, tile: Tile, x = tile.x + tile.w / 2): Promise<void> {
  await t.input(tile.deviceId, 'down', { x, y: tile.y + tile.h / 2 }, 9);
  await t.input(tile.deviceId, 'up', { x, y: tile.y + tile.h / 2 }, 9);
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const fold = (p: number, lo: number, hi: number): number => {
  const span = hi - lo;
  const u = (((p - lo) % (2 * span)) + 2 * span) % (2 * span);
  return u <= span ? lo + u : hi - (u - span);
};

/** Where a human's finger puts the paddle on `tile`, given the state it sees and the Match's bounds. */
type Hand = (s: BreakoutState, tile: Tile, step: number, bounds: Rect) => number;

/** Where the ball due soonest over `tile` crosses its paddle's face (bounces off the bounds' sides folded in), if one is. */
function crossing(s: BreakoutState, tile: Tile, bounds: Rect): number | undefined {
  const contact = contactOf(tile);
  let best: number | undefined;
  let soonest = Infinity;
  for (const b of s.world.balls) {
    if (b.vy <= 0 || b.y > contact) continue;
    const time = (contact - b.y) / b.vy;
    const x = fold(b.x + b.vx * time, bounds.x + R, bounds.x + bounds.w - R);
    if (x >= tile.x - R && x <= tile.x + tile.w + R && b.wait + time < soonest) [best, soonest] = [x, b.wait + time];
  }
  return best;
}
/** A Player who meets every ball coming down over their Tile `off` mm left of the paddle's centre (so it leaves to the left). */
const tracks =
  (off = 0): Hand =>
  (s, tile, _, bounds) =>
    (crossing(s, tile, bounds) ?? tile.x + tile.w / 2) + off;
/** A Player who meets every ball, off a different part of the paddle each time, so the returns spread over the wall. */
const sweeps: Hand = (s, tile, step, bounds) => tracks(Math.sin(step / 23) * (P.w / 2))(s, tile, step, bounds);
/** A Player who keeps the paddle at the far end of their Tile from where the next ball comes down over it. */
const dodges: Hand = (s, tile, _, bounds) => ((crossing(s, tile, bounds) ?? tile.x) < tile.x + tile.w / 2 ? tile.x + tile.w : tile.x);

/**
 * The fingers on the Tiles `hands` names moving as they say before every step,
 * for at most `ms`, until `done`, or until the Match ends. Returns the state
 * the Host's own view held after each step.
 */
async function play(
  t: TestMatch<BreakoutState>,
  match: MatchInfo,
  hands: Partial<Record<DeviceId, Hand>>,
  ms: number,
  done: (s: BreakoutState) => boolean = () => false,
): Promise<BreakoutState[]> {
  const fingers = Object.keys(hands).map((d) => {
    const tile = match.tiles.find((x) => x.deviceId === d)!;
    return { tile, hand: hands[d]!, move: finger(t, tile) };
  });
  const states: BreakoutState[] = [];
  for (let k = 0; k < ms / STEP_MS && !t.result(); k++) {
    const s = t.state('d0')!;
    for (const f of fingers) await f.move(f.hand(s, f.tile, k, match.bounds));
    await t.tick(STEP_MS);
    states.push(t.state('d0')!);
    if (done(states.at(-1)!)) break;
  }
  return states;
}

const start = (match: MatchInfo = GRID): Promise<TestMatch<BreakoutState>> => createTestMatch<BreakoutState>({ game: breakout, match });

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
    const t = await start();
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
    const t = await start();
    expect(t.state('d0')!.world.paddles).toEqual([35, 109]); // each in the middle of its Tile
    expect(t.state('d0')!.world.hold).toEqual([0, 1]); // both wait for their first touch

    await t.input('d2', 'down', { x: 30, y: 250 });
    await t.input('d3', 'down', { x: 120, y: 200 });
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(t.state(d)!.world.paddles).toEqual([30, 120]);
    expect(t.state('d0')!.world.hold).toEqual([]);

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
    const lobby: MatchInfo = { ...GRID, players: [{ ...GRID.players[0]!, deviceId: 'd0' }, BOTS[1]!] };
    const t = await start(lobby);
    expect(t.state('d0')!.world.hold).toEqual([]); // no human paddle: play waits for nobody
    const states = [t.state('d0')!, ...(await play(t, lobby, { d0: dodges }, 60_000))];
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

  it('costs every Device a life when a ball is lost under d2, and rests the next on d2’s paddle', async () => {
    const t = await start();
    const states = await play(t, GRID, { d2: dodges, d3: sweeps }, 120_000, (s) => s.world.lives < BREAKOUT.lives);
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
    // The next ball rests on the paddle that missed, to head up off it; d2's finger is down, so it waits for nothing more.
    const { balls, paddles } = t.state('d0')!.world;
    expect(balls).toEqual([{ x: paddles[0], y: CONTACT, vx: expect.any(Number), vy: expect.any(Number), wait: BREAKOUT.serveWait, on: 0 }]);
    expect(balls[0]!.vy).toBeLessThan(0);
    await t.tick(STEP_MS);
    expect(t.state('d0')!.world.hold).toEqual([]);
    expect(t.state('d0')!.world.balls[0]!.wait).toBeLessThan(BREAKOUT.serveWait);
    expect(t.result()).toBeUndefined();
    await t.stop();
  }, 60_000);

  it('carries the wall in the state after a brick broke and not in the next, else only as a keyframe, and every view keeps drawing the last wall', async () => {
    const t = await start();
    const full = bricksIn(t.state('d0')!.wall!);
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(t.state(d)!.wall).toBeUndefined();
    await t.tick(STEP_MS);
    for (const d of DEVICES) expect(bricksDrawn(t, d)).toBe(full); // drawn from a state without the wall

    // Up to the first break, a state carries the wall only as a keyframe: all of it, `wallEveryMs` after the last.
    const walls = [{ at: 0, bricks: full }];
    await play(t, GRID, { d2: tracks(), d3: tracks() }, 30_000, (s) => {
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
    for (const d of DEVICES) expect(bricksDrawn(t, d)).toBe(bricksIn(hit));
    await t.stop();
  });

  it('serves a second ball at 20 bricks, speeds up every 10, and ends the Match with every Player ranked when the wall is cleared', async () => {
    const t = await start();
    const full = bricksIn(t.state('d0')!.wall!);
    let left = full;
    const states = await play(t, GRID, { d2: sweeps, d3: sweeps }, 1_200_000, (s) => {
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
    const t = await start();
    const states = await play(t, GRID, { d2: dodges, d3: dodges }, 120_000);
    expect(states.map((s) => s.world.lives).filter((n, i, all) => n !== all[i - 1])).toEqual([3, 2, 1, 0]);
    const last = states.at(-1)!.world;
    expect(last.balls).toEqual([]);
    for (const d of DEVICES) expect(t.state(d)!.world.lives).toBe(0);
    expect(t.result()).toEqual({});
    expect(t.events('d3').map((e) => e.t)).toEqual(['started', 'ended', 'closed']);
  });

  describe('on a row of phones of different heights', () => {
    it('puts a paddle at the bottom of every Tile, above its dead strip, and every one returns balls at its own face', async () => {
      const bots = matchOf(ROW_TILES, BOTS);
      const t = await start(bots);
      expect(t.state('d0')!.world.paddles).toEqual([32, 103.5, 175]);
      await t.tick(STEP_MS);
      await t.tick(STEP_MS);
      for (const tile of ROW_TILES) {
        const bottom = tile.y + tile.h;
        const dead = bottom - BREAKOUT.dead;
        for (const d of ROW_TILES.map((x) => x.deviceId)) {
          const ops = t.drawn(d);
          // Its paddle: P.w × P.h, its underside `inset` above this Tile's own bottom, clear of the dead strip.
          const pad = ops.filter((op) => op[0] === 'fillRect' && op[3] === P.w && op[4] === P.h && (op[1] as number) >= tile.x && (op[1] as number) + P.w <= tile.x + tile.w);
          expect(pad.map((op) => op[2]), `${tile.deviceId}'s paddle on ${d}`).toEqual([bottom - P.inset - P.h]);
          expect((pad[0]![2] as number) + P.h).toBeLessThanOrEqual(dead);
          // The dead strip's edge, across the Tile.
          const at = ops.findIndex((op) => op[0] === 'moveTo' && op[1] === tile.x && op[2] === dead);
          expect(at, `${tile.deviceId}'s dead line on ${d}`).toBeGreaterThanOrEqual(0);
          expect(ops[at + 1]).toEqual(['lineTo', tile.x + tile.w, dead]);
        }
      }

      // Bots on every paddle: each returns balls coming down over its Tile, at its own Tile's face.
      const states = [t.state('d0')!, ...(await play(t, bots, {}, 60_000))];
      const returns = ROW_TILES.map(() => 0);
      for (const [i, s] of states.slice(1).entries()) {
        s.world.balls.forEach((b, j) => {
          const was = states[i]!.world.balls[j];
          if (!was || b.vy >= 0 || was.vy <= 0 || b.y < 100) return;
          const k = ROW_TILES.findIndex((tile) => b.x >= tile.x - R - P.w / 2 && b.x <= tile.x + tile.w + R + P.w / 2 && Math.abs(b.y - contactOf(tile)) < 3);
          expect(k, `a return at ${b.x}, ${b.y}`).toBeGreaterThanOrEqual(0);
          returns[k]!++;
        });
      }
      expect(returns.every((n) => n >= 3), `returns per Tile ${returns.join(', ')}`).toBe(true);
      expect(contactOf(ROW_TILES[0]!)).toBe(contactOf(ROW_TILES[1]!) - 7); // the short phones' faces sit 7 mm higher
      await t.stop();
    }, 60_000);

    it('waits for every human paddle’s Tile to be touched before the first serve moves, asking on every Tile', async () => {
      const t = await start(ROW);
      const first = t.state('d0')!.world.balls[0]!;
      expect(t.state('d0')!.world.hold).toEqual([0, 2]); // Ann's and Bo's; d1's bot waits for nothing
      await t.tick(5000);
      expect(t.state('d1')!.world.balls).toEqual([first]);
      for (const d of ['d0', 'd1', 'd2']) expect(words(t, d)).toEqual(expect.arrayContaining(['Ann, touch to start', 'Bo, touch to start']));

      await tap(t, ROW_TILES[0]!);
      await t.tick(2000);
      expect(t.state('d0')!.world.hold).toEqual([2]);
      expect(t.state('d0')!.world.balls).toEqual([first]);
      for (const d of ['d0', 'd1', 'd2']) {
        expect(words(t, d)).toContain('Bo, touch to start');
        expect(words(t, d)).not.toContain('Ann, touch to start');
      }

      // A finger that stays down counts as well as a tap.
      await t.input('d2', 'down', { x: 175, y: 80 });
      await t.tick(BREAKOUT.serveWait * 1000 + 2 * STEP_MS);
      const s = t.state('d0')!.world;
      expect(s.hold).toEqual([]);
      expect(s.balls[0]!.wait).toBe(0);
      expect(s.balls[0]!.y).toBeGreaterThan(first.y); // on its way down
      for (const d of ['d0', 'd1', 'd2']) expect(words(t, d).filter((w) => String(w).includes('touch to start'))).toEqual([]);
      await t.stop();
    });

    it('loses a ball that falls below a short Tile’s bottom while still inside the bounds, and rests the next on that Tile’s paddle until it is touched', async () => {
      const t = await start(ROW);
      const ann = ROW_TILES[0]!;
      // Ann taps once to start and leaves her paddle in the middle of d0; Bo meets every ball over d2; d1 is a bot's.
      await tap(t, ann);
      const states = [t.state('d0')!, ...(await play(t, ROW, { d2: tracks() }, 120_000, (s) => s.world.lives < BREAKOUT.lives))];
      const lost = states.findIndex((s) => s.world.lives < BREAKOUT.lives);
      expect(lost).toBeGreaterThan(0);
      const was = states[lost - 1]!.world.balls[0]!;
      // Over d0 when it went: one step on it is wholly below d0's bottom (146) yet still inside the bounds (153 deep).
      const y = was.y + was.vy / 60;
      expect(was.x).toBeGreaterThanOrEqual(ann.x);
      expect(was.x).toBeLessThanOrEqual(ann.x + ann.w);
      expect(y - R).toBeGreaterThan(ann.y + ann.h);
      expect(y).toBeLessThan(ROW.bounds.y + ROW.bounds.h);

      // The next rests on Ann's paddle and asks her, on every Tile, until she touches d0.
      const rest = { x: 32, y: contactOf(ann), wait: BREAKOUT.serveWait, on: 0 };
      expect(states[lost]!.world.hold).toEqual([0]);
      expect(states[lost]!.world.balls).toEqual([expect.objectContaining(rest)]);
      await t.tick(3000);
      expect(t.state('d1')!.world.balls).toEqual([expect.objectContaining(rest)]);
      for (const d of ['d0', 'd1', 'd2']) expect(words(t, d)).toContain('Ann, touch to start');

      // Her finger lands at x 50: the paddle goes there with the ball on it, and the ball rests `serveWait`, then heads up off it.
      await t.input('d0', 'down', { x: 50, y: 100 });
      await t.tick(STEP_MS);
      expect(t.state('d0')!.world.hold).toEqual([]);
      expect(t.state('d0')!.world.balls[0]).toMatchObject({ x: 50, y: contactOf(ann), on: 0 });
      await t.tick(BREAKOUT.serveWait * 1000 + STEP_MS);
      const off = t.state('d0')!.world.balls[0]!;
      expect(off.wait).toBe(0);
      expect(off.on).toBeUndefined();
      expect(off.vy).toBeLessThan(0);
      expect(off.y).toBeLessThan(contactOf(ann));
      await t.stop();
    }, 60_000);
  });
});
