import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type DeviceId, type DeviceInfo, type Session } from '../src';

const info = (deviceId: DeviceId): DeviceInfo => ({ deviceId, name: deviceId, width: 390, height: 844, dpr: 3, pxPerMm: 6.1 });

/** Everything `session` receives on the test channel, with the sender's DeviceId. */
function inbox(session: Session): Array<{ data: unknown; from: DeviceId }> {
  const got: Array<{ data: unknown; from: DeviceId }> = [];
  session.onMessage('app', (data, from) => got.push({ data, from }));
  return got;
}

const presence = (s: Session) => s.roster().map((e) => [e.info.deviceId, e.present]);

/** Host `d0` with Peers `d1` and `d2`, all synced. */
function table() {
  const hub = new MemoryHub(() => 5);
  const host = hostSession(hub.connect('h'), info('d0'));
  const p1 = joinSession(hub.connect('p1'), info('d1'));
  vi.advanceTimersByTime(100);
  const p2 = joinSession(hub.connect('p2'), info('d2'));
  vi.advanceTimersByTime(2500);
  return { hub, host, p1, p2 };
}

describe('Session over MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('host and two peers converge to one roster keyed by deviceId, all synced to the host clock', () => {
    const up = 6; // peer -> host
    const down = 14; // host -> peer
    let k = 0;
    const jitter = () => (k++ * 7) % 3;
    const hub = new MemoryHub((from) => (from === 'h' ? down : up) + jitter());
    const hostNow = () => 1_000_000 + Date.now();
    const peerNow = () => Date.now(); // true offset = 1_000_000

    const host = hostSession(hub.connect('h'), info('d0'), hostNow);
    const p1 = joinSession(hub.connect('p1'), info('d1'), peerNow);
    vi.advanceTimersByTime(100);
    const p2 = joinSession(hub.connect('p2'), info('d2'), peerNow);
    vi.advanceTimersByTime(3000);

    expect([host.status, p1.status, p2.status]).toEqual(['ready', 'ready', 'ready']);
    expect([host.role, p1.role, p2.role]).toEqual(['host', 'peer', 'peer']);
    for (const s of [host, p1, p2]) {
      expect(s.roster().map((e) => ({ id: e.info.deviceId, present: e.present, synced: e.sync.synced }))).toEqual([
        { id: 'd0', present: true, synced: true },
        { id: 'd1', present: true, synced: true },
        { id: 'd2', present: true, synced: true },
      ]);
      expect(s.roster().map((e) => e.info)).toEqual([info('d0'), info('d1'), info('d2')]);
    }
    for (const p of [p1, p2]) {
      // NTP bound: |err| <= |down - up| / 2 (+ jitter slack)
      expect(Math.abs(p.clock.now() - host.clock.now())).toBeLessThanOrEqual((down - up) / 2 + 3);
    }
  });

  it('send to a deviceId arrives only at that Device, from the sender deviceId; a Peer cannot send before ready', () => {
    const hub = new MemoryHub(() => 5);
    const host = hostSession(hub.connect('h'), info('d0'));
    const atHost = inbox(host);
    const p1 = joinSession(hub.connect('p1'), info('d1'));
    p1.send('app', 'too early'); // no Host yet: dropped
    vi.advanceTimersByTime(100);
    expect(p1.status).toBe('syncing');
    p1.send('app', 'while syncing'); // not ready: dropped
    const p2 = joinSession(hub.connect('p2'), info('d2'));
    vi.advanceTimersByTime(2500);
    const atP1 = inbox(p1);
    const atP2 = inbox(p2);

    host.send('app', 'd0 to d2', 'd2');
    p1.send('app', 'd1 to d2', 'd2');
    p2.send('app', 'd2 to d0', 'd0');
    p1.send('app', 'd1 to all');
    vi.advanceTimersByTime(100);

    expect(atHost).toEqual([
      { data: 'd2 to d0', from: 'd2' },
      { data: 'd1 to all', from: 'd1' },
    ]);
    expect(atP1).toEqual([]);
    expect(atP2).toEqual([
      { data: 'd0 to d2', from: 'd0' },
      { data: 'd1 to d2', from: 'd1' },
      { data: 'd1 to all', from: 'd1' },
    ]);
  });

  it('a Device that drops and reconnects under a new connection takes over its entry', () => {
    const { hub, host, p1, p2 } = table();
    const seen: string[] = [];
    host.onDeviceLost((d) => seen.push(`host: lost ${d}`));
    host.onDeviceBack((d) => seen.push(`host: back ${d}`));
    p1.onDeviceLost((d) => seen.push(`p1: lost ${d}`));
    p1.onDeviceBack((d) => seen.push(`p1: back ${d}`));

    p2.close();
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['host: lost d2', 'p1: lost d2']);
    for (const s of [host, p1]) expect(presence(s)).toEqual([['d0', true], ['d1', true], ['d2', false]]);

    const p2b = joinSession(hub.connect('p2b'), info('d2'));
    vi.advanceTimersByTime(2500);
    expect(seen).toEqual(['host: lost d2', 'p1: lost d2', 'host: back d2', 'p1: back d2']);
    for (const s of [host, p1, p2b]) {
      expect(presence(s)).toEqual([['d0', true], ['d1', true], ['d2', true]]);
      expect(s.roster()[2]!.sync.synced).toBe(true);
    }

    const atP2b = inbox(p2b);
    host.send('app', 'welcome back', 'd2');
    p1.send('app', 'hi d2', 'd2');
    vi.advanceTimersByTime(100);
    expect(atP2b).toEqual([
      { data: 'welcome back', from: 'd0' },
      { data: 'hi d2', from: 'd1' },
    ]);
  });

  it('messages from a connection replaced by a rebind are dropped, and its late leave is ignored', () => {
    const { hub, host, p1, p2 } = table();
    const seen: string[] = [];
    host.onDeviceLost((d) => seen.push(`lost ${d}`));
    host.onDeviceBack((d) => seen.push(`back ${d}`));

    // The Device reconnects before its old connection is noticed as gone.
    const p2b = joinSession(hub.connect('p2b'), info('d2'));
    vi.advanceTimersByTime(2500);
    expect(seen).toEqual(['lost d2', 'back d2']);
    expect(host.roster()).toHaveLength(3);

    const atHost = inbox(host);
    const atP1 = inbox(p1);
    const atOld = inbox(p2);
    const atNew = inbox(p2b);
    p2.send('app', 'stale');
    p2.send('app', 'stale to d1', 'd1');
    p2b.send('app', 'fresh');
    host.send('app', 'to d2', 'd2');
    vi.advanceTimersByTime(100);

    expect(atHost).toEqual([{ data: 'fresh', from: 'd2' }]);
    expect(atP1).toEqual([{ data: 'fresh', from: 'd2' }]);
    expect(atNew).toEqual([{ data: 'to d2', from: 'd0' }]);
    expect(atOld).toEqual([]);

    p2.close();
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['lost d2', 'back d2']);
    expect(presence(host)).toEqual([['d0', true], ['d1', true], ['d2', true]]);
  });

  it('the Host leaving ends the Session for a Peer: searching, empty roster', () => {
    const { host, p1 } = table();
    expect(p1.status).toBe('ready');
    expect(p1.roster()).toHaveLength(3);

    host.close();

    expect(p1.status).toBe('searching');
    expect(p1.roster()).toEqual([]);
  });
});
