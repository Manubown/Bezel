import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type DeviceId, type DeviceInfo } from '@mgc/core';
import type { Manifest } from '@mgc/sdk';
import { openLobby, sessionLobbyStore, type Lobby, type LobbyStore } from '../src/lobby';

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

/** Host `d0` and the given Peers, each with its lobby, over one hub; everyone synced. `store`: the Host's. */
function table(peers: DeviceId[], store?: LobbyStore) {
  const hub = new MemoryHub(() => 5);
  const lobbies = new Map<DeviceId, Lobby>();
  /** `connection`: a Device back after a drop comes under a new one. */
  const join = (deviceId: DeviceId, open = joinSession, connection = `peer-of-${deviceId}`, saveTo?: LobbyStore): Lobby => {
    const lobby = openLobby(open(hub.connect(connection), info(deviceId)), PX_PER_MM, seat(deviceId), saveTo);
    lobbies.set(deviceId, lobby);
    return lobby;
  };
  const host = join('d0', hostSession, 'peer-of-d0', store);
  for (const id of peers) join(id);
  vi.advanceTimersByTime(3000);
  return { hub, host, lobby: (id: DeviceId) => lobbies.get(id)!, join };
}

/** This tab's `sessionStorage`, in memory: what a page saved there is still there once that page is gone. */
function tabStorage(): Map<string, string> {
  const items = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) });
  return items;
}

/**
 * The Host page before its reload, saving to `store`: Devices d1–d3, the Grid, Tile order d3, Host, d1,
 * d2 a Controller, Quiz (a Player per Controller phone), a bot in slot 0. Then the page is gone.
 */
function decide(store: LobbyStore): void {
  const { hub, host } = table(['d1', 'd2', 'd3'], store);
  host.setGame({ ...DUEL, id: 'test.quiz', name: 'Quiz', tiles: { min: 1, max: 4 }, controllers: { min: 1, max: 4 }, players: { min: 1, max: 4 }, bots: true, seats: 'controllers' });
  host.setTemplate('grid');
  host.setRole('d2', 'controller');
  host.setOrder(['d3', 'd0', 'd1']);
  host.setBot(0, true);
  vi.advanceTimersByTime(100);
  hub.disconnect('peer-of-d0');
}

/** The Tile order a lobby shows. */
const order = (lobby: Lobby) => lobby.layout?.devices.map((d) => d.id);

