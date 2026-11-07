import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceId, Game, MatchInfo, Player, Tile, Vec2 } from '@mgc/sdk';
import { createTestMatch, type TestMatch } from '@mgc/sdk/test';
import game, { TAP_RACE, type TapRaceState } from '../src';

/** Three phones in a row, 70 × 150 mm each with a 4 mm gap. */
const tiles: Tile[] = [0, 1, 2].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
/** Ann sits at the first Tile, Bo at the last, as the lobby seats them; the middle Tile seats nobody. */
const ANN: Player = { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' };
const BO: Player = { playerId: 'p-bo', name: 'Bo', deviceId: 'd2' };
/** A bot Player in slot `slot`, as the lobby makes it. */
const bot = (slot: 0 | 1): Player => ({ playerId: `bot:${slot}`, name: 'Bot', bot: true });
const row = (players: Player[], seed = 1): MatchInfo => ({
  matchId: 'match-1',
  seed,
  tickHz: 0,
  players,
  devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles,
  bounds: { x: 0, y: 0, w: 218, h: 150 },
});
const COUNTDOWN_MS = TAP_RACE.count * TAP_RACE.countMs;

type T = TestMatch<TapRaceState>;
/** Steps the clock `step` ms at a time until the state the middle Tile's view holds satisfies `ok`; fails after `within` ms. */
async function until(t: T, ok: (s: TapRaceState) => boolean, step = 10, within = 10_000): Promise<TapRaceState> {
  for (let waited = 0; !ok(t.state('d1')!); waited += step) {
    if (waited > within) throw new Error(`not within ${within} ms: ${JSON.stringify(t.state('d1'))}`);
    await t.tick(step);
  }
  return t.state('d1')!;
}
/** A finger down and up on `deviceId` at world point `at`. */
async function tap(t: T, deviceId: DeviceId, at: Vec2): Promise<void> {
  await t.input(deviceId, 'down', at);
  await t.input(deviceId, 'up', at);
}
const hostLog = (t: T): string[] => t.events('d0').flatMap((e) => (e.t === 'log' ? [e.args.join(' ')] : []));
const faults = (t: T) => tiles.flatMap((tile) => t.events(tile.deviceId).filter((e) => e.t === 'fault'));

/** The game with each view's `fillText` strings from its latest frame kept, read off the SDK's headless recording canvas. */
function withTexts(): { game: Game; texts(deviceId: DeviceId): string[] } {
  const last = new Map<DeviceId, string[]>();
  const watched: Game = {
    ...game,
    view(ctx) {
      const h = game.view(ctx);
      return {
        ...h,
        draw(f) {
          const ops = Reflect.get(f.ctx, 'ops') as unknown[][];
          ops.length = 0;
          h.draw!(f);
          last.set(ctx.deviceId, ops.flatMap((op) => (op[0] === 'fillText' ? [String(op[1])] : [])));
        },
      };
    },
  };
  return { game: watched, texts: (id) => last.get(id) ?? [] };
}

describe('Tap Race', () => {
  it('declares 1–4 Tiles and Players, no Controllers, bots, no tick, and imports nothing but the SDK', () => {
    const { tiles, controllers, players, bots, tickHz } = game.manifest;
    expect({ tiles, controllers, players, bots, tickHz }).toEqual({ tiles: { min: 1, max: 4 }, controllers: { min: 0, max: 0 }, players: { min: 1, max: 4 }, bots: true, tickHz: 0 });

    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
    const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
  });

  it('counts down on its timer, digits large on every Tile, then plays with no target yet', async () => {
    const w = withTexts();
    const t = await createTestMatch<TapRaceState>({ game: w.game, match: row([ANN, BO]) });
    expect(t.state('d1')).toEqual({ phase: 'countdown', count: 3, scores: { 'p-ann': 0, 'p-bo': 0 }, round: 0 });
    await t.tick(TAP_RACE.countMs - 1);
    expect(t.state('d1')!.count).toBe(3);
    for (const id of ['d0', 'd1', 'd2']) expect(w.texts(id), id).toEqual(['Ann 0', 'Bo 0', '3']);
    await t.tick(1);
    expect(t.state('d1')!.count).toBe(2);
    await t.tick(TAP_RACE.countMs);
    expect(t.state('d1')!.count).toBe(1);
    await t.tick(TAP_RACE.countMs);
    expect(t.state('d1')).toEqual({ phase: 'play', scores: { 'p-ann': 0, 'p-bo': 0 }, round: 0 });
    await t.tick(20);
    expect(w.texts('d2')).toEqual(['Ann 0', 'Bo 0']);
    expect(faults(t)).toEqual([]);
    await t.stop();
  });

  it('puts a target on a Tile that seats a Player, never the middle one; a tap in its ring on its Tile scores, and the next one follows', async () => {
    const t = await createTestMatch<TapRaceState>({ game, match: row([ANN, BO]) });
    await t.tick(COUNTDOWN_MS);
    const { target } = await until(t, (s) => s.target !== undefined);
    const first = target!;
    expect(['d0', 'd2']).toContain(first.deviceId);
    expect(t.state('d1')!.round).toBe(1);
    // Wholly on its Tile, clear of the scores along its top.
    const tile = tiles.find((x) => x.deviceId === first.deviceId)!;
    expect(first.x - TAP_RACE.target).toBeGreaterThanOrEqual(tile.x);
    expect(first.x + TAP_RACE.target).toBeLessThanOrEqual(tile.x + tile.w);
    expect(first.y - TAP_RACE.target).toBeGreaterThanOrEqual(tile.y + TAP_RACE.band);
    expect(first.y + TAP_RACE.target).toBeLessThanOrEqual(tile.y + tile.h - TAP_RACE.band);

    // The same world point through the other seated Tile and through the middle one, and just outside the ring on its own Tile: nothing.
    const [other, seated] = first.deviceId === 'd0' ? ['d2', 'p-ann'] : ['d0', 'p-bo'];
    await tap(t, other, first);
    await tap(t, 'd1', first);
    await tap(t, first.deviceId, { x: first.x, y: first.y + TAP_RACE.target + 0.5 });
    expect(t.state('d1')).toMatchObject({ target: first, scores: { 'p-ann': 0, 'p-bo': 0 } });

    // Just inside it, on its own Tile: a point for the Player seated there, the target gone.
    const at = { x: first.x - TAP_RACE.target + 0.5, y: first.y };
    await tap(t, first.deviceId, at);
    expect(t.state('d1')).toEqual({ phase: 'play', scores: { 'p-ann': 0, 'p-bo': 0, [seated]: 1 }, round: 1, lastHit: { playerId: seated, ...at } });
    expect(hostLog(t)).toEqual([`${seated === 'p-ann' ? 'Ann' : 'Bo'} scored (1)`]);
    // A second tap there scores nothing more; the next target comes within `spawnMs`.
    await tap(t, first.deviceId, at);
    const shown = t.now();
    const second = await until(t, (s) => s.target !== undefined);
    expect(second.round).toBe(2);
    expect(second.target!.since - shown).toBeGreaterThanOrEqual(TAP_RACE.spawnMs.min);
    expect(second.target!.since - shown).toBeLessThanOrEqual(TAP_RACE.spawnMs.max);
    expect(second.scores[seated]).toBe(1);
    await t.stop();
  });

  it('lets a target nobody taps fade after `lifeMs`, and after `rounds` targets shows the winner, then ends ranked by score', async () => {
    const w = withTexts();
    const t = await createTestMatch<TapRaceState>({ game: w.game, match: row([ANN, BO]) });
    await t.tick(COUNTDOWN_MS);
    const shown: DeviceId[] = [];
    for (let round = 1; round <= TAP_RACE.rounds; round++) {
      const { target } = await until(t, (s) => s.round === round && s.target !== undefined);
      shown.push(target!.deviceId);
      // Bo taps every target on his Tile; Ann only her first, and lets the others fade.
      if (target!.deviceId === 'd2' || shown.filter((d) => d === 'd0').length === 1) await tap(t, target!.deviceId, target!);
      else {
        await t.tick(TAP_RACE.lifeMs - 20);
        expect(t.state('d1')!.target).toEqual(target);
        const faded = await until(t, (s) => s.target === undefined, 5);
        expect(t.latest('d1')!.t - target!.since).toBeGreaterThanOrEqual(TAP_RACE.lifeMs);
        expect(faded.scores['p-ann']).toBe(1);
      }
    }
    // Seed 1 puts targets on both seated Tiles, never on the middle one: Ann scores her first, Bo both of his.
    expect(shown).toEqual(['d0', 'd0', 'd2', 'd0', 'd0', 'd0', 'd2']);
    const done = t.state('d1')!;
    expect(done).toMatchObject({ phase: 'done', round: TAP_RACE.rounds, scores: { 'p-ann': 1, 'p-bo': 2 } });
    expect(done.target).toBeUndefined();
    // Every Tile shows the winner until the host ends the Match.
    await t.tick(20);
    for (const id of ['d0', 'd1', 'd2']) expect(w.texts(id), id).toEqual(['Ann 1', 'Bo 2', 'Bo wins']);
    expect(t.result()).toBeUndefined();
    await t.tick(TAP_RACE.resultMs);
    expect(t.result()).toEqual({ scores: { 'p-ann': 1, 'p-bo': 2 }, ranking: ['p-bo', 'p-ann'] });
    expect(hostLog(t)).toEqual(['Ann scored (1)', 'Bo scored (1)', 'Bo scored (2)']);
    expect(faults(t)).toEqual([]);
    for (const tile of tiles) expect(t.events(tile.deviceId).at(-1), tile.deviceId).toEqual({ t: 'closed', reason: 'ended', detail: 'the game ended the Match' });
  });

  it('plays a bot in slot 1: it scores on its own after its reaction time, sometimes misses, and loses a target tapped first', async () => {
    const t = await createTestMatch<TapRaceState>({ game, match: row([ANN, bot(1)]) });
    await t.tick(COUNTDOWN_MS);
    // Ann taps the first target at once and beats the bot to it.
    const first = (await until(t, (s) => s.target !== undefined)).target!;
    await tap(t, 'd0', first);
    expect(t.state('d1')!.scores).toEqual({ 'p-ann': 1, 'bot:1': 0 });

    // Then she lets the bot play: each target it scores, it scores where the target is, within its reaction time.
    const reactions: number[] = [];
    let misses = 0;
    for (let round = 2; round <= TAP_RACE.rounds; round++) {
      const shown = await until(t, (s) => s.round === round && s.target !== undefined, 5);
      const target = shown.target!;
      expect(target.deviceId).toBe('d0'); // the bot sits nowhere: every target goes to the only human's Tile
      const gone = await until(t, (s) => s.target === undefined, 5);
      const after = t.latest('d1')!.t - target.since;
      if (gone.scores['bot:1']! > shown.scores['bot:1']!) {
        reactions.push(after);
        expect(gone.lastHit).toEqual({ playerId: 'bot:1', x: target.x, y: target.y });
      } else {
        misses++;
        expect(after).toBeGreaterThanOrEqual(TAP_RACE.lifeMs);
      }
    }
    for (const ms of reactions) {
      expect(ms).toBeGreaterThanOrEqual(TAP_RACE.bot.reactMs.min);
      expect(ms).toBeLessThanOrEqual(TAP_RACE.bot.reactMs.max + 5);
    }
    // Seed 1: the bot scores three of the six and misses three.
    expect({ hits: reactions.length, misses }).toEqual({ hits: 3, misses: 3 });
    await t.tick(TAP_RACE.resultMs + 20);
    expect(t.result()).toEqual({ scores: { 'p-ann': 1, 'bot:1': 3 }, ranking: ['bot:1', 'p-ann'] });
    expect(hostLog(t).filter((l) => l.startsWith('Bot'))).toEqual(['Bot scored (1)', 'Bot scored (2)', 'Bot scored (3)']);
    expect(faults(t)).toEqual([]);
  });

  it('with bots alone, puts targets on any Tile and plays to the end by itself', async () => {
    const t = await createTestMatch<TapRaceState>({ game, match: row([bot(0), bot(1)]) });
    const shown = new Set<DeviceId>();
    for (let k = 0; k < 4000 && !t.result(); k++) {
      await t.tick(10);
      const target = t.state('d1')?.target;
      if (target) shown.add(target.deviceId);
    }
    expect(shown).toEqual(new Set(['d0', 'd1', 'd2']));
    const { scores } = t.result()!;
    expect(scores!['bot:0']! + scores!['bot:1']!).toBeLessThanOrEqual(TAP_RACE.rounds);
    expect(scores!['bot:0']! + scores!['bot:1']!).toBeGreaterThan(0);
  });

  it('a shared best score is a draw: the result has no ranking, so the platform reads it as one', async () => {
    // Ann and Bo each tap one target and let the rest fade.
    const t = await createTestMatch<TapRaceState>({ game, match: row([ANN, BO]) });
    await t.tick(COUNTDOWN_MS);
    const tapped = new Set<DeviceId>();
    for (let round = 1; round <= TAP_RACE.rounds; round++) {
      const { target } = await until(t, (s) => s.round === round && s.target !== undefined);
      if (!tapped.has(target!.deviceId)) {
        tapped.add(target!.deviceId);
        await tap(t, target!.deviceId, target!);
      }
    }
    await until(t, (s) => s.phase === 'done');
    await t.tick(TAP_RACE.resultMs + 20);
    expect(t.result()).toEqual({ scores: { 'p-ann': 1, 'p-bo': 1 } });
  });

  it('freezes the wait for the next target while paused', async () => {
    // Both runs step the clock alike until the pause: the harness hands a due timer over at the end of the animation
    // frame it fell in, so the spawn timer the countdown's last one arms starts from that frame's time.
    const start = async (): Promise<T> => {
      const t = await createTestMatch<TapRaceState>({ game, match: row([ANN, BO]) });
      await t.tick(COUNTDOWN_MS);
      await t.tick(100);
      return t;
    };
    // Unpaused, the first target appears at `due`.
    const plain = await start();
    const due = (await until(plain, (s) => s.target !== undefined)).target!.since;
    await plain.stop();

    // Paused 100 ms into the same wait for ten seconds: no target meanwhile, and it appears ten seconds later.
    const t = await start();
    await t.setPaused({ kind: 'platform' });
    await t.tick(10_000);
    expect(t.state('d1')).toEqual({ phase: 'play', scores: { 'p-ann': 0, 'p-bo': 0 }, round: 0 });
    await t.setPaused(null);
    const later = (await until(t, (s) => s.target !== undefined)).target!;
    expect(later.since).toBeCloseTo(due + 10_000, 6);
    await t.stop();
  });
});
