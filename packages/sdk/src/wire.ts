import type { CloseReason, Device, DeviceId, Input, JsonValue, MatchInfo, MatchResult, PauseReason, RawInput } from './types';

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
  | { v: 1; t: 'clock'; clock: ClockWire }
  /** `now`: shared time of the pause. Sent again with the new reason when the reason changes while paused. */
  | { v: 1; t: 'pause'; reason: PauseReason; now: number }
  /** `now`: shared time of the resume, where ticks restart; `clock` re-anchors the game side's clock. */
  | { v: 1; t: 'resume'; now: number; clock: ClockWire }
  /** `detail`: why, in words, for the platform's overlay; games see only `reason` and `result`. */
  | { v: 1; t: 'close'; reason: CloseReason; detail?: string; result?: MatchResult };

export type HostDown =
  | Shared
  | { v: 1; t: 'init'; side: 'host'; match: MatchInfo; clock: ClockWire }
  /** `n` strictly +1; `now` non-decreasing. */
  | { v: 1; t: 'tick'; n: number; dt: number; now: number }
  /** Stamped by the host runtime; in arrival order, so ordered per Device. */
  | { v: 1; t: 'input'; inputs: Input[] }
  /** The host runtime refused a request; nothing changed. It also reports a `log` line to the platform. */
  | { v: 1; t: 'reject'; of: RejectOf; reason: string };

/** What a `reject` refuses: the host Up frame it answers. */
export type RejectOf = 'publish' | 'set-holder' | 'timer' | 'end';

export type ViewDown =
  | Shared
  | { v: 1; t: 'init'; side: 'view'; match: MatchInfo; self: Omit<Device, 'name'> & { pxPerMm: number }; clock: ClockWire }
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
  | { v: 1; t: 'publish'; state: JsonValue; to?: DeviceId; at: number }
  | { v: 1; t: 'end'; result: MatchResult };

export type ViewUp =
  | Fault
  | Log
  | { v: number; t: 'ready'; side: 'view'; sdk: string }
  /** One per view per animation frame at most; moves coalesced to one per pointer. */
  | { v: 1; t: 'input'; inputs: RawInput[] };

export type Down = HostDown | ViewDown;
export type Up = HostUp | ViewUp;

/** Between Devices over the platform Transport: the subset of the view grammar that is not local. */
export type NetDown = Extract<ViewDown, { t: 'state' | 'pause' | 'resume' | 'close' }>;
export type NetUp = Extract<ViewUp, { t: 'input' | 'send' }>;
export type NetFrame = NetDown | NetUp;

const CLOSE_REASONS: readonly string[] = ['ended', 'aborted', 'version', 'protocol', 'fault', 'link-lost'] satisfies CloseReason[];

/** Frames from the network are untrusted until they pass this check. */
export function isNetDown(f: unknown): f is NetDown {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  if (r['v'] !== WIRE_VERSION) return false;
  if (r['t'] === 'state') return 'state' in r && typeof r['at'] === 'number' && (r['to'] === undefined || typeof r['to'] === 'string');
  if (r['t'] === 'pause') return Number.isFinite(r['now']) && isPauseReason(r['reason']);
  if (r['t'] === 'resume') return Number.isFinite(r['now']) && isClockWire(r['clock']);
  if (r['t'] === 'close') {
    return typeof r['reason'] === 'string' && CLOSE_REASONS.includes(r['reason']) && (r['detail'] === undefined || typeof r['detail'] === 'string');
  }
  return false;
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
  return r['v'] === WIRE_VERSION && r['t'] === 'input' && Array.isArray(r['inputs']) && r['inputs'].every(isRawInput);
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
