import type { PeerId, Transport } from './transport';

export interface ClockSample {
  /** hostTime - localTime, ms */
  offset: number;
  /** round-trip time, ms */
  rtt: number;
}

export interface ClockState {
  offset: number;
  rtt: number;
  samples: number;
  synced: boolean;
}

export const CLOCK_CHANNEL = 'clk';
export const MIN_SYNC_SAMPLES = 4;

/**
 * NTP-style offset estimator. Keeps a sliding window of samples, discards the
 * ones whose RTT is far above the window minimum (queueing noise), and takes
 * the median offset of the rest. Error bound is half the uplink/downlink
 * latency asymmetry, which on a LAN is a few ms.
 */
export class ClockEstimator {
  private readonly samples: ClockSample[] = [];
  private cached: ClockState = { offset: 0, rtt: Infinity, samples: 0, synced: false };

  constructor(
    private readonly windowSize = 16,
    private readonly rttSlackMs = 2,
  ) {}

  /** t0: local send, t1: remote receive, t2: remote send, t3: local receive. */
  add(t0: number, t1: number, t2: number, t3: number): ClockSample {
    const sample: ClockSample = {
      offset: (t1 - t0 + (t2 - t3)) / 2,
      rtt: t3 - t0 - (t2 - t1),
    };
    this.samples.push(sample);
    if (this.samples.length > this.windowSize) this.samples.shift();
    this.cached = this.compute();
    return sample;
  }

  state(): ClockState {
    return this.cached;
  }

  private compute(): ClockState {
    if (this.samples.length === 0) return { offset: 0, rtt: Infinity, samples: 0, synced: false };
    let minRtt = Infinity;
    for (const s of this.samples) if (s.rtt < minRtt) minRtt = s.rtt;
    const good = this.samples
      .filter((s) => s.rtt <= minRtt + this.rttSlackMs)
      .map((s) => s.offset)
      .sort((a, b) => a - b);
    const mid = good.length >> 1;
    const offset =
      good.length % 2 === 1 ? good[mid]! : (good[mid - 1]! + good[mid]!) / 2;
    return {
      offset,
      rtt: minRtt,
      samples: this.samples.length,
      synced: this.samples.length >= MIN_SYNC_SAMPLES,
    };
  }
}

export type LocalNow = () => number;
export const performanceNow: LocalNow = () => performance.now();

/** Shared session time in ms. On the host this is the local monotonic clock. */
export class SharedClock {
  offset = 0;
  constructor(readonly localNow: LocalNow = performanceNow) {}
  now(): number {
    return this.localNow() + this.offset;
  }
}

interface ClockRequest {
  q: number;
  t0: number;
}
interface ClockReply extends ClockRequest {
  t1: number;
  t2: number;
}

function isReply(d: unknown): d is ClockReply {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r['q'] === 'number' &&
    typeof r['t0'] === 'number' &&
    typeof r['t1'] === 'number' &&
    typeof r['t2'] === 'number'
  );
}

function isRequest(d: unknown): d is ClockRequest {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return typeof r['q'] === 'number' && typeof r['t0'] === 'number';
}

/**
 * Host side: answer clock requests with host receive/send timestamps. `onRequest` sees
 * each request's sender first; `false` leaves the request unanswered.
 */
export function serveClock(
  transport: Transport,
  localNow: LocalNow = performanceNow,
  onRequest: (from: PeerId) => boolean = () => true,
): () => void {
  return transport.onMessage(CLOCK_CHANNEL, (data, from) => {
    if (!isRequest(data) || !onRequest(from)) return;
    const t1 = localNow();
    const reply: ClockReply = { q: data.q, t0: data.t0, t1, t2: localNow() };
    transport.send(CLOCK_CHANNEL, reply, from);
  });
}

export interface ClockSyncOptions {
  /** Pings sent back-to-back on start. */
  burst?: number;
  burstIntervalMs?: number;
  /** Steady-state ping interval: tracks drift, and is the Session's heartbeat. */
  periodicMs?: number;
}

/**
 * Peer side: pings the host, feeds samples into the estimator, and keeps
 * `clock.offset` updated.
 */
export class ClockSync {
  readonly estimator = new ClockEstimator();
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: (() => void) | undefined;
  private readonly listeners = new Set<(state: ClockState) => void>();
  private readonly burst: number;
  private readonly burstIntervalMs: number;
  private readonly periodicMs: number;

  constructor(
    private readonly transport: Transport,
    private readonly hostId: PeerId,
    readonly clock: SharedClock,
    opts: ClockSyncOptions = {},
  ) {
    this.burst = opts.burst ?? 10;
    this.burstIntervalMs = opts.burstIntervalMs ?? 100;
    this.periodicMs = opts.periodicMs ?? 1000;
  }

  onUpdate(handler: (state: ClockState) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  start(): void {
    this.stop();
    this.unsubscribe = this.transport.onMessage(CLOCK_CHANNEL, (data, from) => {
      if (from !== this.hostId || !isReply(data)) return;
      const t3 = this.clock.localNow();
      this.estimator.add(data.t0, data.t1, data.t2, t3);
      const state = this.estimator.state();
      this.clock.offset = state.offset;
      this.listeners.forEach((h) => h(state));
    });
    let sent = 0;
    const tick = () => {
      this.ping();
      sent++;
      this.timer = setTimeout(tick, sent < this.burst ? this.burstIntervalMs : this.periodicMs);
    };
    tick();
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private ping(): void {
    const req: ClockRequest = { q: ++this.seq, t0: this.clock.localNow() };
    this.transport.send(CLOCK_CHANNEL, req, this.hostId);
  }
}
