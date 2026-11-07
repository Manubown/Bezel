# 07: Fault isolation and the close ladder

**What to build:** A bug in a game never crashes the platform. A thrown handler is logged and play continues; a game that keeps throwing, fails to start, or speaks the wrong protocol version closes the Match with a named reason and the phones return to the lobby. Game authors get a `log` that reaches the Host's console and HUD so they can debug on a phone. The screen stays awake during a Match and the draw loop stops when the tab is hidden.

Game-side, every handler call is wrapped: a throw becomes a `fault` frame (`where`, `message`, `stack`) and the pwa receives a `fault` event. Close ladder: `ready.v` ≠ wire version → `close{'version'}`; unknown or out-of-order frame → `close{'protocol'}`; a throw in a factory, or more than three faults in five seconds → `close{'fault'}`; no `ready` within five seconds of opening the link → `close{'link-lost'}`. A throw in `draw` skips the frame; ten consecutive close that view. Bad `setHolder`/`timer` arguments and `publish` after `end` produce a `reject` frame and a log line, state unchanged. `ctx.log(...)` on either side becomes a `log` frame and a `log` event. Every close reaches the pwa as a `closed` event with reason and detail; no exception crosses `runMatch`'s interface. The pwa shows the reason in the overlay and returns to the lobby; it requests a wake lock on the first touch of a Match and the SDK stops `draw` while `document.hidden`.

**Blocked by:** 04 (First Match on phones: Lobby Start runs a Game on every Device)

**Status:** ready-for-agent

- [x] E2E: a probe host whose `tick` throws once produces exactly one `fault` event and the next tick still runs; four throws within five fake seconds produce `closed{ reason: 'fault' }` on the Host and `onEnd` on every view
- [x] E2E: a view factory that throws closes only that view with `closed{'fault'}`; the Host and other views continue
- [x] E2E: a game whose `ready` carries a different wire version is closed with `'version'` before `init`; an out-of-order frame injected into the link closes with `'protocol'`
- [x] E2E: a link whose game never sends `ready` closes with `'link-lost'` after five fake seconds
- [x] E2E: `publish` after `end` yields a `reject`/log and no state; `ctx.log('x')` from a view arrives as a `log` event on that Device's pwa
- [x] Unit: ten consecutive `draw` throws stop the loop for that view; nine do not
- [x] Smoke: a deliberately throwing tracer handler shows the fault in the Host HUD while Pong keeps running; hiding the tab stops the draw loop (no animation-frame callbacks while hidden)
- [x] Typecheck and suite green

## Comments

### 2026-11-07

**Changed**
- `packages/sdk/src/wire.ts`:
  - `close` gains `detail?: string` (why, in words). It crosses the net, so a Peer shows the Host's detail; `isNetDown` checks it is a string.
  - `Fault` gains `fatal?: true`: the game side cannot go on (factory threw, or `draw` threw on 10 frames in a row) and the platform closes that link.
  - `Log { v, t: 'log', args: JsonValue[] }` in `HostUp` and `ViewUp`.
  - `HostDown.reject { of: RejectOf, reason }`, with `RejectOf = 'publish' | 'set-holder' | 'timer' | 'end'`.
  - `isReport` validates `fault`/`log` frames from a game side.
  - `Log`/`RejectOf` are exported from the index.
- `packages/sdk/src/env.ts`: `Env.after(ms, fn)`, a one-shot timer. `createTestMatch`'s fake env implements it.
- `packages/sdk/src/game.ts`: `HostContext.log` and `ViewContext.log`. The docs now cover faults, `end`, and `draw` while hidden.
- `packages/sdk/src/game-side.ts`:
  - `guard(where, run, fatal?)` returns whether `run` returned. `attempt(run)` runs game code with posts held and returns the error.
  - A factory that throws, or returns a non-object, sends a fatal fault, and that side does nothing more.
  - `ctx.log(...args)` never throws. JSON stays as it is, an `Error` becomes its stack, and anything else becomes `String(x)`.
  - The host's `publish`/`end` after `end` still go out, so the host runtime can reject them. Handlers still stop at `end`. `reject` is accepted and changes nothing game-side.
  - The paint loop runs only while not paused, not closed and not `document.hidden`. It follows `visibilitychange`, and a frame that finds the page hidden requests no more.
  - A `draw` throw skips the frame. Only the first throw of a run is reported. On the tenth in a row the loop stops for good and a fatal `view.draw` fault goes out ("… (threw on 10 frames in a row)"). `DRAW_FAULTS_TO_CLOSE = 10`.
