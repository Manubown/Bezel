import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineGame, type DeviceId, type HostContext, type JsonValue, type NetFrame, type PauseReason } from '../src';
import { createTestMatch } from '../src/testing';
import { isNetDown, isNetUp } from '../src/wire';
import { matchOf, probeGame, settle, startMatch, step, tapLink, type ProbeState, type Tapped } from './harness';

const HOST = 'd0';
/** One fixed step at 50 Hz. */
const STEP_MS = 20;
const LATENCY_MS = 4;

type S = { kind: 'all' | 'mine'; n: number };

/** One view's page and everything its view heard, in order; a reload starts a new page. */
interface Page {
  deviceId: DeviceId;
  heard: string[];
}

/**
 * A Game whose host publishes only when the test calls it (no `tick`:
 * event-driven), recording what the host and each view page heard: states,
 * pauses, and resumes with `pausedMs`. A view draws the last state of each
 * kind it holds.
 */
function replayGame() {
  const rec: { host: HostContext<S, JsonValue> | undefined; heard: string[]; pages: Page[] } = { host: undefined, heard: [], pages: [] };
  const game = defineGame<S, JsonValue>({
    manifest: {
      id: 'mgc.replay',
      name: 'Replay',
      version: '0.0.0',
      tiles: { min: 1, max: 4 },
      controllers: { min: 0, max: 1 },
      players: { min: 0, max: 2 },
      host: './replay.js',
      view: './replay.js',
    },
    host(ctx) {
      rec.host = ctx;
      return {
        onPause(reason) {
          rec.heard.push(`pause ${reason.kind}`);
        },
        onResume(now, pausedMs) {
          rec.heard.push(`resume at ${now} after ${pausedMs}`);
        },
      };
    },
    view(ctx) {
      const page: Page = { deviceId: ctx.deviceId, heard: [] };
      rec.pages.push(page);
      const held: Partial<Record<S['kind'], number>> = {};
      return {
        onState(s) {
          held[s.kind] = s.n;
          page.heard.push(`${s.kind} ${s.n}`);
        },
        onPause(reason) {
          page.heard.push(`pause ${reason.kind}`);
        },
        onResume(now, pausedMs) {
          page.heard.push(`resume at ${now} after ${pausedMs}`);
        },
        draw({ ctx: g }) {
          g.fillText(`all ${held.all} mine ${held.mine}`, 0, 0);
        },
      };
    },
  });
  return { game, rec };
}

/** Host + 2 Peers: three Tiles in a row. */
const ROW = matchOf({ tiles: ['d0', 'd1', 'd2'], tickHz: 50 });

describe('hello: a Peer page that starts mid-Match asks the Host for the current picture (createTestMatch)', () => {
  it('draws the retained broadcast state and its own within one frame of its hello; no other Device hears anything new', async () => {
    const { game, rec } = replayGame();
    const t = await createTestMatch<S>({ game, match: ROW });
    rec.host!.publish({ kind: 'all', n: 1 });
    rec.host!.publish({ kind: 'mine', n: 2 }, 'd2');
    rec.host!.publish({ kind: 'mine', n: 3 }, 'd1');
    await t.tick(STEP_MS);
    const before = rec.pages.map((p) => [p.deviceId, [...p.heard]]);
    expect(before).toEqual([
      ['d0', ['all 1']],
      ['d1', ['all 1', 'mine 3']],
      ['d2', ['all 1', 'mine 2']],
    ]);

    // The Host publishes nothing more: without the hello the new page would draw nothing.
    await t.reload('d2');
    const page = rec.pages.at(-1)!;
    expect(page.deviceId).toBe('d2');
    expect(page.heard).toEqual(['all 1', 'mine 2']);
    await t.tick(STEP_MS);
    expect(t.drawn('d2')).toContainEqual(['fillText', 'all 1 mine 2', 0, 0]);
    expect(t.events('d2')).toEqual([{ t: 'started' }]);
    expect(rec.pages.slice(0, -1).map((p) => [p.deviceId, p.heard])).toEqual(before);
  });
});

