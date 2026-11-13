# 09: Player colours and "touch here" on the Player's own Tile, in Pong and Air Hockey

**What to build:** Each Player has a colour that is the same on every phone and in the platform's own screens: paddle, score, prompt, name on the sheet and the result card. A Player's own Tile says "Touch here to start"; the other Tiles say "Waiting for Ana". Scores are readable, the ball and puck stay ivory with a short trail (spec D10, D11).

**Blocked by:** 08

**Status:** resolved

- [x] `@mgc/sdk` exports the Player palette and a function from a Player's position in the Match's Player list to a colour; four colours, the first two coral and teal; nothing new travels on the wire; a test at the SDK's game seam pins position to colour
- [x] The platform's sheet, pause card and result card show a Player's name in that colour
- [x] Pong and Air Hockey draw each side's paddle, score and prompt in its Player's colour; a bot's label too
- [x] On the Tile where a waited-for Player sits the prompt is "Touch here to start" (or the mid-Match equivalent); on every other Tile it is "Waiting for <name>"; harness tests in both Games show the two views differ for the same state
- [x] Scores are at 70 % opacity or more and pass 3:1
- [x] Air Hockey in a row: prompt and score do not overlap on two 64 mm wide Tiles
- [x] The ball and the puck are ivory and distinct from the paddles; a short trail follows them and continues across the gap between Tiles
- [x] Both Games' existing tests pass unchanged in what they assert about play
- [x] Two-tab browser smoke, screenshots in a comment: Pong before the first touch, during play, Air Hockey end to end
- [x] The developer guide's concepts page shows the palette and the own-Tile pattern in a few lines

## Comments

### 2026-11-13, agent (implementation)

**Changed**
- `packages/sdk/src/palette.ts` (new), exported from `@mgc/sdk`: `PLAYER_COLOURS` (`#ff6b4a` coral, `#2ec4b6` teal, `#a98bff` violet, `#c2e05a` lime, the night table's `--player-1..4`) and `playerColour(position)`, the colour of `match.players[position]`, repeating past the fourth, a `RangeError` for a position that is not a whole number from 0. An addition only: no exported symbol, type or wire frame changed; `@mgc/sdk` still depends on `@mgc/layout` alone.
- Pong (`games/pong/src/index.ts`, view only): each side's paddle, score and `BOT` label in its Player's colour (by their place in `match.players`, not by side); scores at `SCORE_ALPHA` 0.8; the ball ivory. A hold is drawn on the view's own Tile only: a held Player seated at this Device reads "Touch here to start" ("Touch here to play on" mid-Match, after the 5 s presence lapse), any other Tile "Waiting for <name>" per held side, each line in that Player's colour, on the existing shaded band. A trail: the last 100 ms of where this view drew the moving ball, in world mm, ivory, narrowing and fading (`drawTrail`); cleared while the ball rests or play holds.
- Air Hockey (`games/air-hockey/src/index.ts`, view only): the same colours, alpha, ivory puck and trail. The prompt is drawn on the view's own phone only, at the end that lies on it (the seated human's side, else the first Tile's side 0 and the last Tile's side 1), upright for that end's Player, 58 mm in from it (`PROMPT_INSET`) on a shaded band: past the score (45 mm, its 14 mm figures end at 52) and still on a 64 mm phone (to 60.5). `say` became `facing(g, side, inset, paint)`.
- Platform: `result.ts` `describeResult` and `pause.ts` `describePause` also return `player`, the place in the Match's Player list of the Player their headline names (the winner; the lost Device's seated Player). `describePause` reads who sits at the lost Device from `match.players` itself; its `seated` map argument is gone (`main.ts` no longer builds it). `hud/shared.ts` `inColour(position)` gives the `style` attribute; `hud/cards.ts` puts it on the result card's and the pause card's headline (two lines); `hud/sheet.ts` on each Player's name field (by its place in `match.players` or `lobby.players`, not the `P1`/`P2` slot number) and on the seated Player's name in the "Lay the phones like this" rows.
- Tests: `packages/sdk/test/game-seam.test.ts` (palette equals `tokens.css`, position → colour, and a two-Device Match where every view finds the same colour from `match.players`); Pong and Air Hockey: colours and alpha by Player place with the order swapped, a bot's label, ivory ball/puck, own-Tile vs other-Tile prompt for the same state (three phones for Pong, a bot's phone for Air Hockey), the trail across the gap, no trail at rest or held; Air Hockey on two 64 × 139 mm phones in a row: prompt and score apart by more than half their heights and the prompt wholly on its phone; `packages/look/test/look.test.ts`: each Player colour at 70 % over `--bg` reaches 3:1; `apps/pwa/test/result.test.ts` and `pause.test.ts` extended with `player`.
- Docs: `docs/guide/concepts.md` "Players' colours and the own Tile"; `docs/guide/api.md` a `PLAYER_COLOURS`, `playerColour` entry; `docs/guide/README.md` row 3; the hold sentence of `docs/sdk-design.md` and step 6 of `docs/guide/getting-started.md`, which the new prompts made false. `CHANGELOG.md` (it arrived with ticket 15 in the merge): an Added line for the colours, prompts and trail, a Changed line for the brighter scores and Air Hockey's prompt in a row.