- `packages/sdk/src/match.ts`:
  - `MatchEvent`:
    - `closed.detail` is now always set;
    - new `view-closed { reason, detail }` (Host only);
    - `fault` carries `stack`;
    - new `log { side, args: JsonValue[] }`.
  - `GameLink` holds the close ladder per link:
    - `READY_TIMEOUT_MS = 5000` from the factory call (`Env.after`). A factory that throws or rejects is `link-lost`.
    - Wrong-side `ready` or any other first frame → `protocol`. `ready.v ≠ 1` → `version`; no `close` frame goes out, so there is no `init`.
    - After `ready`: `v ≠ 1`, a second `ready`, a non-object frame, or a malformed `fault`/`log` → `protocol`.
    - `fault`/`log` become events.
    - A fatal fault → `fault` (`"<where>: <message>"`). More than `FAULT_LIMIT = 3` faults within `FAULT_WINDOW_MS = 5000` (monotonic clock) → `fault` (`"4 faults within 5 s, the last <where>: <message>"`).
  - A host-link failure closes the Match. A view-link failure is `failView`:
    - on a Peer it closes its part (`closed`);
    - on the Host only the view closes: its pointers are cancelled at the host game, `view-closed` is reported, and `started` still fires once the host link is open.
  - `end` sets `ending` and closes on a microtask. A `publish`/`end` the host game posted in the same turn gets `reject` plus `log { side: 'host', args: ['publish rejected: the Match has ended'] }` before `ended`/`closed`.
  - `close(reason, detail, result?)` sends synthetic `cancel`s for every held pointer to the host game, then the `close` frame (with `detail`), then net/events. `stop` details: `"stopped by the platform"` / `"the platform lost the connection"`. A Peer uses the frame's `detail`, or `"closed by the Host"`.
  - `cancelPointers(t, only?)`.
- `packages/sdk/src/headless.ts`: the document has `hidden` and `visibilitychange` listeners, plus `HeadlessScreen.setHidden(hidden)`.
- `packages/sdk/test/harness.ts`:
  - The probe takes `view` (runs first in each view factory, may throw) and `draw` as a function (called after recording, may throw).
  - `startMatch({ link: (id, base) => LinkFactory })`.
  - `tapLink(base, up?)` records what the platform posts per side, rewrites or swallows what a game sends, and `inject(side, frame)`s.
  - `eventsOf(events, t)`.
- `packages/sdk/test/faults.e2e.test.ts` (new), Host + 3 Peers, 11 tests:
  1. Tick throws on 3/40/80/120. One fault (with stack) after tick 3; tick 4 runs and every view gets 1, 2, 4. Three faults give no close. The fourth gives `closed{fault, "4 faults within 5 s, the last host.tick: probe: tick 120"}` on all four Devices, `onEnd{fault}` on every view, empty mounts, and no more ticks.
  2. One fault every 2 s for 10 s: five faults, never a close.
  3. d2's view factory throws: d2 `[started, fault(view.factory), closed{fault}]` with an empty mount; d0/d1/d3 only `started` and states 1–3.
  4. The Host's own view factory throws: `[started, fault, view-closed{fault}]` and an empty Host mount; the Peers get states 1–3 and no close.
  5. The host link's `ready` rewritten to `v: 2`: the Host gets `closed{version, "host link: the game speaks wire v2, the platform v1"}`; nothing was posted on the host link (no `init`); the host factory never ran; no tick. The Peers get `closed{version}`, and all four views `onEnd{version}`.
  6. A second `ready` injected on d1's view link → d1 `closed{protocol, "view link: unexpected ready"}` while the rest keep ticking. Then `{t:'bogus'}` on the host link → `closed{protocol}` on the Host, d2 and d3, with `onEnd`.
  7. d2's `ready` swallowed: nothing at 4.999 s, `closed{link-lost, "view link: no ready within 5 s"}` at 5 s, and the others keep going.
  8. The host link's `ready` swallowed → the Match closes `link-lost` everywhere at 5 s.
  9. `end(r); publish({n:99}); end({})` in one tick:
     - Host events are `started, log("publish rejected: the Match has ended"), log("end rejected: the Match has already ended"), ended, closed`.
     - The host link's last frames are `reject{publish}`, `reject{end}`, `close{ended, detail, result}`.
     - Every view has states 1, 2 only.
  10. `ctx.log('x')` on d2's view gives `log{view, ['x']}` on d2 only. Non-JSON arguments (a Map, an Error, `undefined`, `NaN`, a function) arrive as text. The host's `ctx.log('host says', {n})` gives a Host `log{host}`.
  11. Fingers held on d0 and d2, then `stop('aborted')` → the host game gets `cancel`s at the stop time with their last world, and every Device gets `closed{aborted, "stopped by the platform"}`.
