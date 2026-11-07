import type { DeviceId, RosterEntry, Session, SessionStatus } from '@mgc/core';
import { Surface, buildLayout, isLayout, type DeviceRect, type Layout, type Rect, type TemplateId } from '@mgc/layout';
import type { Device, Manifest, MatchInfo, Player, PlayerId, Range, Tile } from '@mgc/sdk';

/** The lobby's Session channel: Host → Peers the lobby state, Peer → Host who sits there. */
const LOBBY_CHANNEL = 'lobby';
/** `Manifest.tickHz` when a Game leaves it out. */
const DEFAULT_TICK_HZ = 60;

export type Role = Device['role'];

/**
 * The lobby of one Session, one interface for Host and Peer: the live
 * arrangement preview, who would play, and, once the Host starts, the frozen
 * Match that every Device runs. The Host's lobby decides; a Peer's mirrors it.
 */
export interface Lobby {
  /** The arrangement of the present Tile Devices; undefined while there are none. */
  readonly layout: Layout | undefined;
  /** This Device's Tile in `layout`, at its px/mm; undefined when it has none. */
  readonly surface: Surface | undefined;
  /** Who plays if the Host starts now: those given to `setPlayers`, else the Players at the two outer Tiles. */
  readonly players: readonly Player[];
  /** The Device a Player sits at, if any. */
  seatOf(playerId: PlayerId): DeviceId | undefined;
  /** Set by `start`, deep-frozen and identical on every Device, until the Host's `close`. */
  readonly match: MatchInfo | undefined;
  /** The manifest id of the Game `match` runs; set and cleared with it. */
  readonly game: string | undefined;
  /** A Device's role in the next Match, as the Host set it (`setRole`); `'tile'` unless marked a Controller. */
  roleOf(deviceId: DeviceId): Role;
  /** `layout`, `players`, a seat, a role, or `match` changed. */
  onChange(handler: () => void): () => void;

  // Host only: no-ops on a Peer, and ignored while `match` is set.
  setTemplate(template: TemplateId): void;
  /** A Controller is not part of the Layout. Devices not in the roster are ignored. */
  setRole(deviceId: DeviceId, role: Role): void;
  /** Replaces the default Players until the Tiles change; a name stays with its Player id. */
  setPlayers(players: readonly Player[]): void;
  /**
   * Host only: checks the present Devices against `game`, then freezes the Match and sends it to
   * every Device. Throws an Error whose message is the reason when it cannot (on a Peer, always).
   */
  start(game: Manifest): MatchInfo;
  /** Host only: the Match is over. `match` clears on every Device and the lobby takes changes again. */
  close(): void;
}

/** `playerId`: the persisted id of the Player who sits at this Device. */
export function openLobby(session: Session, pxPerMm: number, playerId: PlayerId): Lobby {
  return session.role === 'host' ? new HostLobby(session, pxPerMm, playerId) : new PeerLobby(session, pxPerMm, playerId);
}

/** What a lobby shows; Host → Peers as a `state` message. */
interface Shown {
  layout: Layout | undefined;
  players: readonly Player[];
  seats: Readonly<Record<PlayerId, DeviceId>>;
  /** The Devices marked Controller. */
  controllers: readonly DeviceId[];
  match: MatchInfo | undefined;
  game: string | undefined;
}

type StateMessage = {
  t: 'state';
  layout: Layout | null;
  players: readonly Player[];
  seats: Readonly<Record<PlayerId, DeviceId>>;
  controllers: readonly DeviceId[];
  match: MatchInfo | null;
  game: string | null;
};
type SeatMessage = { t: 'seat'; playerId: PlayerId };

abstract class LobbyBase {
  layout: Layout | undefined;
  surface: Surface | undefined;
  players: readonly Player[] = [];
  match: MatchInfo | undefined;
  game: string | undefined;
  private seats: Readonly<Record<PlayerId, DeviceId>> = {};
  private controllers: readonly DeviceId[] = [];
  private readonly listeners = new Set<() => void>();
  private shown = '';

  constructor(
    protected readonly session: Session,
    private readonly pxPerMm: number,
  ) {}

  seatOf(playerId: PlayerId): DeviceId | undefined {
    return this.seats[playerId];
  }

  roleOf(deviceId: DeviceId): Role {
    return this.controllers.includes(deviceId) ? 'controller' : 'tile';
  }

