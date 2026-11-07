import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, Game, MatchInfo, Player, Tile, Vec2 } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import airHockey, { AIR_HOCKEY, type AirHockeyState } from '../src';

const STEP_MS = 1000 / 60;
/** `createTestMatch`'s CSS px per mm, at dpr 1. */
const PX = 6;
const R = AIR_HOCKEY.puck;
/** How far apart the puck's and a paddle's centres are when they touch. */
const REACH = AIR_HOCKEY.puck + AIR_HOCKEY.paddle;
const E = AIR_HOCKEY.restitution;
/** What friction leaves of the puck's speed over one step. */
const GLIDE = (1 - AIR_HOCKEY.friction) ** (1 / 60);

/*
 * Two phones in a row, 70 × 150 mm with a 4 mm gap: a 144 × 150 mm table
 * running along x, Ann's goal at x = 0 and Bo's at x = 144, each mouth
 * y 50–100. Ann's paddle keeps to x 9–63, Bo's to 81–135, both to y 9–141.
 */
const MID = { x: 72, y: 75 };
const HI = { x: 144 - R, y: 150 - R };
/** Corners where a paddle is clear of the straight shots down the middle. */
const ANN_CORNER = { x: 9, y: 9 };
const BO_CORNER = { x: 135, y: 141 };

/** The Tile a phone `w × h` mm makes lying turned by `rot` about its own centre `c`: its `x, y` is its screen's top-left corner. */
function placed(deviceId: DeviceId, c: Vec2, w: number, h: number, rot: number): Tile {
  const [cos, sin] = [Math.cos(rot), Math.sin(rot)];
  return { deviceId, x: c.x - ((w / 2) * cos - (h / 2) * sin), y: c.y - ((w / 2) * sin + (h / 2) * cos), w, h, rot };
}

function matchOf(tiles: Tile[], bounds: MatchInfo['bounds'], players: Player[]): MatchInfo {
  return {
    matchId: 'match-1',
    seed: 1,
    tickHz: 60,
    players,
    devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    tiles,
    bounds,
  };
}

