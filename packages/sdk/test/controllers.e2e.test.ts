import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId, Down, Input, LinkFactory, MatchResult, Vec2 } from '../src';
import { eventsOf, matchOf, probeGame, settle, startMatch, step, tapLink, type Rig, type Tapped } from './harness';

/** Host + 3 Peers: three Tiles in a row and one Controller. */
const HOST = 'd0';
const CONTROLLER = 'd3';
const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: [CONTROLLER], tickHz: 50 });
const DEVICES: DeviceId[] = ['d0', 'd1', 'd2', 'd3'];
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;
/** CSS px per mm and the dpr on every Device (the harness defaults). */
const PX_PER_MM = 6;
const DPR = 3;

/** A pointer event on Device `id`'s screen at `at` mm from its top-left. */
function touch(rig: Rig, id: DeviceId, phase: Input['phase'], at: Vec2, pointerId = 1): void {
  rig.devices.get(id)!.screen.pointer(`pointer${phase}`, { pointerId, x: at.x * PX_PER_MM, y: at.y * PX_PER_MM });
}

/** The Host Device's links tapped, the rest as they are: what the platform posts to the host game. */
function tappedHost(): { link: (id: DeviceId, base: LinkFactory) => LinkFactory; tap: () => Tapped } {
  let tapped: Tapped | undefined;
  return {
    link: (id, base) => (id === HOST ? (tapped = tapLink(base)).link : base),
    tap: () => tapped!,
  };
}

const framesOf = <T extends Down['t']>(down: readonly Down[], t: T): Extract<Down, { t: T }>[] => down.filter((f): f is Extract<Down, { t: T }> => f.t === t);

