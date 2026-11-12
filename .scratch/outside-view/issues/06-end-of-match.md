# 06: The end of a Match leads to the next one

**What to build:** A finished Match reads "Ana wins 7–5". The first phone's card offers Play again (same Game, Players, arrangement and bots) and Change game; the other phones read that the first phone starts the next game. The sheet stays folded (spec D9).

**Blocked by:** 01

**Status:** resolved

- [x] A two-sided result's headline is the winner's name and both scores in one line; a draw and a result without scores still read sensibly; the existing result tests are extended to these
- [x] Play again on the first phone starts a Match with the same Game, Players, Layout and bots through the lobby's ordinary start; a test at the lobby's interface shows the second Match's frozen info equals the first's except for its identity
- [x] Play again is refused in words when a phone of that Match is no longer in the table
- [x] Change game opens the sheet
- [x] Other phones' cards say the first phone starts the next game and offer nothing to tap but closing
- [x] The sheet does not reopen by itself when a Match ends
- [x] The last-Match line uses the neutral text colour; a Match stopped from the first phone reads "Game ended on the first phone"
- [x] Two-tab browser smoke: two Pong Matches in a row with one tap between them

## Comments

### 2026-11-12, Ticket06EndOfMatch (implementation)

**Changed**
- `apps/pwa/src/result.ts`: `describeResult` reads two sides that both scored in one line, the winner's score first ("Bo wins 7–4", "Draw, 3–3"), with no detail. Three or more sides keep "<name> wins" or "Draw" with everyone's points in the detail. A ranking without scores gives "<name> wins", and an empty result "Match over". An abort reads "Game ended on the first phone" with no detail, so the runtime's "stopped by the platform" no longer shows. `apps/pwa/test/result.test.ts`: the result tests are rewritten and extended, and the abort expectation is changed.
- `apps/pwa/src/lobby.ts`: `Lobby.startAgain()`, the Host lobby's Play again. It keeps the last Match `start` froze and its Manifest. It refuses in words when a Device of that Match is not present ("Phone 2 is no longer at the table"; a Controller by its name), when a present Device was not in it ("Phone 4 joined the table after the last game"), or when the Players or Tiles the lobby would freeze now differ from the last Match's ("The table changed since the last game"). Otherwise it calls `start(game)`. On a Peer it throws "Only the Host starts a Match". `apps/pwa/test/lobby.test.ts` has 2 tests over the MemoryHub. In the first, a Tile drops and comes back during the first Match, and `startAgain` then gives a Match whose `MatchInfo` without `matchId` and `seed` strictly equals the first's, the same on the Peer. The second covers the three refusals and the success between them.
- `apps/pwa/src/hud.ts`: the `Sheet` interface (`open`, `unfold()`). `openHud` hands the sheet to the result card and gives the sheet a render callback for when the Host folds or unfolds it.
- `apps/pwa/src/hud/cards.ts` `lastCard`: with the sheet (the first phone), the card shows the headline, the detail if any, then Play again and Change game, with a refusal line under them. The refusal clears when the lobby changes. Without the sheet (the other phones), it shows the headline, the detail, "The first phone starts the next game" and "Tap to close", and a tap anywhere on it closes it. On the first phone the card is done for a Match once the sheet is unfolded. Nothing is built for ticket 11's install offer: the card is a stack of blocks, and the offer can go in as one more.
- `apps/pwa/src/hud/sheet.ts`: `hostSheet(root, o, onToggle)` returns a `Sheet`. The bar and `unfold()` call `onToggle`. A running Match still folds the sheet, but its end no longer unfolds it. The reason line gets the class `last` while it shows the last Match rather than a refusal.
- `apps/pwa/index.html`: `.reason.last` is `--fg-2`. Only the other phones' card (`.result.closes`) shows a pointer. New rules: `.result-next`, `.result-actions` (two 44 px buttons; Play again is the filled one), `.result-refusal` (`--wait`).
- Docs: the guide sentences this made false (`running-on-phones.md`: the bar row, End match, the reason line, a paragraph on Play again and Change game, what a Peer sees at the close; `concepts.md`: End match; `api.md`: `MatchResult`). `docs/platform-design.md` §5: `startAgain` in the Lobby listing and the HUD's calls, the close card, a new "end of a Match" entry, and the tests. No citation re-anchored.

