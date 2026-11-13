import { describe, expect, it } from 'vitest';
import { GAMES } from '@mgc/pwa/games';
import { homeGames } from '../src/games';

type Manifest = Parameters<typeof homeGames>[0][number];

/** A Manifest that differs from the shipped one where the test says so: the page reads it, it never types a Game. */
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

describe('the home page’s Games', () => {
  it('are the Games players see in the app, Pong then Air Hockey, in the words of their Manifests', () => {
    expect(homeGames(GAMES.map((g) => g.manifest)).map(({ name, line }) => ({ name, line }))).toEqual([
      { name: 'Pong', line: '2 players · phones in a row' },
      { name: 'Air Hockey', line: '2 players · phones end to end' },
    ]);
  });

  it('say how many phones lie on the table, and the other ways they can lie beside the one the card line names', () => {
    const [pong, hockey] = homeGames([
      game('mgc.air-hockey', 'Air Hockey', { tiles: { min: 1, max: 2 }, templates: ['column', 'row'] }),
      game('mgc.pong', 'Pong', { tiles: { min: 2, max: 3 } }),
    ]);
    expect(pong?.table).toBe('2 to 3 phones; they can also lie end to end or in a grid');
    expect(hockey?.table).toBe('Up to 2 phones; they can also lie in a row');
    expect(homeGames([game('mgc.pong', 'Pong', { tiles: { min: 1, max: 4 }, templates: ['row'] })])[0]?.table).toBe('Up to 4 phones');
    expect(homeGames([game('mgc.pong', 'Pong', { tiles: { min: 1, max: 1 } })])[0]?.table).toBe('One phone');
  });

  it('say whether a bot can stand in for a player', () => {
    const [pong, hockey] = homeGames([game('mgc.pong', 'Pong', { bots: true }), game('mgc.air-hockey', 'Air Hockey')]);
    expect(pong?.bot).toBe(true);
    expect(hockey?.bot).toBe(false);
  });

  it('are drawn as their phones lie when picked: the first template, at most three phones', () => {
    const [pong, hockey] = homeGames([
      game('mgc.pong', 'Pong', { tiles: { min: 1, max: 4 }, templates: ['row'] }),
      game('mgc.air-hockey', 'Air Hockey', { tiles: { min: 1, max: 2 }, templates: ['column', 'row'] }),
    ]);
    expect(pong?.drawn).toEqual({ template: 'row', phones: 3 });
    expect(hockey?.drawn).toEqual({ template: 'column', phones: 2 });
  });
});
