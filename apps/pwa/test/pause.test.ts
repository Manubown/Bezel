import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type DeviceId, type DeviceInfo } from '@mgc/core';
import type { MatchInfo, PauseReason, Tile } from '@mgc/sdk';
import { describePause, pauseOnDeviceLoss } from '../src/pause';

const info = (deviceId: DeviceId): DeviceInfo => ({ deviceId, name: `phone ${deviceId}`, width: 390, height: 840, dpr: 3, pxPerMm: 6 });
const tiles: Tile[] = ['d0', 'd1', 'd2'].map((deviceId, i) => ({ deviceId, x: i * 69, y: 0, w: 65, h: 140, rot: 0 }));
/** d0 hosts; d0–d2 are the Match's Tiles. */
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 60,
  players: [
    { playerId: 'p-ann', name: 'Ann' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'd2' },
  ],
  devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: `phone ${tile.deviceId}`, tile, screenMm: { x: 65, y: 140 } })),
  tiles,
  bounds: { x: 0, y: 0, w: 203, h: 140 },
};
const lost = (deviceId: DeviceId): PauseReason => ({ kind: 'device-lost', deviceId });

describe('The Host’s pause policy over a Session on MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pauses on the loss of a Match Device and resumes only once every lost one is back and synced', () => {
    const hub = new MemoryHub(() => 5);
    const host = hostSession(hub.connect('p0'), info('d0'));
    for (const id of ['d1', 'd2', 'd3']) joinSession(hub.connect(`p-${id}`), info(id));
    vi.advanceTimersByTime(3000);
    const calls: (PauseReason | null)[] = [];
    const off = pauseOnDeviceLoss(host, MATCH, { setPaused: (r) => calls.push(r) });

    // A Device outside the Match comes and goes: the Match goes on.
    hub.disconnect('p-d3');
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([]);

    hub.disconnect('p-d1');
    expect(calls).toEqual([lost('d1')]);
    hub.disconnect('p-d2'); // a second loss while paused: still waiting for the first
    expect(calls).toEqual([lost('d1')]);

    // d1 is back under a new connection: present again, but not resumed before its clock is synced.
    joinSession(hub.connect('p-d1-again'), info('d1'));
    vi.advanceTimersByTime(20);
    expect(host.roster().find((e) => e.info.deviceId === 'd1')).toMatchObject({ present: true, sync: { synced: false } });
    expect(calls).toEqual([lost('d1')]);

    // Synced: now the Match waits for d2, and resumes once d2 is back and synced too.
    vi.advanceTimersByTime(3000);
    expect(calls).toEqual([lost('d1'), lost('d2')]);
    joinSession(hub.connect('p-d2-again'), info('d2'));
    vi.advanceTimersByTime(3000);
    expect(calls).toEqual([lost('d1'), lost('d2'), null]);

    // After the Match: nothing more.
    off();
    hub.disconnect('p-d1-again');
    expect(calls).toHaveLength(3);
  });

  it('names a lost Device by the Player who sits at it, with their place in the Player list for their colour, else by its phone number', () => {
    expect(describePause(MATCH, lost('d2'), 'd0')).toEqual({ headline: 'Waiting for Bo', detail: 'Phone 3 lost its connection · the match goes on when it is back', player: 1 });
    expect(describePause(MATCH, lost('d1'), 'd0')).toEqual({ headline: 'Waiting for phone 2', detail: 'It lost its connection · the match goes on when it is back' });
    expect(describePause(MATCH, { kind: 'platform', note: 'Host paused' }, 'd0')).toEqual({ headline: 'Paused', detail: 'Host paused' });
  });

  it('the lost Device itself, back and waiting for the resume, reads that it is back (spec D9)', () => {
    expect(describePause(MATCH, lost('d2'), 'd2')).toEqual({ headline: 'You’re back', detail: 'the match goes on in a moment' });
    // Another phone it waits for is still named on this one.
    expect(describePause(MATCH, lost('d1'), 'd2')).toEqual({ headline: 'Waiting for phone 2', detail: 'It lost its connection · the match goes on when it is back' });
  });
});
