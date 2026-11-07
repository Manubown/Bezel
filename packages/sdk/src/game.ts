import type { Rect, Surface, Vec2 } from '@mgc/layout';
import type { CloseReason, DeviceId, Input, JsonValue, Manifest, MatchInfo, MatchResult, PauseReason, PlayerId, Sender, Tile } from './types';

/**
 * A Game is two factories. `host` runs once, on the Host Device; `view` runs
 * once per Device, the Host included. Each factory is the init: it receives
 * its context and returns its handlers, which run only after it returned.
 * `S` is the published state, `M` the view→host message type.
 *
 * Faults: a handler that throws is reported to the platform (a `fault` event
 * on that Device) and the Game goes on; more than three in five seconds close
 * that side. A factory that throws closes its side at once: the host's closes
 * the Match, a view's only that view. A throw in `draw` skips the frame; ten
 * frames in a row close that view.
 */
export interface GameSpec<S extends JsonValue, M extends JsonValue> {
  manifest: Manifest;
  host(ctx: HostContext<S, M>): HostHandlers<M>;
  view(ctx: ViewContext<S, M>): ViewHandlers<S, M>;
}

/** What `defineGame` returns and a game module exports as `default`. */
export type Game = GameSpec<JsonValue, JsonValue>;

export function defineGame<S extends JsonValue, M extends JsonValue>(spec: GameSpec<S, M>): Game {
  return spec;
}

export interface HostContext<S extends JsonValue, M extends JsonValue> {
  readonly match: MatchInfo;
  /** Shared clock, ms. */
  now(): number;
  /**
   * Broadcast `state` to every view, or to Device `to` alone. Never coalesced:
   * one call, one wire frame. Throws a `TypeError` here if `state` is not plain
   * JSON. Stamped with the current tick's `now` inside `tick`, else `now()`.
   * While the Match is paused it is retained, and the views get the last one
   * (broadcast and per Device) on resume.
   */
  publish(state: S, to?: DeviceId): void;
  /**
   * Hands Controller `controller` to Player `playerId` (`null`: nobody holds
   * it). The platform tells the host game (`onHolder`) and every view, and
   * stamps every input and message from that Controller with its Holder from
   * then on. A Device that is not a Controller or a Player not in the Match is
   * refused (a log line on the Host) and changes nothing.
   */
  setHolder(controller: DeviceId, playerId: PlayerId | null): void;
  /** Who holds `controller` as of the last accepted `setHolder` (at once, before `onHolder`); `null` for nobody or a Tile. */
  holderOf(controller: DeviceId): PlayerId | null;
  /**
   * Calls `onTimer(tag, now)` `delayMs` from now, replacing the timer with the
   * same tag; `null` cancels it. Paused time does not count: a pause freezes
   * the remaining delay until the resume. A delay that is not a finite
   * number ≥ 0 is refused with a log line on the Host.
   */
  timer(tag: string, delayMs: number | null): void;
  /**
   * Ends the Match on every Device with `result`. Afterwards only `dispose`
   * still runs. Nothing published after it reaches a view: a `publish`, a
   * second `end`, a `setHolder` or a `timer` made in the same turn is
   * rejected with a log line on the Host, and once the Match has closed they
   * are dropped.
   */
  end(result: MatchResult): void;
  /** Reaches the Host platform's console and HUD: JSON values as they are, anything else as text. Never throws. */
  log(...args: unknown[]): void;
}

export interface HostHandlers<M extends JsonValue> {
  /**
   * Fixed step: `dt = 1 / tickHz` seconds, `now` the shared time of this step.
   * Never called while paused; after a resume, steps restart at the resume's
   * `now`. Without `tick`, or with `tickHz` 0, the host is event-driven: no
   * steps at all, and every input, message and timer is handed over as it
   * arrives.
   */
  tick?(dt: number, now: number): void;
  /**
   * Every input in arrival order, before the `tick` of the step it arrived for
   * (at once when there is no tick). `deviceId`/`role` are stamped by the
   * platform from the channel it arrived on; per Device and pointer the phases
   * run `down → move* → (up | cancel)`. A pause cancels every open pointer
   * (a `cancel` before `onPause`); input sent while paused never arrives.
   */
  onInput?(i: Input): void;
  /**
   * A view's `send(msg)`, in arrival order with input (before the step's
   * `tick`). `from` is stamped like an input's: the sending Device, and the
   * Controller's Holder when it was received. Sent while paused: dropped.
   */
  onMessage?(msg: M, from: Sender): void;
  /**
   * `controller`'s Holder changed (an accepted `setHolder`). Everything that
   * arrived before the change came first, stamped with the previous Holder;
   * everything after it carries the new one.
   */
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;
  /** Timer `tag` elapsed; `now` is the shared time it was due (paused time not counted). */
  onTimer?(tag: string, now: number): void;
  /** The Match paused: no `tick`, input, message or timer until `onResume`. Called again if the reason changes while paused. */
  onPause?(reason: PauseReason): void;
  /** The Match resumed at shared time `now`; a game that publishes only on change re-publishes here. */
  onResume?(now: number): void;
  dispose?(): void;
}

