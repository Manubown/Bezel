import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Surface, defineGame, type JsonValue, type Tile } from '../src';
import type { CanvasOp, Matrix, RecordingContext2D } from '../src/headless';
import { matchFromTiles, matchOf, probeGame, settle, startMatch, step } from './harness';

/** One fixed step at 50 Hz. */
const STEP_MS = 20;

/** The Host Device alone, its view's `draw` throwing on frames 1..`inARow`; 20 frames. */
async function drawThrowing(inARow: number) {
  const { game, rec } = probeGame({
    draw(_id, n) {
      if (n <= inARow) throw new Error(`probe: draw ${n}`);
    },
  });
  const rig = startMatch({ game, match: matchOf({ tiles: ['d0'] }), host: 'd0' });
  await settle();
  for (let i = 0; i < 20; i++) await step(rig, STEP_MS);
  const { events, screen } = rig.devices.get('d0')!;
  return { events, screen, draws: rec.draws.get('d0')!.length, ticks: rec.ticks.length };
}

describe('what a game sees across the in-process link (Host Device alone)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws on an SDK-owned canvas, cleared and transformed so world mm land at Surface px × dpr', async () => {
    const tile: Tile = { deviceId: 'd0', x: 20, y: 5, w: 70, h: 150, rot: 0.4 };
    const match = matchFromTiles([tile], { x: 0, y: 0, w: 200, h: 200 }, [], 50);
    const draws: { state: JsonValue | undefined; t: number; now: number; tile: Tile | undefined; transform: Matrix; opsBefore: CanvasOp[] }[] = [];
    const game = defineGame<JsonValue, never>({
      manifest: { id: 'mgc.draw-probe', name: 'Draw probe', version: '0.0.0', tiles: { min: 1, max: 1 }, controllers: { min: 0, max: 0 }, players: { min: 0, max: 0 }, host: './p.js', view: './p.js' },
      host: (ctx) => ({ tick: (_dt, now) => ctx.publish({ at: now }) }),
      view: () => ({
        draw(f) {
          const m = f.ctx.getTransform();
          const fake = f.ctx as unknown as RecordingContext2D;
          draws.push({ state: f.state, t: f.t, now: f.now, tile: f.tile, transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f }, opsBefore: [...fake.ops] });
        },
      }),
    });
    const rig = startMatch({ game, match, host: 'd0', pxPerMm: 6, screen: { widthPx: 390, heightPx: 844, dpr: 2 } });
    await settle();
    await step(rig, STEP_MS);

    expect(draws).toHaveLength(1);
    const [first] = draws;
    const w = { x: 33, y: 71 };
    const px = new Surface({ id: 'd0', x: 20, y: 5, w: 70, h: 150, rot: 0.4 }, 6).worldToPx(w);
    const m = first!.transform;
    expect(m.a * w.x + m.c * w.y + m.e).toBeCloseTo(px.x * 2, 9);
    expect(m.b * w.x + m.d * w.y + m.f).toBeCloseTo(px.y * 2, 9);
    // The whole backing store (CSS px × dpr) was cleared before draw ran.
    const [canvas] = rig.devices.get('d0')!.screen.canvases;
    expect([canvas!.width, canvas!.height]).toEqual([780, 1688]);
    expect(first!.opsBefore.filter(([op]) => op === 'clearRect')).toEqual([['clearRect', 0, 0, 780, 1688]]);
    expect(first!.tile).toEqual(tile);
    expect(first!.state).toBeUndefined();

    await step(rig, STEP_MS);
    const second = draws[1]!;
    expect(second.state).toEqual({ at: second.t });
    expect(second.now - second.t).toBe(STEP_MS);
  });

  it('keeps now() monotone when a later clock frame moves the offset backwards, then slews onto it', async () => {
    const { game, rec } = probeGame();
    const rig = startMatch({ game, match: matchOf({ tiles: ['d0'] }), host: 'd0' });
    await settle();
    const view = rec.views.get('d0')!;
    expect(view.now()).toBe(rig.sharedNow());

    // The shared clock re-estimates itself 300 ms earlier; the next clock frame carries that.
    rig.skewMs -= 300;
    const samples = [view.now()];
    for (let i = 0; i < 150; i++) {
      await step(rig, STEP_MS);
      samples.push(view.now());
    }
    // Never backwards, never slower than 0.98× (to float resolution at epoch-scale milliseconds).
    samples.slice(1).forEach((s, i) => expect(s - samples[i]!).toBeGreaterThanOrEqual(STEP_MS * 0.98 - 1e-3));
    expect(view.now()).toBeGreaterThan(rig.sharedNow());

    // 300 ms at a 2 % slew is absorbed within 15 s.
    await settle(16_000);
    expect(view.now()).toBeCloseTo(rig.sharedNow(), 3);
  });

  it('refuses a non-serialisable publish at the call site', async () => {
    const errors: unknown[] = [];
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        for (const bad of [{ n, f: () => n }, new Map([['n', n]])]) {
          try {
            ctx.publish(bad as never);
          } catch (e) {
            errors.push(e);
          }
        }
        ctx.publish({ n });
      },
    });
    const rig = startMatch({ game, match: matchOf({ tiles: ['d0'] }), host: 'd0' });
    await settle();
    await step(rig, STEP_MS);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toBeInstanceOf(TypeError);
    expect(String(errors[0])).toMatch(/state\.f is a function/);
    expect(errors[1]).toBeInstanceOf(TypeError);
    expect(String(errors[1])).toMatch(/state is a Map/);
    expect(rec.states.get('d0')!.map((s) => s.state)).toEqual([{ n: 1 }]);
    expect(rig.devices.get('d0')!.events).toEqual([{ t: 'started' }]);
  });

  it('sends a publish as the state was at the call, not as the handler left it', async () => {
    const { game, rec } = probeGame({
      onTick(ctx, n) {
        const s = { n, list: [n] };
        ctx.publish(s);
        s.n = -1;
        s.list.push(-1);
      },
    });
    const rig = startMatch({ game, match: matchOf({ tiles: ['d0'] }), host: 'd0' });
    await settle();
    await step(rig, STEP_MS);

    expect(rec.states.get('d0')!.map((s) => s.state)).toEqual([{ n: 1, list: [1] }]);
  });

  it('skips each frame whose draw throws and keeps drawing after nine in a row, reporting the run once', async () => {
    const { events, draws, ticks } = await drawThrowing(9);
    expect(events).toEqual([{ t: 'started' }, { t: 'fault', where: 'view.draw', message: 'probe: draw 1', stack: expect.any(String) }]);
    expect(draws).toBe(20);
    expect(ticks).toBe(20);
  });

  it('stops the paint loop of a view whose draw throws on ten frames in a row and closes that view alone', async () => {
    const { events, screen, draws, ticks } = await drawThrowing(10);
    const last = 'probe: draw 10 (threw on 10 frames in a row)';
    expect(events).toEqual([
      { t: 'started' },
      { t: 'fault', where: 'view.draw', message: 'probe: draw 1', stack: expect.any(String) },
      { t: 'fault', where: 'view.draw', message: last, stack: expect.any(String) },
      { t: 'view-closed', reason: 'fault', detail: `view.draw: ${last}` },
    ]);
    expect(draws).toBe(10);
    expect(screen.children).toEqual([]);
    // The host game is not the view: it ticks on.
    expect(ticks).toBe(20);
  });

  it('does not draw while the page is hidden, and draws again once it is back', async () => {
    const { game, rec } = probeGame({ draw: true });
    const rig = startMatch({ game, match: matchOf({ tiles: ['d0'] }), host: 'd0' });
    await settle();
    for (let i = 0; i < 3; i++) await step(rig, STEP_MS);
    const { screen } = rig.devices.get('d0')!;
    expect(rec.draws.get('d0')).toHaveLength(3);

    screen.setHidden(true);
    for (let i = 0; i < 10; i++) await step(rig, STEP_MS);
    expect(rec.draws.get('d0')).toHaveLength(3);

    screen.setHidden(false);
    for (let i = 0; i < 2; i++) await step(rig, STEP_MS);
    expect(rec.draws.get('d0')).toHaveLength(5);
  });
});
