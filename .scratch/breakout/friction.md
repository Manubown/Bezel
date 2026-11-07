# Breakout: friction log

Found while building `games/breakout` (2026-11-07). Each entry: where, expected, actual, workaround, suggested fix, severity. Anything marked [source] was learned by reading the code, not observed.

## Measured wire budget (the spec's question)

`ctx.log` once a second on the host, the JSON length of each published state × (Devices − 1). Floats are unrounded.

| Where | States | Bytes per state | Host upload |
|---|---|---|---|
| Test, hand-built 2×2 of 70 × 150 mm (224 bricks, 16 × 15 grid), 3 Peers | 1 ball | 141–154 B; 423 B with the wall (wall alone 289 B) | 26.0–27.7 KB/s |
| same | 2 balls | 258–272 B; 539–555 B with the wall | 47.3–51.6 KB/s |
| Browser, 3 tabs in a grid (111 × 227 mm each, 550 bricks, 25 × 24 grid), 2 Peers | 1 ball | 163–168 B; 834–852 B with the wall | 18.4–21.8 KB/s |
| same | 2 balls | 263–268 B; 936–966 B with the wall | 32.8–34.1 KB/s |
| Browser, 4 tabs in a 2×2 grid, **60 Hz × 3 Peers** | 1 ball | 180–186 B; 851–870 B with the wall; 1–2 wall states a second | **33.7–37.4 KB/s** (full seconds of 58–60 states) |

- Publishing the wall in every state instead would cost 870 B × 60 × 3 ≈ 157 KB/s on the 2×2 grid, 4.4× the measured upload. Change-only plus a 1 s keyframe adds about 2.5 KB/s (7 %) over the bare `world` stream (184 B × 60 × 3 ≈ 33 KB/s). That is Pong's level (`docs/sdk-design.md:231`: ~200 B, ≈ 36 KB/s).
- About half of each state is float digits. Over 3,535 two-ball states, the mean was 268.5 B as published and 153.9 B with every number rounded to 0.1 mm (−43 %). See the entry "Floats".

## Did change-only publishing fight `latest()`?

- **Not in the view.** `latest()` and `Frame.state` hold only the last state. Keeping the last wall is four lines of `onState` into a closure variable, and `draw` reads both. That was fine.
- **It did fight the platform's retention and rejoin.** A view that starts after the wall went out never gets it (next entry). The only fix available to a Game is to resend the wall periodically, so the wall is no longer strictly "only on change".
- **It also fought the test helper.** `t.state()` and `t.latest()` expose only the last state. They cannot show that a view kept an older wall, so the test reads the headless canvas's calls instead (see "createTestMatch cannot see what a view drew").

## Entries

### A view that starts after the wall went out draws no bricks until the next brick breaks
- **Where:**
  - `packages/sdk/src/match.ts:143-148`: one retained broadcast state.
  - `packages/sdk/src/match.ts:449-466`: retained states are re-sent only on resume.
  - `apps/pwa/src/main.ts:139-143`: a reloaded Peer begins the Match again.
  - `apps/pwa/src/main.ts:147-150`: frames are dropped before `current` exists.
  - `docs/sdk-design.md:98,220`.
