# 06: Pause and resume across Device loss

**What to build:** When any phone in the Match drops, every phone pauses with an overlay naming the missing Device; when it reconnects as the same Device, the Match resumes exactly where it stopped, after the host has re-sent the current state. Nobody plays into a frozen opponent and nothing restarts.

The pwa calls `setPaused({ kind: 'device-lost', deviceId })` on the Session's `onDeviceLost` and `setPaused(null)` on `onDeviceBack`. The host runtime broadcasts `pause` (with `now`) to its host game, every view, and over the net; stops the accumulator and clears it; drops inbound input; emits synthetic `cancel`s for every open pointer; suppresses `draw` on paused views; freezes pending timers with their remaining delay. On resume it sends `resume` with a fresh clock frame, re-posts the retained broadcast and per-Device states to every view before the first tick, then resumes ticking. Hosts and views receive `onPause(reason)` / `onResume(now)`; a game that ignores both is still correct. The pwa overlay shows the pause reason and clears on resume.

**Blocked by:** 05 (Playable Pong: input, scoring, end)

**Status:** ready-for-agent

- [x] E2E: disconnecting a Peer from the in-memory hub pauses the host game and all four views (each sees `onPause` with that Device's id); no `tick` and no `state` arrives while paused, even as fake time advances
- [x] E2E: a touch held down at the moment of pause produces a synthetic `cancel` at the host; input sent while paused is dropped
- [x] E2E: reconnecting with the same `deviceId` under a new peer id → `onResume` everywhere, every view receives the retained state *before* the next tick's state, the Peer's inputs after resume arrive on the new connection
- [x] E2E: a `publish` made while paused is retained and is what views receive on resume
- [x] Pong: `onResume` re-publishes; the ball continues from its paused position, not from a serve
- [x] Smoke (two tabs): close the Peer tab mid-rally → Host overlay "waiting for <name>", ball frozen; reopen the join URL → both resume mid-rally
- [x] Typecheck and suite green

## Comments

### 2026-11-07

**Changed**
- `packages/sdk/src/wire.ts`:
  - `Shared` gains `pause { reason, now }` and `resume { now, clock }`.
  - `NetDown` = `state | pause | resume | close`.
  - `isNetDown` validates both new frames: the `PauseReason` shape, a finite `now`, and a `ClockWire` with finite fields.
- `packages/sdk/src/game.ts`:
  - `HostHandlers.onPause(reason)` / `onResume(now)`.
  - `ViewHandlers.onPause` / `onResume`.
  - The `publish`, `tick`, `onInput` and `draw` docs now say what a pause does to them.
- `packages/sdk/src/game-side.ts`:
  - A `resume` re-anchors the game-side clock before any handler runs.
  - Host side: `onPause`/`onResume` are guarded and not run after `end`.
  - View side: `pause` stops the paint loop (the canvas keeps its last frame) and then calls `onPause`. `resume` calls `onResume` and restarts the loop. Capture and the on-demand flush frame keep running, so input is still sent.
- `packages/sdk/src/match.ts`:
  - `MatchEvent` gains `paused { reason }` and `resumed`.
  - Retention is one insertion-ordered map: the last broadcast state plus the last state per Device. A Peer holds its own two; the Host holds every Device's.
  - `setPaused(reason)` (Host only, a no-op on a Peer), when not paused:
    - cancels the rAF (this clears the accumulator);
    - drops the inbox;
    - posts one `input` frame of synthetic `cancel`s for every pointer the host game holds open (tracked at delivery, so a `down` still in the inbox gets none and a delivered `down` whose `up` was in the inbox does), each at the pause's `now` and its last `world`;
    - closes every pointer at ingest;
    - then sends `pause` to the host game, its own view and the net, and reports `paused`.
  - `setPaused` with the same reason does nothing. With a new reason while paused, it sends `pause` again with that reason and the original `now`.
  - While paused:
    - ingest drops all input;
    - `publish` only updates retention;
    - a link that opens gets `init`, then the retained states, then `pause`.
  - `setPaused(null)`:
    - sends `resume` with a fresh `ClockWire` to the host game first;
    - then gives each Device its retained states in arrival order (its own view directly, a Peer over the net addressed to it);
    - then sends `resume` to its view and the net, and reports `resumed`;
    - restarts steps from the resume's `now`, so there is no catch-up for the paused time.
  - A Peer's runtime applies a `pause` and passes a `resume` to its view with its own clock frame. It does that even when it never paused (a page that started during the pause).
- `packages/sdk/src/testing.ts`: `TestMatch.setPaused(reason | null)` (the Host platform's call) and `TestMatch.latest(id)` (state plus host time).
- `packages/sdk/test/harness.ts`:
  - Peer ids are now per connection.
  - `Rig.drop(id)`: the Peer's `runMatch` stops and its connection leaves the hub. It returns the old record, whose Session can still send from the stale peer id.
  - `Rig.rejoin(id)`: a new Session under a new peer id with the same `deviceId`; once it is ready, a new `runMatch` on a fresh screen.
  - The Host gets the app's pause policy.
  - The probe records host `onPause`/`onResume` (`rec.pauses`, with the ticks and inputs before each), and views record `{ pause }` / `{ resume }` in `seen`.
- `packages/sdk/test/pause.e2e.test.ts` (new), Host + 3 Peers, four tests:
  1. Dropping d1:
     - host `onPause(d1)` after 5 ticks;
     - views d0/d2/d3 each see `onPause(d1)` once, and their platforms get `paused`;
     - over 3 fake seconds there are no ticks, and no new states or draws on any view.
  2. Synthetic cancels and dropped input:
     - the Host's own finger 4 and d2's finger 1 (whose `up` sat in the inbox) get synthetic `cancel`s at the pause time and their last world mm, before `onPause`;
     - d2's finger 2, whose `down` was still in the inbox, gets no cancel;
     - while paused, d2 and d3 still send `input` frames and d2 echoes its move/up locally, but the host game gets nothing.
  3. Reconnect:
     - after the drop and 1 s paused, d1 rejoins as a new page;
     - the Host resumes only after that page started its `runMatch`, and the page never saw a pause;
     - the host gets `onResume` after 5 ticks, then ticks at resume + 20/40/60 ms;
     - d0 and d3 see `5, resume, 6, 7, 8`, d2 sees `2→d2, 5, resume, 6, 7, 8`, and the new d1 view sees `5, resume, 6, 7, 8`, all with the same resume `now`;
     - a touch on the new page arrives as d1's, while the same frame sent from the stale connection is dropped.
  4. `publish({n:99})` and `publish({n:98}, 'd3')` while paused:
     - no view receives either while paused;
     - on resume, d0/d2 get `99, resume, 4`, d3 gets `99, 98→d3, resume, 4`, and the new d1 gets `99, 4`.
- `games/pong/src/index.ts`:
  - The host's `onResume` re-publishes `snapshot()`.
  - The view's `onResume(now)` records the resume time, and `draw` extrapolates from `max(t, resumedAt)`. Without it, the retained pre-pause state would throw the ball up to 100 ms ahead for a frame.
- `games/pong/test/pong.test.ts`, new test:
  - pause mid-flight after 1 s;
  - a finger move while paused is dropped;
  - 3 s later both views still hold the paused state;
  - on resume both views' `latest()` is that state stamped with the resume time (the re-publish);
  - one step later the ball is at paused + v/60 with `wait` 0, the same score and the same paddles.
- `apps/pwa/src/pause.ts` (new):
  - `pauseOnDeviceLoss(session, match, handle)`: the Host's policy (see Deviations).
  - `describePause(match, reason, seated)`: "Waiting for Bo" / "Phone 2 lost its connection · the match goes on when it is back", or "Waiting for phone N" when no Player sits there.
- `apps/pwa/src/main.ts`:
  - `begin` snapshots Device → Player name from the lobby seats, turns `paused`/`resumed` into `play.paused`, and on the Host installs `pauseOnDeviceLoss` (removed on `closed`).
  - A Device begins a Match only once its Session is `ready`; `session.onChange` now also re-checks.
  - A Peer whose Session went `searching` stops with `link-lost` and clears `joined`, so it rejoins the same Match when the Session finds the Host again.
- `apps/pwa/src/hud.ts`:
  - `Play.paused`.
  - A `.pause` notice over the Game on every Device while paused.
  - The Host bar reads "Pong · paused".
- `apps/pwa/index.html`: `.pause` shares the result card's look and has `pointer-events: none`.
- `apps/pwa/test/pause.test.ts` (new, 2 tests):
  1. The policy over `MemoryHub`:
     - a non-Match Device leaving does nothing;
     - losing d1, then d2, gives one `setPaused(d1)`;
     - d1 back but unsynced keeps it paused; d1 synced switches to `setPaused(d2)`; d2 back and synced gives `setPaused(null)`;
     - nothing after unsubscribe.
  2. `describePause` texts.
- `packages/core/src/trystero-transport.ts`: `send` swallows the action's rejection. Main approved this out-of-scope one-liner. A send to a dying channel was an unhandled rejection, a Host pageerror "Trystero: data channel stopped draining" in the first smoke run.
- Docs:
  - `docs/sdk-design.md`:
    - §2: the pause rules for game authors;
    - §3: `setPaused` semantics and events;
    - §4: the Peer re-stamps the `resume` clock;
    - §5: as shipped, the cancels, the retention and resume order, a fresh accumulator, and the paint loop while paused;
    - §6: the Pong view note, and the pwa call site with the reason resume waits for sync;
    - §8: `pause.e2e.test.ts` and the new `TestMatch` methods.
  - `docs/platform-design.md` §5: pause, overlay, rejoin, and the pause test.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pwa).
- `pnpm test`: 10 files, 46 tests passed.
  - sdk: 9 match E2E, 4 pause E2E, 3 seam.
  - pong: 6.
  - pwa: lobby 3, result 2, pause 2.
  - core: 8. layout: 9.
- Smoke: `pnpm dev` on :5174, headless managed Chromium, two 420×860 tabs over real Trystero, players renamed Ann/Bo. Ball positions were logged by wrapping `arc` (r 3.5) and scores by wrapping `fillText`. Rallies were kept alive by in-page bots dispatching PointerEvents that track the ball.
  - **Run 1** (before the core fix):
    - Mid-rally I closed the Peer tab. The Host showed "Waiting for Bo / Phone 2 lost its connection · the match goes on when it is back", and its bar read "Pong · paused".
    - The Host drew no ball for 3 s, frozen at (70.71, 62.00) mm. The screenshot shows the ball, the paddle and the notice.
    - I reopened the join URL. The new tab reclaimed the same `deviceId` (8729c51b…), and the Host resumed 2.3 s after the reopen.
    - Both tabs drew on from the paused spot: Host 70.86, new Peer 71.87 → 76.6 → 82.3 mm …. The fastest frame-to-frame motion afterwards was 344 / 409 mm/s, which is frame-timing noise at the 320 mm/s cap with no jump.
    - This run had the one Trystero pageerror above.
  - Run 2 was not a test: Start was refused with "Phone 2 is still joining".
  - **Run 3**, after the core fix:
    - The pause came after Trystero's leave (10.2 s), with the notice and 0 draws while paused. The reopened tab had the same `deviceId`, and the Host resumed 2.3 s after the reopen.
    - Both tabs continued from the frozen 106.41 mm (Host 106.56, Peer 106.37). No page errors in either tab.
    - Later this Match ended "Bo wins · Bo 7 · Ann 2" (see the held-finger note below).
  - **Run 4:**
    - The score at the pause was 6:1, with the ball frozen at (197.04, 94.08). I reopened, and it resumed 2.2 s later.
    - The first draws after the resume were Host 196.79, Peer 196.81, and the score stayed 6:1 on both. The fastest motion was 157 / 163 mm/s.
    - The ball went on east, Bo's re-installed bot was too late, Ann scored her 7th, and both tabs went to the lobby with "Ann wins · Ann 7 · Bo 1". No page errors in either tab.
- Not observed:
  - Real phones (ticket 09).
  - A Peer's network blip with the page surviving: the rejoin-after-`searching` path in `main.ts` is untested, and only the tab-reopen path was smoked.
  - The overlay on a third phone while another one is lost: only two tabs were run. The SDK E2E covers Peers d2/d3 getting `pause`.
  - Real multi-touch.

**Deviations / notes for later tickets**
- Checkbox 1, "all four views" (Main chose option A): the dropped Peer's own view cannot hear the Host. MemoryHub does not even notify it, and in the pwa its Session goes `searching` and its `runMatch` stops. So the test asserts `onPause(d1)` on the host game and the three connected views (d0, d2, d3); the dropped page is treated as gone. Its replacement page gets the retained state and `onResume` (test 3), without an `onPause`. There is no Peer-local pause.
- The pwa does not call `setPaused(null)` on the bare `onDeviceBack` (Main approved). `pauseOnDeviceLoss` resumes once every lost Match Device is present *and* synced, on the `onChange` that reports it. The reasons:
  - A reopened page starts `runMatch` only at `ready`. Before that its clock is not the Host's: the slew is capped at 2 %, so a wrong anchor would last.
  - `ready` comes after the Host's `onDeviceBack`. Resuming at back would send the retained state and `resume` to a page with no `runMatch`, and the Host would play on against a blank phone.
  - With the gate, the new page is running when they arrive (ordered channel: lobby state at bind, then the clock pings, then the synced report).
  - The SDK harness mirrors the policy.
  - With several Devices lost, the pause names the first one still missing (a re-`pause` with the new reason).
- A finger held across a pause is cancelled at the host. Its later moves are orphans until it lifts and touches again. That follows §5 (no teleport on resume). In run 3 this froze the Host bot's paddle after the resume: the bot kept sending `move` and never re-sent `down`, and Bo won 7:2. In run 4 both bots were re-installed, which is a re-touch. Real Players re-touch, but ticket 09 should watch whether this surprises anyone on phones.
- Trystero reported the closed tab's leave only after 10.2–12.8 s (three runs), so the Host keeps playing that long before pausing. This is an observation for ticket 09; nothing here changes it.
- The synthetic cancels on close are not done here (ticket 07); the cancel helper in `match.ts` (`cancelPointers`) is the one to call. A Device drop always becomes a pause in the pwa.
- For 07:
  - pause/resume add no new close paths;
  - a `fault` while paused is reported as before;
  - `stop` while paused closes normally;
  - `isNetDown` rejects malformed pause/resume frames, which are then ignored like any non-NetDown frame.
- For 08:
  - Timers freeze/thaw where `pause()` / `resume()` in `match.ts` stop and restart the steps: hold the remaining delay at `pausedBy.now` and re-arm from the resume's `now`. `HostDown.timer` frames must not be posted while `pausedBy` is set.
  - `msg` ingest should follow input ingest: dropped while paused.
  - `holders` sent while paused should reach views as normal frames.
  - A view that opens while paused gets `init`, the retained states, then `pause`; `holders` would go after `init` there.
