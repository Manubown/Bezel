import { REAL_ENV, type Env } from './env';
import { holderRefusal } from './holders';
import type { CloseReason, Device, DeviceId, HolderEntry, Input, JsonValue, MatchInfo, MatchResult, PauseReason, PlayerId, RawInput, Sender } from './types';
import {
  WIRE_VERSION,
  isNetDown,
  isNetUp,
  isReport,
  type ClockWire,
  type Down,
  type Link,
  type LinkFactory,
  type NetFrame,
  type NetUp,
  type RejectOf,
  type Up,
} from './wire';

export interface MatchOptions {
  link: LinkFactory;
  /** The lobby froze it; identical on every Device. */
  match: MatchInfo;
  /** `mount`: a positioned element the view fills; its window drives animation frames and gives the dpr. */
  self: { deviceId: DeviceId; pxPerMm: number; mount: HTMLElement };
  /** The shared clock (core `Session.clock.now`, bound). */
  now(): number;
  /**
   * Forwards `frame` over the platform Transport. On the Host, `to` omitted =
   * every other Device. A Peer's frames are all for the Host and carry no `to`:
   * the platform delivers them there.
   */
  send(frame: NetFrame, to?: DeviceId): void;
  onEvent(e: MatchEvent): void;
  /** True on the Host: also runs the host side of the Game. */
  authority?: boolean;
}

/** Nothing a game does throws out of these: its errors arrive as `MatchEvent`s. */
export interface MatchHandle {
  /** Frames arriving off the Transport; `from` is the Device whose channel carried it. */
  deliver(frame: NetFrame, from: DeviceId): void;
  /**
   * Host only; a no-op on a Peer. A reason pauses the Match on every Device:
   * no ticks and no `draw`, open pointers cancelled, input and messages
   * dropped until the resume, timers frozen, `publish` retained. Another
   * reason while paused is passed on to every Device. `null` resumes: every
   * view gets the retained states, then `resume`, and ticks and timers run on
   * from the resume's time.
   */
  setPaused(reason: PauseReason | null): void;
  /** Closes this Device's part; on the Host, the Match on every Device. */
  stop(reason: 'aborted' | 'link-lost'): void;
}

export type MatchEvent =
  /** Every link this Device opens is open (on the Host, or its own view already closed). */
  | { t: 'started' }
  /** Again when the reason changes while paused. */
  | { t: 'paused'; reason: PauseReason }
  | { t: 'resumed' }
  /** A Controller changed hands; every Controller's Holder (on a Peer, as the Host said). */
  | { t: 'holders'; holders: HolderEntry[] }
  | { t: 'ended'; result: MatchResult }
  /** This Device's part of the Match is over; nothing follows it. `detail` says why in words. */
  | { t: 'closed'; reason: CloseReason; detail: string }
  /**
   * Host only: its own view closed on its own (its game side faulted, spoke
   * the wrong version or protocol, or never became ready). The Match goes on.
   * On a Peer the view is its whole part, so the same failure is `closed`.
   */
  | { t: 'view-closed'; reason: CloseReason; detail: string }
  /** A game handler on this Device threw; `where` is `side.handler`. */
  | { t: 'fault'; where: string; message: string; stack?: string }
  /** `ctx.log(...)` on this Device's host game or view, or the host runtime refusing a host game's request. */
  | { t: 'log'; side: 'host' | 'view'; args: JsonValue[] };

/** Catch-up steps per animation frame before the rest of a stall is dropped. */
export const MAX_CATCH_UP_STEPS = 5;
/** Cadence of `clock` frames to the local game sides. */
export const CLOCK_EVERY_MS = 2000;
/** A link whose game has not said `ready` this long after it was opened is lost. */
export const READY_TIMEOUT_MS = 5000;
/** More than this many faults on one link within `FAULT_WINDOW_MS` close it. */
export const FAULT_LIMIT = 3;
export const FAULT_WINDOW_MS = 5000;

type StateFrame = Extract<Down, { t: 'state' }>;
type PauseFrame = Extract<Down, { t: 'pause' }>;
type CloseFrame = Extract<Down, { t: 'close' }>;
type HoldersFrame = Extract<Down, { t: 'holders' }>;

