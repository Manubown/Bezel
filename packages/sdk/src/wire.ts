import { isJson } from './json';
import type {
  CloseReason,
  Device,
  DeviceId,
  HolderEntry,
  Input,
  JsonValue,
  MatchInfo,
  MatchResult,
  PauseReason,
  PlayerId,
  RawInput,
  Sender,
} from './types';

/**
 * The link between a game and the platform. Each side of a Match (host game,
 * view game) gets its own link from a `LinkFactory`; every adapter clones every
 * frame in both directions, so a game that works in-process also works in an
 * iframe.
 */
export interface Link {
  post(f: Down): void;
  onFrame(h: (f: Up) => void): () => void;
  close(): void;
}

export type LinkFactory = (o: { side: 'host' | 'view'; root?: HTMLElement }) => Promise<Link>;

export const WIRE_VERSION = 1;

/** `epochOffset = shared.now() − Date.now()` at send; `sentAt` is the shared time at send. */
export interface ClockWire {
  epochOffset: number;
  sentAt: number;
}

/** In both Down unions. */
export type Shared =
  /** Every Controller's Holder, after the host game changed one. */
  | { v: 1; t: 'holders'; holders: HolderEntry[] }
  | { v: 1; t: 'clock'; clock: ClockWire }
  /** `now`: shared time of the pause. Sent again with the new reason when the reason changes while paused. */
  | { v: 1; t: 'pause'; reason: PauseReason; now: number }
  /**
   * `now`: shared time of the resume, where ticks restart; `clock` re-anchors
   * the game side's clock; `pausedMs`: how long the Match stood still on the
   * shared clock, from the first `pause` (`now − pause.now`, ≥ 0).
   */
  | { v: 1; t: 'resume'; now: number; clock: ClockWire; pausedMs: number }
  /** `detail`: why, in words, for the platform's overlay; games see only `reason` and `result`. */
  | { v: 1; t: 'close'; reason: CloseReason; detail?: string; result?: MatchResult };

export type HostDown =
  | Shared
  | { v: 1; t: 'init'; side: 'host'; match: MatchInfo; holders: HolderEntry[]; clock: ClockWire }
  /** `n` strictly +1; `now` non-decreasing. */
  | { v: 1; t: 'tick'; n: number; dt: number; now: number }
  /** Stamped by the host runtime; in arrival order, so ordered per Device. */
  | { v: 1; t: 'input'; inputs: Input[] }
  /** A view's `send`, stamped by the host runtime like input. */
  | { v: 1; t: 'msg'; msg: JsonValue; from: Sender }
  /** A timer the host game set elapsed; `now` is the shared time it was due. */
  | { v: 1; t: 'timer'; tag: string; now: number }
  /** The host runtime refused a request; nothing changed. It also reports a `log` line to the platform. */
  | { v: 1; t: 'reject'; of: RejectOf; reason: string };

/** What a `reject` refuses: the host Up frame it answers. */
export type RejectOf = 'publish' | 'set-holder' | 'timer' | 'end';

export type ViewDown =
  | Shared
  | { v: 1; t: 'init'; side: 'view'; match: MatchInfo; self: Omit<Device, 'name'> & { pxPerMm: number }; holders: HolderEntry[]; clock: ClockWire }
  /** `at` is the host time of `state`; `to` is set when the state was published to this Device alone. */
  | { v: 1; t: 'state'; state: JsonValue; at: number; to?: DeviceId };

/**
 * A game handler threw; `where` is `side.handler`. `fatal`: the game side
 * cannot go on (its factory threw, or `draw` threw on 10 frames in a row) and
 * the platform closes that link.
 */
export type Fault = { v: 1; t: 'fault'; where: string; message: string; stack?: string; fatal?: true };

/** `ctx.log(...)`: each argument as JSON where it is JSON, else as text. */
export type Log = { v: 1; t: 'log'; args: JsonValue[] };

export type HostUp =
  | Fault
  | Log
  /** The first frame on any link; `v` is whatever the game speaks. */
  | { v: number; t: 'ready'; side: 'host'; sdk: string }
  /** Once, right after the host factory returned: without `tick` the platform runs the host event-driven. */
  | { v: 1; t: 'handlers'; tick: boolean }
  | { v: 1; t: 'publish'; state: JsonValue; to?: DeviceId; at: number }
  | { v: 1; t: 'set-holder'; deviceId: DeviceId; playerId: PlayerId | null }
  /** Arms timer `tag` (replacing one with the same tag), or cancels it with `null`. */
  | { v: 1; t: 'timer'; tag: string; delayMs: number | null }
  | { v: 1; t: 'end'; result: MatchResult };

