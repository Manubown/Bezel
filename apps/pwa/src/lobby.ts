import type { DeviceId, RosterEntry, Session, SessionStatus } from '@mgc/core';
import { Surface, TEMPLATE_IDS, buildLayout, isLayout, type DeviceRect, type Layout, type Rect, type TemplateId } from '@mgc/layout';
import type { Device, Manifest, MatchInfo, Player, PlayerId, Range, Tile } from '@mgc/sdk';

/** The lobby's Session channel: Host → Peers the lobby state, Peer → Host who sits there. */
const LOBBY_CHANNEL = 'lobby';
/** `Manifest.tickHz` when a Game leaves it out. */
const DEFAULT_TICK_HZ = 60;
/** Player slots: one at the first and one at the last Tile. */
const SLOTS = 2;
/** A bot Player's name until the Host gives it another. */
const BOT_NAME = 'Bot';

export type Role = Device['role'];
/** Where a Game's Players come from: `Manifest.seats`. */
export type Seats = NonNullable<Manifest['seats']>;

/** A Player slot: who plays at the first (slot 0) or the last (slot 1) Tile in Tile order. */
export interface Slot {
  /** The slot's Tile Device; none for slot 1 with a single Tile (it can only be a bot), or with no Tiles. */
  readonly deviceId: DeviceId | undefined;
  /** The bot, else the human seated at `deviceId`; undefined while nobody plays there. */
  readonly player: Player | undefined;
}

/**
 * The lobby of one Session, one interface for Host and Peer: the live
 * arrangement preview, who would play, and, once the Host starts, the frozen
 * Match that every Device runs. The Host's lobby decides; a Peer's mirrors it.
 */
export interface Lobby {
  /** The arrangement of the present Tile Devices in Tile order; undefined while there are none. */
  readonly layout: Layout | undefined;
  /** This Device's Tile in `layout`, at its px/mm; undefined when it has none. */
  readonly surface: Surface | undefined;
  /**
   * Who plays if the Host starts now, Player 1 first: those given to `setPlayers`, else the Player
   * of each slot (`slots`). A human carries the Device it sits at (`deviceId`), a bot `bot: true`.
   */
  readonly players: readonly Player[];
  /** Always two: who plays at the first and at the last Tile. */
  readonly slots: readonly Slot[];
  /** The Device a Player sits at, if any. */
  seatOf(playerId: PlayerId): DeviceId | undefined;
  /** Set by `start`, deep-frozen and identical on every Device, until the Host's `close`. */
  readonly match: MatchInfo | undefined;
  /** The manifest id of the Game `match` runs; set and cleared with it. */
  readonly game: string | undefined;
  /** Host: the manifest id of the Game picked for the next Start (`setGame`), kept across a reload of its page; undefined on a Peer. */
  readonly picked: string | undefined;
  /** Where the Players come from, after the picked Game's manifest (`setGame`); `'ends'` until one is picked. */
  readonly seats: Seats;
  /** A Device's role in the next Match, as the Host set it (`setRole`); `'tile'` unless marked a Controller. */
  roleOf(deviceId: DeviceId): Role;
  /** `layout`, `players`, a role, or `match` changed. */
  onChange(handler: () => void): () => void;

