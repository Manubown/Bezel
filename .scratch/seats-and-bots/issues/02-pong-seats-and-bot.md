# 02: Pong: sides from seats, bot opponent, one-Tile play

**What to build:** Pong's paddles belong to the Players seated at the outer Tiles rather than to Player indexes, a bot Player's paddle is driven by the host, and one phone can play Pong against a bot.

Per `.scratch/seats-and-bots/spec.md` §4: side 0 = Player seated at the first Tile, side 1 = Player at the last Tile, a bot fills the remaining side; bot AI in `tick` with `PONG.bot = { speed, aimError }` (moves toward the predicted crossing y, bounded speed, seeded aim error so it can lose); manifest `tiles: {1,4}`, `bots: true`; the view draws a small "BOT" label under the bot's score.

**Blocked by:** 01 (Lobby: Tile order, seats in the Match, bot Player slots)

**Status:** resolved

- [x] Pong test: Player 1 seated at the last Tile → that Device's input moves the east paddle and the west paddle ignores it
- [x] Pong test: a bot paddle never moves faster than `PONG.bot.speed`; it returns a centred serve; a bot can be beaten (a shot aimed away from its predicted position scores)
- [x] Pong test: a one-Tile Match with one human and one bot plays a point and ends at seven
- [x] Pong manifest: `tiles: {1,4}`, `bots: true`; Pong still imports only `@mgc/sdk`; existing Pong tests pass (adapted only where they pinned index-based sides)
- [x] Smoke (two tabs): Host moved to the east end → the Host's drags move the east paddle on both tabs; Player 1 marked Bot → the bot paddle tracks the ball on both tabs and the human scores at least once
- [x] Smoke (one tab): Start with one Tile and a bot → a game runs and ends with a result card
- [x] Typecheck and suite green; `docs/sdk-design.md` §6 Pong sketch updated

## Comments

### 2026-11-07

