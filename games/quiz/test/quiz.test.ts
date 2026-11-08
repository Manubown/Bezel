import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import type { DeviceId, Game, JsonValue, MatchInfo, Tile, ViewContext } from '@mgc/sdk';
import { createTestMatch } from '@mgc/sdk/test';
import quiz, { QUESTIONS, QUIZ, type BoardState, type ControllerState, type QuizMessage, type QuizState } from '../src';

/**
 * One phone on the table is the board; three are Controllers in hand. With
 * `seats: 'controllers'` the lobby seats a Player at each Controller: Ann holds
 * c0, Bo holds c1; c2 is a Controller nobody holds (its Player left before Start).
 */
const BOARD: Tile = { deviceId: 'd0', x: 0, y: 0, w: 70, h: 150, rot: 0 };
const CONTROLLERS: DeviceId[] = ['c0', 'c1', 'c2'];
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 0,
  players: [
    { playerId: 'p-ann', name: 'Ann', deviceId: 'c0' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'c1' },
  ],
  devices: [
    { deviceId: 'd0', role: 'tile', name: 'd0', tile: BOARD, screenMm: { x: 70, y: 150 } },
    ...CONTROLLERS.map((deviceId) => ({ deviceId, role: 'controller' as const, name: deviceId, screenMm: { x: 65, y: 140 } })),
  ],
  tiles: [BOARD],
  bounds: { x: 0, y: 0, w: 70, h: 150 },
};
const DEVICES: DeviceId[] = ['d0', ...CONTROLLERS];
const TOTAL = Math.min(QUIZ.questions, QUESTIONS.length);

/** What a right answer earns `ms` after its question appeared. */
const points = (ms: number) => Math.round(QUIZ.fastest - ((QUIZ.fastest - QUIZ.slowest) * ms) / QUIZ.answerMs);

/** Every text a DOM view set, depth first: the headless screen keeps each element's own `textContent`. */
const texts = (el: Element): string[] => [...(el.textContent ? [el.textContent] : []), ...Array.from(el.children).flatMap(texts)];

/**
 * A Quiz Match over `createTestMatch`, plus what the harness does not give: each
 * view's context (to `send` a chosen answer, and to read its Holder and its DOM)
 * and every state each view's `onState` heard, in order.
 */
async function start(match = MATCH) {
  const views = new Map<DeviceId, ViewContext<JsonValue, JsonValue>>();
  const heard = new Map<DeviceId, QuizState[]>(match.devices.map((d) => [d.deviceId, []]));
  const game: Game = {
    ...quiz,
    view(ctx) {
      views.set(ctx.deviceId, ctx);
      const handlers = quiz.view(ctx);
      return {
        ...handlers,
        onState(state, at) {
          heard.get(ctx.deviceId)!.push(state as QuizState);
          handlers.onState?.(state, at);
        },
      };
    },
  };
  const t = await createTestMatch<QuizState>({ game, match });
  const view = (id: DeviceId) => views.get(id)!;
  return {
    t,
    view,
    heard: (id: DeviceId) => heard.get(id)!,
    /** The board's latest state. */
    board(): BoardState {
      const s = t.state('d0');
      if (s?.kind !== 'board') throw new Error(`the board holds ${JSON.stringify(s)}`);
      return s;
    },
    /** The last state `id`'s view got for itself alone. */
    own: (id: DeviceId) => heard.get(id)!.filter((s): s is ControllerState => s.kind === 'controller').at(-1),
    /**
     * `id`'s view sends an answer, as its button `choice` would, and
     * everything it sets off lands. The headless screen cannot press any
     * button but the last, and the harness has no `send`: one macrotask (no
     * time passes) lets the link and network deliveries, all microtasks, run.
     */
    async answer(id: DeviceId, choice: number) {
      view(id).send({ t: 'answer', choice } satisfies QuizMessage);
      await setImmediate();
    },
    /** The right choice of the question on the board. */
    right(): number {
      const s = t.state('d0');
      return QUESTIONS.find((q) => s?.kind === 'board' && q.text === s.question)!.answer;
    },
    text: (id: DeviceId) => texts(view(id).root),
    hostLog: () => t.events('d0').flatMap((e) => (e.t === 'log' ? [e.args.join(' ')] : [])),
  };
}

