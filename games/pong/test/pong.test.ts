import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, Game, MatchInfo, Player, Tile } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import pong, { PONG, type PongState } from '../src';

/** Phones in a row, 70 × 150 mm, with a 4 mm bezel gap between neighbours; Ann seated at the first, Bo at the last. */
function rowMatch(n: number): MatchInfo {
  const tiles: Tile[] = Array.from({ length: n }, (_, i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
  return {
    matchId: 'match-1',
    seed: 1,
    tickHz: 60,
    players: [
      { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
      { playerId: 'p-bo', name: 'Bo', deviceId: `d${n - 1}` },
    ],
    devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    tiles,
    bounds: { x: 0, y: 0, w: n * 74 - 4, h: 150 },
  };
}

const TWO = rowMatch(2);
const B = TWO.bounds;
const MID = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
const R = PONG.ball;
/** Where the ball's centre is when it touches the west / east paddle's face. */
const CONTACT = [B.x + PONG.paddle.inset + PONG.paddle.w + R, B.x + B.w - PONG.paddle.inset - PONG.paddle.w - R] as const;
const STEP_MS = 1000 / 60;

/** One finger on a Tile's screen, put down on first use. */
function finger(t: TestMatch<PongState>, match: MatchInfo, deviceId: DeviceId) {
  const tile = match.tiles.find((x) => x.deviceId === deviceId)!;
  let down = false;
  return async (y: number): Promise<void> => {
    await t.input(deviceId, down ? 'move' : 'down', { x: tile.x + tile.w / 2, y });
    down = true;
  };
}

/** Where a human's finger puts a side's paddle, given the state it sees. */
type Hand = (s: PongState) => number;

/**
 * The fingers on `match`'s two outer Tiles moving as `hands` say before every
 * step (none for a side without a hand), for at most `ms`, until `done`, or
 * until the Match ends. Returns the state the Host's own view held after each step.
 */
async function play(
  t: TestMatch<PongState>,
  hands: [Hand | undefined, Hand | undefined],
  ms: number,
  done: (s: PongState) => boolean = () => false,
  match: MatchInfo = TWO,
): Promise<PongState[]> {
  const fingers = [match.tiles[0]!, match.tiles[match.tiles.length - 1]!].map((tile) => finger(t, match, tile.deviceId));
  const states: PongState[] = [];
  for (let k = 0; k < ms / STEP_MS && !t.result(); k++) {
    const s = t.state('d0');
    for (const side of [0, 1] as const) {
      const hand = hands[side];
      if (s && hand) await fingers[side]!(hand(s));
    }
    await t.tick(STEP_MS);
    states.push(t.state('d0')!);
    if (done(states.at(-1)!)) break;
  }
  return states;
}

/** A Player who hits the ball `off` mm from the paddle's centre (positive: below it). */
const tracks =
  (off = 0): Hand =>
  (s) =>
    s.ball.y - off;
/** A Player who always moves the paddle to the far side from the ball. */
const dodges: Hand = (s) => (s.ball.y < MID.y ? B.y + B.h : B.y);

/** A bot Player in slot `slot`, as the lobby makes it. */
const bot = (slot: 0 | 1): Player => ({ playerId: `bot:${slot}`, name: 'Bot', bot: true });
/** The paddle's reach: how far from its centre a ball's centre still meets it. */
const REACH = PONG.paddle.h / 2 + R;

/** Ann and Bo track the ball for `ms`, then Bo lifts his finger off his Tile; returns the shared time he lifted it. */
async function boLifts(t: TestMatch<PongState>, ms: number): Promise<number> {
  await play(t, [tracks(), tracks()], ms);
  await t.input('d1', 'up', { x: 109, y: t.state('d0')!.pads[1] });
  return t.now();
}

/**
 * Pong whose host's states reach no view while `link.stalled` is set, as when a lost packet holds up everything
 * behind it on the ordered data channel: the views draw on from the last state they got.
 */
function stalling(): { game: Game; link: { stalled: boolean } } {
  const link = { stalled: false };
  const game: Game = {
    ...pong,
    host: (ctx) =>
      pong.host({
        ...ctx,
        publish(state, to) {
          if (!link.stalled) ctx.publish(state, to);
        },
      }),
  };
  return { game, link };
}

/** Pong whose host publishes `state` at the start and nothing after: every view draws from it however old it grows. */
const only = (state: PongState): Game => ({
  ...pong,
  host(ctx) {
    ctx.publish(state);
    return {};
  },
});

/** A state mid-rally with the ball at `ball`: both paddles centred, no score, no rest, no hold; `more` overrides. */
const rally = (ball: PongState['ball'], more: Partial<PongState> = {}): PongState => ({ ball, pads: [MID.y, MID.y], score: [0, 0], wait: 0, hold: [], started: true, ...more });

/** Where `deviceId`'s view drew the ball's centre in its last frame, world mm. */
function ballDrawn(t: TestMatch<PongState>, deviceId: DeviceId): { x: number; y: number } {
  const arc = t.drawn(deviceId).find((op) => op[0] === 'arc' && op[3] === R);
  if (!arc) throw new Error(`${deviceId} drew no ball`);
  return { x: arc[1] as number, y: arc[2] as number };
}

describe('Pong', () => {
  it('declares 1–4 Tiles, no Controllers, 2 Players, bots, the row template, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, templates, bots } = pong.manifest;
    expect({ tiles, controllers, players, templates, bots }).toEqual({ tiles: { min: 1, max: 4 }, controllers: { min: 0, max: 0 }, players: { min: 2, max: 2 }, templates: ['row'], bots: true });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: object };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@mgc/sdk']);
  });

  it('moves each outer Tile’s paddle to its finger’s height, clamped to the Layout bounds; a middle Tile moves none', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    const west = finger(t, TWO, 'd0');
    const east = finger(t, TWO, 'd1');
    await west(60);
    await east(100);
    await t.tick(STEP_MS);
    expect(t.state('d0')!.pads).toEqual([60, 100]);
    expect(t.state('d1')!.pads).toEqual([60, 100]); // every view draws the same paddles

    await west(-40);
    await east(400);
    await t.tick(STEP_MS);
    const [w, e] = t.state('d1')!.pads;
    expect(w - PONG.paddle.h / 2).toBe(B.y); // flush with the top of the table
    expect(e + PONG.paddle.h / 2).toBe(B.y + B.h); // flush with the bottom

    const three = rowMatch(3);
    const t3 = await createTestMatch<PongState>({ game: pong, match: three });
    await finger(t3, three, 'd1')(20); // the middle phone
    await finger(t3, three, 'd2')(120);
    await t3.tick(STEP_MS);
    expect(t3.state('d1')!.pads).toEqual([three.bounds.y + three.bounds.h / 2, 120]);
  });

  it('gives each side to the Player seated at its outer Tile, whatever the Players’ order, and scores by Player id', async () => {
    // Ann, Player 1, sits at the last Tile; Bo at the first.
    const three = rowMatch(3);
    const swapped: MatchInfo = { ...three, players: [{ ...three.players[0]!, deviceId: 'd2' }, { ...three.players[1]!, deviceId: 'd0' }] };
    const mid = three.bounds.y + three.bounds.h / 2;
    const t = await createTestMatch<PongState>({ game: pong, match: swapped });
    await finger(t, swapped, 'd2')(100);
    await t.tick(STEP_MS);
    expect(t.state('d0')!.pads).toEqual([mid, 100]); // Ann's finger moves the east paddle; the west one ignores it
    await finger(t, swapped, 'd0')(40);
    await finger(t, swapped, 'd1')(120); // the middle phone seats no side
    await t.tick(STEP_MS);
    expect(t.state('d1')!.pads).toEqual([40, 100]);

    // Two Tiles, Ann east: the east side's points are hers.
    const two: MatchInfo = { ...TWO, players: [{ ...TWO.players[0]!, deviceId: 'd1' }, { ...TWO.players[1]!, deviceId: 'd0' }] };
    const t2 = await createTestMatch<PongState>({ game: pong, match: two });
    await play(t2, [dodges, tracks()], 60_000, undefined, two);
    expect(t2.result()).toEqual({ scores: { 'p-ann': 7, 'p-bo': 0 }, ranking: ['p-ann', 'p-bo'] });
  });

  it('bounces the ball off the table’s top and bottom and off paddles', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    // West returns off the paddle's top half (sending it down), east off the bottom half (up).
    const states = await play(t, [tracks(13), tracks(-13)], 20_000);
    expect(t.result()).toBeUndefined();

    const walls: ('top' | 'bottom')[] = [];
    const returns: (0 | 1)[] = [];
    states.slice(1).forEach((s, i) => {
      const prev = states[i]!;
      expect(s.score).toEqual([0, 0]);
      // Always on the table, between its top and bottom.
      expect(s.ball.y).toBeGreaterThanOrEqual(B.y + R - 1e-9);
      expect(s.ball.y).toBeLessThanOrEqual(B.y + B.h - R + 1e-9);
      if (Math.sign(s.ball.vx) !== Math.sign(prev.ball.vx)) {
        // A paddle: reversed at its face, where the paddle was.
        const side = s.ball.vx > 0 ? 0 : 1;
        returns.push(side);
        expect(Math.abs(s.ball.x - CONTACT[side])).toBeLessThan(Math.abs(prev.ball.vx) / 60 + 1e-9);
        expect(Math.abs(s.ball.y - s.pads[side])).toBeLessThanOrEqual(PONG.paddle.h / 2 + R);
      } else if (Math.sign(s.ball.vy) !== Math.sign(prev.ball.vy)) {
        // A wall: same speed, reversed within one step of the top or the bottom.
        const reach = Math.abs(prev.ball.vy) / 60 + 1e-9;
        const wall = s.ball.vy > 0 ? 'top' : 'bottom';
        walls.push(wall);
        expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(Math.hypot(prev.ball.vx, prev.ball.vy), 9);
        if (wall === 'top') expect(s.ball.y - R - B.y).toBeLessThanOrEqual(reach);
        else expect(B.y + B.h - (s.ball.y + R)).toBeLessThanOrEqual(reach);
      }
    });
    expect(returns.filter((s) => s === 0).length).toBeGreaterThanOrEqual(3);
    expect(returns.filter((s) => s === 1).length).toBeGreaterThanOrEqual(3);
    expect(walls).toContain('top');
    expect(walls).toContain('bottom');
  });

  it('scores a miss for the other Player and serves from the centre toward the one who missed', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    const states = await play(t, [tracks(), dodges], 10_000, (s) => s.score[0] + s.score[1] > 0);
    const point = states.findIndex((s) => s.score[0] + s.score[1] > 0);
    expect(point).toBeGreaterThan(0);

    const before = states[point - 1]!;
    const after = states[point]!;
    expect(after.score).toEqual([1, 0]); // east missed: a point for west
    expect(before.ball.vx).toBeGreaterThan(0);
    expect(before.ball.x).toBeGreaterThan(CONTACT[1]); // it got past the east paddle
    expect(after.ball.x).toBe(MID.x);
    expect(after.ball.y).toBe(MID.y);
    expect(after.ball.vx).toBeGreaterThan(0); // toward east, who lost the point
    expect(after.wait).toBeGreaterThan(0); // resting before it moves
    expect(t.result()).toBeUndefined();
  });

  it('ends the Match on the seventh point with the winner first in the ranking', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    const states = await play(t, [dodges, tracks()], 60_000);

    expect(t.result()).toEqual({ scores: { 'p-ann': 0, 'p-bo': 7 }, ranking: ['p-bo', 'p-ann'] });
    // Point by point to seven, never past it.
    const scores = [...new Set(states.map((s) => s.score.join(':')))];
    expect(scores).toEqual(['0:0', '0:1', '0:2', '0:3', '0:4', '0:5', '0:6', '0:7']);
    for (const id of ['d0', 'd1']) {
      expect(t.state(id)!.score, id).toEqual([0, 7]);
      expect(t.events(id).map((e) => e.t), id).toEqual(['started', 'ended', 'closed']);
    }
  });

  it('freezes while paused and resumes mid-rally where the ball stopped: onResume re-publishes it, no serve', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    const west = finger(t, TWO, 'd0');
    await west(40);
    await finger(t, TWO, 'd1')(100); // both Players touch: play may start
    await t.tick(1000); // past the 0.8 s rest: the ball is in flight
    const paused = t.state('d0')!;
    expect(paused.wait).toBe(0);
    expect(paused.score).toEqual([0, 0]);
    expect(paused.ball.x).not.toBe(MID.x);

    await t.setPaused({ kind: 'device-lost', deviceId: 'd1' });
    await west(120); // dropped while paused: the paddle does not jump on resume
    await t.tick(3000);
    for (const id of ['d0', 'd1']) expect(t.state(id), id).toEqual(paused);

    await t.setPaused(null);
    // Re-published at the resume, unchanged: the same ball, stamped with the resume's time.
    for (const id of ['d0', 'd1']) {
      expect(t.latest(id)!.state, id).toEqual(paused);
      expect(t.latest(id)!.t, id).toBeCloseTo(t.now(), 6);
    }

    await t.tick(STEP_MS);
    const next = t.state('d0')!;
    expect(next.ball.x).toBeCloseTo(paused.ball.x + paused.ball.vx / 60, 9);
    expect(next.ball.y).toBeCloseTo(paused.ball.y + paused.ball.vy / 60, 9);
    expect(next.ball.vx).toBe(paused.ball.vx);
    expect(next.wait).toBe(0);
    expect(next.score).toEqual([0, 0]);
    expect(next.pads).toEqual(paused.pads);
  });

  it('lets a bot play the side left to it, after the ball, never faster than `PONG.bot.speed`; its Tile’s finger moves nothing', async () => {
    // Slot 0 is the bot, so it plays west; Bo, at the last Tile, plays east.
    const match: MatchInfo = { ...TWO, players: [bot(0), TWO.players[1]!] };
    const t = await createTestMatch<PongState>({ game: pong, match });
    // A finger on the west Tile dodges the ball; Bo hits off his paddle's top half, so his shots come back at an angle.
    const states = await play(t, [dodges, tracks(10)], 30_000, undefined, match);
    const step = PONG.bot.speed / 60;
    let flatOut = 0;
    const met: number[] = [];
    states.slice(1).forEach((s, i) => {
      const prev = states[i]!;
      const moved = Math.abs(s.pads[0] - prev.pads[0]);
      expect(moved).toBeLessThanOrEqual(step + 1e-9);
      if (moved > step - 1e-9) flatOut++;
      if (prev.ball.vx < 0 && s.ball.vx > 0) met.push(s.ball.y); // the bot returned it
    });
    expect(flatOut).toBeGreaterThan(10); // the cap binds
    expect(met.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...met) - Math.min(...met)).toBeGreaterThan(PONG.paddle.h); // high and low: it goes after the ball
  });

  it('has a bot wait centred for every serve and return it', async () => {
    // Seed 1 serves east first, toward the bot in slot 1; Ann never misses, so every serve comes to the bot.
    const match: MatchInfo = { ...TWO, players: [TWO.players[0]!, bot(1)] };
    const t = await createTestMatch<PongState>({ game: pong, match });
    const states = await play(t, [tracks(-6), undefined], 60_000, undefined, match);
    let serves = 0;
    states.forEach((s, i) => {
      // The step the ball's rest ends: it leaves the centre next.
      if (i === 0 || states[i - 1]!.wait === 0 || s.wait > 0) return;
      serves++;
      expect(s.ball.vx).toBeGreaterThan(0);
      expect(s.pads[1]).toBeCloseTo(MID.y, 9);
      // Next the bot sends it back, before any point.
      const next = states.slice(i + 1).find((n) => n.ball.vx < 0 || n.score.join() !== s.score.join());
      expect(next?.score).toEqual(s.score);
      expect(Math.abs(next!.ball.x - CONTACT[1])).toBeLessThan(PONG.maxSpeed / 60);
    });
    expect(serves).toBeGreaterThanOrEqual(2); // the first, and one after a point the bot lost
  });

  it('can be beaten: a bot that aims off where the ball will cross its face lets it past', async () => {
    const match: MatchInfo = { ...TWO, players: [TWO.players[0]!, bot(1)] };
    const t = await createTestMatch<PongState>({ game: pong, match });
    // Ann hits off her paddle's top half: angled, ever faster shots.
    const states = await play(t, [tracks(12), undefined], 60_000, (s) => s.score[0] > 0, match);
    const point = states.findIndex((s) => s.score[0] > 0);
    expect(point).toBeGreaterThan(0);
    expect(states[point]!.score).toEqual([1, 0]);
    // The bot had returned shots before this one.
    expect(states.slice(1, point).some((s, i) => states[i]!.ball.vx > 0 && s.ball.vx < 0)).toBe(true);

    // The step the ball crossed its face: the paddle had settled where it aimed, off the crossing by
    // more than its reach and no more than its aim error.
    let k = point - 1;
    while (k > 0 && !(states[k]!.ball.x > CONTACT[1] && states[k - 1]!.ball.x <= CONTACT[1])) k--;
    const [before, crossed] = [states[k - 1]!, states[k]!];
    expect(crossed.ball.x).toBeGreaterThan(CONTACT[1]);
    const y = before.ball.y + ((CONTACT[1] - before.ball.x) * before.ball.vy) / before.ball.vx;
    expect(Math.abs(crossed.pads[1] - before.pads[1])).toBeLessThan(1e-6);
    expect(Math.abs(crossed.pads[1] - y)).toBeGreaterThan(REACH);
    expect(Math.abs(crossed.pads[1] - y)).toBeLessThanOrEqual(PONG.bot.aimError + 1e-9);
  });

  it('plays one Tile against a bot: the human west, the bot east, a point at a time to seven', async () => {
    const one: MatchInfo = { ...rowMatch(1), players: [TWO.players[0]!, bot(1)] };
    const { y, h } = one.bounds;
    const t = await createTestMatch<PongState>({ game: pong, match: one });
    // Its one Device is the first and the last Tile: Ann's finger moves the west paddle, and the bot waits centred for the serve.
    await t.input('d0', 'down', { x: 35, y: 40 });
    await t.tick(STEP_MS);
    expect(t.state('d0')!.pads).toEqual([40, y + h / 2]);
    await t.input('d0', 'up', { x: 35, y: 40 });

    const states = await play(t, [tracks(), undefined], 300_000, undefined, one);
    expect(t.result()).toEqual({ scores: { 'p-ann': 7, 'bot:1': 0 }, ranking: ['p-ann', 'bot:1'] });
    // A point at a time to seven, never past it.
    expect([...new Set(states.map((s) => s.score.join(':')))]).toEqual(['0:0', '1:0', '2:0', '3:0', '4:0', '5:0', '6:0', '7:0']);
    expect(t.events('d0').map((e) => e.t)).toEqual(['started', 'ended', 'closed']);
  });

  it('serves first only once every human has touched; until then the state names who has not', async () => {
    const three = rowMatch(3);
    const mid = { x: three.bounds.x + three.bounds.w / 2, y: three.bounds.y + three.bounds.h / 2 };
    const t = await createTestMatch<PongState>({ game: pong, match: three });
    /** The ball at the centre with its whole rest still ahead: not served. */
    const unserved = (s: PongState) => ({ x: s.ball.x, y: s.ball.y, wait: s.wait, started: s.started });
    const before = { ...mid, wait: PONG.serveWait, started: false };

    await t.tick(3000);
    for (const id of ['d0', 'd1', 'd2']) {
      expect(unserved(t.state(id)!), id).toEqual(before);
      expect(t.state(id)!.hold, id).toEqual([0, 1]);
    }
    // The middle phone seats no side: its touch counts for nobody.
    await t.input('d1', 'down', { x: 109, y: 40 });
    await t.input('d1', 'up', { x: 109, y: 40 });
    await t.tick(1000);
    expect(unserved(t.state('d0')!)).toEqual(before);
    expect(t.state('d0')!.hold).toEqual([0, 1]);

    // Ann taps: only Bo is missing; her paddle moved, the ball did not.
    await t.input('d0', 'down', { x: 35, y: 40 });
    await t.input('d0', 'up', { x: 35, y: 40 });
    await t.tick(1000);
    expect(unserved(t.state('d0')!)).toEqual(before);
    expect(t.state('d0')!.hold).toEqual([1]);
    expect(t.state('d0')!.pads).toEqual([40, mid.y]);

    // Bo touches a second after her: the next step plays, the rest runs, and then the ball leaves the centre.
    await t.input('d2', 'down', { x: 183, y: 100 });
    await t.tick(STEP_MS);
    const first = t.state('d2')!;
    expect(first).toMatchObject({ hold: [], started: true, ball: { x: mid.x, y: mid.y } });
    expect(first.wait).toBeCloseTo(PONG.serveWait - 1 / 60, 9);
    await t.tick(PONG.serveWait * 1000);
    const served = t.state('d2')!;
    expect(served.wait).toBe(0);
    expect(served.ball.x).not.toBe(mid.x);
    expect(served.hold).toEqual([]);
  });

  it('holds a human side 5 s after its finger lifts, the ball frozen where it was, and plays on from there at its next touch', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    const lifted = await boLifts(t, 1000);
    // Ann plays on; Bo's paddle stays where he left it.
    const playing = await play(t, [tracks(), undefined], 4900);
    expect(t.now() - lifted).toBeCloseTo(4900, 6);
    expect(playing.every((s) => s.hold.length === 0)).toBe(true);
    const [a, b] = playing.slice(-2) as [PongState, PongState];
    expect(b.ball.x).not.toBe(a.ball.x); // at 4.9 s the ball still moves

    const late = await play(t, [tracks(), undefined], 200);
    expect(t.now() - lifted).toBeCloseTo(5100, 6);
    const held = late.at(-1)!;
    expect(held).toMatchObject({ hold: [1], started: true, wait: 0 });
    expect(t.state('d1')!.hold).toEqual([1]); // every view has it
    // The ball moved up to the step that held, stays where that left it, and a second later still does.
    const from = late.findIndex((s) => s.hold.length > 0);
    expect(from).toBeGreaterThan(1);
    expect(late[from - 1]!.ball).not.toEqual(late[from - 2]!.ball);
    expect(held.ball).toEqual(late[from - 1]!.ball);
    const still = await play(t, [tracks(), undefined], 1000);
    for (const s of [...late.slice(from), ...still]) {
      expect(s.hold).toEqual([1]);
      expect(s.ball).toEqual(held.ball);
      expect(s.score).toEqual(held.score);
    }

    // Bo touches: the next step plays on from where the ball stopped, at its speed; no serve.
    await t.input('d1', 'down', { x: 109, y: held.pads[1] });
    await t.tick(STEP_MS);
    const next = t.state('d0')!;
    expect(next.hold).toEqual([]);
    expect(next.wait).toBe(0);
    expect(next.score).toEqual(held.score);
    expect(next.ball.vx).toBe(held.ball.vx);
    expect(next.ball.vy).toBe(held.ball.vy);
    expect(next.ball.x).toBeCloseTo(held.ball.x + held.ball.vx / 60, 9);
    expect(next.ball.y).toBeCloseTo(held.ball.y + held.ball.vy / 60, 9);
  });

  it('never holds for a bot: with one human and a bot only the human must touch', async () => {
    // Ann west, the bot east. Before her first touch only she is asked for; a finger on the bot's Tile counts for nobody.
    const match: MatchInfo = { ...TWO, players: [TWO.players[0]!, bot(1)] };
    const t = await createTestMatch<PongState>({ game: pong, match });
    await t.tick(1000);
    expect(t.state('d1')).toMatchObject({ hold: [0], started: false, wait: PONG.serveWait });
    await t.input('d1', 'down', { x: 109, y: 40 });
    await t.tick(1000);
    expect(t.state('d1')).toMatchObject({ hold: [0], started: false, wait: PONG.serveWait });

    // Ann alone starts it, and while she plays nothing holds: the bot returns her shots.
    const states = await play(t, [tracks(), undefined], 20_000, undefined, match);
    expect(states.every((s) => s.hold.length === 0 && s.started)).toBe(true);
    expect(states.slice(1).some((s, i) => states[i]!.ball.vx > 0 && s.ball.vx < 0)).toBe(true);

    // She lifts her finger: after 5 s only her side holds, and the bot's paddle settles where it was going.
    await t.input('d0', 'up', { x: 35, y: t.state('d0')!.pads[0] });
    const lapsed = await play(t, [undefined, undefined], 7000, undefined, match);
    expect(new Set(lapsed.map((s) => s.hold.join()))).toEqual(new Set(['', '0']));
    const [x, y] = lapsed.slice(-2) as [PongState, PongState];
    expect(y.hold).toEqual([0]);
    expect(y.pads[1]).toBe(x.pads[1]);

    // The bot west, Bo east; and one Tile, Ann and a bot: only the human is asked for.
    const west = await createTestMatch<PongState>({ game: pong, match: { ...TWO, players: [bot(0), TWO.players[1]!] } });
    await west.tick(1000);
    expect(west.state('d0')).toMatchObject({ hold: [1], started: false });
    const one: MatchInfo = { ...rowMatch(1), players: [TWO.players[0]!, bot(1)] };
    const alone = await createTestMatch<PongState>({ game: pong, match: one });
    await alone.tick(1000);
    expect(alone.state('d0')).toMatchObject({ hold: [0], started: false });
    await alone.input('d0', 'down', { x: 35, y: 40 });
    await alone.tick(STEP_MS);
    expect(alone.state('d0')).toMatchObject({ hold: [], started: true });
  });

  it('lets the paddles follow their fingers while held, and never scores while held', async () => {
    const t = await createTestMatch<PongState>({ game: pong, match: TWO });
    await boLifts(t, 2400);
    await play(t, [tracks(), undefined], 5100);
    const held = t.state('d0')!;
    expect(held).toMatchObject({ hold: [1], wait: 0 });
    // It held with the ball already past Bo's paddle, on its way off the table: a few steps of play from a point.
    expect(held.ball.vx).toBeGreaterThan(0);
    expect(held.ball.x).toBeGreaterThan(CONTACT[1]);

    // For 10 s Ann sweeps her paddle up and down: it follows her finger every step, Bo's stays, and the ball
    // neither moves nor scores.
    for (let k = 0; k < 600; k++) {
      const y = B.y + 20 + ((k * 3) % 110);
      await t.input('d0', 'move', { x: 35, y });
      await t.tick(STEP_MS);
      const s = t.state('d1')!;
      expect(s.pads).toEqual([y, held.pads[1]]);
      expect(s.ball).toEqual(held.ball);
      expect(s.score).toEqual(held.score);
      expect(s.hold).toEqual([1]);
    }

    // Bo touches where his paddle is: play goes on, and the point that was coming is Ann's within a few steps.
    await t.input('d1', 'down', { x: 109, y: held.pads[1] });
    const after = await play(t, [undefined, undefined], 1000, (s) => s.score.join() !== held.score.join());
    expect(after.at(-1)!.score).toEqual([held.score[0] + 1, held.score[1]]);
    expect(after.length).toBeLessThan(10);
    expect(after.every((s) => s.hold.length === 0)).toBe(true);
  });

  it('draws the ball on across the middle Tile through a stall in delivery, at most a second past its last state', async () => {
    const three = rowMatch(3);
    const [first, middle] = three.tiles as [Tile, Tile, Tile];
    const { game, link } = stalling();
    const t = await createTestMatch<PongState>({ game, match: three });
    // Ann and Bo rally until the ball is on Ann's Tile heading east; then no state gets through.
    await play(t, [tracks(), tracks()], 30_000, (s) => s.wait === 0 && s.ball.vx > 0 && s.ball.x > 40 && s.ball.x < first.x + first.w, three);
    link.stalled = true;
    const { state: s, t: at } = t.latest('d1')!;
    expect(s.ball.x).toBeLessThan(first.x + first.w);
    expect(s.ball.vx).toBeGreaterThan(0);
    /** Where the state's velocity takes the ball `ms` after its stamp, clear of the walls and the paddles. */
    const ahead = (ms: number) => ({ x: s.ball.x + (s.ball.vx * ms) / 1000, y: s.ball.y + (s.ball.vy * ms) / 1000 });

    // 300 ms on, still with that state, the middle Tile shows the ball where its velocity has taken it.
    await t.tick(300);
    expect(t.latest('d1')!.t).toBe(at);
    expect(t.now() - at).toBeCloseTo(300, 6);
    const shown = ballDrawn(t, 'd1');
    expect(shown.x).toBeCloseTo(ahead(300).x, 6);
    expect(shown.y).toBeCloseTo(ahead(300).y, 6);
    expect(shown.x).toBeGreaterThan(middle.x);
    expect(shown.x).toBeLessThan(middle.x + middle.w);

    // It moves on until a second past the stamp, and from then on stays put however long the stall lasts.
    await t.tick(700 - STEP_MS);
    const late = ballDrawn(t, 'd1');
    await t.tick(STEP_MS);
    const capped = ballDrawn(t, 'd1');
    expect(Math.abs(capped.x - late.x)).toBeGreaterThan(1);
    for (const ms of [STEP_MS, 500, 2000]) {
      await t.tick(ms);
      expect(ballDrawn(t, 'd1').x).toBeCloseTo(capped.x, 6);
      expect(ballDrawn(t, 'd1').y).toBeCloseTo(capped.y, 6);
    }
    expect(t.latest('d1')!.t).toBe(at);
  });

  it('under a 300 ms old state still draws a held ball where it stopped and a resting one only after its rest', async () => {
    // Held: where the state has it.
    const flying = { x: 60, y: 70, vx: 150, vy: 20 };
    const held = await createTestMatch<PongState>({ game: only(rally(flying, { hold: [1] })), match: TWO });
    await held.tick(300);
    expect(ballDrawn(held, 'd1')).toEqual({ x: flying.x, y: flying.y });

    // Resting: at the centre while its rest lasts, then on for what is left of the 300 ms.
    const serve = { ...MID, vx: 150, vy: 20 };
    const rests = await createTestMatch<PongState>({ game: only(rally(serve, { wait: PONG.serveWait })), match: TWO });
    await rests.tick(300);
    expect(ballDrawn(rests, 'd1')).toEqual(MID);
    const leaves = await createTestMatch<PongState>({ game: only(rally(serve, { wait: 0.1 })), match: TWO });
    await leaves.tick(300);
    expect(ballDrawn(leaves, 'd1').x).toBeCloseTo(MID.x + serve.vx * 0.2, 6);
    expect(ballDrawn(leaves, 'd1').y).toBeCloseTo(MID.y + serve.vy * 0.2, 6);
  });

  it('moves a state from before a pause on from the resume, not from its stamp', async () => {
    const flying = { x: 60, y: 70, vx: 150, vy: 20 };
    const t = await createTestMatch<PongState>({ game: only(rally(flying)), match: TWO });
    await t.setPaused({ kind: 'device-lost', deviceId: 'd1' });
    await t.tick(3000);
    await t.setPaused(null);
    await t.tick(300);
    expect(ballDrawn(t, 'd1').x).toBeCloseTo(flying.x + flying.vx * 0.3, 6);
    expect(ballDrawn(t, 'd1').y).toBeCloseTo(flying.y + flying.vy * 0.3, 6);
  });

  it('returns a ball drawn far past a paddle if the paddle covers it where it reaches the face, and never past the other face', async () => {
    // Heading east at 45°: it reaches Bo's face 203 ms on, 30.5 mm lower; 400 ms on it would be 60 mm lower.
    const steep = { x: 100, y: 75, vx: 150, vy: 150 };
    const crossing = steep.y + (steep.vy * (CONTACT[1] - steep.x)) / steep.vx;
    const ahead = { x: steep.x + steep.vx * 0.4, y: steep.y + steep.vy * 0.4 };
    expect(Math.abs(ahead.y - crossing)).toBeGreaterThan(REACH);
    // Bo's paddle where the ball reaches his face: it comes back off it onto the table.
    const met = await createTestMatch<PongState>({ game: only(rally(steep, { pads: [MID.y, crossing] })), match: TWO });
    await met.tick(400);
    expect(ballDrawn(met, 'd1').x).toBeCloseTo(2 * CONTACT[1] - ahead.x, 6);
    // Bo's paddle where the ball would be by then, clear of where it passes his face: it goes on past him, off the table.
    const missed = await createTestMatch<PongState>({ game: only(rally(steep, { pads: [MID.y, ahead.y] })), match: TWO });
    await missed.tick(400);
    expect(ballDrawn(missed, 'd1').x).toBeCloseTo(ahead.x, 6);

    // One Tile, the fastest ball straight at Bo's paddle: 300 ms on it is back no further than Ann's face, still on the phone.
    const one = rowMatch(1);
    const annFace = one.bounds.x + PONG.paddle.inset + PONG.paddle.w + R;
    const fast = await createTestMatch<PongState>({ game: only(rally({ x: 40, y: MID.y, vx: PONG.maxSpeed, vy: 0 })), match: one });
    await fast.tick(300);
    expect(ballDrawn(fast, 'd0').x).toBeCloseTo(annFace, 6);
  });
});