**Changed**
- `games/pong/src/index.ts`:
  - `PONG.bot = { speed: 160, aimError: 20 }` (mm/s, mm), next to the other constants and documented there.
  - New `seats(match)`, used by both the host and the view. Side 0 is the human Player whose `deviceId` is the first Tile's Device. Side 1 is another human whose `deviceId` is the last Tile's Device, so with one Tile its human plays west. The other Players (the bots) take the open sides in `match.players` order. A side that stays empty throws "Pong needs a Player on each side", which the lobby never produces. Sides never come from a Player's index.
  - Host: `fingers[s]` is the Device that moves side `s` (the seated human's `deviceId`; none for a bot). `onInput` maps `i.deviceId` through it, so a middle Tile, a bot's Tile and any other Device move nothing. Scores and ranking are keyed by the seated Players' ids, as before.
  - Bot AI at the top of `tick`, before the serve-rest check, so a bot also moves while the ball rests. A bot's paddle moves at most `PONG.bot.speed * dt` toward `goal(s)`. While the ball rests or heads away, the goal is the centre. Otherwise it is the y where the ball will cross the paddle's face (top/bottom bounces folded, using the view's existing `fold`), plus `aim`, clamped to the paddle range. `aim` is 0 at a serve and is drawn uniform in ±`aimError` at every return. Its randoms come from a separate mulberry32 stream seeded `match.seed ^ 0x9e3779b9`, so the serves are the same with or without a bot.
  - Manifest: `tiles: { min: 1, max: 4 }`, `bots: true`.
  - View: a small "BOT" label (4.5 mm, dim) under a bot side's score. With one Tile, the two scores now sit at ¼ and ¾ of its width; before, both would have been drawn at its centre.
  - Doc comments on `PongState`, `table` and the game updated.
- `games/pong/test/pong.test.ts`:
  - Adapted:
    - `rowMatch` seats Ann at `d0` and Bo at the last Tile (`deviceId`).
    - The manifest test expects 1–4 Tiles and `bots: true`.
    - The finger-strategy helper type `Bot` is renamed `Hand`, so it does not read like a real bot. `play` takes `[Hand | undefined, Hand | undefined]` (no finger for a side without a hand) and an optional Match (default `TWO`).
    - No existing assertion changed.
  - Five new tests:
    1. Seats. On three Tiles, with Ann (Player 1) at `d2` and Bo at `d0`, `d2`'s finger moves only the east paddle (`[mid, 100]`). Then `d0` moves the west paddle and the middle `d1` nothing (`[40, 100]`). On two Tiles with Ann east, `[dodges, tracks()]` ends `{ p-ann: 7, p-bo: 0 }`, ranking `[p-ann, p-bo]`.
    2. Bot speed. Slot 0 is a bot (`players: [bot:0, Bo@d1]`), so the bot plays west. It never moves more than `PONG.bot.speed / 60` per step over 30 s, and it moves at the cap on more than 10 steps. It returns the ball at least 3 times, at heights more than a paddle apart. Meanwhile a finger on its Tile (`d0`, dodging) changes nothing.
    3. Centred serve. With `[Ann@d0, bot:1]` and seed 1 (the first serve goes east), for every serve in 60 s (at least 2), the bot's paddle is at the centre (to 1e-9) when the rest ends, and the bot returns the serve before any point.
    4. Beaten. Ann hits off her paddle's top half (`tracks(12)`) and scores `[1, 0]` after the bot has returned shots. At the step the ball crossed the bot's face, the paddle had settled (moved < 1e-6). It sat more than the paddle's reach (18.5 mm) and at most `aimError` from where the ball crossed: the aim error put it away from its predicted position.
    5. One Tile. With `[Ann@d0, bot:1]`, Ann's finger moves the west paddle while the bot waits centred (`[40, mid]`). With Ann tracking, the scores go `0:0 … 7:0`, the result is `{ p-ann: 7, bot:1: 0 }` with ranking `[p-ann, bot:1]`, and the events are `started, ended, closed`.
- `docs/sdk-design.md` §6: the Pong sketch now has:
  - `seats()` (sides from seats, not indexes; one Tile → the human is west);
  - `fingers` for input (other Devices ignored);
  - side-indexed `pads`/`score` with the result keyed by Player id;
  - a `BOT = { speed, aimError }` step in `tick` (folded crossing prediction, `aim` reset at a serve and redrawn per return, centre otherwise);
  - manifest `tiles {1,4}`, `bots: true`.

  The paragraph after it lists what the shipped game adds: `PONG.bot`, the seeded and separate aim stream, centring for the serve, aim 0 at serves, one-Tile score placement and the "BOT" label.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pass, pwa).
- `pnpm test`: 13 files, 80 tests passed (Pong 11, up from 6; the suite was 75).
- Tuning (a throwaway headless sim over `createTestMatch`, deleted; 3 seeds per row, human first):
  - At first guess (`speed 70, aimError 22`) the bot almost never scored. Against a human capped at 120 mm/s on two Tiles the score was 42:15 (6 seeds), and against an instant tracker it scored nothing.
  - At `160 / 20`:
    - A human who sees 250 ms late and moves at most 400 mm/s, aiming at the predicted crossing: 21:3 on two Tiles and 21:0 on four, but 7:21 on one Tile (43 mm between the faces).
    - A human capped at 200 mm/s on two Tiles: 21:2.
    - A perfect tracker never misses, so the bot loses every point, through its aim error (|aim| > 18.5 on about 7.5 % of returned shots).
- Smoke: `pnpm --filter @mgc/pwa dev --port 5181` (5173 is the default; took 5181), headless managed Chromium, 420×860 tabs, real Trystero.
  - Reading the canvas: Pong's canvas calls were read by wrapping `CanvasRenderingContext2D.prototype` `arc` (radius 3.5 → the ball; world position and, through `getTransform()`, client px), `fillRect` (4×30 → paddle centre by x) and `fillText` (non-stage canvas → scores and "BOT").
  - Input: lobby actions were trusted clicks. Paddle drags were trusted mouse down/move/up at the ball's client y.
  - **One tab** (room WPM5): a click on `.players button[data-slot="1"]` (pressed) made P2 "Bot"; then "Start Pong".
    - The view drew the scores at ¼ and ¾ of the screen, with "BOT" under the right one.
    - With the human's drags tracking the ball, the scores ran `0:0 → 6:0` and the Match ended after 36 s. The result card read "Player 1 wins · Player 1 7 · Bot 0", with "Last match: …" in the sheet. No page errors.
    - An earlier one-tab run (room 3JXN) where the human did not move ended with the bot at 7 (last read 3:6 before the end). That tab closed before its card could be captured.
  - **Two tabs** (room 6TN8, Host + Peer):
    - **Moving the Host.** Before, the roster read "1 This phone · Player 1 / 2 Windows · Player 2". A trusted click on the Host's ▶ (`[data-device=<host>][data-delta="1"]`) made it "1 Windows · first phone · Player 1 / 2 This phone · right of phone 1 · Player 2". The Peer's strip read "Phone 1 of 2 · first phone · Player 1".
    - **Host drags, two humans.** Start Pong, then Host drags at client y 250 and 650. The east paddle (x 216) was at 66.1 and then 172 on both the Host's and the Peer's views, and the west one stayed at 113.8. The Host's screen shows the east paddle at its right edge (screenshot).
    - **Bot.** "End match", then a trusted click on P2's Bot chip (`data-slot="1"`; P2 is the Host's slot after the move), then Start. Both views drew "BOT" under the east score, on the Host's screen (screenshot). The Peer (west, human) then tracked the ball with drags for 109 s, with 1516 samples of both views. Over that run:
      - The bot paddle moved toward the ball's crossing as the ball came east, and back toward the centre as it left. For example, it waited at 186.4 and met the ball at y ≈ 184.
      - It returned the ball about 63 times, and its range was 15–212.5 mm (the whole paddle range).
      - The two views' bot paddle agreed: median difference 0, largest 13.4 mm, because the samples are taken at slightly different moments.
      - The human scored 6 points while tracking (`1:5 → 7:5`). The result card "Player 1 wins · Player 1 7 · Bot 5" showed on both tabs.
      - A Host drag to the top of its screen (world ≈ 27 mm) during the bot Match left the bot paddle on its own course (51.3 → 65.8, downward).
      - No page errors in either tab.
  - Screenshots, `.webp` in `%TEMP%`:
    - One tab, room 3JXN: `pong02-one-lobby` (P2 Bot pressed) and `pong02-one-running` (0 · 1 BOT).
    - One tab, room WPM5: `pong02-one-play` and `pong02-one-result`.
    - Two tabs: `pong02-two-before`, `pong02-two-moved`, `pong02-two-host-drag`, `pong02-two-peer-drag`, `pong02-two-bot-lobby`, `pong02-two-bot-host`, `pong02-two-bot-peer`, `pong02-two-bot-result-host` and `pong02-two-bot-result-peer`.
