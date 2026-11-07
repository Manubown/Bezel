# 03: Pong: touch presence — a needed Player must keep touching

**What to build:** Transport-level leave detection takes 10–13 s, so a Player whose phone has silently gone (or who has walked away) leaves the other side playing into nothing. Pong enforces presence softly through touch: a human Player's side is *present* while a pointer is down on their Tile or their last touch is less than `PONG.presence.holdMs` (5000) old. When a needed human side is not present the host holds play: the ball freezes where it is (serve wait does not run), paddles still follow input, and every Tile draws "<name>, touch your screen" naming the missing Player(s). Play continues the moment that Player touches again. The first serve of the Match waits until every human side has touched once ("touch to start"). Bots are always present. This is Pong-only game logic; the pwa's device-lost pause is unchanged and still applies.

**Blocked by:** 02 (Pong: sides from seats, bot opponent, one-Tile play)

**Status:** resolved

- [x] `PongState` carries the hold (which sides are missing); views draw the overlay from state, nothing else
- [x] Pong test: before any touch the ball does not serve; after both humans touch it serves
- [x] Pong test: a human lifts the finger; 4.9 s later play continues, at 5.1 s the state holds that side and the ball's position stops changing; a `down` from that Device's Tile releases the hold on the next tick and the ball continues from where it stopped (no re-serve)
- [x] Pong test: a bot side never causes a hold; with one human and a bot only the human is required
- [x] Pong test: paddles still follow input while held; a point is never scored while held
- [x] Smoke (two tabs): lift the pointer on one tab → ~5 s later both tabs show "<name>, touch your screen" and the ball is frozen; touch again → play resumes mid-rally
- [x] Typecheck and suite green

## Comments

### 2026-11-07

**Changed**
- `games/pong/src/index.ts`:
  - `PONG.presence = { holdMs: 5000 }`, next to `PONG.bot`, documented there.
  - `PongState` gains two fields:
    - `hold: (0 | 1)[]`: the human sides play waits for, west first. It is empty while play runs, and a bot's side is never in it.
    - `started: boolean`: false until play first runs, so a view can tell the first serve's "touch to start" from a later hold.
  - Host:
    - `humans` are the sides that have a finger Device (`fingers[s]`).
    - `onInput` already drops input from a Device that seats no side. For a seated side it now stamps every sample (`down`/`move`/`up`/`cancel`) as that side's last touch, `touched[s] = ctx.now()`. It also tracks the side's open pointers: a `down` adds its `pointerId`, an `up` or `cancel` removes it. Paddles follow input as before.
    - `tick(dt, now)`: the bots move first, unchanged. Then `hold` lists the human sides with no pointer down and `now - touched[s] >= holdMs` (never touched counts as `-Infinity`). While `hold` is non-empty the host publishes and returns, so the ball does not move, `wait` does not count down and nothing scores. Otherwise `started = true` and the step runs as before. A touch therefore lets play on at the next step, from the ball as it stood.
    - `snapshot()` carries `hold` and `started`. `onResume` is unchanged.
  - View:
    - While `hold` is non-empty the ball is not extrapolated (`moving = 0`). Only the `moving` line changed.
    - Hold overlay, after the ball, drawn on every Tile: a shaded band (`SHADE`, black at 0.6) at `T.mid.y - 30`. On it, one 5 mm line per listed side: "<name>, touch your screen", or "<name>, touch to start" while `!started`. `fillText`'s maxWidth is the Tile's width minus 6 mm. Names come from `seats(ctx.match)`, now kept as `sides`; the "BOT" label reads `bots` from it.
    - `table()` and the score/"BOT" text lines are untouched.
  - Doc comments on `PongState` and the game updated.
