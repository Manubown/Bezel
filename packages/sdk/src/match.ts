import { REAL_ENV, type Env } from './env';
import type { CloseReason, DeviceId, Input, MatchInfo, MatchResult, PauseReason, RawInput } from './types';
import {
  WIRE_VERSION,
  isNetDown,
  isNetUp,
  type ClockWire,
  type Down,
  type Link,
  type LinkFactory,
  type NetFrame,
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

export interface MatchHandle {
  /** Frames arriving off the Transport; `from` is the Device whose channel carried it. */
  deliver(frame: NetFrame, from: DeviceId): void;
  /**
   * Host only; a no-op on a Peer. A reason pauses the Match on every Device:
   * no ticks and no `draw`, open pointers cancelled, input dropped until the
   * resume, `publish` retained. Another reason while paused is passed on to
   * every Device. `null` resumes: every view gets the retained states, then
   * `resume`, and ticks restart from the resume's time.
   */
  setPaused(reason: PauseReason | null): void;
  stop(reason: 'aborted' | 'link-lost'): void;
}

export type MatchEvent =
  | { t: 'started' }
  /** Again when the reason changes while paused. */
  | { t: 'paused'; reason: PauseReason }
  | { t: 'resumed' }
  | { t: 'ended'; result: MatchResult }
  | { t: 'closed'; reason: CloseReason; detail?: string }
  | { t: 'fault'; where: string; message: string };

/** Catch-up steps per animation frame before the rest of a stall is dropped. */
export const MAX_CATCH_UP_STEPS = 5;
/** Cadence of `clock` frames to the local game sides. */
export const CLOCK_EVERY_MS = 2000;

type StateFrame = Extract<Down, { t: 'state' }>;
type PauseFrame = Extract<Down, { t: 'pause' }>;
type CloseFrame = Extract<Down, { t: 'close' }>;

/**
 * Runs one Device's part of a Match: its view on every Device, plus the host
 * side of the Game with `authority`. Both open through `o.link`, so the Host's
 * own Tile is an ordinary view whose frames are cloned like a Peer's. Frames
 * between Devices go through `o.send` / `deliver`; nothing here knows the
 * Transport.
 */
export function runMatch(o: MatchOptions): MatchHandle {
  return runMatchWith(o, REAL_ENV);
}

/** `runMatch` on `env`'s clocks and timer (the test harness's fake ones). */
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
  let opening = o.authority ? 2 : 1;
  const opened = (): void => {
    if (--opening === 0) o.onEvent({ t: 'started' });
  };
  const clockWire = (): ClockWire => {
    const shared = o.now();
    return { epochOffset: shared - env.wall(), sentAt: shared };
  };
  const onFault = (f: Extract<Up, { t: 'fault' }>): void => o.onEvent({ t: 'fault', where: f.where, message: f.message });
  const fail = (reason: CloseReason, detail: string): void => close({ v: 1, t: 'close', reason }, detail);

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

  // This Device's view. One that becomes ready late starts from the retained
  // states (and the pause, while paused). Its input goes to the host runtime:
  // here on the Host, over the net on a Peer, paused or not.
  const view: GameLink = new GameLink('view', o.link({ side: 'view', root: o.self.mount }), {
    open() {
      const self = { deviceId: me.deviceId, role: me.role, screenMm: me.screenMm, pxPerMm, ...(me.tile && { tile: me.tile }) };
      view.post({ v: 1, t: 'init', side: 'view', match: o.match, self, clock: clockWire() });
      for (const f of retainedFor(me.deviceId)) view.post(f);
      if (pausedBy) view.post(pausedBy);
      opened();
    },
    frame(f) {
      if (f.t === 'fault') onFault(f);
      else if (!isNetUp(f)) fail('protocol', `unexpected ${f.t} on the view link`);
      else if (o.authority) ingest(f.inputs, me.deviceId);
      else o.send(f);
    },
    fail,
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

  // Host input ingest. Who sent an input is the channel it came on, never what
  // it says; per Device and pointer only `down → move* → (up | cancel)` passes.
  const roleOf = new Map(o.match.devices.map((d) => [d.deviceId, d.role]));
  const openPointers = new Map<DeviceId, Set<number>>();
  /** Accepted since the last step, in arrival order. */
  let inbox: Input[] = [];
  /** Per Device, the pointers the host game saw go down and not end, with their last input. */
  const held = new Map<DeviceId, Map<number, Input>>();
  let hostOpen = false;
  const ingest = (raw: readonly RawInput[], from: DeviceId): void => {
    const role = roleOf.get(from);
    // Paused: dropped, so nothing sent meanwhile applies on resume.
    if (over || pausedBy || role === undefined) return;
    let pointers = openPointers.get(from);
    if (!pointers) openPointers.set(from, (pointers = new Set()));
    for (const { pointerId, phase, t, world } of raw) {
      if (phase === 'down') {
        if (pointers.has(pointerId)) continue;
        pointers.add(pointerId);
      } else if (!pointers.has(pointerId)) continue;
      else if (phase !== 'move') pointers.delete(pointerId);
      inbox.push({ deviceId: from, role, pointerId, phase, t, world: { x: world.x, y: world.y } });
    }
    if (dt === 0) drain(); // no steps: inputs go at once
  };
  /** Inbound input goes to the host game before the step's tick. */
  const drain = (): void => {
    if (!hostOpen || inbox.length === 0) return;
    for (const i of inbox) {
      let pointers = held.get(i.deviceId);
      if (!pointers) held.set(i.deviceId, (pointers = new Map()));
      if (i.phase === 'down' || i.phase === 'move') pointers.set(i.pointerId, i);
      else pointers.delete(i.pointerId);
    }
    host?.post({ v: 1, t: 'input', inputs: inbox });
    inbox = [];
  };
  /**
   * Drops the input not yet delivered and ends every pointer: the host game
   * gets a `cancel` at `t` (where the pointer last was) for each one it holds
   * open. Later samples of those pointers are orphans until a new `down`.
   */
  const cancelPointers = (t: number): void => {
    inbox = [];
    openPointers.clear();
    const cancels: Input[] = [];
    for (const pointers of held.values()) for (const i of pointers.values()) cancels.push({ ...i, phase: 'cancel', t, world: { ...i.world } });
    held.clear();
    if (cancels.length > 0) host?.post({ v: 1, t: 'input', inputs: cancels });
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
  const host: GameLink | undefined = o.authority
    ? new GameLink('host', o.link({ side: 'host' }), {
        open() {
          host?.post({ v: 1, t: 'init', side: 'host', match: o.match, clock: clockWire() });
          hostOpen = true;
          if (pausedBy) host?.post(pausedBy);
          else if (dt > 0) startStepping(o.now());
          else drain();
          opened();
        },
        frame(f) {
          if (f.t === 'publish') publish(f);
          else if (f.t === 'end') close({ v: 1, t: 'close', reason: 'ended', result: f.result });
          else if (f.t === 'fault') onFault(f);
          else fail('protocol', `unexpected ${f.t} on the host link`);
        },
        fail,
      })
    : undefined;

  /** Host: stops the steps, ends every pointer, and tells the host game, every view and the net. */
  const pause = (reason: PauseReason): void => {
    if (pausedBy && samePause(pausedBy.reason, reason)) return;
    // A new reason while paused keeps the time the Match stopped.
    const frame: PauseFrame = { v: 1, t: 'pause', reason: copyReason(reason), now: pausedBy?.now ?? o.now() };
    if (!pausedBy) {
      win.cancelAnimationFrame(raf);
      cancelPointers(frame.now);
    }
    host?.post(frame);
    o.send(frame);
    showPause(frame);
  };
  /**
   * Host: every view gets the retained states, then `resume` with a fresh
   * clock frame (the host game first, so its `onResume` publish follows them),
   * then steps restart from now.
   */
  const resume = (): void => {
    if (!pausedBy) return;
    pausedBy = undefined;
    const clock = clockWire();
    const frame: Extract<Down, { t: 'resume' }> = { v: 1, t: 'resume', now: clock.sentAt, clock };
    host?.post(frame);
    for (const d of o.match.devices) {
      if (d.deviceId === me.deviceId) for (const f of retainedFor(d.deviceId)) view.post(f);
      else for (const f of retainedFor(d.deviceId)) o.send(f, d.deviceId);
    }
    view.post(frame);
    o.send(frame);
    o.onEvent({ t: 'resumed' });
    if (hostOpen && dt > 0) startStepping(frame.now);
  };

  const stopClock = env.every(CLOCK_EVERY_MS, () => {
    const clock = clockWire();
    host?.post({ v: 1, t: 'clock', clock });
    view.post({ v: 1, t: 'clock', clock });
  });

  /** Closes this Device's part; on the Host, the Match on every Device. */
  const close = (frame: CloseFrame, detail?: string): void => {
    if (over) return;
    over = true;
    inbox = [];
    win.cancelAnimationFrame(raf);
    stopClock();
    host?.close(frame);
    view.close(frame);
    if (o.authority) o.send(frame);
    if (frame.reason === 'ended') o.onEvent({ t: 'ended', result: frame.result ?? {} });
    o.onEvent(detail === undefined ? { t: 'closed', reason: frame.reason } : { t: 'closed', reason: frame.reason, detail });
  };

  return {
    deliver(frame, from) {
      if (over) return;
      // Down frames originate on the Host and up frames are for it alone.
      if (o.authority) {
        if (from !== o.self.deviceId && isNetUp(frame)) ingest(frame.inputs, from);
      } else if (isNetDown(frame)) {
        if (frame.t === 'state') show(frame);
        else if (frame.t === 'pause') {
          if (!pausedBy || !samePause(pausedBy.reason, frame.reason)) showPause({ v: 1, t: 'pause', reason: copyReason(frame.reason), now: frame.now });
        } else if (frame.t === 'resume') {
          // Also to a runtime that started during the pause: its retained states describe the paused moment.
          pausedBy = undefined;
          view.post({ v: 1, t: 'resume', now: frame.now, clock: clockWire() });
          o.onEvent({ t: 'resumed' });
        } else close(frame);
      }
    },
    setPaused(reason) {
      if (!o.authority || over) return;
      if (reason) pause(reason);
      else resume();
    },
    stop(reason) {
      close({ v: 1, t: 'close', reason });
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

/**
 * The platform's end of one link: waits for `ready` (version-checked) before
 * anything else, then passes frames through until closed. Up frames after
 * close are dropped.
 */
class GameLink {
  private link: Link | undefined;
  private phase: 'opening' | 'handshake' | 'open' | 'closed' = 'opening';

  constructor(
    private readonly side: 'host' | 'view',
    opening: Promise<Link>,
    private readonly on: { open(): void; frame(f: Up): void; fail(reason: CloseReason, detail: string): void },
  ) {
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

  post(f: Down): void {
    if (this.phase === 'open') this.link!.post(f);
  }

  close(f: CloseFrame): void {
    if (this.phase === 'closed') return;
    if (this.phase === 'open') this.link!.post(f);
    this.phase = 'closed';
    this.link?.close();
  }

  private receive(f: Up): void {
    if (this.phase === 'handshake') {
      if (f.t !== 'ready' || f.side !== this.side) return this.on.fail('protocol', `expected ready on the ${this.side} link, got ${f.t}`);
      if (f.v !== WIRE_VERSION) return this.on.fail('version', `game speaks wire v${f.v}, platform v${WIRE_VERSION}`);
      this.phase = 'open';
      return this.on.open();
    }
    if (this.phase !== 'open') return;
    if (f.v !== WIRE_VERSION || f.t === 'ready') return this.on.fail('protocol', `unexpected ${f.t} on the ${this.side} link`);
    this.on.frame(f);
  }
}
