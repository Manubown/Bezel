import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId, Game, MatchResult } from '../src';
import { matchOf, probeGame, settle, startMatch, step } from './harness';

/** Host + 3 Peers: three Tiles in a row and one Controller. */
const HOST = 'd0';
const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: ['d3'], tickHz: 50 });
const DEVICES: DeviceId[] = ['d0', 'd1', 'd2', 'd3'];
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;

const loaded = (game: Game) => Promise.resolve({ default: game });

describe('a Match over the in-memory hub: Host + 3 Peers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fans every tick out to every view, the Host’s own included, stamped with non-decreasing host times', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (const { events } of rig.devices.values()) expect(events).toEqual([{ t: 'started' }]);

    const N = 12;
    for (let i = 0; i < N; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(rec.ticks).toHaveLength(N);
    expect(rec.ticks.every((t) => t.dt === 1 / 50)).toBe(true);
    for (const id of DEVICES) {
      const got = rec.states.get(id)!;
      expect(got.map((s) => s.state.n), id).toEqual(Array.from({ length: N }, (_, i) => i + 1));
      expect(got.map((s) => s.t), id).toEqual(rec.ticks.map((t) => t.now));
      got.slice(1).forEach((s, i) => expect(s.t).toBeGreaterThanOrEqual(got[i]!.t));
    }
  });

  it('gives a view whose link becomes ready late the retained latest states at once', async () => {
    let release = (): void => {};
    const late = new Promise<void>((r) => (release = r));
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (n === 2) ctx.publish({ n, to: 'd2' }, 'd2');
        ctx.publish({ n });
      },
    });
    const rig = startMatch({
      game,
      match: MATCH,
      host: HOST,
      latencyMs: LATENCY_MS,
      load: (id) => (id === 'd2' ? late.then(() => loaded(game)) : loaded(game)),
    });
    await settle();
    for (let i = 0; i < 5; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.views.has('d2')).toBe(false);
    expect(rig.devices.get('d2')!.events).toEqual([]);

    release();
    await settle();
    // The last state sent to d2 alone and the last broadcast, in arrival order, before any further tick.
    expect(rec.states.get('d2')!.map((s) => s.state)).toEqual([{ n: 2, to: 'd2' }, { n: 5 }]);
    expect(rig.devices.get('d2')!.events).toEqual([{ t: 'started' }]);

    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.states.get('d2')!.at(-1)!.state).toEqual({ n: 6 });
  });

  it('delivers publish(state, to) to that Device alone, the Host’s own Tile included', async () => {
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (n === 2) ctx.publish({ n, to: 'd2' }, 'd2');
        else if (n === 3) ctx.publish({ n, to: HOST }, HOST);
        else if (n === 4) ctx.publish({ n, to: 'd3' }, 'd3');
        else ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 5; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const ns = (id: DeviceId) => rec.states.get(id)!.map((s) => s.state.n);
    expect(ns('d0')).toEqual([1, 3, 5]);
    expect(ns('d1')).toEqual([1, 5]);
    expect(ns('d2')).toEqual([1, 2, 5]);
    expect(ns('d3')).toEqual([1, 4, 5]);
  });

  it('runs at most 5 ticks on the frame after a 1 s Host animation-frame gap, and now jumps forward', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    const before = rec.ticks.length;
    const lastBefore = rec.ticks.at(-1)!.now;

    await step(rig, 1000);
    const burst = rec.ticks.slice(before);
    expect(burst.length).toBeGreaterThan(0);
    expect(burst.length).toBeLessThanOrEqual(5);
    expect(burst.every((t) => t.dt === 1 / 50)).toBe(true);

    await step(rig, STEP_MS);
    const next = rec.ticks.slice(before + burst.length);
    expect(next).toHaveLength(1);
    // The stall is dropped rather than replayed: far fewer steps than time passed, and caught up with the shared clock.
    expect(next[0]!.now - lastBefore).toBeGreaterThan((burst.length + 1) * STEP_MS + 500);
    expect(rig.sharedNow() - next[0]!.now).toBeLessThan(STEP_MS);
  });

  it('ends the Match on every Device with the result and tears every view down', async () => {
    const result: MatchResult = { scores: { 'p-ann': 7, 'p-bo': 3 }, ranking: ['p-ann', 'p-bo'] };
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        ctx.publish({ n });
        if (n === 3) ctx.end(result);
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 6; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(rec.ticks).toHaveLength(3);
    for (const id of DEVICES) {
      const { events, screen } = rig.devices.get(id)!;
      expect(events, id).toEqual([{ t: 'started' }, { t: 'ended', result }, { t: 'closed', reason: 'ended' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3]);
      expect(screen.children, id).toEqual([]);
    }
  });
});