  onChange(handler: () => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /** Takes `s`; listeners hear of it only when something they can see changed. */
  protected show(s: Shown): void {
    if (s.layout !== this.layout) {
      const rect = s.layout?.devices.find((d) => d.id === this.session.self.deviceId);
      this.surface = rect && new Surface(rect, this.pxPerMm);
    }
    this.layout = s.layout;
    this.players = s.players;
    this.seats = s.seats;
    this.controllers = s.controllers;
    this.match = s.match;
    this.game = s.game;
    const key = JSON.stringify([s.layout, s.players, s.seats, s.controllers, s.match?.matchId]);
    if (key === this.shown) return;
    this.shown = key;
    this.listeners.forEach((h) => h());
  }
}

/** Builds the Layout from the present Tile Devices in roster order and decides everything a Peer shows. */
class HostLobby extends LobbyBase implements Lobby {
  private template: TemplateId = 'row';
  private readonly roles = new Map<DeviceId, Role>();
  /** The Player id each Device reported for itself. */
  private readonly seatIds = new Map<DeviceId, PlayerId>();
  /** Names given with `setPlayers`, by Player id. */
  private readonly names = new Map<PlayerId, string>();
  /** `setPlayers`' choice; dropped when the Tiles change. */
  private chosen: readonly Player[] | undefined;
  private frozen: MatchInfo | undefined;
  /** The manifest id of the Game `frozen` runs. */
  private frozenGame: string | undefined;
  /** `template|id:w×h,…` that `layout` was built from: clock reports alone rebuild nothing. */
  private tilesKey = '';
  /** The last state sent to every Peer, as JSON. */
  private sent = '';
  /** Peers present when the state was last sent. */
  private reached = new Set<DeviceId>();

  constructor(session: Session, pxPerMm: number, playerId: PlayerId) {
    super(session, pxPerMm);
    this.seatIds.set(session.self.deviceId, playerId);
    session.onChange(() => this.refresh());
    session.onMessage(LOBBY_CHANNEL, (data, from) => {
      const seat = isObj(data) && data['t'] === 'seat' && isStr(data['playerId']) && data['playerId'] !== '' ? data['playerId'] : undefined;
      if (seat === undefined || this.seatIds.get(from) === seat) return;
      this.seatIds.set(from, seat);
      this.refresh();
    });
    this.refresh();
  }

  setTemplate(template: TemplateId): void {
    if (this.frozen || template === this.template) return;
    this.template = template;
    this.refresh();
  }

  setRole(deviceId: DeviceId, role: Role): void {
    if (this.frozen || this.assigned(deviceId) === role || !this.session.roster().some((e) => e.info.deviceId === deviceId)) return;
    this.roles.set(deviceId, role);
    this.refresh();
  }

  setPlayers(players: readonly Player[]): void {
    if (this.frozen) return;
    this.chosen = players.map((p, i) => ({ playerId: p.playerId, name: p.name.trim() || defaultName(i) }));
    for (const p of this.chosen) this.names.set(p.playerId, p.name);
    this.refresh();
  }