**Decisions**
- The colour follows the Player's place in the Match's Player list, never a side or a slot number: the sheet's `P1`/`P2` is the slot, which differs from the list when slot 1 fills first; the sheet looks the place up by Player id.
- The pause and result cards colour the whole headline ("Bo wins 7–5", "Waiting for Bo") in the named Player's colour, as the Games colour a whole prompt line. The pure functions say whose headline it is (`player`) instead of the card searching names in text, which would colour a Player called "for" in "Waiting for phone 2". A draw, "Match over", a close without a result, a lost Device nobody sits at and the multi-side detail line ("Ann 5 · Cy 5 · Bo 2") stay neutral. The sheet's "Last match:" line stays neutral (D9).
- One line per phone where a waited-for Player sits: their own "Touch here …" only, not also "Waiting for" the other; once they touched, their phone names the other. A phone that seats nobody (Pong's middle phone, a bot's phone) names everyone play waits for.
- Scores at 0.8, not the minimum 0.7: at 0.7 over `#0b0b0c` coral is 3.87:1, teal 4.88, violet 4.09, lime 6.75; at 0.8 4.77 / 6.06 / 4.98 / 8.56. The test pins the 0.7 floor for all four. The `BOT` label stays at full colour: it is small text (4.5:1 needed; `look.test.ts` already pins each Player colour on the ground at 4.5).
- The trail is drawn from where the view drew the ball, kept by shared time, not recomputed from a state: it follows bounces and paddle returns as they were shown, crosses a Tile edge by itself because it is in world mm, and a pause or a hidden page leaves only points older than 100 ms. Lines, not discs, so no test that finds the ball by its arc radius can mistake it.
- Scores keep `system-ui`: the display face is the platform's file, and a Game imports `@mgc/sdk` only.
- The two Games' trail and prompt code is repeated rather than moved into the SDK: an SDK drawing helper would be a new API, and each Game stays a standalone example.

**Verified**
- Each slice red first with `pnpm vitest run <file>`: `packages/sdk/test/game-seam.test.ts` (2 new failed, then 9 passed), `games/pong` (3 new failed, then 23 passed), `games/air-hockey` (4 new failed, then 23 passed), `apps/pwa/test/result.test.ts` + `pause.test.ts` (5 failed, then 15 passed with `look.test.ts`). The 70 % contrast guard in `packages/look` passed at once, as the tokens already meet it (32 passed).
- `pnpm typecheck && pnpm test`: typecheck clean; 38 files, 321 tests passed. After merging `outside-view` (tickets 11, 14, 15: two import-line conflicts in `hud/cards.ts` and `hud/sheet.ts`, both kept; the result card's install block sits after my headline line untouched) and adding the players' changelog entry: typecheck clean; 41 files, 346 tests passed.
- Two-tab smoke, dev server on port 5209, headless Chrome at 390 × 844, one profile per tab; Players renamed Ana and Bo:
  - Sheet: Ana's name field coral (`rgb(255, 107, 74)`), Bo's teal (`rgb(46, 196, 182)`); in "Lay the phones like this", "on the left · Ana" with Ana in coral and "right of phone 1 · Bo" with Bo in teal.
  - Pong before the first touch: each phone a shaded band "Touch here to start", coral on the first phone, teal on the second; the paddles coral (left) and teal (right); each score "0" in its Player's colour, quieter than the paddle; the resting ball an ivory ring across the gap. After Ana tapped her phone: hers read "Waiting for Bo" in teal, Bo's still "Touch here to start".
  - Pong during play: no band; the ball ivory with a short grey-ivory comet behind it; on the first phone it entered from the right edge with its trail running off that edge. Bo won 7–5: the result card on both phones read "Bo wins 7–5" in teal (`style="color: #2ec4b6"`), Play again / Change game on the first, "The first phone starts the next game" on the second.
  - Pause: Play again, then the second tab closed: the first phone's card "Waiting for Bo" in teal, "Phone 2 lost its connection · the match goes on when it is back" neutral; the second tab reopened and the Match resumed.
  - Air Hockey end to end: Ana's phone (top end) "Touch here to start" in coral, upright for her, between her score and the centre circle; Bo's in teal at his end; after Ana touched, hers read "Waiting for Bo" in teal. During play: coral and teal paddles, coloured scores, the puck ivory with a short trail, no prompt.

**Not verified**
- On phones: how the trail and the 80 % scores look at 60 Hz in daylight; the headless tabs drew at a lower frame rate, so the trail read as overlapping discs there.
- Air Hockey in a row in a browser: the 64 mm geometry is checked by the unit test only.
- A Peer's top strip still shows its Player's name in neutral grey; the ticket names the sheet and the cards only.
