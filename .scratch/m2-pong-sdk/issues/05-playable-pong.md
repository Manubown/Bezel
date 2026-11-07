# 05: Playable Pong: input, scoring, end

**What to build:** Pong is playable on two to four phones in a row. The two outer phones' Players move their paddles by touch; the ball bounces off the top and bottom of the whole table and off paddles, a miss scores for the other Player and serves toward the loser, the first to seven wins, a result overlay names the winner, and every phone returns to the lobby. Pong replaces the tracer Game and imports only the SDK.

SDK input: the view runtime captures pointer down/move/up/cancel on its canvas or root (`touch-action: none`, pointer capture), maps px→mm via the Surface, stamps `t` from the shared clock, coalesces moves to one per pointer per animation frame (down/up/cancel never coalesced), sends one input frame per view per frame, echoes the Device's own inputs to the local view's `onInput`, and honours `input: 'off'`. The host runtime overwrites `deviceId`/`role` from the arriving channel at ingest, enforces down → move* → up|cancel per Device and pointer, drops orphans, and delivers `onInput` in arrival order before `tick`. `Input.world` is world mm on a Tile. `end(result)` closes the Match: `close` frames reach every view, `onEnd` fires, the pwa gets `ended` with the result; later `publish` is dropped. The SDK exports a `createTestMatch({ game, match })` harness over the in-process link with a fake clock and scripted input, exposing tick, input, per-Device state, and result.

**Blocked by:** 04 (First Match on phones: Lobby Start runs a Game on every Device)

**Status:** ready-for-agent

- [x] E2E: a scripted touch on a Peer Tile reaches the host's `onInput` with that Device's id, `role: 'tile'`, world-mm coordinates equal to the Tile's rect offset plus the local point, and a `t` from the shared clock
- [x] E2E: 10 moves within one frame on one pointer yield one `move` at the host; a `move` without a prior `down` is dropped; the local view's `onInput` sees its own touch before the host echoes state
- [x] E2E: `end({ scores })` → every view's `onEnd` and the Host pwa's `ended` event with those scores; a `publish` after `end` reaches no view
- [x] Pong tests via `createTestMatch`: paddle follows input y and clamps to the Layout bounds; ball reverses at top/bottom; ball reverses on a paddle hit and scores on a miss with a serve toward the loser; the seventh point ends the Match with the winner first in `ranking`
- [x] Pong's manifest: tiles 2–4, controllers 0, players 2, template row; Pong imports nothing but the SDK
- [x] Result overlay names the winner by Player name and returns all phones to the lobby
- [x] Smoke (two tabs, then four): paddles follow the pointer on the outer tabs, the ball crosses every bezel without a visible jump, a game is played to seven
- [x] Typecheck and suite green

## Comments

### 2026-11-07

**Changed**
- `packages/sdk/src/types.ts`: `Sender`, `Input` (with `playerId?` and `role`, as in the design doc), and `RawInput` (an `Input` without `deviceId`/`role`/`playerId`). All three are exported from the index.
- `packages/sdk/src/wire.ts`:
  - `HostDown` gains `input { inputs: Input[] }`, and `ViewUp` gains `input { inputs: RawInput[] }`, so `NetUp` is now that frame.
  - `isNetUp` and `isRawInput` validate untrusted frames: finite numbers, a known phase, and a `world` with finite `x`/`y`.
- `packages/sdk/src/game.ts`: `HostHandlers.onInput`; `ViewHandlers.onInput` (the local echo), `onEnd({ reason, result? })` and `input?: 'coalesced' | 'off'`. `end` is documented as dropping later `publish`es.
- `packages/sdk/src/game-side.ts`, view side:
  - Unless `input: 'off'`, the root gets `touch-action: none` and listeners for pointer down/move/up/cancel.
  - On down it calls `setPointerCapture`. A throw (a scripted, inactive pointer) is caught.
  - It follows only pointers that went down on this view, so hover moves never leave.
  - px → mm goes through the Surface; a Controller uses screen mm. `t` comes from the game-side shared clock.
  - A move replaces the same pointer's waiting move; down/up/cancel are never merged.
  - On the next animation frame it sends one `input` frame. A view with `draw` flushes at the start of its paint, so `draw` already sees the echo. `onInput` echoes each sample with `deviceId`/`role` just before the frame leaves.
  - A `close` frame runs `onEnd` and then `dispose`.
