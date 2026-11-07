# Tap Race: friction log

Building the tutorial Game on `@mgc/sdk` from the template, its tests over `createTestMatch`, and a two-tab plus one-tab browser smoke. Ordered by how much each cost or how likely a first-time developer is to hit it.

### A tap on a Tile carries no Player, so two humans cannot race for one target
- **Where:** `packages/sdk/src/types.ts:58-74` (`Sender.playerId` is "the Controller's Holder"; a Tile's input has only `deviceId`); `docs/sdk-design.md:28-31`; the spec's own rule ("a tap counts for the Player seated at the tapped Tile").
- **Expected:** "The first Player to tap one scores it" (spec, Solution): a target both Players can reach.
- **Actual:** a target lies on one Tile; any finger on that Tile counts for whoever sits there. With two humans, a target on Ann's Tile can only ever score for Ann, so without anything else the Match is decided by where targets spawn, not by who is quicker. Only a bot can contest a human's target.
- **Workaround:** targets fade after `TAP_RACE.lifeMs` (a "tap it in time" race against the clock and the bots); recorded as a deviation in the ticket.
- **Suggested fix:** say it in the guide and in `Input`'s doc: "on a Tile, input identifies the Device, never the finger; a Game that needs per-Player input on a shared surface gives each Player their own region or Controller". A spec template line ("who can tap where?") would have caught it before building.
- **Severity:** doc-gap (design trap)

### The lobby seats at most two Players, so middle Tiles are dead ground
- **Where:** `apps/pwa/src/lobby.ts:9-10` (`SLOTS = 2`: slot 0 at the first Tile, slot 1 at the last).
- **Expected:** with `players: { min: 1, max: 4 }` and three or four Tiles, a Player at every Tile.
- **Actual:** at most two Players, at the outer Tiles; a middle Tile seats nobody, so a tap there scores for nobody. Tap Race spawns targets only on Tiles that seat a human, so on a 3- or 4-Tile row the middle phones only ever show the scores. `players.max: 4` is reachable only through a hand-built `MatchInfo` in tests.
- **Workaround:** `spots` = Tiles with a seated human (every Tile when only bots play). The test pins "never `d1`".
- **Suggested fix:** seat a Player per Tile (slots = Tiles), or have the lobby refuse a Game whose `players.max` exceeds what it can seat, and document the two-slot limit next to `Manifest.players`.
- **Severity:** papercut (known)

### `publish` sends the state as it is when the handler returns, not when called
- **Where:** `packages/sdk/src/game-side.ts:66-71` (frames posted during game code wait in an outbox until it returns) and `:155-158` (`publish` posts the caller's object, not a copy); doc `packages/sdk/src/game.ts:33-40` says "one call, one wire frame" and nothing about when the state is read.
- **Expected:** `publish(s)` snapshots `s`, like `postMessage`.
- **Actual:** a throwaway probe published `{ n: 1 }` then `{ n: 2 }` from the factory and set `n = 3` after; the view received `{"n":3}, {"n":3}`. In a handler, `publish(s); s.n = 11` delivered `{"n":11}`. Mutating after `publish` in the same handler silently rewrites what was sent.
- **Workaround:** `publish()` sends `{ ...s, scores: { ...s.scores } }`, and every handler publishes last.
- **Suggested fix:** `structuredClone` the state in `publish` (it already walks it in `assertJson`), or document "the state is read when the handler returns".
- **Severity:** papercut (silent wrong state)

### `MatchResult` has no doc: a ranking always names a winner, and a draw needs no ranking
- **Where:** `packages/sdk/src/types.ts:53-56` (no comments); the meaning lives in `apps/pwa/src/result.ts:8-17`.
- **Expected:** to learn from the SDK how to report a tie.
- **Actual:** I had to read the PWA: with `ranking`, the card names `ranking[0]` "wins" even on equal scores; without it, the card sorts by `scores` and says "Draw" when the top two are equal. Nothing says which field wins or that omitting `ranking` is the way to report a draw.
- **Workaround:** `result()` returns `{ scores }` when the best score is shared, `{ scores, ranking }` otherwise; the test pins both.
- **Suggested fix:** document both fields on `MatchResult` (order, ties, what the card shows), or add `draw?: true` / allow ranking entries to be groups.
- **Severity:** doc-gap

### The view closes the moment `end` lands, so the final state is never drawn
- **Where:** `apps/pwa/src/main.ts:111-123` (on `closed` the game layer is hidden at once); `packages/sdk/src/game.ts:58-64` (`end`).
- **Expected:** spec: "'<name> wins' at the end until the platform closes the view"; publishing a `done` state and then `end` would show it.
- **Actual:** the `done` state and the close arrive together; the view is hidden before it draws it.
- **Workaround:** the host publishes `done`, arms `timer('end', TAP_RACE.resultMs)` and calls `end` from `onTimer`. Costs a tunable, a timer and a test step.
- **Suggested fix:** say in `end`'s doc that the view closes at once and a Game that wants a closing frame delays `end` itself, or let `end(result, { holdMs })` keep the views up.
- **Severity:** doc-gap

### The Host's HUD bar covers the bottom of the Host's Tile and eats taps
- **Where:** `apps/pwa/src/hud.ts:168` (`.bar`, shown during a Match); `packages/sdk/src/game.ts:108-134` (`ViewContext` has no insets).
- **Expected:** the whole Tile is the Game's to draw on and tap.
- **Actual:** on the Host a 420×56 px `button.bar` sits over the canvas at y 804–860 (≈ 14.8 mm at 3.78 px/mm), taller once it shows a game-log line (≈ 80 px in a screenshot). In the first smoke a target at world y 215 of a 227 mm Tile was under it: `document.elementFromPoint(72, 813)` is `BUTTON.bar`, so the tap went to the HUD instead of the Game and scored nothing. Peers have no bar, so the usable area differs per Device.
- **Workaround:** `TAP_RACE.band` (15 mm) keeps targets off the bottom (and the scores) band; still too little if the bar grows.
- **Suggested fix:** give `ViewContext` (and `Frame`) safe-area insets in mm, or keep the HUD off the Tile while a Match runs (a swipe-up handle).
- **Severity:** papercut

### Timer chains in `createTestMatch` land on frame boundaries, so expected times depend on how the test slices `tick`
- **Where:** `packages/sdk/src/testing.ts:128-140` (`frame` fires due timers, then hands them over at the frame's end), `:154-158` (`tick` steps `1000/60` ms with float accumulation); doc `docs/sdk-design.md:108` ("the delay runs from when the host runtime received the request").
- **Expected:** a countdown of three 1000 ms timers ends at 3000 ms however the test advances the clock.
- **Actual:** the timer re-armed in `onTimer` starts at the end of the animation frame it was handed over in, and a timer due at a whole second can miss the frame that "should" reach it by a float epsilon. Measured end of the countdown: 3000.000 with `tick(1000)` ×3, 3020.000 with `tick(3000)` then `tick(10)` ×2, 3033.333 with `tick(3100)`; the first target's `since` then differs by up to 33 ms (`4477.9`, `4497.9`, `4511.2`). My first pause test compared two runs that stepped differently and failed by 13.3 ms.
- **Workaround:** the pause test steps both runs identically up to the pause; the other tests assert ranges, not exact times.
- **Suggested fix:** let `frame` deliver each due timer at its due time (advance the clock to `due`, settle, continue), and round the frame clock to the step grid; or offer `timer(tag, ms, { from: 'due' })` so a game can build drift-free chains (the same drift exists in the browser).
- **Severity:** papercut

### `createTestMatch` gives no way to see what a view drew
- **Where:** `packages/sdk/src/testing.ts:19-49` (`TestMatch` has no screen or canvas accessor); `packages/sdk/src/headless.ts:43-47` (the recording context's `ops` exist but are reachable only through `Reflect.get(f.ctx, 'ops')`, and are never cleared).
- **Expected:** a helper to assert "every Tile shows the digit 3" or "every Tile shows 'Bo wins'".
- **Actual:** I wrapped `game.view` to intercept `draw`, read `ops` via `Reflect.get`, clear them each frame (they grow forever), and filter `fillText`. The Air Hockey and Breakout tests each wrote their own version of this.
- **Workaround:** `withTexts()` in `games/tap-race/test/tap-race.test.ts`.
- **Suggested fix:** `t.frame(deviceId)` returning the last frame's ops (cleared per frame), or at least `t.texts(deviceId)`.
- **Severity:** missing test helper

### `onPause` can fire twice, and `onResume` does not say how long the pause was
- **Where:** `packages/sdk/src/game.ts:101-104`; `docs/sdk-design.md:100`; `games/pass/src/index.ts:85-90`.
- **Expected:** to move a published timestamp (`target.since`) on by the paused time in one line.
- **Actual:** the host must record the time in `onPause`, but `onPause` comes again when the reason changes, so `pausedAt = ctx.now()` (Pass's pattern) records the second call and under-shifts by the time between the two. Pass's `turnEndsAt` has this latent bug. The correct version (`pausedAt ??= ctx.now()`, reset in `onResume`) took ~10 lines, which the 150-line budget could not afford: Tap Race's inner ring shows less time left after a pause than its (pause-correct) fade timer has.
- **Workaround:** none in Tap Race (deviation in the ticket); the fade itself is right because timers freeze.
- **Suggested fix:** `onResume(now, pausedMs)`, or a `ctx.gameNow()` that stops while paused so Games can stamp states in game time.
- **Severity:** papercut (and a latent bug in Pass)

### `onResume` doc says to re-publish; the design doc says retained states are re-posted anyway
- **Where:** `packages/sdk/src/game.ts:103` ("a game that publishes only on change re-publishes here") vs `docs/sdk-design.md:220` ("on resume they are re-posted to every view … so a game that ignores `onPause`/`onResume` is still correct").
- **Expected:** one answer.
- **Actual:** Tap Race has no `onResume`; its pause test and views are correct. A reader of `game.ts` alone adds a needless handler.
- **Suggested fix:** reword `onResume`'s doc: "re-publish only if the state itself changes because of the pause".
- **Severity:** doc-gap

### No SDK helper maps a Tile's own frame to world mm
- **Where:** `packages/sdk/src/index.ts:1` re-exports `Surface`, whose constructor needs a `DeviceRect` with `id` (a `Tile` has `deviceId`) and a `pxPerMm` that means nothing on the host (`packages/layout/src/surface.ts:13-26`); `createTestMatch` builds one by hand (`packages/sdk/src/testing.ts:118`).
- **Expected:** "a random point inside this Tile" in one call, rotation included.
- **Actual:** hand-written `x·cos − y·sin` math (2 lines) plus `g.rotate(tile.rot)` in the view. Cut from Tap Race for the line budget, so it assumes `rot` 0 like Pong does (no lobby template rotates a Tile, `packages/layout/src/templates.ts`).
- **Suggested fix:** `tileToWorld(tile, p)` / `worldToTile(tile, p)` in `@mgc/sdk`.
- **Severity:** papercut

### `Frame.ctx` is saved and restored around `draw`, but the doc doesn't say so
- **Where:** `packages/sdk/src/game-side.ts:425-434` (`save` before `draw`, `restore` after); doc `packages/sdk/src/game.ts:180-182` says only "cleared; transformed".
- **Expected:** to know whether a `translate` in `draw` leaks into the next frame.
- **Actual:** had to read the source to learn `g.translate(tile.x, tile.y)` is safe without `save`/`restore`.
- **Suggested fix:** add "saved before and restored after `draw`: transforms and styles do not carry over" to `Frame.ctx`.
- **Severity:** doc-gap

### The copied template's README and doc comment describe the template
- **Where:** `scripts/new-game.mjs:28-41` rewrites ids and the `# Template` heading only; `games/_template/README.md:3-7` ("The smallest complete Game … Copy it with `pnpm new-game`", file list `test/template.test.ts`, which the script renames to `<slug>.test.ts`); `games/_template/src/index.ts:27` ("Tap: the smallest complete Game").
- **Expected:** a new Game's README and doc comment that are about the new Game, or obviously placeholders.
- **Actual:** the new README names a test file that does not exist and invites copying the new Game; the template's own game is called "Tap" and is already a tap race (first to 10 taps), which will confuse a guide that builds "Tap Race" from it.
- **Workaround:** rewrote `games/tap-race/README.md`.
- **Suggested fix:** make the template README a placeholder with `<Name>` tokens the script fills, list `test/<slug>.test.ts`, and give the template's game a name that is not a prefix of the tutorial's.
- **Severity:** papercut

### Smoke tooling: sibling Games' edits reload the tabs, and a shared headless browser starves background tabs
- **Where:** Vite dev server for `apps/pwa` (bundles every `games/*`); the shared managed Chromium.
- **Expected:** a smoke run in progress keeps its Match; a tab's canvas paints at display rate.
- **Actual:** (a) mid-session my Host tab reloaded to the lobby with "Start Air Hockey" selected (console: `[vite] connecting… connected`) after another agent edited its Game. (b) With other agents' tabs in the same browser, my tabs painted at ~0.5 frames/s between calls, and `performance.now()` barely moved between my reads; canvas-probe reads were seconds stale, so taps landed where targets used to be.
- **Workaround:** an init script that throws for `WebSocket`s with a `vite` protocol (blocks HMR), a frame timestamp in the canvas probe (tap only on frames < 200 ms old), `page.bringToFront()`, and reopening the tab with `persist: true` (then 57 fps).
- **Suggested fix:** document both in the smoke recipe (`.scratch/seats-and-bots/issues/02-pong-seats-and-bot.md` Verified → Smoke), or add a `?nohmr` switch to the PWA dev build.
- **Severity:** papercut (tooling)

### Note: `TestMatch.input` accepts a point off the Device's own screen
- **Where:** `packages/sdk/src/headless.ts:217-220` (no bounds check).
- **Actual:** `t.input('d2', 'down', <a point on d0>)` arrives as a `d2` input at that world point, which a real screen cannot produce. Handy: it is how the test proves "the right point on the wrong Tile does not score". Worth one line in the helper's doc so nobody relies on it by accident.
- **Severity:** doc-gap (minor)

## Worked well
- `timer(tag, ms)` with replace-by-tag and `null` cancel made the whole round structure (countdown, spawn, fade, per-bot taps, delayed end) a flat `onTimer` with no bookkeeping; pause freezing came free and the pause test passed first time once the clock steps matched.
- `onTimer`'s `now` is the due time, so `since: now` gives every Device the same target age.
- `createTestMatch` ran a whole Match on three Tiles with bots in ~0.3 s, deterministically from `match.seed`; `events()` with `log`/`fault`/`closed` made the host log and "no faults" one-liners.
- `Frame` in world mm: drawing the ring at its world point and letting each Tile show its own part needed no per-Tile code; `Frame.now` made the shrinking ring one line.
- `ctx.log` reached the Host console and the HUD bar's game log with no setup.
- Discovery: the new Game appeared in the HUD's Game row with no registration.
