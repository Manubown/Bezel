import { ClockSync, SharedClock, serveClock, performanceNow, type LocalNow } from './clock';
import type { PeerId, Transport } from './transport';

/** Stable identity of one Device across reconnects; the caller supplies (and persists) it. */
export type DeviceId = string;

export interface DeviceInfo {
  deviceId: DeviceId;
  name: string;
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
  /** CSS pixels per millimetre of physical screen; heuristic until calibrated. */
  pxPerMm: number;
}

export interface RosterEntry {
  readonly info: DeviceInfo;
  /** `link !== 'lost'`; the identity is kept for the Session's lifetime. */
  readonly present: boolean;
  /**
   * `weak` after `WEAK_MS` without a word on its connection, `lost` after `LOST_MS` or when the
   * connection leaves. The Host is always `ok` in the Host's roster; a Peer flips the Host's
   * entry to `weak` from its own silence timer. Every other entry is the Host's word.
   */
  readonly link: 'ok' | 'weak' | 'lost';
  /** Clock sync against the Host (the Host itself is the reference). `rtt`/`offset` in ms once measured. */
  readonly sync: { readonly synced: boolean; readonly rtt?: number; readonly offset?: number };
}

/**
 * A Host is always `ready`. A Peer is `searching` until a Host greets it, `syncing` until its clock
 * is synced; `reconnecting` once it lost that Host (a leave, `LOST_MS` of silence, or no `ready`
 * within `SYNC_TIMEOUT_MS`) until a Host greets it again.
 */
export type SessionStatus = 'searching' | 'syncing' | 'ready' | 'reconnecting';

/** Silence (ms, local clock) after which a link is `weak`: two missed 1 Hz clock heartbeats. */
export const WEAK_MS = 2500;
/** Silence (ms) after which a link is `lost`: the Host drops that Peer; a Peer drops its Host and resets its transport. */
export const LOST_MS = 5000;
/** A Peer greeted by a Host and not `ready` this long after (ms) drops it and resets its transport. */
export const SYNC_TIMEOUT_MS = 4000;
/** How often a Session checks those. */
const CHECK_MS = 500;

/**
 * One phone's view of a Session, the same for Host and Peer. Devices are
 * addressed by `DeviceId` only; transport peer ids never leave this module.
 */
export interface Session {
  readonly self: DeviceInfo;
  readonly role: 'host' | 'peer';
  readonly status: SessionStatus;
  /** Shared Session time in ms (the Host's clock). */
  readonly clock: { now(): number };
  /** Host first, then every Device seen this Session in join order. A fresh array of immutable entries. */
  roster(): readonly RosterEntry[];
  /**
   * `data` must be JSON (it crosses WebRTC). `to` omitted = every other present Device.
   * Dropped when `to` is this Device or not present, and on a Peer before `status === 'ready'`.
   */
  send(channel: string, data: unknown, to?: DeviceId): void;
  onMessage(channel: string, handler: (data: unknown, from: DeviceId) => void): () => void;
  /** Status, roster (a `link` included), or sync changed. */
  onChange(handler: () => void): () => void;
  /** Followed either by `onDeviceBack` for the same Device or by nothing. */
  onDeviceLost(handler: (deviceId: DeviceId) => void): () => void;
  onDeviceBack(handler: (deviceId: DeviceId) => void): () => void;
  close(): void;
}

/** Host → Peer: the Host's DeviceInfo. */
const HELLO = 'hello';
/** Peer → Host: the Peer's DeviceInfo. */
const INFO = 'info';
/** Peer → Host: its sync summary. */
const CLOCK_REPORT = 'clkrep';
/** Host → Peers: the roster. */
const ROSTER = 'roster';
/** Application messages; Peers send only to the Host, which stamps the sender and relays. */
const MSG = 'msg';
const CLOCK_REPORT_MS = 1000;

