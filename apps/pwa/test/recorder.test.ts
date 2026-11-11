import { MemoryHub, CLOCK_CHANNEL, type RosterEntry } from '@mgc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecorder, memoryStore, networkOf } from '../src/recorder';

type Line = { t: number; w: number; k: string } & Record<string, unknown>;

/** The window `observe` needs: frames fired by hand, no viewport. */
function fakeWindow() {
  const frames: FrameRequestCallback[] = [];
  const nothing = () => {};
  const doc = { hidden: false, addEventListener: nothing, removeEventListener: nothing };
  const win = {
    document: doc,
    requestAnimationFrame: (cb: FrameRequestCallback) => frames.push(cb),
    cancelAnimationFrame: nothing,
    addEventListener: nothing,
    removeEventListener: nothing,
    innerWidth: 420,
    innerHeight: 860,
    devicePixelRatio: 2,
    visualViewport: undefined,
  };
  // A stand-in for the few members `observe` reads; nothing else of Window exists here.
  return { win: win as unknown as Window, doc, paint: (n: number) => void frames.splice(0).forEach((cb) => Array.from({ length: n }, () => cb(0))) };
}

function parse(text: string): Line[] {
  return text.trimEnd().split('\n').map((l) => JSON.parse(l) as Line);
}

/** A Peer's recorder whose `tick` lines run on fake timers: `arrive` records one state frame reaching it at shared time `at`, `age` ms after the Host published it. */
function stateRecorder() {
  let now = 0;
  const { win } = fakeWindow();
  const rec = createRecorder({ now: () => now, deviceId: 'd1', role: 'peer', code: 'ABCD', store: memoryStore(), flushMs: 1000, win });
  const stop = rec.observe();
  return {
    arrive(matchId: string, at: number, age: number): void {
      now = at;
      rec.state(matchId, at - age);
    },
    /** Runs to the next `tick` line. */
    second: () => vi.advanceTimersByTimeAsync(1000),
    async ticks(): Promise<Line[]> {
      stop();
      return parse(await rec.text()).filter((l) => l.k === 'tick');
    },
  };
}

