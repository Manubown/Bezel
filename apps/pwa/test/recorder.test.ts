import { MemoryHub, CLOCK_CHANNEL } from '@mgc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecorder, memoryStore } from '../src/recorder';

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
    expect(lines[2]).toMatchObject({ k: 'tick', fps: 30, hidden: false, tx: { info: { n: 2, b: 18 } }, rx: { msg: { n: 1, b: 17 } } });
    expect(lines[3]).toMatchObject({ k: 'peer-leave', peer: 'h', peers: 0 });
  });
});