/** What waits for the host game, in arrival order: stamped input and messages, and timers that came due. */
type Inbound = { t: 'input'; input: Input } | { t: 'msg'; msg: JsonValue; from: Sender } | { t: 'timer'; tag: string; now: number };

const ENDED = 'the game ended the Match';
const STOPPED: Record<'aborted' | 'link-lost', string> = {
  aborted: 'stopped by the platform',
  'link-lost': 'the platform lost the connection',
};

/**
 * Runs one Device's part of a Match: its view on every Device, plus the host
 * side of the Game with `authority`. Both open through `o.link`, so the Host's
 * own Tile is an ordinary view whose frames are cloned like a Peer's. Frames
 * between Devices go through `o.send` / `deliver`; nothing here knows the
 * Transport. Only a misuse of `runMatch` itself throws (a Device that is not in
 * the Match, a mount outside a window).
 */
export function runMatch(o: MatchOptions): MatchHandle {
  return runMatchWith(o, REAL_ENV);
}

/** `runMatch` on `env`'s clocks and timers (the test harness's fake ones). */
export function runMatchWith(o: MatchOptions, env: Env): MatchHandle {
  const me = o.match.devices.find((d) => d.deviceId === o.self.deviceId);
  if (!me) throw new Error(`runMatch: Device ${o.self.deviceId} is not in Match ${o.match.matchId}`);
  const win = o.self.mount.ownerDocument.defaultView;
  if (!win) throw new Error('runMatch: mount is not in a window');
  const { pxPerMm } = o.self;
  /** The fixed step; 0 = an event-driven host, no ticks. */
  const dt = o.match.tickHz > 0 ? 1 / o.match.tickHz : 0;
  const dtMs = o.match.tickHz > 0 ? 1000 / o.match.tickHz : 0;

  let over = false;
  /** The host game sent `end`: the Match closes once the frames it posted in that turn are answered. */
  let ending = false;
  let opening = o.authority ? 2 : 1;
  const opened = (): void => {
    if (--opening === 0) o.onEvent({ t: 'started' });
  };
  const clockWire = (): ClockWire => {
    const shared = o.now();
    return { epochOffset: shared - env.wall(), sentAt: shared };
  };

  /** Set while the Match is paused: the frame that paused it, for a link that opens meanwhile. */
  let pausedBy: PauseFrame | undefined;

  // Retention: the last broadcast state and the last state for each Device
  // alone, in arrival order (a state replaces its key's entry and moves to the
  // end). A Peer holds its own two; the Host holds every Device's and re-posts
  // them on resume.
  const retained = new Map<DeviceId | undefined, StateFrame>();
  const retain = (f: StateFrame): void => {
    retained.delete(f.to);
    retained.set(f.to, f);
  };
  const retainedFor = (d: DeviceId): StateFrame[] => [...retained.values()].filter((f) => f.to === undefined || f.to === d);

  // Every Controller's Holder, nobody at first. On the Host the host game's
  // accepted `set-holder` changes it; a Peer follows the Host's `holders`. A
  // link that opens gets it in its `init`.
  const holders = new Map<DeviceId, PlayerId | null>(o.match.devices.filter((d) => d.role === 'controller').map((d) => [d.deviceId, null]));
  const holderList = (): HolderEntry[] => [...holders].map(([deviceId, playerId]) => ({ deviceId, playerId }));
  const holdersFrame = (): HoldersFrame => ({ v: 1, t: 'holders', holders: holderList() });

  // This Device's view. One that becomes ready late starts from the retained
  // states (and the pause, while paused). Its input and messages go to the
  // host runtime: here on the Host, over the net on a Peer, paused or not.
  let viewOpened = false;
  const view: GameLink = new GameLink('view', () => o.link({ side: 'view', root: o.self.mount }), env, {
    open() {
      const self = { deviceId: me.deviceId, role: me.role, screenMm: me.screenMm, pxPerMm, ...(me.tile && { tile: me.tile }) };
      view.post({ v: 1, t: 'init', side: 'view', match: o.match, self, holders: holderList(), clock: clockWire() });
      for (const f of retainedFor(me.deviceId)) view.post(f);
      if (pausedBy) view.post(pausedBy);
      viewOpened = true;
      opened();
    },
    frame(f) {
      if (!isNetUp(f)) failView('protocol', `view link: unexpected ${f.t}`);
      else if (o.authority) take(f, me.deviceId);
      else o.send(f);
    },
    report: (e) => o.onEvent(e),
    fail: (reason, detail) => failView(reason, detail),
  });
  const show = (f: StateFrame): void => {
    retain(f);
    view.post(f);
  };
  /** This Device's view and platform hear of a pause (again, if the reason changed). */
  const showPause = (f: PauseFrame): void => {
    pausedBy = f;
    view.post(f);
    o.onEvent({ t: 'paused', reason: f.reason });
  };
  /** A Peer: the Host's `holders`. Its view and platform hear of a change only. */
  const hearHolders = (list: readonly HolderEntry[]): void => {
    let changed = false;
    for (const { deviceId, playerId } of list) {
      if (!holders.has(deviceId) || holders.get(deviceId) === playerId) continue;
      holders.set(deviceId, playerId);
      changed = true;
    }
    if (!changed) return;
    view.post(holdersFrame());
    o.onEvent({ t: 'holders', holders: holderList() });
  };

  // Host ingest. Who sent an input or a message is the channel it came on,
  // never what it says, and a Controller's carries its Holder as of arrival;
  // per Device and pointer only `down → move* → (up | cancel)` passes.
  const roleOf = new Map(o.match.devices.map((d) => [d.deviceId, d.role]));
  const openPointers = new Map<DeviceId, Set<number>>();
  /** Waiting for the host game, in arrival order: until the next step, or (event-driven) handed over at once. */
  let inbox: Inbound[] = [];
  /** Per Device, the pointers the host game saw go down and not end, with their last input. */
  const held = new Map<DeviceId, Map<number, Input>>();
  /**
   * How the host game runs, once it said (right after its factory): `true`
   * on fixed steps, `false` event-driven (no `tick` handler, or `tickHz` 0).
   * Nothing reaches it before.
   */
  let ticking: boolean | undefined;
  const senderOf = (deviceId: DeviceId, role: Device['role']): Sender => {
    const playerId = holders.get(deviceId);
    return playerId == null ? { deviceId, role } : { deviceId, role, playerId };
  };
  /** Event-driven: what arrives is handed over at once. */
  const arrived = (): void => {
    if (ticking === false) drain();
  };
  const ingest = (raw: readonly RawInput[], from: DeviceId): void => {
    const role = roleOf.get(from);
    // Paused: dropped, so nothing sent meanwhile applies on resume.
    if (over || pausedBy || role === undefined) return;
    let pointers = openPointers.get(from);
    if (!pointers) openPointers.set(from, (pointers = new Set()));
    const sender = senderOf(from, role);
    for (const { pointerId, phase, t, world } of raw) {
      if (phase === 'down') {
        if (pointers.has(pointerId)) continue;
        pointers.add(pointerId);
      } else if (!pointers.has(pointerId)) continue;
      else if (phase !== 'move') pointers.delete(pointerId);
      inbox.push({ t: 'input', input: { ...sender, pointerId, phase, t, world: { x: world.x, y: world.y } } });
    }
    arrived();
  };
  const take = (f: NetUp, from: DeviceId): void => {
    if (f.t === 'input') return ingest(f.inputs, from);
    const role = roleOf.get(from);
    // Paused: dropped, like input.
    if (over || pausedBy || role === undefined) return;
    inbox.push({ t: 'msg', msg: f.msg, from: senderOf(from, role) });
    arrived();
  };
  /** Hands the inbox to the host game in arrival order: each run of input as one `input` frame, each message and timer as its own. */
  const drain = (): void => {
    if (ticking === undefined || inbox.length === 0) return;
    const due = inbox;
    inbox = [];
    let inputs: Input[] = [];
    const flush = (): void => {
      if (inputs.length > 0) host?.post({ v: 1, t: 'input', inputs });
      inputs = [];
    };
    for (const e of due) {
      if (e.t === 'input') {
        const i = e.input;
        let pointers = held.get(i.deviceId);
        if (!pointers) held.set(i.deviceId, (pointers = new Map()));
        if (i.phase === 'down' || i.phase === 'move') pointers.set(i.pointerId, i);
        else pointers.delete(i.pointerId);
        inputs.push(i);
        continue;
      }
      flush();
      host?.post(e.t === 'msg' ? { v: 1, t: 'msg', msg: e.msg, from: e.from } : { v: 1, t: 'timer', tag: e.tag, now: e.now });
    }
    flush();
  };
  /**
   * Drops the input not yet delivered and ends every pointer (of Device
   * `only`, if given): the host game gets a `cancel` at `t` (where the pointer
   * last was) for each one it holds open. Later samples of those pointers are
   * orphans until a new `down`.
   */
  const cancelPointers = (t: number, only?: DeviceId): void => {
    const ends = (d: DeviceId): boolean => only === undefined || d === only;
    inbox = inbox.filter((e) => e.t !== 'input' || !ends(e.input.deviceId));
    const cancels: Input[] = [];
    for (const [d, pointers] of held) {
      if (!ends(d)) continue;
      for (const i of pointers.values()) cancels.push({ ...i, phase: 'cancel', t, world: { ...i.world } });
      held.delete(d);
    }
    for (const d of openPointers.keys()) if (ends(d)) openPointers.delete(d);
    if (cancels.length > 0) host?.post({ v: 1, t: 'input', inputs: cancels });
  };

  // The host game's timers by tag: armed on `env` with the shared time they
  // are due, or, while paused, frozen with the delay they have left. One that
  // came due waits in the inbox like input.
  const armed = new Map<string, { due: number; stop: () => void }>();
  const frozen = new Map<string, number>();
  const arm = (tag: string, from: number, delayMs: number): void => {
    const due = from + delayMs;
    const stop = env.after(delayMs, () => {
      armed.delete(tag);
      inbox.push({ t: 'timer', tag, now: due });
      arrived();
    });
    armed.set(tag, { due, stop });
  };
  /** A host game's `timer`: the same tag replaces (whatever it had armed, frozen or due goes), `null` cancels. */
  const setTimer = (tag: unknown, delayMs: unknown): void => {
    if (ending) return reject('timer', 'the Match has ended');
    if (typeof tag !== 'string') return reject('timer', `a timer's tag is a string, not ${typeof tag}`);
    if (delayMs !== null && (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0)) {
      return reject('timer', `"${tag}" needs a delay of 0 ms or more, not ${String(delayMs)}`);
    }
    armed.get(tag)?.stop();
    armed.delete(tag);
    frozen.delete(tag);
    inbox = inbox.filter((e) => e.t !== 'timer' || e.tag !== tag);
    if (delayMs === null) return;
    // Set while paused: it starts counting at the resume.
    if (pausedBy) frozen.set(tag, delayMs);
    else arm(tag, o.now(), delayMs);
  };
  /** Pause: every armed timer stops with the delay it has left at `now`. */
  const freezeTimers = (now: number): void => {
    for (const [tag, { due, stop }] of armed) {
      stop();
      frozen.set(tag, Math.max(0, due - now));
    }
    armed.clear();
  };
  /** Resume: every frozen timer runs on from `now` with what it had left. */
  const thawTimers = (now: number): void => {
    for (const [tag, left] of frozen) arm(tag, now, left);
    frozen.clear();
  };

  // The host side: a fixed-step accumulator on this window's animation frames.
  let raf = 0;
  let n = 0;
  /** Shared time of the last step; steps are exactly `dtMs` apart until a stall is dropped. */
  let stepAt = 0;
  const advance = (): void => {
    if (over || pausedBy) return;
    raf = win.requestAnimationFrame(advance);
    const now = o.now();
    stepAt = Math.max(stepAt, now - MAX_CATCH_UP_STEPS * dtMs);
    while (stepAt + dtMs <= now) {
      stepAt += dtMs;
      drain();
      host?.post({ v: 1, t: 'tick', n: ++n, dt, now: stepAt });
    }
  };
  /** Steps from `at` on: a fresh accumulator, nothing to catch up. */
  const startStepping = (at: number): void => {
    stepAt = at;
    raf = win.requestAnimationFrame(advance);
  };
  const publish = (f: Extract<Up, { t: 'publish' }>): void => {
    const { state, at, to } = f;
    const frame: StateFrame = to === undefined ? { v: 1, t: 'state', state, at } : { v: 1, t: 'state', state, at, to };
    retain(frame);
    if (pausedBy) return; // the views get it on resume
    if (to === undefined || to === o.self.deviceId) view.post(frame);
    if (to !== o.self.deviceId) o.send(frame, to);
  };
  /**
   * A host game's `setHolder`, checked against the frozen roster. An accepted
   * change reaches the host game, this Device's view, every Peer and the
   * platform; what arrived before it is handed over first, stamped with the
   * previous Holder.
   */
  const setHolder = (controller: DeviceId, playerId: PlayerId | null): void => {
    if (ending) return reject('set-holder', 'the Match has ended');
    const refusal = holderRefusal(o.match, controller, playerId);
    if (refusal !== undefined) return reject('set-holder', refusal);
    if (holders.get(controller) === playerId) return;
    drain();
    holders.set(controller, playerId);
    const frame = holdersFrame();
    host?.post(frame);
    view.post(frame);
    o.send(frame);
    o.onEvent({ t: 'holders', holders: holderList() });
  };
  /** Refuses a host game's request: a `reject` to it and a log line to the platform; nothing else changes. */
  const reject = (of: RejectOf, reason: string): void => {
    host?.post({ v: 1, t: 'reject', of, reason });
    o.onEvent({ t: 'log', side: 'host', args: [`${of} rejected: ${reason}`] });
  };
  const host: GameLink | undefined = o.authority
    ? new GameLink('host', () => o.link({ side: 'host' }), env, {
        open() {
          host?.post({ v: 1, t: 'init', side: 'host', match: o.match, holders: holderList(), clock: clockWire() });
          if (pausedBy) host?.post(pausedBy);
          opened();
        },
        frame(f) {
          switch (f.t) {
            case 'handlers':
              if (ticking !== undefined) return close('protocol', 'host link: unexpected handlers');
              ticking = dt > 0 && f.tick === true;
              if (pausedBy) return; // the resume starts it
              if (ticking) startStepping(o.now());
              else drain();
              return;
            case 'publish':
              return ending ? reject('publish', 'the Match has ended') : publish(f);
            case 'set-holder':
              return setHolder(f.deviceId, f.playerId);
            case 'timer':
              return setTimer(f.tag, f.delayMs);
            case 'end': {
              if (ending) return reject('end', 'the Match has already ended');
              ending = true;
              const { result } = f;
              // What the host game posted after `end` in the same turn is answered (rejected) before the Match closes.
              queueMicrotask(() => close('ended', ENDED, result));
              return;
            }
            default:
              close('protocol', `host link: unexpected ${f.t}`);
          }
        },
        report: (e) => o.onEvent(e),
        fail: (reason, detail) => close(reason, detail),
      })
    : undefined;

  /**
   * Host: stops the steps, ends every pointer, hands over the messages and
   * timers that came before it, freezes the timers, and tells the host game,
   * every view and the net.
   */
  const pause = (reason: PauseReason): void => {
    if (pausedBy && samePause(pausedBy.reason, reason)) return;
    // A new reason while paused keeps the time the Match stopped.
    const frame: PauseFrame = { v: 1, t: 'pause', reason: copyReason(reason), now: pausedBy?.now ?? o.now() };
    if (!pausedBy) {
      win.cancelAnimationFrame(raf);
      cancelPointers(frame.now);
      drain();
      freezeTimers(frame.now);
    }
    host?.post(frame);
    o.send(frame);
    showPause(frame);
  };
  /**
   * Host: every view gets the retained states, then `resume` with a fresh
   * clock frame (the host game first, so its `onResume` publish follows them),
   * then timers and steps run on from now.
   */
  const resume = (): void => {
    if (!pausedBy) return;
    pausedBy = undefined;
    const clock = clockWire();
    const frame: Extract<Down, { t: 'resume' }> = { v: 1, t: 'resume', now: clock.sentAt, clock };
    host?.post(frame);
    // A Peer back as a new page knows no Holder yet.
    if ([...holders.values()].some((p) => p !== null)) o.send(holdersFrame());
    for (const d of o.match.devices) {
      if (d.deviceId === me.deviceId) for (const f of retainedFor(d.deviceId)) view.post(f);
      else for (const f of retainedFor(d.deviceId)) o.send(f, d.deviceId);
    }
    view.post(frame);
    o.send(frame);
    o.onEvent({ t: 'resumed' });
    thawTimers(frame.now);
    if (ticking) startStepping(frame.now);
    else drain();
  };

  const stopClock = env.every(CLOCK_EVERY_MS, () => {
    const clock = clockWire();
    host?.post({ v: 1, t: 'clock', clock });
    view.post({ v: 1, t: 'clock', clock });
  });

  /** Closes this Device's part; on the Host, the Match on every Device. */
  const close = (reason: CloseReason, detail: string, result?: MatchResult): void => {
    if (over) return;
    over = true;
    win.cancelAnimationFrame(raf);
    stopClock();
    for (const { stop } of armed.values()) stop();
    const frame: CloseFrame = result === undefined ? { v: 1, t: 'close', reason, detail } : { v: 1, t: 'close', reason, detail, result };
    // The host game hears every pointer it holds end before it closes.
    if (o.authority) cancelPointers(o.now());
    host?.close(frame);
    view.close(frame);
    if (o.authority) o.send(frame);
    if (reason === 'ended') o.onEvent({ t: 'ended', result: result ?? {} });
    o.onEvent({ t: 'closed', reason, detail });
  };
  /**
   * This Device's view failed. On a Peer that is its whole part. On the Host
   * only the view closes (its pointers end at the host game) and the Match
   * goes on for every other Device.
   */
  const failView = (reason: CloseReason, detail: string): void => {
    if (!o.authority) return close(reason, detail);
    if (over || view.closed) return;
    cancelPointers(o.now(), me.deviceId);
    view.close({ v: 1, t: 'close', reason, detail });
    o.onEvent({ t: 'view-closed', reason, detail });
    if (!viewOpened) opened();
  };

  return {
    deliver(frame, from) {
      if (over) return;
      // Down frames originate on the Host and up frames are for it alone.
      if (o.authority) {
        if (from !== o.self.deviceId && isNetUp(frame)) take(frame, from);
      } else if (isNetDown(frame)) {
        if (frame.t === 'state') show(frame);
        else if (frame.t === 'holders') hearHolders(frame.holders);
        else if (frame.t === 'pause') {
          if (!pausedBy || !samePause(pausedBy.reason, frame.reason)) showPause({ v: 1, t: 'pause', reason: copyReason(frame.reason), now: frame.now });
        } else if (frame.t === 'resume') {
          // Also to a runtime that started during the pause: its retained states describe the paused moment.
          pausedBy = undefined;
          view.post({ v: 1, t: 'resume', now: frame.now, clock: clockWire() });
          o.onEvent({ t: 'resumed' });
        } else close(frame.reason, frame.detail ?? 'closed by the Host', frame.result);
      }
    },
    setPaused(reason) {
      if (!o.authority || over) return;
      if (reason) pause(reason);
      else resume();
    },
    stop(reason) {
      close(reason, STOPPED[reason]);
    },
  };
}