- Not observed:
  - Real phones, or three or more tabs.
  - Slot 0 as the bot in the browser (the bot-speed test covers it).
  - The speed cap measured in the browser. Speeds worked out from sampled view states reached 239 mm/s, because the sample times are the harness's, not the states'. The test pins the cap per tick.
  - A Host drag in the bot Match that would have jumped the paddle. The evidence above is indirect: the paddle went the other way.

**Deviations / notes**
- **"Player 1 marked Bot"** in the box was done as Player slot 1 (0-based, the HUD's P2 / "Player 2 is a bot"), per the assignment. After the Host moved east that is the Host's slot, so the Peer was the human.
- **No aim error on a serve.** A serve is the game's, not a Player's shot. With the bot centred during the rest, every serve is returned, which is what "returns a centred serve" pins. Every returned shot gets a new aim error.
- **Leftover Players fill the open sides in order.** In a lobby Match these are bots. A human seated elsewhere (not producible by the lobby today) would get the side, and its own Device would move that paddle.
- **Smoke timing.** Between two harness cells the bot Match ran for a while with nobody at the Peer, so the bot led 5:1 before tracking began. The working tree also had unrelated, uncommitted changes during the smoke (a "Code"/Join form in `hud.ts`/`index.html`, `HOST_ROOM_KEY` in `main.ts`, README). They are not part of 02.
- For 03 (touch presence):
  - In the host, `seated[s]` is the side's Player and `fingers[s]` the Device whose touches count for it. `bots` lists the bot sides, which are always present. Inputs from other Devices are already dropped before any presence bookkeeping.
  - The view gets the same mapping from `seats(ctx.match)`; it currently uses it only for the "BOT" label.
  - Bots move at the top of `tick`, before the serve-rest check. During a hold with the ball frozen in place, `goal` stays constant, so a bot just settles. If the hold is modelled by holding `wait`, the bot goes to the centre instead.
  - The first-serve wait for every human to touch fits in the same `wait` gate.