  // Host only: no-ops on a Peer, and ignored while `match` is set.
  /**
   * The Game the Host is about to start: its manifest decides the seats (`Manifest.seats`) and the arrangement.
   * Picked anew, it lays the phones in the first arrangement it names (`arrangements`); picked again, in the one
   * the Host chose for it. A Game that takes no Controllers puts every phone on the table.
   */
  setGame(game: Manifest): void;
  /** An arrangement the picked Game does not name is ignored. */
  setTemplate(template: TemplateId): void;
  /**
   * A Controller is not part of the Layout, nor of the Tile order. Devices not in the roster are ignored, and
   * Controllers while the picked Game takes none.
   */
  setRole(deviceId: DeviceId, role: Role): void;
  /**
   * The Tile order, first Tile first. Tile Devices it leaves out follow in roster order; a Device
   * that is away keeps its place for when it is back. Controllers and Devices not in the roster are ignored.
   * Devices of a restored Tile order (`openLobby`'s `store`) that are not back yet lose their places.
   */
  setOrder(deviceIds: readonly DeviceId[]): void;
  /** Moves a present Tile Device `delta` places along the Tile order (negative: towards the first), stopping at the ends. */
  move(deviceId: DeviceId, delta: number): void;
  /** Player slot `slot` (0 or 1) becomes a bot, or (`on` false) the human seated at its Tile again. Kept while the Tiles change. */
  setBot(slot: number, on: boolean): void;
  /** Replaces the default Players until the Tiles or a bot change; a name stays with its Player id. */
  setPlayers(players: readonly Player[]): void;
  /**
   * Host only: picks `game` (`setGame`), so it is never refused for the arrangement, checks the present
   * Devices against it, then freezes the Match and sends it to every Device. Throws an Error whose message
   * is the reason when it cannot (on a Peer, always).
   */
  start(game: Manifest): MatchInfo;
  /**
   * Host only: Play again. Starts the last Match's Game through `start`, on the condition that the table is
   * still the last Match's, so the new Match has the same Players, Layout and bots and differs only in its id
   * and seed. Throws an Error whose message is the reason when it cannot (on a Peer, always).
   */
  startAgain(): MatchInfo;
  /** Host only: the Match is over. `match` clears on every Device and the lobby takes changes again. */
  close(): void;
}

/**
 * `playerId`: the persisted id of the Player who sits at this Device. `store`, on the Host only: where
 * its decisions outlive a reload of the page. A Host lobby with a saved configuration takes the
 * template, Game, seats and bots at once; each Device of the saved Tile order takes its place and role
 * when it appears in the roster, Devices the order does not name follow as usual, and the first order
 * set by hand (`setOrder`, `move`) forgets the places of those not back yet.
 */
export function openLobby(session: Session, pxPerMm: number, playerId: PlayerId, store?: LobbyStore): Lobby {
  return session.role === 'host' ? new HostLobby(session, pxPerMm, playerId, store) : new PeerLobby(session, pxPerMm, playerId);
}

/** The arrangements `game` can be played in, the one picking it selects first (spec D6): its Manifest's `templates`, else every template. */
export function arrangements(game: Manifest): readonly TemplateId[] {
  return game.templates?.length ? game.templates : TEMPLATE_IDS;
}

/** The Host's lobby decisions, saved across a reload of its page: nothing derived from them, never a Match. */
export interface SavedLobby {
  readonly template: TemplateId;
  /** The Tile order, first Tile first: every Tile Device of the roster, present or not. */
  readonly order: readonly DeviceId[];
  /** The roles the Host set (`setRole`), by Device. */
  readonly roles: Readonly<Record<DeviceId, Role>>;
  /** The picked Game's manifest id (`setGame`). */
  readonly game: string | undefined;
  readonly seats: Seats;
  /** The Player slots that are bots. */
  readonly bots: readonly number[];
}

/** Where a Host lobby keeps its `SavedLobby`. */
export interface LobbyStore {
  load(): SavedLobby | undefined;
  save(saved: SavedLobby): void;
}

/** `sessionStorage` `mgc.lobby.<code>`: per room code and tab, the lifetime of the code a reloaded Host keeps (`main.ts`). */
export function sessionLobbyStore(code: string): LobbyStore {
  const key = `mgc.lobby.${code}`;
  return {
    load: () => {
      const json = sessionStorage.getItem(key);
      return json === null ? undefined : readSaved(JSON.parse(json));
    },
    save: (saved) => sessionStorage.setItem(key, JSON.stringify(saved)),
  };
}

