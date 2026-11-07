# Air Hockey

Two phones laid end to end (row or column), one Player at each end; a bot can take either end, and one phone can play a bot.

```
src/index.ts                manifest + host + view, exported through defineGame; tunables in AIR_HOCKEY
test/air-hockey.test.ts     the rules over createTestMatch, with the far Tile at rot 0 and at rot π
```

- The Game imports `@mgc/sdk` only; the test pins that.
- Each Player's half is the half nearer the Tile they are seated at (`Player.deviceId`); the paddle follows their finger within it.
- Play starts once every human has touched their Tile. First to `AIR_HOCKEY.win` goals wins.
- Nothing reads a Tile's `rot` but `table()`, which takes each Tile's world box from the SDK's `Surface`.