- `packages/sdk/src/game-side.ts`, host side:
  - `onInput` runs per input, each guarded.
  - After `end`, `publish` and a second `end` are dropped, and input/tick handlers no longer run.
- `packages/sdk/src/match.ts`:
  - Every view's `input` frame is validated with `isNetUp`; anything else on the view link is `protocol`. The Host ingests its own view's input directly, and a Peer `send`s it with no `to`.
  - The Host's `deliver` takes `NetUp` from any Match Device except itself and ignores `NetDown`. Ingest builds a fresh `Input` from the channel's Device (role from `match.devices`) and keeps only `pointerId`/`phase`/`t`/`world.{x,y}`.
  - Ingest enforces `down → move* → up|cancel` per Device and pointer, dropping orphans and a second `down`.
  - Accepted inputs wait in an inbox. They go as one `input` frame right before the next step's `tick`; with `tickHz` 0 they go at once (or when the host link opens).
  - The runtime now reads its clocks and interval timer through an internal `Env`. Public `runMatch` = `runMatchWith(o, REAL_ENV)`.
- `packages/sdk/src/env.ts` (new): `Env { wall, mono, every }`. `GameClock`, `serveGame` and the in-process link take it. `inProcessLink` = `linkInProcess(load, REAL_ENV)`. Nothing new is exported from the index.
- `packages/sdk/src/headless.ts` (new): the headless DOM moved out of `test/harness.ts`:
  - `SteppedFrames`;
  - elements with listeners, a box, and pointer capture;
  - canvases whose 2D context records every call and property write as `[op, ...args]` and tracks the transform;
  - `headlessScreen(frames, opts).pointer(type, {pointerId, x, y})`, which hits the topmost element and bubbles.