  start(game: Manifest): MatchInfo {
    if (this.frozen) throw new Error('A Match is already running');
    const present = this.session.roster().filter((e) => e.present);
    const tiles = this.layout?.devices ?? [];
    const refusal = this.refusal(game, present, tiles);
    if (refusal !== undefined) throw new Error(refusal);
    const tileOf = new Map(tiles.map((r): [DeviceId, Tile] => [r.id, { deviceId: r.id, x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot }]));
    const devices = present.map(({ info }): Device => {
      const tile = tileOf.get(info.deviceId);
      const screenMm = { x: info.width / info.pxPerMm, y: info.height / info.pxPerMm };
      return { deviceId: info.deviceId, role: tile ? 'tile' : 'controller', name: info.name, ...(tile && { tile }), screenMm };
    });
    const match = deepFreeze<MatchInfo>({
      matchId: crypto.randomUUID(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
      tickHz: game.tickHz ?? DEFAULT_TICK_HZ,
      players: this.players.map(({ playerId, name }) => ({ playerId, name })),
      devices,
      tiles: [...tileOf.values()],
      bounds: this.layout ? { ...this.layout.bounds } : { x: 0, y: 0, w: 0, h: 0 },
    });
    this.frozen = match;
    this.frozenGame = game.id;
    this.refresh();
    return match;
  }

  close(): void {
    if (!this.frozen) return;
    this.frozen = undefined;
    this.refresh();
  }

  private assigned(deviceId: DeviceId): Role {
    return this.roles.get(deviceId) ?? 'tile';
  }

  private refresh(): void {
    const present = this.session.roster().filter((e) => e.present);
    const sizes = present
      .filter((e) => this.assigned(e.info.deviceId) === 'tile')
      .map(({ info }) => ({ id: info.deviceId, w: info.width / info.pxPerMm, h: info.height / info.pxPerMm }));
    const key = `${this.template}|${sizes.map((s) => `${s.id}:${s.w.toFixed(1)}x${s.h.toFixed(1)}`).join(',')}`;
    let layout = this.layout;
    if (key !== this.tilesKey) {
      this.tilesKey = key;
      layout = sizes.length > 0 ? buildLayout(this.template, sizes) : undefined;
      this.chosen = undefined;
    }
    const players = this.chosen ?? this.outerPlayers(layout);
    const seats: Record<PlayerId, DeviceId> = {};
    for (const [deviceId, playerId] of this.seatIds) if (players.some((p) => p.playerId === playerId)) seats[playerId] = deviceId;
    const controllers = this.session
      .roster()
      .map((e) => e.info.deviceId)
      .filter((id) => this.assigned(id) === 'controller');
    const state: Shown = { layout, players, seats, controllers, match: this.frozen, game: this.frozen && this.frozenGame };
    // Peers hear of it before anything here reacts to it (a Match start, say).
    this.publish(state, present);
    this.show(state);
  }

  /** The default seating: one Player at each of the first and last Tile in Layout order. */
  private outerPlayers(layout: Layout | undefined): Player[] {
    const tiles = layout?.devices ?? [];
    const outer = tiles.length > 1 ? [tiles[0]!, tiles[tiles.length - 1]!] : tiles;
    return outer.flatMap((d, i) => {
      const playerId = this.seatIds.get(d.id);
      return playerId === undefined ? [] : [{ playerId, name: this.names.get(playerId) ?? defaultName(i) }];
    });
  }

  /** Sends the state to every Peer when it changed, else only to Peers that were not there last time. */
  private publish(s: Shown, present: readonly RosterEntry[]): void {
    const msg: StateMessage = { t: 'state', layout: s.layout ?? null, players: s.players, seats: s.seats, controllers: s.controllers, match: s.match ?? null, game: s.game ?? null };
    const json = JSON.stringify(msg);
    const peers = new Set(present.map((e) => e.info.deviceId).filter((id) => id !== this.session.self.deviceId));
    if (json !== this.sent) {
      this.sent = json;
      this.session.send(LOBBY_CHANNEL, msg);
    } else for (const id of peers) if (!this.reached.has(id)) this.session.send(LOBBY_CHANNEL, msg, id);
    this.reached = peers;
  }

  /** Why `game` cannot start on the present Devices, or undefined if it can. */
  private refusal(game: Manifest, present: readonly RosterEntry[], tiles: readonly DeviceRect[]): string | undefined {
    const { layout } = this;
    if (game.templates && layout && !game.templates.includes(layout.template)) {
      return `${game.name} needs the ${game.templates.join(' or ')} arrangement, not ${layout.template}`;
    }
    const controllers = present.filter((e) => this.assigned(e.info.deviceId) === 'controller').length;
    const count = outside(game.tiles, tiles.length, 'Tile', 'present') ?? outside(game.controllers, controllers, 'Controller', 'present');
    if (count !== undefined) return `${game.name} needs ${count}`;
    const min = game.minTileMm;
    const small = min ? tiles.findIndex((t) => t.w < min.w || t.h < min.h) : -1;
    if (min && small >= 0) {
      const t = tiles[small]!;
      return `Phone ${small + 1} is ${mm(t.w)} × ${mm(t.h)} mm; ${game.name} needs Tiles of at least ${mm(min.w)} × ${mm(min.h)} mm`;
    }
    const joining = present.find((e) => !e.sync.synced || !this.seatIds.has(e.info.deviceId));
    if (joining) {
      const i = tiles.findIndex((t) => t.id === joining.info.deviceId);
      return `${i >= 0 ? `Phone ${i + 1}` : joining.info.name} is still joining`;
    }
    const ids = new Set(this.players.map((p) => p.playerId));
    if (ids.size !== this.players.length) return 'Two Players have the same id';
    const players = outside(game.players, this.players.length, 'Player', 'seated');
    return players === undefined ? undefined : `${game.name} needs ${players}`;
  }
}

/** Mirrors the Host's lobby; tells the Host who sits here once the Session is ready. */
class PeerLobby extends LobbyBase implements Lobby {
  private status: SessionStatus | undefined;

