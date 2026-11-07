import type { Rect, Surface, Vec2 } from '@mgc/layout';
import type { CloseReason, DeviceId, Input, JsonValue, Manifest, MatchInfo, MatchResult, PauseReason, Tile } from './types';

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
   * Ends the Match on every Device with `result`. Afterwards only `dispose`
   * still runs. Nothing published after it reaches a view: a `publish` or a
   * second `end` made in the same turn is rejected with a log line on the
   * Host, and once the Match has closed they are dropped.
   */
  end(result: MatchResult): void;
  /** Reaches the Host platform's console and HUD: JSON values as they are, anything else as text. Never throws. */
  log(...args: unknown[]): void;
}

export interface HostHandlers<M extends JsonValue> {
  /**
   * Fixed step: `dt = 1 / tickHz` seconds, `now` the shared time of this step.
   * Absent or `tickHz` 0 → never called. Never called while paused; after a
   * resume, steps restart at the resume's `now`.
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
  /** The Match paused: no `tick` and no input until `onResume`. Called again if the reason changes while paused. */
  onPause?(reason: PauseReason): void;
  /** The Match resumed at shared time `now`; a game that publishes only on change re-publishes here. */
  onResume?(now: number): void;
  dispose?(): void;
}

export interface ViewContext<S extends JsonValue, M extends JsonValue> {
  readonly match: MatchInfo;
  readonly deviceId: DeviceId;
  readonly role: 'tile' | 'controller';
  /** Tile Devices only. */
  readonly tile?: Tile;
  readonly surface?: Surface;
  readonly screenMm: Vec2;
  readonly dpr: number;
  /** SDK-owned element the view may fill (DOM UIs). */
  readonly root: HTMLElement;
  /** Shared clock, ms. */
  now(): number;
  /** Last applied state and its host time. */
  latest(): { state: S; t: number } | undefined;
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
  onState?(state: S, t: number): void;
  /** This Device's own input, as it leaves for the host: local echo for prediction. */
  onInput?(i: Input): void;
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
