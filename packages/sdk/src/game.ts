import type { Rect, Surface, Vec2 } from '@mgc/layout';
import type { DeviceId, JsonValue, Manifest, MatchInfo, MatchResult, Tile } from './types';

/**
 * A Game is two factories. `host` runs once, on the Host Device; `view` runs
 * once per Device, the Host included. Each factory is the init: it receives
 * its context and returns its handlers, which run only after it returned.
 * `S` is the published state, `M` the view→host message type.
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
   */
  publish(state: S, to?: DeviceId): void;
  /** Ends the Match on every Device with `result`. */
  end(result: MatchResult): void;
}

export interface HostHandlers<M extends JsonValue> {
  /** Fixed step: `dt = 1 / tickHz` seconds, `now` the shared time of this step. Absent or `tickHz` 0 → never called. */
  tick?(dt: number, now: number): void;
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
}

export interface ViewHandlers<S extends JsonValue, M extends JsonValue> {
  /** Called on every animation frame with the SDK-owned canvas; see `Frame`. */
  draw?(f: Frame<S>): void;
  onState?(state: S, t: number): void;
  dispose?(): void;
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