- **Expected:** a stream published only on change (the spec's `{ world, wall? }`) reaches every view at least once.
- **Actual:** observed in the browser with the wall published only on change and broadcast. A Peer tab reloaded mid-Match came back faster than leave detection (no pause), drew `Lives 2 · Bricks 0`, and kept drawing no bricks for the 10 s sampled until the next brick broke. Meanwhile the Host and the other Peer drew 544. Nothing tells the host game that a view (re)started, and the Peer's fresh runtime has nothing retained.
  - [source] A per-Device `publish(s, to)` (retained apart from the broadcast) does not help either: the host replays retained states only on resume, never to a Peer that rejoined without a pause.
  - At Match start the first wall did reach both Peers in every run.
- **Workaround:**
  - The wall rides along at least every `BREAKOUT.wallEveryMs` (1000 ms) as a keyframe, and in the state published on resume.
  - Re-run: the reloaded tab's first frame (1.8 s after the reload) drew all 538 bricks.
  - Cost: about one extra 850 B state a second per Peer.
- **Suggested fix:**
  - Give the host game a hook for a (re)started view (`onViewReady(deviceId)`), so it can `publish(full, deviceId)`.
  - Or have the platform replay the retained states to a Peer that rejoins a running Match.
  - Document in §2 that a change-only stream needs keyframes until then.
- **Severity:** blocker for change-only state, by design. Worked around with keyframes.

### Player 1 can never hold a paddle in a grid; one of the four phones in a 2×2 seats nobody
- **Where:** `apps/pwa/src/lobby.ts:9-10` and `:417-421` (slot 0 at the first Tile, slot 1 at the last); `packages/layout/src/templates.ts:33-57` (row-major grid).
- **Expected:** in a game whose seats are the bottom row, the lobby can seat a Player at each bottom Tile.
- **Actual:**
  - **2×2 grid, observed with 4 tabs.**
    - Top left: Player 1 (the Host), field only, no paddle.
    - Top right: seats nobody, field only.
    - Bottom left: seats nobody, so its paddle is always a bot.
    - Bottom right: Player 2.
  - The first Tile of a row-major grid is always top left, so slot 0 is never on the bottom row of any grid with two rows. Moving phones in the lobby only changes who is first.
  - With Player 2 a bot, both paddles were bots and the two humans only watched. It felt like a screensaver: two of four people hold a phone that does nothing but show bricks.
  - **3 tabs:** top left Player 1 (no paddle), top right nobody, bottom left Player 2. The fourth cell is empty (next entry).
- **Workaround:** none inside the Game. The rules follow the spec (a bottom Tile that seats a human is theirs, every other bottom paddle is a bot).
- **Suggested fix:** let the manifest say where seats are (`seats: 'outer' | 'bottom-row' | 'every-tile'`), or let the Host assign each slot to any Tile. Raise `SLOTS` past 2 for co-op games.
- **Severity:** papercut for Breakout (bots cover it), design gap for any bottom-row or per-Tile game.

### The grid template with three phones leaves a hole in `bounds` that no Tile shows
- **Where:** `packages/layout/src/templates.ts:33-57` (3 sizes → 2 × 2 cells, the fourth empty); `MatchInfo.bounds` is the union box.
- **Expected:** a play field the phones cover, or a way to tell covered from uncovered world.
- **Actual:**
  - The ball spends time in the empty bottom-right cell, where no phone shows it: 572 of 2,420 samples in a 60 s bot run.
  - No paddle guards that half of the floor, so lives drain fast there. A human who did not move lost all three serves in about 6 s (the "Match over" card).
  - The SDK has no "is this point on a Tile" or "covered region" helper. Breakout computes its bottom row from `bounds` and a 2 mm slack.
- **Workaround:** none. Breakout plays over `bounds`, as the spec says.
- **Suggested fix:**
  - Don't offer `grid` for 3 Devices: lay them out as a row, or centre the last row.
  - Or export `coveredBy(point, tiles)` and `bottomRow(tiles)` helpers from `@mgc/sdk`.
- **Severity:** papercut. It makes 3-phone grid Breakout poor.

### On the Host, the HUD bar covers the bottom ~21 mm of its Tile during a Match
- **Where:** `apps/pwa/src/hud.ts:263-289`: the folded bar shows code, status and the newest log line while a Match runs.
- **Expected:** the Game owns its Tile's whole screen during play.
- **Actual:** in the Host's screenshots the bar ran from about y 781 to 860 CSS px, about 21 mm at 3.78 px/mm, with the `log · host: wire: …` line in it.
  - Breakout's paddle face is 10–13 mm above its Tile's bottom edge, so a Host on the bottom row would play under the bar. [inference: no smoke ran with the Host on the bottom row, because the lobby puts it top left in a grid and a row Match was not run]
  - Peers have no bar.
- **Workaround:** none in the Game.
- **Suggested fix:** collapse the bar to a corner chip during play, or report the covered strip to the Game (a `safeArea` on the view context).
- **Severity:** papercut. It becomes a blocker for bottom-edge games on the Host.

### A chatty `ctx.log` hides faults on the HUD
- **Where:**
  - `apps/pwa/src/hud.ts:261`: the fault count filters `play.log`.
  - `apps/pwa/src/gamelog.ts:10`: `LOG_LINES = 50`.
  - `apps/pwa/src/main.ts:101`.
- **Expected:** logging the wire budget once a second, as the spec asks, is harmless.
- **Actual:**
  - Every line goes to the Host's HUD log and to the bar over the field.
  - [source] Only the newest 50 lines are kept, and the "N faults" badge counts faults among those 50. A once-a-second log therefore evicts a fault, and its badge, within 50 s.
- **Workaround:** none needed for this smoke (no faults happened).
- **Suggested fix:** separate debug/info logs from faults (`ctx.log.debug`, console only), or keep faults outside the 50-line ring.
- **Severity:** papercut.

### `createTestMatch`'s headless canvas keeps every draw call forever: a long Match runs out of memory
- **Where:** `packages/sdk/src/headless.ts:44-88`: the recording context pushes every call to `ops` and never trims. `packages/sdk/src/testing.ts:19-49`: `TestMatch` exposes neither the screens nor `ops`.
- **Expected:** a test that plays a Match to its end (clearing a 224-brick wall takes ~175 s of game time) runs.
- **Actual:**
  - The first test run died with `FATAL ERROR: Reached heap limit … JavaScript heap out of memory` after 70 s: four views each draw ~250 calls a frame, 60 frames a simulated second.
  - Pong never hit this: it draws a handful of calls per frame.
- **Workaround:**
  - The test wraps the Game's `view` and empties the record in `draw`: `const ops = Reflect.get(f.ctx, 'ops'); ops.length = 0; h.draw(f); …; ops.length = 0`.
  - `Reflect.get`, because the recording context is a Proxy with only a `get` trap, so `'ops' in ctx` is false.
- **Suggested fix:**
  - Clear `ops` at each frame's `clearRect`, or keep only the last frame.
  - Expose `t.drawn(deviceId)` (the last frame's calls) on `TestMatch`.
- **Severity:** blocker for long-running game tests (worked around).

### `createTestMatch` cannot see what a view drew, or keeps
- **Where:** `packages/sdk/src/testing.ts:39-42` (`state`, `latest`: the last applied state only).
- **Expected:** a way to test "views keep the last wall" (a view's own derived state, or its drawing).
- **Actual:** `t.state(d)` is the last state applied, which after a break-free step has no `wall`. The view's kept wall is invisible.
- **Workaround:** the same wrapped view counts the `fillRect`s of a brick's size per frame (`drawn.get(d)`). The test asserts it equals the last wall's bricks while the latest state has none.
- **Suggested fix:** `t.drawn(deviceId)` as above. Also, a `t.published()` log of every state the host published (with `to`), so tests need not assume one publish per step.
- **Severity:** doc-gap / missing test helper.

### `HostContext` does not say which Device it runs on
- **Where:** `packages/sdk/src/game.ts:29` (`HostContext` has no `deviceId`; `ViewContext` has one at `:110`).
- **Expected:** to count the host's upload exactly, or to skip a per-Device publish to itself.
- **Actual:**
  - Not knowable inside the host game.
  - Breakout counts every state × (Devices − 1). That is right for a broadcast, and for a `publish` to every Device, since one of them is local.
  - The question only came up while trying per-Device publishes as a "retained wall channel" (which did not help; see the first entry).
- **Workaround:** the formula above.
- **Suggested fix:** `HostContext.deviceId`.
- **Severity:** papercut.

### `MatchResult` cannot say "you all won" or "you all lost"
- **Where:** `apps/pwa/src/result.ts:8-17` (the headline is `"<ranking[0]> wins"`, else "Draw" or "Match over").
- **Expected:** a co-operative Game ends with a shared outcome. The spec asks for "every Player ranked" on a cleared wall.
- **Actual:**
  - A cleared wall ends with `{ ranking: every Player }`. The card would read "Player 1 wins", naming whoever is first (in the 2×2 lobby, the Host, who had no paddle).
  - A lost Match ends with `{}`, the only honest choice, and the card reads "Match over" with no detail. Observed in the smoke.
  - `scores` with the same number for everyone would read "Draw".
- **Workaround:** as above. Ranking every Player is the spec's requirement; nothing better exists.
- **Suggested fix:** `MatchResult.outcome?: 'won' | 'lost'` (team result) plus an optional `detail` string, so the card says "Wall cleared · 550 bricks".
- **Severity:** papercut.

### Floats: half of every state is 17-digit doubles
- **Where:** `docs/sdk-design.md:231` ("JSON only until phones are measured"); no rounding guidance anywhere in `docs/`.
- **Expected:** guidance, or a helper, on how much precision a world-mm state needs.
- **Actual:** `{"x":32.65763863897499,"y":245.6028309534818,"vx":-78.70742786220656,…}`. Rounding every number to 0.1 mm cut the mean two-ball state from 268.5 B to 153.9 B (−43 %, over 3,535 states in a test).
- **Workaround:** none. Breakout publishes full precision, so the numbers above are what the spec asked to measure.
- **Suggested fix:** document "round world mm to 0.1 for the wire" in the guide, or offer `publish(state, { round: 0.1 })`.
- **Severity:** doc-gap.

### `defineGame` erases the state type, so wrapping a Game in a test is untyped
- **Where:** `packages/sdk/src/game.ts:23` (`type Game = GameSpec<JsonValue, JsonValue>`).
- **Expected:** to wrap `breakout.view` in a test and keep `Frame<BreakoutState>`.
- **Actual:** `breakout.view(ctx)` returns `ViewHandlers<JsonValue, JsonValue>`, and `draw(f)` gets `Frame<JsonValue>`. The `S` of `createTestMatch<S>` is the caller's claim (`packages/sdk/src/testing.ts:144`: "`S` is the caller's claim about the game").
- **Workaround:** the wrapper only passes the frame through and reads canvas calls, so the lost type did not matter.
- **Suggested fix:** `defineGame` could return `Game & { spec: GameSpec<S, M> }` for tests.
- **Severity:** papercut.

### The copied template still talks about itself
- **Where:** `scripts/new-game.mjs:31-39` (replaces names only). Copied `games/breakout/README.md`.
- **Expected:** a new Game's README describes the new Game, or nothing.
- **Actual:** the copy read "The smallest complete Game for MobileGameConnect. Copy it with `pnpm new-game` …" and listed `test/template.test.ts`, which the script had renamed to `breakout.test.ts`. The copied test kept the template's `tickHz: 0` Match, which is wrong for a ticking Game. Harmless, since it is replaced, but it reads as if it belongs.
- **Workaround:** rewrote the README.
- **Suggested fix:** give the template's README a short "replace me" body naming `test/<slug>.test.ts`, or have the script write one.
- **Severity:** papercut.

### Simulated time is slow enough to hit vitest's 5 s default
- **Where:** `packages/sdk/src/testing.ts:128-140` (one `settle()` macrotask per animation frame).
- **Expected:** a minute of game time runs in a test's default 5 s.
- **Actual:** four Devices run at about 6–12× real time. 60 s of game time took 4–10 s; a bots-only Match that cleared the 224-brick wall ran 175 s of game time in 15 s; the wall-clearing test took 22–39 s. The first run timed out at 5 s.
- **Workaround:** explicit per-test timeouts (60 s, 120 s).
- **Suggested fix:** state the speed in the guide. Or a `t.tick(ms, { draw: false })` that skips the views' paint loop when a test does not look at drawing.
- **Severity:** doc-gap.

### Three desktop tabs are indistinguishable in the lobby roster
- **Where:** `apps/pwa/src/hud.ts:345` (chips by `nameOf(e)`): every Peer reads "Windows".
- **Expected:** to tell which tab is which phone when driving a smoke.
- **Actual:** I assumed the Peers sat in the order I opened them. After a Host reload the second-opened tab sat top right, and my first "human drag" went to the wrong tab (no paddle moved).
- **Workaround:** read each tab's canvas transform in a `CanvasRenderingContext2D.prototype.arc` hook (`-e/a`, `-f/a` = the Tile's origin). Reading each Peer's own strip would also work.
- **Suggested fix:** name a Peer by its position ("phone 3 · row 2, column 1") or a short device id in the roster.
- **Severity:** papercut (tooling).

### A previous result card blocks Start
- **Where:** the HUD result card (`p.result-head`, "Tap to close") over the lobby sheet.
- **Expected:** Start works after a Match ends.
- **Actual:** an automated click on "Start Breakout" was refused: "covered by `<p.result-head>`". The card must be tapped away first.
- **Workaround:** click `p.result-head` before Start.
- **Suggested fix:** dismiss the card when the sheet is used, or place it so it does not cover Start.
- **Severity:** papercut.

## Worked well
- `createTestMatch` over a hand-built 2×2 `MatchInfo` worked first time: four Devices, real input through each Tile's capture, and the in-process JSON hop. Every rule test is deterministic from `match.seed`.
- World millimetres all the way down: bricks, paddles and balls are drawn once in world mm, and every Tile shows its own part with no per-Tile code. The 4 mm gap needed only a "lies wholly on one Tile" check.
- `Frame.t` and `now` made extrapolation one line, as the design doc promises. `onState` made "keep the last wall" trivial.
- Bots needed nothing from the platform beyond `Player.bot` and `Player.deviceId`, and "a Tile that seats nobody plays as a bot" fell out of the same lookup.
- Game discovery: the HUD listed Breakout as soon as the folder existed.
- The `wire:` log lines reached the browser console as `Breakout host: …` (`main.ts:98`), which made the measurement trivial to collect.