describe('Controllers, Holders, messages, timers and event-driven hosts: Host + 3 Peers over the in-memory hub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stamps a Controller’s touch with its Holder once the host game hands it over, in screen mm, after the host game and every view heard of it', async () => {
    const { game, rec } = probeGame({ draw: true, mount: true });
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);

    // The Controller's view: no Tile and no Surface, its own screen in mm, drawn in screen mm, its root handed to mount.
    const controller = rec.views.get(CONTROLLER)!;
    expect([controller.role, controller.tile, controller.surface]).toEqual(['controller', undefined, undefined]);
    expect(controller.screenMm).toEqual({ x: 70, y: 150 });
    expect(rec.mounts.get(CONTROLLER)).toBe(controller.root);
    expect(rec.draws.get(CONTROLLER)!.at(-1)!.transform).toEqual({ a: PX_PER_MM * DPR, b: 0, c: 0, d: PX_PER_MM * DPR, e: 0, f: 0 });
    expect(controller.holder()).toBeNull();

    // Nobody holds it yet: its touch arrives with the Device and role only.
    touch(rig, CONTROLLER, 'down', { x: 10, y: 20 });
    touch(rig, CONTROLLER, 'up', { x: 10, y: 20 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    expect(rec.inputs.map(({ input }) => input)).toStrictEqual([
      { deviceId: CONTROLLER, role: 'controller', pointerId: 1, phase: 'down', t: rec.inputs[0]!.input.t, world: { x: 10, y: 20 } },
      { deviceId: CONTROLLER, role: 'controller', pointerId: 1, phase: 'up', t: rec.inputs[1]!.input.t, world: { x: 10, y: 20 } },
    ]);

    // A touch already on its way to the Host when the host game hands the Controller to Ann.
    touch(rig, CONTROLLER, 'down', { x: 30, y: 40 }, 2);
    await step(rig, STEP_MS); // the Controller's view sends it on this frame
    rec.host!.setHolder(CONTROLLER, 'p-ann');
    expect(rec.host!.holderOf(CONTROLLER)).toBe('p-ann');
    await settle(LATENCY_MS); // the touch reaches the Host, the Holder every Peer
    await step(rig, STEP_MS);

    const inFlight = rec.inputs[2]!.input;
    expect(inFlight).toEqual({ deviceId: CONTROLLER, role: 'controller', playerId: 'p-ann', pointerId: 2, phase: 'down', t: inFlight.t, world: { x: 30, y: 40 } });
    // The host game first, then every view, heard of the new Holder before that touch reached the host game.
    const delivered = rec.journal.indexOf('host input d3:2 down by p-ann');
    const heard = ['host', ...DEVICES].map((who) => rec.journal.indexOf(`${who} holder d3=p-ann`));
    expect(heard.every((i) => i >= 0 && i < delivered)).toBe(true);
    expect(Math.min(...heard)).toBe(heard[0]);
    for (const id of DEVICES) {
      expect(rec.seen.get(id)!.filter((s) => 'holder' in s), id).toEqual([{ holder: { controller: CONTROLLER, playerId: 'p-ann' } }]);
      expect(eventsOf(rig.devices.get(id)!.events, 'holders'), id).toEqual([{ t: 'holders', holders: [{ deviceId: CONTROLLER, playerId: 'p-ann' }] }]);
      expect(rec.views.get(id)!.holder(CONTROLLER), id).toBe('p-ann');
    }
    expect(controller.holder()).toBe('p-ann');
    expect(rec.views.get('d1')!.holder()).toBeNull();

    // It was sent before the Controller heard: its echo has no Holder. The next one does, and so does its host input.
    const echoes = rec.seen.get(CONTROLLER)!.flatMap((s) => ('input' in s ? [s.input] : []));
    expect(echoes.map((i) => [i.pointerId, i.phase, i.playerId])).toEqual([
      [1, 'down', undefined],
      [1, 'up', undefined],
      [2, 'down', undefined],
    ]);
    touch(rig, CONTROLLER, 'move', { x: 35, y: 41 }, 2);
    touch(rig, 'd1', 'down', { x: 5, y: 5 }, 7);
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    expect(rec.seen.get(CONTROLLER)!.flatMap((s) => ('input' in s ? [s.input] : [])).at(-1)).toEqual({
      deviceId: CONTROLLER,
      role: 'controller',
      playerId: 'p-ann',
      pointerId: 2,
      phase: 'move',
      t: expect.any(Number),
      world: { x: 35, y: 41 },
    });
    const tile = MATCH.tiles.find((t) => t.deviceId === 'd1')!;
    expect(rec.inputs.slice(3).map(({ input }) => input)).toEqual(
      expect.arrayContaining([
        { deviceId: CONTROLLER, role: 'controller', playerId: 'p-ann', pointerId: 2, phase: 'move', t: expect.any(Number), world: { x: 35, y: 41 } },
        // A Tile's input never carries a Holder.
        { deviceId: 'd1', role: 'tile', pointerId: 7, phase: 'down', t: expect.any(Number), world: { x: tile.x + 5, y: tile.y + 5 } },
      ]),
    );
    expect(rec.inputs.find(({ input }) => input.deviceId === 'd1')!.input).not.toHaveProperty('playerId');
  });

  it('rejects setHolder on a Tile, an unknown Device or an unknown Player, and holderOf keeps its value; set-holder and timer after end are rejected too', async () => {
    let endNow = false;
    const result: MatchResult = { scores: {} };
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        ctx.publish({ n });
        if (!endNow) return;
        endNow = false;
        ctx.end(result);
        ctx.setHolder(CONTROLLER, 'p-ann');
        ctx.timer('late', 10);
      },
    });
    const hostLink = tappedHost();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS, link: hostLink.link });
    await settle();
    await step(rig, STEP_MS);
    const host = rec.host!;
    host.setHolder(CONTROLLER, 'p-bo');
    await settle(LATENCY_MS);

    host.setHolder('d1', 'p-ann'); // a Tile
    host.setHolder('d9', 'p-ann'); // no such Device
    host.setHolder(CONTROLLER, 'p-zed'); // nobody in this Match
    host.timer('turn', -1);
    host.timer('turn', Number.NaN);
    expect([host.holderOf('d1'), host.holderOf('d9'), host.holderOf(CONTROLLER)]).toEqual([null, null, 'p-bo']);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);

    const reasons = [
      ['set-holder', 'd1 is a Tile, not a Controller'],
      ['set-holder', '"d9" is not a Device of the Match'],
      ['set-holder', '"p-zed" is not a Player of the Match'],
      ['timer', '"turn" needs a delay of 0 ms or more, not -1'],
      ['timer', '"turn" needs a delay of 0 ms or more, not NaN'],
    ] as const;
    expect(framesOf(hostLink.tap().down.host, 'reject')).toEqual(reasons.map(([of, reason]) => ({ v: 1, t: 'reject', of, reason })));
    const host0 = rig.devices.get(HOST)!;
    expect(eventsOf(host0.events, 'log')).toEqual(reasons.map(([of, reason]) => ({ t: 'log', side: 'host', args: [`${of} rejected: ${reason}`] })));
    // Only the accepted handover went anywhere.
    for (const id of DEVICES) {
      expect(eventsOf(rig.devices.get(id)!.events, 'holders'), id).toEqual([{ t: 'holders', holders: [{ deviceId: CONTROLLER, playerId: 'p-bo' }] }]);
      expect(rec.views.get(id)!.holder(CONTROLLER), id).toBe('p-bo');
    }
    expect(rec.journal.filter((e) => e.includes(' holder ')).sort()).toEqual([...DEVICES.map((id) => `${id} holder d3=p-bo`), 'host holder d3=p-bo']);
    expect(host.holderOf(CONTROLLER)).toBe('p-bo');

    // In the same turn as `end`: refused, nothing changes, and the Match still ends.
    endNow = true;
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(eventsOf(host0.events, 'log').slice(reasons.length).map((e) => e.args)).toEqual([
      ['set-holder rejected: the Match has ended'],
      ['timer rejected: the Match has ended'],
    ]);
    expect(host.holderOf(CONTROLLER)).toBe('p-bo');
    expect(host0.events.slice(-2)).toEqual([{ t: 'ended', result }, { t: 'closed', reason: 'ended', detail: 'the game ended the Match' }]);
    for (const id of DEVICES) expect(eventsOf(rig.devices.get(id)!.events, 'holders'), id).toHaveLength(1);
  });

  it('stamps a view’s send like input: from the Device, and the Holder as the message reached the Host; dropped while paused', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);
    const send = (id: DeviceId, n: number): void => rec.views.get(id)!.send({ n });
    const host = rec.host!;

    // Nobody holds the Controller yet; a Tile's message never carries a Holder.
    send(CONTROLLER, 0);
    send('d1', 1);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    expect(rec.messages.map(({ msg, from }) => ({ msg, from }))).toStrictEqual([
      { msg: { n: 0 }, from: { deviceId: CONTROLLER, role: 'controller' } },
      { msg: { n: 1 }, from: { deviceId: 'd1', role: 'tile' } },
    ]);
    // Delivered before the tick of the step it arrived for.
    expect(rec.messages[0]!.afterTicks).toBe(rec.ticks.length - 1);

    host.setHolder(CONTROLLER, 'p-ann');
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    // Sent just before a handover: it reached the Host, then the host game passes the Controller to Bo.
    send(CONTROLLER, 2);
    await settle(LATENCY_MS);
    host.setHolder(CONTROLLER, 'p-bo');
    await settle();
    // Sent after it.
    send(CONTROLLER, 3);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    // In flight: sent before the host game hands the Controller back to Ann, arriving after.
    send(CONTROLLER, 4);
    host.setHolder(CONTROLLER, 'p-ann');
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);

    expect(rec.journal.filter((e) => e.startsWith('host '))).toEqual([
      'host msg {"n":0} from d3',
      'host msg {"n":1} from d1',
      'host holder d3=p-ann',
      'host msg {"n":2} from d3 by p-ann',
      'host holder d3=p-bo',
      'host msg {"n":3} from d3 by p-bo',
      'host holder d3=p-ann',
      'host msg {"n":4} from d3 by p-ann',
    ]);
    expect(rec.messages.at(-1)!.from).toStrictEqual({ deviceId: CONTROLLER, role: 'controller', playerId: 'p-ann' });

    // Paused: a message sent meanwhile never arrives, not even after the resume.
    const handle = rig.devices.get(HOST)!.handle;
    handle.setPaused({ kind: 'platform', note: 'test' });
    await settle(LATENCY_MS);
    send(CONTROLLER, 5);
    send('d2', 6);
    for (let i = 0; i < 10; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    handle.setPaused(null);
    for (let i = 0; i < 10; i++) await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.messages).toHaveLength(5);
    send(CONTROLLER, 7);
    await settle(LATENCY_MS);
    await step(rig, STEP_MS);
    expect(rec.messages.map(({ msg }) => msg)).toEqual([0, 1, 2, 3, 4, 7].map((n) => ({ n })));
  });

  it('fires a timer after its delay of fake time; the same tag replaces it, null cancels it, and a pause freezes what is left', async () => {
    const { game, rec } = probeGame();
    const hostLink = tappedHost();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS, link: hostLink.link });
    await settle();
    await step(rig, STEP_MS);
    const host = rec.host!;
    const steps = async (n: number): Promise<void> => {
      for (let i = 0; i < n; i++) await step(rig, STEP_MS);
    };

    // One second of fake time; it reaches the host game before the tick of its step.
    const t0 = rig.sharedNow();
    host.timer('turn', 1000);
    await steps(49);
    expect(rec.timers).toEqual([]);
    const ticks = rec.ticks.length;
    await steps(1);
    expect(rec.timers).toEqual([{ tag: 'turn', now: t0 + 1000, afterTicks: ticks }]);

    // Re-armed half way: only the second one fires, a full second after it was set.
    const t1 = rig.sharedNow();
    host.timer('turn', 1000);
    await steps(25);
    host.timer('turn', 1000);
    await steps(80);
    expect(rec.timers.slice(1)).toEqual([{ tag: 'turn', now: t1 + 1500, afterTicks: expect.any(Number) }]);

    // Cancelled: never fires. Another tag runs on its own.
    host.timer('turn', 1000);
    host.timer('other', 100);
    await steps(15);
    host.timer('turn', null);
    await steps(75);
    expect(rec.timers.slice(2).map((t) => t.tag)).toEqual(['other']);

    // Paused 600 ms in: nothing fires and no timer frame goes to the host game while paused. A timer set
    // while paused starts counting at the resume.
    host.timer('turn', 1000);
    await steps(30);
    const handle = rig.devices.get(HOST)!.handle;
    handle.setPaused({ kind: 'platform' });
    await settle();
    const postedBefore = hostLink.tap().down.host.length;
    host.timer('later', 100);
    await steps(150);
    expect(rec.timers.slice(3)).toEqual([]);
    expect(framesOf(hostLink.tap().down.host.slice(postedBefore), 'timer')).toEqual([]);
    handle.setPaused(null);
    await settle();
    const resume = rec.pauses.at(-1)!;
    if (!('resume' in resume)) throw new Error('not resumed');
    await steps(19);
    expect(rec.timers.slice(3)).toEqual([{ tag: 'later', now: resume.resume + 100, afterTicks: expect.any(Number) }]);
    await steps(1);
    expect(rec.timers.slice(3)).toEqual([
      { tag: 'later', now: resume.resume + 100, afterTicks: expect.any(Number) },
      { tag: 'turn', now: resume.resume + 400, afterTicks: expect.any(Number) },
    ]);
    await steps(100);
    expect(rec.timers).toHaveLength(5);
  });

  it('runs a host with tickHz 0 event-driven: input, messages and timers arrive as they land, and no tick frame ever goes', async () => {
    const match = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: [CONTROLLER], tickHz: 0 });
    const { game, rec } = probeGame({ onInput: (ctx, i) => ctx.publish({ n: rec.inputs.length, got: i.phase }) });
    const hostLink = tappedHost();
    const rig = startMatch({ game, match, host: HOST, latencyMs: LATENCY_MS, link: hostLink.link });
    await settle();

    // The Peer's view sends on its next frame; the host game has it as soon as it lands, with no step to wait for.
    touch(rig, 'd1', 'down', { x: 12, y: 40 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.inputs.map(({ input }) => [input.deviceId, input.phase])).toEqual([['d1', 'down']]);
    // What it published on that input reaches every view.
    await settle(LATENCY_MS);
    for (const id of DEVICES) expect(rec.states.get(id)!.map((s) => s.state), id).toEqual([{ n: 1, got: 'down' }]);

    rec.views.get(CONTROLLER)!.send('hi');
    await settle(LATENCY_MS);
    expect(rec.messages.map(({ msg, from }) => [msg, from.deviceId])).toEqual([['hi', CONTROLLER]]);

    rec.host!.timer('t', 100);
    await settle(100);
    expect(rec.timers.map((t) => t.tag)).toEqual(['t']);

    for (let i = 0; i < 100; i++) await step(rig, STEP_MS);
    expect(rec.ticks).toEqual([]);
    expect(framesOf(hostLink.tap().down.host, 'tick')).toEqual([]);
    expect(rec.journal).toEqual(['host input d1:1 down', 'host msg "hi" from d3', 'host timer t']);
  });

  it('runs a host without tick event-driven even at tickHz 50', async () => {
    const { game, rec } = probeGame({ tick: false });
    const hostLink = tappedHost();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS, link: hostLink.link });
    await settle();
    touch(rig, CONTROLLER, 'down', { x: 1, y: 2 });
    await step(rig, STEP_MS);
    await settle(LATENCY_MS);
    expect(rec.inputs.map(({ input }) => [input.deviceId, input.world])).toEqual([[CONTROLLER, { x: 1, y: 2 }]]);
    for (let i = 0; i < 50; i++) await step(rig, STEP_MS);
    expect(framesOf(hostLink.tap().down.host, 'tick')).toEqual([]);
    expect(framesOf(hostLink.tap().down.host, 'init')).toHaveLength(1);
  });

  it('tells a Controller back as a new page who holds it, before the retained state and the pause, in the answer to its hello', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS });
    await settle();
    await step(rig, STEP_MS);
    rec.host!.setHolder(CONTROLLER, 'p-ann');
    await settle(LATENCY_MS);
    rig.drop(CONTROLLER);
    for (let i = 0; i < 25; i++) await step(rig, STEP_MS);

    rig.rejoin(CONTROLLER);
    for (let k = 0; !rig.devices.get(HOST)!.events.some((e) => e.t === 'resumed'); k++) {
      if (k > 500) throw new Error('the Match never resumed');
      await step(rig, STEP_MS);
    }
    await settle(LATENCY_MS);
    const back = rec.views.get(CONTROLLER)!;
    expect(back.holder()).toBe('p-ann');
    const seen = rec.seen.get(CONTROLLER)!.map((s) => ('holder' in s ? `holder ${s.holder.playerId}` : 'state' in s ? 'state' : 'pause' in s ? 'pause' : 'resume' in s ? 'resume' : '?'));
    // The hello's answer, then the resume: the Holder it already knows is not heard again.
    expect(seen.slice(0, 5)).toEqual(['holder p-ann', 'state', 'pause', 'state', 'resume']);
    expect(eventsOf(rig.devices.get(CONTROLLER)!.events, 'holders')).toEqual([{ t: 'holders', holders: [{ deviceId: CONTROLLER, playerId: 'p-ann' }] }]);
  });
});
