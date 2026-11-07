# 02: Session with Device identity and rebinding

**What to build:** A phone that reloads or briefly loses its connection comes back as the *same* Device: it takes over its old roster entry and its old Tile instead of appearing as a new phone. The app talks to one `Session` interface whether it is Host or Peer, addressing Devices by a stable `deviceId`, never by a transport peer id.

Core replaces its two session classes with one `Session` interface produced by `hostSession` / `joinSession` (both take a Transport, the local Device's info, and an optional local-clock function). `DeviceInfo` gains `deviceId`; the pwa persists a UUID in local storage and supplies it. The interface exposes `self`, `role`, `status`, `clock.now()`, `roster()` (Host first; immutable snapshot entries with `info`, `present`, sync summary), `send(channel, data, toDeviceId?)`, `onMessage(channel, (data, fromDeviceId))`, `onChange`, `onDeviceLost`, `onDeviceBack`, `close`. Hidden inside: the session channels, the peer-id↔device-id map, rebinding (a joining Device whose id is already known takes over its entry, its old peer id is forgotten, `onDeviceBack` fires), dropping messages from unknown or stale peer ids. Invariants: a Peer's `send` before `ready` is dropped; a lost Device stays in the roster with `present: false`; the Host leaving flips Peers to `searching` with an empty roster (ADR-0002).

The pwa is cut over to `Session` end to end (layout publishing via `session.send`, roster rendering via `roster()`, self id via `self.deviceId`); M1 behaviour is unchanged. The session half of the existing clock test file is replaced by tests at the new interface; the clock-estimator tests stay.

**Blocked by:** 01 (Prefactor: layout package drops its core dependency)

**Status:** ready-for-agent

- [x] `HostSession`/`PeerSession` no longer exist; `Session`, `hostSession`, `joinSession`, `DeviceInfo.deviceId` are the exported surface; peer id and Transport stay exported for adapter construction only
- [x] The pwa persists a `deviceId` across reloads and nothing in the pwa reads a transport peer id
- [x] Test (in-memory hub, fake timers): host + 2 peers converge to one roster keyed by `deviceId` with `synced` true; `send` to a `deviceId` arrives only there with `from` = sender's `deviceId`
- [x] Test: disconnect a peer and reconnect with the same `deviceId` under a new peer id → `onDeviceLost` then `onDeviceBack`, roster length unchanged, a later `send` to that `deviceId` arrives on the new connection; a message from the stale peer id is dropped
- [x] Test: Host leaves → Peer `searching`, `roster()` empty
- [x] Old session tests deleted, not kept alongside; typecheck and suite green
- [x] Smoke: reload a peer tab mid-arrangement; it reappears in its previous Tile with the same number in the roster

## Comments

### 2026-11-07

**Changed**
- `packages/core/src/session.ts`: rewritten. `HostSession`/`PeerSession`/`PeerEntry`/`PeerStatus` deleted; one `Session` interface (`self`, `role`, `status`, `clock.now()`, `roster()`, `send`, `onMessage`, `onChange`, `onDeviceLost`, `onDeviceBack`, `close`) from `hostSession(transport, self, localNow?)` / `joinSession(...)`, as `docs/platform-design.md` §3. `DeviceId`, `DeviceInfo.deviceId`, `RosterEntry`, `SessionStatus` added. Hidden inside: the `hello`/`info`/`clkrep`/`roster`/`msg` channels; the Host's live `PeerId ↔ DeviceId` maps; rebinding (a known `deviceId` keeps its roster slot, the old PeerId is forgotten, `onDeviceBack` fires; if the old connection is still live it is first reported lost, so lost/back always pair); dropping messages, clock reports and leaves from unknown/stale PeerIds; the Host broadcasting the roster, from which Peers mirror `roster()` and derive their own lost/back. Application messages travel in one envelope channel; a Peer sends only to the Host, which stamps `from` with the sender's `deviceId` and relays to the target (star, ADR-0002). A Peer's `send` before `ready` is dropped; Host leaving → Peer `searching`, `roster()` empty. `roster()` returns a fresh array of frozen entries.
- `packages/core/src/index.ts`: exports `hostSession`, `joinSession`, `Session`, `SessionStatus`, `RosterEntry`, `DeviceId`, `DeviceInfo`; `PeerId`/`Transport`/adapters/clock classes unchanged.
- `packages/core/test/clock.test.ts`: session half deleted; the three `ClockEstimator` tests unchanged.
- `packages/core/test/session.test.ts` (new): five interface tests over `MemoryHub` with fake timers: (1) host + 2 peers converge to one roster `d0,d1,d2` with `present`/`synced` true on all three Sessions, `info` round-trips, Peer clocks within the NTP asymmetry bound; (2) `send` to a `deviceId` arrives only there with `from` = sender (Host→Peer, Peer→Peer relayed, Peer→Host, Peer broadcast), and a Peer's sends while `searching`/`syncing` are dropped; (3) close `p2`, reconnect `p2b` with `d2` → Host and Peer see `lost d2` then `back d2`, roster length 3, `d2` present and synced, sends to `d2` arrive on `p2b`; (4) `p2b` joins with `d2` while `p2` is still connected → lost/back, the stale `p2`'s broadcast and directed sends reach nobody, sends to `d2` arrive only on `p2b`, `p2`'s late leave fires nothing; (5) Host closes → Peer `searching`, `roster()` `[]`.
- `apps/pwa/src/device.ts`: `claimDeviceId()` persists a UUID in localStorage (`mgc.deviceIds`) and remembers the tab's id in sessionStorage (`mgc.deviceId`). A phone gets the browser's first id. Each tab holds a Web Lock on its id so several tabs of one browser (the desktop smoke) get distinct ids; a reloaded tab takes its own id back, waiting up to 1.5 s for the lock its previous page may still hold. `deviceInfo(deviceId)` includes `deviceId`; `deviceSize(info)` takes the id from the info.
- `apps/pwa/src/main.ts`: cut over to `Session`. `start()` claims the id and builds `DeviceInfo` before the Transport. The Host uses `hostSession`, builds the layout from the present `roster()` entries in roster order, publishes with `session.send`, and renders the HUD roster from `roster()`. The Peer uses `joinSession`, takes the layout from `session.onMessage` only when `from` is the Host (`roster()[0]`), finds its Tile by `session.self.deviceId`, and reads its own sync from its roster entry. No PeerId is read anywhere in the pwa.

**Verified**
- `pnpm typecheck`: clean (core, layout, pwa).
- `pnpm test`: 3 files, 17 tests passed (layout 9, clock 3, session 5).
- Smoke: `pnpm dev`, then three headless Chromium tabs in one browser over the real Trystero transport (host plus two `?room=M5NK` peers). The three tabs got three distinct deviceIds. The peers showed "Phone 2 of 3" and "Phone 3 of 3". Reloading the phone-2 peer: the host roster showed it as "disconnected" after 0.2 s (in the meantime the other peer moved up to phone 2). At 0.7 s the reloaded tab was syncing, and at 1.1 s it showed "Phone 2 of 3 · right of phone 1" again. The host roster went back to 2 = reloaded tab and 3 = other peer. The tab had the same deviceId before and after the reload. A screenshot shows the reloaded tab drawing the Tile "2" grid with the ball. Switching to Grid gave "row 1, column 2" and "row 2, column 1" on the peers. Closing a peer tab showed a "disconnected" row on the host, and the remaining peer showed "Phone 2 of 2". No page errors in any tab.

**Deviations / notes**
- `Session.send(channel, data: unknown, to?)` instead of `data: JsonValue`. The layout's `Layout` (and any `interface`-typed frame) cannot be assigned to an index-signature `JsonValue`, so that type would force casts at every caller. Widening the type breaks no caller, and the doc comment says the data must be JSON.
- `RosterEntry.sync` is `{ synced; rtt?; offset? }`. `offset` was added so the host HUD keeps its M1 `rtt · Δoffset` readout.
- `send` with `to` omitted reaches every *other* present Device. `to` = self, or a Device that is absent or unknown, is dropped. This is Transport semantics, which §3 leaves open.
- HUD differences from M1, both cosmetic: (a) unidentified connections no longer show as "connecting" rows, because `roster()` has only identified Devices; dropped Devices now show as "disconnected" rows instead. (b) A syncing Peer shows "measuring the offset to the host" instead of a sample count, which the interface does not expose.