function samePause(a: PauseReason, b: PauseReason): boolean {
  if (a.kind === 'device-lost') return b.kind === 'device-lost' && a.deviceId === b.deviceId;
  return b.kind === 'platform' && a.note === b.note;
}

/** Only the fields a `PauseReason` has: it reaches games and may have come off the net. */
function copyReason(r: PauseReason): PauseReason {
  if (r.kind === 'device-lost') return { kind: 'device-lost', deviceId: r.deviceId };
  return r.note === undefined ? { kind: 'platform' } : { kind: 'platform', note: r.note };
}

interface LinkEvents {
  /** `ready` came, in the platform's wire version: `init` may go. */
  open(): void;
  /** Every later frame but `fault` and `log`. */
  frame(f: Up): void;
  /** The game's `fault` or `log`, as this Device's platform event. */
  report(e: MatchEvent): void;
  /** The link cannot go on: the runtime closes it, and with the host link the Match. */
  fail(reason: CloseReason, detail: string): void;
}

/**
 * The platform's end of one link, and its close ladder. It waits for `ready`
 * (the only frame allowed first, in this wire version) for at most
 * `READY_TIMEOUT_MS` from the moment it is opened, then passes frames through
 * until closed; Up frames after close are dropped. A link that does not open
 * or never says `ready` is `link-lost`, a wrong version `version`, an
 * unexpected or malformed frame `protocol`, and a fatal fault or more than
 * `FAULT_LIMIT` faults within `FAULT_WINDOW_MS` `fault`.
 */
