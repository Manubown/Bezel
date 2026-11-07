import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId, MatchResult } from '../src';
import { eventsOf, matchOf, probeGame, settle, startMatch, step, tapLink, type Tapped } from './harness';

/** Host + 3 Peers: three Tiles in a row and one Controller. */
const HOST = 'd0';
const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: ['d3'], tickHz: 50 });
const DEVICES: DeviceId[] = ['d0', 'd1', 'd2', 'd3'];
const PEERS: DeviceId[] = ['d1', 'd2', 'd3'];
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;

/** A probe-thrown error as the fault event carries it. */
const faultOf = (where: string, message: string) => ({ t: 'fault', where, message, stack: expect.stringContaining(message) });

describe('fault isolation and the close ladder: Host + 3 Peers over the in-memory hub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports a throwing tick as one fault and runs the next tick; a fourth fault within five seconds closes the Match on every Device', async () => {
    // At 50 Hz: 60 ms, 0.8 s, 1.6 s, 2.4 s.
    const throwsOn = new Set([3, 40, 80, 120]);
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (throwsOn.has(n)) throw new Error(`probe: tick ${n}`);
        ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 4; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const host = rig.devices.get(HOST)!;
    expect(eventsOf(host.events, 'fault')).toEqual([faultOf('host.tick', 'probe: tick 3')]);
    expect(rec.ticks).toHaveLength(4);
    for (const id of DEVICES) expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 4]);

    while (rec.ticks.length < 119) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(eventsOf(host.events, 'fault')).toHaveLength(3);
    for (const id of DEVICES) expect(eventsOf(rig.devices.get(id)!.events, 'closed'), id).toEqual([]);

    await step(rig, STEP_MS); // tick 120: the fourth fault within five seconds
    await settle(LATENCY_MS);
    const detail = '4 faults within 5 s, the last host.tick: probe: tick 120';
    expect(host.events.slice(-2)).toEqual([faultOf('host.tick', 'probe: tick 120'), { t: 'closed', reason: 'fault', detail }]);
    for (const id of PEERS) expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'closed', reason: 'fault', detail }]);
    for (const id of DEVICES) {
      expect(rec.ends.get(id), id).toEqual([{ reason: 'fault' }]);
      expect(rig.devices.get(id)!.screen.children, id).toEqual([]);
    }

    for (let i = 0; i < 5; i++) await step(rig, STEP_MS);
    expect(rec.ticks).toHaveLength(120);
  });

  it('lets faults further apart than the window go on: one every two seconds never closes the Match', async () => {
    // At 50 Hz: every 2 s, so a five-second window never holds more than three.
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (n % 100 === 0) throw new Error(`probe: tick ${n}`);
        ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    while (rec.ticks.length < 501) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(eventsOf(rig.devices.get(HOST)!.events, 'fault')).toHaveLength(5);
    for (const id of DEVICES) expect(eventsOf(rig.devices.get(id)!.events, 'closed'), id).toEqual([]);
    expect(rec.states.get('d3')!.at(-1)!.state.n).toBe(501);
  });

  it('closes only a Peer’s view whose factory throws; the Host and every other view go on', async () => {
    const { game, rec } = probeGame({
      view(ctx) {
        if (ctx.deviceId === 'd2') throw new Error('probe: no view on d2');
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const d2 = rig.devices.get('d2')!;
    expect(d2.events).toEqual([
      { t: 'started' },
      faultOf('view.factory', 'probe: no view on d2'),
      { t: 'closed', reason: 'fault', detail: 'view.factory: probe: no view on d2' },
    ]);
    expect(d2.screen.children).toEqual([]);
    for (const id of ['d0', 'd1', 'd3']) {
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3]);
    }
    expect(rec.ticks).toHaveLength(3);
  });

  it('closes only the Host’s own view when its factory throws; the Host game ticks on for the Peers', async () => {
    const { game, rec } = probeGame({
      view(ctx) {
        if (ctx.deviceId === HOST) throw new Error('probe: no view on the Host');
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const host = rig.devices.get(HOST)!;
    expect(host.events).toEqual([
      { t: 'started' },
      faultOf('view.factory', 'probe: no view on the Host'),
      { t: 'view-closed', reason: 'fault', detail: 'view.factory: probe: no view on the Host' },
    ]);
    expect(host.screen.children).toEqual([]);
    expect(rec.ticks).toHaveLength(3);
    for (const id of PEERS) {
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3]);
    }
  });

  it('closes with version, before init, a game whose ready speaks another wire version', async () => {
    const { game, rec } = probeGame();
    let tap: Tapped | undefined;
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      link(id, base) {
        if (id !== HOST) return base;
        tap = tapLink(base, (f, side) => (side === 'host' && f.t === 'ready' ? { ...f, v: 2 } : f));
        return tap.link;
      },
    });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const detail = 'host link: the game speaks wire v2, the platform v1';
    expect(rig.devices.get(HOST)!.events).toEqual([{ t: 'closed', reason: 'version', detail }]);
    // Nothing reached the host game: no init, so its factory never ran, and no tick.
    expect(tap!.down.host).toEqual([]);
    expect(rec.host).toBeUndefined();
    expect(rec.ticks).toEqual([]);
    for (const id of PEERS) expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'closed', reason: 'version', detail }]);
    for (const id of DEVICES) expect(rec.ends.get(id), id).toEqual([{ reason: 'version' }]);
  });

  it('closes with protocol a view link that hears an out-of-order frame (that view only) and a host link that hears an unknown one (the Match)', async () => {
    const { game, rec } = probeGame();
    const taps = new Map<DeviceId, Tapped>();
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      link(id, base) {
        const tap = tapLink(base);
        taps.set(id, tap);
        return tap.link;
      },
    });
    await settle();
    for (let i = 0; i < 2; i++) await step(rig, STEP_MS);

    // A second `ready` on d1's view link, long after `init`.
    taps.get('d1')!.inject('view', { v: 1, t: 'ready', side: 'view', sdk: '0.0.0' });
    for (let i = 0; i < 2; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rig.devices.get('d1')!.events).toEqual([{ t: 'started' }, { t: 'closed', reason: 'protocol', detail: 'view link: unexpected ready' }]);
    expect(rec.ends.get('d1')).toEqual([{ reason: 'protocol' }]);
    expect(rec.ticks).toHaveLength(4);
    for (const id of ['d0', 'd2', 'd3']) {
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3, 4]);
    }

    // A frame no wire version knows, on the host link.
    taps.get(HOST)!.inject('host', { v: 1, t: 'bogus' });
    await settle(LATENCY_MS);
    const detail = 'host link: unexpected bogus';
    expect(rig.devices.get(HOST)!.events).toEqual([{ t: 'started' }, { t: 'closed', reason: 'protocol', detail }]);
    for (const id of ['d2', 'd3']) expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'closed', reason: 'protocol', detail }]);
    for (const id of ['d0', 'd2', 'd3']) expect(rec.ends.get(id), id).toEqual([{ reason: 'protocol' }]);
  });

  it('closes with link-lost a link whose game never says ready, five seconds after it was opened', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      link: (id, base) => (id === 'd2' ? tapLink(base, (f) => (f.t === 'ready' ? undefined : f)).link : base),
    });
    await settle(4999);
    expect(rig.devices.get('d2')!.events).toEqual([]);
    expect(rec.views.has('d2')).toBe(false);

    await settle(1);
    expect(rig.devices.get('d2')!.events).toEqual([{ t: 'closed', reason: 'link-lost', detail: 'view link: no ready within 5 s' }]);
    // The Host and the other views never noticed (the first frame after the wait catches up five steps).
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.ticks).toHaveLength(7);
    for (const id of ['d0', 'd1', 'd3']) {
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it('closes the Match with link-lost when the host game never says ready', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      link: (id, base) => (id === HOST ? tapLink(base, (f, side) => (side === 'host' && f.t === 'ready' ? undefined : f)).link : base),
    });
    await settle(4999);
    for (const id of DEVICES) expect(eventsOf(rig.devices.get(id)!.events, 'closed'), id).toEqual([]);

    await settle(1 + LATENCY_MS);
    const detail = 'host link: no ready within 5 s';
    expect(rig.devices.get(HOST)!.events).toEqual([{ t: 'closed', reason: 'link-lost', detail }]);
    for (const id of PEERS) expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'closed', reason: 'link-lost', detail }]);
    for (const id of DEVICES) expect(rec.ends.get(id), id).toEqual([{ reason: 'link-lost' }]);
    expect(rec.host).toBeUndefined();
  });

  it('rejects a publish and a second end after end: a reject frame and a log line on the Host, no state anywhere', async () => {
    const result: MatchResult = { scores: { 'p-ann': 1, 'p-bo': 0 } };
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        ctx.publish({ n });
        if (n === 2) {
          ctx.end(result);
          ctx.publish({ n: 99 });
          ctx.end({});
        }
      },
    });
    let tap: Tapped | undefined;
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      link: (id, base) => (id === HOST ? (tap = tapLink(base)).link : base),
    });
    await settle();
    for (let i = 0; i < 4; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(rig.devices.get(HOST)!.events).toEqual([
      { t: 'started' },
      { t: 'log', side: 'host', args: ['publish rejected: the Match has ended'] },
      { t: 'log', side: 'host', args: ['end rejected: the Match has already ended'] },
      { t: 'ended', result },
      { t: 'closed', reason: 'ended', detail: 'the game ended the Match' },
    ]);
    // Both refusals reached the host game before its close.
    expect(tap!.down.host.slice(-3)).toEqual([
      { v: 1, t: 'reject', of: 'publish', reason: 'the Match has ended' },
      { v: 1, t: 'reject', of: 'end', reason: 'the Match has already ended' },
      { v: 1, t: 'close', reason: 'ended', detail: 'the game ended the Match', result },
    ]);
    for (const id of DEVICES) {
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2]);
      expect(rec.ends.get(id), id).toEqual([{ reason: 'ended', result }]);
    }
    for (const id of PEERS) {
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'ended', result }, { t: 'closed', reason: 'ended', detail: 'the game ended the Match' }]);
    }
  });

  it('turns ctx.log on a view into a log event on that Device’s platform alone, and on the host game into one on the Host’s', async () => {
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (n === 1) ctx.log('host says', { n });
        ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);

    const view = rec.views.get('d2')!;
    view.log('x');
    // Whatever is not JSON arrives as text; nothing throws into the game.
    view.log({ deep: [1, 'two'] }, new Map([['k', 1]]), new Error('probe: e'), undefined, Number.NaN, () => 1);
    await settle(LATENCY_MS);

    expect(eventsOf(rig.devices.get('d2')!.events, 'log')).toEqual([
      { t: 'log', side: 'view', args: ['x'] },
      { t: 'log', side: 'view', args: [{ deep: [1, 'two'] }, '[object Map]', expect.stringContaining('Error: probe: e'), 'undefined', 'NaN', '() => 1'] },
    ]);
    expect(eventsOf(rig.devices.get(HOST)!.events, 'log')).toEqual([{ t: 'log', side: 'host', args: ['host says', { n: 1 }] }]);
    for (const id of ['d1', 'd3']) expect(eventsOf(rig.devices.get(id)!.events, 'log'), id).toEqual([]);
  });

  it('cancels at the host game every touch it holds when the Match closes', async () => {
    const { game, rec } = probeGame({ onTick: () => {} });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);
    rig.devices.get(HOST)!.screen.pointer('pointerdown', { pointerId: 4, x: 30, y: 30 });
    rig.devices.get('d2')!.screen.pointer('pointerdown', { pointerId: 1, x: 60, y: 60 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    expect(rec.inputs.map(({ input: i }) => [i.deviceId, i.pointerId, i.phase])).toEqual([
      ['d0', 4, 'down'],
      ['d2', 1, 'down'],
    ]);
    const [host, peer] = rec.inputs.map(({ input }) => input);

    const at = rig.sharedNow();
    rig.devices.get(HOST)!.handle.stop('aborted');
    await settle(LATENCY_MS);
    expect(rec.inputs.slice(2).map(({ input }) => input)).toEqual([
      { ...host, phase: 'cancel', t: at },
      { ...peer, phase: 'cancel', t: at },
    ]);
    for (const id of DEVICES) {
      expect(eventsOf(rig.devices.get(id)!.events, 'closed'), id).toEqual([{ t: 'closed', reason: 'aborted', detail: 'stopped by the platform' }]);
      expect(rec.ends.get(id), id).toEqual([{ reason: 'aborted' }]);
    }
  });
});
