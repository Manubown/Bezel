import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOCK_CHANNEL,
  LOST_MS,
  MemoryHub,
  SYNC_TIMEOUT_MS,
  WEAK_MS,
  hostSession,
  joinSession,
  type DeviceId,
  type DeviceInfo,
  type Session,
  type SessionStatus,
} from '../src';

const info = (deviceId: DeviceId): DeviceInfo => ({ deviceId, name: deviceId, width: 390, height: 844, dpr: 3, pxPerMm: 6.1 });

/** One Session check: a threshold crossed is seen within this. */
const CHECK = 500;

/** `[deviceId, link]` per roster entry, checking on the way that `present` is `link !== 'lost'`. */
const presence = (s: Session) =>
  s.roster().map((e) => {
    expect(e.present).toBe(e.link !== 'lost');
    return [e.info.deviceId, e.link];
  });

const linkOf = (s: Session, id: DeviceId) => s.roster().find((e) => e.info.deviceId === id)?.link;

/** `s.status` now, then each change of it. */
function statuses(s: Session): SessionStatus[] {
  const seen = [s.status];
  s.onChange(() => {
    if (seen[seen.length - 1] !== s.status) seen.push(s.status);
  });
  return seen;
}

/** Host `d0` on `h`, Peers `d1` on `p1` and `d2` on `p2`, all ready; 5 ms each way, 1 Hz heartbeats under way. */
function table() {
  const hub = new MemoryHub(() => 5);
  const ht = hub.connect('h');
  const host = hostSession(ht, info('d0'));
  const p1t = hub.connect('p1');
  const p1 = joinSession(p1t, info('d1'));
  const p2 = joinSession(hub.connect('p2'), info('d2'));
  vi.advanceTimersByTime(2500);
  expect([host.status, p1.status, p2.status]).toEqual(['ready', 'ready', 'ready']);
  return { hub, ht, host, p1t, p1, p2 };
}