describe('Lobby over a Session on MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('refuses, with the reason, to start a Game the present Devices cannot satisfy', () => {
    const { host, lobby, join } = table(['d1']);
    expect(host.layout?.devices.map((d) => d.id)).toEqual(['d0', 'd1']);

    expect(() => host.start({ ...DUEL, tiles: { min: 3, max: 4 } })).toThrow('Duel needs 3–4 phones on the table; there are 2');
    expect(() => host.start({ ...DUEL, minTileMm: { w: 70, h: 100 } })).toThrow('Phone 1’s screen is 65 × 140 mm; Duel needs screens of at least 70 × 100 mm');
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
    expect(match.players).toStrictEqual([
      { playerId: seat('d0'), name: 'Ann', deviceId: 'd0' },
      { playerId: seat('d2'), name: 'Bo', deviceId: 'd2' },
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
    expect(() => host.start(DUEL)).toThrow('A game is already running');

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
    expect(() => peer.start(DUEL)).toThrow('Only the first phone starts a game');

    host.close();
    host.setTemplate('column');
    vi.advanceTimersByTime(100);
    expect(host.match).toBeUndefined();
    expect(peer.match).toBeUndefined();
    expect(peer.layout?.template).toBe('column');
    expect(host.start(DUEL).matchId).not.toBe(undefined);
  });

  it('picking a Game lays the phones in the first template its Manifest names, on every Device, and offers only those it names', () => {
    const { host, lobby } = table(['d1']);
    const peer = lobby('d1');
    const templates = () => {
      vi.advanceTimersByTime(100);
      return [host.layout?.template, peer.layout?.template];
    };
    const HOCKEY: Manifest = { ...DUEL, id: 'test.hockey', name: 'Hockey', templates: ['column', 'row'] };

    host.setGame(HOCKEY);
    expect(templates()).toEqual(['column', 'column']);
    host.setTemplate('grid'); // Hockey does not name it
    expect(templates()).toEqual(['column', 'column']);
    host.setTemplate('row');
    expect(templates()).toEqual(['row', 'row']);
    // Picked again, a Game keeps the template the Host chose for it.
    host.setGame(HOCKEY);
    expect(templates()).toEqual(['row', 'row']);
    // A Game that names none can be played in any, the first by default.
    host.setGame(DUEL);
    expect(templates()).toEqual(['row', 'row']);
    host.setTemplate('grid');
    expect(templates()).toEqual(['grid', 'grid']);
    host.setGame({ ...DUEL, id: 'test.pong', name: 'Pong', templates: ['row'] });
    expect(templates()).toEqual(['row', 'row']);
  });

  it('is never refused for the template: a Game starts in the first it names when the phones lay in another', () => {
    const { host, lobby } = table(['d1']);
    host.setTemplate('grid');
    const match = host.start({ ...DUEL, templates: ['column'] });
    expect([host.picked, host.layout?.template]).toEqual(['test.duel', 'column']);
    // End to end: the second phone 4 mm below the first.
    expect(match.tiles.map((t) => [t.deviceId, t.x, t.y])).toEqual([
      ['d0', 0, 0],
      ['d1', 0, 144],
    ]);
    vi.advanceTimersByTime(100);
    expect([lobby('d1').layout?.template, lobby('d1').match]).toEqual(['column', match]);
  });

  it('plays the last Match again: the same Game, Players, Layout and bots through the ordinary start; only its identity differs', () => {
    const { hub, host, lobby, join } = table(['d1', 'd2']);
    const peer = lobby('d1');
    const BOTS: Manifest = { ...DUEL, id: 'test.bots', bots: true };
    expect(() => host.startAgain()).toThrow('No game to play again');
    expect(() => peer.startAgain()).toThrow('Only the first phone starts a game');
    host.setGame(BOTS);
    host.setTemplate('column');
    host.setBot(1, true);
    host.setPlayers(host.players.map((p, i) => ({ ...p, name: ['Ann', 'Robo'][i]! })));
    const first = host.start(BOTS);
    expect(host.layout?.template).toBe('column');
    expect(() => host.startAgain()).toThrow('A game is already running');
    // d2 drops during the Match and is back before it ends: the lobby built its Layout and Players afresh meanwhile.
    hub.disconnect('peer-of-d2');
    vi.advanceTimersByTime(100);
    join('d2', joinSession, 'peer-of-d2-again');
    vi.advanceTimersByTime(3000);
    host.close();
    vi.advanceTimersByTime(100);

    const second = host.startAgain();
    const { matchId, seed, ...rest } = second;
    const { matchId: firstId, seed: firstSeed, ...firstRest } = first;
    expect(matchId).not.toBe(firstId);
    expect(rest).toStrictEqual(firstRest);
    expect(second.players.map((p) => [p.name, p.deviceId ?? 'bot'])).toEqual([
      ['Ann', 'd0'],
      ['Robo', 'bot'],
    ]);
    expect(host.match).toBe(second);
    expect(host.game).toBe('test.bots');
    vi.advanceTimersByTime(100);
    expect(peer.match).toEqual(second);
    expect(peer.game).toBe('test.bots');
  });

  it('refuses Play again, in words, while a phone of the last Match is not at the table, or once the table changed since', () => {
    const { hub, host, lobby, join } = table(['d1', 'd2']);
    host.start(DUEL);
    host.close();
    hub.disconnect('peer-of-d1');
    vi.advanceTimersByTime(100);
    expect(() => host.startAgain()).toThrow('Phone 2 is no longer at the table');
    expect(host.match).toBeUndefined();
    join('d1', joinSession, 'peer-of-d1-again');
    vi.advanceTimersByTime(3000);

    // A phone that joined after it would change the Layout: it is placed from the sheet.
    join('d3');
    vi.advanceTimersByTime(3000);
    expect(() => host.startAgain()).toThrow('Phone 4 joined the table after the last game');
    hub.disconnect('peer-of-d3');
    vi.advanceTimersByTime(100);
    expect(host.startAgain().players).toEqual(host.players);
    host.close();

    // The Host changed the template since: that is Start, not Play again.
    host.setTemplate('column');
    expect(() => host.startAgain()).toThrow('The table changed since the last game');
    expect(lobby('d2').match).toBeUndefined();
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

    expect(() => host.start({ ...DUEL, controllers: { min: 2, max: 2 } })).toThrow('Duel needs 2 phones in hand; there is 1');
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

  it('picking a Game that takes no Controllers puts every phone on the table, and none can be made a Controller while it is picked', () => {
    const { host, lobby } = table(['d1', 'd2']);
    const peer = lobby('d1');
    const PASS: Manifest = { ...DUEL, id: 'test.pass', name: 'Pass', tiles: { min: 1, max: 4 }, controllers: { min: 1, max: 1 } };
    host.setGame(PASS);
    host.setRole('d2', 'controller');
    vi.advanceTimersByTime(100);
    expect([order(host), peer.roleOf('d2')]).toEqual([['d0', 'd1'], 'controller']);

    host.setGame(DUEL);
    vi.advanceTimersByTime(100);
    expect([order(host), order(peer), host.roleOf('d2'), peer.roleOf('d2')]).toEqual([['d0', 'd1', 'd2'], ['d0', 'd1', 'd2'], 'tile', 'tile']);
    host.setRole('d1', 'controller');
    expect(host.roleOf('d1')).toBe('tile');
    expect(host.start(DUEL).tiles.map((t) => t.deviceId)).toEqual(['d0', 'd1', 'd2']);
  });

  it('seats: controllers — a Player per Controller phone, named in the HUD, none from the Tiles; Peers see the same; the Match refuses without Controllers', () => {
    const { host, lobby } = table(['d1', 'd2', 'd3']);
    const peer = lobby('d3');
    const QUIZ: Manifest = { ...DUEL, id: 'test.quiz', name: 'Quiz', tiles: { min: 1, max: 1 }, controllers: { min: 1, max: 4 }, players: { min: 1, max: 4 }, seats: 'controllers' };
    host.setGame(QUIZ);
    vi.advanceTimersByTime(100);
    expect([host.seats, peer.seats]).toEqual(['controllers', 'controllers']);
    // Nobody is a Controller yet: no Players, and Start says so.
    expect(host.players).toEqual([]);
    expect(() => host.start(QUIZ)).toThrow('Quiz needs 1 phone on the table; there are 4');
    host.setRole('d1', 'controller');
    host.setRole('d2', 'controller');
    host.setRole('d3', 'controller');
    vi.advanceTimersByTime(100);
    // Each Controller phone's own Player, seated at that phone, in roster order; the board phone d0 plays nobody.
    expect(host.players).toEqual([
      { playerId: seat('d1'), name: 'Player 1', deviceId: 'd1' },
      { playerId: seat('d2'), name: 'Player 2', deviceId: 'd2' },
      { playerId: seat('d3'), name: 'Player 3', deviceId: 'd3' },
    ]);
    expect(peer.players).toEqual(host.players);
    host.setPlayers(host.players.map((p) => (p.deviceId === 'd2' ? { ...p, name: 'Bo' } : p)));
    vi.advanceTimersByTime(100);
    expect(host.players.map((p) => p.name)).toEqual(['Player 1', 'Bo', 'Player 3']);
    const match = host.start(QUIZ);
    expect(match.players).toEqual(host.players);
    expect(match.devices.map((d) => [d.deviceId, d.role])).toEqual([
      ['d0', 'tile'],
      ['d1', 'controller'],
      ['d2', 'controller'],
      ['d3', 'controller'],
    ]);
    vi.advanceTimersByTime(100);
    expect(peer.match).toEqual(match);
    host.close();
    // Back to a Game seated at the ends, which takes no Controllers: every phone on the table, the outer Tiles' Players again.
    host.setGame(DUEL);
    vi.advanceTimersByTime(100);
    expect(host.players.map((p) => p.playerId)).toEqual([seat('d0'), seat('d3')]);
  });

  it('seats: tiles — a Player at every Tile in Tile order, bots appended on top; Peers see the same', () => {
    const { host, lobby } = table(['d1', 'd2']);
    const peer = lobby('d1');
    const RACE: Manifest = { ...DUEL, id: 'test.race', name: 'Race', tiles: { min: 1, max: 4 }, players: { min: 1, max: 6 }, bots: true, seats: 'tiles' };
    host.setGame(RACE);
    vi.advanceTimersByTime(100);
    expect(host.players).toEqual([
      { playerId: seat('d0'), name: 'Player 1', deviceId: 'd0' },
      { playerId: seat('d1'), name: 'Player 2', deviceId: 'd1' },
      { playerId: seat('d2'), name: 'Player 3', deviceId: 'd2' },
    ]);
    host.move('d2', -2);
    host.setBot(0, true);
    vi.advanceTimersByTime(100);
    // Tile order is Player order; the bot comes after every human.
    expect(host.players.map((p) => p.deviceId ?? p.playerId)).toEqual(['d2', 'd0', 'd1', 'bot:0']);
    expect(peer.players).toEqual(host.players);
    const match = host.start(RACE);
    expect(match.players.map((p) => p.deviceId ?? p.playerId)).toEqual(['d2', 'd0', 'd1', 'bot:0']);
    expect(match.tiles.map((t) => t.deviceId)).toEqual(['d2', 'd0', 'd1']);
    host.close();
    host.setGame(DUEL);
    vi.advanceTimersByTime(100);
    // Back to the ends: slot 0 is the bot, slot 1 the Player at the last Tile.
    expect(host.players.map((p) => p.deviceId ?? p.playerId)).toEqual(['bot:0', 'd1']);
  });

  it('orders the Tiles as the Host says, on the Host and the Peer; a Device that drops and returns keeps its place; Controllers are never in the order', () => {
    const { hub, host, lobby, join } = table(['d1', 'd2', 'd3']);
    const peer = lobby('d2');
    const both = () => {
      vi.advanceTimersByTime(100);
      return [order(host), order(peer)];
    };

    host.move('d0', 2);
    expect(both()).toEqual([
      ['d1', 'd2', 'd0', 'd3'],
      ['d1', 'd2', 'd0', 'd3'],
    ]);
    // The Players sit at the ends of the order.
    expect(host.players.map((p) => p.deviceId)).toEqual(['d1', 'd3']);
    expect(peer.players).toStrictEqual(host.players);
    host.move('d0', 9); // stops at the last Tile
    host.move('d3', -9); // and at the first
    expect(both()).toEqual([
      ['d3', 'd1', 'd2', 'd0'],
      ['d3', 'd1', 'd2', 'd0'],
    ]);
    host.setOrder(['d2', 'd0', 'd9']); // the rest follow in roster order; d9 is not in the roster
    expect(both()).toEqual([
      ['d2', 'd0', 'd1', 'd3'],
      ['d2', 'd0', 'd1', 'd3'],
    ]);

    // d1 drops: the others close up, and can be moved past its place while it is away.
    hub.disconnect('peer-of-d1');
    expect(both()).toEqual([
      ['d2', 'd0', 'd3'],
      ['d2', 'd0', 'd3'],
    ]);
    host.move('d3', -1);
    expect(both()).toEqual([
      ['d2', 'd3', 'd0'],
      ['d2', 'd3', 'd0'],
    ]);
    // Back under a new connection, it is third again.
    const back = join('d1', joinSession, 'peer-of-d1-again');
    vi.advanceTimersByTime(3000);
    expect([order(host), order(peer), order(back)]).toEqual([
      ['d2', 'd3', 'd1', 'd0'],
      ['d2', 'd3', 'd1', 'd0'],
      ['d2', 'd3', 'd1', 'd0'],
    ]);

    // A Controller is no Tile to order or move; a Tile again, it joins at the end.
    host.setRole('d2', 'controller');
    host.setOrder(['d2', 'd0', 'd3', 'd1']);
    host.move('d2', 1);
    expect(both()).toEqual([
      ['d0', 'd3', 'd1'],
      ['d0', 'd3', 'd1'],
    ]);
    host.setRole('d2', 'tile');
    expect(both()).toEqual([
      ['d0', 'd3', 'd1', 'd2'],
      ['d0', 'd3', 'd1', 'd2'],
    ]);
  });

  it('makes a Player slot a bot and back: a bot sits at no Device, Player 1 still at the first Tile; one Tile and a bot are two Players', () => {
    const { host, lobby } = table(['d1', 'd2']);
    const peer = lobby('d1');
    host.setBot(1, true);
    vi.advanceTimersByTime(100);
    expect(host.players).toStrictEqual([
      { playerId: seat('d0'), name: 'Player 1', deviceId: 'd0' },
      { playerId: 'bot:1', name: 'Bot', bot: true },
    ]);
    expect(host.players[1]).not.toHaveProperty('deviceId');
    expect(host.seatOf('bot:1')).toBeUndefined();
    expect(host.slots).toStrictEqual([
      { deviceId: 'd0', player: host.players[0] },
      { deviceId: 'd2', player: host.players[1] },
    ]);
    expect(peer.players).toStrictEqual(host.players);
    expect(peer.slots).toStrictEqual(host.slots);

    // The bot's name is the Host's to give, and stays with the slot's bot.
    host.setPlayers(host.players.map((p) => (p.bot ? { ...p, name: 'Robo' } : p)));
    host.setBot(1, false);
    vi.advanceTimersByTime(100);
    expect(host.players).toStrictEqual([
      { playerId: seat('d0'), name: 'Player 1', deviceId: 'd0' },
      { playerId: seat('d2'), name: 'Player 2', deviceId: 'd2' },
    ]);
    expect(peer.players).toStrictEqual(host.players);
    host.setBot(1, true);
    expect(host.players[1]).toStrictEqual({ playerId: 'bot:1', name: 'Robo', bot: true });

    // One Tile: slot 1 has none, so it holds a Player only as a bot.
    const solo = table([]).host;
    expect(solo.players).toStrictEqual([{ playerId: seat('d0'), name: 'Player 1', deviceId: 'd0' }]);
    solo.setBot(1, true);
    solo.setBot(2, true); // there is no third slot
    expect(solo.players).toStrictEqual([
      { playerId: seat('d0'), name: 'Player 1', deviceId: 'd0' },
      { playerId: 'bot:1', name: 'Bot', bot: true },
    ]);
    expect(solo.slots.map((s) => s.deviceId)).toEqual(['d0', undefined]);
  });

  it('refuses a bot to a Game without bots; with bots, the Peer’s Match carries the same seats and bot as the Host’s', () => {
    const { host, lobby } = table(['d1', 'd2']);
    const peer = lobby('d1');
    host.setBot(0, true);
    expect(() => host.start(DUEL)).toThrow('Duel cannot be played with a bot');
    expect(host.match).toBeUndefined();

    const match = host.start({ ...DUEL, bots: true });
    expect(match.players).toStrictEqual([
      { playerId: 'bot:0', name: 'Bot', bot: true },
      { playerId: seat('d2'), name: 'Player 2', deviceId: 'd2' },
    ]);
    vi.advanceTimersByTime(100);
    expect(peer.match).toStrictEqual(match);
    expect(Object.isFrozen(peer.match!.players[0])).toBe(true);
    // Order and bots are fixed while the Match runs.
    host.setBot(0, false);
    host.move('d0', 1);
    host.setOrder(['d2']);
    vi.advanceTimersByTime(100);
    expect(host.players[0]?.bot).toBe(true);
    expect([order(host), order(peer)]).toEqual([
      ['d0', 'd1', 'd2'],
      ['d0', 'd1', 'd2'],
    ]);

    // A bot counts toward the Player range: one Tile needs one to make two Players.
    const solo = table([]).host;
    const oneTile = { ...DUEL, tiles: { min: 1, max: 4 }, bots: true };
    expect(() => solo.start(oneTile)).toThrow('Duel needs 2 players; there is 1');
    solo.setBot(1, true);
    expect(solo.start(oneTile).players.map((p) => p.playerId)).toEqual([seat('d0'), 'bot:1']);
  });

  it('a reloaded Host lobby takes back its template, Tile order, roles, Game, seats and bots as the same Devices rebind, whatever their join order', () => {
    const tab = tabStorage();
    decide(sessionLobbyStore('ROOM'));
    const saved = JSON.parse(tab.get('mgc.lobby.ROOM')!);
    expect(saved).toEqual({ template: 'grid', order: ['d3', 'd0', 'd1'], roles: { d2: 'controller' }, game: 'test.quiz', seats: 'controllers', bots: [0] });

    // The new page: a fresh Session, the same tab's store; d1 is back first, then d3, then d2.
    const { host, lobby, join } = table(['d1'], sessionLobbyStore('ROOM'));
    expect([host.layout?.template, host.picked, host.seats]).toEqual(['grid', 'test.quiz', 'controllers']);
    expect(order(host)).toEqual(['d0', 'd1']); // no place held open for d3 while it is away
    join('d3');
    vi.advanceTimersByTime(3000);
    join('d2');
    vi.advanceTimersByTime(3000);
    expect([order(host), order(lobby('d1'))]).toEqual([
      ['d3', 'd0', 'd1'],
      ['d3', 'd0', 'd1'],
    ]);
    expect([host.roleOf('d2'), lobby('d3').roleOf('d2')]).toEqual(['controller', 'controller']);
    expect(host.players).toEqual([{ playerId: seat('d2'), name: 'Player 1', deviceId: 'd2' }]);
    expect(JSON.parse(tab.get('mgc.lobby.ROOM')!)).toEqual(saved);
    // The bot kept its slot: under a Game seated at the ends it is Player 1; that Game takes no Controllers, so d2 lies last.
    host.setGame({ ...DUEL, bots: true });
    expect(host.players.map((p) => p.playerId)).toEqual(['bot:0', seat('d2')]);
  });

  it('a Device the saved Tile order does not name joins at the end; a saved one back later still takes its place before it', () => {
    tabStorage();
    decide(sessionLobbyStore('ROOM'));
    const { host, join } = table(['d1'], sessionLobbyStore('ROOM'));
    join('d4');
    vi.advanceTimersByTime(3000);
    expect(order(host)).toEqual(['d0', 'd1', 'd4']);
    join('d3');
    vi.advanceTimersByTime(3000);
    expect(order(host)).toEqual(['d3', 'd0', 'd1', 'd4']);
  });

  it('an order set by hand replaces the saved one: a saved Device not back yet joins at the end like any other, and the store holds the new order', () => {
    const tab = tabStorage();
    decide(sessionLobbyStore('ROOM'));
    const { host, join } = table(['d1'], sessionLobbyStore('ROOM'));
    host.move('d1', -1);
    vi.advanceTimersByTime(100);
    expect(order(host)).toEqual(['d1', 'd0']);
    // A role is not a place: d2's stays with d2.
    expect(JSON.parse(tab.get('mgc.lobby.ROOM')!)).toMatchObject({ order: ['d1', 'd0'], roles: { d2: 'controller' } });
    join('d3');
    join('d2');
    vi.advanceTimersByTime(3000);
    expect(order(host)).toEqual(['d1', 'd0', 'd3']);
    expect(host.roleOf('d2')).toBe('controller');
  });

  it('a Peer lobby neither takes a saved configuration nor saves one', () => {
    const tab = tabStorage();
    tab.set('mgc.lobby.ROOM', JSON.stringify({ template: 'grid', order: ['d1', 'd0'], roles: {}, game: 'test.quiz', seats: 'controllers', bots: [0] }));
    const before = new Map(tab);
    const { host, join } = table([]);
    const peer = join('d1', joinSession, 'peer-of-d1', sessionLobbyStore('ROOM'));
    vi.advanceTimersByTime(3000);
    host.setTemplate('column');
    host.setBot(1, true);
    vi.advanceTimersByTime(100);
    expect([peer.layout?.template, order(peer), peer.picked, peer.seats]).toEqual(['column', ['d0', 'd1'], undefined, 'ends']);
    expect(tab).toEqual(before);
  });
});
