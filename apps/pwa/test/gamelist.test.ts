import { describe, expect, it } from 'vitest';
import type { Manifest } from '@mgc/sdk';
import { cardLine, firstPick, gameList } from '../src/gamelist';

const game = (id: string, name: string, more: Partial<Manifest> = {}): Manifest => ({
  id,
  name,
  version: '1.0.0',
  tiles: { min: 1, max: 4 },
  controllers: { min: 0, max: 0 },
  players: { min: 2, max: 2 },
  host: './index.js',
  view: './index.js',
  ...more,
});

/** Every Game in `games/*` as the app discovers them: sorted by name. */
const DISCOVERED = [
  game('mgc.air-hockey', 'Air Hockey'),
  game('mgc.breakout', 'Breakout'),
  game('mgc.pass', 'Pass'),
  game('mgc.pong', 'Pong'),
  game('mgc.quiz', 'Quiz'),
  game('mgc.snake', 'Snake'),
  game('mgc.tap-race', 'Tap Race'),
];
const ids = (games: readonly Manifest[]) => games.map((g) => g.id);

describe('gameList', () => {
  it('offers players Pong, then Air Hockey, whatever else is discovered and in whatever order', () => {
    expect(ids(gameList(DISCOVERED, false))).toEqual(['mgc.pong', 'mgc.air-hockey']);
    expect(ids(gameList([...DISCOVERED].reverse(), false))).toEqual(['mgc.pong', 'mgc.air-hockey']);
  });

  it('offers a maker every discovered Game, as discovered', () => {
    expect(ids(gameList(DISCOVERED, true))).toEqual(ids(DISCOVERED));
  });
});

describe('firstPick', () => {
  const players = gameList(DISCOVERED, false);
  const makers = gameList(DISCOVERED, true);

  it('is Pong on a Device that never picked, in Maker mode too', () => {
    expect(firstPick(players, undefined)?.id).toBe('mgc.pong');
    expect(firstPick(makers, undefined)?.id).toBe('mgc.pong');
  });

  it('is the remembered Game when the list the Device shows has it', () => {
    expect(firstPick(players, 'mgc.air-hockey')?.id).toBe('mgc.air-hockey');
    expect(firstPick(makers, 'mgc.snake')?.id).toBe('mgc.snake');
  });

  it('is Pong when the remembered Game is not in the list: a maker’s pick on a player’s list, or a Game gone', () => {
    expect(firstPick(players, 'mgc.snake')?.id).toBe('mgc.pong');
    expect(firstPick(players, 'mgc.gone')?.id).toBe('mgc.pong');
    expect(firstPick(makers, 'mgc.gone')?.id).toBe('mgc.pong');
  });

  it('is the first Game shown when the list has no Pong', () => {
    expect(firstPick(gameList(DISCOVERED.slice(1, 3), true), undefined)?.id).toBe('mgc.breakout');
  });
});

describe('cardLine', () => {
  it('says how many play and how the phones lie, the way the Game is picked', () => {
    expect(cardLine(game('mgc.pong', 'Pong', { templates: ['row'] }))).toBe('2 players · phones in a row');
    expect(cardLine(game('mgc.air-hockey', 'Air Hockey', { tiles: { min: 1, max: 2 }, templates: ['column', 'row'] }))).toBe('2 players · phones end to end');
    expect(cardLine(game('mgc.grid', 'Grid', { templates: ['grid', 'row'] }))).toBe('2 players · phones in a grid');
  });

  it('gives a range of Players as a range, one Player as one', () => {
    expect(cardLine(game('mgc.tap-race', 'Tap Race', { players: { min: 1, max: 4 } }))).toBe('1–4 players · phones in a row');
    expect(cardLine(game('mgc.solo', 'Solo', { players: { min: 1, max: 1 } }))).toBe('1 player · phones in a row');
  });

  it('names one phone on the table as one, and the phones held in hand', () => {
    const quiz = game('mgc.quiz', 'Quiz', { tiles: { min: 1, max: 1 }, controllers: { min: 1, max: 4 }, players: { min: 1, max: 4 } });
    expect(cardLine(quiz)).toBe('1–4 players · one phone on the table, 1–4 in hand');
    const pass = game('mgc.pass', 'Pass', { controllers: { min: 1, max: 1 }, players: { min: 1, max: 4 } });
    expect(cardLine(pass)).toBe('1–4 players · phones in a row, one in hand');
  });
});
