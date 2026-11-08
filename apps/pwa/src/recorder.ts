import { CLOCK_CHANNEL, type PeerId, type Transport } from '@mgc/core';

/**
 * The session recorder: one JSON line per event, kept across reloads in
 * IndexedDB (a ring of `maxLines`), exported as a `.txt` of NDJSON. Every
 * line is `{ t, w, k, ...data }`: `t` shared time (ms, the Host's clock; the
 * local clock until synced), `w` wall time (ms since the epoch), `k` the kind.
 * The first line of an export is an `export` summary.
 */
export interface Recorder {
  /** One event. `data` must be JSON. */
  log(kind: string, data?: Record<string, unknown>): void;
  /**
   * Counts every frame and byte that crosses `inner` per channel and Device, logs peer joins and leaves, and (on a Peer)
   * every clock sample. With `connections`, every peer connection's ICE/connection state changes and its selected
   * candidate pair (types, protocol, mDNS, rtt) are logged too: on join, on each change, and at the leave.
   */
  transport(inner: Transport, connections?: () => Record<PeerId, RTCPeerConnection>): Transport;
  /** Starts the per-second `tick` line (frame rate, wire totals) and the page listeners (visibility, viewport, errors); returns the stop. */
  observe(): () => void;
  /** The whole log as NDJSON text, summary line first. */
  text(): Promise<string>;
  /** Shares the log as a `.txt` where the browser can (phones), else downloads it. */
  export(): Promise<void>;
  /** Drops every line, stored and pending. */
  clear(): Promise<void>;
  /** Lines written so far (stored + pending), for the HUD. */
  count(): Promise<number>;
}

export interface RecorderOptions {
  /** Shared time; the Session's clock once there is one. */
  now(): number;
  /** This Device, for the summary line. */
  deviceId: string;
  role: 'host' | 'peer';
  code: string;
  /** Where lines live; default IndexedDB. */
  store?: LineStore;
  /** Default 20 000 (~3 MB). */
  maxLines?: number;
  /** Wall clock; default `Date.now`. */
  wall?(): number;
  /** The window to observe; default the global one. Tests pass none and skip `observe`. */
  win?: Window;
  /** How often pending lines are written and the `tick` line goes out, ms; default 1000. */
  flushMs?: number;
}

/** Append-only line storage; `trim` keeps the newest `max`. */
export interface LineStore {
  append(lines: readonly string[]): Promise<void>;
  all(): Promise<string[]>;
  clear(): Promise<void>;
  trim(max: number): Promise<void>;
}

const DEFAULT_MAX_LINES = 20_000;

