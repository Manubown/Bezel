# 02: Breakout on a row of phones of different heights

**What to fix:** live test 1 (`.scratch/live-test-1/findings.md` §5): on a row of three phones nobody saw a paddle, and the three lives were gone in 13–19 s (`result {}`). Paddles existed only on Tiles whose bottom edge was within 2 mm of the bounds' bottom: in a row of different heights only the tallest phone qualified, and the Host's HUD bar covers the bottom ~20 mm of its own Tile. There was no touch-to-start either, so the balls fell while nobody held a paddle.

**Blocked by:** none

**Status:** resolved

- [x] A paddle on every Tile with no other Tile below it in its own x-range, at that Tile's own bottom edge less the inset. A ball is lost when it falls wholly below its column's floor: the bottom of the Tile under its x, or between Tiles the lower of the neighbours. `bounds` stays the side walls and ceiling.
- [x] The bottom 22 mm of every Tile is dead: a faint line marks it on every paddle Tile, and the paddle's face sits above it.
- [x] Touch-to-start: the first ball rests until every human paddle's Tile has been touched once, and "<name>, touch to start" shows on every Tile meanwhile. After a lost life the ball rests on the paddle of the column that lost it and rides with it until that Tile is touched; then it rests `serveWait` and heads up off the paddle.
- [x] Tests over a hand-built 3-phone row (64 × 139, 71 × 153, 64 × 139 mm, 4 mm gaps, centred vertically as the lobby lays them out). Each Tile gets a paddle at its own bottom. A ball below the short Tile's floor but still inside `bounds` costs a life. The serve waits for touches. Existing grid tests adapted.
- [x] `pnpm exec tsc -p games/breakout` clean; `pnpm vitest run games/breakout` green.

## Comments

### 2026-11-08

**Changed**
- `games/breakout/src/index.ts`:
  - `BREAKOUT.paddle.inset` 10 → 24 mm, and a new `BREAKOUT.dead: 22`: the paddle's underside sits 2 mm above the dead strip. `bottomSlack` is gone.
  - `serveWait` documents the touch gate: a resting ball rests longer while play waits for a touch.
  - `field(match)`:
    - `row` = every Tile that has no other Tile below it overlapping its x-range (`o.x < t.x + t.w && o.x + o.w > t.x && o.y >= t.y + t.h`), in Layout order. On the 2×2 grid that is still d2, d3. On a row it is every phone. On a 3-phone grid the top-right phone now gets a paddle too, which guards the empty fourth cell.
    - `bottom[k]` = that Tile's bottom edge: its column's floor.
    - `column(x)` = the paddle whose Tile spans x (the lower one if two do). Between Tiles it is the lower of the nearest on either side.
    - `contact[k]` = `bottom[k] − inset − paddle.h − ball`.
    - `floor` (the bounds' bottom) is gone.
  - Host:
    - `hold: Set<paddle>` starts as every human paddle (`fingersOf`). Any non-cancel sample from that Tile clears its entry, as does a pointer already down there (`down[k]`, tracked from `down` to `up`/`cancel`), checked at the top of each `tick`.
    - A resting ball counts down `wait` only when the touches it waits for are in. A ball with `on: k` waits for paddle k's Tile; any other ball (the first serve, a second ball) waits for an empty `hold`.
    - A ball with `on: k` is put on paddle k's face every tick it rests (`x = paddles[k]`, `y = contact[k]`). `on` is dropped when its rest is over.
    - Loss: `b.y − R > bottom[column(b.x)]`. The replacement is `serveOff(c)`: it rests on that column's paddle, heads up within ±`maxServeAngle`, and adds a human paddle to `hold`.
    - The first serve is unchanged: mid-way down a random paddle Tile, heading down.
  - State: `world.hold: number[]` (sorted paddle indices), and `Ball.on?: number` while a ball rests on a paddle. Adds about 10 B per frame.
  - View:
    - On every paddle Tile, a faint line (`rgba(242,240,234,0.2)`, 0.4 mm) at `bottom − dead`.
    - The paddle at its own contact.
    - "BOT" now sits inside the dead strip (under the line), no longer under the paddle, which has no room above the line for it.
    - While `hold` is non-empty, each Tile draws "<name>, touch to start" per held paddle at 60 % of its height. The name is the human seated at that paddle's Tile.
- `games/breakout/test/breakout.test.ts` (8 → 11 tests):
  - The view wrapper that counted brick fills and emptied the canvas record is gone. The SDK's recording context now keeps one frame (`clearRect` resets it), so the tests read `t.drawn(d)`.
  - Helpers take the Match: `matchOf(tiles, players)`, `finger(t, tile)`, `tap`, `contactOf(tile)`, `crossing(s, tile, bounds)`, and `play(t, match, hands, …)`.
  - Adapted:
    - The paddle test also pins `hold` [0, 1] → [] on the first touches.
    - The bot test pins `hold` [] when no human has a paddle.
    - The loss under d2 now pins the next ball resting on d2's paddle: `{ x: paddles[0], y: CONTACT, wait: serveWait, on: 0 }`, heading up. With d2's finger down it counts down at once.
  - New, on the 3-phone row:
    - Every Tile's paddle is drawn on every Device at its own `bottom − inset − h` above the dead line, and the dead line is drawn across each Tile. With bots on all three paddles over 60 s, every return happens at the face of the Tile under the ball, ≥ 3 per Tile.
    - The first ball stays put for 5 s with `hold [0, 2]`, and every Tile draws both "Ann, touch to start" and "Bo, touch to start". After Ann's tap: `hold [2]`, still put, only Bo asked. After Bo's finger lands: `hold []`, and after `serveWait` the ball moves and no Tile asks.
    - Ann taps once and leaves her paddle in d0's middle; Bo tracks. The ball lost under d0 is lost one step after it is wholly below d0's bottom (146), while still inside the bounds (< 153). The next ball rests on Ann's paddle (`on: 0`, y = d0's contact) with `hold [0]` for 3 more seconds, and every Tile asks Ann. Her finger lands at x 50: the paddle and the ball go there, and `serveWait` later the ball heads up off it.
