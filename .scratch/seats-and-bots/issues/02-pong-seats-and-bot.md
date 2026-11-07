# 02: Pong: sides from seats, bot opponent, one-Tile play

**What to build:** Pong's paddles belong to the Players seated at the outer Tiles rather than to Player indexes, a bot Player's paddle is driven by the host, and one phone can play Pong against a bot.

Per `.scratch/seats-and-bots/spec.md` §4: side 0 = Player seated at the first Tile, side 1 = Player at the last Tile, a bot fills the remaining side; bot AI in `tick` with `PONG.bot = { speed, aimError }` (moves toward the predicted crossing y, bounded speed, seeded aim error so it can lose); manifest `tiles: {1,4}`, `bots: true`; the view draws a small "BOT" label under the bot's score.

**Blocked by:** 01 (Lobby: Tile order, seats in the Match, bot Player slots)

**Status:** ready-for-agent

- [ ] Pong test: Player 1 seated at the last Tile → that Device's input moves the east paddle and the west paddle ignores it
- [ ] Pong test: a bot paddle never moves faster than `PONG.bot.speed`; it returns a centred serve; a bot can be beaten (a shot aimed away from its predicted position scores)
- [ ] Pong test: a one-Tile Match with one human and one bot plays a point and ends at seven
- [ ] Pong manifest: `tiles: {1,4}`, `bots: true`; Pong still imports only `@mgc/sdk`; existing Pong tests pass (adapted only where they pinned index-based sides)
- [ ] Smoke (two tabs): Host moved to the east end → the Host's drags move the east paddle on both tabs; Player 1 marked Bot → the bot paddle tracks the ball on both tabs and the human scores at least once
- [ ] Smoke (one tab): Start with one Tile and a bot → a game runs and ends with a result card
- [ ] Typecheck and suite green; `docs/sdk-design.md` §6 Pong sketch updated
