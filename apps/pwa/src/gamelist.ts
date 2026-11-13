import type { TemplateId } from '@mgc/layout';
import type { Manifest, Range } from '@mgc/sdk';
import { arrangements } from './lobby';

/**
 * The Games players see on the Host, in the order they see them (spec D2): Pong, then Air Hockey.
 * The platform's choice, not a Manifest field; the other Games show in Maker mode only.
 */
export const FEATURED: readonly string[] = ['mgc.pong', 'mgc.air-hockey'];

/** The Games the Host offers: in Maker mode every discovered Game as given, else the featured ones in their order. */
export function gameList(discovered: readonly Manifest[], maker: boolean): Manifest[] {
  if (maker) return [...discovered];
  return FEATURED.flatMap((id) => discovered.filter((g) => g.id === id));
}

/**
 * The Game picked when the sheet opens: the remembered pick (`Lobby.picked`) if `shown` has it, else the first featured
 * Game it has (Pong, in Maker mode too), else the first shown.
 */
export function firstPick(shown: readonly Manifest[], remembered: string | undefined): Manifest | undefined {
  return shown.find((g) => g.id === remembered) ?? gameList(shown, false)[0] ?? shown[0];
}

/** How the phones on the table lie in each arrangement, in words a stranger reads. */
export const ARRANGEMENT: Readonly<Record<TemplateId, string>> = { row: 'in a row', column: 'end to end', grid: 'in a grid' };

/**
 * A Game card's line: how many play and how the phones lie once it is picked, in its first arrangement
 * ("2 players · phones in a row"), and the phones held in hand when it takes any.
 */
export function cardLine(game: Manifest): string {
  const { players, tiles, controllers } = game;
  const table = tiles.max === 1 ? 'one phone on the table' : `phones ${ARRANGEMENT[arrangements(game)[0]!]}`;
  const hand = controllers.max > 0 ? `, ${controllers.max === 1 && controllers.min === 1 ? 'one' : count(controllers)} in hand` : '';
  return `${count(players)} player${players.max === 1 ? '' : 's'} · ${table}${hand}`;
}

/** `2`, `1–4`, or `up to 2` for a range from none. */
function count({ min, max }: Range): string {
  return min === max ? String(min) : min === 0 ? `up to ${max}` : `${min}–${max}`;
}
