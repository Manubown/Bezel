import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId, Game, MatchResult, NetFrame } from '../src';
import { matchOf, probeGame, settle, startMatch, step } from './harness';

/** Host + 3 Peers: three Tiles in a row and one Controller. */
const HOST = 'd0';
const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: ['d3'], tickHz: 50 });
const DEVICES: DeviceId[] = ['d0', 'd1', 'd2', 'd3'];
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;
/** CSS px per mm on every Device (the harness default). */
const PX_PER_MM = 6;

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
      expect(events, id).toEqual([{ t: 'started' }, { t: 'ended', result }, { t: 'closed', reason: 'ended', detail: 'the game ended the Match' }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3]);
      expect(screen.children, id).toEqual([]);
    }
  });

  it('brings a touch on a Peer Tile to the host’s onInput stamped with that Device, in world mm, at shared-clock time, before the tick', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);

    const peer = rig.devices.get('d1')!;
    const tile = MATCH.tiles.find((t) => t.deviceId === 'd1')!;
    const local = { x: 12, y: 40 }; // mm from the Peer screen's top-left
    const peerNow = peer.session.clock.now();
    const hostNow = rig.sharedNow();
    peer.screen.pointer('pointerdown', { pointerId: 3, x: local.x * PX_PER_MM, y: local.y * PX_PER_MM });
    await step(rig, STEP_MS); // the view sends it on its next animation frame
    await settle(LATENCY_MS);
    const ticksBefore = rec.ticks.length;
    await step(rig, STEP_MS);

    expect(rec.inputs).toHaveLength(1);
    const [{ input, afterTicks }] = rec.inputs as [(typeof rec.inputs)[number]];
    expect(input).toEqual({ deviceId: 'd1', role: 'tile', pointerId: 3, phase: 'down', t: input.t, world: { x: tile.x + local.x, y: tile.y + local.y } });
    expect(tile.x).toBeGreaterThan(0); // the Tile's own offset is in it, not just the local point
    // Captured on the Peer's view of the shared clock, which agrees with the Host's.
    expect(input.t).toBeCloseTo(peerNow, 2);
    expect(Math.abs(input.t - hostNow)).toBeLessThan(1);
    // Delivered before the tick of the step it arrived for.
    expect(afterTicks).toBe(ticksBefore);
    expect(rec.ticks.length).toBe(ticksBefore + 1);
  });

  it('coalesces a frame’s moves into one, drops an orphan move, and echoes a view’s own touch before the host’s state', async () => {
    const { game, rec } = probeGame({
      onTick: () => {},
      onInput: (ctx, i) => ctx.publish({ n: 0, got: i.phase }),
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);

    const peer = rig.devices.get('d1')!;
    const tile = MATCH.tiles.find((t) => t.deviceId === 'd1')!;
    // A hovering pointer that never went down on d2: its view sends nothing.
    rig.devices.get('d2')!.screen.pointer('pointermove', { pointerId: 9, x: 30, y: 30 });
    // One finger on d1: down, then 10 moves before the next animation frame.
    peer.screen.pointer('pointerdown', { pointerId: 1, x: 60, y: 60 });
    for (let k = 1; k <= 10; k++) peer.screen.pointer('pointermove', { pointerId: 1, x: 60, y: 60 + k * PX_PER_MM });
    await step(rig, STEP_MS);
    // A buggy or forged view: a move for a pointer d1 never put down, as the Host's platform would receive it.
    const orphan: NetFrame = { v: 1, t: 'input', inputs: [{ pointerId: 2, phase: 'move', t: rig.sharedNow(), world: { x: 1, y: 1 } }] };
    rig.devices.get(HOST)!.handle.deliver(orphan, 'd1');
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const atHost = rec.inputs.map(({ input: i }) => [i.deviceId, i.pointerId, i.phase, i.world.y]);
    expect(atHost).toEqual([
      ['d1', 1, 'down', tile.y + 10],
      ['d1', 1, 'move', tile.y + 20], // the last of the 10
    ]);

    // d1's view saw its own down (and the one coalesced move) before the state the host published for it.
    const seen = rec.seen.get('d1')!;
    const echoed = seen.flatMap((s) => ('input' in s ? [[s.input.deviceId, s.input.phase, s.input.world.y]] : []));
    expect(echoed).toEqual([
      ['d1', 'down', tile.y + 10],
      ['d1', 'move', tile.y + 20],
    ]);
    const echo = seen.findIndex((s) => 'input' in s && s.input.phase === 'down');
    const state = seen.findIndex((s) => 'state' in s && s.state.got === 'down');
    expect(echo).toBeGreaterThanOrEqual(0);
    expect(state).toBeGreaterThan(echo);
    // Echo is local: no other view saw d1's input.
    for (const id of ['d0', 'd2', 'd3']) expect(rec.seen.get(id)!.some((s) => 'input' in s), id).toBe(false);
  });

  it('captures nothing for a view that turned input off', async () => {
    const { game, rec } = probeGame({ input: 'off' });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    const peer = rig.devices.get('d1')!;
    peer.screen.pointer('pointerdown', { pointerId: 1, x: 60, y: 60 });
    peer.screen.pointer('pointermove', { pointerId: 1, x: 60, y: 90 });
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(rec.inputs).toEqual([]);
    expect(rec.seen.get('d1')!.some((s) => 'input' in s)).toBe(false);
    const root = peer.screen.children[0] as { style: Record<string, string> };
    expect(root.style['touchAction']).toBeUndefined();
  });

  it('ends on every view with onEnd and the result, gives the Host’s platform the scores, and drops a publish after end', async () => {
    const result: MatchResult = { scores: { 'p-ann': 7, 'p-bo': 5 } };
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        ctx.publish({ n });
        if (n === 2) {
          ctx.end(result);
          ctx.publish({ n: 99 });
        }
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 4; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    expect(rig.devices.get(HOST)!.events).toContainEqual({ t: 'ended', result });
    for (const id of DEVICES) {
      expect(rec.ends.get(id), id).toEqual([{ reason: 'ended', result }]);
      expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2]);
    }
  });
});
