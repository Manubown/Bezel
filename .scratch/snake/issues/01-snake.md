# 01: Snake: a tick-driven continuous world over any arrangement, rotated Tiles included

**What to build:** Snake, per `.scratch/snake/spec.md`. Each Player steers a polyline snake across the whole surface with a finger on their own Tile. Snakes cross bezel gaps straight on. Food lies only on Tiles, rotated ones included. A snake dies at the bounds, in a gap it cannot cross, or on a body. The last snake alive wins, or the longest after the time limit. Bots play empty slots. Views extrapolate the head. Manifest: `tiles {1,4}`, `controllers {0,0}`, `players {1,2}`, `bots: true`, any template, `tickHz: 30`.

**Blocked by:** none

**Status:** resolved

- [x] Test: a 2×2 grid Match (hand-built, `rot: 0`) and a 2-Tile Match whose second Tile has `rot: π/2` (hand-built: the lobby cannot make one). Food never lies in a gap or outside a Tile.
- [x] Test: a snake dies at the bounds; a gap is crossed straight on, and a finger does not turn a head that is in a gap.
- [x] Test: eating grows by `SNAKE.growth`.
- [x] Test: a finger on `d0` turns Ann's snake and not Bo's.
- [x] Test: a bot reaches food.
- [x] Test: the time limit ends the Match with the longest first.
- [x] `src/index.ts` exports `defineGame<SnakeState, SnakeMessage>`, `SNAKE`, `SnakeState`, `SnakeBody`, `SnakeMessage`, and imports only `@mgc/sdk` (pinned by the test).
- [x] State size measured at long lengths, with the fan-out arithmetic, in `.scratch/snake/friction.md`.
- [x] Smoke on port 5182:
  - two tabs in a column and three in a grid;
  - a snake crosses from one tab to the next with no visible jump;
  - the Peer's extrapolation is smooth, with screenshots at consecutive frames.
- [x] `pnpm exec tsc -p games/snake` is clean; `pnpm vitest run games/snake`: 8 passed.

## Comments

### 2026-11-07

