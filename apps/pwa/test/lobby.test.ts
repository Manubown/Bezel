import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type DeviceId, type DeviceInfo } from '@mgc/core';
import type { Manifest } from '@mgc/sdk';
import { openLobby, type Lobby } from '../src/lobby';

const PX_PER_MM = 6;
/** 390 × 840 CSS px at 6 px/mm: a 65 × 140 mm screen. */
const info = (deviceId: DeviceId): DeviceInfo => ({ deviceId, name: `phone ${deviceId}`, width: 390, height: 840, dpr: 3, pxPerMm: PX_PER_MM });
/** Each Device's persisted Player id. */
const seat = (deviceId: DeviceId) => `player-at-${deviceId}`;

const DUEL: Manifest = {
  id: 'test.duel',
  name: 'Duel',
  version: '1.0.0',
  tiles: { min: 2, max: 4 },
  controllers: { min: 0, max: 0 },
  players: { min: 2, max: 2 },
  host: './duel.js',
  view: './duel.js',
};

/** Host `d0` and the given Peers, each with its lobby, over one hub; everyone synced. */
function table(peers: DeviceId[]) {
  const hub = new MemoryHub(() => 5);
  const lobbies = new Map<DeviceId, Lobby>();
  const join = (deviceId: DeviceId, open = joinSession): Lobby => {
    const lobby = openLobby(open(hub.connect(`peer-of-${deviceId}`), info(deviceId)), PX_PER_MM, seat(deviceId));
    lobbies.set(deviceId, lobby);
    return lobby;
  };
  const host = join('d0', hostSession);
  for (const id of peers) join(id);
  vi.advanceTimersByTime(3000);
  return { host, lobby: (id: DeviceId) => lobbies.get(id)!, join };
}

