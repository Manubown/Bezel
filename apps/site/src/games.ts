import { TEMPLATE_WORDS, cardLine, gameList, templatesOf } from '@mgc/pwa/gamelist';
import type { GAMES } from '@mgc/pwa/games';

/** A Game's Manifest, as the app discovers it in `games/*`. */
type Manifest = (typeof GAMES)[number]['manifest'];
type Template = keyof typeof TEMPLATE_WORDS;

/** The most phones a Game's drawing shows. */
const DRAWN_PHONES = 3;

/** A Game as the home page lists it. */
export interface HomeGame {
  id: string;
  name: string;
  /** What its card in the app says: how many play and how the phones lie ("2 players · phones in a row"). */
  line: string;
  /**
   * How many phones lie on the table, and the other ways they can lie beside the first, which `line` names
   * ("Up to 2 phones; they can also lie in a row").
   */
  table: string;
  /** A bot can stand in for a player (`Manifest.bots`). */
  bot: boolean;
  /** Its drawing: the phones as the app lays them when the Game is picked, in its first template. */
  drawn: { template: Template; phones: number };
}

/** The Games the home page lists: the ones players see in the app (`gameList`), in its order, from their Manifests. */
export function homeGames(discovered: readonly Manifest[]): HomeGame[] {
  return gameList(discovered, false).map((game) => ({
    id: game.id,
    name: game.name,
    line: cardLine(game),
    table: table(game),
    bot: game.bots === true,
    drawn: { template: templatesOf(game)[0]!, phones: Math.min(game.tiles.max, DRAWN_PHONES) },
  }));
}

function table(game: Manifest): string {
  const { min, max } = game.tiles;
  if (max === 1) return 'One phone';
  const phones = min === max ? `${max} phones` : min <= 1 ? `Up to ${max} phones` : `${min} to ${max} phones`;
  const more = templatesOf(game).slice(1).map((t) => TEMPLATE_WORDS[t]);
  return more.length ? `${phones}; they can also lie ${or(more)}` : phones;
}

/** `a`, `a or b`, `a, b or c`. */
function or(words: readonly string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;
}