- `packages/sdk/test/game-seam.test.ts`, three new tests (Host alone):
  - nine `draw` throws in a row: one `fault`, 20 draws in 20 frames;
  - ten in a row: two faults (the second fatal) and `view-closed{fault, "view.draw: probe: draw 10 (threw on 10 frames in a row)"}`, 10 draws, an empty mount, and 20 ticks;
  - hidden: 3 draws, then none over 10 frames, then 2 more once visible.
- `packages/sdk/test/match.e2e.test.ts`: the end test expects `closed.detail`.
- `apps/pwa`:
  - `result.ts` `describeClose(reason, detail)`: "The game crashed" / "Game version mismatch" / "The game broke the protocol" / "Connection lost" with the runtime's detail; "Match stopped · Ended from the host phone".
  - `gamelog.ts` (new): `logLineOf(event)` for `fault`/`log`/`view-closed`/`closed`; `LOG_LINES = 50`.
  - `wake.ts` (new) `keepAwakeOnTouch()` requests the wake lock on a Match's first touch, again after the system dropped it, and releases on close. It replaces the page-wide `keepAwakeOnFirstTap`.
  - `hud.ts`:
    - `Play.stopped` and `Play.log`; `LastMatch.detail`.
    - The result card is now the close card on every phone, for every close.
    - The pause card also shows `stopped`.
    - Host sheet: a game log list (newest first), the newest line on the folded bar while a Match runs, and "· N faults" in the bar meta. The "Last match:" line uses the close words.
  - `main.ts`: `fault` (with stack) and `log` go to the console; every event line goes into `play.log`, with log-driven renders coalesced to one per animation frame; `view-closed` → `play.stopped`; `closed` releases the wake lock and keeps `detail`.
  - `metronome.ts`: the stage loop requests no frames while hidden (see Deviations).
  - `index.html`: `.bar-log`/`.log` styles.
  - `test/result.test.ts`: two new tests (close texts, log lines).
- Docs:
  - `docs/sdk-design.md`:
    - §2: the fault, log and `end` rules for authors;
    - §3: `MatchEvent` as shipped, plus a fault-isolation paragraph;
    - §4: `close.detail`, `Fault.fatal`, and the flows for close/fault/log/reject;
    - §5: the ordering note on cancels at close, the Errors ladder as shipped, and a new **Hidden** bullet;
    - §6: the pwa handling;
    - §8: the new tests.
  - `docs/platform-design.md` §5: "Faults and closes (M2 07)" (close card, game log, the Host's own view, wake lock).

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pwa).
- `pnpm test`: 11 files, 62 tests passed.
  - sdk: 9 match E2E, 4 pause E2E, 11 faults E2E, 6 seam.
  - pong: 6.
  - pwa: lobby 3, result 4, pause 2.
  - core: 8. layout: 9.
- Smoke: `vite` on :5174 (HTTPS), headless managed Chromium, two 420×860 tabs (dpr 1.25) over real Trystero.
  - **The throwing handler.** The browser served both tabs a Pong module with two lines added, by intercepting its URL; nothing was added to the repo. The host's `tick` throws on every 240th tick (`window.__probeEvery`), and each view factory calls `ctx.log` once.
  - **Fault in the Host HUD while Pong runs.**
    - About 5 s in, the screenshot shows the folded bar reading "Pong · playing · 1 fault" and "fault · host.tick: smoke probe: deliberate tick fault at tick 240". The ball was being drawn and moving on both tabs (e.g. 42.51 → 40.26 mm).
    - Faults came at ticks 240/480/720/960. Each Match ran to its end: "Player 2 wins · 7 · 0", then "Player 1 wins · 7 · 2" after a trusted click on each tab.
    - The open sheet lists the faults, the view's log line and "match closed (ended): the game ended the Match" (screenshot).
    - The console has each fault with its stack.
  - **Hidden.** During play, the page was hidden by overriding `document.hidden`/`visibilityState` and dispatching `visibilitychange`. Animation-frame callbacks were counted by callback name over 2 s visible / 2 s hidden / 2 s visible again:
    - **Peer:** SDK `paint` 121 / 0 / 121; pwa stage loop 121 / 0 / 121. That is zero callbacks of any kind while hidden, and zero Game-canvas clears.
    - **Host:** `paint` 60 / 0 / 60; stage loop 60 / 0 / 60. The host's fixed-step loop `advance` went 60 / 3 / 60: the SDK does not stop stepping (a really hidden tab gets no animation frames from the browser).
    - The first Peer run, before the `metronome.ts` change, still had the stage loop at 120 while hidden.
  - **Wake lock.**
    - Nothing was requested before the first touch.
    - A trusted click on each tab's Game gave `request` → `granted` on both.
    - That Match's close (7:2) gave `release` on both.
    - A Match nobody touched requested nothing.
  - **Close reasons on every phone.**
    - "End match" → both tabs showed "Match stopped · Ended from the host phone" over the lobby (screenshot of the Peer).
    - With `__probeEvery = 20`, a new Match closed about 1.3 s in. Both tabs showed "The game crashed · 4 faults within 5 s, the last host.tick: smoke probe: deliberate tick fault at tick 80" and were back in the lobby. The Host's log showed four faults and the close (screenshots of both).
  - No page errors in either tab.