class GameLink {
  private link: Link | undefined;
  private phase: 'opening' | 'handshake' | 'open' | 'closed' = 'opening';
  /** Monotonic times of the faults still within the window. */
  private readonly faults: number[] = [];
  private readonly stopWaiting: () => void;

  constructor(
    private readonly side: 'host' | 'view',
    open: () => Promise<Link>,
    private readonly env: Env,
    private readonly on: LinkEvents,
  ) {
    this.stopWaiting = env.after(READY_TIMEOUT_MS, () => {
      if (this.phase === 'opening' || this.phase === 'handshake') on.fail('link-lost', `${side} link: no ready within ${READY_TIMEOUT_MS / 1000} s`);
    });
    let opening: Promise<Link>;
    try {
      opening = open();
    } catch (e) {
      opening = Promise.reject(e);
    }
    opening.then(
      (link) => {
        if (this.phase === 'closed') return link.close();
        this.link = link;
        this.phase = 'handshake';
        link.onFrame((f) => this.receive(f));
      },
      (e: unknown) => {
        if (this.phase !== 'closed') on.fail('link-lost', `${side} link did not open: ${e instanceof Error ? e.message : String(e)}`);
      },
    );
  }

  get closed(): boolean {
    return this.phase === 'closed';
  }

  post(f: Down): void {
    if (this.phase === 'open') this.link!.post(f);
  }

