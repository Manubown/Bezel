import { describe, expect, it } from 'vitest';
import { ClockEstimator } from '../src';

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
