# Snake: friction log

Found while building `games/snake` (2026-11-07). Each entry gives where, expected, actual, workaround, suggested fix and severity. [source] marks what I learned by reading code rather than by observing it.

## Measured state size and fan-out (the spec's question)

"State" is `JSON.stringify` of the published `SnakeState`. "Wire" is what the Host's `RTCDataChannel.send` was handed, per frame, hooked in the smoke tabs. KB = 1000 B.

**Where the bytes go.** One decoded frame from the column smoke was 488 B on the wire for a 253 B state (two 50 mm snakes, 3 food):
- 132 B of JSON envelope: `{"c":"msg","d":{"c":"match","d":{"v":1,"t":"state","state":…,"at":195298.09990215302},"from":"924d8a9e-…-049a3eb6eb91"}}`.
- 103 B of Trystero binary header, which includes a 64-hex-character hash.

So every frame carries about 235 B on top of the state. See "Every state frame carries ~235 B of envelope".

**State size.**
- Sizes seen in play:
  - Headless bot runs, 8 seeds per layout, with the final code: at most 607 B (2×2 grid, two bots, 480 mm together, 37 points).
  - One bot alone, grown to 770 mm (39 points): 553 B.
  - A straight run is one segment, so a typical state stays under about 650 B.
- Worst case: both snakes turn at full rate the whole way, so they get a point every 6 mm, at 3-digit coordinates. That costs about 10.9 B per point:

  | Two snakes of | Points each | State |
  |---|---|---|
  | 100 mm | 18 | 609 B |
  | 250 mm | 43 | 1,151 B |
  | 500 mm | 85 | 2,064 B |
  | 1,000 mm | 168 | 3,884 B |

**Fan-out.** Host upload = (N−1) × tickHz × (state + 235 B):

| State | Wire per frame | 1 Peer, 30 Hz | 3 Peers, 30 Hz | 3 Peers, 60 Hz |
|---|---|---|---|---|
| Start (253 B) | 488 B | 14.6 KB/s | 43.9 KB/s | 87.8 KB/s |
| Largest seen in bot play (607 B) | 842 B | 25.3 KB/s | 75.8 KB/s | 151.6 KB/s |
| Worst case, 2 × 250 mm (1,151 B) | 1,386 B | 41.6 KB/s | 124.7 KB/s | 249.5 KB/s |
| Worst case, 2 × 500 mm (2,064 B) | 2,299 B | 69.0 KB/s | 206.9 KB/s | 413.8 KB/s |
| Worst case, 2 × 1,000 mm (3,884 B) | 4,119 B | 123.6 KB/s | 370.7 KB/s | 741.4 KB/s |