/** What a lobby shows; Host → Peers as a `state` message. A Player's seat is its `deviceId`. */
interface Shown {
  layout: Layout | undefined;
  players: readonly Player[];
  /** The Devices marked Controller. */
  controllers: readonly DeviceId[];
  seats: Seats;
  match: MatchInfo | undefined;
  game: string | undefined;
}

type StateMessage = {
  t: 'state';
  layout: Layout | null;
  players: readonly Player[];
  controllers: readonly DeviceId[];
  seats: Seats;
  match: MatchInfo | null;
  game: string | null;
};
type SeatMessage = { t: 'seat'; playerId: PlayerId };

abstract class LobbyBase {
  layout: Layout | undefined;
  surface: Surface | undefined;
  players: readonly Player[] = [];
  slots: readonly Slot[] = slotsOf(undefined, []);
  seats: Seats = 'ends';
  match: MatchInfo | undefined;
  game: string | undefined;
  picked: string | undefined;
  private controllers: readonly DeviceId[] = [];
  private readonly listeners = new Set<() => void>();
  private shown = '';

  constructor(
    protected readonly session: Session,
    private readonly pxPerMm: number,
  ) {}

  seatOf(playerId: PlayerId): DeviceId | undefined {
    return this.players.find((p) => p.playerId === playerId)?.deviceId;
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
    this.slots = slotsOf(s.layout, s.players);
    this.controllers = s.controllers;
    this.seats = s.seats;
    this.match = s.match;
    this.game = s.game;
    const key = JSON.stringify([s.layout, s.players, s.controllers, s.seats, s.match?.matchId]);
    if (key === this.shown) return;
    this.shown = key;
    this.listeners.forEach((h) => h());
  }
}

/** Builds the Layout from the present Tile Devices in Tile order and decides everything a Peer shows. */
class HostLobby extends LobbyBase implements Lobby {
  private template: TemplateId = 'row';
  /** The arrangements the picked Game names (`arrangements`); every one until a Game is picked. */
  private allowed: readonly TemplateId[] = TEMPLATE_IDS;
  /** Whether the picked Game takes Controllers; until a Game is picked, any phone can be one. */
  private inHand = true;
  private readonly roles = new Map<DeviceId, Role>();
  /** The Tile order, `setOrder`'s or the saved one: Devices in the Tile role only, present or not. */
  private order: DeviceId[] = [];
  /** Devices of the saved Tile order not yet in the roster: they keep their places until the Host sets an order by hand. */
  private readonly pending = new Set<DeviceId>();
  /** The Player slots that are bots. */
  private readonly bots = new Set<number>();
  /** The Player id each Device reported for itself. */
  private readonly seatIds = new Map<DeviceId, PlayerId>();
  /** Names given with `setPlayers`, by Player id. */
  private readonly names = new Map<PlayerId, string>();
  /** `setPlayers`' choice; dropped when the Tiles or a bot change. */
  private chosen: readonly Player[] | undefined;
  private frozen: MatchInfo | undefined;
  /** The manifest id of the Game `frozen` runs. */
  private frozenGame: string | undefined;
  /** The last Match `start` froze and the Game it runs, kept after `close` for `startAgain`. */
  private last: { match: MatchInfo; game: Manifest } | undefined;
  /** `template|id:w×h,…` in Tile order that `layout` was built from: clock reports alone rebuild nothing. */
  private tilesKey = '';
  /** The last state sent to every Peer, as JSON. */
  private sent = '';
  /** Peers present when the state was last sent. */
  private reached = new Set<DeviceId>();
  /** The configuration last given to `store`, as JSON. */
  private stored = '';

