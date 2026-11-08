# 02: Snake on a row of phones of different heights

**What to fix:** live test 1 (`.scratch/live-test-1/findings.md` §5). Three Snake Matches on a row of three phones ended after 4 s (0:0), 13 s (3:1) and 5 s (0:2), with both snakes dead within seconds.

**Blocked by:** none

**Status:** resolved (the bot bar lowered from 60 s to 30 s, per Main's time-box; see the notes)

- [x] Find out why, on a hand-built 3-phone row (64 × 139, 71 × 153, 64 × 139 mm, 4 mm gaps, centred vertically as the lobby's row template lays them), with no input and with bots.
- [x] With no input, both snakes live at least 10 s on that row.
- [x] Spawn each snake on its own Tile heading along the row's long axis; start slower.
- [x] Treat the bands above and below the short phones so they no longer kill unseen.
- [~] A bot survives 60 s. Pinned at 30 s on 10 seeds. Of 20 seeds, 11 last past 60 s and none dies before 39 s of Match time.
- [x] `pnpm exec tsc -p games/snake` clean; `pnpm vitest run games/snake` green.

## Comments

### 2026-11-08

**Why they died** (throwaway probe over that row, deleted, under the old code)
- **No input.** Both snakes died at 4.3 s of Match time, 1.3 s after the countdown, off the top of the bounds (head y −1.5). Each spawned at its Tile's mid-height (y 76.5) heading up its screen at 60 mm/s, which is 78 mm in 1.3 s. That is the "4 s (0:0)" Match: a first-time player has not touched yet.
- **Bots.** Lone bots on seeds 1–10 died 14–50 s in; two bots on seeds 1–10 ended 5–25 s in. The deaths split three ways:
  - **The bands.** Heads died in the 7 mm band above or below a short phone (y 0.9, 3.9, 4.9; y 150.6 below d0). A head off every Tile cannot turn, so one that slips into the band at a shallow angle runs straight along it, and dies unseen after 25 mm (`maxGap`) or at the bounds.
  - **Head-on hits.** Both bots died in the same step.
  - **Coiling.** A long bot ran into its own body.

**Changed**
- `games/snake/src/index.ts`:
  - **Spawn** (`starts(match)`):
    - Each snake starts on its home Tile, `spawnMargin` (10 mm) in from the Tile's edge nearer one end of the bounds' long axis, heading toward the far end. A tie (one Tile, two equal phones) takes the top, heading down.
    - Across the axis, snake k of n sits at (k + 1)/(n + 1) of its Tile: two snakes that run at each other pass side by side, and two on one Tile run side by side.
    - On the row: Ann at (10, 53.3) heading right, Bo at (197, 99.7) heading left.
    - A snake starts as a dot (`[h, h]`) and grows to `start` (50 mm) as it runs: the tail waits, as after eating. During the countdown the view draws a 9 mm stroke ahead of each head, so the heading shows.
  - **Speed:** `SNAKE.speed` 60 → 20 mm/s at the first step, then +`accel` 1 mm/s per second, up to `maxSpeed` 60 (reached 40 s in).
    - `turnRate` is replaced by `radius: 15`: the turn rate is speed / radius, so turning circles, `foodMargin` and the bend spacing stay as they were at every speed.
    - The state carries `speed` (to 0.1), and views extrapolate with it.
  - **Gaps and bands** (`toward`, `ray`, `dies`):
    - A head off every Tile still runs straight on, unturnable. It now dies at the first step off a Tile when running straight on would not reach a Tile within `maxGap` of its run off them (a ray cast against every Tile, rotation included).
    - The band above or below a short phone is a wall at that phone's visible edge, and so are the bounds' edge and a 3-Tile grid's empty corner. A bezel gap crossed at more than ~9° off its length is still crossed.
    - A head no longer dies 25 mm later, unseen. Bots see the wall in their lookahead and turn before it.
  - **Bot:**
    - `lookahead` 45 → 90 mm.
    - A way now counts only if the bot could still turn round where it ends: a half circle at full rate, either way (`turnsRound`).
- `games/snake/test/snake.test.ts` (8 → 12 tests):
  - Helpers: `stepAfter(s)` and `turnAfter(s)` use the state's speed; `ROW3` is the row above; `ENDS` seats Ann at d0 and Bo at d2.
  - **New: spawn and speed.** Spawn points and headings on the row, one Tile and the grid. The first step at 20 mm/s. After 2 s the tail is still at the spawn point and the speed is 22.
  - **Adapted: bezel gap.** Ann starts at d3's bottom (109, 294) heading up. She crosses the gap at least 2 steps straight and dies just past the bounds' top.
  - **Adapted: turning.** Both snakes start at the top heading down. Ann's finger is below-left of her (clockwise), Bo's east of him (counter-clockwise). The turn per step stays ≤ speed / radius / Hz.
  - **Adapted: two-snake end.** Bo runs straight off the bottom.
  - **Adapted: growth.** Ann first circles until her body has grown out of its dot, then eats. The tail-wait check follows the state's speed.
  - **Adapted: time limit.** Ann circles a tangent circle taken where she is, so she never crosses the way she came in. Bo laps his Tile 20 mm in after eating once: the old "circle the Tile's centre" lassoed through its own approach at the new speeds. The test also pins `speed = maxSpeed` at the end.
  - **New: no input on the row.** Both snakes run past each other and die at the same step, off the far ends (Ann x > 207, Bo x < 0), at their spawn y. The Match lasts ≥ 10 s (11.2 s measured in the probe).
  - **New: short phone's edge.** Ann steered up to d0's top edge dies at her first step off it: on d0 at y ≥ 7 one step before, now at 0 < y < 7. Before, she would have died at y < 0.
  - **New: lone bot.** On seeds 1–10 a lone bot on the row is alive 30 s into the run.
- `games/snake/README.md`: the spawn, the speed ramp, the edge rule, the state's `speed`, and the new test layout.

**Verified**
- `pnpm exec tsc -p games/snake`: clean.
- `pnpm vitest run games/breakout games/snake`: 23 passed (Snake 12, about 14 s).
- Probe over the row after the fix (throwaway, deleted):
  - **No input:** both die at 11.2 s of Match time (8.2 s of running), off the far ends.
  - **Lone bot, seeds 1–20, Match seconds at death / food eaten:** 56/15, 88.5/28, 83.8/25, alive at 123/33, 56.5/16, 99/25, 60.5/16, 55.4/21, 55.4/20, 43.1/15, 39.3/15, alive/34, 92.3/26, 72/21, 64.3/22, 38.7/11, 72.3/29, 52.8/16, 69.8/24, 70.9/22. That is 11 of 20 past 60 s and a minimum of 38.7 s. The deaths I drew out (8 seeds, on earlier variants of this bot) were all the bot running into its own body inside the phones; I did not classify the final variant's deaths.
- Not run: a browser or phone smoke (the maintainer runs it).

**Deviations / notes**
- **The bot bar is 30 s, not 60 s.** Main time-boxed it. A long bot (15–30 foods, 350–650 mm, on about 28,000 mm² of row) still coils itself in: it takes the first safe-looking way toward the nearest food, and a safe way over a 90 mm horizon does not keep it out of its own loops.
- **Tried and dropped** (none moved the 20-seed spread enough to keep):
  - a flood-fill area check on a 4 mm grid;
  - a "can it still reach its own tail" check on that grid;
  - a two-level lookahead;
  - turning radius 10;
  - growth 10 (34–106 s).
  The real fix is a planner that follows its tail or reasons about enclosures under the turning radius. Left open.
- **Not done:** in an intermediate probe (spawn and edge fix in, old bot), two bots on the row often ended each other head-on in the same step. I did not re-measure that with the final bot; the ticket asked only for a lone bot.
- **The speed ramp changes the game for humans too.** A Match starts at a third of the old speed, reaches the old 60 mm/s at 40 s and stays there. The view and every test take the speed from the state.
- **The edge rule replaces "dies 25 mm off every Tile".** The same crossings live and the same ones die, but the decision comes at the edge the head leaves, where its player can see it. `maxGap` keeps its value and meaning (the longest straight run off the phones).
- **Spawn on a two-phone row** (144 × 150 mm, taller than wide) runs along y: both snakes start at the top heading down, side by side. On the three-phone row the axis is x.