describe('session recorder', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes one JSON line per event with shared and wall time, exports them under a summary, and keeps the newest `maxLines`', async () => {
    let now = 1000;
    const store = memoryStore();
    const rec = createRecorder({ now: () => now, wall: () => 1_700_000_000_000 + now, deviceId: 'd0', role: 'host', code: 'ABCD', store, maxLines: 3, flushMs: 100 });
    rec.log('device', { ua: 'test' });
    now = 1500;
    rec.log('roster', { status: 'ready', roster: [{ deviceId: 'd1', rtt: 4.2 }] });
    expect(await rec.count()).toBe(2);

    const lines = parse(await rec.text());
    expect(lines[0]).toMatchObject({ k: 'export', deviceId: 'd0', role: 'host', code: 'ABCD', lines: 2, since: 1_700_000_001_000 });
    expect(lines[1]).toEqual({ t: 1000, w: 1_700_000_001_000, k: 'device', ua: 'test' });
    expect(lines[2]).toEqual({ t: 1500, w: 1_700_000_001_500, k: 'roster', status: 'ready', roster: [{ deviceId: 'd1', rtt: 4.2 }] });
    // A data key named like the line's own goes under `data`, never over the timestamp.
    rec.log('odd', { w: 420, size: 1 });
    expect(parse(await rec.text()).at(-1)).toEqual({ t: 1500, w: 1_700_000_001_500, k: 'odd', size: 1, data: { w: 420 } });
    await rec.clear();

    for (let i = 0; i < 4; i++) rec.log('tick', { i });
    const ring = parse(await rec.text()).slice(1);
    expect(ring.map((l) => l['i'])).toEqual([1, 2, 3]);
    expect(await store.all()).toHaveLength(3);

    await rec.clear();
    expect(await rec.count()).toBe(0);
    expect(parse(await rec.text())).toHaveLength(1);
  });

  it('counts frames and bytes per channel in both directions, logs peers, and measures a Peer’s clock samples', async () => {
    const hub = new MemoryHub();
    const hostT = hub.connect('h');
    const store = memoryStore();
    const { win, paint } = fakeWindow();
    const rec = createRecorder({ now: () => 0, deviceId: 'd1', role: 'peer', code: 'ABCD', store, flushMs: 1000, win });
    const peerT = rec.transport(hub.connect('p'));
    const got: unknown[] = [];
    peerT.onMessage('msg', (d) => got.push(d));
    const stop = rec.observe();

    hostT.send('msg', { hello: 'world' }, 'p'); // 17 bytes as JSON
    peerT.send('info', { w: 420 }, 'h'); // 9 bytes
    peerT.send('info', { w: 421 }, 'h');
    // A clock reply: sent at t0, answered 1 ms later at the Host after a 2 ms flight.
    const t0 = performance.now() - 5;
    hostT.send(CLOCK_CHANNEL, { q: 7, t0, t1: t0 + 2 + 100, t2: t0 + 3 + 100 }, 'p');
    await vi.advanceTimersByTimeAsync(1); // the hub delivers
    expect(got).toEqual([{ hello: 'world' }]);
    paint(30);
    await vi.advanceTimersByTimeAsync(1000); // the tick and the flush
    hub.disconnect('h');
    stop();
    await vi.advanceTimersByTimeAsync(1000);

    const lines = parse(await rec.text()).slice(1);
    const kinds = lines.map((l) => l.k);
    expect(kinds).toEqual(['viewport', 'clock', 'tick', 'peer-leave']);
    expect(lines[0]).toMatchObject({ k: 'viewport', width: 420, height: 860, dpr: 2 });
    const clock = lines[1]!;
    expect(clock['q']).toBe(7);
    // Fake timers freeze `performance.now`, so t3 = t0 + 5: rtt = (t3 − t0) − (t2 − t1) = 4, offset = ((t1 − t0) + (t2 − t3)) / 2 = 100.
    expect(clock['rtt']).toBeCloseTo(4, 6);
    expect(clock['offset']).toBeCloseTo(100, 6);
    // `clk` is not in `rx`: only channels subscribed through the wrapper count, and here only `msg` is (the recorder's own clock listener sits on the inner transport).
    // `peers`: the wrapped transport's connections (the Host's); `wake`: no `awake` given.
    expect(lines[2]).toMatchObject({ k: 'tick', fps: 30, hidden: false, wake: false, peers: 1, tx: { info: { n: 2, b: 18 } }, rx: { msg: { n: 1, b: 17 } } });
    expect(lines[3]).toMatchObject({ k: 'peer-leave', peer: 'h', peers: 0 });
  });

  it('logs a `link` line for each Device’s first entry and for each change of its link, nothing for the same value again', async () => {
    const rec = createRecorder({ now: () => 0, deviceId: 'd0', role: 'host', code: 'ABCD', store: memoryStore() });
    const entry = (deviceId: string, link: RosterEntry['link']): RosterEntry => ({
      info: { deviceId, name: deviceId, width: 400, height: 800, dpr: 2, pxPerMm: 6 },
      present: link !== 'lost',
      link,
      sync: { synced: true },
    });
    let roster = [entry('d0', 'ok')];
    const handlers = new Set<() => void>();
    const stop = rec.links({
      roster: () => roster,
      onChange: (h) => {
        handlers.add(h);
        return () => handlers.delete(h);
      },
    });
    const change = (d1: RosterEntry['link']): void => {
      roster = [entry('d0', 'ok'), entry('d1', d1)];
      handlers.forEach((h) => h());
    };
    change('ok');
    change('ok'); // a clock report: the roster changed, no link did
    change('weak');
    change('lost');
    change('ok');
    stop();
    change('weak');

    const links = parse(await rec.text())
      .slice(1)
      .map((l) => [l.k, l['deviceId'], l['link']]);
    expect(links).toEqual([
      ['link', 'd0', 'ok'],
      ['link', 'd1', 'ok'],
      ['link', 'd1', 'weak'],
      ['link', 'd1', 'lost'],
      ['link', 'd1', 'ok'],
    ]);
  });

  it('sums the state frames of a second into its `tick` line: count, ages, longest gap; nothing for a quiet second; afresh each second', async () => {
    const { arrive, second, ticks } = stateRecorder();
    arrive('m1', 100, 10); // the Match's first state: no gap
    arrive('m1', 116.2, 15.2); // 16.2 ms later
    arrive('m1', 150.04, 5.04); // 33.84 ms later
    await second();
    await second();
    arrive('m1', 2100, 30);
    arrive('m1', 2110, 20);
    await second();

    const [busy, quiet, next] = await ticks();
    expect(busy!['state']).toEqual({ n: 3, gap: 33.8, ageMin: 5, ageAvg: 10.1, ageMax: 15.2 });
    expect(quiet).not.toHaveProperty('state');
    // Only this second's two arrivals; the gap before the first of them spans the quiet second.
    expect(next!['state']).toEqual({ n: 2, gap: 1950, ageMin: 20, ageAvg: 25, ageMax: 30 });
  });

  it('reports a silence as `gap` on the line of the second that ends it, and starts each Match without one', async () => {
    const { arrive, second, ticks } = stateRecorder();
    arrive('m1', 500, 8);
    await second();
    await second();
    arrive('m1', 2800, 12); // 2.3 s after the last one, two tick lines later
    await second();
    arrive('m2', 3100, 9); // a new Match: its first state has no predecessor
    await second();
    arrive('m2', 4300, 9);
    arrive('m1', 4310, 4); // back to `m1`: a new sequence again, not 1.51 s after its last state
    await second();

    expect((await ticks()).map((l) => l['state'])).toEqual([
      { n: 1, gap: 0, ageMin: 8, ageAvg: 8, ageMax: 8 },
      undefined,
      { n: 1, gap: 2300, ageMin: 12, ageAvg: 12, ageMax: 12 },
      { n: 1, gap: 0, ageMin: 9, ageAvg: 9, ageMax: 9 },
      { n: 2, gap: 1200, ageMin: 4, ageAvg: 6.5, ageMax: 9 },
    ]);
  });
});

