# 01: Breakout on a grid

**What to build:** co-operative Breakout over every Tile. Bricks fill the top of the Layout bounds and skip the gaps between phones. Each bottom-row Tile has a paddle that follows its seated human's finger, or a bot. Balls bounce off walls, bricks and paddles. Lives are shared. A second ball comes in after 20 bricks. `wall` is published only when it changes, and views keep the last one. Balls are extrapolated. The host logs bytes per frame and its upload once a second.

Per `.scratch/breakout/spec.md`.

**Blocked by:** none

**Status:** resolved

- [x] Manifest: `tiles {1,4}`, `controllers {0,0}`, `players {1,4}`, `bots`, `templates ['row','grid']`, `tickHz 60`. Imports only `@mgc/sdk`; the test pins that, and `BREAKOUT`, `BreakoutState` and `BreakoutMessage` are exported.
- [x] Test (hand-built 2×2, four 70 × 150 Tiles, 4 mm gaps): no brick straddles a gap; every cell that lies wholly on one Tile has its brick.
- [x] Test: the bottom Tiles' paddles follow `d2`'s and `d3`'s fingers along x only, each clamped to its own Tile. Fingers on `d0` and `d1` move nothing.
- [x] Test: a ball lost under `d2` costs a life on every Device's state, and a new ball is served.
- [x] Test: a brick hit removes it, the next published state carries `wall`, and the one after does not. Otherwise the wall goes out only as a 1 s keyframe. Every view keeps drawing the last wall from states without one.
- [x] Test: clearing every brick ends the Match with every Player ranked. Along the way it checks the second ball at 20 bricks and the speed-up every 10.
- [x] Test: the third lost ball ends the Match.
- [x] Test: bottom Tiles that seat nobody are bots, never faster than `BREAKOUT.bot.speed`, and they return balls.
- [x] Smoke, three tabs in a grid: the ball crosses tabs, and a brick hit shows on all three. Frame bytes read from the console.
- [x] Bytes per frame and Host upload at 60 Hz × 3 Peers measured (4-tab 2×2 grid) and recorded in `.scratch/breakout/friction.md`.
- [x] `pnpm exec tsc -p games/breakout` clean.

## Comments

### 2026-11-07