- Not observed:
  - real phones (ticket 09);
  - a really backgrounded tab (only the emulated `document.hidden` above);
  - the wake lock on a phone (headless Chromium granted it);
  - a Peer's own view failing, or the Host's own view failing, in a browser (E2E only);
  - the iframe adapter.

**Deviations / notes for later tickets**
- **New `view-closed` event.** The Host's own view failing must not close the Match ("Host + other views continue"). `closed` keeps its meaning: this Device's part is over, and nothing follows it. So the Host gets `view-closed { reason, detail }`, and the pwa shows "The game stopped on this phone · … · the match goes on for the others" while the Host keeps End match.
  - A Peer whose view fails gets `closed`, its card, and is not rejoined.
  - The Host never learns that a Peer's view closed: there is no NetUp for it. That Tile stays blank, and any pointer the Peer held stays open at the host game.
- **Wire additions** (additive, still v1): `close.detail`, `Fault.fatal`, `Log`, `reject`. Fatality is the game side's call, which keeps the platform from string-matching `where`. `closed.detail` became required.
- **`publish`/`end` after `end`.** The ticket 05 note asked whether a `reject` still means anything once the runtime closes the host link on `end`. It does, within the turn: the host runtime closes on a microtask after `end`, so the frames posted with it are answered first. Later ones are dropped silently, because the game side is closed by then.
  - The in-process link delivers a handler's frames in one batch. The M3 iframe adapter must post one message per flush to keep this.
  - The `log` line is the platform's own (`side: 'host'`). The game side ignores `reject`, so the line is not printed twice in-process.
- **`draw` faults.** Only the first throw of a run is reported, and each report counts toward the 3-in-5 s budget. A `draw` that throws on alternate frames is therefore closed by the budget, not by the 10-in-a-row rule.
- **Ready timer.** The 5 s run from the factory call, not from the link resolving, so a module that never loads is caught too.
- **Stage loop.** `apps/pwa/src/metronome.ts` was not named in the ticket. Without the change, a hidden Peer page still had the pwa's stage loop asking for frames, and the smoke's "no animation-frame callbacks while hidden" would not hold for the page. In real browsers it is a no-op.
- **`runMatch` throws** only on misuse: a Device that is not in the Match, or a mount outside a window. Everything a game does arrives as events.
- **For 08:**
  - `reject(of, reason)` in `match.ts` is the one path for refusals: it posts `reject` and emits the `log` line. `RejectOf` already has `set-holder`/`timer`. Frames that arrive during `ending` (`timer`, `set-holder`) should be rejected the same way as `publish`.
  - The host link's `frame` handler closes the Match with `protocol` on any `t` it does not know, so `set-holder`/`timer` must be added there. The view link takes only `isNetUp` frames, so `send` must be added to `isNetUp`.
  - The game side ignores `reject` (`HostSide.frame`). Keep `holderOf` unchanged on a reject.
  - `Env.after` is the one-shot timer, faked in `createTestMatch`, for pause-aware `timer`s.
  - `cancelPointers(t, only?)` covers a single Device.
  - The Host HUD game log shows every `ctx.log`. 08's smoke ("the Host HUD log shows the message with the Holder's name") needs only a `ctx.log` in `onMessage`.