describe('Quiz', () => {
  it('declares one board Tile, 1–4 Controllers and Players seated at them, no tick and no bots, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, tickHz, bots, seats } = quiz.manifest;
    expect({ tiles, controllers, players, tickHz, bots, seats }).toEqual({ tiles: { min: 1, max: 1 }, controllers: { min: 1, max: 4 }, players: { min: 1, max: 4 }, tickHz: 0, bots: false, seats: 'controllers' });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
  });

  it('hands each Controller to the Player seated at it at the start and leaves the third idle', async () => {
    const q = await start();
    const holders = [
      { deviceId: 'c0', playerId: 'p-ann' },
      { deviceId: 'c1', playerId: 'p-bo' },
      { deviceId: 'c2', playerId: null },
    ];
    for (const id of DEVICES) {
      expect(q.t.events(id).filter((e) => e.t === 'holders').at(-1), id).toEqual({ t: 'holders', holders });
      expect(CONTROLLERS.map((c) => q.view(id).holder(c)), id).toEqual(['p-ann', 'p-bo', null]);
    }

    const first = q.board();
    expect(first).toMatchObject({ kind: 'board', phase: 'ask', round: 0, until: QUIZ.answerMs, answered: [], scores: { 'p-ann': 0, 'p-bo': 0 } });
    expect(first).not.toHaveProperty('answer');
    expect(q.own('c0')).toEqual({ kind: 'controller', phase: 'ask', round: 0, question: first.question, choices: first.choices, picked: null, score: 0 });
    // The Controller shows the question itself, then the four choices as buttons.
    expect(q.text('c0')).toEqual(['Ann · 0', `1 / ${TOTAL}`, first.question, 'Pick an answer', ...first.choices.map((c, k) => `${'ABCD'[k]}\u2003${c}`)]);
    // The idle Controller gets the board's broadcasts only, and waits.
    expect(q.heard('c2').map((s) => s.kind)).toEqual(['board']);
    expect(q.text('c2')).toEqual(['Waiting for a player', 'A\u2003', 'B\u2003', 'C\u2003', 'D\u2003']);
    await q.t.stop();
  });

  it('gives a Player without a seat the next Controller nobody holds', async () => {
    const q = await start({ ...MATCH, players: [{ playerId: 'p-ann', name: 'Ann', deviceId: 'c1' }, { playerId: 'p-bo', name: 'Bo' }] });
    expect(CONTROLLERS.map((c) => q.view('d0').holder(c))).toEqual(['p-bo', 'p-ann', null]);
    await q.t.stop();
  });

  it('counts the first answer per Holder, ignores the rest, and keeps each Controller’s state its own', async () => {
    const q = await start();
    const right = q.right();
    const wrong = (right + 1) % 4;
    await q.t.tick(2000);
    await q.answer('c0', wrong);
    await q.answer('c0', right); // Ann's second answer: ignored
    await q.answer('c2', right); // the idle Controller has no Holder: ignored
    await q.answer('d0', right); // nor does a Tile

    expect(q.board()).toMatchObject({ phase: 'ask', answered: ['p-ann'] });
    expect(q.own('c0')).toMatchObject({ phase: 'ask', picked: wrong });
    expect(q.own('c1')).toMatchObject({ phase: 'ask', picked: null });
    expect(q.text('c0')).toContain('Locked in');
    expect(q.text('c1')).toContain('Pick an answer');
    expect(q.hostLog()).toEqual(['Ann locked in']);

    // What a Controller sees with both kinds of state: `onState` hears each in publish order, and
    // `latest()` is simply the last one applied. The host published the board, then Ann's own state to
    // c0 alone: c0's latest is its own, but c1's is now the board, though its own was published later than
    // the board it replaced.
    expect(q.t.latest('c0')?.state.kind).toBe('controller');
    expect(q.t.latest('c1')?.state.kind).toBe('board');
    expect(q.heard('c0').map((s) => s.kind)).toEqual(['board', 'controller', 'board', 'controller']);
    expect(q.heard('c1').map((s) => s.kind)).toEqual(['board', 'controller', 'board']);
    expect(q.heard('d0').map((s) => s.kind)).toEqual(['board', 'board']);

    // Bo was the last Holder to answer: the reveal comes at once. Ann's wrong first answer earns nothing.
    await q.answer('c1', right);
    expect(q.board()).toMatchObject({ phase: 'reveal', answer: right, gained: { 'p-ann': 0, 'p-bo': points(2000) }, scores: { 'p-ann': 0, 'p-bo': points(2000) } });
    expect(q.own('c0')).toMatchObject({ phase: 'reveal', picked: wrong, answer: right, gained: 0, score: 0 });
    expect(q.text('c0')).toContain('Wrong');
    expect(q.text('c1')).toContain(`Right! +${points(2000)}`);
    await q.t.stop();
  });

  it('scores a right answer higher the sooner it reaches the host', async () => {
    const q = await start();
    const right = q.right();
    await q.t.tick(3000);
    await q.answer('c0', right);
    await q.t.tick(3000);
    expect(q.board().phase).toBe('ask');
    await q.answer('c1', right);
    expect(points(3000)).toBeGreaterThan(points(6000));
    expect(q.board()).toMatchObject({ phase: 'reveal', gained: { 'p-ann': points(3000), 'p-bo': points(6000) }, scores: { 'p-ann': points(3000), 'p-bo': points(6000) } });
    // The host's `now()` is the harness clock give or take float error (6000.000000000025 here).
    expect(q.board().until).toBeCloseTo(6000 + QUIZ.revealMs, 6);
    expect(q.own('c0')).toMatchObject({ gained: points(3000), score: points(3000) });

    // The next question after the reveal's time.
    await q.t.tick(QUIZ.revealMs - 1);
    expect(q.board().phase).toBe('reveal');
    await q.t.tick(1);
    expect(q.board()).toMatchObject({ phase: 'ask', round: 1, answered: [] });
    expect(q.own('c1')).toMatchObject({ phase: 'ask', round: 1, picked: null, score: points(6000) });
    await q.t.stop();
  });

  it('reveals on the timer when a Holder does not answer', async () => {
    const q = await start();
    const right = q.right();
    await q.t.tick(1500);
    await q.answer('c0', right);
    await q.t.tick(QUIZ.answerMs - 1500 - 1);
    expect(q.board().phase).toBe('ask');
    await q.t.tick(1);
    expect(q.board()).toMatchObject({ phase: 'reveal', answer: right, gained: { 'p-ann': points(1500), 'p-bo': 0 } });
    expect(q.own('c1')).toMatchObject({ phase: 'reveal', picked: null, gained: 0 });
    expect(q.text('c1')).toContain('Too slow');
    // Too late: the question is closed.
    await q.answer('c1', right);
    expect(q.board().answered).toEqual(['p-ann']);
    await q.t.stop();
  });

  it('does not count a pause as answer time', async () => {
    const q = await start();
    await q.t.tick(2000);
    await q.t.setPaused({ kind: 'platform' });
    await q.t.tick(10_000);
    await q.t.setPaused(null);
    expect(q.board().until).toBe(QUIZ.answerMs + 10_000);
    await q.t.tick(1000);
    await q.answer('c0', q.right());
    await q.answer('c1', q.right());
    expect(q.board().gained).toEqual({ 'p-ann': points(3000), 'p-bo': points(3000) });
    await q.t.stop();
  });

  it('asks every question once in the seed’s order and ends with the scores and the ranking', async () => {
    const q = await start();
    const asked: string[] = [];
    let bo = 0;
    for (let round = 0; round < TOTAL; round++) {
      expect(q.board()).toMatchObject({ phase: 'ask', round });
      asked.push(q.board().question);
      const right = q.right();
      await q.t.tick(1000);
      await q.answer('c1', right);
      await q.answer('c0', (right + 1) % 4);
      bo += points(1000);
      await q.t.tick(QUIZ.revealMs);
    }
    expect(new Set(asked).size).toBe(TOTAL);
    expect(q.t.result()).toEqual({ scores: { 'p-ann': 0, 'p-bo': bo }, ranking: ['p-bo', 'p-ann'] });
    for (const id of DEVICES) {
      expect(q.t.events(id).filter((e) => e.t === 'fault'), id).toEqual([]);
      expect(q.t.events(id).at(-1), id).toEqual({ t: 'closed', reason: 'ended', detail: 'the game ended the Match' });
    }

    // Another seed, another order.
    const other = await start({ ...MATCH, seed: 2 });
    expect(other.board().question).not.toBe(asked[0]);
    await other.t.stop();
  });

  it('sends the answer from a Controller’s DOM button', async () => {
    const q = await start();
    // The headless screen hits the last element the view appended, wherever the pointer is: button D.
    await q.t.input('c0', 'down', { x: 32, y: 120 });
    expect(q.board().answered).toEqual(['p-ann']);
    expect(q.own('c0')).toMatchObject({ picked: 3 });
    expect(q.text('c0')).toContain('Locked in');
    // A second tap sends nothing more: the view knows it is locked in.
    await q.t.input('c0', 'up', { x: 32, y: 120 });
    await q.t.input('c0', 'down', { x: 32, y: 120 }, 2);
    expect(q.hostLog()).toEqual(['Ann locked in']);
    await q.t.stop();
  });
});