- `games/pong/test/pong.test.ts`:
  - Adapted: the pause test adds an east `down` (`finger(t, TWO, 'd1')(100)`) so play starts. No other test changed. `play()` already puts fingers down from its second step, so those tests start one step later and pass as they were.
  - New helper `boLifts(t, ms)`: both Players track the ball for `ms`, then Bo's pointer goes `up`. It returns the lift time.
  - Four new tests, one per box:
    1. **Touch to start.** On three Tiles, after 3 s with nobody touching, the ball sits at the centre with `wait = serveWait` and `started: false`. `hold` is `[0, 1]` on all three views. A tap on the middle Tile changes nothing. Ann's tap leaves `hold` at `[1]`, with her paddle at 40 and the ball unserved. Bo's `down` 1 s later: on the next step `hold` is `[]`, `started` is true and `wait` is `serveWait - 1/60`. After the rest, the ball has left the centre.
    2. **Lift.**
       - `boLifts(t, 1000)`, then Ann tracks. Through 4.9 s after the lift, `hold` stays empty and the ball still moves at 4.9 s.
       - At 5.1 s, `hold` is `[1]` on both views with `wait` 0. The ball moved up to the step that held, then stayed at that position for that step and every step of one more second. The score did not change.
       - Bo's `down`: on the next step `hold` is `[]`, `vx`/`vy` are unchanged, x/y are the frozen position plus one step of velocity, and score and `wait` (0) are unchanged. There was no re-serve.
    3. **Bots.**
       - Ann plus a bot: `hold` is `[0]` before her touch, and a finger on the bot's Tile does not release it. Once Ann tracks, 20 s pass with no hold, and the bot returns her shots.
       - Ann lifts: over the next 7 s `hold` is only ever `[]` or `[0]`, and the bot's paddle ends settled.
       - A bot west with Bo gives `hold` `[1]`. One Tile with Ann and a bot gives `[0]`, which Ann's `down` releases on the next step.
    4. **While held.** `boLifts(t, 2400)` holds with the ball already past Bo's face, moving east (`x > CONTACT[1]`). For 600 steps (10 s), Ann's `move`s sweep her paddle. Each step, `pads` is `[her y, Bo's frozen y]`, and ball, score and `hold` are unchanged. Bo's `down` then releases, and Ann scores within 10 steps.
- `docs/sdk-design.md` §6: one paragraph after the Pong notes on touch presence. It covers:
  - the presence rule, on the host's clock;
  - `hold`/`started` in the state and the hold in `tick`: ball frozen, rest frozen, no scoring, paddles and bot live;
  - the touch-to-start first serve and release on the next step with no re-serve;
  - the view: no extrapolation while held, plus the overlay text;
  - how the device-lost pause's synthetic `cancel`s interact with presence.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pass, pwa).
- `pnpm test`: 14 files, 85 tests passed. Pong's `pong.test.ts` has 15 (11 + 4 new). The suite was 80 in 13 files.
  - The 14th file is `games/pong/test/table.test.ts` (1 test), Main's file for ticket 04, which was meant to be red. In this run it passed only because its fingers never sent a `down` that landed: at `k === 0` there was no state yet. So under presence it never served.
  - I reported this to Main, who has since fixed that test on their side. I did not re-run the suite after their fix.
- Throwaway headless checks (deleted):
  - **Lift timing.** I swept the lift moment to choose 1000 ms / 2400 ms, which catch the ball in flight at 5.1 s. A hold comes on the first step at least 5000 ms after the `up` reached the host game.
  - **Pause.** With both pointers down, a 3 s device-lost pause resumed into play (`hold []`). An 8 s pause resumed into `hold [0, 1]`.
- Smoke setup:
  - `pnpm dev --port 5189 --host 127.0.0.1 --strictPort` (https), headless managed Chromium, two 420×860 tabs, real Trystero, room UM3A. The Host is Ann (first phone); the Peer joined with `?room=UM3A` and is Bo. The names were filled into the HUD's Player name fields, then a trusted click on "Start Pong".
  - Reading the canvas: an init script wrapped `CanvasRenderingContext2D.prototype` on non-stage canvases:
    - `arc` with r 3.5 gives the ball's world position and, through `getTransform()`, its client y;
    - `fillText` gives the texts drawn in the last 250 ms;
    - `fillRect` 4×30 gives the paddles.
  - Input: trusted `page.mouse` down/move/up, tracking the ball's client y about every 25 ms. Each tab sampled itself inside its own `tab.run` about every 150 ms (one call per tab at a time), and samples were aligned by `Date.now()`.
