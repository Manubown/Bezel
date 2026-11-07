# Breakout

Co-operative Breakout over every Tile on the table. Bricks fill the top of the Layout; each bottom-row Tile has a paddle that follows the finger of the human seated there, or a bot. One ball, two after 20 bricks; three lost balls end the Match, a cleared wall wins it.

```
src/index.ts            manifest + host + view, exported through defineGame; BREAKOUT holds every tunable
test/breakout.test.ts   the rules over a hand-built 2×2 grid, run in one process over createTestMatch
```

- The state is two streams in one object: `world` (balls, paddles, lives) in every state, `wall` (one `0`/`1` string per brick row) only when bricks broke, on a resume, and as a keyframe every `BREAKOUT.wallEveryMs`. Views keep the last wall.
- The host logs its bytes per frame and its upload once a second (`wire: …` in the console and the HUD log).
- The Game imports `@mgc/sdk` only; the test pins that.