type Link = RosterEntry['link'];
type Sync = RosterEntry['sync'];
type MessageHandler = (data: unknown, from: DeviceId) => void;
/** Peer → Host; `to` omitted = everyone. */
type UpEnvelope = { c: string; d: unknown; to?: DeviceId };
/** Host → Peer; `from` is stamped by the Host from the connection the message arrived on. */
type DownEnvelope = { c: string; d: unknown; from: DeviceId };

/** The Host is the clock reference; a new connection has not reported yet. */
const HOST_SYNC: Sync = Object.freeze({ synced: true });
const UNSYNCED: Sync = Object.freeze({ synced: false });

class Emitter<A extends unknown[] = []> {
  private readonly handlers = new Set<(...args: A) => void>();
  on(h: (...args: A) => void): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(...args: A): void {
    this.handlers.forEach((h) => h(...args));
  }
}

function readDeviceInfo(d: unknown): DeviceInfo | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const { deviceId, name, width, height, dpr, pxPerMm } = d as Record<string, unknown>;
  if (typeof deviceId !== 'string' || deviceId === '' || typeof name !== 'string') return undefined;
  if (typeof width !== 'number' || typeof height !== 'number') return undefined;
  if (typeof dpr !== 'number' || typeof pxPerMm !== 'number') return undefined;
  return Object.freeze({ deviceId, name, width, height, dpr, pxPerMm });
}

function readSync(d: unknown): Sync | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const { synced, rtt, offset } = d as Record<string, unknown>;
  if (typeof synced !== 'boolean') return undefined;
  if (typeof rtt !== 'number' || typeof offset !== 'number') return Object.freeze({ synced });
  return Object.freeze({ synced, rtt, offset });
}

function readLink(d: unknown): Link | undefined {
  return d === 'ok' || d === 'weak' || d === 'lost' ? d : undefined;
}

function entry(info: DeviceInfo, link: Link, sync: Sync): RosterEntry {
  return Object.freeze({ info, present: link !== 'lost', link, sync });
}

function readRoster(d: unknown): RosterEntry[] | undefined {
  if (!Array.isArray(d)) return undefined;
  const entries: RosterEntry[] = [];
  for (const e of d as unknown[]) {
    if (!e || typeof e !== 'object') return undefined;
    const r = e as Record<string, unknown>;
    const info = readDeviceInfo(r['info']);
    const sync = readSync(r['sync']);
    const link = readLink(r['link']);
    if (!info || !sync || !link) return undefined;
    entries.push(entry(info, link, sync));
  }
  return entries;
}

function isUpEnvelope(d: unknown): d is UpEnvelope {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return typeof r['c'] === 'string' && (r['to'] === undefined || typeof r['to'] === 'string');
}

function isDownEnvelope(d: unknown): d is DownEnvelope {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return typeof r['c'] === 'string' && typeof r['from'] === 'string';
}

abstract class SessionBase {
  readonly self: DeviceInfo;
  readonly clock: SharedClock;
  /** Replaced, never mutated: safe to hand out and to send. */
  protected entries: readonly RosterEntry[] = [];
  protected readonly changed = new Emitter();
  protected readonly lost = new Emitter<[DeviceId]>();
  protected readonly back = new Emitter<[DeviceId]>();
  protected readonly subs: Array<() => void> = [];
  private readonly handlers = new Map<string, Set<MessageHandler>>();

  constructor(
    protected readonly transport: Transport,
    self: DeviceInfo,
    localNow: LocalNow,
  ) {
    this.self = Object.freeze({ ...self });
    this.clock = new SharedClock(localNow);
    const timer = setInterval(() => this.check(), CHECK_MS);
    this.subs.push(() => clearInterval(timer));
  }

  roster(): readonly RosterEntry[] {
    return [...this.entries];
  }

  onMessage(channel: string, handler: MessageHandler): () => void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  onChange(handler: () => void): () => void {
    return this.changed.on(handler);
  }

