import type { CloseReason, DeviceId, MatchInfo, MatchResult, PauseReason } from './types';
import { WIRE_VERSION, isNetDown, type ClockWire, type Down, type Link, type LinkFactory, type NetFrame, type Up } from './wire';

export interface MatchOptions {
  link: LinkFactory;
  /** The lobby froze it; identical on every Device. */
  match: MatchInfo;
  /** `mount`: a positioned element the view fills; its window drives animation frames and gives the dpr. */
  self: { deviceId: DeviceId; pxPerMm: number; mount: HTMLElement };
  /** The shared clock (core `Session.clock.now`, bound). */
  now(): number;
  /** Forwards `frame` over the platform Transport; `to` omitted = every other Device. */
  send(frame: NetFrame, to?: DeviceId): void;
  onEvent(e: MatchEvent): void;
  /** True on the Host: also runs the host side of the Game. */
  authority?: boolean;
}

export interface MatchHandle {
  /** Frames arriving off the Transport. */
  deliver(frame: NetFrame, from: DeviceId): void;
  /** Host only. Wire v1 as implemented has no pause frames yet: accepted, no effect. */
  setPaused(reason: PauseReason | null): void;
  stop(reason: 'aborted' | 'link-lost'): void;
}

export type MatchEvent =
  | { t: 'started' }
  | { t: 'ended'; result: MatchResult }
  | { t: 'closed'; reason: CloseReason; detail?: string }
  | { t: 'fault'; where: string; message: string };

/** Catch-up steps per animation frame before the rest of a stall is dropped. */
export const MAX_CATCH_UP_STEPS = 5;
/** Cadence of `clock` frames to the local game sides. */
export const CLOCK_EVERY_MS = 2000;

type StateFrame = Extract<Down, { t: 'state' }>;
type CloseFrame = Extract<Down, { t: 'close' }>;

/**
 * Runs one Device's part of a Match: its view on every Device, plus the host
 * side of the Game with `authority`. Both open through `o.link`, so the Host's
 * own Tile is an ordinary view whose frames are cloned like a Peer's. Frames
 * between Devices go through `o.send` / `deliver`; nothing here knows the
 * Transport.
 */
export function runMatch(o: MatchOptions): MatchHandle {
  const me = o.match.devices.find((d) => d.deviceId === o.self.deviceId);
  if (!me) throw new Error(`runMatch: Device ${o.self.deviceId} is not in Match ${o.match.matchId}`);
  const win = o.self.mount.ownerDocument.defaultView;
  if (!win) throw new Error('runMatch: mount is not in a window');
  const { pxPerMm } = o.self;

  let over = false;
  let opening = o.authority ? 2 : 1;
  const opened = (): void => {
    if (--opening === 0) o.onEvent({ t: 'started' });
  };
  const clockWire = (): ClockWire => {
    const shared = o.now();
    return { epochOffset: shared - Date.now(), sentAt: shared };
  };
  const onFault = (f: Extract<Up, { t: 'fault' }>): void => o.onEvent({ t: 'fault', where: f.where, message: f.message });
  const fail = (reason: CloseReason, detail: string): void => close({ v: 1, t: 'close', reason }, detail);

  // This Device's view. It keeps the last broadcast and the last state sent to
  // it alone, in arrival order, so a view that becomes ready late starts from them.
  const retained: StateFrame[] = [];
  const view: GameLink = new GameLink('view', o.link({ side: 'view', root: o.self.mount }), {
    open() {
      const self = { deviceId: me.deviceId, role: me.role, screenMm: me.screenMm, pxPerMm, ...(me.tile && { tile: me.tile }) };
      view.post({ v: 1, t: 'init', side: 'view', match: o.match, self, clock: clockWire() });
      for (const f of retained) view.post(f);
      opened();
    },
    frame(f) {
      if (f.t === 'fault') onFault(f);
      else fail('protocol', `unexpected ${f.t} on the view link`);
    },
    fail,
  });
  const show = (f: StateFrame): void => {
    const i = retained.findIndex((r) => (r.to === undefined) === (f.to === undefined));
    if (i >= 0) retained.splice(i, 1);
    retained.push(f);
    view.post(f);
  };

  // The host side: a fixed-step accumulator on this window's animation frames.
  const dt = o.match.tickHz > 0 ? 1 / o.match.tickHz : 0;
  const dtMs = o.match.tickHz > 0 ? 1000 / o.match.tickHz : 0;
  let raf = 0;
  let n = 0;
  /** Shared time of the last step; steps are exactly `dtMs` apart until a stall is dropped. */
  let stepAt = 0;
  const advance = (): void => {
    if (over) return;
    raf = win.requestAnimationFrame(advance);
    const now = o.now();
    stepAt = Math.max(stepAt, now - MAX_CATCH_UP_STEPS * dtMs);
    while (stepAt + dtMs <= now) {
      stepAt += dtMs;
      host?.post({ v: 1, t: 'tick', n: ++n, dt, now: stepAt });
    }
  };
  const publish = (f: Extract<Up, { t: 'publish' }>): void => {
    const { state, at, to } = f;
    if (to === undefined) {
      const frame: StateFrame = { v: 1, t: 'state', state, at };
      o.send(frame);
      show(frame);
    } else if (to === o.self.deviceId) show({ v: 1, t: 'state', state, at, to });
    else o.send({ v: 1, t: 'state', state, at, to }, to);
  };
  const host: GameLink | undefined = o.authority
    ? new GameLink('host', o.link({ side: 'host' }), {
        open() {
          host?.post({ v: 1, t: 'init', side: 'host', match: o.match, clock: clockWire() });
          if (dt > 0) {
            stepAt = o.now();
            raf = win.requestAnimationFrame(advance);
          }
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

  const clockTimer = setInterval(() => {
    const clock = clockWire();
    host?.post({ v: 1, t: 'clock', clock });
    view.post({ v: 1, t: 'clock', clock });
  }, CLOCK_EVERY_MS);

  /** Closes this Device's part; on the Host, the Match on every Device. */
  const close = (frame: CloseFrame, detail?: string): void => {
    if (over) return;
    over = true;
    win.cancelAnimationFrame(raf);
    clearInterval(clockTimer);
    host?.close(frame);
    view.close(frame);
    if (o.authority) o.send(frame);
    if (frame.reason === 'ended') o.onEvent({ t: 'ended', result: frame.result ?? {} });
    o.onEvent(detail === undefined ? { t: 'closed', reason: frame.reason } : { t: 'closed', reason: frame.reason, detail });
  };

  return {
    deliver(frame) {
      // Down frames originate on the Host; it never takes them from the net.
      if (over || o.authority || !isNetDown(frame)) return;
      if (frame.t === 'state') show(frame);
      else close(frame);
    },
    setPaused() {},
    stop(reason) {
      close({ v: 1, t: 'close', reason });
    },
  };
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
