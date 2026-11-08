import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, MatchInfo, Player, Rect, Tile, Vec2 } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import snake, { SNAKE, type SnakeState } from '../src';

const HZ = snake.manifest.tickHz!;
const STEP_MS = 1000 / HZ;
/** How far a head runs in the step after state `s`, mm, give or take the state's rounding of the speed. */
const stepAfter = (s: SnakeState): number => (s.speed + 0.05) / HZ;
/** The most a heading turns in the step after state `s`: the speed over the turning radius, plus the state's rounding of both. */
const turnAfter = (s: SnakeState): number => stepAfter(s) / SNAKE.radius + 0.001;
/** Up a screen, and down it. */
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

/** A phone, 70 × 150 mm, its top-left corner at world `(x, y)`, turned `rot` clockwise about that corner. */
const phone = (i: number, x: number, y: number, rot = 0): Tile => ({ deviceId: `d${i}`, x, y, w: 70, h: 150, rot });

const ANN: Player = { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' };
const BO: Player = { playerId: 'p-bo', name: 'Bo', deviceId: 'd1' };
/** A bot Player in slot `slot`, as the lobby makes it. */
const bot = (slot: 0 | 1): Player => ({ playerId: `bot:${slot}`, name: 'Bot', bot: true });

/** Two phones in a row with a 4 mm bezel gap: Ann at d0, Bo at d1. */
const ROW = { tiles: [phone(0, 0, 0), phone(1, 74, 0)], bounds: { x: 0, y: 0, w: 144, h: 150 } };
/** One phone. */
const ONE = { tiles: [phone(0, 0, 0)], bounds: { x: 0, y: 0, w: 70, h: 150 } };
/** A 2 × 2 grid, 4 mm gaps, in row-major Tile order as the lobby's grid places them. */
const GRID = { tiles: [phone(0, 0, 0), phone(1, 74, 0), phone(2, 0, 154), phone(3, 74, 154)], bounds: { x: 0, y: 0, w: 144, h: 304 } };
/**
 * d0 upright, d1 turned a quarter clockwise about its corner (224, 0), so it
 * lies on its side right of d0 with a 4 mm gap: its screen covers world
 * x 74…224, y 0…70. The lobby makes no rotated Tile; this Match is built by hand.
 */
const ROTATED = { tiles: [phone(0, 0, 0), phone(1, 224, 0, Math.PI / 2)], bounds: { x: 0, y: 0, w: 224, h: 150 } };
/**
 * Three phones in a row as the lobby lays them out (`packages/layout/src/templates.ts`): 64 × 139, 71 × 153 and
 * 64 × 139 mm, 4 mm apart, each centred on the tallest. The bounds are 207 × 153: above and below each short
 * phone runs a 7 mm band no phone covers.
 */
const ROW3 = {
  tiles: [
    { deviceId: 'd0', x: 0, y: 7, w: 64, h: 139, rot: 0 },
    { deviceId: 'd1', x: 68, y: 0, w: 71, h: 153, rot: 0 },
    { deviceId: 'd2', x: 143, y: 7, w: 64, h: 139, rot: 0 },
  ],
  bounds: { x: 0, y: 0, w: 207, h: 153 },
};
/** Ann at the row's first Tile, Bo at its last, as the lobby seats them. */
const ENDS: Player[] = [ANN, { ...BO, deviceId: 'd2' }];
/** Where each Tile's screen lies in the world, worked out by hand (not with the game's rotation). */
const AREAS = { grid: GRID.tiles as Rect[], rotated: [{ x: 0, y: 0, w: 70, h: 150 }, { x: 74, y: 0, w: 150, h: 70 }] };

function matchOf(layout: { tiles: Tile[]; bounds: Rect }, players: Player[], seed = 1): MatchInfo {
  const { tiles, bounds } = layout;
  return {
    matchId: 'match-1',
    seed,
    tickHz: HZ,
    players,
    devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    tiles,
    bounds,
  };
}

const head = (s: SnakeState, k: number): Vec2 => ({ x: s.snakes[k]!.points[0]!, y: s.snakes[k]!.points[1]! });
const food = (s: SnakeState): Vec2[] => Array.from({ length: s.food.length / 2 }, (_, k) => ({ x: s.food[2 * k]!, y: s.food[2 * k + 1]! }));
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
/** The polyline's length, mm. */
function arc(pts: number[]): number {
  let d = 0;
  for (let k = 2; k < pts.length; k += 2) d += Math.hypot(pts[k]! - pts[k - 2]!, pts[k + 1]! - pts[k - 1]!);
  return d;
}
/** The area `p` lies on, `margin` inside its edges; −1 for none. */
const areaOf = (areas: Rect[], p: Vec2, margin: number): number =>
  areas.findIndex((a) => p.x >= a.x + margin && p.x <= a.x + a.w - margin && p.y >= a.y + margin && p.y <= a.y + a.h - margin);
/** `foodMargin` less the state's rounding to 0.1 mm. */
const FOOD_IN = SNAKE.foodMargin - 0.05;

/** A Match started and through its countdown: the snakes are about to run. */
async function begin(match: MatchInfo): Promise<TestMatch<SnakeState>> {
  const t = await createTestMatch<SnakeState>({ game: snake, match });
  await t.tick(SNAKE.ready * 1000);
  return t;
}

/** One step; the state the Device `on` holds after it (the Host's own view by default). */
async function step(t: TestMatch<SnakeState>, on: DeviceId = 'd0'): Promise<SnakeState> {
  await t.tick(STEP_MS);
  return t.state(on)!;
}

/** A finger on `deviceId`'s screen, put down at its first point and moved to each next one; `null` lifts it. */
function finger(t: TestMatch<SnakeState>, deviceId: DeviceId) {
  let at: Vec2 | undefined;
  return async (to: Vec2 | null): Promise<void> => {
    if (to === null) {
      if (at) await t.input(deviceId, 'up', at);
      at = undefined;
    } else if (!at || at.x !== to.x || at.y !== to.y) {
      await t.input(deviceId, at ? 'move' : 'down', to);
      at = to;
    }
  };
}

const faults = (t: TestMatch<SnakeState>, ids: DeviceId[]) => ids.flatMap((id) => t.events(id).filter((e) => e.t === 'fault'));

describe('Snake', () => {
  it('declares 1–4 Tiles of any template, no Controllers, 1–2 Players, bots, 30 Hz, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, templates, bots, tickHz } = snake.manifest;
    expect({ tiles, controllers, players, templates, bots, tickHz }).toEqual({ tiles: { min: 1, max: 4 }, controllers: { min: 0, max: 0 }, players: { min: 1, max: 2 }, templates: undefined, bots: true, tickHz: 30 });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: object };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@mgc/sdk']);
  });

  it('lays food only on Tiles, a margin inside their edges, never in a gap: in a grid and on a rotated Tile', async () => {
    for (const [layout, areas] of [
      [GRID, AREAS.grid],
      [ROTATED, AREAS.rotated],
    ] as const) {
      const hits = areas.map(() => 0);
      for (let seed = 1; seed <= 30; seed++) {
        const t = await createTestMatch<SnakeState>({ game: snake, match: matchOf(layout, [bot(0)], seed) });
        for (const f of food(t.state('d0')!)) {
          const a = areaOf(areas, f, FOOD_IN);
          expect(a, `seed ${seed}: food at ${f.x}, ${f.y}`).toBeGreaterThanOrEqual(0);
          hits[a]!++;
        }
        await t.stop();
      }
      expect(hits.every((h) => h > 0), `food per Tile ${hits.join(', ')}`).toBe(true); // the rotated Tile gets its share
    }

    // Food that comes back after a bot ate it lands on a Tile too.
    const t = await begin(matchOf(ROTATED, [bot(0)]));
    let s = t.state('d1')!;
    for (let k = 0; k < 60 * HZ && !t.result(); k++) {
      s = await step(t, 'd1');
      for (const f of food(s)) expect(areaOf(AREAS.rotated, f, FOOD_IN), `food at ${f.x}, ${f.y}`).toBeGreaterThanOrEqual(0);
    }
    expect(s.snakes[0]!.score).toBeGreaterThanOrEqual(3);
    expect(faults(t, ['d0', 'd1'])).toEqual([]); // the rotated Tile's view draws its words turned with it
  });

  it('starts each snake as a dot on its home Tile heading along the bounds’ long axis, slow, speeding up as it runs', async () => {
    const t = await createTestMatch<SnakeState>({ game: snake, match: matchOf(ROW3, ENDS) });
    const ready = t.state('d1')!;
    expect(ready.phase).toBe('ready');
    // Ann a third of the way down d0, 10 mm in from its left edge, heading right; Bo two thirds down d2, 10 mm in from its right edge, heading left.
    expect(ready.snakes.map((x) => x.points)).toEqual([
      [10, 53.3, 10, 53.3],
      [197, 99.7, 197, 99.7],
    ]);
    expect(ready.snakes.map((x) => x.heading)).toEqual([0, 3.142]);
    expect(ready.snakes.map((x) => x.length)).toEqual([SNAKE.start, SNAKE.start]);

    await t.tick(SNAKE.ready * 1000);
    const first = await step(t);
    expect(first.speed).toBe(SNAKE.speed);
    expect(head(first, 0).x).toBeCloseTo(10 + SNAKE.speed / HZ, 1);
    // The body grows out of the dot while the tail waits where the snake started; the speed rises `accel` a second.
    for (let k = 0; k < 2 * HZ; k++) await step(t);
    const grown = t.state('d0')!;
    expect(grown.snakes[0]!.points.slice(-2)).toEqual([10, 53.3]);
    expect(arc(grown.snakes[0]!.points)).toBeCloseTo(head(grown, 0).x - 10, 0);
    expect(arc(grown.snakes[0]!.points)).toBeLessThan(SNAKE.start);
    expect(grown.speed).toBeCloseTo(SNAKE.speed + SNAKE.accel * 2, 0);
    await t.stop();

    // One Tile, taller than wide: along y, from its top heading down. A grid's bottom-right Tile: from its bottom heading up.
    const one = await createTestMatch<SnakeState>({ game: snake, match: matchOf(ONE, [ANN]) });
    expect(one.state('d0')!.snakes[0]).toMatchObject({ points: [35, 10, 35, 10], heading: 1.571 });
    await one.stop();
    const grid = await createTestMatch<SnakeState>({ game: snake, match: matchOf(GRID, [{ ...ANN, deviceId: 'd3' }]) });
    expect(grid.state('d0')!.snakes[0]).toMatchObject({ points: [109, 294, 109, 294], heading: -1.571 });
    await grid.stop();
  });

  it('runs a head straight across a bezel gap, where no finger turns it, and ends the snake at the bounds', async () => {
    // Ann alone, seated at d3 (bottom right of the grid): she starts at its bottom, runs up through the gap into d1, then off the top.
    const t = await begin(matchOf(GRID, [{ ...ANN, deviceId: 'd3' }]));
    const first = t.state('d0')!;
    expect(first.phase).toBe('run');
    expect(head(first, 0)).toEqual({ x: 109, y: 294 });
    expect(first.snakes[0]!.heading).toBeCloseTo(UP, 3);

    await finger(t, 'd1')({ x: 140, y: 140 }); // d1 seats nobody: steers nothing
    const ann = finger(t, 'd3');
    const states: SnakeState[] = [];
    for (let k = 0; k < 30 * HZ && !t.result(); k++) {
      const s = await step(t);
      states.push(s);
      // In the gap between d3 and d1 her finger on d3, far right, would turn her; a head off every Tile runs straight on.
      const { y } = head(s, 0);
      await ann(y > 150 && y < 154 ? { x: 140, y: 300 } : null);
    }
    const inGap = states.filter((s) => head(s, 0).y > 150 && head(s, 0).y < 154);
    expect(inGap.length).toBeGreaterThanOrEqual(2);
    expect(inGap.every((s) => s.snakes[0]!.alive)).toBe(true);
    for (const s of states) {
      expect(head(s, 0).x).toBe(109);
      expect(s.snakes[0]!.heading).toBeCloseTo(UP, 3);
    }

    const last = states.at(-1)!;
    expect(last.snakes[0]!.alive).toBe(false);
    expect(head(last, 0).y).toBeLessThan(0); // just past the top edge of the bounds
    expect(head(last, 0).y).toBeGreaterThanOrEqual(-stepAfter(states.at(-2)!));
    expect(states.slice(0, -1).every((s) => s.snakes[0]!.alive)).toBe(true);
    expect(t.result()).toEqual({ scores: { 'p-ann': last.snakes[0]!.score }, ranking: ['p-ann'] });
  });

  it('turns Ann’s snake toward a finger on d0 at most at the turn rate, and not Bo’s; a finger off her Tile steers nothing', async () => {
    // Two phones a little taller than wide: both snakes start at their Tile's top, heading down.
    const t = await begin(matchOf(ROW, [ANN, BO]));
    const ann = finger(t, 'd0');
    let prev = t.state('d1')!;
    expect(prev.snakes.map((x) => x.heading)).toEqual([1.571, 1.571]);
    // Ann's finger below and to the right of her as she runs down: she turns clockwise.
    await ann({ x: 5, y: 60 });
    for (let k = 0; k < 6; k++) {
      const s = await step(t, 'd1'); // the Peer's view: every Device sees the same snakes
      const turned = s.snakes[0]!.heading - prev.snakes[0]!.heading;
      expect(turned).toBeGreaterThan(0); // clockwise, toward the finger
      expect(turned).toBeLessThanOrEqual(turnAfter(prev));
      expect(s.snakes[1]!.heading).toBeCloseTo(DOWN, 3);
      expect(head(s, 1).x).toBe(120.7);
      prev = s;
    }

    // Lifted, then down on d0's screen at a world point off d0 (beside it, over d1): straight on.
    await ann(null);
    await t.input('d0', 'down', { x: 100, y: 40 }, 2);
    const heading = (await step(t, 'd1')).snakes[0]!.heading;
    for (let k = 0; k < 4; k++) expect((await step(t, 'd1')).snakes[0]!.heading).toBe(heading);
    await t.input('d0', 'up', { x: 100, y: 40 }, 2);

    // Bo's finger on d1, east of his head (to his left as he runs down), turns his snake counter-clockwise and leaves Ann's alone.
    await finger(t, 'd1')({ x: 140, y: head(prev, 1).y });
    for (let k = 0; k < 3; k++) {
      const s = await step(t, 'd1');
      expect(s.snakes[1]!.heading - prev.snakes[1]!.heading).toBeLessThan(0);
      expect(s.snakes[0]!.heading).toBe(heading);
      prev = s;
    }
    expect(faults(t, ['d0', 'd1'])).toEqual([]);
  });

  it('ends a two-snake Match when one snake dies: the last one alive wins', async () => {
    const t = await begin(matchOf(ROW, [ANN, BO]));
    // Ann circles around a finger at her Tile's centre; Bo has none and runs straight down off the bottom.
    await finger(t, 'd0')({ x: 35, y: 75 });
    let s = t.state('d0')!;
    let was = s;
    while (!t.result()) [was, s] = [s, await step(t)];
    expect(s.snakes.map((x) => x.alive)).toEqual([true, false]);
    expect(head(s, 1).y).toBeGreaterThan(150);
    expect(head(s, 1).y).toBeLessThanOrEqual(150 + stepAfter(was));
    expect(t.result()).toEqual({ scores: { 'p-ann': s.snakes[0]!.score, 'p-bo': s.snakes[1]!.score }, ranking: ['p-ann', 'p-bo'] });
  });

  it('grows a snake that eats by SNAKE.growth, its tail waiting while the head runs on, and lays new food', async () => {
    const t = await begin(matchOf(ONE, [ANN]));
    const ann = finger(t, 'd0');
    let s = t.state('d0')!;
    // Round the Tile's middle until the snake has grown out of its starting dot to its whole length, eating nothing.
    await ann({ x: 35, y: 75 });
    while (arc(s.snakes[0]!.points) < SNAKE.start - 0.5) s = await step(t);
    expect(s.snakes[0]!.score).toBe(0);
    let before = s;
    // Ann's finger on the food nearest her head until she eats it.
    for (let k = 0; k < 20 * HZ && s.snakes[0]!.score === 0 && !t.result(); k++) {
      const h = head(s, 0);
      await ann(food(s).reduce((a, b) => (dist(b, h) < dist(a, h) ? b : a)));
      before = s;
      s = await step(t);
    }
    expect(s.snakes[0]!.score).toBe(1);
    expect(before.snakes[0]!.length).toBe(SNAKE.start);
    expect(s.snakes[0]!.length).toBe(SNAKE.start + SNAKE.growth);
    const eaten = food(before).filter((f) => !food(s).some((g) => g.x === f.x && g.y === f.y));
    expect(eaten.length).toBe(1);
    expect(dist(eaten[0]!, head(s, 0))).toBeLessThan(SNAKE.foodRadius + SNAKE.width / 2 + 0.1);
    expect(food(s).length).toBe(SNAKE.food); // a new dot for the eaten one

    // The tail waits while the head runs on, until the snake is as long as it has grown.
    await ann({ x: 35, y: 75 });
    expect(arc(s.snakes[0]!.points)).toBeCloseTo(SNAKE.start, 0);
    let want: number = SNAKE.start;
    for (let j = 0; j < SNAKE.growth / stepAfter(s) + 3; j++) {
      want = Math.min(want + s.speed / HZ, SNAKE.start + SNAKE.growth);
      s = await step(t);
      expect(arc(s.snakes[0]!.points)).toBeCloseTo(want, 0);
    }
    expect(want).toBe(SNAKE.start + SNAKE.growth);
  });

  it('lets a bot steer itself to food without running off the surface', async () => {
    const t = await begin(matchOf(GRID, [bot(0)]));
    let s = t.state('d0')!;
    for (let k = 0; k < 30 * HZ && s.snakes[0]!.score < 3 && !t.result(); k++) s = await step(t);
    expect(t.result()).toBeUndefined();
    expect(s.snakes[0]!.alive).toBe(true);
    expect(s.snakes[0]!.score).toBe(3);
  });

  it('ends at the time limit with the longest snake first, whatever the Players’ order', { timeout: 120_000 }, async () => {
    const t = await begin(matchOf(ROW, [ANN, BO]));
    const ann = finger(t, 'd0');
    const bo = finger(t, 'd1');
    const d1 = AREAS.grid[1]!;
    // Ann circles: her finger holds the middle of her turning circle, taken where she is once that circle lies on
    // her Tile (until then it is on the Tile's centre), so she runs round from there and never crosses the way she
    // came in. Bo chases the food on his Tile farthest from his head (one inside his turning circle he would only
    // circle around) until he has eaten once; then he laps his Tile 20 mm inside its edges, a loop far longer than
    // he is, whatever more he eats on it.
    const d0 = AREAS.grid[0]!;
    const centre = (a: Rect): Vec2 => ({ x: a.x + a.w / 2, y: a.y + a.h / 2 });
    const roundabout = (s: SnakeState, k: number, a: Rect): Vec2 | undefined => {
      const h = head(s, k);
      const heading = s.snakes[k]!.heading;
      const inset = SNAKE.radius + SNAKE.width;
      return [-1, 1]
        .map((d) => ({ x: h.x + SNAKE.radius * Math.cos(heading + (d * Math.PI) / 2), y: h.y + SNAKE.radius * Math.sin(heading + (d * Math.PI) / 2) }))
        .filter((c) => c.x >= a.x + inset && c.x <= a.x + a.w - inset && c.y >= a.y + inset && c.y <= a.y + a.h - inset)
        .sort((p, q) => dist(p, centre(a)) - dist(q, centre(a)))[0];
    };
    const lap = [
      { x: 94, y: 20 },
      { x: 94, y: 130 },
      { x: 124, y: 130 },
      { x: 124, y: 20 },
    ];
    let s = t.state('d0')!;
    let prey: Vec2 | undefined;
    let round: Vec2 | undefined;
    let corner = -1;
    while (!t.result()) {
      round ??= roundabout(s, 0, d0);
      await ann(round ?? centre(d0));
      const h = head(s, 1);
      const mine = food(s).filter((f) => areaOf([d1], f, 0) === 0);
      if (!prey || !mine.some((f) => f.x === prey!.x && f.y === prey!.y)) prey = mine.sort((f, g) => dist(g, h) - dist(f, h))[0];
      if (s.snakes[1]!.score > 0) {
        // On to the nearest corner first, then round them in turn, each one given up for the next 12 mm short of it.
        if (corner < 0) corner = lap.reduce((best, c, k) => (dist(c, h) < dist(lap[best]!, h) ? k : best), 0);
        if (dist(lap[corner]!, h) < 12) corner = (corner + 1) % lap.length;
      }
      await bo(corner >= 0 ? lap[corner]! : (prey ?? centre(d1)));
      s = await step(t);
    }
    expect(t.now()).toBeCloseTo((SNAKE.ready + SNAKE.timeLimit) * 1000, 6);
    expect(s.clock).toBe(0);
    expect(s.speed).toBe(SNAKE.maxSpeed); // reached after (maxSpeed − speed) / accel seconds, and kept
    expect(s.snakes.map((x) => x.alive)).toEqual([true, true]);
    const [a, b] = s.snakes as [SnakeState['snakes'][number], SnakeState['snakes'][number]];
    expect(b.length).toBeGreaterThan(a.length);
    expect(t.result()).toEqual({ scores: { 'p-ann': a.score, 'p-bo': b.score }, ranking: ['p-bo', 'p-ann'] });
  });

  describe('on a row of three phones of different heights', () => {
    it('with nobody steering, runs both snakes along the row past each other, alive for at least 10 s, and off its far ends', async () => {
      const t = await createTestMatch<SnakeState>({ game: snake, match: matchOf(ROW3, ENDS) });
      let s = t.state('d0')!;
      while (!t.result()) s = await step(t);
      expect(t.now()).toBeGreaterThanOrEqual(10_000);
      expect(s.snakes.map((x) => x.alive)).toEqual([false, false]);
      // Ann off the right end, Bo off the left, each where it started across the row: nothing else ended them.
      expect(head(s, 0).x).toBeGreaterThan(ROW3.bounds.w);
      expect(head(s, 0).y).toBe(53.3);
      expect(head(s, 1).x).toBeLessThan(0);
      expect(head(s, 1).y).toBe(99.7);
      expect(faults(t, ['d0', 'd1', 'd2'])).toEqual([]);
    });

    it('ends a snake at a short phone’s top edge, where no phone lies straight on, not in the band beyond it', async () => {
      // Ann steers up toward the top of d0 (y 7) and lets go; above it to the bounds' top runs a 7 mm band no phone covers.
      const t = await begin(matchOf(ROW3, ENDS));
      const ann = finger(t, 'd0');
      let s = t.state('d0')!;
      let was = s;
      await ann({ x: 30, y: 8 });
      for (let k = 0; k < 10 * HZ && head(s, 0).y > 30; k++) [was, s] = [s, await step(t)];
      await ann(null);
      for (let k = 0; k < 10 * HZ && s.snakes[0]!.alive; k++) [was, s] = [s, await step(t)];
      expect(s.snakes[0]!.alive).toBe(false);
      // Dead at its first step off d0: on d0 a step before, now just above its edge, inside the bounds.
      const h = head(s, 0);
      expect(head(was, 0).y).toBeGreaterThanOrEqual(7);
      expect(h.y).toBeLessThan(7);
      expect(h.y).toBeGreaterThan(0);
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(64);
      expect(t.result()).toEqual({ scores: { 'p-ann': s.snakes[0]!.score, 'p-bo': s.snakes[1]!.score }, ranking: ['p-bo', 'p-ann'] });
    });

    it('lets a bot alone on it live at least 30 s of running, on every seed of ten', { timeout: 60_000 }, async () => {
      // Over seeds 1–20 a lone bot here dies 39–99 s into the Match or lives to its end (11 of 20 past 60 s); before
      // this fix, 14–50 s on seeds 1–10. The bar is 30 s: it still coils itself in when long.
      for (let seed = 1; seed <= 10; seed++) {
        const t = await begin(matchOf(ROW3, [bot(0)], seed));
        await t.tick(30_000);
        expect(t.result(), `seed ${seed}`).toBeUndefined();
        expect(t.state('d0')!.snakes[0]!.alive).toBe(true);
        await t.stop();
      }
    });
  });
});