describe('Liveness over MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('a severed link drops traffic both ways without a leave; after WEAK_MS each side shows the other weak', () => {
    const { hub, ht, host, p1t, p1, p2 } = table();
    const left = vi.fn();
    ht.onPeerLeave(left);
    p1t.onPeerLeave(left);
    const lost = vi.fn();
    host.onDeviceLost(lost);
    p1.onDeviceLost(lost);

    hub.sever('h', 'p1');
    vi.advanceTimersByTime(1000); // a missed beat is not weak yet
    expect([linkOf(host, 'd1'), linkOf(p1, 'd0')]).toEqual(['ok', 'ok']);
    vi.advanceTimersByTime(WEAK_MS + CHECK - 1000);

    expect(linkOf(host, 'd1')).toBe('weak');
    expect(linkOf(p1, 'd0')).toBe('weak');
    expect(linkOf(p2, 'd1')).toBe('weak'); // the Host's word
    expect(presence(host)).toEqual([['d0', 'ok'], ['d1', 'weak'], ['d2', 'ok']]);
    expect(p1.status).toBe('ready');
    expect(left).not.toHaveBeenCalled();
    expect(lost).not.toHaveBeenCalled();
  });

  it('after LOST_MS the Host loses the Peer, and the Peer is reconnecting with a reset transport: one leave and one join of its id', () => {
    const { hub, ht, host, p1t, p1 } = table();
    const seen = statuses(p1);
    const lost: DeviceId[] = [];
    host.onDeviceLost((d) => lost.push(d));
    const hubSaw: string[] = [];
    ht.onPeerLeave((id) => hubSaw.push(`leave ${id}`));
    ht.onPeerJoin((id) => hubSaw.push(`join ${id}`));
    const reset = vi.spyOn(p1t, 'reset');

    hub.sever('h', 'p1');
    vi.advanceTimersByTime(LOST_MS - 1500);
    expect(lost).toEqual([]);
    expect(reset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500 + CHECK);

    expect(lost).toEqual(['d1']);
    expect(seen.slice(0, 2)).toEqual(['ready', 'reconnecting']);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(hubSaw).toEqual(['leave p1', 'join p1']);
  });

  it('the reset heals the sever: the Peer re-attaches (syncing → ready), the Host reports it back, roster length unchanged, messages reach it', () => {
    const { hub, host, p1t, p1, p2 } = table();
    const seen = statuses(p1);
    const events: string[] = [];
    host.onDeviceLost((d) => events.push(`lost ${d}`));
    host.onDeviceBack((d) => events.push(`back ${d}`));
    const reset = vi.spyOn(p1t, 'reset');

    hub.sever('h', 'p1');
    vi.advanceTimersByTime(LOST_MS + CHECK + 1000);

    expect(seen).toEqual(['ready', 'reconnecting', 'syncing', 'ready']);
    expect(events).toEqual(['lost d1', 'back d1']);
    for (const s of [host, p1, p2]) {
      expect(presence(s)).toEqual([['d0', 'ok'], ['d1', 'ok'], ['d2', 'ok']]);
      expect(s.roster()[1]!.sync.synced).toBe(true);
    }

    const atP1: Array<{ data: unknown; from: DeviceId }> = [];
    p1.onMessage('app', (data, from) => atP1.push({ data, from }));
    host.send('app', 'to d1', 'd1');
    p2.send('app', 'd2 to d1', 'd1');
    vi.advanceTimersByTime(100);
    expect(atP1).toEqual([
      { data: 'to d1', from: 'd0' },
      { data: 'd2 to d1', from: 'd2' },
    ]);

    // The new connection holds.
    vi.advanceTimersByTime(LOST_MS * 3);
    expect(events).toEqual(['lost d1', 'back d1']);
    expect(p1.status).toBe('ready');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('a Peer greeted by a Host whose clock never answers gives up after SYNC_TIMEOUT_MS: reset, reconnecting', () => {
    const hub = new MemoryHub(() => 5);
    const host = hostSession(hub.connect('h'), info('d0'));
    hub.sever('h', 'p1', CLOCK_CHANNEL);
    const p1t = hub.connect('p1');
    const reset = vi.spyOn(p1t, 'reset');
    const p1 = joinSession(p1t, info('d1'));
    const seen = statuses(p1);

    vi.advanceTimersByTime(SYNC_TIMEOUT_MS - CHECK);
    expect(p1.status).toBe('syncing'); // greeted, never synced
    expect(reset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * CHECK);

    expect(reset).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['searching', 'syncing', 'reconnecting']);

    // The reset healed the clock channel too: the next attach syncs.
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(['searching', 'syncing', 'reconnecting', 'syncing', 'ready']);
    expect(presence(host)).toEqual([['d0', 'ok'], ['d1', 'ok']]);
  });

  it('a Peer that never hears a Host stays searching: nothing times out, nothing resets, not even when that Host leaves', () => {
    const hub = new MemoryHub(() => 5);
    const host = hostSession(hub.connect('h'), info('d0'));
    hub.sever('h', 'p1');
    const p1t = hub.connect('p1');
    const reset = vi.spyOn(p1t, 'reset');
    const p1 = joinSession(p1t, info('d1'));
    const seen = statuses(p1);

    vi.advanceTimersByTime(LOST_MS * 3);
    host.close();
    vi.advanceTimersByTime(LOST_MS);

    expect(seen).toEqual(['searching']);
    expect(p1.roster()).toEqual([]);
    expect(reset).not.toHaveBeenCalled();
  });

  it('a Host whose Peer stays silent marks it lost without resetting its own transport', () => {
    const { ht, host, p1t, p2 } = table();
    const hostReset = vi.spyOn(ht, 'reset');
    const lost: DeviceId[] = [];
    host.onDeviceLost((d) => lost.push(d));
    vi.spyOn(p1t, 'send').mockImplementation(() => {}); // mute: its connection stays up

    vi.advanceTimersByTime(LOST_MS + 1000);
    expect(lost).toEqual(['d1']);
    expect(presence(host)).toEqual([['d0', 'ok'], ['d1', 'lost'], ['d2', 'ok']]);
    expect(linkOf(p2, 'd1')).toBe('lost');

    vi.advanceTimersByTime(LOST_MS * 4);
    expect(lost).toEqual(['d1']);
    expect(hostReset).not.toHaveBeenCalled();
  });
});