**Changed**
- `games/snake/src/index.ts`, the whole Game (it was the template's copy):
  - **`SNAKE` tunables, all in one place.** Lengths in mm, speeds in mm/s, angles in rad, times in s:
    - movement: `speed` 60, `turnRate` 4 (a 15 mm turning radius), stroke `width` 4;
    - growth: `start` 50, `growth` 20;
    - food: 3 dots of `foodRadius` 2.5, at least `foodMargin` 20 inside their Tile's edges;
    - gaps: `maxGap` 25;
    - polyline: `bend` 0.4;
    - timing: `ready` 3, `timeLimit` 120;
    - bots: `bot { think 0.4, wobble 0.35, lookahead 45 }`.
  - **World.** The world is continuous, the heading is in radians, and each step does the following:
    - It turns the heading toward the aim by at most `turnRate·dt`, but not at all while the head is off every Tile.
    - It moves the head `speed·dt` (2 mm) and trims the polyline to `length`.
    - The head leaves a polyline point only once the heading has turned `bend` since the last point. A straight run is therefore one segment, and a full-rate turn gets a point every 6 mm, within 0.3 mm of the arc.
    - All heads move first, then deaths are judged on where they all are, so a head-on hit kills both. A head dies:
      - outside `bounds`;
      - after running more than `maxGap` off every Tile (the empty cell of a three-Tile grid, or the band beside a short phone);
      - or within `width` of a body. Its own body counts too, except its first `2·width`.
  - **Food.**
    - It goes on a random Tile at a uniform local point `foodMargin` inside the Tile's edges, mapped through `Surface.localToWorld`, so rotation is handled. Up to 8 draws are made to land it clear of bodies.
    - A head within `foodRadius + width/2` eats it: `length += growth`, `score++`, and a new dot is laid.
    - The margin is at least the turning radius plus half the stroke, so a head that eats near the surface's edge can still turn away.
  - **Steering.**
    - Steering comes only from inputs whose `deviceId` is a human Player's own Tile, with the world point on that Tile. The Tile containment is rotation-correct.
    - `down` and `move` set the aim; `up` and `cancel` clear it, and with no aim the snake runs straight. Every other Device, and every point off the Tile, steers nothing.
  - **Bots.** A bot's aim is the bearing to the nearest food it can reach, plus a seeded wobble drawn anew every `think·(0.5…1.5)` s. Food that lies inside either of its turning circles is not counted as reachable.
    - Every step it simulates its way ahead with the same turn rule: for `lookahead` mm, or only as far as the food plus one turning radius when it is going for food.
    - If that way dies, it takes the first way that leaves the whole lookahead: straight, a hard turn, then a U-turn, its food's side first. If none does, it takes whichever lives longest.
    - Bots use their own random stream, so the food is the same with or without bots.
  - **State.**
    - It holds `phase` (`ready` or `run`), `clock` (seconds left), `food` as a flat `[x, y, …]` array, and per snake: `points` (flat, head first, 0.1 mm), `heading` (0.001 rad), `length`, `score` and `alive`.
    - It is published once per step, during the countdown too, and again on resume.
  - **End.**
    - A two-snake Match ends when at most one snake is alive; a one-snake Match ends when its snake dies; any Match ends at `timeLimit`.
    - Ranking: alive first, then the snake that died last, then the longest, then `match.players` order. `scores` are food eaten.
  - **Home Tiles** (`homes`): a human's home is the Tile it sits at. A bot takes the first, then the last, Tile that no human sits at, as in Pong. Every snake starts at its home's mid-height, heading up its screen. A second snake on the same Tile starts beside the first, heading down, so the two part.
  - **View.**
    - Each snake is a stroked polyline in its own colour, drawn through segment midpoints with `quadraticCurveTo`, so bends are round. Its head is a dot, and food dots are drawn too.
    - Each head is extrapolated along its heading by `min(now − max(t, resumedAt), 100 ms)`, as Pong extrapolates the ball. The tail is re-trimmed after the extrapolated head, so it retracts smoothly.
    - Words are drawn in the Tile's own rotated frame:
      - on each home Tile, `name: score` in the snake's colour;
      - the clock on every Tile;
      - during the ready phase, a big countdown, and on a seated human's Tile "touch where your snake should go".
    - Canvas only.
  - **Manifest comment.** It explains 30 Hz with the measured arithmetic.
- `games/snake/test/snake.test.ts`, 8 tests over `createTestMatch`, all at the manifest's 30 Hz:
  1. **Manifest and imports.** Manifest values; `src/` imports only `@mgc/sdk`; `@mgc/sdk` is the only dependency.
  2. **Food.**
     - Hand-built Matches: the 2×2 grid, and d0 upright beside d1 at `(224, 0)` with `rot: π/2`, whose world box is x 74…224, y 0…70.
     - For seeds 1–30, every initial dot lies `foodMargin` inside a Tile's world area, the areas being written out by hand rather than computed with the game's rotation. Every Tile, the rotated one included, gets some.
     - Then a bot runs 60 s on the rotated Match. Every dot in every state, respawns included, lies on a Tile. The bot ate at least 3, and no view faulted.
  3. **Gap crossing and the bounds.**
     - Ann alone, seated at d3 of the grid, starts at d3's centre (109, 229) heading up.
     - A finger on d1, which seats nobody, does not turn her. Neither does her own finger on d3 while her head is in the d3/d1 gap (2 steps in the gap).
     - She runs straight through d1 and dies one step past the top edge. Result: `{ scores: { p-ann }, ranking: [p-ann] }`.
  4. **Steering (row).**
     - Ann's finger right of her head turns her clockwise by at most `turnRate/30` (+0.001 for rounding) per step. Bo's heading stays up and his x stays at 109.
     - After `up`, a `down` on d0 at world (100, 40), which is off d0, leaves her heading unchanged.
     - Bo's finger turns only Bo.
  5. **Last alive wins.** Ann circles her finger; Bo runs off the top and dies. Ranking `[p-ann, p-bo]`.
  6. **Growth.**
     - Ann chases the nearest food and eats it: `length` goes from 50 to 70 and `score` to 1. Exactly one dot was replaced, within reach of the head, and there are still 3 dots.
     - The polyline's drawn length then grows 2 mm per step, from 50 to 70, as the tail waits.
  7. **Bot reaches food.** A bot alone on the grid eats 3 within 30 s and is still alive.
  8. **Time limit.**
     - Ann circles; Bo chases the food on his Tile farthest from his head (food inside his turning circle he could only orbit) until he has eaten once, then circles.
     - The Match ends at exactly 123 s (ready plus limit) with clock 0 and both alive. Bo is longer, and the ranking is `[p-bo, p-ann]`: length beats Player order.
- `games/snake/README.md`: rewritten to describe Snake. The copy still had the template's text.
- `.scratch/snake/friction.md`: the measurements and 13 entries.

**Verified**
- `pnpm vitest run games/snake`: 8 passed (tests 2.2–3.9 s across runs). `pnpm exec tsc -p games/snake`: clean.
- **Bot tuning.** This was a throwaway headless sim over `createTestMatch`, 8 seeds per layout, deleted afterwards.
  - The first bot decided every 0.25 s and held its course between decisions. It mostly ran off the edges: one 70 × 150 Tile, 4–22 s.
  - The final bot checks its way every step.
  - Alone, it survives:

    | Layout | Survival | Food eaten |
    |---|---|---|
    | One 70 × 150 Tile | 9–21 s | 7–12 |
    | Row of two | 8–27 s | |
    | 2×2 grid | 15–58 s | up to 28 |
    | Desktop column, 111 × 227 mm × 2 | 13–117 s | up to 45 |

    It now dies almost only by coiling into itself once long, and occasionally by falling into a gap.
  - Bot against bot, the shorter-lived dies in 2–32 s, mostly into the other's body.
  - That is the "beatable" property: a human who simply outlives a greedy bot wins. A scripted human that looped blindly without looking still lost to it in most seeds (it ran into the bot), so the sim does not prove that a sighted human wins.
- **Smoke.**
  - Setup:
    - `pnpm --filter @mgc/pwa dev --port 5182 --strictPort`, headless managed Chromium, 420 × 860 tabs (111 × 227 mm), real Trystero, room STBZ.
    - Every tab had an init script that blocks Vite's HMR socket, and wraps `CanvasRenderingContext2D.prototype.arc` (radius 3 → a head, 2.5 → food; world point, client px, time) and `RTCDataChannel.prototype.send` (bytes).
    - Lobby actions were trusted clicks: the Game row's "Snake", `[data-t="column"]` or `[data-t="grid"]`, the Bot chips `.players button[data-slot="0|1"]`, then `.start`.
    - Fingers were trusted mouse down/move/up on the Host or Peer tab.
  - **Column, two tabs** (Host = Player 1 at the top, Peer = Player 2 below):
    - **Unsteered.** The Host's snake ran off the top of its Tile first (113.8 mm straight up, about 1.9 s into the run): "Player 2 wins · Player 2 0 · Player 1 0". The steering runs below kept it alive.
    - **Crossing.**
      - The Host's finger circled its snake around (85, 70); the Peer had no finger.
      - The Peer's snake ran straight up at x 55.6. It was drawn on the Peer's screen last at 4901 ms (world y 231.10, client y −0.1) and on the Host's first at 4967 ms (y 227.15, client y 858.6). That is 66 ms for the 4 mm bezel at 60 mm/s.
      - Over the straight run, a linear fit of head y against time gave 60.01 mm/s on both views. Residuals: Peer 331 frames, median 0.015 mm, max 0.052 mm (0.2 px); Host 162 frames, max 0.224 mm.
      - The same instant on both tabs agreed to 0.021 mm median, 0.174 mm max.
      - The Peer's snake then ran off the top: "Player 1 wins · Player 1 1 · Player 2 0" on both tabs.
    - **Peer screenshots, consecutive.** `snake01-col-peer-a.jpg` and `-b.jpg`, 121 ms apart (the screenshot's own cost). Between them the Peer drew a frame every 16–17 ms (one of 29 ms), and the head moved 0.94–1.09 mm per frame, which is 60 mm/s. The tail followed by about the same distance between the two screenshots: no stretch, no snap.
    - **Each finger steers its own snake.** Both tabs ran a carrot finger at once. For 7.5 s, Player 1's head stayed 16.5–20.4 mm from (70, 110) on the Host's Tile, and Player 2's stayed 16.8–22.6 mm from (50, 351.5) on the Peer's.
      - Screenshots: `snake01-col2-{host,peer}-ready.jpg` (countdown "2", "touch where your snake should go", `Player 2: 0`) and `-steer.jpg`, which shows round arcs.
      - Result after the fingers lifted: "Player 2 wins · Player 2 1 · Player 1 0".
      - No page errors on either tab.
  - **Grid, three tabs** (phone 1 = Host, top left, Player 1; phone 2, top right, seats nobody; phone 3, bottom left, Player 2; the fourth cell is empty):
    - **Vertical crossing.** Player 2's snake ran up from phone 3 into the Host's Tile and off its top.
    - **Horizontal crossing, both ways.**
      - The Host aimed at its right edge and lifted at x 75 mm, heading 0.18 rad. Its snake ran straight east: last drawn on the Host's screen at 4055 ms (x 111.48), first on the middle Tile at 4122 ms (x 115.43), 67 ms.
      - The Host touched again at 4.6 s and pulled it back west: last on the middle Tile at 5805 ms, first on the Host's at 5872 ms, 67 ms again.
      - Straight-run fit: middle Tile (a Peer that seats nobody) 60.00 mm/s, max residual 0.008 mm; Host 60.10 mm/s, max 0.033 mm. Head positions agreed across tabs to 0.009 mm median.
    - **Screenshots.**
      - `snake01-grid-mid-a/b.jpg`: the middle Tile, the Host's snake entering, 105 ms apart, no label, clock only.
      - `snake01-grid-low-a/b.jpg`.
      - `snake01-grid-host-vertical.png`: Player 2's head at world y 220.3 is hidden under the Host's HUD bar (friction).
    - **Bot vs bot** (both Bot chips pressed): three Matches ended after 8–18 s, e.g. "Bot wins · Bot 5 · Bot 4". `snake01-grid-bots-{host,mid,low}.jpg` show both bots playing on their home Tiles with `Bot: 1` labels.
  - **Wire** (Host's sends):
    - column, 1 Peer: 30.5 frames/s, median 526 B, 16.0 KB/s;
    - grid, 2 Peers: 60.9 frames/s, median 521 B, max 565 B, 31.8 KB/s;
    - bots: max frame 820 B, 31.4–33.4 KB/s.
    - One decoded frame: 488 B for a 253 B state.
  - The screenshots are in `%TEMP%`. The dev server was stopped and the tabs closed.
- **Not observed:**
  - Real phones and touch, or a pause or reconnect mid-Match.
  - A rotated Tile in the browser (no template makes one).
  - Four tabs: the 3-Peer numbers are arithmetic from the measured per-frame sizes.
  - Snakes longer than ~100 mm in the browser. The long-length state sizes come from the headless runs, using the same game code.

**Deviations / notes**
- **Choices the spec left open; I took the boring option:**
  - **Crossable gap.** A head may run at most `maxGap` (25 mm) off every Tile before it has fallen off. A 4 mm bezel is crossable down to about 9° from its length.
  - **No turning in a gap.** Heading is frozen there, and the test pins it.
  - **Ready countdown.** A 3 s countdown in the state's `phase`/`clock`, so players can put a finger down before anything moves.
  - **Scores** are food eaten. Since every snake starts at the same length, "longest" equals "most food".
  - **Food never under bodies:** up to 8 draws. Food does not avoid other food.
  - **A second snake on a one-Tile Match** starts heading down beside the first. With both heading up 23 mm apart, two bots killed each other within 0.3–0.6 s in every seed.
- **Polyline encoding** (flat arrays, 0.1 mm, a point per 0.4 rad of bend) is chosen for wire size. The view's quadratic smoothing hides the facets: the first smoke screenshot, before smoothing, showed a visible 16-gon.
- **Bots react every step,** not with a decision delay. The delayed bot ran off edges, which did not look like a beatable bot but a broken one. It stays beatable through greed (it coils itself), through not anticipating heads, and through the wobble.
- **A finger is a target point,** not a direction: the snake turns toward it and orbits it once it gets there. Food inside a snake's turning circle cannot be reached by holding a finger on it (the time-limit test had to avoid that). A player moves the finger instead.
- **Tests pin seed 1.** The time-limit test is deterministic but depends on tuning: if `SNAKE` changes, Bo may eat more or Ann may eat by chance. The assertions name what they need: both alive at 123 s, Bo strictly longer.
- **For a follow-up:** every friction entry is outside `games/snake`.
  - Biggest wins: the HUD bar over the Host's play surface, the ~235 B envelope per frame, a `MatchInfo` builder for `createTestMatch` (rotation included), and the `tickHz` mismatch check.