**Measured in the browser** (Host's sends, Snake running):

| Smoke | Frames/s | Median frame | Max frame | Upload |
|---|---|---|---|---|
| Column, 1 Peer | 30.5 | 526 B | 2,072 B (the lobby frame) | 16.0 KB/s |
| Grid, 2 Peers | 60.9 | 521 B | 565 B | 31.8 KB/s |
| Grid, 2 Peers, bot vs bot | 57.9–64.9 | 512–542 B | 820 B | 31.4–33.4 KB/s |

**Why 30 Hz and not 60.** For comparison, Pong's reference in `docs/sdk-design.md:231` is ~200 B × 60 Hz × 3 Peers ≈ 36 KB/s, counting state only. Snake at 60 Hz would cost 2–11× that. At 30 Hz the measured extrapolation was smooth (see the ticket): Peer max error 0.05 mm against a straight line. So 30 Hz costs nothing visible and halves the upload.

## Entries

### Steering is possible only from your own Tile (spec: record it)
- **Where:**
  - `apps/pwa/src/lobby.ts:9-10`: `SLOTS = 2`, so Players sit only at the first and last Tile.
  - `docs/sdk-design.md:103`: seats.
  - `games/snake/src/index.ts`, `onInput`: steering comes only from the Player's home Tile.
- **Expected:** a Player steers their snake wherever it is on the surface.
- **Actual:** the finger is a target point on the Player's own screen, so once the snake leaves that Tile, the finger can only pull it home.
  - **Two-tab column smoke:** with no finger down, the Peer's snake left its Tile 1.9 s into the run. It crossed the Host's whole Tile and ran off the top. All the Peer could have done was touch their own screen, which turns the snake back toward that point, or let it run straight.
  - **Grid smoke:** to visit the middle Tile, the Host aimed at its own right edge and lifted the finger when heading east, at x 75 mm. The snake ran straight across the gap. The Host then touched its own screen again to bring it back.

  It feels like a home beacon, not a steering wheel. You cannot chase food on another Tile, only line up and let go. The middle Tiles of a grid seat nobody, so nobody can steer from them.
- **Workaround:** none in the Game. The snake runs straight while no finger is down; that is the tool for leaving your Tile. The ready screen says "touch where your snake should go".
- **Suggested fix:** let a Player steer from any Tile that seats nobody, for example by mapping each unseated Tile to the nearest seated Player. Or give Snake Controllers as gamepads once the lobby can seat Players at Controllers. Either way needs Player slots beyond two.
- **Severity:** papercut (game design is boxed in by the seating model).

### The lobby never makes a rotated Tile, and tests must build the whole MatchInfo, bounds included, by hand
- **Where:**
  - `packages/layout/src/templates.ts:16,27,54`: `rot: 0` in every template.
  - `packages/sdk/src/testing.ts:10-17`: `createTestMatch` takes a full `MatchInfo`.
  - `packages/sdk/src/index.ts:1`: only `Surface` is re-exported, not `buildLayout` or `aabbOf`.
- **Expected:** a helper that turns "two phones, the second turned 90°" into a `MatchInfo`, with `bounds` computed the way the lobby does.
- **Actual:** the rotated Match can be tested only by hand-building `MatchInfo`. To get its `bounds` I had to work out the world box of a Tile at `(224, 0)`, 70 × 150, `rot: π/2`, which is x 74…224, y 0…70, by reading `surface.ts:21-26`. Every Game test re-types `devices` from `tiles` the same way (Pong's `rowMatch`, Snake's `matchOf`). A Game cannot import `@mgc/layout` (its test pins `@mgc/sdk` as its only dependency).
- **Workaround:** a `matchOf(tiles, bounds, players)` helper in the test, with the bounds written by hand.
- **Suggested fix:** export `matchOf({ template | tiles, players, seed, tickHz })` from `@mgc/sdk/test`. It should place Tiles with `buildLayout` (or take explicit rects with `rot`) and fill `devices` and `bounds` the way `apps/pwa/src/lobby.ts` does.
- **Severity:** papercut (missing test helper); rotation is untested by the platform's own flows.

### A hand-built MatchInfo's `tickHz` silently wins over the manifest's
- **Where:**
  - `packages/sdk/src/testing.ts:141`: `frameMs` comes from `o.match.tickHz`.
  - The host runs at whatever `match.tickHz` says (`docs/sdk-design.md:24`).
  - The lobby copies the manifest's value (`apps/pwa/src/lobby.ts:8`, default 60).
- **Expected:** a test of a 30 Hz Game runs at 30 Hz.
- **Actual:** a test that copies Pong's `rowMatch` (`tickHz: 60`) runs Snake's host at 60 Hz. Speeds and turn steps then differ from the browser, and nothing warns.
- **Workaround:** `tickHz: snake.manifest.tickHz!` in the test's `matchOf`.
- **Suggested fix:** `createTestMatch` should default `match.tickHz` to `game.manifest.tickHz ?? 60`, or throw when the two disagree.
- **Severity:** papercut.

### Host code has no Tile geometry: is this point on that Tile, and where is this local point in the world?
- **Where:**
  - `packages/sdk/src/types.ts:14` documents `Tile` only as "`rot` radians, clockwise about (x, y)".
  - `docs/sdk-design.md:16`.
  - `packages/layout/src/surface.ts:12-35` [source].
- **Expected:** a documented helper for "point on Tile" and "Tile-local to world", which is food placement and steering in any Tile-based Game.
- **Actual:**
  - Nothing says that `w` and `h` are the unrotated screen size, that `bounds` is the axis-aligned box of the rotated corners, or which way local y turns. I read `surface.ts`.
  - `Surface` is re-exported and does the math, but its constructor wants a `DeviceRect` (`id`, not `deviceId`) and a `pxPerMm` that geometry never uses.
- **Workaround:** `new Surface({ id: t.deviceId, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }, 1)`, and `worldToLocal`/`localToWorld` from it.
- **Suggested fix:**
  - `tileContains(tile, p)`, `tileToWorld(tile, local)` and `worldToTile(tile, p)` in `@mgc/sdk`, taking a `Tile`.
  - One sentence in `types.ts`/§1 on what `w`, `h` and `bounds` mean under rotation.
- **Severity:** doc-gap.

### Text drawn in world mm reads sideways on a rotated Tile
- **Where:**
  - `packages/sdk/src/game.ts:180-190`: `Frame.ctx` is in world mm.
  - Pong's scores (`games/pong/src/index.ts:290-297`) and Pass's words (`games/pass/src/index.ts:120-134`) are drawn in world coordinates.
- **Expected:** a name and score that read upright on the phone that shows them.
- **Actual:** world-aligned text on a `rot: π/2` Tile comes out rotated by 90° on that screen. The reference Games would do this if a rotated Layout existed.
- **Workaround:** draw the words in the Tile's own frame with `g.save(); g.translate(tile.x, tile.y); g.rotate(tile.rot); …; g.restore()`. The rotated-Tile test asserts no view faulted, but cannot see the text (next entry).
- **Suggested fix:** a `Frame.local(fn)` helper, or a second transform in `Frame`, that draws in the Tile's screen mm (origin top-left, upright), the way a Controller's frame already is. The reference Games should use it for their words.
- **Severity:** papercut.

### `createTestMatch` cannot show what a view drew
- **Where:**
  - `packages/sdk/src/testing.ts:19-49`: `TestMatch` has no canvas accessor.
  - `packages/sdk/src/headless.ts:43-88`: the headless context records every op [source], and never clears `ops`.
- **Expected:** a way to assert on what a view drew: the extrapolated head, the upright text on a rotated Tile, the polyline trimmed after the extrapolated head.
- **Actual:** only `state`, `latest`, `events` and `result` are exposed. Extrapolation and rotation-correct drawing could be checked only in the browser, by wrapping `CanvasRenderingContext2D.prototype.arc` and `fillText`. Over a long test the recorded ops also grow without bound: the 123 s time-limit test draws about 3,700 frames on two views.
- **Workaround:** the tests assert that no view faulted (`events(id)` has no `fault`). The drawing was checked in the browser smoke.
- **Suggested fix:**
  - `TestMatch.drawn(deviceId)` returning the last frame's `CanvasOp[]`, cleared per frame.
  - Document the recording context in `docs/guide/testing.md`.
- **Severity:** papercut (missing test helper).

### Every state frame carries ~235 B of envelope, more than Pong's whole state
- **Where:**
  - `packages/core/src/session.ts:72,225,268`: `DownEnvelope` stamps a 36-character `from` UUID on every Host → Peer frame, including the Host's own.
  - `packages/sdk/src/wire.ts:72`: `at` is sent unrounded, 17 significant digits.
  - The Trystero frame header, about 103 B with a 64-hex hash.
- **Expected:** the fan-out arithmetic in `docs/sdk-design.md:98,231`, (N−1) × rate × state bytes, to predict the upload.
- **Actual:** measured 488 B on the wire for a 253 B state, a 93 % overhead at the start of a Match. Even Pong, whose state is ~200 B, pays about the same 235 B a frame, so its real upload is about twice the doc's 36 KB/s [inference from the same envelope].
- **Workaround:** none in a Game. Snake keeps its own part small: flat number arrays, 0.1 mm rounding, a point only per 0.4 rad of bend, and 30 Hz.
- **Suggested fix:**
  - Drop `from` on frames the Host itself sends: a Peer knows the Host.
  - Round `at` to 0.1 ms.
  - Put "add ~235 B per frame" next to the formula in §2 and §5.
- **Severity:** papercut (budget); doc-gap for the formula.

### The doc gives no state budget, and `publish` has only one mode: the whole state
- **Where:**
  - `docs/sdk-design.md:98`: "the game owns the wire rate".
  - `docs/sdk-design.md:231`: the only reference number is Pong's ~200 B.
  - ADR-0003.
- **Expected:** guidance on how big a state may get at a given rate and Tile count, and a pattern for state that grows during play.
- **Actual:**
  - The spec had to ask for this measurement. Snake's state grows with length: up to 3.9 KB per frame for two 1 m snakes turning all the way.
  - A delta stream does not fit the platform. The tail changes every tick, and the retained-state replay (§5 Retention) would hand a late view only the last delta.
  - Breakout hit the same wall (`.scratch/breakout/friction.md`).
- **Workaround:** full state every tick, made small by encoding (see the table above), and 30 Hz.
- **Suggested fix:** a budget line in §5, for example "keep a state under ~1 KB at 30 Hz with 3 Peers, ≈ 110 KB/s with the envelope". Later, an SDK keyframe and delta helper that cooperates with retention, such as `publish(delta, { keyframe })`, with the retained keyframe replayed first.
- **Severity:** doc-gap.

### The Host's HUD bar covers the bottom 15 mm of the play surface during a Match
- **Where:**
  - `apps/pwa/index.html:37-38`: `.sheet` is fixed at the bottom; `.bar` has 14 px padding plus a line of text, 58 CSS px in all.
  - `apps/pwa/index.html:107`: a Peer's `.strip` shades the top ~50 px.
- **Expected:** the Host's screen shows its whole Tile while playing.
- **Actual:** grid smoke, `snake01-grid-host-vertical.png`. Player 2's snake came up into the Host's Tile from the Tile below, and at world y 220.3 mm (833 CSS px) its head was hidden under "STBZ · Snake · playing · Setup". On a 111 × 227 mm desktop Tile that is the bottom 15 mm (6.7 %) of the Host's screen. A snake crossing a bezel there is invisible on the Host for the gap plus about 0.25 s.
- **Workaround:** none in the Game. Snake keeps food 20 mm inside every Tile edge, so no food hides under the bar.
- **Suggested fix:** while a Match runs, fold the bar to a corner chip or make it translucent and click-through, as the Peer's strip is. Or tell Games the covered insets (`ViewContext.insets`) so they can keep labels clear.
- **Severity:** papercut.

### Every bot is named "Bot"
- **Where:**
  - `apps/pwa/src/lobby.ts:12`: `BOT_NAME = 'Bot'`.
  - The result card: `apps/pwa/src/hud.ts:83-87`.
- **Expected:** two bots can be told apart.
- **Actual:**
  - The grid bot-vs-bot smoke ended "Bot wins · Bot 5 · Bot 4". It does not say which bot won.
  - Snake's first label, `${name} ${score}`, drew "Bot 1", which reads as "bot number 1".
- **Workaround:** Snake labels read `Bot: 1`. Each snake is also coloured, and the label carries its colour.
- **Suggested fix:** default bot names by slot ("Bot 1", "Bot 2"), or by seat ("West bot").
- **Severity:** papercut.

### Pointer capture reports world points off the Device's own Tile; nothing says so
- **Where:**
  - `packages/sdk/src/game-side.ts:327-329` [source]: any `clientX/Y` maps through `surface.pxToWorld`, and the capture keeps a pointer past the canvas edge.
  - `packages/sdk/src/types.ts:72-73` (`Input.world`).
  - `docs/sdk-design.md:31`.
- **Expected:** to know whether `Input.world` can lie outside the sender's Tile.
- **Actual:**
  - It can: a desktop drag past the window edge, or a `t.input` at any world point.
  - The spec says "off-Tile input is ignored", so Snake must filter it itself. The docs never mention it.
- **Workaround:** `on(home, i.world)` in `onInput`. The steering test sends a `down` at world (100, 40) on `d0` (beside it, over `d1`) and checks that Ann's heading does not change.
- **Suggested fix:** one line on `Input.world`: "may lie outside the sender's Tile while a pointer it captured is dragged past its edge". Optionally an `Input.onTile` flag.
- **Severity:** doc-gap.

### Every Game re-derives "which Tile is whose"
- **Where:**
  - `games/pong/src/index.ts:90-98` (`seats`).
  - `games/_template/src/index.ts` (`seatOf`).
  - `games/snake/src/index.ts` (`homes`).
- **Expected:** one SDK answer to "this Player's Tile" and "the Player seated at this Tile", including where a bot belongs.
- **Actual:** each Game writes its own. A bot has no `deviceId`, so each Game also decides where a bot "lives". Snake copies Pong's rule: the first, then the last, Tile that no human sits at.
- **Workaround:** `homes(match)` in Snake.
- **Suggested fix:** `seats(match): { playerId, tile?: Tile }[]` in `@mgc/sdk`, with the lobby's rule for bots: slot 0 is the first Tile, slot 1 the last.
- **Severity:** papercut.

### `pnpm new-game` leaves the README describing the template
- **Where:** `scripts/new-game.mjs:38,46`. Only `# Template` is replaced, while the test file is renamed.
- **Expected:** a new Game's README that is either neutral or describes the Game.
- **Actual:** `games/snake/README.md` said "# Snake / The smallest complete Game for MobileGameConnect. Copy it with `pnpm new-game`…" and listed `test/template.test.ts`, a file that no longer existed.
- **Workaround:** rewrote the README.
- **Suggested fix:** keep the template's copy instructions out of the copied README, or replace `test/template.test.ts` with `test/${slug}.test.ts` and the first paragraph with a placeholder.
- **Severity:** papercut.

## Worked well

- **Rotated Tiles in tests.**
  - `createTestMatch` routes `t.input(device, phase, worldPoint)` through each Device's own `Surface` (`testing.ts:162`), rotation included. A finger on the rotated Tile therefore arrives at the host as the same world point.
  - The rotated-Tile tests passed on the first run; the food spawned rotation-correct through `Surface.localToWorld`.
- **Determinism.** Everything comes from `match.seed` (two mulberry32 streams: food, and bots). The 2×2 grid, the rotated Match and the 123 s time-limit test are exactly repeatable. The whole file runs in 2–4 s.
- **Fixed step.** At 30 Hz, `dt` is exactly `1/30`. A head moves exactly 2 mm a step and a clock counts whole steps. `t.tick(1000 / 30)` lands one step per frame.
- **Extrapolation.** `Frame.t` made it a one-liner, copied from Pong.
  - In the browser, the Peer drew the head on a straight line at 60.01 mm/s, with median error 0.015 mm and max 0.05 mm.
  - Host and Peer agreed on the head's world position to 0.02 mm (median).
  - The 4 mm bezel took 66–67 ms to cross on every crossing, which is 4 mm at 60 mm/s.
- **Fault events.** Fault events let the tests assert that the rotated view's `draw` (rotated text, quadratic curves) never threw.
- **Automatic discovery.** The Game appeared in the HUD's Game row with no registration. The lobby's column and grid templates, and its Bot chips, worked as documented in the Pong ticket.
- **Smoke instrumentation.** Wrapping `CanvasRenderingContext2D.prototype.arc` and `RTCDataChannel.prototype.send` in an init script gave per-frame positions and per-frame wire bytes on every tab, with no change to the app. Blocking Vite's HMR socket (Main's tip) kept sibling Games' edits from reloading the smoke tabs.