**Changed**
- `games/breakout/src/index.ts` (replaces the template copy):
  - `BREAKOUT` holds every tunable:
    - ball 2 mm;
    - paddle 20 × 3 mm, 10 mm above its Tile's bottom edge;
    - `wallFraction 0.3`; bricks 8 × 4 mm with 1 mm gaps, 12 mm below the top (room for the HUD text) and 2 mm in from the sides;
    - speed 110 mm/s, × 1.08 every 10 bricks, at most 240;
    - serve ±30° off straight down, returns up to 60° off straight up, 1.2 s rest at a serve;
    - 3 lives, second ball at 20 bricks;
    - bot `{ speed 200, aimError 7 }`, bottom-row slack 2 mm;
    - `wallEveryMs 1000`, `statsEveryMs 1000`.
  - `field(match)`, shared by host and view. It finds:
    - the bottom row: Tiles whose bottom edge is within 2 mm of the bounds' bottom, in Layout order;
    - each paddle's contact y and x range on its own Tile;
    - the wall grid, centred across the bounds over their top 30 %, with a cell placed only when its brick lies wholly on one Tile.
  - `fingersOf(match, row)`: a bottom Tile's paddle follows the Device of the human seated there (`Player.deviceId`, not bot). Otherwise it is a bot's.
  - Host:
    - Bots move first in `tick`, at most `bot.speed`. Each heads for where the soonest ball will cross its face, folded off the side walls, plus its aim (redrawn after each of its returns from a separate seeded stream), or its Tile's middle when no ball is coming.
    - Balls rest, then move. They reflect off the bounds' left, right and top.
    - Bricks: the nearest overlapped one breaks, and the ball reflects on the axis it overlaps least.
    - Paddles return a ball whose face was crossed this step, by hit offset as in Pong.
    - A ball wholly below the bounds costs a life and is served again while lives are left.
    - Every 10 bricks all balls are rescaled to the new speed. At 20 a second ball is served.
    - Serves come from the middle of a random bottom-row Tile, heading down.
    - Cleared wall: `end({ ranking: every Player })`. Lost: `end({})`.
  - State: `{ world: { balls[{x,y,vx,vy,wait}], paddles[x], lives }, wall?: string[] }`. The wall is one `0`/`1` string per grid row; never-placed cells are `0`. It is published when bricks broke, in the first state, on resume, and every `wallEveryMs`.
  - The host logs `wire: <B>/frame, <B> with the wall; <n> frames (<k> with the wall) in <s> s; host upload <B/s> to <N> Peers` once a second.
  - View:
    - keeps the last wall from `onState`;
    - draws bricks by row colour, paddles ("BOT" under a bot's), and balls extrapolated by `now − max(t, resumedAt)` (≤ 100 ms), folded off the walls and reflected off a covering paddle;
    - draws a resting ball as a ring;
    - shows `Lives n · Bricks m` at each Tile's top left.
- `games/breakout/test/breakout.test.ts`: 8 tests over a hand-built 2×2 grid. The view is wrapped so each frame's brick fills are counted, and the headless canvas's call record is emptied every frame (it otherwise runs a long Match out of memory; see friction). Finger strategies: `tracks(off)`, `sweeps`, `dodges`, all aimed at the folded crossing.
- `games/breakout/README.md`: rewritten for Breakout (it was the template's).
- `.scratch/breakout/friction.md`: the measurements and 15 entries.

**Verified**
- `pnpm exec tsc -p games/breakout`: clean.
- `pnpm vitest run games/breakout`: 8 passed, 28–56 s across the last runs; the wall-clearing test alone takes 20–39 s.
- Measurements: the full table is in `friction.md`. Highlights:
  - Test (2×2 of 70 × 150, 224 bricks), 3 Peers:
    - 141–154 B/frame with one ball, 258–272 B with two;
    - 423–555 B with the wall (the wall alone is 289 B);
    - host upload 26–28 KB/s (one ball), 47–52 KB/s (two).
  - Browser, 4 tabs in a 2×2 grid, 60 Hz × 3 Peers:
    - 180–186 B/frame and 851–870 B with the wall;
    - 1–2 wall states a second;
    - host upload 33.7–37.4 KB/s (full seconds of 58–60 states).
  - Browser, 3 tabs: 163–168 B/frame (two balls: 263–268 B), 834–966 B with the wall, 18–22 KB/s (two balls: 33–34 KB/s) to 2 Peers.
  - Rounding every number to 0.1 mm would cut a two-ball state from 268.5 B to 153.9 B (throwaway test, deleted).
- Tuning (throwaway tests, deleted): bots alone on the 2×2 grid at `bot.speed 150` lost all three lives in 104 s. At 200 they cleared the 224-brick wall in 175 s with one life left.
- Smoke setup:
  - `pnpm --filter @mgc/pwa dev --port 5185`, headless managed Chromium, 420 × 860 tabs (111 × 227 mm), real Trystero, room 2BK8.
  - Vite's HMR socket was blocked in each tab (siblings' edits would reload them).
  - The canvas was read through `CanvasRenderingContext2D.prototype` hooks:
    - `fillRect` 8 × 4 = brick, 20 × 3 = paddle;
    - `arc` r 2 = ball, with `getTransform()` giving each tab's Tile origin;
    - `fillText` for the HUD text;
    - `clearRect` closes a frame.
- **Three tabs, grid**, as the lobby seats them: Host top left (Player 1, field only), Peer top right (field only), Peer bottom left (Player 2, the only paddle); the bottom-right cell is empty.
  - **Human paddle:** drags on the bottom-left tab put the paddle at x 20, then 80 (dragged lower: y ignored), then 101.1 (asked for 110; clamped at 111.1 − 10). Each value appeared on all three tabs' paddle draws. A drag on the top-right tab moved nothing.
  - **Ball crosses tabs, brick hits on all three** (Player 2 a bot, 60 s, 2,420 three-tab samples):
    - The ball was drawn in the top left 551 samples, top right 395, bottom left 2,112, the gaps 107 and the empty cell 572. Its region sequence started `BL > gap > TL > BL > gap > TL > gap > BL > gap > empty > gap > TR > …`.
    - The Host saw 36 brick-count drops (550 → 506).
    - The three tabs drew the same brick count in all but 53 samples (2.2 %; the tabs are read one after another, so a drop lands between reads).
    - At one hit all three HUDs read "Lives 3 · Bricks 549", and the gap is visible on the top-left tab.
  - **Wall keyframes vs a reload:**
    - With the wall broadcast only on change (a temporary build), a Peer reloaded mid-Match came back without a pause and drew `Bricks 0` for every sample over 10 s, while the others drew 544.
    - With the shipped keyframes, the reloaded tab's first frame (1.8 s after the reload) drew 538 bricks, the Host's count.
  - **Loss:** a human Player 2 who did not move lost three serves in about 6 s. The card read "Match over" (`{}`).
  - No page errors and no warnings or faults in any tab's console.
- **Four tabs, 2×2 grid:** Host top left (Player 1, no paddle), Peer top right (nobody), Peer bottom left (nobody: bot paddle), Peer bottom right (Player 2, a bot for this run). Both bottom paddles drew "BOT" and the wire numbers above were logged.
- Screenshots (`%TEMP%`):
  - lobby with Grid and Breakout: `omp-sshots-15c4f5b13fffc135.png`;
  - "Match over" card: `omp-sshots-15c4f6c80bbfc136.png`;
  - bottom-left tab after the drags: `omp-sshots-15c4f6f7d6eacf14.png`;
  - brick hit on three tabs (TL, TR, BL): `omp-sshots-15c4f756deffc138.png`, `omp-sshots-15c4f757bc3b37a9.png`, `omp-sshots-15c4f7587feacf16.png`;
  - 2×2 (TL, TR, BL, BR): `omp-sshots-15c4f7af7abfc139.png`, `omp-sshots-15c4f7b0157b37aa.png`, `omp-sshots-15c4f7b0842acf17.png`, `omp-sshots-15c4f7b10a55147b.png`.
- Dev server stopped and tabs closed.
- Not observed:
  - Real phones.
  - The row template in the browser.
  - A Host on the bottom row (a grid always puts it top left).
  - A pause and resume (leave detection was never triggered).
  - A cleared wall in the browser (the tests and the bots-only run cover it).

**Deviations / notes**
- **The wall also goes out as a keyframe** every `wallEveryMs` (1 s), and in the state published on resume. It is no longer strictly only on change.
  - Why: the host cannot learn that a view started late, and a Peer that reloads faster than leave detection gets no retained states. The smoke showed such a tab drawing no bricks.
  - A per-Device `publish(s, to)` was considered as a retained "wall channel". [source] It does not reach a rejoined Peer, because the host replays retained states only on resume.
  - Cost: about 2.5 KB/s of 35 KB/s on the 2×2 grid.
  - The spec's test still holds: the state after a break carries `wall`, the next one does not.
- **Result shape.** A cleared wall ends with `{ ranking: every Player in match order }`, as the spec asks, so the card names Player 1 as winner. A lost Match ends with `{}` ("Match over"): a ranking would print "<someone> wins". `MatchResult` has no shared outcome; see friction.
- **The field is the bounds**, including a grid's empty fourth cell with three phones. There the ball is invisible and the floor unguarded. The spec places paddles only on the bottom row, so that half of the floor has none.
- **Choices where the spec was open** (the boring option each time):
  - Serve from the middle of a random bottom-row Tile, heading down toward its paddle.
  - Every lost ball costs a life, even with two in play, and is served again while lives are left.
  - Paddles return a ball only across their face.
  - One brick per ball per step.
  - The wall string includes never-placed cells as `0`, so the views derive the grid from `match` alone.
  - Tile `rot` is ignored, as in Pong; no template rotates a Tile.
- **`ctx.log` once a second stays in the shipped Game**, as the spec's measurement asks. On the Host it fills the HUD log and the bar over the field; see friction.
- **Smoke harness:** the first human-drag attempt went to the wrong tab, because every Peer is "Windows" in the roster. It was repeated on the right tab, identified from its canvas transform.