  constructor(
    session: Session,
    pxPerMm: number,
    playerId: PlayerId,
    private readonly store: LobbyStore | undefined,
  ) {
    super(session, pxPerMm);
    const saved = store?.load();
    if (saved) {
      this.template = saved.template;
      for (const [id, role] of Object.entries(saved.roles)) this.roles.set(id, role);
      this.order = [...new Set(saved.order)].filter((id) => this.assigned(id) === 'tile');
      for (const id of this.order) this.pending.add(id);
      this.picked = saved.game;
      this.seats = saved.seats;
      for (const slot of saved.bots) this.bots.add(slot);
    }
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

  setGame(game: Manifest): void {
    if (this.frozen) return;
    const seats = game.seats ?? 'ends';
    this.allowed = arrangements(game);
    this.inHand = game.controllers.max > 0;
    // Picked anew, a Game lays the phones in the first arrangement it names; picked again, in the one the Host chose for it.
    const template = game.id === this.picked && this.allowed.includes(this.template) ? this.template : this.allowed[0]!;
    // A Game that takes no Controllers has every phone on the table.
    const held = !this.inHand && this.roles.size > 0;
    if (game.id === this.picked && seats === this.seats && template === this.template && !held) return;
    this.picked = game.id;
    if (seats !== this.seats) this.chosen = undefined;
    this.seats = seats;
    this.template = template;
    if (held) this.roles.clear();
    this.refresh();
  }

  setTemplate(template: TemplateId): void {
    if (this.frozen || template === this.template || !this.allowed.includes(template)) return;
    this.template = template;
    this.refresh();
  }

  setRole(deviceId: DeviceId, role: Role): void {
    if (this.frozen || (role === 'controller' && !this.inHand) || this.assigned(deviceId) === role || !this.session.roster().some((e) => e.info.deviceId === deviceId)) return;
    this.roles.set(deviceId, role);
    if (role === 'controller') this.order = this.order.filter((id) => id !== deviceId);
    this.refresh();
  }

  setOrder(deviceIds: readonly DeviceId[]): void {
    if (this.frozen) return;
    // An order by hand replaces the saved one: its Devices that are not back yet lose their places.
    const tiles = new Set(this.tileOrder().filter((id) => !this.pending.has(id)));
    this.pending.clear();
    this.order = [...new Set(deviceIds)].filter((id) => tiles.has(id));
    this.refresh();
  }

  move(deviceId: DeviceId, delta: number): void {
    if (this.frozen || !Number.isInteger(delta)) return;
    const present = new Set(this.session.roster().flatMap((e) => (e.present ? [e.info.deviceId] : [])));
    const all = this.tileOrder();
    const shown = all.filter((id) => present.has(id));
    const from = shown.indexOf(deviceId);
    const to = Math.min(Math.max(from + delta, 0), shown.length - 1);
    if (from < 0 || to === from) return;
    shown.splice(to, 0, ...shown.splice(from, 1));
    // A Device that is away keeps its place; the present ones fill theirs in the new order.
    let next = 0;
    this.setOrder(all.map((id) => (present.has(id) ? shown[next++]! : id)));
  }

  setBot(slot: number, on: boolean): void {
    if (this.frozen || !Number.isInteger(slot) || slot < 0 || slot >= SLOTS || this.bots.has(slot) === on) return;
    if (on) this.bots.add(slot);
    else this.bots.delete(slot);
    this.chosen = undefined;
    this.refresh();
  }

  setPlayers(players: readonly Player[]): void {
    if (this.frozen) return;
    this.chosen = players.map((p, i) => ({ playerId: p.playerId, name: p.name.trim() || (p.bot ? BOT_NAME : defaultName(i)), ...(p.bot && { bot: true as const }) }));
    for (const p of this.chosen) this.names.set(p.playerId, p.name);
    this.refresh();
  }

  start(game: Manifest): MatchInfo {
    if (this.frozen) throw new Error('A Match is already running');
    // Starting a Game picks it: the phones lie in an arrangement it names before anything is checked.
    this.setGame(game);
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
      players: this.players.map((p) => ({ ...p })),
      devices,
      tiles: [...tileOf.values()],
      bounds: this.layout ? { ...this.layout.bounds } : { x: 0, y: 0, w: 0, h: 0 },
    });
    this.frozen = match;
    this.frozenGame = game.id;
    this.last = { match, game };
    this.refresh();
    return match;
  }

  startAgain(): MatchInfo {
    if (!this.last) throw new Error('No game to play again');
    if (this.frozen) throw new Error('A Match is already running');
    const { match, game } = this.last;
    const present = this.session.roster().filter((e) => e.present);
    const gone = match.devices.find((d) => !present.some((e) => e.info.deviceId === d.deviceId));
    if (gone) {
      const i = match.tiles.findIndex((t) => t.deviceId === gone.deviceId);
      throw new Error(`${i >= 0 ? `Phone ${i + 1}` : gone.name} is no longer at the table`);
    }
    const joined = present.find((e) => !match.devices.some((d) => d.deviceId === e.info.deviceId));
    if (joined) {
      const i = this.layout?.devices.findIndex((d) => d.id === joined.info.deviceId) ?? -1;
      throw new Error(`${i >= 0 ? `Phone ${i + 1}` : joined.info.name} joined the table after the last game`);
    }
    // The same Devices, but the Host decided otherwise since (an arrangement, an order, a bot, a name): that is Start.
    const table = (players: readonly Player[], tiles: readonly Tile[]): string =>
      JSON.stringify([players.map((p) => [p.playerId, p.name, p.deviceId, p.bot]), tiles.map((t) => [t.deviceId, t.x, t.y, t.w, t.h, t.rot])]);
    const tiles = (this.layout?.devices ?? []).map((r): Tile => ({ deviceId: r.id, x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot }));
    if (table(this.players, tiles) !== table(match.players, match.tiles)) throw new Error('The table changed since the last game');
    return this.start(game);
  }

  close(): void {
    if (!this.frozen) return;
    this.frozen = undefined;
    this.refresh();
  }

  private assigned(deviceId: DeviceId): Role {
    return this.roles.get(deviceId) ?? 'tile';
  }

  /** Every Tile Device of `order` (saved ones not back yet included) and of the roster, present or not, in Tile order: `order`, then the rest in roster order. */
  private tileOrder(): DeviceId[] {
    const tiles = this.session
      .roster()
      .map((e) => e.info.deviceId)
      .filter((id) => this.assigned(id) === 'tile');
    return [...this.order, ...tiles.filter((id) => !this.order.includes(id))];
  }

  private refresh(): void {
    const roster = this.session.roster();
    for (const e of roster) this.pending.delete(e.info.deviceId);
    const present = roster.filter((e) => e.present);
    const here = new Map(present.map((e) => [e.info.deviceId, e.info]));
    const sizes = this.tileOrder().flatMap((id) => {
      const info = here.get(id);
      return info ? [{ id, w: info.width / info.pxPerMm, h: info.height / info.pxPerMm }] : [];
    });
    const key = `${this.template}|${sizes.map((s) => `${s.id}:${s.w.toFixed(1)}x${s.h.toFixed(1)}`).join(',')}`;
    let layout = this.layout;
    if (key !== this.tilesKey) {
      this.tilesKey = key;
      layout = sizes.length > 0 ? buildLayout(this.template, sizes) : undefined;
      this.chosen = undefined;
    }
    const players = this.chosen ? this.seated(this.chosen, here) : this.seats === 'controllers' ? this.controllerPlayers(present) : this.seats === 'tiles' ? this.tilePlayers(layout) : this.slotPlayers(layout);
    const controllers = roster.map((e) => e.info.deviceId).filter((id) => this.assigned(id) === 'controller');
    const state: Shown = { layout, players, controllers, seats: this.seats, match: this.frozen, game: this.frozen && this.frozenGame };
    // Peers hear of it before anything here reacts to it (a Match start, say).
    this.publish(state, present);
    this.show(state);
    this.save();
  }

  /** Gives the Host's decisions to `store` when one of them changed. */
  private save(): void {
    if (!this.store) return;
    const saved: SavedLobby = { template: this.template, order: this.tileOrder(), roles: Object.fromEntries(this.roles), game: this.picked, seats: this.seats, bots: [...this.bots].sort() };
    const json = JSON.stringify(saved);
    if (json === this.stored) return;
    this.stored = json;
    this.store.save(saved);
  }

  /** The default Players, one per slot: its bot, or the human at its Tile once that Device said who sits there. */
  private slotPlayers(layout: Layout | undefined): Player[] {
    return slotTiles(layout).flatMap((deviceId, slot): Player[] => {
      if (this.bots.has(slot)) {
        const playerId = botId(slot);
        return [{ playerId, name: this.names.get(playerId) ?? BOT_NAME, bot: true }];
      }
      const playerId = deviceId === undefined ? undefined : this.seatIds.get(deviceId);
      if (deviceId === undefined || playerId === undefined) return [];
      return [{ playerId, name: this.names.get(playerId) ?? defaultName(slot), deviceId }];
    });
  }

  /** `seats: 'tiles'`: one Player per Tile in Tile order, once that Device said who sits there, then the bot slots that are on. */
  private tilePlayers(layout: Layout | undefined): Player[] {
    const humans = (layout?.devices ?? []).flatMap((d, i): Player[] => {
      const playerId = this.seatIds.get(d.id);
      return playerId === undefined ? [] : [{ playerId, name: this.names.get(playerId) ?? defaultName(i), deviceId: d.id }];
    });
    const bots = [...this.bots].sort().map((slot): Player => ({ playerId: botId(slot), name: this.names.get(botId(slot)) ?? BOT_NAME, bot: true }));
    return [...humans, ...bots];
  }

  /** `seats: 'controllers'`: one Player per present Controller Device, in roster order, once that Device said who holds it. */
  private controllerPlayers(present: readonly RosterEntry[]): Player[] {
    return present
      .map((e) => e.info.deviceId)
      .filter((id) => this.assigned(id) === 'controller')
      .flatMap((deviceId, i): Player[] => {
        const playerId = this.seatIds.get(deviceId);
        return playerId === undefined ? [] : [{ playerId, name: this.names.get(playerId) ?? defaultName(i), deviceId }];
      });
  }

  /** `setPlayers`' choice, each human seated at the present Device that said it sits there. */
  private seated(chosen: readonly Player[], here: ReadonlyMap<DeviceId, unknown>): Player[] {
    const at = new Map<PlayerId, DeviceId>();
    for (const [deviceId, playerId] of this.seatIds) if (here.has(deviceId)) at.set(playerId, deviceId);
    return chosen.map((p) => {
      const deviceId = p.bot ? undefined : at.get(p.playerId);
      return deviceId === undefined ? p : { ...p, deviceId };
    });
  }

  /** Sends the state to every Peer when it changed, else only to Peers that were not there last time. */
  private publish(s: Shown, present: readonly RosterEntry[]): void {
    const msg: StateMessage = { t: 'state', layout: s.layout ?? null, players: s.players, controllers: s.controllers, seats: s.seats, match: s.match ?? null, game: s.game ?? null };
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
    if (!game.bots && this.players.some((p) => p.bot)) return `${game.name} does not support bots`;
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

/** Mirrors the Host's lobby; tells the Host who sits here on every `ready`, a re-attach's included. */
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

  setGame(): void {}
  setTemplate(): void {}
  setRole(): void {}
  setOrder(): void {}
  move(): void {}
  setBot(): void {}
  setPlayers(): void {}
  start(): MatchInfo {
    throw new Error('Only the Host starts a Match');
  }
  startAgain(): MatchInfo {
    throw new Error('Only the Host starts a Match');
  }
  close(): void {}

  private follow(): void {
    const was = this.status;
    this.status = this.session.status;
    if (this.status === was) return;
    if (this.status === 'ready') this.session.send(LOBBY_CHANNEL, { t: 'seat', playerId: this.playerId } satisfies SeatMessage);
    // No Host: none yet, or closed. `reconnecting` keeps what the Host said, for a Match riding it out (`rejoin.ts`).
    if (this.status === 'searching') this.show({ layout: undefined, players: [], controllers: [], seats: 'ends', match: undefined, game: undefined });
  }
}

