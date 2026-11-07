# Snake

Each Player steers a snake across the whole surface with a finger on their own phone: the head turns toward the finger. Snakes run straight through the bezel gaps between phones; food lies only on phones and makes a snake longer. Leaving the surface, running too far off every phone, or hitting a body ends a snake. The last snake alive wins, or the longest after two minutes. Bots play an empty Player slot.

```
src/index.ts         manifest + host + view, exported through defineGame; SNAKE holds every tunable
test/snake.test.ts   the rules, over createTestMatch: a 2 × 2 grid, a rotated Tile, bots, the time limit
```

- 1–4 Tiles in any template, 1–2 Players, bots, `tickHz: 30` (the manifest says why not 60).
- The state is the snakes' polylines as flat `[x, y, …]` arrays in world mm to 0.1 mm, with a point only where the heading bent; views extrapolate each head along its heading.
- The Game imports `@mgc/sdk` only; the test pins that.
