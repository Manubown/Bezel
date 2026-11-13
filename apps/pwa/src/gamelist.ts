import { TEMPLATE_IDS, type TemplateId } from '@mgc/layout';
import type { Manifest, Range } from '@mgc/sdk';

/**
 * The Games players see on the Host, in the order they see them (spec D2): Pong, then Air Hockey.
 * The platform's choice, not a Manifest field; the other Games show in Maker mode only.
 */
const FEATURED: readonly string[] = ['mgc.pong', 'mgc.air-hockey'];

/** The Games the Host offers: in Maker mode every discovered Game as given, else the featured ones in their order. */
export function gameList(discovered: readonly Manifest[], maker: boolean): Manifest[] {
  if (maker) return [...discovered];
  return FEATURED.flatMap((id) => discovered.filter((g) => g.id === id));
}

/**
 * The Game picked when the sheet opens: the first of the `remembered` picks, in order, that `shown` has (this Session's
 * pick across a reload of the Host's page, `Lobby.picked`, then the Device's last pick on an earlier visit,
 * `lastgame.ts`), else the first featured Game it has (Pong, in Maker mode too), else the first shown (spec D2, story 6).
 */
export function firstPick(shown: readonly Manifest[], remembered: readonly (string | undefined)[]): Manifest | undefined {
  for (const id of remembered) {
    const game = shown.find((g) => g.id === id);
    if (game) return game;
  }
  return gameList(shown, false)[0] ?? shown[0];
}

/** The templates `game` can be played in, the one picking it selects first (spec D6): its Manifest's `templates`, else every template. */
export function templatesOf(game: Manifest): readonly TemplateId[] {
  return game.templates?.length ? game.templates : TEMPLATE_IDS;
}

/** How the phones on the table lie in each template, in words a stranger reads. */
export const TEMPLATE_WORDS: Readonly<Record<TemplateId, string>> = { row: 'in a row', column: 'end to end', grid: 'in a grid' };

/**
 * A Game card's line: how many play and how the phones lie once it is picked, in its first template
 * ("2 players · phones in a row"), and the phones held in hand when it takes any.
 */
export function cardLine(game: Manifest): string {
  const { players, tiles, controllers } = game;
  const table = tiles.max === 1 ? 'one phone on the table' : `phones ${TEMPLATE_WORDS[templatesOf(game)[0]!]}`;
  const hand = controllers.max > 0 ? `, ${controllers.max === 1 && controllers.min === 1 ? 'one' : count(controllers)} in hand` : '';
  return `${count(players)} player${players.max === 1 ? '' : 's'} · ${table}${hand}`;
}

/** `2`, `1–4`, or `up to 2` for a range from none. */
function count({ min, max }: Range): string {
  return min === max ? String(min) : min === 0 ? `up to ${max}` : `${min}–${max}`;
}