  onDeviceLost(handler: (deviceId: DeviceId) => void): () => void {
    return this.lost.on(handler);
  }

  onDeviceBack(handler: (deviceId: DeviceId) => void): () => void {
    return this.back.on(handler);
  }

  protected deliver(channel: string, data: unknown, from: DeviceId): void {
    this.handlers.get(channel)?.forEach((h) => h(data, from));
  }

  /** Every `CHECK_MS`: how long the other side has been silent, against `WEAK_MS`/`LOST_MS`. */
  protected abstract check(): void;
}

/** Owns the reference clock, the roster, and the PeerId ↔ DeviceId map; routes every message. */
class HostedSession extends SessionBase implements Session {
  readonly role = 'host';
  readonly status = 'ready';
  /** Live connections only: a leave, a rebind or `LOST_MS` of silence forgets the PeerId, so its messages are dropped. */
  private readonly deviceOf = new Map<PeerId, DeviceId>();
  private readonly peerOf = new Map<DeviceId, PeerId>();
  /** Local time each bound Device was last heard on its connection. */
  private readonly heard = new Map<DeviceId, number>();

  constructor(transport: Transport, self: DeviceInfo, localNow: LocalNow) {
    super(transport, self, localNow);
    this.entries = [entry(this.self, 'ok', HOST_SYNC)];
    this.subs.push(
      // Each clock request is a heartbeat. An unbound connection gets no answer: a Peer this Host dropped hears nothing and resets.
      serveClock(transport, localNow, (peer) => this.hear(peer) !== undefined),
      transport.onPeerJoin((peer) => transport.send(HELLO, this.self, peer)),
      transport.onPeerLeave((peer) => {
        const id = this.deviceOf.get(peer);
        if (id !== undefined) this.unbind(peer, id);
      }),
      transport.onMessage(INFO, (data, peer) => {
        const info = readDeviceInfo(data);
        if (info) this.bind(peer, info);
      }),
      transport.onMessage(CLOCK_REPORT, (data, peer) => {
        const id = this.hear(peer);
        const sync = readSync(data);
        if (id === undefined || !sync) return;
        const was = this.entries.find((e) => e.info.deviceId === id)?.sync;
        if (was && was.synced === sync.synced && was.rtt === sync.rtt && was.offset === sync.offset) return;
        this.entries = this.entries.map((e) => (e.info.deviceId === id ? entry(e.info, e.link, sync) : e));
        this.publishRoster();
        this.changed.emit();
      }),
      transport.onMessage(MSG, (data, peer) => this.route(peer, data)),
    );
    for (const peer of transport.peers()) transport.send(HELLO, this.self, peer);
  }

  send(channel: string, data: unknown, to?: DeviceId): void {
    this.forward({ c: channel, d: data, from: this.self.deviceId }, to);
  }

  close(): void {
    this.subs.forEach((u) => u());
    this.transport.close();
  }

  /** A silent Peer is `weak`, then `lost`; the Host never resets its transport: reconnecting is the Peer's job. */
  protected check(): void {
    const now = this.clock.localNow();
    for (const [id, peer] of [...this.peerOf]) {
      const silence = now - (this.heard.get(id) ?? now);
      if (silence > LOST_MS) this.unbind(peer, id);
      else if (silence > WEAK_MS) this.relink(id, 'weak');
    }
  }

  /**
   * A connection identified itself. A known `deviceId` rebinds: the entry keeps
   * its place, the previous connection (if still live) is forgotten and reported
   * lost, and `onDeviceBack` fires.
   */
  private bind(peer: PeerId, info: DeviceInfo): void {
    // A connection identifies once; nobody may claim the Host's identity.
    if (this.deviceOf.has(peer) || info.deviceId === this.self.deviceId) return;
    const id = info.deviceId;
    const previous = this.peerOf.get(id);
    if (previous !== undefined) this.unbind(previous, id);
    this.deviceOf.set(peer, id);
    this.peerOf.set(id, peer);
    this.heard.set(id, this.clock.localNow());
    const next = entry(info, 'ok', UNSYNCED);
    const known = this.entries.some((e) => e.info.deviceId === id);
    this.entries = known ? this.entries.map((e) => (e.info.deviceId === id ? next : e)) : [...this.entries, next];
    this.publishRoster();
    if (known) this.back.emit(id);
    this.changed.emit();
  }

