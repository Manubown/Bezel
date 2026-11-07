import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, MatchInfo, Tile } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import pong, { PONG, type PongState } from '../src';

/** Phones in a row, 70 × 150 mm, with a 4 mm bezel gap between neighbours. */
function rowMatch(n: number): MatchInfo {
  const tiles: Tile[] = Array.from({ length: n }, (_, i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
  return {
    matchId: 'match-1',
    seed: 1,
    tickHz: 60,
    players: [
      { playerId: 'p-ann', name: 'Ann' },
      { playerId: 'p-bo', name: 'Bo' },
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

/** Where a side's paddle should go, given the state it sees. */
type Bot = (s: PongState) => number;

/**
 * The two outer Players on the two-Tile table moving their fingers as `bots`
 * say before every step, for at most `ms`, until `done`, or until the Match
 * ends. Returns the state the Host's own view held after each step.
 */
async function play(t: TestMatch<PongState>, bots: [Bot, Bot], ms: number, done: (s: PongState) => boolean = () => false): Promise<PongState[]> {
  const fingers = [finger(t, TWO, 'd0'), finger(t, TWO, 'd1')];
  const states: PongState[] = [];
  for (let k = 0; k < ms / STEP_MS && !t.result(); k++) {
    const s = t.state('d0');
    if (s) for (const side of [0, 1] as const) await fingers[side]!(bots[side](s));
    await t.tick(STEP_MS);
    states.push(t.state('d0')!);
    if (done(states.at(-1)!)) break;
  }
  return states;
}

/** A Player who hits the ball `off` mm from the paddle's centre (positive: below it). */
const tracks =
  (off = 0): Bot =>
  (s) =>
    s.ball.y - off;
/** A Player who always moves the paddle to the far side from the ball. */
const dodges: Bot = (s) => (s.ball.y < MID.y ? B.y + B.h : B.y);

describe('Pong', () => {
  it('declares 2–4 Tiles, no Controllers, 2 Players, the row template, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, templates } = pong.manifest;
    expect({ tiles, controllers, players, templates }).toEqual({ tiles: { min: 2, max: 4 }, controllers: { min: 0, max: 0 }, players: { min: 2, max: 2 }, templates: ['row'] });

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
});