**Decisions**
- Play again is refused when a phone joined since the last Match, not started with it. The lobby's ordinary start puts every present phone in the Match. A new phone would then be a new Tile at the end of the order, and with Pong it would take Player 2's place from the phone that just played. The card says so in words, and Change game opens the sheet, where the new phone is placed.
- A guard checks the Players and Tiles before `start`. If they differ from the last Match's ("The table changed since the last game"), Play again cannot start something other than the last Match, whatever was decided through the lobby's interface since. The card is gone once the sheet opens, so in the app this refusal shows only if a phone's screen size changed.
- The first phone's card has no "tap to close". Play again and Change game are its two ways out, and the bar still unfolds the sheet. Unfolding the sheet by either means ends the card for that Match. A Match that ends while the Host has the sheet open (End match is tapped from the open sheet) shows no card on the first phone, only the grey "Last match" line, so the card never sits over an open sheet as in the audit's img/12.
- The other phones' card shows "The first phone starts the next game" after every close, not only after a result.
- A two-sided draw reads "Draw, 3–3". "Identity" in the test means `matchId` and `seed`: a new Match gets a new seed.
- With ticket 02 landed, `start(game)` picks the Game first. `startAgain` checks the lobby as it stands before that pick, so if another Game picked since changed the arrangement or the Players, it refuses ("The table changed since the last game") rather than putting the phones back in place silently.
- Ticket 08 (night-table look) will remove `--ok` and `--wait`. My rules use them because they are what `outside-view` has now. I told 08 which rules to map: Play again's fill to `--fg`, the refusal to `--warn`, and the buttons' height to `--tap`.

**Verified**
- Each slice red first, then green: `pnpm vitest run apps/pwa/test/result.test.ts` (3 failed, then 6 passed), `pnpm vitest run apps/pwa/test/lobby.test.ts` (Play again test: "host.startAgain is not a function", then passed; refusal test: "expected [Function] to throw an error" with the minimal `startAgain`, then passed).
- After merging `outside-view` (02, 05, 07): `pnpm vitest run apps/pwa/test/lobby.test.ts apps/pwa/test/result.test.ts` passed 24 tests. `pnpm typecheck && pnpm test`: typecheck clean; 33 test files, 254 tests passed.
- Two headless Chrome tabs at 390 × 844, one profile each, dev server on 5206, merged code. Screenshots were looked at, not committed:
  - Pong, P1 "Ana" on the first phone, P2 a bot. A held pointer at the top of the first phone kept Ana's paddle away. After 87 s the first phone's card read "Bot wins 7–0" over the lobby with [Play again] [Change game], and the sheet stayed folded to its bar ("2 phones · in a row · Setup", no corner pill). The bar's reason line read "Last match: Bot wins 7–0" with class `reason last`, colour rgb(168, 165, 156) (`--fg-2`). The second tab's card read "Bot wins 7–0 / The first phone starts the next game / Tap to close".
  - One tap on Play again started the second Match on both tabs (`#game` shown, cards hidden, the sheet a corner pill). After 76 s both tabs showed "Bot wins 7–0" again, the first with the two buttons. The sheet still had P1 "Ana", P2 "Bot".
  - A tap on the second tab's card closed it.
  - With the second tab closed, Play again on the first phone did not start a Match, and the card added "Phone 2 is no longer at the table" in amber.
  - Change game opened the sheet and hid the card. The sheet showed the Pong card picked and "Last match: Bot wins 7–0" in grey under Start Pong. Folding it with the bar left the card hidden.
  - Earlier, before the merge: End match from the opened corner pill. The first phone showed no card, the sheet stayed open and read "Last match: Game ended on the first phone" in rgb(168, 165, 156). The second tab's card read "Game ended on the first phone / The first phone starts the next game / Tap to close".

**Not verified**
- Unfolding the sheet with the bar while the card shows: it goes through the same `onToggle` render as Change game, but no browser run tried it.
- The "joined since" and "table changed" refusals on a screen: lobby tests only.
- Real phones. The Pong Matches were won by the bot against a held pointer, not played by two people.

**For the next tickets**
- Ticket 11: the install offer on the result card goes into `lastCard` as one more block after `.result-actions`, on the first phone's card only, or on both.
- Ticket 04: the card's wording for a lost phone ("You're back") is in `pause.ts`/`pauseCard`, which this ticket did not touch.
