import { describe, expect, it } from 'vitest';
import { RELAY_PROBE_MS, RELAY_STABLE_MS, RelayEscalation } from '../src/relay-escalation';

/** One attempt in `'all'` mode: a connection that lives `lived` ms, then a reset; returns the time of that reset. */
function attempt(policy: RelayEscalation, at: number, lived: number): number {
  policy.joined('host', at);
  policy.reset(at + lived);
  return at + lived;
}

describe('RelayEscalation in all mode', () => {
  it('switches to the relay after exactly `after` short-lived connections in a row', () => {
    const policy = new RelayEscalation(3);
    let t = attempt(policy, 0, 1000);
    t = attempt(policy, t + 100, 1000);
    expect(policy.mode).toBe('all');
    expect(policy.failures).toBe(2);
    expect(policy.deadline).toBeNull();
    policy.joined('host', t + 100);
    expect(policy.reset(t + 1100)).toBe('relay');
    expect(policy.mode).toBe('relay');
    expect(policy.failures).toBe(3);
  });

  it('counts a connection that lived just under RELAY_STABLE_MS as a failure', () => {
    const policy = new RelayEscalation(1);
    policy.joined('host', 0);
    expect(policy.reset(RELAY_STABLE_MS - 1)).toBe('relay');
  });

  it('treats a connection that lived exactly RELAY_STABLE_MS as working: the streak restarts and the reset is not counted', () => {
    const policy = new RelayEscalation(2);
    let t = attempt(policy, 0, 1000);
    expect(policy.failures).toBe(1);
    t = attempt(policy, t, RELAY_STABLE_MS);
    expect(policy.failures).toBe(0);
    expect(policy.mode).toBe('all');
    t = attempt(policy, t, 1000);
    expect(policy.mode).toBe('all');
    attempt(policy, t, 1000);
    expect(policy.mode).toBe('relay');
  });

  it('judges a reset by the longest-lived connection since the previous one, ended or still up', () => {
    const policy = new RelayEscalation(2);
    let t = attempt(policy, 0, 1000);
    policy.joined('a', t);
    policy.left('a', t + RELAY_STABLE_MS);
    policy.joined('a', t + RELAY_STABLE_MS + 10);
    policy.reset(t + RELAY_STABLE_MS + 20);
    expect(policy.failures).toBe(0);

    t = attempt(policy, t + RELAY_STABLE_MS + 20, 1000);
    expect(policy.failures).toBe(1);
    policy.joined('a', t);
    policy.joined('b', t + 10);
    policy.left('b', t + 20);
    policy.reset(t + RELAY_STABLE_MS);
    expect(policy.failures).toBe(0);
    expect(policy.mode).toBe('all');
  });

  it('restarts the streak after a long-lived connection in the middle of it', () => {
    const policy = new RelayEscalation(3);
    let t = attempt(policy, 0, 1000);
    t = attempt(policy, t, 1000);
    t = attempt(policy, t, 60_000);
    expect(policy.failures).toBe(0);
    t = attempt(policy, t, 1000);
    t = attempt(policy, t, 1000);
    expect(policy.mode).toBe('all');
    attempt(policy, t, 1000);
    expect(policy.mode).toBe('relay');
  });

  it('leaves the streak alone on a reset with no connection since the previous reset', () => {
    const policy = new RelayEscalation(2);
    const t = attempt(policy, 0, 1000);
    policy.reset(t + 30_000);
    policy.reset(t + 60_000);
    expect(policy.failures).toBe(1);
    expect(policy.mode).toBe('all');
    attempt(policy, t + 60_000, 1000);
    expect(policy.mode).toBe('relay');
  });

  it('does not count a connection that ended before the previous reset again', () => {
    const policy = new RelayEscalation(2);
    policy.joined('host', 0);
    policy.left('host', 1000);
    policy.reset(2000);
    policy.reset(3000);
    expect(policy.failures).toBe(1);
  });

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])('never escalates with after = %s', (after) => {
    const policy = new RelayEscalation(after);
    let t = 0;
    for (let i = 0; i < 50; i++) t = attempt(policy, t, 10);
    expect(policy.mode).toBe('all');
    expect(policy.deadline).toBeNull();
    expect(policy.expire(t + 10 * RELAY_PROBE_MS)).toBe(false);
  });
});