describe('pausedMs: how long the Match stood still on the shared clock (createTestMatch)', () => {
  const LOST: PauseReason = { kind: 'device-lost', deviceId: 'd2' };

  it('reaches the host and every view on resume, counted from the first pause when the reason changed meanwhile', async () => {
    const { game, rec } = replayGame();
    const t = await createTestMatch<S>({ game, match: ROW });
    await t.tick(100);
    const pausedAt = t.now();
    await t.setPaused(LOST);
    await t.tick(500);
    await t.setPaused({ kind: 'platform', note: 'the Host looked away' });
    await t.tick(1000);
    await t.setPaused(null);

    const heard = ['pause device-lost', 'pause platform', `resume at ${pausedAt + 1500} after 1500`];
    expect(rec.heard).toEqual(heard);
    expect(rec.pages.map((p) => [p.deviceId, p.heard])).toEqual(['d0', 'd1', 'd2'].map((id) => [id, heard]));
  });

  it('reaches a Peer page that started during the pause too: its hello brought the pause, the resume the same pausedMs', async () => {
    const { game, rec } = replayGame();
    const t = await createTestMatch<S>({ game, match: ROW });
    rec.host!.publish({ kind: 'all', n: 1 });
    await t.tick(100);
    const pausedAt = t.now();
    await t.setPaused(LOST);
    await t.tick(700);
    await t.reload('d2');
    await t.tick(800);
    await t.setPaused(null);

    const page = rec.pages.at(-1)!;
    expect(page.deviceId).toBe('d2');
    // The hello's answer (the state, the pause), then the resume's re-post of the same state: harmless twice.
    expect(page.heard).toEqual(['all 1', 'pause device-lost', 'all 1', `resume at ${pausedAt + 1500} after 1500`]);
    expect(t.events('d2')).toEqual([{ t: 'started' }, { t: 'paused', reason: LOST }, { t: 'resumed' }]);
    expect(rec.heard).toEqual(['pause device-lost', `resume at ${pausedAt + 1500} after 1500`]);
  });
});

describe('hello over the in-memory hub: Host + 3 Peers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const CONTROLLER = 'd3';
  const MATCH = matchOf({ tiles: ['d0', 'd1', 'd2'], controllers: [CONTROLLER], tickHz: 50 });
  const PEERS: DeviceId[] = ['d1', 'd2', 'd3'];
  const summary = (f: NetFrame): string => {
    if (f.t === 'state') return `state ${(f.state as ProbeState).n}${f.to === undefined ? '' : `→${f.to}`}`;
    if (f.t === 'holders') return `holders ${f.holders.map((h) => `${h.deviceId}=${h.playerId}`).join(' ')}`;
    return f.t;
  };

  it('answers a Peer’s hello for that Device alone, and sends nothing for a Device outside the Match, the Host’s own view or the Host’s hello()', async () => {
    const { game, rec } = probeGame({ onTick: () => {} });
    let tap: Tapped | undefined;
    const rig = startMatch({ game, match: MATCH, host: HOST, latencyMs: LATENCY_MS, link: (id, base) => (id === HOST ? (tap = tapLink(base)).link : base) });
    await settle();
    await step(rig, STEP_MS);
    rec.host!.setHolder(CONTROLLER, 'p-ann');
    rec.host!.publish({ n: 1 });
    rec.host!.publish({ n: 2, to: CONTROLLER }, CONTROLLER);
    await settle(LATENCY_MS);

    const heard = new Map(PEERS.map((id): [DeviceId, string[]] => [id, []]));
    for (const id of PEERS) rig.devices.get(id)!.session.onMessage('match', (f) => heard.get(id)!.push(summary(f as NetFrame)));
    const host = rig.devices.get(HOST)!;
    const hostView = (): string[] => tap!.down.view.filter((f) => f.t !== 'clock').map((f) => f.t);
    const viewBefore = hostView();
    const eventsBefore = host.events.length;

    host.handle.deliver({ v: 1, t: 'hello' }, 'd9');
    tap!.inject('view', { v: 1, t: 'hello' });
    host.handle.hello();
    await settle(2 * LATENCY_MS);
    expect(Object.fromEntries(heard)).toEqual({ d1: [], d2: [], d3: [] });
    expect(hostView()).toEqual(viewBefore);
    expect(host.events).toHaveLength(eventsBefore);
    expect(rec.messages).toEqual([]);

    // The same from the Controller's runtime: its Holder, then its retained states, to it alone.
    rig.devices.get(CONTROLLER)!.handle.hello();
    await settle(2 * LATENCY_MS);
    expect(Object.fromEntries(heard)).toEqual({ d1: [], d2: [], d3: ['holders d3=p-ann', 'state 1', 'state 2→d3'] });
  });
});

describe('the wire', () => {
  it('takes hello from a view, and a resume only with a finite pausedMs ≥ 0', () => {
    expect(isNetUp({ v: 1, t: 'hello' })).toBe(true);
    const resume = { v: 1, t: 'resume', now: 1600, clock: { epochOffset: 0, sentAt: 1600 } };
    expect(isNetDown({ ...resume, pausedMs: 1500 })).toBe(true);
    expect(isNetDown({ ...resume, pausedMs: 0 })).toBe(true);
    expect(isNetDown(resume)).toBe(false);
    for (const pausedMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1500', null]) expect(isNetDown({ ...resume, pausedMs }), String(pausedMs)).toBe(false);
  });
});
