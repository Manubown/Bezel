/**
 * The Players' colours: the night table's coral and teal, then violet and lime (`--player-1` … `--player-4` in
 * `packages/look/tokens.css`; a test keeps the two the same). A Player's colour is the one of their position in the
 * Match's Player list, `match.players`, which every Device gets in the same order: the platform's screens and the
 * Games agree on it with nothing more on the wire (spec outside-view D10).
 */
export const PLAYER_COLOURS: readonly string[] = ['#ff6b4a', '#2ec4b6', '#a98bff', '#c2e05a'];

/** The colour of the Player at `position` in `match.players` (0: the first); past the fourth they repeat. */
export function playerColour(position: number): string {
  if (!Number.isInteger(position) || position < 0) throw new RangeError(`playerColour: ${position} is not a position in the Player list`);
  return PLAYER_COLOURS[position % PLAYER_COLOURS.length]!;
}