  constructor(
    session: Session,
    pxPerMm: number,
    private readonly playerId: PlayerId,
  ) {
    super(session, pxPerMm);
    session.onMessage(LOBBY_CHANNEL, (data, from) => {
      if (from !== session.roster()[0]?.info.deviceId) return; // the Host's word only
      const s = readState(data);
      // Set once: the same Match arriving again keeps the object this lobby already handed out.
      if (s) this.show(s.match?.matchId === this.match?.matchId ? { ...s, match: this.match } : s);
    });
    session.onChange(() => this.follow());
    this.follow();
  }

  setTemplate(): void {}
  setRole(): void {}
  setPlayers(): void {}
  start(): MatchInfo {
    throw new Error('Only the Host starts a Match');
  }
  close(): void {}

  private follow(): void {
    const was = this.status;
    this.status = this.session.status;
    if (this.status === was) return;
    if (this.status === 'ready') this.session.send(LOBBY_CHANNEL, { t: 'seat', playerId: this.playerId } satisfies SeatMessage);
    // The Host is gone and the Session with it (ADR-0002).
    if (this.status === 'searching') this.show({ layout: undefined, players: [], seats: {}, controllers: [], match: undefined, game: undefined });
  }
}

function defaultName(index: number): string {
  return `Player ${index + 1}`;
}

function mm(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** `undefined` when `n` is in `range`, else what the Game needs and what there is. */
function outside(range: Range, n: number, noun: string, have: string): string | undefined {
  if (n >= range.min && n <= range.max) return undefined;
  const need = range.min === range.max ? (range.min === 0 ? `no ${noun}s` : `${range.min} ${noun}${range.min === 1 ? '' : 's'}`) : `${range.min}–${range.max} ${noun}s`;
  return `${need}; ${n} ${have}`;
}

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

// Everything below reads untrusted data off the network into fresh objects.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function all<T>(v: unknown, read: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const x of v) {
    const r = read(x);
    if (r === undefined) return undefined;
    out.push(r);
  }
  return out;
}

function readState(d: unknown): Shown | undefined {
  if (!isObj(d) || d['t'] !== 'state') return undefined;
  const layout = d['layout'] === null ? null : isLayout(d['layout']) ? structuredClone(d['layout']) : undefined;
  const players = all(d['players'], readPlayer);
  const seats = d['seats'];
  const controllers = all(d['controllers'], (x) => (isStr(x) ? x : undefined));
  const match = d['match'] === null ? null : readMatch(d['match']);
  const game = d['game'] === null ? null : isStr(d['game']) ? d['game'] : undefined;
  if (layout === undefined || !players || !isObj(seats) || !Object.values(seats).every(isStr) || !controllers || match === undefined || game === undefined) return undefined;
  return {
    layout: layout ?? undefined,
    players,
    seats: { ...(seats as Record<PlayerId, DeviceId>) },
    controllers,
    match: match ?? undefined,
    game: game ?? undefined,
  };
}

function readPlayer(v: unknown): Player | undefined {
  return isObj(v) && isStr(v['playerId']) && isStr(v['name']) ? { playerId: v['playerId'], name: v['name'] } : undefined;
}

function readRect(v: unknown): Rect | undefined {
  if (!isObj(v)) return undefined;
  const { x, y, w, h } = v;
  return isNum(x) && isNum(y) && isNum(w) && isNum(h) ? { x, y, w, h } : undefined;
}

function readTile(v: unknown): Tile | undefined {
  const r = readRect(v);
  return r && isObj(v) && isStr(v['deviceId']) && isNum(v['rot']) ? { deviceId: v['deviceId'], ...r, rot: v['rot'] } : undefined;
}

function readDevice(v: unknown): Device | undefined {
  if (!isObj(v)) return undefined;
  const { deviceId, role, name, screenMm } = v;
  if (!isStr(deviceId) || !isStr(name) || !isObj(screenMm) || !isNum(screenMm['x']) || !isNum(screenMm['y'])) return undefined;
  const device = { deviceId, name, screenMm: { x: screenMm['x'], y: screenMm['y'] } };
  if (role === 'controller') return v['tile'] === undefined ? { ...device, role } : undefined;
  const tile = readTile(v['tile']);
  return role === 'tile' && tile ? { ...device, role, tile } : undefined;
}

function readMatch(v: unknown): MatchInfo | undefined {
  if (!isObj(v)) return undefined;
  const { matchId, seed, tickHz } = v;
  const players = all(v['players'], readPlayer);
  const devices = all(v['devices'], readDevice);
  const tiles = all(v['tiles'], readTile);
  const bounds = readRect(v['bounds']);
  if (!isStr(matchId) || !isNum(seed) || !isNum(tickHz) || !players || !devices || !tiles || !bounds) return undefined;
  return deepFreeze({ matchId, seed, tickHz, players, devices, tiles, bounds });
}