- **Start.**
  - Before any touch, both tabs drew "Ann, touch to start" and "Bo, touch to start", with the ball ringed at the centre (113.111, 113.757).
  - After the Host's mouse went down, both drew only "Bo, touch to start". The Peer took 6 samples over 1.2 s, with the ball at the centre.
  - After the Peer touched, play ran.
- **Lift / hold / resume.** Three cycles. The Peer tracked for 7 s, 4 s and 4 s, then mouse up, 7.5 s with no input, then mouse down and tracking again. The Host tracked throughout.
  - Overlay: "Bo, touch your screen" first appeared in the Peer's samples at +5176, +5173 and +5171 ms after the lift, and in the Host's at +5116, +5115 and +5231 ms.
  - Until then play went on: each cycle had 34 distinct ball positions in the Peer's samples up to +5.02 s.
  - Held:
    - The ball sat at one position on both tabs, the same on each, over 16 Peer and 15 Host samples (about 2.3 s).
    - The three positions were (200.008, 90.819), (87.668, 90.413) and (81.558, 91.958): mid-rally, not the centre.
    - The score stayed 0:0.
  - Touch again:
    - The samples 10–62 ms after the mouse down still showed the frozen position.
    - By 95–104 ms the ball had moved on in its old direction, for example 200.008 → 175.001 → 159.276 → … west, and on the Host 200.008 → 159.835 → 109.52.
    - The score did not change and the ball never went back to the centre: no re-serve.
    - The overlay left the samples after about 270–315 ms; the sampler counts the last 250 ms of drawing.
- **Afterwards.** Both runs ended with the Peer's mouse up and the Host's down but still. Bo's still paddle missed twice (2:0), then the hold caught the ball resting at the centre.
  - Screenshots of both tabs show the shaded band "Bo, touch your screen" on each Tile: `%TEMP%\omp-sshots-15c4e47513ed9149.png` (Host) and `%TEMP%\omp-sshots-15c4e4756c42c8d1.png` (Peer).
  - No page errors, and no warnings or faults in either console.
- Not observed:
  - Real phones, or three or more tabs (the overlay on a middle Tile).
  - One human plus a bot in the browser (test 3 covers it).
  - The device-lost pause together with presence in the browser (only the throwaway headless check).
  - A screenshot of "touch to start"; it was read from the canvas text only.

**Deviations / notes**
- **`started` next to `hold`.** The state needs it to tell "touch to start" from "touch your screen". Before the first serve, if one human's touch lapses (more than 5 s old) before the other has touched, they are asked again with "touch to start".
- **Clock.** A touch is stamped when it reaches the host game (`ctx.now()`) and compared with the step's `now`. Inputs are handed over at the drain before a step, so a hold starts at the first step at least 5000 ms after the touch arrived. That is inside the tests' 4.9/5.1 s window, and about 5.1–5.2 s after the lift in the smoke.
- **`cancel` is a touch.** The pointer was on the screen until then. So the platform's synthetic `cancel`s at a device-lost pause start the 5 s. After a pause longer than that, play holds on resume until each human touches. Their pointers were cancelled anyway, and their later `move`s are dropped as orphans until a new `down`.
- **A pointer that stays down is present indefinitely.** This holds even if its Device vanished mid-touch, because the host never gets an `up`. The platform's device-lost pause and its synthetic `cancel` end it. This follows the spec's "a pointer down … counts as present".
- **Required sides are those with a finger Device.** Bots have none, so they never hold play. A human Player without `deviceId` cannot hold play forever either; the lobby never produces one.
- **Bot while held.** Bots still move at the top of `tick`, before the hold. In a mid-rally hold the bot settles on its goal for the frozen ball. In the start hold the ball is resting, so the bot waits centred.
- **View.**
  - Extrapolation is off while held. Otherwise a Peer would draw the frozen ball up to 100 ms ahead of where it stopped, a little differently in every frame.
  - The overlay's vertical reference is `T.mid.y`, not `bounds.y`, per Main, so it follows ticket 04's table-band change.
  - The shaded band dims a paddle where it crosses one, and long names are condensed by `fillText`'s maxWidth.
- **Port.** The dev server ran on 5189 for this smoke.