  private unbind(peer: PeerId, id: DeviceId): void {
    this.deviceOf.delete(peer);
    this.peerOf.delete(id);
    this.heard.delete(id);
    this.entries = this.entries.map((e) => (e.info.deviceId === id ? entry(e.info, 'lost', e.sync) : e));
    this.publishRoster();
    this.lost.emit(id);
    this.changed.emit();
  }

  /** A bound connection spoke: stamped, and `ok` again if it was `weak`. Its Device, if bound. */
  private hear(peer: PeerId): DeviceId | undefined {
    const id = this.deviceOf.get(peer);
    if (id === undefined) return undefined;
    this.heard.set(id, this.clock.localNow());
    this.relink(id, 'ok');
    return id;
  }

  /** `ok` ↔ `weak` for a bound Device; `lost` is `unbind`'s. */
  private relink(id: DeviceId, link: 'ok' | 'weak'): void {
    if (!this.entries.some((e) => e.info.deviceId === id && e.link !== link)) return;
    this.entries = this.entries.map((e) => (e.info.deviceId === id ? entry(e.info, link, e.sync) : e));
    this.publishRoster();
    this.changed.emit();
  }

  private route(peer: PeerId, data: unknown): void {
    const from = this.hear(peer);
    if (from === undefined || !isUpEnvelope(data)) return; // unknown or stale connection
    const { c, d, to } = data;
    if (to === undefined || to === this.self.deviceId) this.deliver(c, d, from);
    if (to !== this.self.deviceId) this.forward({ c, d, from }, to, peer);
  }

  private forward(env: DownEnvelope, to: DeviceId | undefined, except?: PeerId): void {
    if (to === undefined) {
      for (const peer of this.peerOf.values()) if (peer !== except) this.transport.send(MSG, env, peer);
      return;
    }
    const peer = this.peerOf.get(to);
    if (peer !== undefined && peer !== except) this.transport.send(MSG, env, peer);
  }

  private publishRoster(): void {
    for (const peer of this.peerOf.values()) this.transport.send(ROSTER, this.entries, peer);
  }
}

/** Finds the Host, syncs its clock against it, mirrors the Host's roster; drops a silent Host and looks again. */
class JoinedSession extends SessionBase implements Session {
  readonly role = 'peer';
  status: SessionStatus = 'searching';
  private host: PeerId | undefined;
  private sync: ClockSync | undefined;
  private reportTimer: ReturnType<typeof setInterval> | undefined;
  /** Local times the Host greeted this Session and was last heard. */
  private attachedAt = 0;
  private heardHost = 0;

  constructor(transport: Transport, self: DeviceInfo, localNow: LocalNow) {
    super(transport, self, localNow);
    this.subs.push(
      transport.onMessage(HELLO, (data, peer) => {
        const info = readDeviceInfo(data);
        if (peer === this.host) this.hear();
        else if (info) this.attach(peer, info);
      }),
      transport.onPeerLeave((peer) => {
        if (peer === this.host) this.detach('reconnecting');
      }),
      transport.onMessage(ROSTER, (data, peer) => {
        if (peer !== this.host) return;
        this.hear();
        const next = readRoster(data);
        if (next) this.applyRoster(next);
      }),
      transport.onMessage(MSG, (data, peer) => {
        if (peer !== this.host) return;
        this.hear();
        if (isDownEnvelope(data)) this.deliver(data.c, data.d, data.from);
      }),
    );
  }

