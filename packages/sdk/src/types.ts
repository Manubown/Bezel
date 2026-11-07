import type { Rect, Vec2 } from '@mgc/layout';

/**
 * Data shared by games and the platform. Everything that crosses the seam is
 * `JsonValue`; lengths are world millimetres, times are shared-clock
 * milliseconds, `dt` is seconds.
 */

export type DeviceId = string;
export type PlayerId = string;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

/** A Device's rectangle on the play surface; `rot` radians, clockwise about (x, y). */
export interface Tile extends Rect {
  deviceId: DeviceId;
  rot: number;
}

/** A participant in the Match: a human, or (`bot`) one the Game's host plays itself. */
export interface Player {
  playerId: PlayerId;
  name: string;
  /** The Device that seats this Player (Pong: one of the outer Tiles). Never set on a bot. */
  deviceId?: DeviceId;
  /** Set on a bot Player: no Device; the host game plays it. Only in a Match of a Game whose manifest has `bots`. */
  bot?: true;
}

export interface Device {
  deviceId: DeviceId;
  role: 'tile' | 'controller';
  name: string;
  /** Present iff `role === 'tile'`. */
  tile?: Tile;
  /** This Device's own screen size. */
  screenMm: Vec2;
}

/** Frozen for the Match (no mid-Match joins); identical on every Device. */
export interface MatchInfo {
  matchId: string;
  seed: number;
  tickHz: number;
  players: readonly Player[];
  devices: readonly Device[];
  /** Layout order; Tile Devices only. */
  tiles: readonly Tile[];
  /** Layout bounds. */
  bounds: Rect;
}

export interface MatchResult {
  scores?: Record<PlayerId, number>;
  ranking?: PlayerId[];
}

/** Who produced an input or a message, stamped by the host runtime from the channel it arrived on. */
export interface Sender {
  deviceId: DeviceId;
  role: 'tile' | 'controller';
  /** The Controller's Holder, when it has one. */
  playerId?: PlayerId;
}

/** One pointer sample. Per `(deviceId, pointerId)` the host sees `down → move* → (up | cancel)`. */
export interface Input extends Sender {
  pointerId: number;
  phase: 'down' | 'move' | 'up' | 'cancel';
  /** Shared clock at capture, ms. Not monotone across Devices. */
  t: number;
  /** Tile: world mm. Controller: its own screen mm, origin top-left. */
  world: Vec2;
}

/** An input as a view sends it: the host runtime stamps who sent it. */
export type RawInput = Omit<Input, 'deviceId' | 'role' | 'playerId'>;

/** Who holds a Controller: one entry per Controller Device of the Match; `null` while nobody does. */
export interface HolderEntry {
  deviceId: DeviceId;
  playerId: PlayerId | null;
}

export type PauseReason = { kind: 'device-lost'; deviceId: DeviceId } | { kind: 'platform'; note?: string };

export type CloseReason = 'ended' | 'aborted' | 'version' | 'protocol' | 'fault' | 'link-lost';

export interface Range {
  min: number;
  max: number;
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  tiles: Range;
  controllers: Range;
  players: Range;
  templates?: ('row' | 'column' | 'grid')[];
  minTileMm?: { w: number; h: number };
  /** Default false; true: the Host may make a Player slot a bot, and the host game plays every `Player.bot`. */
  bots?: boolean;
  /** Default 60; 0 = event-driven host, no tick. */
  tickHz?: number;
  /** Bundle entry paths; may be the same file. */
  host: string;
  view: string;
}