describe('networkOf', () => {
  it("tells an iPhone hotspot's own subnet, carrier NAT and public addresses from other private ones", () => {
    expect(networkOf('172.20.10.1')).toBe('hotspot');
    expect(networkOf('172.20.10.15')).toBe('hotspot');
    expect(networkOf('172.20.10.16')).toBe('private'); // the hotspot is a /28
    expect(networkOf('192.168.0.185')).toBe('private');
    expect(networkOf('10.134.2.7')).toBe('private');
    expect(networkOf('192.0.0.2')).toBe('private'); // an iPhone joined to an iPhone hotspot since iOS 18
    expect(networkOf('100.64.0.1')).toBe('cgnat');
    expect(networkOf('100.127.255.254')).toBe('cgnat');
    expect(networkOf('100.128.0.1')).toBe('public');
    expect(networkOf('84.17.3.9')).toBe('public');
  });

  it('names what is not an IPv4 address by its kind, and an address the browser withholds as hidden', () => {
    expect(networkOf('')).toBe('hidden');
    expect(networkOf('3f2a8c1e-0b7d-4c55-9d0e-1f2a3b4c5d6e.local')).toBe('mdns');
    expect(networkOf('fe80::1c2d:3e4f:5a6b:7c8d')).toBe('link-local');
    expect(networkOf('2a01:598:b1a2::17')).toBe('v6');
    expect(networkOf('169.254.12.3')).toBe('link-local');
  });
});