export type ViewUp =
  | Fault
  | Log
  | { v: number; t: 'ready'; side: 'view'; sdk: string }
  /** One per view per animation frame at most; moves coalesced to one per pointer. */
  | { v: 1; t: 'input'; inputs: RawInput[] }
  /** `ctx.send(msg)`: for the host game's `onMessage`. */
  | { v: 1; t: 'send'; msg: JsonValue }
  /**
   * A Peer runtime asks the Host for the current picture: Holders, its
   * retained states, the pause. Sent when its view link opens and on
   * `MatchHandle.hello()`; the Host answers that Device alone.
   */
  | { v: 1; t: 'hello' };

export type Down = HostDown | ViewDown;
export type Up = HostUp | ViewUp;

/** Between Devices over the platform Transport: the subset of the view grammar that is not local. */
export type NetDown = Extract<ViewDown, { t: 'state' | 'holders' | 'pause' | 'resume' | 'close' }>;
export type NetUp = Extract<ViewUp, { t: 'input' | 'send' | 'hello' }>;
export type NetFrame = NetDown | NetUp;

const CLOSE_REASONS: readonly string[] = ['ended', 'aborted', 'version', 'protocol', 'fault', 'link-lost'] satisfies CloseReason[];

/** Frames from the network are untrusted until they pass this check. */
export function isNetDown(f: unknown): f is NetDown {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  if (r['v'] !== WIRE_VERSION) return false;
  if (r['t'] === 'state') return 'state' in r && typeof r['at'] === 'number' && (r['to'] === undefined || typeof r['to'] === 'string');
  if (r['t'] === 'holders') return Array.isArray(r['holders']) && r['holders'].every(isHolderEntry);
  if (r['t'] === 'pause') return Number.isFinite(r['now']) && isPauseReason(r['reason']);
  if (r['t'] === 'resume') return Number.isFinite(r['now']) && isClockWire(r['clock']) && Number.isFinite(r['pausedMs']) && (r['pausedMs'] as number) >= 0;
  if (r['t'] === 'close') {
    return typeof r['reason'] === 'string' && CLOSE_REASONS.includes(r['reason']) && (r['detail'] === undefined || typeof r['detail'] === 'string');
  }
  return false;
}

function isHolderEntry(e: unknown): e is HolderEntry {
  if (!e || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return typeof r['deviceId'] === 'string' && (r['playerId'] === null || typeof r['playerId'] === 'string');
}

function isPauseReason(p: unknown): p is PauseReason {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  if (r['kind'] === 'device-lost') return typeof r['deviceId'] === 'string';
  return r['kind'] === 'platform' && (r['note'] === undefined || typeof r['note'] === 'string');
}

function isClockWire(c: unknown): c is ClockWire {
  if (!c || typeof c !== 'object') return false;
  const r = c as Record<string, unknown>;
  return Number.isFinite(r['epochOffset']) && Number.isFinite(r['sentAt']);
}

const PHASES: readonly string[] = ['down', 'move', 'up', 'cancel'] satisfies Input['phase'][];

/** Frames from the network are untrusted until they pass this check. */
export function isNetUp(f: unknown): f is NetUp {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  if (r['v'] !== WIRE_VERSION) return false;
  if (r['t'] === 'input') return Array.isArray(r['inputs']) && r['inputs'].every(isRawInput);
  if (r['t'] === 'hello') return true;
  return r['t'] === 'send' && isJson(r['msg']);
}

/** True if `i` is a well-formed input from a view, whatever else it carries. */
export function isRawInput(i: unknown): i is RawInput {
  if (!i || typeof i !== 'object') return false;
  const r = i as Record<string, unknown>;
  const w = r['world'] as Record<string, unknown> | null | undefined;
  return (
    Number.isFinite(r['pointerId']) &&
    typeof r['phase'] === 'string' &&
    PHASES.includes(r['phase']) &&
    Number.isFinite(r['t']) &&
    typeof w === 'object' &&
    w !== null &&
    Number.isFinite(w['x']) &&
    Number.isFinite(w['y'])
  );
}

/** True if `f` is a `fault` or `log` frame with the fields its type promises (a game side's frames are checked like the net's). */
export function isReport(f: Up): f is Fault | Log {
  const r = f as unknown as Record<string, unknown>;
  if (r['t'] === 'log') return Array.isArray(r['args']);
  return (
    r['t'] === 'fault' &&
    typeof r['where'] === 'string' &&
    typeof r['message'] === 'string' &&
    (r['stack'] === undefined || typeof r['stack'] === 'string') &&
    (r['fatal'] === undefined || r['fatal'] === true)
  );
}
