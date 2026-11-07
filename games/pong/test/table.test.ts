import { describe, expect, it } from 'vitest';
import type { MatchInfo, Tile } from '@mgc/sdk';
import { createTestMatch } from '@mgc/sdk/test';
import pong, { PONG, type PongState } from '../src';

const STEP_MS = 1000 / 60;

/** A row as the layout builds it: Tiles vertically centred on the tallest, 4 mm gaps, bounds the union. */
function rowOf(sizes: { w: number; h: number }[]): MatchInfo {
  const maxH = Math.max(...sizes.map((s) => s.h));
  let x = 0;
  const tiles: Tile[] = sizes.map((s, i) => {
    const tile = { deviceId: `d${i}`, x, y: (maxH - s.h) / 2, w: s.w, h: s.h, rot: 0 };
    x += s.w + 4;
    return tile;
  });
  return {
    matchId: 'match-1',
    seed: 1,
    tickHz: 60,
    players: [
      { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
      { playerId: 'p-bo', name: 'Bo', deviceId: `d${sizes.length - 1}` },
    ],
    devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    tiles,
    bounds: { x: 0, y: 0, w: x - 4, h: maxH },
  };
}

describe('Pong table', () => {
  it('keeps the ball and the paddles on every Tile of a row with a taller Tile in the middle', async () => {
    // Two phones around a PC window twice their height.
    const match = rowOf([
      { w: 70, h: 150 },
      { w: 340, h: 300 },
      { w: 70, h: 150 },
    ]);
    const phone = match.tiles[0]!;
    const t = await createTestMatch<PongState>({ game: pong, match });
    const pads = [match.tiles[0]!, match.tiles[2]!];
    let down = false;
    let maxOut = 0;
    let padOut = 0;
    // Both humans hit off their paddle's edge, so the returns steepen and the rally bounces off the top and bottom.
    for (let k = 0; k < 20000 / STEP_MS && !t.result(); k++) {
      const s = t.state('d0');
      if (s) {
        for (const side of [0, 1] as const) {
          const tile = pads[side]!;
          await t.input(tile.deviceId, down ? 'move' : 'down', { x: tile.x + tile.w / 2, y: s.ball.y + (side === 0 ? -13 : 13) });
        }
        down = true;
      }
      await t.tick(STEP_MS);
      const after = t.state('d0')!;
      const out = Math.max(phone.y + PONG.ball - after.ball.y, after.ball.y - (phone.y + phone.h - PONG.ball));
      maxOut = Math.max(maxOut, out);
      for (const pad of after.pads) padOut = Math.max(padOut, phone.y + PONG.paddle.h / 2 - pad, pad - (phone.y + phone.h - PONG.paddle.h / 2));
    }
    // The ball's edge never leaves the phones' band of the table, nor does a paddle.
    expect(maxOut).toBeLessThanOrEqual(0);
    expect(padOut).toBeLessThanOrEqual(0);
  });
});