export interface ViewContext<S extends JsonValue, M extends JsonValue> {
  readonly match: MatchInfo;
  readonly deviceId: DeviceId;
  readonly role: 'tile' | 'controller';
  /** Tile Devices only: a Controller is not part of the Layout. */
  readonly tile?: Tile;
  readonly surface?: Surface;
  /** This Device's own screen, mm; a Controller's input and `draw` use it (origin top-left). */
  readonly screenMm: Vec2;
  readonly dpr: number;
  /** SDK-owned element the view may fill (DOM UIs); `mount` is handed the same element. */
  readonly root: HTMLElement;
  /** Shared clock, ms. */
  now(): number;
  /** Last applied state and its host time. */
  latest(): { state: S; t: number } | undefined;
  /** Who holds Controller `controller` (default: this Device), as the platform last said; `null` for nobody or a Tile. */
  holder(controller?: DeviceId): PlayerId | null;
  /**
   * For the host game's `onMessage`, stamped there with this Device (and, on a
   * Controller, its Holder). Throws a `TypeError` here if `msg` is not plain
   * JSON. Sent while the Match is paused: dropped by the host.
   */
  send(msg: M): void;
  /** Reaches this Device's platform console (and the HUD on the Host): JSON values as they are, anything else as text. Never throws. */
  log(...args: unknown[]): void;
}

export interface ViewHandlers<S extends JsonValue, M extends JsonValue> {
  /**
   * Called on every animation frame with the SDK-owned canvas, except while
   * paused or while the page is hidden; see `Frame`. A throw skips that frame;
   * ten in a row close this view.
   */
  draw?(f: Frame<S>): void;
  /**
   * The DOM alternative to `draw` (both may be used: the canvas lies below):
   * called once, right after the factory, with the view's `root` to fill. A
   * DOM view that handles its own events sets `input: 'off'`.
   */
  mount?(root: HTMLElement): void;
  onState?(state: S, t: number): void;
  /** This Device's own input, as it leaves for the host: local echo for prediction (`playerId`: this Controller's Holder). */
  onInput?(i: Input): void;
  /**
   * Controller `controller`'s Holder changed; every view hears of every
   * Controller, a Controller's own view checks `controller === ctx.deviceId`.
   * The host game heard first; input stamped with the new Holder reaches it
   * only after this.
   */
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;
  /** The Match paused: `draw` stops (the canvas keeps its last frame) until `onResume`. Again if the reason changes. */
  onPause?(reason: PauseReason): void;
  /**
   * The Match resumed at shared time `now`. The host's retained states arrived
   * just before (so `latest()` is current); states older than `now` describe
   * the moment of the pause, so extrapolate from `max(t, now)`. A view that
   * started while the Match was paused gets it without an `onPause`.
   */
  onResume?(now: number): void;
  /** The Match closed: `result` when the host ended it. `dispose` follows. */
  onEnd?(r: { reason: CloseReason; result?: MatchResult }): void;
  dispose?(): void;
  /**
   * `'coalesced'` (default): the SDK captures pointers on the view's root
   * (`touch-action: none`, pointer capture), maps px to mm, and sends at most
   * one move per pointer per animation frame. `'off'`: no capture; a DOM view
   * handles its own events.
   */
  input?: 'coalesced' | 'off';
}

export interface Frame<S extends JsonValue> {
  /** Cleared; transformed so 1 unit = 1 mm (world mm on a Tile, screen mm on a Controller). */
  ctx: CanvasRenderingContext2D;
  now: number;
  state: S | undefined;
  /** Host time of `state` (`now` before the first state); extrapolate with `now - t`. */
  t: number;
  bounds: Rect;
  tile?: Tile;
  screenMm: Vec2;
}