  send(channel: string, data: unknown, to?: DeviceId): void {
    if (this.status !== 'ready' || this.host === undefined || to === this.self.deviceId) return;
    const env: UpEnvelope = to === undefined ? { c: channel, d: data } : { c: channel, d: data, to };
    this.transport.send(MSG, env, this.host);
  }

  close(): void {
    this.detach('searching');
    this.subs.forEach((u) => u());
    this.transport.close();
  }

  /** A Host silent for `LOST_MS`, or not `ready` within `SYNC_TIMEOUT_MS`: let it go and ask the transport for fresh connections. */
  protected check(): void {
    if (this.host === undefined) return;
    const now = this.clock.localNow();
    if (now - this.heardHost > LOST_MS || (this.status === 'syncing' && now - this.attachedAt > SYNC_TIMEOUT_MS)) {
      this.detach('reconnecting');
      this.transport.reset();
    } else if (now - this.heardHost > WEAK_MS) this.relinkHost('weak');
  }

  private attach(host: PeerId, hostInfo: DeviceInfo): void {
    if (this.host !== undefined) return; // one Host per Session
    this.host = host;
    this.status = 'syncing';
    this.attachedAt = this.heardHost = this.clock.localNow();
    this.entries = [entry(hostInfo, 'ok', HOST_SYNC)];
    this.transport.send(INFO, this.self, host);
    const sync = new ClockSync(this.transport, host, this.clock);
    sync.onUpdate((state) => {
      this.hear(); // every clock reply is a heartbeat
      if (!state.synced || this.status !== 'syncing') return;
      this.status = 'ready';
      this.changed.emit();
    });
    sync.start();
    this.sync = sync;
    this.reportTimer = setInterval(() => {
      const { synced, rtt, offset, samples } = sync.estimator.state();
      // An empty estimator reports `rtt: Infinity`, which JSON cannot carry.
      const report: Sync = samples > 0 ? { synced, rtt, offset } : { synced };
      this.transport.send(CLOCK_REPORT, report, host);
    }, CLOCK_REPORT_MS);
    this.changed.emit();
  }

  /** The Host is gone (ADR-0002): the roster with it. `reconnecting` until a Host greets again; `searching` on close. */
  private detach(status: 'searching' | 'reconnecting'): void {
    if (this.host === undefined) return;
    this.sync?.stop();
    this.sync = undefined;
    clearInterval(this.reportTimer);
    this.reportTimer = undefined;
    this.host = undefined;
    this.status = status;
    this.entries = [];
    this.changed.emit();
  }

  /** The Host spoke: stamped, and its entry `ok` again if it was `weak`. */
  private hear(): void {
    this.heardHost = this.clock.localNow();
    this.relinkHost('ok');
  }

  /** The Host's entry (first) is the one this side judges; the rest are the Host's word. */
  private relinkHost(link: 'ok' | 'weak'): void {
    const [host, ...rest] = this.entries;
    if (!host || host.link === link) return;
    this.entries = [entry(host.info, link, host.sync), ...rest];
    this.changed.emit();
  }

  /** Lost/back on a Peer are the Host's presence flips, observed through the roster. */
  private applyRoster(next: RosterEntry[]): void {
    const before = new Map(this.entries.map((e) => [e.info.deviceId, e.present]));
    this.entries = next;
    for (const e of next) {
      const was = before.get(e.info.deviceId);
      if (was === true && !e.present) this.lost.emit(e.info.deviceId);
      else if (was === false && e.present) this.back.emit(e.info.deviceId);
    }
    this.changed.emit();
  }
}

export function hostSession(transport: Transport, self: DeviceInfo, localNow: LocalNow = performanceNow): Session {
  return new HostedSession(transport, self, localNow);
}

export function joinSession(transport: Transport, self: DeviceInfo, localNow: LocalNow = performanceNow): Session {
  return new JoinedSession(transport, self, localNow);
}