const ANN: Player = { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' };
const BO: Player = { playerId: 'p-bo', name: 'Bo', deviceId: 'd1' };
/** A bot Player in slot `slot`, as the lobby makes it. */
const bot = (slot: 0 | 1): Player => ({ playerId: `bot:${slot}`, name: 'Bot', bot: true });

/** The row, the second phone lying turned by `rot` in the same place; Ann seated at the first, Bo at the second unless `players` says otherwise. */
const rowMatch = (rot: number, players: Player[] = [ANN, BO]): MatchInfo =>
  matchOf([placed('d0', { x: 35, y: 75 }, 70, 150, 0), placed('d1', { x: 109, y: 75 }, 70, 150, rot)], { x: 0, y: 0, w: 144, h: 150 }, players);

/**
 * The far phone (d1) upright and upside down. `local` is where a world point
 * lies on its screen, in its own mm, worked out by hand rather than through
 * `Surface`; `toWorld` turns a direction on its screen into the world's.
 */
const FAR = [
  { name: 'the far Tile at rot 0', rot: 0, local: (p: Vec2): Vec2 => ({ x: p.x - 74, y: p.y }), toWorld: (v: Vec2): Vec2 => v },
  { name: 'the far Tile at rot π', rot: Math.PI, local: (p: Vec2): Vec2 => ({ x: 144 - p.x, y: 150 - p.y }), toWorld: (v: Vec2): Vec2 => ({ x: -v.x, y: -v.y }) },
];

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
type Call = { op: string; args: unknown[]; m: Matrix };
const apply = (m: Matrix, p: Vec2): Vec2 => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
/** Which way upright text drawn under `m` points on the screen, as a unit vector. */
function upOf(m: Matrix): Vec2 {
  const len = Math.hypot(m.c, m.d);
  return { x: -m.c / len, y: -m.d / len };
}

/**
 * Air Hockey with each view's last frame of `arc` and `fillText` calls kept,
 * each with the canvas transform (CSS px) it ran under.
 */
function recorded(): { game: Game; frame(deviceId: DeviceId): Call[] } {
  const frames = new Map<DeviceId, Call[]>();
  const game: Game = {
    ...airHockey,
    view(ctx) {
      const handlers = airHockey.view(ctx);
      return {
        ...handlers,
        draw(f) {
          const calls: Call[] = [];
          const g = f.ctx;
          const spy = new Proxy(g, {
            get(target, k) {
              const v: unknown = Reflect.get(target, k);
              if (typeof v !== 'function') return v;
              if (k !== 'arc' && k !== 'fillText') return v.bind(target);
              return (...args: unknown[]) => {
                calls.push({ op: k, args, m: target.getTransform() });
                return v.apply(target, args);
              };
            },
            set: (target, k, v) => Reflect.set(target, k, v),
          });
          handlers.draw?.({ ...f, ctx: spy });
          frames.set(ctx.deviceId, calls);
        },
      };
    },
  };
  return { game, frame: (deviceId) => frames.get(deviceId) ?? [] };
}

/** One finger on a Tile's screen, at world mm (as `t.input` takes them): `to` lands it or moves it, `lift` takes it off. */
type Finger = { to(p: Vec2): Promise<void>; lift(): Promise<void> };

function finger(t: TestMatch<AirHockeyState>, deviceId: DeviceId): Finger {
  let at: Vec2 | undefined;
  return {
    async to(p: Vec2): Promise<void> {
      await t.input(deviceId, at ? 'move' : 'down', p);
      at = p;
    },
    async lift(): Promise<void> {
      if (at) await t.input(deviceId, 'up', at);
      at = undefined;
    },
  };
}

/** One step; the Host's own view's state after it. */
async function step(t: TestMatch<AirHockeyState>): Promise<AirHockeyState> {
  await t.tick(STEP_MS);
  return t.state('d0')!;
}

/** Steps for at most `ms` until `done` or the end of the Match; the Host view's state after each. */
async function run(t: TestMatch<AirHockeyState>, ms: number, done: (s: AirHockeyState) => boolean = () => false): Promise<AirHockeyState[]> {
  const states: AirHockeyState[] = [];
  for (let k = 0; k < ms / STEP_MS && !t.result(); k++) {
    states.push(await step(t));
    if (done(states.at(-1)!)) break;
  }
  return states;
}

/** `f` lands at `a` and slides to `b` in `moves` equal moves, one per step, then leaves its paddle in `park`; the states after each step. */
async function slide(t: TestMatch<AirHockeyState>, f: Finger, a: Vec2, b: Vec2, moves: number, park?: Vec2): Promise<AirHockeyState[]> {
  await f.lift();
  await f.to(a);
  const states = [await step(t)];
  for (let k = 1; k <= moves; k++) {
    await f.to({ x: a.x + ((b.x - a.x) * k) / moves, y: a.y + ((b.y - a.y) * k) / moves });
    states.push(await step(t));
  }
  if (park) {
    await f.to(park);
    states.push(await step(t));
  }
  return states;
}

/** Ann's straight shot down the middle at 180 mm/s, from her side of the resting puck; then her paddle goes to her corner. */
const annShoots = (t: TestMatch<AirHockeyState>, ann: Finger) => slide(t, ann, { x: 27, y: 75 }, { x: 63, y: 75 }, 12, ANN_CORNER);

const speed = (s: AirHockeyState): number => Math.hypot(s.puck.vx, s.puck.vy);
const near = (s: AirHockeyState, side: 0 | 1): boolean => Math.hypot(s.puck.x - s.pads[side].x, s.puck.y - s.pads[side].y) <= REACH + 1e-6;

describe('Air Hockey', () => {
  it('declares 1–2 Tiles, no Controllers, 2 Players, bots, the row and column templates, 60 Hz, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, templates, bots, tickHz } = airHockey.manifest;
    expect({ tiles, controllers, players, templates, bots, tickHz }).toEqual({
      tiles: { min: 1, max: 2 },
      controllers: { min: 0, max: 0 },
      players: { min: 2, max: 2 },
      templates: ['row', 'column'],
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

  describe.each(FAR)('$name', ({ rot, local, toWorld }) => {
    const TWO = rowMatch(rot);

    it('puts the paddle where the finger is on that phone’s screen, held to its Player’s half; the puck waits for both to touch', async () => {
      const rec = recorded();
      const t = await createTestMatch<AirHockeyState>({ game: rec.game, match: TWO });
      // Before anyone touches: the puck rests at the centre, both paddles home, and every Tile asks both Players.
      await t.tick(2000);
      const idle = t.state('d1')!;
      expect(idle).toMatchObject({ puck: MID, hold: [0, 1], wait: AIR_HOCKEY.serveWait, pads: [{ x: 22, y: 75 }, { x: 122, y: 75 }] });

      // Bo's finger 34 mm from his screen's left edge and 110 mm down it (rot π), or 36 and 40 (rot 0): the same world point.
      const bo = finger(t, 'd1');
      const at = { x: 110, y: 40 };
      expect(local(at)).toEqual(rot === 0 ? { x: 36, y: 40 } : { x: 34, y: 110 });
      await bo.to(at);
      await t.tick(STEP_MS * 2);
      for (const id of ['d0', 'd1']) {
        expect(t.state(id)!.pads[1].x, id).toBeCloseTo(at.x, 9);
        expect(t.state(id)!.pads[1].y, id).toBeCloseTo(at.y, 9);
        expect(t.state(id)!.hold, id).toEqual([0]);
      }
      // On Bo's screen his paddle is drawn right under his finger: at that screen point, in px.
      const pad = rec.frame('d1').find((c) => c.op === 'arc' && c.args[2] === AIR_HOCKEY.paddle && Math.abs((c.args[0] as number) - at.x) < 1e-6);
      expect(pad).toBeDefined();
      const px = apply(pad!.m, { x: pad!.args[0] as number, y: pad!.args[1] as number });
      expect(px.x).toBeCloseTo(local(at).x * PX, 6);
      expect(px.y).toBeCloseTo(local(at).y * PX, 6);

      // Into Ann's half and off the table: held to his own half.
      await bo.to({ x: 20, y: -5 });
      const ann = finger(t, 'd0');
      await ann.to({ x: 100, y: 160 });
      const s = await step(t);
      expect(s.pads[1].x).toBeCloseTo(81, 9);
      expect(s.pads[1].y).toBeCloseTo(9, 9);
      expect(s.pads[0].x).toBeCloseTo(63, 9);
      expect(s.pads[0].y).toBeCloseTo(141, 9);
      // Both have touched: play runs, and the rest before the serve counts down.
      expect(s.hold).toEqual([]);
      expect(s.wait).toBeCloseTo(AIR_HOCKEY.serveWait - 1 / 60, 9);
      await t.stop();
    });

    it('draws each score in front of its Player’s goal, upright for that Player, whichever way the phone lies', async () => {
      const rec = recorded();
      const t = await createTestMatch<AirHockeyState>({ game: rec.game, match: TWO });
      await t.tick(STEP_MS * 3);
      const scores = (id: DeviceId) => rec.frame(id).filter((c) => c.op === 'fillText' && /^\d+$/.test(c.args[0] as string));
      // Side 0 (Ann's) first, then side 1 (Bo's); each drawn at its origin after a translate and a rotate.
      const [annOnHers, boOnHers] = [scores('d0')[0]!, scores('d1')[1]!];
      expect(scores('d1')).toHaveLength(2);

      // Each score sits 45 mm in from its Player's end, mid-table. Ann reads the table looking east: on her phone
      // (rot 0) her score points to the screen's right.
      expect(apply(annOnHers.m, { x: 0, y: 0 })).toEqual({ x: 45 * PX, y: 75 * PX });
      expect(upOf(annOnHers.m).x).toBeCloseTo(1, 9);
      expect(upOf(annOnHers.m).y).toBeCloseTo(0, 9);

      // Bo looks west: his score (world 99, 75) points west on the table.
      const origin = apply(boOnHers.m, { x: 0, y: 0 });
      expect(origin.x).toBeCloseTo(local({ x: 99, y: 75 }).x * PX, 6);
      expect(origin.y).toBeCloseTo(local({ x: 99, y: 75 }).y * PX, 6);
      const up = upOf(boOnHers.m);
      // On his own screen that is left at rot 0 and right at rot π: the SDK's transform turned it.
      expect(up.x).toBeCloseTo(rot === 0 ? -1 : 1, 9);
      expect(up.y).toBeCloseTo(0, 9);
      expect(toWorld(up).x).toBeCloseTo(-1, 9);
      expect(toWorld(up).y).toBeCloseTo(0, 9);
      await t.stop();
    });

    it('bounces the puck off the walls, ends included outside the goal mouths, keeping `restitution` of its speed into them', async () => {
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
      await finger(t, 'd1').to(BO_CORNER);
      // Ann strikes 7 mm below the resting puck's centre: it leaves up and to the east at about 30°.
      const strike = await slide(t, finger(t, 'd0'), { x: 27, y: 82 }, { x: 63, y: 82 }, 12, ANN_CORNER);
      const hit = strike.findIndex((s) => s.wait === 0);
      expect(hit).toBeGreaterThan(0);
      expect(strike[hit]!.puck.vx).toBeGreaterThan(0);
      expect(strike[hit]!.puck.vy).toBeLessThan(0);

      const states = [...strike.slice(hit), ...(await run(t, 2500))];
      const walls: string[] = [];
      states.slice(1).forEach((s, i) => {
        const prev = states[i]!;
        // Never off the table but into a mouth.
        expect(s.puck.y).toBeGreaterThanOrEqual(R - 1e-9);
        expect(s.puck.y).toBeLessThanOrEqual(HI.y + 1e-9);
        if (Math.abs(s.puck.y - MID.y) >= AIR_HOCKEY.goal / 2) {
          expect(s.puck.x).toBeGreaterThanOrEqual(R - 1e-9);
          expect(s.puck.x).toBeLessThanOrEqual(HI.x + 1e-9);
        }
        // A goal, a serve or a paddle: not a wall.
        if (s.wait > 0 || prev.wait > 0 || s.score.join() !== prev.score.join() || near(s, 0) || near(s, 1)) return;
        for (const [d, other] of [
          ['x', 'y'],
          ['y', 'x'],
        ] as const) {
          const v = d === 'x' ? 'vx' : 'vy';
          const w = other === 'x' ? 'vx' : 'vy';
          if (Math.sign(s.puck[v]) === Math.sign(prev.puck[v])) continue;
          // Reversed within one step of a wall, keeping `restitution` of the speed into it and all of the rest (friction aside).
          const wall = s.puck[v] > 0 ? R : HI[d];
          expect(Math.abs(s.puck[d] - wall)).toBeLessThanOrEqual(Math.abs(prev.puck[v]) / 60 + 1e-9);
          expect(s.puck[v]).toBeCloseTo(-E * GLIDE * prev.puck[v], 9);
          expect(s.puck[w]).toBeCloseTo(GLIDE * prev.puck[w], 9);
          if (d === 'x') expect(Math.abs(s.puck.y - MID.y)).toBeGreaterThanOrEqual(AIR_HOCKEY.goal / 2 - Math.abs(prev.puck.vy) / 60);
          walls.push(d === 'x' ? 'end' : 'side');
        }
      });
      expect(walls).toContain('end');
      expect(walls).toContain('side');
      await t.stop();
    });

    it('scores a puck that goes into a goal for the other Player, and serves from the centre toward the one who conceded', async () => {
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
      const [ann, bo] = [finger(t, 'd0'), finger(t, 'd1')];
      await bo.to(BO_CORNER);
      const into = [...(await annShoots(t, ann)), ...(await run(t, 2000, (s) => s.score.join(':') !== '0:0'))];
      const [before, after] = into.slice(-2) as [AirHockeyState, AirHockeyState];
      expect(after.score).toEqual([1, 0]);
      expect(before.puck.x).toBeGreaterThan(HI.x); // into Bo's mouth
      expect(Math.abs(before.puck.y - MID.y)).toBeLessThan(AIR_HOCKEY.goal / 2);
      expect(after.puck).toMatchObject(MID);
      expect(after.wait).toBe(AIR_HOCKEY.serveWait);
      expect(after.puck.vx).toBeGreaterThan(0); // toward Bo, who conceded
      expect(speed(after)).toBeCloseTo(AIR_HOCKEY.serve, 9);
      expect(Math.abs(Math.atan2(after.puck.vy, after.puck.vx))).toBeLessThanOrEqual(AIR_HOCKEY.maxServeAngle);
      expect(t.state('d1')!.score).toEqual([1, 0]);

      // Bo strikes the resting puck straight back at Ann, whose paddle sits in her corner.
      const back = [...(await slide(t, bo, { x: 117, y: 75 }, { x: 81, y: 75 }, 12, BO_CORNER)), ...(await run(t, 2000, (s) => s.score.join(':') !== '1:0'))];
      expect(back.at(-1)!.score).toEqual([1, 1]);
      expect(back.at(-1)!.puck.vx).toBeLessThan(0); // toward Ann
      expect(t.result()).toBeUndefined();
      await t.stop();
    });

    it('serves again a puck slower than `stall` for `stallFor`, toward the Player whose half it stopped in', async () => {
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
      const ann = finger(t, 'd0');
      await finger(t, 'd1').to(BO_CORNER);
      // Ann nudges the resting puck at 9 mm/s.
      let s: AirHockeyState | undefined;
      for (let x = 57; !s || s.wait > 0; x += 0.15) {
        await ann.to({ x, y: 75 });
        s = await step(t);
      }
      await ann.lift();
      expect(s.puck.vx).toBeCloseTo((1 + E) * 9, 6);
      const crawl = [s, ...(await run(t, 5000, (n) => n.wait > 0))];
      const served = crawl.at(-1)!;
      const slow = crawl.slice(0, -1);
      expect(slow.length).toBeGreaterThanOrEqual(AIR_HOCKEY.stallFor * 60);
      expect(slow.length).toBeLessThanOrEqual(AIR_HOCKEY.stallFor * 60 + 1);
      for (const n of slow) {
        expect(speed(n)).toBeLessThan(AIR_HOCKEY.stall);
        expect(n.score).toEqual([0, 0]);
      }
      expect(slow.at(-1)!.puck.x).toBeGreaterThan(MID.x); // it stopped in Bo's half
      expect(served.puck).toMatchObject(MID);
      expect(served.wait).toBe(AIR_HOCKEY.serveWait);
      expect(served.puck.vx).toBeGreaterThan(0); // toward Bo
      expect(served.score).toEqual([0, 0]);
      await t.stop();
    });

    it('carries a striking paddle’s velocity into the puck, and bounces it off a moving paddle relative to it', async () => {
      // At rest, struck dead centre: the puck leaves at (1 + restitution) × the paddle's speed, up to `maxSpeed`. The
      // paddle comes within 16 mm of the puck's centre on its fifth move and meets it on its sixth.
      for (const [per, expected] of [
        [1.5, (1 + E) * 90],
        [3, (1 + E) * 180],
        [9, AIR_HOCKEY.maxSpeed],
      ] as const) {
        const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
        await finger(t, 'd1').to(BO_CORNER);
        const states = await slide(t, finger(t, 'd0'), { x: 56 - per * 5, y: 75 }, { x: 56 + per * 3, y: 75 }, 8);
        const hit = states.find((n) => n.wait === 0)!;
        expect(hit.puck.vx, `${per} mm/step`).toBeCloseTo(expected, 6);
        expect(hit.puck.vy).toBeCloseTo(0, 9);
        expect(hit.puck.x - hit.pads[0].x).toBeCloseTo(REACH, 9); // against the paddle, not inside it
        await t.stop();
      }

      // Ann sends it east at (1 + restitution) × 90 mm/s while Bo's paddle comes west at 60 mm/s to meet it.
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
      const [ann, bo] = [finger(t, 'd0'), finger(t, 'd1')];
      await ann.to({ x: 48, y: 75 });
      await bo.to({ x: 135, y: 75 });
      const states = [await step(t)];
      for (let k = 1; k <= 50; k++) {
        await ann.to({ x: 48 + 1.5 * k, y: 75 });
        await bo.to({ x: 135 - k, y: 75 });
        states.push(await step(t));
      }
      const met = states.findIndex((n, i) => i > 0 && states[i - 1]!.puck.vx > 0 && n.puck.vx < 0);
      expect(met).toBeGreaterThan(0);
      const [prev, n] = [states[met - 1]!, states[met]!];
      expect(near(n, 1)).toBe(true);
      // Off a wall moving at -60 mm/s: v' = v_paddle − restitution × (v − v_paddle).
      expect(n.puck.vx).toBeCloseTo((1 + E) * -60 - E * GLIDE * prev.puck.vx, 6);
      expect(n.puck.vy).toBeCloseTo(0, 9);
      await t.stop();
    });

    it('lets a bot play the side left to it: it waits home, meets a straight shot on its line, never faster than `bot.speed`', async () => {
      const match = rowMatch(rot, [ANN, bot(1)]);
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match });
      // Only the human holds play; a finger on the bot's Tile is nobody's.
      await t.tick(500);
      expect(t.state('d0')!.hold).toEqual([0]);
      await finger(t, 'd1').to(BO_CORNER);
      await t.tick(500);
      expect(t.state('d0')).toMatchObject({ hold: [0], pads: [{ x: 22, y: 75 }, { x: 122, y: 75 }] });

      const states = [...(await annShoots(t, finger(t, 'd0'))), ...(await run(t, 3000, (s) => s.puck.vx < 0 || s.score.join(':') !== '0:0'))];
      const back = states.at(-1)!;
      expect(back.score).toEqual([0, 0]);
      expect(back.puck.vx).toBeLessThan(0); // returned toward Ann
      expect(near(back, 1)).toBe(true);
      expect(Math.abs(back.pads[1].x - 122)).toBeLessThan(1e-6); // on its line
      states.slice(1).forEach((s, i) => {
        const prev = states[i]!;
        expect(Math.hypot(s.pads[1].x - prev.pads[1].x, s.pads[1].y - prev.pads[1].y)).toBeLessThanOrEqual(AIR_HOCKEY.bot.speed / 60 + 1e-9);
      });
      await t.stop();
    });

    it('ends the Match at the seventh goal with the scorer first in the ranking', async () => {
      const t = await createTestMatch<AirHockeyState>({ game: airHockey, match: TWO });
      const ann = finger(t, 'd0');
      await finger(t, 'd1').to(BO_CORNER);
      const states: AirHockeyState[] = [];
      while (!t.result() && states.length < 2000) {
        const goals = t.state('d0')?.score[0] ?? 0;
        states.push(...(await annShoots(t, ann)), ...(await run(t, 2000, (s) => s.score[0] !== goals)));
      }
      expect(t.result()).toEqual({ scores: { 'p-ann': 7, 'p-bo': 0 }, ranking: ['p-ann', 'p-bo'] });
      expect([...new Set(states.map((s) => s.score.join(':')))]).toEqual(['0:0', '1:0', '2:0', '3:0', '4:0', '5:0', '6:0', '7:0']);
      for (const id of ['d0', 'd1']) {
        expect(t.state(id)!.score, id).toEqual([7, 0]);
        expect(t.events(id).map((e) => e.t), id).toEqual(['started', 'ended', 'closed']);
      }
    });
  });

  it('runs along a column too: Ann at the top on a phone turned to face her, Bo at the bottom', async () => {
    // Ann's phone (first) lies upside down so its bottom edge faces her; Bo's upright. The table: 70 × 304 mm, along y.
    const match = matchOf([placed('d0', { x: 35, y: 75 }, 70, 150, Math.PI), placed('d1', { x: 35, y: 229 }, 70, 150, 0)], { x: 0, y: 0, w: 70, h: 304 }, [ANN, BO]);
    const rec = recorded();
    const t = await createTestMatch<AirHockeyState>({ game: rec.game, match });
    const [ann, bo] = [finger(t, 'd0'), finger(t, 'd1')];
    await ann.to({ x: 35, y: 250 });
    await bo.to({ x: 35, y: 20 });
    const s = await step(t);
    expect(s.pads[0].x).toBeCloseTo(35, 9);
    expect(s.pads[0].y).toBeCloseTo(143, 9); // held above the centre line (152)
    expect(s.pads[1].x).toBeCloseTo(35, 9);
    expect(s.pads[1].y).toBeCloseTo(161, 9);
    await t.tick(STEP_MS * 2);

    // Ann's score, 45 mm below her end, reads upright on her own (turned) phone: the SDK turned the whole drawing.
    const [annScore] = rec.frame('d0').filter((c) => c.op === 'fillText' && /^\d+$/.test(c.args[0] as string));
    const origin = apply(annScore!.m, { x: 0, y: 0 });
    expect(origin.x).toBeCloseTo((70 - 35) * PX, 6);
    expect(origin.y).toBeCloseTo((150 - 45) * PX, 6);
    expect(upOf(annScore!.m).x).toBeCloseTo(0, 9);
    expect(upOf(annScore!.m).y).toBeCloseTo(-1, 9);

    // A straight shot down the table scores in Bo's goal, at the bottom, and the serve goes his way.
    await bo.to({ x: 61, y: 295 });
    const shot = [...(await slide(t, ann, { x: 35, y: 110 }, { x: 35, y: 146 }, 12, { x: 9, y: 9 })), ...(await run(t, 2000, (n) => n.score.join(':') !== '0:0'))];
    const after = shot.at(-1)!;
    expect(after.score).toEqual([1, 0]);
    expect(after.puck.vy).toBeGreaterThan(0);
    await t.stop();
  });

  it('plays one Tile against a bot, the human defending the end at the bottom of their screen', async () => {
    const match = matchOf([placed('d0', { x: 35, y: 75 }, 70, 150, 0)], { x: 0, y: 0, w: 70, h: 150 }, [ANN, bot(1)]);
    const t = await createTestMatch<AirHockeyState>({ game: airHockey, match });
    await t.input('d0', 'down', { x: 35, y: 10 });
    const s = await step(t);
    expect(s.pads).toEqual([
      { x: 35, y: 84 }, // held below the centre line (75)
      { x: 35, y: 22 }, // the bot, home before its goal at the top
    ]);
    expect(s.hold).toEqual([]);
    await t.stop();
  });
});