function defaultName(index: number): string {
  return `Player ${index + 1}`;
}

/** A bot Player's id: one per slot, the same in every Match. */
function botId(slot: number): PlayerId {
  return `bot:${slot}`;
}

/** Each slot's Tile Device: the first and the last Tile; with one Tile, slot 1 has none. */
function slotTiles(layout: Layout | undefined): (DeviceId | undefined)[] {
  const tiles = layout?.devices ?? [];
  return [tiles[0]?.id, tiles.length > 1 ? tiles[tiles.length - 1]!.id : undefined];
}

/** Who plays in each slot, read off `players`: the slot's bot, else the human seated at its Tile. */
function slotsOf(layout: Layout | undefined, players: readonly Player[]): Slot[] {
  return slotTiles(layout).map((deviceId, slot) => ({
    deviceId,
    player: players.find((p) => p.bot && p.playerId === botId(slot)) ?? players.find((p) => !p.bot && deviceId !== undefined && p.deviceId === deviceId),
  }));
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

// Everything below reads untrusted data (off the network, or a saved lobby) into fresh objects.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isSeats = (v: unknown): v is Seats => v === 'ends' || v === 'tiles' || v === 'controllers';

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
  const controllers = all(d['controllers'], (x) => (isStr(x) ? x : undefined));
  const seats = isSeats(d['seats']) ? d['seats'] : undefined;
  const match = d['match'] === null ? null : readMatch(d['match']);
  const game = d['game'] === null ? null : isStr(d['game']) ? d['game'] : undefined;
  if (layout === undefined || !players || !controllers || !seats || match === undefined || game === undefined) return undefined;
  return {
    layout: layout ?? undefined,
    players,
    controllers,
    seats,
    match: match ?? undefined,
    game: game ?? undefined,
  };
}

