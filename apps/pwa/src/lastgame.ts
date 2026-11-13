/** localStorage: the manifest id of the Game this Device last picked on the Host's sheet (story 6). */
const LAST_GAME_KEY = 'mgc.lastGame';

/** The Game this Device last picked on the Host's sheet, on this visit or an earlier one; undefined before its first pick. */
export function lastGame(): string | undefined {
  return localStorage.getItem(LAST_GAME_KEY) ?? undefined;
}

/** The Host picked the Game `id` on its sheet: the sheet opens with it on the next visit, if it still offers it (`firstPick`). */
export function keepLastGame(id: string): void {
  localStorage.setItem(LAST_GAME_KEY, id);
}
