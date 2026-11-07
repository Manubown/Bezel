# 03: SDK runtime, verified end-to-end in memory

**What to build:** A game author can write `defineGame({ manifest, host, view })` and the platform can run it on a Host and several Peers with `runMatch`; every view, including the Host's own Tile, receives the host's published state on every tick and draws it in world millimetres. Proven by an end-to-end test with a Host and three Peers in one process over the in-memory transport — no phones, no DOM.

The new SDK package depends on the layout package only (core is a dev dependency for the test). It delivers: the shared data types (`MatchInfo`, `Device`, `Tile`, `Player`, `Manifest`, `MatchResult`); `defineGame` with host and view factories whose return values are the handler records; host context `match`, `now()`, `publish(state, to?)`, `end`; view context `match`, `deviceId`, `role`, `tile`, `surface`, `screenMm`, `dpr`, `root`, `now()`, `latest()`; `draw(frame)` on an SDK-owned canvas with a cleared context transformed to world mm, driven by an SDK-owned animation loop; `runMatch({ link, match, self, now, send, onEvent, authority })` returning `{ deliver, setPaused, stop }` where `authority` opens a host link and a view link through the same factory; the link port and the in-process adapter that `structuredClone`s every frame in both directions; wire protocol v1 frames `ready`, `init`, `tick`, `publish`→`state`, `close`, with the discriminant and version on every frame; the clock crossing as `epochOffset` against `Date.now()`, anchored once on the game side and slewed; the fixed-step accumulator (`dt = 1/tickHz`, at most 5 catch-up steps per frame, remainder dropped; drain inbound → tick → flush outbound); retention of the last broadcast and per-Device state with replay to a late-ready view. The frames that cross between Devices are the non-local subset of the view grammar.

Interface details are in the SDK design document; this ticket implements the subset above, leaving input, pause, holders, timers, faults, and `log` to later tickets, but must not shape the interface in a way that makes them additive breaks.

**Blocked by:** 01 (Prefactor: layout package drops its core dependency)

**Status:** ready-for-agent

- [x] `@mgc/sdk` exists in the workspace, depends on `@mgc/layout` only at runtime, re-exports `Surface`/`Vec2`/`Rect`
- [x] E2E test over the in-memory hub with fake timers and a stepped animation frame: Host (`authority`) + 3 Peers each run `runMatch` with a recording probe game; after N fixed steps every view, including the Host's own, has received N states stamped with non-decreasing host times
- [x] E2E: a view whose link becomes ready late receives the retained latest state immediately
- [x] E2E: `publish(state, to)` reaches only that Device
- [x] E2E: a Host animation-frame gap of 1 s yields at most 5 ticks on the next frame and `now` jumps forward
- [x] Test: a game-side `now()` derived from the clock frame is monotone across a later clock frame that moves the offset backwards
- [x] Test: publishing a non-serialisable value (a function, a `Map`) fails at the call site under the in-process link
- [x] Headless `draw` path: with a stepped animation frame, `draw` is called with a context whose transform equals the Surface's world→px transform times `dpr` (same check as the existing layout `applyTo` test)
- [x] Typecheck and suite green; no change to the pwa yet

## Comments

### 2026-11-07

