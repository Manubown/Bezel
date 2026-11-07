import { ClockSync, SharedClock, serveClock, type ClockState, type LocalNow, performanceNow } from './clock';
import type { PeerId, Transport } from './transport';

export interface DeviceInfo {
  name: string;
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
  /** CSS pixels per millimetre of physical screen; heuristic until calibrated. */
  pxPerMm: number;
}

export interface PeerEntry {
  id: PeerId;
  info?: DeviceInfo;
  clock?: ClockState;
}

const HELLO = 'hello';
const INFO = 'info';
const CLOCK_REPORT = 'clkrep';
const CLOCK_REPORT_MS = 1000;

type ChangeHandler = () => void;

class Emitter {
  private readonly handlers = new Set<ChangeHandler>();
  on(h: ChangeHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(): void {
    this.handlers.forEach((h) => h());
  }
}

function isDeviceInfo(d: unknown): d is DeviceInfo {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r['name'] === 'string' &&
    typeof r['width'] === 'number' &&
    typeof r['height'] === 'number' &&
    typeof r['dpr'] === 'number' &&
    typeof r['pxPerMm'] === 'number'
  );
}

function isClockState(d: unknown): d is ClockState {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return typeof r['offset'] === 'number' && typeof r['rtt'] === 'number' && typeof r['synced'] === 'boolean';
}

/** The authoritative phone. Owns the reference clock and the peer roster. */
export class HostSession {
  readonly peers = new Map<PeerId, PeerEntry>();
  readonly clock: SharedClock;
  private readonly changed = new Emitter();
  private readonly subs: Array<() => void> = [];

  constructor(
    readonly transport: Transport,
    localNow: LocalNow = performanceNow,
  ) {
    this.clock = new SharedClock(localNow);
    this.subs.push(
      serveClock(transport, localNow),
      transport.onPeerJoin((id) => {
        this.peers.set(id, { id });
        transport.send(HELLO, { role: 'host' }, id);
        this.changed.emit();
      }),
      transport.onPeerLeave((id) => {
        this.peers.delete(id);
        this.changed.emit();
      }),
      transport.onMessage(INFO, (data, from) => {
        const entry = this.peers.get(from);
        if (!entry || !isDeviceInfo(data)) return;
        entry.info = data;
        this.changed.emit();
      }),
      transport.onMessage(CLOCK_REPORT, (data, from) => {
        const entry = this.peers.get(from);
        if (!entry || !isClockState(data)) return;
        entry.clock = data;
        this.changed.emit();
      }),
    );
    for (const id of transport.peers()) {
      this.peers.set(id, { id });
      transport.send(HELLO, { role: 'host' }, id);
    }
  }

  onChange(h: ChangeHandler): () => void {
    return this.changed.on(h);
  }

  close(): void {
    this.subs.forEach((u) => u());
    this.transport.close();
  }
}

export type PeerStatus = 'searching' | 'syncing' | 'ready';

/** A non-host phone. Finds the host, syncs its clock, reports its device. */
export class PeerSession {
  hostId: PeerId | undefined;
  status: PeerStatus = 'searching';
  readonly clock: SharedClock;
  private sync: ClockSync | undefined;
  private reportTimer: ReturnType<typeof setInterval> | undefined;
  private readonly changed = new Emitter();
  private readonly subs: Array<() => void> = [];

  constructor(
    readonly transport: Transport,
    readonly info: DeviceInfo,
    localNow: LocalNow = performanceNow,
  ) {
    this.clock = new SharedClock(localNow);
    this.subs.push(
      transport.onMessage(HELLO, (data, from) => {
        const role = (data as { role?: unknown } | null)?.role;
        if (role === 'host') this.attach(from);
      }),
      transport.onPeerLeave((id) => {
        if (id === this.hostId) this.detach();
      }),
    );
  }

  clockState(): ClockState | undefined {
    return this.sync?.estimator.state();
  }

  onChange(h: ChangeHandler): () => void {
    return this.changed.on(h);
  }

  private attach(hostId: PeerId): void {
    if (this.hostId === hostId) return;
    this.detach();
    this.hostId = hostId;
    this.status = 'syncing';
    this.transport.send(INFO, this.info, hostId);
    this.sync = new ClockSync(this.transport, hostId, this.clock);
    this.sync.onUpdate((state) => {
      const next: PeerStatus = state.synced ? 'ready' : 'syncing';
      const statusChanged = next !== this.status;
      this.status = next;
      if (statusChanged || !state.synced) this.changed.emit();
    });
    this.sync.start();
    this.reportTimer = setInterval(() => {
      const state = this.sync?.estimator.state();
      if (state && this.hostId) this.transport.send(CLOCK_REPORT, state, this.hostId);
      this.changed.emit();
    }, CLOCK_REPORT_MS);
    this.changed.emit();
  }

  private detach(): void {
    this.sync?.stop();
    this.sync = undefined;
    clearInterval(this.reportTimer);
    this.reportTimer = undefined;
    this.hostId = undefined;
    this.status = 'searching';
    this.changed.emit();
  }

  close(): void {
    this.detach();
    this.subs.forEach((u) => u());
    this.transport.close();
  }
}