  /** `f` reaches the game only if it got `init`; a game still loading or handshaking is torn down without one. */
  close(f: CloseFrame): void {
    if (this.phase === 'closed') return;
    if (this.phase === 'open') this.link!.post(f);
    this.phase = 'closed';
    this.stopWaiting();
    this.link?.close();
  }

  private receive(f: Up): void {
    if (this.phase === 'closed') return;
    const { side } = this;
    if (typeof f !== 'object' || f === null || typeof f.t !== 'string') return this.on.fail('protocol', `${side} link: a frame without a type`);
    if (this.phase === 'handshake') {
      if (f.t !== 'ready' || f.side !== side) return this.on.fail('protocol', `${side} link: expected ready, got ${f.t}${f.t === 'ready' ? ` from the ${String(f.side)} side` : ''}`);
      if (f.v !== WIRE_VERSION) return this.on.fail('version', `${side} link: the game speaks wire v${String(f.v)}, the platform v${WIRE_VERSION}`);
      this.stopWaiting();
      this.phase = 'open';
      return this.on.open();
    }
    if (f.v !== WIRE_VERSION || f.t === 'ready') return this.on.fail('protocol', `${side} link: unexpected ${f.t}`);
    if (f.t !== 'fault' && f.t !== 'log') return this.on.frame(f);
    if (!isReport(f)) return this.on.fail('protocol', `${side} link: malformed ${(f as Up).t}`);
    if (f.t === 'log') return this.on.report({ t: 'log', side, args: f.args });

    const { where, message, stack } = f;
    this.on.report(stack === undefined ? { t: 'fault', where, message } : { t: 'fault', where, message, stack });
    if (this.phase !== 'open') return;
    if (f.fatal) return this.on.fail('fault', `${where}: ${message}`);
    const now = this.env.mono();
    this.faults.push(now);
    while (this.faults[0]! <= now - FAULT_WINDOW_MS) this.faults.shift();
    if (this.faults.length > FAULT_LIMIT) {
      this.on.fail('fault', `${this.faults.length} faults within ${FAULT_WINDOW_MS / 1000} s, the last ${where}: ${message}`);
    }
  }
}
