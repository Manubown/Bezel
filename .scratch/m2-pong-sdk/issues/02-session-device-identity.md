# 02: Session with Device identity and rebinding

**What to build:** A phone that reloads or briefly loses its connection comes back as the *same* Device: it takes over its old roster entry and its old Tile instead of appearing as a new phone. The app talks to one `Session` interface whether it is Host or Peer, addressing Devices by a stable `deviceId`, never by a transport peer id.

Core replaces its two session classes with one `Session` interface produced by `hostSession` / `joinSession` (both take a Transport, the local Device's info, and an optional local-clock function). `DeviceInfo` gains `deviceId`; the pwa persists a UUID in local storage and supplies it. The interface exposes `self`, `role`, `status`, `clock.now()`, `roster()` (Host first; immutable snapshot entries with `info`, `present`, sync summary), `send(channel, data, toDeviceId?)`, `onMessage(channel, (data, fromDeviceId))`, `onChange`, `onDeviceLost`, `onDeviceBack`, `close`. Hidden inside: the session channels, the peer-id↔device-id map, rebinding (a joining Device whose id is already known takes over its entry, its old peer id is forgotten, `onDeviceBack` fires), dropping messages from unknown or stale peer ids. Invariants: a Peer's `send` before `ready` is dropped; a lost Device stays in the roster with `present: false`; the Host leaving flips Peers to `searching` with an empty roster (ADR-0002).

The pwa is cut over to `Session` end to end (layout publishing via `session.send`, roster rendering via `roster()`, self id via `self.deviceId`); M1 behaviour is unchanged. The session half of the existing clock test file is replaced by tests at the new interface; the clock-estimator tests stay.

**Blocked by:** 01 (Prefactor: layout package drops its core dependency)

**Status:** ready-for-agent

- [ ] `HostSession`/`PeerSession` no longer exist; `Session`, `hostSession`, `joinSession`, `DeviceInfo.deviceId` are the exported surface; peer id and Transport stay exported for adapter construction only
- [ ] The pwa persists a `deviceId` across reloads and nothing in the pwa reads a transport peer id
- [ ] Test (in-memory hub, fake timers): host + 2 peers converge to one roster keyed by `deviceId` with `synced` true; `send` to a `deviceId` arrives only there with `from` = sender's `deviceId`
- [ ] Test: disconnect a peer and reconnect with the same `deviceId` under a new peer id → `onDeviceLost` then `onDeviceBack`, roster length unchanged, a later `send` to that `deviceId` arrives on the new connection; a message from the stale peer id is dropped
- [ ] Test: Host leaves → Peer `searching`, `roster()` empty
- [ ] Old session tests deleted, not kept alongside; typecheck and suite green
- [ ] Smoke: reload a peer tab mid-arrangement; it reappears in its previous Tile with the same number in the roster