describe('Lobby over a Session on MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refuses, with the reason, to start a Game the present Devices cannot satisfy', () => {
    const { host, lobby, join } = table(['d1']);
    expect(host.layout?.devices.map((d) => d.id)).toEqual(['d0', 'd1']);

    expect(() => host.start({ ...DUEL, tiles: { min: 3, max: 4 } })).toThrow('Duel needs 3–4 Tiles; 2 present');
    expect(() => host.start({ ...DUEL, minTileMm: { w: 70, h: 100 } })).toThrow('Phone 1 is 65 × 140 mm; Duel needs Tiles of at least 70 × 100 mm');
    expect(() => host.start({ ...DUEL, templates: ['column'] })).toThrow('Duel needs the column arrangement, not row');
    // A third phone that has not finished syncing cannot be put in a Match yet.
    join('d2');
    vi.advanceTimersByTime(50);
    expect(() => host.start(DUEL)).toThrow('Phone 3 is still joining');

    vi.advanceTimersByTime(100);
    expect(host.match).toBeUndefined();
    expect(lobby('d1').match).toBeUndefined();
  });

  it('freezes one Match for every Device; setters after start and Devices joining after it change nothing', () => {
    const { host, lobby, join } = table(['d1', 'd2']);
    const peer = lobby('d1');
    // Default Players: whoever sits at the two outer Tiles, in Layout order.
    expect(host.players.map((p) => p.playerId)).toEqual([seat('d0'), seat('d2')]);
    expect(host.seatOf(seat('d2'))).toBe('d2');
    host.setPlayers(host.players.map((p, i) => ({ ...p, name: ['Ann', 'Bo'][i]! })));

    const match = host.start(DUEL);
    expect(host.match).toBe(match);
    expect(match.players).toEqual([
      { playerId: seat('d0'), name: 'Ann' },
      { playerId: seat('d2'), name: 'Bo' },
    ]);
    expect(match.tiles.map((t) => t.deviceId)).toEqual(['d0', 'd1', 'd2']);
    expect(match.devices.map((d) => [d.deviceId, d.role, d.tile?.x])).toEqual([
      ['d0', 'tile', 0],
      ['d1', 'tile', 69],
      ['d2', 'tile', 138],
    ]);
    expect(match.devices[1]!.screenMm).toEqual({ x: 65, y: 140 });
    expect(match.bounds).toEqual({ x: 0, y: 0, w: 203, h: 140 });
    expect(match.tickHz).toBe(60);
    expect(Object.isFrozen(match) && Object.isFrozen(match.devices[0]!.tile) && Object.isFrozen(match.players)).toBe(true);
    expect(() => host.start(DUEL)).toThrow('A Match is already running');

    vi.advanceTimersByTime(100);
    const received = peer.match;
    expect(received).toEqual(match);
    expect(Object.isFrozen(received!.tiles[0])).toBe(true);

    host.setTemplate('column');
    host.setPlayers([{ playerId: seat('d1'), name: 'Cy' }]);
    vi.advanceTimersByTime(100);
    expect(host.layout?.template).toBe('row');
    expect(peer.layout?.template).toBe('row');
    expect(host.match).toBe(match);
    expect(peer.match).toBe(received);

    const late = join('d3');
    vi.advanceTimersByTime(3000);
    expect(host.match!.devices.map((d) => d.deviceId)).toEqual(['d0', 'd1', 'd2']);
    // The late Device learns that a Match runs, and that it is not in it.
    expect(late.match).toEqual(match);
    expect(peer.match).toBe(received);
  });

  it('close ends the Match on every Device and opens the lobby to changes again', () => {
    const { host, lobby } = table(['d1']);
    const peer = lobby('d1');
    host.start(DUEL);
    vi.advanceTimersByTime(100);
    expect(peer.match).toBeDefined();

    peer.close(); // a Peer cannot
    vi.advanceTimersByTime(100);
    expect(host.match).toBeDefined();
    expect(() => peer.start(DUEL)).toThrow('Only the Host starts a Match');

    host.close();
    host.setTemplate('column');
    vi.advanceTimersByTime(100);
    expect(host.match).toBeUndefined();
    expect(peer.match).toBeUndefined();
    expect(peer.layout?.template).toBe('column');
    expect(host.start(DUEL).matchId).not.toBe(undefined);
  });

  it('takes a Device marked Controller out of the Layout and the Match’s Tiles, keeps it in the Match’s Devices with that role, and counts it as a Controller', () => {
    const { host, lobby } = table(['d1', 'd2']);
    const peer = lobby('d2');
    host.setRole('d2', 'controller');
    host.setRole('d9', 'controller'); // not in the roster: ignored
    vi.advanceTimersByTime(100);
    expect(host.layout?.devices.map((d) => d.id)).toEqual(['d0', 'd1']);
    expect([host.roleOf('d2'), host.roleOf('d1'), host.roleOf('d9')]).toEqual(['controller', 'tile', 'tile']);
    expect([peer.roleOf('d2'), peer.roleOf('d1')]).toEqual(['controller', 'tile']);
    // The default Players sit at the outer Tiles, which are now d0 and d1.
    expect(host.players.map((p) => p.playerId)).toEqual([seat('d0'), seat('d1')]);

    expect(() => host.start(DUEL)).toThrow('Duel needs no Controllers; 1 present');
    expect(() => host.start({ ...DUEL, controllers: { min: 2, max: 2 } })).toThrow('Duel needs 2 Controllers; 1 present');
    const match = host.start({ ...DUEL, id: 'test.pass', controllers: { min: 1, max: 1 } });
    expect(match.tiles.map((t) => t.deviceId)).toEqual(['d0', 'd1']);
    expect(match.devices.map((d) => [d.deviceId, d.role])).toEqual([
      ['d0', 'tile'],
      ['d1', 'tile'],
      ['d2', 'controller'],
    ]);
    expect(match.devices[2]).toEqual({ deviceId: 'd2', role: 'controller', name: 'phone d2', screenMm: { x: 65, y: 140 } });
    expect(match.bounds).toEqual({ x: 0, y: 0, w: 134, h: 140 });
    expect(host.game).toBe('test.pass');
    vi.advanceTimersByTime(100);
    expect(peer.match).toEqual(match);
    expect(peer.game).toBe('test.pass');

    // Fixed while the Match runs; after it, the Device can be a Tile again.
    host.setRole('d2', 'tile');
    expect(host.roleOf('d2')).toBe('controller');
    host.close();
    host.setRole('d2', 'tile');
    vi.advanceTimersByTime(100);
    expect(host.layout?.devices.map((d) => d.id)).toEqual(['d0', 'd1', 'd2']);
    expect([peer.roleOf('d2'), peer.game]).toEqual(['tile', undefined]);
  });
});
