# 04: Pong's ball crosses a phone even when no new state arrives meanwhile

**What to build:** A player at the middle phone of a row sees the ball cross their screen although the Host's states stalled for a few hundred milliseconds: the view follows the ball along the path its last state implies for up to a second, off the table's edges and off a paddle in its way. A held ball and a resting ball stay put however old the state. Spec D5.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Three Tiles in a row, the states stop while the ball is on the first Tile heading east: 300 ms later the middle Tile draws the ball where its velocity puts it
- [x] The ball is never drawn more than 1 s ahead of its state
- [x] A held ball stays; a ball with serve rest left starts moving only when the rest is over
- [x] A state from before a pause moves on from the resume, not from its stamp
- [x] A return is decided where the ball's path reaches the paddle's face, and a returned ball never passes the other paddle's face

## Comments

### 2026-11-10, PongAhead (implementation)

**Changed**
- `games/pong/src/index.ts`: `MAX_AHEAD_MS` 100 → 1000 with the reason in its comment. `draw`: with a second of extrapolation the old return check (does the paddle cover the ball at the *drawn* height) could return a ball the paddle would miss, or lose one it would return; the check now uses the height at which the ball's path reaches the face of the paddle it heads for. The mirrored position is clamped at the other paddle's face: the view never guesses a second return; the next state settles it. The file keeps its 327 lines, so the guide's citations into it hold.
- `games/pong/test/pong.test.ts`: helpers `stalling()` (drops the Host's states while set), `only(state)`, `rally(ball)`, `ballDrawn(t, deviceId)`; four tests for the criteria above.
- `docs/guide/concepts.md` (Main): the extrapolation paragraph says why and cites the new lines; `docs/guide/troubleshooting.md` gains "The ball does not show on a phone it crosses, or jumps".

**Verified**
- `pnpm vitest run games/pong/test/pong.test.ts`: 19 tests passed, 4 new. With the cap back at 100 ms all four new tests fail; with the 1 s cap and the old return check the returns test fails.

**Not covered:** the view keeps the incoming angle after a predicted return (the Host picks a new one from where the ball hit the paddle), as before; the next state corrects it.
