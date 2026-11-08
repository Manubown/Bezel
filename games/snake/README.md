# Snake

Each Player steers a snake across the whole surface with a finger on their own phone: the head turns toward the finger. A snake starts as a dot on its own phone heading along the Layout's long axis, slow, and speeds up as the Match runs. Snakes run straight through the bezel gaps between phones; food lies only on phones and makes a snake longer. Running off a phone where no other phone lies straight on within `SNAKE.maxGap` (the surface's edge, including the band above or below a short phone in a row of taller ones), or hitting a body, ends a snake. The last snake alive wins, or the longest after two minutes. Bots play an empty Player slot.

```
src/index.ts         manifest + host + view, exported through defineGame; SNAKE holds every tunable
test/snake.test.ts   the rules, over createTestMatch: a 2 × 2 grid, a rotated Tile, a row of three phones of different heights, bots, the time limit
```

- 1–4 Tiles in any template, 1–2 Players, bots, `tickHz: 30` (the manifest says why not 60).
- The state is the snakes' polylines as flat `[x, y, …]` arrays in world mm to 0.1 mm, with a point only where the heading bent, and the speed the heads run at; views extrapolate each head along its heading at that speed.
- The Game imports `@mgc/sdk` only; the test pins that.
