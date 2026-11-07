import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClockEstimator, HostSession, MemoryHub, PeerSession, type DeviceInfo } from '../src';

const info: DeviceInfo = { name: 'test', width: 390, height: 844, dpr: 3, pxPerMm: 6.1 };

describe('ClockEstimator', () => {
  it('recovers the offset exactly under symmetric latency', () => {
    const est = new ClockEstimator();
    const trueOffset = 12345.6;
    // local t0=100; remote receives after 8ms, replies immediately; local gets it 8ms later
    const t0 = 100;
    const t1 = t0 + 8 + trueOffset;
    const t2 = t1 + 0.5;
    const t3 = t0 + 16.5;
    const s = est.add(t0, t1, t2, t3);
    expect(s.offset).toBeCloseTo(trueOffset, 6);
    expect(s.rtt).toBeCloseTo(16, 6);
  });

  it('ignores samples inflated by queueing when a clean one exists', () => {
    const est = new ClockEstimator();
    const trueOffset = 500;
    // dirty samples: extra 40ms on the uplink skews offset by +20
    for (let i = 0; i < 5; i++) est.add(0, 48 + trueOffset, 48 + trueOffset, 56);
    // one clean sample
    est.add(0, 8 + trueOffset, 8 + trueOffset, 16);
    expect(est.state().offset).toBe(trueOffset);
    expect(est.state().rtt).toBe(16);
  });

  it('reports synced only after MIN_SYNC_SAMPLES', () => {
    const est = new ClockEstimator();
    for (let i = 0; i < 3; i++) est.add(0, 10, 10, 20);
    expect(est.state().synced).toBe(false);
    est.add(0, 10, 10, 20);
    expect(est.state().synced).toBe(true);
  });
});

describe('Host/Peer session over MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('peer converges to host time within the asymmetry bound', () => {
    const up = 6; // peer -> host
    const down = 14; // host -> peer
    const jitter = () => Math.random() * 3;
    const hub = new MemoryHub((from) => (from === 'peer' ? up : down) + jitter());

    const hostEpoch = 1_000_000;
    const hostNow = () => hostEpoch + Date.now();
    const peerNow = () => Date.now(); // true offset = hostEpoch

    const host = new HostSession(hub.connect('host'), hostNow);
    const peer = new PeerSession(hub.connect('peer'), info, peerNow);

    vi.advanceTimersByTime(3000);

    expect(peer.status).toBe('ready');
    expect(peer.hostId).toBe('host');
    const err = Math.abs(peer.clock.now() - host.clock.now());
    // NTP bound: |err| <= |down - up| / 2 (+ jitter slack)
    expect(err).toBeLessThanOrEqual((down - up) / 2 + 3);

    // host saw the peer's device info and clock report
    const entry = host.peers.get('peer');
    expect(entry?.info).toEqual(info);
    expect(entry?.clock?.synced).toBe(true);
  });

  it('peer returns to searching when the host leaves and re-attaches to a new host', () => {
    const hub = new MemoryHub(() => 5);
    const host = new HostSession(hub.connect('host'));
    const peer = new PeerSession(hub.connect('peer'), info);
    vi.advanceTimersByTime(1500);
    expect(peer.status).toBe('ready');

    host.close();
    expect(peer.status).toBe('searching');
    expect(peer.hostId).toBeUndefined();

    new HostSession(hub.connect('host2'));
    vi.advanceTimersByTime(1500);
    expect(peer.hostId).toBe('host2');
    expect(peer.status).toBe('ready');
  });
});
