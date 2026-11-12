# 02: Two Games for players, and the arrangement follows the Game

**What to build:** A first phone offers Pong and Air Hockey, Pong first, each as a card that says how many play and how the phones lie. Picking a Game sets its arrangement, so Start is never refused for a wrong one. The other five Games appear in Maker mode only (spec D2, D6).

**Blocked by:** 01

**Status:** resolved

- [x] With Maker mode off the Game list is Pong, then Air Hockey; with it on, every discovered Game as today
- [x] A Device that never picked gets Pong; a remembered pick is used only if it is in the list the Device shows
- [x] Picking a Game selects the first template its Manifest names; the arrangement picker shows only when the Game names more than one, and offers only those
- [x] No start is refused for the arrangement; the other refusals (too few phones, too many) still say what is missing
- [x] The Controllers control shows only when the picked Game takes Controllers
- [x] Each Game card states Players and arrangement in words a stranger reads ("2 players · phones in a row")
- [x] The list and the remembered pick are covered by unit tests; the arrangement rule is covered where the lobby is tested today, over the in-memory transport
- [x] Two-tab browser smoke: Pong in a row and Air Hockey end to end each start on the first press of Start

## Comments

### 2026-11-12, Ticket02TwoGames (implementation)

**Changed**
- `apps/pwa/src/gamelist.ts` (new): `FEATURED` (Pong, Air Hockey), `gameList(discovered, maker)`, `firstPick(shown, remembered)`, `cardLine(game)` and `ARRANGEMENT`, the words for row, column, grid ("in a row", "end to end", "in a grid"). `apps/pwa/test/gamelist.test.ts`: 9 tests.
- `apps/pwa/src/lobby.ts`: `arrangements(game)` (the Manifest's `templates`, else all three). `setGame` lays the phones in the first one a Game names when it is picked anew, and keeps the Host's choice when the same Game is picked again. `setTemplate` ignores an arrangement the picked Game does not name. `start(game)` picks the Game first, so the arrangement refusal is gone. A picked Game that takes no Controllers puts every phone back on the table, and `setRole(…, 'controller')` is ignored while it is picked. `apps/pwa/test/lobby.test.ts` has 3 new tests over the MemoryHub. The Controller and reload tests now expect the phones back on the table after a Game without Controllers is picked. The "needs the column arrangement" assertion is gone.
- `apps/pwa/src/hud/sheet.ts`: one card per Game (name, then `cardLine`) in place of the Game row. The arrangement picker is rebuilt per Game, holds only the arrangements that Game names and is hidden when it names one. The Controllers block shows only when `controllers.max > 0`. The bar reads "2 phones · in a row". `HudOptions.games` stays every discovered Game and the sheet filters it with `HudOptions.maker`. `main.ts` is unchanged.
- `apps/pwa/index.html`: `.cards`/`.card` (two per row, at least 44 px high) replace the `.seg.games` rules.
- `games/air-hockey`: `templates: ['column', 'row']` (end to end first), and its manifest test.
- `packages/sdk/src/types.ts`: a doc line on `Manifest.templates`.
- Guide sentences these changes made false: `api.md` (`name`, `templates`), `getting-started.md` (Start Pong, a new Game shows with `?maker`), `running-on-phones.md` (bar, Game cards, arrangement and Controllers rows), `troubleshooting.md` (the arrangement refusal row is removed; a "not in Maker mode" cause is added), `your-first-game.md`, and the README's `pnpm dev` comment. No citation re-anchored.

**Decisions**
- D3's remaining gates come out of D2 and D6 and need no separate switch. The arrangement picker and the Controllers control follow the picked Game in both modes. Only the Games that need them (Quiz, Pass, Breakout, Snake, Tap Race) bring them, and those Games are listed only in Maker mode. A featured Game shows the picker only if it names more than one arrangement. Air Hockey does, so players see "End to end | In a row" under it, and nothing under Pong.
- Air Hockey's manifest now lists column first. The audit and this ticket's smoke want it end to end, and D6 picks the first template a Game names. Row stays in its list.
- The remembered pick is the existing one (`SavedLobby.game`, `sessionStorage` per table code and tab), now used only if the shown list has it. If not, Pong is picked, in Maker mode too: a Device that never picked gets Pong, even though Maker mode's list starts with Air Hockey. No new storage.
- `start(game)` picks the Game rather than refusing for the arrangement, so a start can never meet a wrong arrangement, Play again's start included.
- A Game that takes no Controllers clears the Controller marks. Otherwise its hidden Controllers control would leave a marked phone that cannot be unmarked and a Start refused for ever. The marks are not restored when a Game with Controllers is picked again: a maker marks them again.
- Card words: "N players" or "1–4 players", then "phones in a row / end to end / in a grid" in the first arrangement the Game names. If the Game takes one Tile at most: "one phone on the table". If it takes Controllers: ", one in hand" or ", 1–4 in hand". The picker uses the same words capitalised.

**Verified**
- Each slice red first, then green: `pnpm vitest run apps/pwa/test/gamelist.test.ts` (9 passed), `pnpm vitest run apps/pwa/test/lobby.test.ts` (16 passed), `pnpm vitest run games/air-hockey` (19 passed).
- `pnpm typecheck && pnpm test`: typecheck clean; 31 test files, 239 tests passed.
- Headless Chrome tabs at 390 × 844, one profile each, dev server on 5202. Screenshots were looked at, not committed:
  - First phone at `/`, Maker mode off: two cards, "Pong · 2 players · phones in a row" (picked) and "Air Hockey · 2 players · phones end to end". No arrangement picker, no Controllers, the bar reads "1 phone · in a row".
  - A second tab joined with `?room=3F4X`; the bar read "2 phones · in a row". One press of "Start Pong" started the Match on both tabs: the bar read "Pong · playing" with no reason line, and the paddles sat on the outer edges with the ball crossing between the tabs. After End match, tapping Air Hockey showed "End to end" (picked) and "In a row", and the bar read "2 phones · end to end". The roster read "below phone 1". One press of "Start Air Hockey" started it on both tabs: the bar read "Air Hockey · playing", and each tab's "touch to start" faced its own Player, one upside down.
  - `/?maker` on a fresh profile: seven cards in name order with Pong picked. Quiz had all three arrangements and Controllers. Breakout had "In a row | In a grid" and no Controllers. Pass had three arrangements and Controllers. Snake had three arrangements and no Controllers. Pong had neither.
  - Same tab, Snake picked, then reloaded as `/?maker=no` (same code): two cards with Pong picked. Air Hockey tapped, then reloaded: Air Hockey was still picked.
  - Maker mode with two tabs: Quiz picked and the second phone pressed as a Controller ("C Controller" in the roster). Tapping Pong put it back as phone 2, "right of phone 1 · Player 2", with Controllers hidden. One press of Start Pong started the Match.

**Not verified**
- Anything on phones.
- The card layout next to the other sheet tickets' changes: 03 reorders the sheet and 08 restyles it.

**For the next tickets**
- 03: the Game cards are `.cards.games`, followed by `.seg.arrangement` (often hidden) and `.roles` (hidden unless the Game takes Controllers). Move them as blocks.
- 05: `arrangements(game)` in `lobby.ts` is the list of arrangements a Game allows. `ARRANGEMENT` in `gamelist.ts` holds their words.
- 06: `lobby.start(game)` picks `game` before checking, so Play again with the last Match's Game also restores its arrangement if it changed.