**Changed** (all new under `packages/sdk/` unless noted)
- `package.json`: `@mgc/sdk`; runtime dependency `@mgc/layout` only, `@mgc/core` as a devDependency for the tests. `tsconfig.json` extends the base config. Root `package.json`: `typecheck` now also runs `tsc -p packages/sdk`. `pnpm-lock.yaml` gained the `packages/sdk` importer (`pnpm install --no-frozen-lockfile`). `vitest.config.ts` is unchanged because `packages/**/*.test.ts` already covers the new tests.
- `src/types.ts`: the shared data from `docs/sdk-design.md` §1 that this ticket needs: `DeviceId`, `PlayerId`, `JsonValue`, `Tile`, `Player`, `Device`, `MatchInfo`, `MatchResult`, `Manifest`, `Range`, `PauseReason` (the final `setPaused` signature takes it), and `CloseReason`.
- `src/wire.ts`: `Link`, `LinkFactory`, `WIRE_VERSION = 1`, `ClockWire`, and the unions `Shared`/`HostDown`/`ViewDown`/`HostUp`/`ViewUp`/`Down`/`Up`/`NetDown`/`NetUp`/`NetFrame`. Every frame carries `v` and `t`. The frames are `ready`, `init`, `tick`, `publish`→`state`, `clock`, `close`, `end` and `fault`. `NetDown` is `Extract<ViewDown, state | close>` and `NetUp` is `Extract<ViewUp, input | send>`, so the frames that later tickets add to `ViewDown`/`ViewUp` cross Devices without further changes. `isNetDown` validates frames that arrive off the net.
- `src/game.ts`: `defineGame`, `GameSpec`, `Game`, `HostContext` (`match`, `now`, `publish(state, to?)`, `end`), `HostHandlers` (`tick`, `dispose`), `ViewContext` (`match`, `deviceId`, `role`, `tile?`, `surface?`, `screenMm`, `dpr`, `root`, `now`, `latest`), `ViewHandlers` (`draw`, `onState`, `dispose`) and `Frame`. The `S`/`M` arity is final, so later handlers and context members are additions.
- `src/game-side.ts`: the game-realm runtime that every adapter uses. It sends `ready` first and ignores everything before `init`. Every handler runs in a guard, and a throw becomes a `fault` frame. Frames that game code posts during a handler are flushed after it returns. That gives tick → flush outbound, and `publish` inside `tick` is stamped with the tick's `now`. `ctx.publish`/`end` validate plain JSON at the call site and throw a `TypeError` for functions, `Map`/class instances, `undefined`, non-finite numbers and cycles (`src/json.ts`). After `end`, ticks that are already in flight are not run. The view side creates an SDK-owned root `div` in the mount. When the view has `draw`, it also creates a canvas there and runs an animation loop on the mount's window. Each frame it sizes the backing store to the root's CSS px × dpr, resets and clears it, applies `Surface.applyTo(ctx, dpr)` (a Controller gets screen mm × pxPerMm × dpr), calls `draw`, then restores.
- `src/clock.ts`: `GameClock`. The first `ClockWire` anchors it (`Date.now() + epochOffset` against `performance.now()`). Later frames are slewed at no more than 2 %, never backwards.
- `src/in-process.ts`: `inProcessLink(load)`. It `structuredClone`s each frame on post in both directions and delivers frames in order on a microtask once a listener is attached, so a `ready` sent before the platform subscribes is not lost. `close()` delivers what was already posted (the `close` frame), then tears the game side down.
- `src/match.ts`: `runMatch` → `{ deliver, setPaused, stop }` and `MatchEvent` (`started`, `ended`, `closed`, `fault`).
  - Every Device opens a view link. `authority` also opens a host link through the same factory, and the Host's own view is fed by loopback through the same path a Peer's net state takes.
  - A `GameLink` holds frames back until `ready` and checks its version, then posts `init`, then frames.
  - The fixed step runs on the mount window's rAF: `dt = 1/tickHz`, steps exactly `1000/tickHz` ms apart on the shared clock, and no more than 5 per frame. A longer stall is dropped, and the next step's `now` jumps forward.
  - `clock` frames go to the local game sides every 2 s.
  - `publish` becomes a `state` frame: broadcast goes to net plus loopback, `to` = self goes to loopback only, and any other `to` goes to `send(frame, to)`.
  - Each Device's view retains its last broadcast and its last targeted state, in arrival order, and replays them right after `init` to a view that becomes ready late.
  - `end` → `close{ended, result}` goes to the host game, the local view and the net. Every Device emits `ended` then `closed` and removes its view DOM.
- `src/index.ts`: the public exports, including `Surface`, `Vec2` and `Rect` re-exported from `@mgc/layout`.
- `test/harness.ts` contains:
  - stepped animation frames;
  - a headless fake mount/window/canvas/2D context reached through `mount.ownerDocument.defaultView`, which is the only DOM the SDK touches;
  - a recording probe game;
  - `startMatch`, which builds one core `Session` per Device over `MemoryHub` (`hostSession`/`joinSession`, synced under fake timers) and wires `runMatch`'s `send`/`deliver` to `session.send`/`onMessage` as the app will.
- `test/match.e2e.test.ts` (Host + 3 Peers: 3 Tiles + 1 Controller, 4 ms latency):
  - N ticks fan out to all 4 views, stamped with the tick times and non-decreasing;
  - a late-ready view gets `[last targeted, last broadcast]` at once;
  - targeted publish, including to the Host's own Tile;
  - a 1 s gap gives ≤ 5 ticks, then `now` catches up;
  - `end` gives `started`/`ended`/`closed` on every Device and an empty mount.
- `test/game-seam.test.ts` (Host alone): the draw transform equals `Surface.worldToPx × dpr` and the canvas was cleared (780×1688) before `draw`; `now()` stays monotone (≥ 0.98× rate) after a −300 ms clock correction and converges within 16 s; publishing a function or a `Map` throws a `TypeError` at the call site, and no state or fault results.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pwa).
- `pnpm test`: 5 files, 25 tests passed. The sdk accounts for 8 of them (5 E2E, 3 seam); core and layout are unchanged.
- `apps/pwa` is untouched. Nothing under `packages/sdk/src` imports `@mgc/core`.

**Deviations / notes for later tickets**
- `ViewDown.state` has an optional `to?: DeviceId`, set when the state was published to that Device alone. A Peer's runtime cannot otherwise tell a targeted state from a broadcast, and it needs that to keep "last broadcast + last per-Device" separately for late-ready replay. Games never see it. `docs/sdk-design.md` §4 should be amended.
- `Frame.t` equals `Frame.now` before the first state (so `now - t` is 0).
- `setPaused` has its final signature and is accepted with no effect: pause/resume frames are ticket 06. Retention for resume replay is also left to 06; this ticket replays only to a late-ready view.
- Done here because the link state machine needs a defined answer for every input, but untested here; ticket 07 owns the tests and the rest of the ladder:
  - game-side handler throws become `fault` frames and `fault` events, with no budget;
  - a `ready` with the wrong version → `close{'version'}`;
  - an unexpected frame → `close{'protocol'}`;
  - a link whose factory rejects → `close{'link-lost'}`.
- Any link failure currently closes the whole local `runMatch`, which on the Host is the Match. Ticket 07 narrows a single view's failure to that view.
- NetUp is empty (`input`/`send` arrive with 05/08), so the Host ignores everything delivered off the net. Peers do not check that a NetDown came from the Host: `MatchInfo` does not name the Host, and ticket 05 has to decide how a Peer addresses the Host for input.