export function createRecorder(o: RecorderOptions): Recorder {
  const wall = o.wall ?? Date.now;
  // One database per Device: several tabs of one origin (a desktop smoke) each keep their own log.
  const store = o.store ?? indexedDbStore(`mgc-log-${o.deviceId}`);
  const maxLines = o.maxLines ?? DEFAULT_MAX_LINES;
  const flushMs = o.flushMs ?? 1000;
  let pending: string[] = [];
  let flushing: Promise<void> = Promise.resolve();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): Promise<void> => {
    if (pending.length === 0) return flushing;
    const lines = pending;
    pending = [];
    flushing = flushing.then(() => store.append(lines)).then(() => store.trim(maxLines)).catch(() => {});
    return flushing;
  };
  const line = (kind: string, data: Record<string, unknown> = {}): void => {
    // `t`, `w`, `k` are the line's own; a data key of that name is kept under `data.<key>`.
    const { t, w, k, ...rest } = data;
    const clash = t !== undefined || w !== undefined || k !== undefined;
    pending.push(JSON.stringify({ t: Math.round(o.now() * 10) / 10, w: wall(), k: kind, ...rest, ...(clash && { data: { t, w, k } }) }));
    if (pending.length > maxLines) pending = pending.slice(-maxLines);
    flushTimer ??= setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, flushMs);
  };

  // Wire totals since the last tick: per direction, per channel, frames and bytes.
  type Totals = Record<string, { n: number; b: number }>;
  let tx: Totals = {};
  let rx: Totals = {};
  let wired = false;
  const count = (totals: Totals, channel: string, data: unknown): void => {
    const bytes = JSON.stringify(data)?.length ?? 0;
    const t = (totals[channel] ??= { n: 0, b: 0 });
    t.n++;
    t.b += bytes;
    wired = true;
  };

  const recorder: Recorder = {
    log: line,

    transport(inner, connections) {
      const peers = new Map<PeerId, number>();
      const watched = new WeakSet<RTCPeerConnection>();
      /** The selected candidate pair, from `getStats`: what kind of path carries this connection. */
      const pairOf = async (pc: RTCPeerConnection): Promise<Record<string, unknown> | undefined> => {
        const stats = await pc.getStats();
        const byId = new Map<string, Record<string, unknown>>();
        stats.forEach((s: Record<string, unknown>) => byId.set(String(s['id']), s));
        let pair: Record<string, unknown> | undefined;
        for (const s of byId.values()) {
          if (s['type'] === 'transport' && typeof s['selectedCandidatePairId'] === 'string') pair = byId.get(s['selectedCandidatePairId']);
        }
        if (!pair) for (const s of byId.values()) if (s['type'] === 'candidate-pair' && s['nominated'] === true && s['state'] === 'succeeded') pair = s;
        if (!pair) return undefined;
        const side = (id: unknown): Record<string, unknown> | undefined => {
          const c = typeof id === 'string' ? byId.get(id) : undefined;
          if (!c) return undefined;
          const address = typeof c['address'] === 'string' ? c['address'] : '';
          return { type: c['candidateType'], proto: c['protocol'], mdns: address.endsWith('.local'), v6: address.includes(':'), relayProto: c['relayProtocol'] };
        };
        return { state: pair['state'], rtt: pair['currentRoundTripTime'], sent: pair['bytesSent'], recv: pair['bytesReceived'], local: side(pair['localCandidateId']), remote: side(pair['remoteCandidateId']) };
      };
      const ice = (id: PeerId, event: string, pc: RTCPeerConnection): void => {
        const states = { connection: pc.connectionState, ice: pc.iceConnectionState, gathering: pc.iceGatheringState, signaling: pc.signalingState };
        pairOf(pc).then(
          (pair) => line('ice', { peer: id, event, ...states, ...(pair && { pair }) }),
          () => line('ice', { peer: id, event, ...states }),
        );
      };
      const watch = (id: PeerId): void => {
        const pc = connections?.()[id];
        if (!pc || watched.has(pc)) return;
        watched.add(pc);
        ice(id, 'join', pc);
        pc.addEventListener('connectionstatechange', () => ice(id, 'connection', pc));
        pc.addEventListener('iceconnectionstatechange', () => ice(id, 'ice', pc));
      };
      inner.onPeerJoin((id) => {
        peers.set(id, wall());
        line('peer-join', { peer: id, peers: inner.peers().length });
        watch(id);
      });
      inner.onPeerLeave((id) => {
        const since = peers.get(id);
        peers.delete(id);
        line('peer-leave', { peer: id, peers: inner.peers().length, ...(since !== undefined && { afterMs: wall() - since }) });
        const pc = connections?.()[id];
        if (pc) ice(id, 'leave', pc);
      });
      // A Peer's clock samples, as `ClockSync` computes them: t0 sent, t1/t2 at the Host, t3 now.
      if (o.role === 'peer') {
        inner.onMessage(CLOCK_CHANNEL, (data) => {
          if (!data || typeof data !== 'object' || !('t0' in data) || !('t1' in data) || !('t2' in data)) return;
          const { t0, t1, t2 } = data;
          if (typeof t0 !== 'number' || typeof t1 !== 'number' || typeof t2 !== 'number') return;
          const t3 = performance.now();
          const rtt = t3 - t0 - (t2 - t1);
          const offset = (t1 - t0 + (t2 - t3)) / 2;
          line('clock', { q: 'q' in data ? data.q : undefined, rtt: Math.round(rtt * 100) / 100, offset: Math.round(offset * 100) / 100 });
        });
      }
      return {
        get selfId() {
          return inner.selfId;
        },
        send(channel, data, to) {
          count(tx, channel, data);
          inner.send(channel, data, to);
        },
        onMessage(channel, handler) {
          return inner.onMessage(channel, (data, from) => {
            count(rx, channel, data);
            handler(data, from);
          });
        },
        onPeerJoin: (h) => inner.onPeerJoin(h),
        onPeerLeave: (h) => inner.onPeerLeave(h),
        peers: () => inner.peers(),
        close: () => inner.close(),
      };
    },

    observe() {
      const win = o.win ?? window;
      const doc = win.document;
      let frames = 0;
      let raf = 0;
      const paint = (): void => {
        frames++;
        raf = win.requestAnimationFrame(paint);
      };
      raf = win.requestAnimationFrame(paint);
      let last = wall();
      const tick = setInterval(() => {
        const now = wall();
        const fps = Math.round((frames * 1000) / Math.max(1, now - last));
        frames = 0;
        last = now;
        line('tick', { fps, hidden: doc.hidden, ...(Object.keys(tx).length > 0 && { tx }), ...(Object.keys(rx).length > 0 && { rx }) });
        tx = {};
        rx = {};
        wired = false;
      }, flushMs);
      const onVisibility = (): void => line('visibility', { hidden: doc.hidden });
      const onViewport = (): void => {
        const vv = win.visualViewport;
        line('viewport', { width: vv?.width ?? win.innerWidth, height: vv?.height ?? win.innerHeight, inner: { width: win.innerWidth, height: win.innerHeight }, dpr: win.devicePixelRatio });
      };
      const onError = (e: ErrorEvent): void => line('error', { message: e.message, source: e.filename, line: e.lineno, stack: e.error instanceof Error ? e.error.stack : undefined });
      const onRejection = (e: PromiseRejectionEvent): void => line('error', { message: String(e.reason instanceof Error ? e.reason.message : e.reason), stack: e.reason instanceof Error ? e.reason.stack : undefined });
      const onHide = (): void => void flush();
      doc.addEventListener('visibilitychange', onVisibility);
      win.visualViewport?.addEventListener('resize', onViewport);
      win.addEventListener('resize', onViewport);
      win.addEventListener('error', onError);
      win.addEventListener('unhandledrejection', onRejection);
      win.addEventListener('pagehide', onHide);
      onViewport();
      return () => {
        win.cancelAnimationFrame(raf);
        clearInterval(tick);
        doc.removeEventListener('visibilitychange', onVisibility);
        win.visualViewport?.removeEventListener('resize', onViewport);
        win.removeEventListener('resize', onViewport);
        win.removeEventListener('error', onError);
        win.removeEventListener('unhandledrejection', onRejection);
        win.removeEventListener('pagehide', onHide);
      };
    },

    async text() {
      await flush();
      const lines = await store.all();
      const first = lines[0] ? (JSON.parse(lines[0]) as { w?: number }).w : undefined;
      const summary = JSON.stringify({ t: Math.round(o.now() * 10) / 10, w: wall(), k: 'export', deviceId: o.deviceId, role: o.role, code: o.code, lines: lines.length, since: first ?? null });
      return [summary, ...lines].join('\n') + '\n';
    },

    async export() {
      const text = await recorder.text();
      const stamp = new Date(wall()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = `mgc-${o.code}-${o.role}-${stamp}.txt`;
      const file = new File([text], name, { type: 'text/plain' });
      const nav = navigator as Navigator & { canShare?(data: ShareData): boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          // No `title`: iOS hands it to some share targets as a text item of its own, which they save as "Text.txt".
          await nav.share({ files: [file] });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return; // the user closed the share sheet
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },

    async clear() {
      pending = [];
      await flushing.catch(() => {});
      await store.clear();
    },

    async count() {
      return (await store.all()).length + pending.length;
    },
  };
  return recorder;
}

/** Lines in memory; for tests. */
export function memoryStore(): LineStore {
  let lines: string[] = [];
  return {
    append: async (more) => void lines.push(...more),
    all: async () => [...lines],
    clear: async () => void (lines = []),
    trim: async (max) => void (lines = lines.slice(-max)),
  };
}

const STORE = 'lines';

/** Lines in IndexedDB database `name`, autoIncrement keys: insertion order is key order. */
export function indexedDbStore(name: string): LineStore {
  let db: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> =>
    (db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const done = (tx: IDBTransaction): Promise<void> =>
    new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  const request = <T>(r: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return {
    async append(lines) {
      const tx = (await open()).transaction(STORE, 'readwrite');
      const s = tx.objectStore(STORE);
      for (const l of lines) s.add(l);
      await done(tx);
    },
    async all() {
      const tx = (await open()).transaction(STORE, 'readonly');
      return request(tx.objectStore(STORE).getAll()) as Promise<string[]>;
    },
    async clear() {
      const tx = (await open()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await done(tx);
    },
    async trim(max) {
      const tx = (await open()).transaction(STORE, 'readwrite');
      const s = tx.objectStore(STORE);
      const n = await request(s.count());
      if (n <= max) return;
      // The oldest `n - max` keys come first; one range delete covers them.
      const keys = await request(s.getAllKeys(undefined, n - max));
      const last = keys[keys.length - 1];
      if (last !== undefined) s.delete(IDBKeyRange.upperBound(last));
      await done(tx);
    },
  };
}
