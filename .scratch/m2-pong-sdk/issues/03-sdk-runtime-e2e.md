# 03: SDK runtime, verified end-to-end in memory

**What to build:** A game author can write `defineGame({ manifest, host, view })` and the platform can run it on a Host and several Peers with `runMatch`; every view, including the Host's own Tile, receives the host's published state on every tick and draws it in world millimetres. Proven by an end-to-end test with a Host and three Peers in one process over the in-memory transport — no phones, no DOM.

The new SDK package depends on the layout package only (core is a dev dependency for the test). It delivers: the shared data types (`MatchInfo`, `Device`, `Tile`, `Player`, `Manifest`, `MatchResult`); `defineGame` with host and view factories whose return values are the handler records; host context `match`, `now()`, `publish(state, to?)`, `end`; view context `match`, `deviceId`, `role`, `tile`, `surface`, `screenMm`, `dpr`, `root`, `now()`, `latest()`; `draw(frame)` on an SDK-owned canvas with a cleared context transformed to world mm, driven by an SDK-owned animation loop; `runMatch({ link, match, self, now, send, onEvent, authority })` returning `{ deliver, setPaused, stop }` where `authority` opens a host link and a view link through the same factory; the link port and the in-process adapter that `structuredClone`s every frame in both directions; wire protocol v1 frames `ready`, `init`, `tick`, `publish`→`state`, `close`, with the discriminant and version on every frame; the clock crossing as `epochOffset` against `Date.now()`, anchored once on the game side and slewed; the fixed-step accumulator (`dt = 1/tickHz`, at most 5 catch-up steps per frame, remainder dropped; drain inbound → tick → flush outbound); retention of the last broadcast and per-Device state with replay to a late-ready view. The frames that cross between Devices are the non-local subset of the view grammar.

Interface details are in the SDK design document; this ticket implements the subset above, leaving input, pause, holders, timers, faults, and `log` to later tickets, but must not shape the interface in a way that makes them additive breaks.

**Blocked by:** 01 (Prefactor: layout package drops its core dependency)

**Status:** ready-for-agent

- [ ] `@mgc/sdk` exists in the workspace, depends on `@mgc/layout` only at runtime, re-exports `Surface`/`Vec2`/`Rect`
- [ ] E2E test over the in-memory hub with fake timers and a stepped animation frame: Host (`authority`) + 3 Peers each run `runMatch` with a recording probe game; after N fixed steps every view, including the Host's own, has received N states stamped with non-decreasing host times
- [ ] E2E: a view whose link becomes ready late receives the retained latest state immediately
- [ ] E2E: `publish(state, to)` reaches only that Device
- [ ] E2E: a Host animation-frame gap of 1 s yields at most 5 ticks on the next frame and `now` jumps forward
- [ ] Test: a game-side `now()` derived from the clock frame is monotone across a later clock frame that moves the offset backwards
- [ ] Test: publishing a non-serialisable value (a function, a `Map`) fails at the call site under the in-process link
- [ ] Headless `draw` path: with a stepped animation frame, `draw` is called with a context whose transform equals the Surface's world→px transform times `dpr` (same check as the existing layout `applyTo` test)
- [ ] Typecheck and suite green; no change to the pwa yet
