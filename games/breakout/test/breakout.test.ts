import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { MatchInfo, Tile } from '@mgc/sdk';
import { createTestMatch } from '@mgc/sdk/test';
import game, { BREAKOUT, type BreakoutState } from '../src';

/** Two phones in a row, 70 × 150 mm each with a 4 mm gap; Ann sits at the first, Bo at the second. */
const tiles: Tile[] = [0, 1].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 0,
  players: [
    { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'd1' },
  ],
  devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles,
  bounds: { x: 0, y: 0, w: 144, h: 150 },
};

describe('Breakout', () => {
  it('imports nothing but the SDK', () => {
    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
  });

  it('counts each tap for the Player seated at that Tile and ends when one reaches the goal', async () => {
    const t = await createTestMatch<BreakoutState>({ game, match: MATCH });
    expect(t.state('d1')).toEqual({ taps: { 'p-ann': 0, 'p-bo': 0 } });

    await t.input('d0', 'down', { x: 10, y: 20 });
    await t.input('d0', 'up', { x: 10, y: 20 });
    expect(t.state('d1')).toEqual({ taps: { 'p-ann': 1, 'p-bo': 0 }, last: { x: 10, y: 20, playerId: 'p-ann' } });

    for (let k = 0; k < BREAKOUT.tapsToWin; k++) {
      await t.input('d1', 'down', { x: 100, y: 50 }, k);
      await t.input('d1', 'up', { x: 100, y: 50 }, k);
    }
    expect(t.result()).toEqual({ scores: { 'p-ann': 1, 'p-bo': BREAKOUT.tapsToWin }, ranking: ['p-bo', 'p-ann'] });
    await t.stop();
  });
});
