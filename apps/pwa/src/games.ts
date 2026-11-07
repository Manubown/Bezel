import type { Game } from '@mgc/sdk';

/**
 * Every Game in `games/*`, found by its folder: a package there is in the
 * Host's list the moment it exists. `games/_template` is the starter and is
 * left out. Sorted by name so the list is stable across machines.
 */
const found = import.meta.glob<Game>(['../../../games/*/src/index.ts', '!../../../games/_template/**'], { eager: true, import: 'default' });

export const GAMES: readonly Game[] = Object.entries(found)
  .map(([path, game]) => {
    if (!game?.manifest?.id) throw new Error(`${path} does not default-export a Game (defineGame)`);
    return game;
  })
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

const ids = new Set<string>();
for (const g of GAMES) {
  if (ids.has(g.manifest.id)) throw new Error(`Two Games share the manifest id ${g.manifest.id}`);
  ids.add(g.manifest.id);
}