- `packages/sdk/src/testing.ts` (new), exported as `@mgc/sdk/test` (`package.json` `exports["./test"]`). `await createTestMatch({ game, match, host?, pxPerMm? })`:
  - runs `runMatch` for every Device over the in-process link, on a headless screen each, with JSON-cloned microtask delivery between Devices (a Peer's frames go to the Host);
  - has a fake clock (shared time starts at 0; clock frames on fake intervals) and touches no global timers;
  - settles through one `MessageChannel` macrotask, so the user's fake timers cannot hang it;
  - gives `tick(ms)` (one animation frame per fixed step), `input(deviceId, phase, at, pointerId?)` (a pointer event through that view's own capture, then one frame at the same time, so the host has it before the next tick), `state(id)` (that view's `latest()`), `result()`, `events(id)`, `now()` and `stop()`.
- `packages/sdk/test/harness.ts` uses `headless.ts`. The probe records host `onInput` with the number of ticks before it, each view's interleaved states and echoes, and `onEnd`. It takes `onInput`/`input: 'off'` options. A Peer's frames go to the Host, as in the pwa. `game-seam.test.ts` now reads the recording context.
- `packages/sdk/test/match.e2e.test.ts`, four new tests:
  1. A touch on Peer d1 at (12, 40) mm arrives as `{deviceId:'d1', role:'tile', pointerId:3, phase:'down', world:{tile.x+12, tile.y+40}}`. Its `t` is within 0.005 ms of d1's shared clock at dispatch and within 1 ms of the Host's. It is delivered before the tick of its step.
  2. A down and 10 moves in one frame give `[down, move(last y)]` at the host. A forged orphan move delivered from d1 is dropped, and so is a hover move on d2. d1's echo of its `down` precedes the state the host published for it, and no other view sees the echo.
  3. With `input: 'off'` nothing is captured and the root has no `touch-action`.
  4. `end({scores})` followed by `publish({n:99})` in the same tick gives every view (Host's included) `onEnd({reason:'ended', result})` and only states 1, 2. The Host's `ended` event carries the scores.
- `games/pong` (new, `@mgc/pong`, depends on `@mgc/sdk` only; `@types/node` for the test):
  - Manifest: tiles 2–4, controllers 0, players 2, templates `['row']`.
  - The paddles are on `tiles[0]` (west, `players[0]`) and the last Tile (east, `players[1]`). Down/move/up y from that Tile moves its paddle, clamped so the paddle stays inside the Layout bounds. Middle Tiles and `cancel` are ignored.
  - Physics: the ball reflects off the bounds' top/bottom. A paddle returns it when its face plane is crossed within the paddle; the return angle grows with the hit offset (up to 50°) and speed ×1.06 per return, capped at 320 mm/s.
  - Scoring: wholly off an edge scores for the other side. The serve is from the centre toward the side that missed, at a seeded ±25°, after a 0.8 s rest. On 7 it publishes, then `end({ scores: {p0, p1}, ranking: [winner, loser] })`.
  - State `{ ball, pads: [w, e], score: [w, e], wait }` is published every tick.
  - Views draw the whole World: each score on its outer Tile, both paddles, and the ball (a ring while resting). The ball is extrapolated by ≤ 100 ms on the shared clock, folded at top/bottom and mirrored at a covering paddle.
  - Constants are exported as `PONG` for tests.
- `games/pong/test/pong.test.ts` (via `createTestMatch`):
  1. Manifest + import scan.
  2. Paddles: finger y 60/100 → `pads [60, 100]` on both views; −40/400 → paddle edges flush with the bounds' top/bottom. On a 3-Tile row the middle Tile moves nothing.
  3. Bots return off-centre for 20 s: the ball always stays within the bounds; every vx reversal is within one step of a paddle face, with the paddle covering it (≥ 3 per side); every vy reversal is within one step of the top or bottom at unchanged speed (both seen); the score stays 0:0.
  4. A tracking west and a dodging east: the first point is `[1, 0]`, the ball got past the east face, and the serve is from the exact centre with `vx > 0` (toward east) and `wait > 0`.
  5. A dodging west and a tracking east: `result` is `{ scores: {p-ann: 0, p-bo: 7}, ranking: ['p-bo', 'p-ann'] }`, the scores went 0:0 … 0:7 one point at a time, and both Devices' events are exactly `started, ended, closed` (no faults from `draw`).
- `apps/pwa`:
  - `main.ts`: `GAME = pong`. `onEvent` keeps `ended.result`; on `closed` it sets `play.last = { reason, players: match.players, result? }`, then hides the game layer and `lobby.close()`s as before.
  - `hud.ts`: `Play.closed` became `Play.last: LastMatch`. `openHud` composes the role panel with a result card that every Device appends to `body`.
  - The card shows `describeResult` (e.g. "Bo wins" / "Bo 7 · Ann 3" / "Tap to close"). It is shown only when the last Match has a result, and hides on tap or while a Match runs.
  - The Host's line reads "Last match: Ann wins · Ann 7 · Cy 4", or "Last match: aborted".
  - `result.ts` (new): `describeResult(players, result)`. The winner is `ranking[0]` by Player name; without a ranking, the highest score, or "Draw" on a tie, or "Match over" with neither.
  - `index.html`: `.result` styles. `package.json`: `@mgc/pong` replaces `@mgc/tracer`. `test/result.test.ts` (new, 2 tests).
- `games/tracer` was deleted, along with its typecheck entry. Root `typecheck` now runs `tsc -p games/pong`, and `pnpm-lock.yaml` is updated (`pnpm install --no-frozen-lockfile`).
- Docs:
  - `docs/sdk-design.md` §3: Peer `send` addressing, and `deliver`'s `from`.
  - §5: the second-down drop, the inbox → `input` frame before the step's tick (immediate for `tickHz` 0), the view following only pointers that went down on it, and the echo before `draw`.
  - §6: a note on the shipped Pong.
  - §8: the shipped `createTestMatch` API.
  - `docs/platform-design.md` §5: the result card and Pong as `GAME`.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pwa).
- `pnpm test`: 8 files, 39 tests passed: sdk 12 (9 E2E, 3 seam), pong 5, pwa lobby 3 + result 2, core 8, layout 9.
- Smoke: `pnpm dev` on :5174, headless managed Chromium, 420×860 tabs (dpr 1.25, 3.78 px/mm), real Trystero.
  - **Two tabs.** Host + Peer, players renamed Ann/Bo, Start.
    - Trusted `page.mouse` drags moved the paddles to exactly the pointer's mm on both tabs: Host to y 200 px → 52.91 mm, Peer to 700 px → 185.19 mm. A drag to 5 px clamped to 15.0 (edge flush with the top).
    - That first Match kept running unattended and ended "Bo wins · Bo 7 · Ann 3". Both tabs showed the card, the game layer was emptied and hidden, the Host sheet reopened with Start, and the Peer strip showed "Phone 2 of 2".
    - Second Match: in-page bots dispatched PointerEvents on each tab's game canvas (Host west tracking, Peer east chasing 60% of the time). It played to "Ann wins · Ann 7 · Bo 0" in 43 s, with the score drawn 0:0 → 6:0 point by point and the card on both tabs.
    - Ball draws, logged by wrapping `arc` in each tab: 29 bezel crossings. No frame-to-frame motion above 286 mm/s on either tab (cap 320).
    - Peer vs Host interpolated at the same wall time, within 15 mm of the bezel: median 0 mm, p95 0.07 mm, max 1.24 mm.
    - Elsewhere, the outliers were ≤ 3.3 mm at paddle contacts (Host frames at 30 fps), plus one 121 mm sample where the Peer still drew a missed ball off the table while the Host already showed the serve reset.
  - **Four tabs.** Two more Peers joined (phones 3, 4). P2 is the phone-4 Player, renamed Cy.
    - Trusted drags on the middle tabs moved no paddle. Drags on tab 1 and tab 4 put west at 66.14 mm and east at 171.96 mm on all four tabs, exactly the pointer's mm.
    - Bots on tabs 1 and 4 played on (3:4 when they started) to "Ann wins · Ann 7 · Cy 4" on all four cards. Every tab went back to its lobby (Host line, "Phone N of 4").
    - Bezel crossings per gap: 13 / 13 / 16, the same count on every tab. Within 15 mm of each bezel no tab drew motion faster than 272 mm/s.
    - Each Peer vs the Host near each bezel: medians 0–0.06 mm, p95 ≤ 0.27 mm, max ≤ 1.22 mm.
    - Three frame-to-frame jumps (472–2404 mm/s) came after 55–113 ms paint gaps in the headless tabs, at x 69–84 and 417–427 mm. None was within 15 mm of a bezel; the 100 ms extrapolation cap held the ball, then it caught up.
    - A third Match, ended with "End match", returned all four tabs to the lobby with "Last match: aborted" and no card.
    - Screenshots show the score and paddle on each outer tab.
  - No page errors and no fault warnings in any tab.
- Not observed: real phones (ticket 09); real multi-touch (only mouse drags and scripted PointerEvents). The headless Host and middle tabs painted at ~29 fps, the last tab at ~58.

**Deviations / notes for later tickets**
- A Peer's `runMatch` sends every frame with no `to`, and the platform delivers it to the Host. `MatchInfo` does not name the Host, and the pwa already routes Peer frames to `roster()[0]`. The SDK test harness now does the same: before this, core would have relayed a Peer's broadcast to every Peer.
- `createTestMatch` is async (`await createTestMatch(...)`, `await t.tick/input/stop`), because the in-process link delivers on microtasks. Its `input` takes `(deviceId, phase, at, pointerId?)`.
- Publish after `end` is dropped game-side, silently. Ticket 07 adds the log line and decides whether a `reject` is still meaningful: the runtime closes the host link on `end`.
- For 06:
  - The host runtime's per-Device open-pointer set (in `match.ts`) is where the synthetic `cancel`s on pause/drop/close go. Pause must also clear the inbox and drop ingest.
  - Pong needs `onResume() { ctx.publish(snapshot()) }`.
  - The paint loop flushes input before `draw`. If pause stops `draw`, keep the on-demand flush frame: it already runs without a paint loop.
- For 07: the result card shows only when a Match has a result. Other close reasons appear in the Host line ("Last match: <reason>"), and Peers show nothing yet.
- For 08:
  - Ingest leaves `playerId` unset; stamp it there from the holder map.
  - The view echo leaves it unset too; add `holder()`.
  - Controller px → screen mm is already in the capture.
  - `NetUp` gains `send` next to `input`. Extend `isNetUp`, the view-link branch and `deliver`.
- Pong keeps only Layout order (west = `tiles[0]`, `players[0]`), as the lobby seats them. With phones of different heights the table is the Layout bounds, so the ball and paddles can leave a shorter phone's screen. That is per spec (bounce off the Layout bounds), and it is unchanged.