describe('RelayEscalation in relay mode', () => {
  /** A policy that switched to the relay at t = 1000. */
  function escalated(): RelayEscalation {
    const policy = new RelayEscalation(1);
    policy.joined('host', 0);
    policy.reset(1000);
    return policy;
  }

  it('returns to all with streak 0 when no connection comes up within RELAY_PROBE_MS of the switch', () => {
    const policy = escalated();
    expect(policy.deadline).toBe(1000 + RELAY_PROBE_MS);
    expect(policy.expire(1000 + RELAY_PROBE_MS - 1)).toBe(false);
    expect(policy.mode).toBe('relay');
    expect(policy.expire(1000 + RELAY_PROBE_MS)).toBe(true);
    expect(policy.mode).toBe('all');
    expect(policy.failures).toBe(0);
    expect(policy.deadline).toBeNull();
  });

  it('escalates again only after another `after` failures once it is back in all', () => {
    const policy = new RelayEscalation(2);
    let t = attempt(policy, 0, 1000);
    t = attempt(policy, t, 1000);
    expect(policy.expire(t + RELAY_PROBE_MS)).toBe(true);
    t = attempt(policy, t + RELAY_PROBE_MS, 1000);
    expect(policy.mode).toBe('all');
    attempt(policy, t, 1000);
    expect(policy.mode).toBe('relay');
  });

  it('does not count resets, and each one restarts the probe deadline', () => {
    const policy = escalated();
    policy.joined('host', 2000);
    expect(policy.reset(3000)).toBe('relay');
    expect(policy.failures).toBe(1);
    expect(policy.deadline).toBe(3000 + RELAY_PROBE_MS);
    expect(policy.reset(5000)).toBe('relay');
    expect(policy.deadline).toBe(5000 + RELAY_PROBE_MS);
    expect(policy.expire(5000 + RELAY_PROBE_MS - 1)).toBe(false);
    expect(policy.expire(5000 + RELAY_PROBE_MS)).toBe(true);
  });

  it('holds no deadline while a connection is up, however long', () => {
    const policy = escalated();
    policy.joined('host', 1000 + RELAY_PROBE_MS - 1);
    expect(policy.deadline).toBeNull();
    expect(policy.expire(1000 + 10 * RELAY_PROBE_MS)).toBe(false);
    expect(policy.mode).toBe('relay');
  });

  it('starts the deadline again when its last connection ends, so a relay that stops answering is given up', () => {
    const policy = escalated();
    policy.joined('host', 2000);
    policy.joined('other', 2500);
    policy.left('host', 50_000);
    // Another connection is still up: the relay answers.
    expect(policy.deadline).toBeNull();
    policy.left('other', 60_000);
    expect(policy.deadline).toBe(60_000 + RELAY_PROBE_MS);
    expect(policy.expire(60_000 + RELAY_PROBE_MS - 1)).toBe(false);
    expect(policy.expire(60_000 + RELAY_PROBE_MS)).toBe(true);
    expect(policy.mode).toBe('all');
    expect(policy.failures).toBe(0);
  });

  it('stays on the relay when a connection comes back before the deadline', () => {
    const policy = escalated();
    policy.joined('host', 2000);
    policy.left('host', 30_000);
    policy.joined('host', 30_000 + RELAY_PROBE_MS - 1);
    expect(policy.expire(30_000 + RELAY_PROBE_MS)).toBe(false);
    expect(policy.mode).toBe('relay');
  });

  it('forgets what the relay carried when it goes back to all: the next short connection is a failure', () => {
    const policy = new RelayEscalation(1);
    policy.joined('host', 0);
    policy.reset(1000);
    // A relay connection that lasted, then the Host went away for good.
    policy.joined('host', 2000);
    policy.left('host', 2000 + RELAY_STABLE_MS);
    const back = 2000 + RELAY_STABLE_MS + RELAY_PROBE_MS;
    expect(policy.expire(back)).toBe(true);
    policy.joined('host', back + 500);
    expect(policy.reset(back + 4500)).toBe('relay');
  });
});