/** A human, seated at `deviceId` or not, or a bot: `bot: true` and never a `deviceId`. */
function readPlayer(v: unknown): Player | undefined {
  if (!isObj(v)) return undefined;
  const { playerId, name, deviceId, bot } = v;
  if (!isStr(playerId) || !isStr(name)) return undefined;
  if (bot === true) return deviceId === undefined ? { playerId, name, bot } : undefined;
  if (bot !== undefined) return undefined;
  if (deviceId === undefined) return { playerId, name };
  return isStr(deviceId) ? { playerId, name, deviceId } : undefined;
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

/** A `SavedLobby`; undefined when it is not one (another build wrote it). A Game id that is not a string is left out. */
function readSaved(v: unknown): SavedLobby | undefined {
  if (!isObj(v)) return undefined;
  const { template: t, order: o, roles: r, game, seats, bots: b } = v;
  const template = TEMPLATE_IDS.find((id) => id === t);
  const order = all(o, (x) => (isStr(x) ? x : undefined));
  const bots = all(b, (x) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < SLOTS ? x : undefined));
  if (!isObj(r)) return undefined;
  const roles: [DeviceId, Role][] = [];
  for (const [id, role] of Object.entries(r)) {
    if (role !== 'tile' && role !== 'controller') return undefined;
    roles.push([id, role]);
  }
  if (!template || !order || !bots || !isSeats(seats)) return undefined;
  return { template, order, roles: Object.fromEntries(roles), game: isStr(game) ? game : undefined, seats, bots };
}
