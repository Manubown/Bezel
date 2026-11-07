import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId, Input, NetFrame, PauseReason } from '../src';
import { matchOf, probeGame, settle, startMatch, step, type ProbeRecord, type Rig, type Seen } from './harness';

/** Host + 3 Peers: three Tiles in a row and one Controller. */
const HOST = 'd0';
const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: ['d3'], tickHz: 50 });
/** The Peer that drops, and every view that stays connected. */
const DROPS = 'd1';
const CONNECTED: DeviceId[] = ['d0', 'd2', 'd3'];
const LOST: PauseReason = { kind: 'device-lost', deviceId: DROPS };
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;
/** CSS px per mm on every Device (the harness default). */
const PX_PER_MM = 6;

/** Steps until the Host's platform saw the Match resume. */
async function untilResumed(rig: Rig): Promise<void> {
  for (let k = 0; k < 500; k++) {
    if (rig.devices.get(HOST)!.events.some((e) => e.t === 'resumed')) return;
    await step(rig, STEP_MS);
  }
  throw new Error('the Match never resumed');
}

/** What a view saw from its pause on: states (by `n`, and `to` when targeted), pauses and resumes. */
function sincePause(rec: ProbeRecord, id: DeviceId): (string | number)[] {
  const seen = rec.seen.get(id)!;
  const from = seen.findIndex((s) => 'pause' in s);
  return seen.slice(from + 1).flatMap((s: Seen) => {
    if ('state' in s) return [s.state.to ? `${s.state.n}→${s.state.to}` : s.state.n];
    if ('resume' in s) return ['resume'];
    if ('pause' in s) return ['pause'];
    return [];
  });
}

