import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, MatchInfo, Tile } from '@mgc/sdk';
import { createTestMatch } from '@mgc/sdk/test';
import pass, { PASS, type PassState } from '../src';

/** Two Tiles in a row and a Controller in hand; Ann and Bo play. */
const tiles: Tile[] = [0, 1].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 0,
  players: [
    { playerId: 'p-ann', name: 'Ann' },
    { playerId: 'p-bo', name: 'Bo' },
  ],
  devices: [
    ...tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile' as const, name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    { deviceId: 'c', role: 'controller', name: 'c', screenMm: { x: 65, y: 140 } },
  ],
  tiles,
  bounds: { x: 0, y: 0, w: 144, h: 150 },
};
const DEVICES: DeviceId[] = ['d0', 'd1', 'c'];

describe('Pass', () => {
  it('declares one Controller, 1–4 Tiles and Players, no tick, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, tickHz } = pass.manifest;
    expect({ tiles, controllers, players, tickHz }).toEqual({ tiles: { min: 1, max: 4 }, controllers: { min: 1, max: 1 }, players: { min: 1, max: 4 }, tickHz: 0 });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
  });

  it('hands the Controller to each Player in turn, counts each tap for its Holder, freezes the turn while paused, and ends with the most taps first', async () => {
    const t = await createTestMatch<PassState>({ game: pass, match: MATCH });
    const tap = () => t.input('c', 'down', { x: 30, y: 70 });
    const hostLog = () => t.events('d0').flatMap((e) => (e.t === 'log' ? [e.args.join(' ')] : []));

    // The host hands the Controller to the first Player at once.
    expect(t.state('d1')).toEqual({ holder: 'p-ann', turnEndsAt: PASS.turnMs, taps: { 'p-ann': 0, 'p-bo': 0 }, turn: 0 });
    for (const id of DEVICES) expect(t.events(id), id).toContainEqual({ t: 'holders', holders: [{ deviceId: 'c', playerId: 'p-ann' }] });
    await tap();
    expect(t.state('d1')!.taps).toEqual({ 'p-ann': 1, 'p-bo': 0 });
    expect(hostLog()).toEqual(['Ann holds the Controller', 'Ann tapped (1)']);

    // Bo's turn after the turn's time.
    await t.tick(PASS.turnMs - 1);
    expect(t.state('d0')!.holder).toBe('p-ann');
    await t.tick(1);
    expect(t.state('d0')).toEqual({ holder: 'p-bo', turnEndsAt: 2 * PASS.turnMs, taps: { 'p-ann': 1, 'p-bo': 0 }, turn: 1 });
    await tap();
    await tap();
    expect(t.state('c')!.taps).toEqual({ 'p-ann': 1, 'p-bo': 2 });

    // Paused one second into Bo's turn for ten: the turn waits, a tap meanwhile counts for nobody,
    // and on the resume the turn's end moves on by the paused time.
    await t.tick(1000);
    await t.setPaused({ kind: 'platform' });
    await tap();
    await t.tick(10_000);
    expect(t.state('d0')).toMatchObject({ holder: 'p-bo', taps: { 'p-ann': 1, 'p-bo': 2 } });
    await t.setPaused(null);
    expect(t.state('d0')!.turnEndsAt).toBe(2 * PASS.turnMs + 10_000);
    await t.tick(PASS.turnMs - 1000 - 1);
    expect(t.state('d0')!.holder).toBe('p-bo');
    await t.tick(1);
    expect(t.state('d0')).toMatchObject({ holder: 'p-ann', turn: 2 });

    await tap(); // Ann, turn 2
    await t.tick(PASS.turnMs);
    await tap(); // Bo, turn 3
    // Turns 4 and 5, then the end; a frame of slack, as each turn's timer starts when the last one was handled.
    await t.tick(3 * PASS.turnMs + 20);
    expect(t.result()).toEqual({ scores: { 'p-ann': 2, 'p-bo': 3 }, ranking: ['p-bo', 'p-ann'] });
    expect(t.state('d0')!.holder).toBeNull();
    expect(hostLog().filter((l) => l.includes('tapped'))).toEqual(['Ann tapped (1)', 'Bo tapped (1)', 'Bo tapped (2)', 'Ann tapped (2)', 'Bo tapped (3)']);
    for (const id of DEVICES) {
      expect(t.events(id).filter((e) => e.t === 'fault'), id).toEqual([]);
      expect(t.events(id).at(-1), id).toEqual({ t: 'closed', reason: 'ended', detail: 'the game ended the Match' });
    }
  });
});