- `games/breakout/README.md`: paddles per column, the dead strip, the per-column floor, touch-to-start, and `hold` in the state.

**Verified**
- `pnpm exec tsc -p games/breakout`: clean.
- `pnpm vitest run games/breakout`: 11 passed, 28–38 s across runs. The wall-clearing test alone takes 17–26 s. The last run was together with Snake: `pnpm vitest run games/breakout games/snake`, 23 passed.
- Not run against the old code. From reading it, the new row tests would fail there:
  - only d1 (153 mm tall) was on the bottom row, so `paddles` would be `[103.5]`;
  - there was no `hold`;
  - a ball under d0 was lost only past the bounds' bottom (y − R > 153).
- Not run: a browser or phone smoke (the maintainer runs it).

**Deviations / notes**
- **The dead line is drawn only on paddle Tiles.** The ticket says "the bottom 22 mm of every Tile is dead". On a row every Tile has a paddle, so the two readings agree. On a grid, though, the bottom of a top-row Tile is open field (the ball falls through to the Tile below), and a line there would look like a floor.
- **The after-loss serve heads up off the paddle at a random angle within ±30°**, as the first serve does downwards. The first serve still starts mid-Tile heading down. It is gated by every human paddle's touch, so nobody has to be holding a paddle when it falls.
- **A finger already down counts as the touch.** Someone who is holding their paddle when a ball is lost does not have to lift and tap again. The ball then waits only `serveWait`, riding the paddle.
- **The text says "touch to start" after a loss too**, as the ticket words it, prefixed with the name of the Player play waits for, as Pong does.
- **The first-serve gate holds only the ball it gates.** A second ball (20 bricks) that comes while a lost ball rests on a paddle waits for that `hold` as well. Otherwise balls in flight keep moving.
- With a lone Tile (or a column template), `column` still applies. A Tile with a narrower Tile below it has no paddle, and the floor under its overhang is the narrower Tile's bottom (`between Tiles: the lower neighbour`). Breakout's manifest offers only `row` and `grid`.