describe('pause and resume across a Peer’s loss: Host + 3 Peers over the in-memory hub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pauses the host game and every view still connected, naming the lost Device; no tick, state or draw while paused', async () => {
    const { game, rec } = probeGame({ draw: true });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 5; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.ticks).toHaveLength(5);

    rig.drop(DROPS);
    await settle(LATENCY_MS);
    expect(rec.pauses).toEqual([{ pause: LOST, afterTicks: 5, afterInputs: 0 }]);
    for (const id of CONNECTED) {
      expect(rec.seen.get(id)!.filter((s) => 'pause' in s), id).toEqual([{ pause: LOST }]);
      expect(rig.devices.get(id)!.events, id).toEqual([{ t: 'started' }, { t: 'paused', reason: LOST }]);
    }
    const states = CONNECTED.map((id) => rec.states.get(id)!.length);
    const draws = CONNECTED.map((id) => rec.draws.get(id)!.length);
    expect(states).toEqual([5, 5, 5]);

    // Three seconds of animation frames and clock frames.
    for (let i = 0; i < 150; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.ticks).toHaveLength(5);
    expect(CONNECTED.map((id) => rec.states.get(id)!.length)).toEqual(states);
    expect(CONNECTED.map((id) => rec.draws.get(id)!.length)).toEqual(draws);
    expect(rec.pauses).toHaveLength(1);
  });

  it('cancels at the host every touch the host game holds at the pause, and drops input sent while paused', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    const net: { frame: NetFrame; from: DeviceId }[] = [];
    rig.devices.get(HOST)!.session.onMessage('match', (frame, from) => net.push({ frame: frame as NetFrame, from }));
    await settle();
    await step(rig, STEP_MS);

    const hostView = rig.devices.get(HOST)!.screen;
    const peer = rig.devices.get('d2')!.screen;
    // A finger on the Host's own Tile and one on d2, which then moves: the host game sees all three.
    hostView.pointer('pointerdown', { pointerId: 4, x: 30, y: 30 });
    peer.pointer('pointerdown', { pointerId: 1, x: 60, y: 60 });
    await step(rig, STEP_MS);
    peer.pointer('pointermove', { pointerId: 1, x: 60, y: 120 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    const phases = (inputs: { input: Input }[]) => inputs.map(({ input: i }) => `${i.deviceId}:${i.pointerId}:${i.phase}`);
    expect(phases(rec.inputs).sort()).toEqual(['d0:4:down', 'd2:1:down', 'd2:1:move']);

    // Then, between two steps: d2 lifts finger 1 and puts down finger 2. Both reach the host's inbox, not the game.
    peer.pointer('pointerup', { pointerId: 1, x: 60, y: 120 });
    peer.pointer('pointerdown', { pointerId: 2, x: 90, y: 90 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    const before = rec.inputs.length;
    const at = rig.sharedNow();
    rig.drop(DROPS);
    await settle(LATENCY_MS);

    // The game saw finger 4 and finger 1 open; their undelivered input is dropped and both are cancelled
    // where they last were, at the pause, before onPause. Finger 2 never reached the game: no cancel.
    const tile = (id: DeviceId) => MATCH.tiles.find((t) => t.deviceId === id)!;
    const cancels = rec.inputs.slice(before).map(({ input }) => input);
    expect(cancels).toHaveLength(2);
    expect(cancels).toEqual(
      expect.arrayContaining([
        { deviceId: 'd0', role: 'tile', pointerId: 4, phase: 'cancel', t: at, world: { x: tile('d0').x + 5, y: tile('d0').y + 5 } },
        { deviceId: 'd2', role: 'tile', pointerId: 1, phase: 'cancel', t: at, world: { x: tile('d2').x + 10, y: tile('d2').y + 20 } },
      ]),
    );
    expect(rec.pauses).toEqual([{ pause: LOST, afterTicks: rec.ticks.length, afterInputs: before + 2 }]);

    // While paused the views still capture and send; the host drops all of it.
    const sentBefore = net.length;
    peer.pointer('pointermove', { pointerId: 2, x: 90, y: 150 });
    peer.pointer('pointerup', { pointerId: 2, x: 90, y: 150 });
    hostView.pointer('pointerup', { pointerId: 4, x: 30, y: 30 });
    rig.devices.get('d3')!.screen.pointer('pointerdown', { pointerId: 7, x: 12, y: 12 });
    for (let i = 0; i < 25; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.inputs).toHaveLength(before + 2);
    expect(net.slice(sentBefore).map(({ from, frame }) => [from, frame.t])).toEqual([
      ['d2', 'input'],
      ['d3', 'input'],
    ]);
    // d2's view kept capturing: it echoed (and so sent) its move and lift after the pause.
    const d2 = rec.seen.get('d2')!;
    expect(d2.slice(d2.findIndex((s) => 'pause' in s)).flatMap((s) => ('input' in s ? [s.input.phase] : []))).toEqual(['move', 'up']);
  });

  it('resumes everywhere once the Peer is back under a new peer id and synced: retained states first, then the next tick; its input arrives on the new connection', async () => {
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        if (n === 2) ctx.publish({ n, to: 'd2' }, 'd2');
        ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 5; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    const old = rig.drop(DROPS);
    for (let i = 0; i < 50; i++) await step(rig, STEP_MS);

    // A new page for d1: a new Session under a new peer id. The Host takes it back at once but
    // resumes only when it reports its clock synced, and by then the new page runs its part.
    rig.rejoin(DROPS);
    await untilResumed(rig);
    const back = rig.devices.get(DROPS)!;
    expect(back.session).not.toBe(old.session);
    // It ran its part before the Host resumed, and never paused.
    expect(back.events[0]).toEqual({ t: 'started' });
    expect(back.events.map((e) => e.t)).not.toContain('paused');
    expect(rec.ticks).toHaveLength(5);

    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    const resume = rec.pauses[1];
    expect(rec.pauses.map((p) => ('pause' in p ? 'pause' : 'resume'))).toEqual(['pause', 'resume']);
    if (!resume || !('resume' in resume)) throw new Error('no resume');
    expect(resume.afterTicks).toBe(5);
    // A fresh accumulator: the first step comes one step after the resume, not 1 s of catch-up.
    expect(rec.ticks.slice(5).map((t) => t.now - resume.resume)).toEqual([STEP_MS, 2 * STEP_MS, 3 * STEP_MS].map((ms) => expect.closeTo(ms, 6)));

    // Every view: the retained states (in arrival order) before the resume, both before tick 6's state.
    expect(sincePause(rec, 'd0')).toEqual([5, 'resume', 6, 7, 8]);
    expect(sincePause(rec, 'd2')).toEqual(['2→d2', 5, 'resume', 6, 7, 8]);
    expect(sincePause(rec, 'd3')).toEqual([5, 'resume', 6, 7, 8]);
    // The new d1 page never saw the pause; it starts from the retained state and resumes with the rest.
    expect(rec.seen.get(DROPS)!.map((s) => ('state' in s ? s.state.n : 'resume' in s ? 'resume' : '?'))).toEqual([5, 'resume', 6, 7, 8]);
    for (const id of [...CONNECTED, DROPS]) {
      expect(rec.seen.get(id)!.find((s) => 'resume' in s), id).toEqual({ resume: resume.resume });
      expect(rig.devices.get(id)!.events.at(-1), id).toEqual({ t: 'resumed' });
    }

    // A touch on the new page reaches the host as d1's; the same from the stale connection is dropped.
    const stale: NetFrame = { v: 1, t: 'input', inputs: [{ pointerId: 9, phase: 'down', t: rig.sharedNow(), world: { x: 1, y: 1 } }] };
    old.session.send('match', stale);
    back.screen.pointer('pointerdown', { pointerId: 3, x: 12 * PX_PER_MM, y: 40 * PX_PER_MM });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    const tile = MATCH.tiles.find((t) => t.deviceId === DROPS)!;
    expect(rec.inputs.map(({ input }) => input)).toEqual([
      { deviceId: DROPS, role: 'tile', pointerId: 3, phase: 'down', t: rec.inputs[0]!.input.t, world: { x: tile.x + 12, y: tile.y + 40 } },
    ]);
  });

  it('retains a publish made while paused, and that is what every view gets on resume', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    rig.drop(DROPS);
    await settle(LATENCY_MS);

    rec.host!.publish({ n: 99 });
    rec.host!.publish({ n: 98, to: 'd3' }, 'd3');
    for (let i = 0; i < 25; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    for (const id of CONNECTED) expect(rec.states.get(id)!.map((s) => s.state.n), id).toEqual([1, 2, 3]);

    rig.rejoin(DROPS);
    await untilResumed(rig);
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(sincePause(rec, 'd0')).toEqual([99, 'resume', 4]);
    expect(sincePause(rec, 'd2')).toEqual([99, 'resume', 4]);
    expect(sincePause(rec, 'd3')).toEqual([99, '98→d3', 'resume', 4]);
    expect(rec.states.get(DROPS)!.map((s) => s.state.n)).toEqual([99, 4]);
  });
});
