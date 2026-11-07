# Platform seams around `@mgc/sdk`

Deepening assessment of `@mgc/core`, `@mgc/layout`, and `apps/pwa` for M2, in the vocabulary of `/codebase-design`. Companion to `docs/sdk-design.md`, whose §8 prerequisites this designs. Written 2026-11-07 from the code as committed in `9372814`.

## 1. What exists and how deep it is

| Module | Interface today | Verdict |
|---|---|---|
| `core` `Transport` | `selfId`, `send(channel, data, to?)`, `onMessage`, `onPeerJoin/Leave`, `peers()`, `close()`; adapters `TrysteroTransport`, `MemoryTransport` | **Deep, real seam** (two adapters). Keep. `PeerId` is its vocabulary and should stay inside `core`. |
| `core` `ClockEstimator`/`ClockSync`/`SharedClock`/`serveClock` | NTP sampling, min-RTT filter, median; `now()` | **Deep.** Keep; already an internal seam used by sessions. |
| `core` `HostSession` / `PeerSession` | `transport` (public), `peers: Map<PeerId, PeerEntry>` (public, mutable), `clock`, `hostId`, `status`, `onChange()`, `close()` | **Shallow.** The interface is the implementation: `apps/pwa/main.ts` reaches `session.transport.selfId`, `session.transport.send` (via `publishLayout`), iterates `session.peers`, reads `PeerEntry.info/clock`. Two classes with no shared face, so the pwa has a host branch and a peer branch for the same jobs (identify self, send, receive, read roster, read clock). No Device identity: a returning phone is a new `PeerEntry`. |
| `layout` `buildLayout`, `Surface`, `aabbOf`, `unionRect` | pure mm math | **Deep.** Keep. |
| `layout` `publishLayout` / `subscribeLayout` (`channel.ts`) | 2 lines over `Transport` | **Pass-through** (deletion test: the two lines reappear in `main.ts`), and it is the reason `layout` depends on `core`. Delete. |
| `apps/pwa` `main.ts` `runHost`/`runPeer` | 140 lines: room code, QR, HUD DOM, roster render, template choice, layout build + publish, `Surface`, canvas loop, M1 scene | **No seam.** M2 needs a frozen `MatchInfo`, `send`/`deliver` by `DeviceId`, and device-lost/back signals; none of that can be lifted out of these two functions without first giving them an interface. |

## 2. Dependency categories

| Dependency | Category | Treatment |
|---|---|---|
| WebRTC / Trystero | remote-but-owned, already ported as `Transport` | `TrysteroTransport` in production, `MemoryHub` in tests; sessions accept a `Transport`, never create one |
| Device identity persistence (`localStorage`) | local-substitutable | **not a core concern**: the caller passes `deviceId` in; `apps/pwa/device.ts` persists it |
| Shared clock | in-process | internal seam inside `core`; exposed only as `{ now(): number }` |
| `performance.now` / timers | local-substitutable | `localNow` parameter (already) + fake timers (already) |
| DOM (HUD, QR, canvas) | pwa-only | stays in `apps/pwa`; never below the lobby seam |

## 3. Deepen: one `Session` interface in `@mgc/core`

Replace `HostSession`/`PeerSession` (two shallow classes) with one interface keyed by `DeviceId`, produced by two factories. Host and Peer differ in *who runs the reference clock and owns the roster*, not in what a caller needs from them.

```ts
export type DeviceId = string;
export interface DeviceInfo { deviceId: DeviceId; name: string; width: number; height: number; dpr: number; pxPerMm: number }
export interface RosterEntry { readonly info: DeviceInfo; readonly present: boolean;   // false = dropped, identity retained
                               readonly sync: { synced: boolean; rtt?: number } }
export type SessionStatus = 'searching' | 'syncing' | 'ready';   // host is always 'ready'

export interface Session {
  readonly self: DeviceInfo; readonly role: 'host' | 'peer';
  readonly status: SessionStatus; readonly clock: { now(): number };
  roster(): readonly RosterEntry[];                  // Host first; every Device ever seen this Session
  send(channel: string, data: JsonValue, to?: DeviceId): void;    // `to` omitted = everyone present
  onMessage(channel: string, h: (data: unknown, from: DeviceId) => void): () => void;
  onChange(h: () => void): () => void;              // status, roster, or sync changed
  onDeviceLost(h: (d: DeviceId) => void): () => void;
  onDeviceBack(h: (d: DeviceId) => void): () => void;
  close(): void }
export function hostSession(transport: Transport, self: DeviceInfo, localNow?: LocalNow): Session;
export function joinSession(transport: Transport, self: DeviceInfo, localNow?: LocalNow): Session;
```

What the implementation hides: the `hello`/`info`/`clk`/`clkrep` channels; the `PeerId ↔ DeviceId` map and **rebinding** (a Device whose `info.deviceId` is already in the roster takes over that entry, its old `PeerId` is forgotten, and `onDeviceBack` fires instead of a new entry appearing); clock serving and syncing; the host-is-roster-index-0 convention; demultiplexing application channels from session channels; dropping messages from unknown `PeerId`s and from a stale `PeerId` after a rebind.

Invariants a caller must know: `send` before `status === 'ready'` on a Peer is dropped (no host yet); `roster()` is a fresh array each call, entries are immutable snapshots; `onDeviceLost` is followed either by `onDeviceBack` (same `deviceId`) or by nothing — the entry stays with `present: false` for the Session's lifetime; the Host leaving flips a Peer to `searching` and clears the roster (ADR-0002: the Session is over; the pwa returns to join).

Deletion test: without it, `apps/pwa` carries two id spaces, a demux, a rebind table, and two roster shapes; with it, `runMatch`'s `send`/`deliver`/`onDeviceLost` closures are one line each.

**Tests at the interface** (replace `clock.test.ts`'s session half, don't layer on it): over `MemoryHub` with fake timers — host + 2 peers converge to one roster keyed by `deviceId` with `synced` true; `send(ch, d, deviceId)` arrives at exactly that Device with `from` = the sender's `deviceId`; disconnect `p2`, reconnect as `p2b` with the same `deviceId` → `onDeviceLost('d2')` then `onDeviceBack('d2')`, roster length unchanged, a message sent to `'d2'` after the rebind arrives on `p2b`; a message from the stale `p2` after rebind is dropped; host leaves → peer `searching`, `roster()` empty. The `ClockEstimator` tests stay as they are (internal seam, pure).

## 4. Decouple `@mgc/layout` from `@mgc/core`

- `DeviceSize.id: string` (it is a `DeviceId`; `layout` need not know the type's home).
- Delete `channel.ts`. `isLayout` moves to `types.ts` (pure validator, still useful on the receiving side). `LAYOUT_CHANNEL` and the two calls move into the pwa lobby (§5).
- Remove `@mgc/core` from `layout/package.json`. `@mgc/sdk` then depends on `layout` alone, as `sdk-design.md` §8 requires.

## 5. A seam in `apps/pwa`: the Lobby

The Lobby is the module that turns a Session into a frozen `MatchInfo` and hands the stage to `runMatch`. One interface for both roles; the Host's adapter *decides*, the Peer's adapter *receives*.

```ts
export interface Lobby {
  readonly layout: Layout | undefined;                 // live preview of the present Tiles
  readonly surface: Surface | undefined;               // this Device's Tile in `layout`, at `pxPerMm`
  readonly players: readonly Player[];                 // setPlayers' choice, else the Players at the two outer Tiles
  seatOf(playerId: PlayerId): DeviceId | undefined;    // the Device a Player sits at
  readonly match: MatchInfo | undefined;               // set by start, deep-frozen, until the Host's close
  onChange(h: () => void): () => void;
  // Host only; no-ops on a Peer, ignored while `match` is set:
  setTemplate(t: TemplateId): void;
  setRole(deviceId: DeviceId, role: 'tile' | 'controller'): void;
  setPlayers(players: Player[]): void;                 // until the Tiles change; names stay with their Player id
  start(game: Manifest): MatchInfo;                    // validates, freezes, broadcasts; throws the reason (always on a Peer)
  close(): void }                                      // the Match is over: `match` clears on every Device
export function openLobby(session: Session, pxPerMm: number, playerId: PlayerId): Lobby;  // playerId: who sits here (persisted)
```

Hides: `buildLayout` over the present Tile Devices in roster order; the `lobby` session channel (Host → Peers the whole lobby state, re-sent to a Device that appears; Peer → Host its persisted Player id once `ready`); the `template|id:wxh` change key; manifest validation (`templates`, `tiles`/`controllers`/`players` ranges, `minTileMm`, every Device synced and seated); the role map; freezing. A Peer takes lobby state from the Host's Device id only and validates it into fresh frozen objects. The HUD (`hud.ts`) renders from the lobby and `session.roster()` and calls `setTemplate`/`setPlayers`/`start`; `main.ts` is: build `Transport` → `hostSession`/`joinSession` → `openLobby` → on a `lobby.match` that lists this Device, `runMatch({... send: (f, to) => session.send('match', f, …), …})` (a Peer's frames to the Host, `roster()[0]`) → on `ended`, the result is kept → on `closed`, the Host's `lobby.close()` → back to the lobby on every Device, where the HUD's result card names the winner by Player name (`result.ts` `describeResult`) until tapped. A Device that joins while `match` is set waits in the lobby. The M1 grid scene (`scene.ts` `drawPreview`) is the lobby's placement preview on the stage until a Match starts; the Game (`GAME` in `main.ts`, Pong) owns the screen during one.

Pause and rejoin (M2 06):
- **Pause.** While a Match runs, the Host's `pause.ts` `pauseOnDeviceLoss(session, match, handle)` turns `onDeviceLost` of a Match Device into `setPaused({ kind: 'device-lost', deviceId })`. It resumes with `setPaused(null)` only once every lost Match Device is present *and* synced again, on the `onChange` that reports it, not on the bare `onDeviceBack`: see `docs/sdk-design.md` §6 for why. With several lost, the pause names the first one still missing.
- **Overlay.** Every Device turns its `runMatch`'s `paused`/`resumed` events into `play.paused` (`describePause`). The HUD shows a notice over the Game, "Waiting for Bo" / "Phone 2 lost its connection · the match goes on when it is back", until the resume. It names the Player seated at that Device when this Device joined the Match, else "phone N" in Layout order. Touches pass through the notice to the Game. The Host's bar reads "Pong · paused".
- **Rejoin.** A Device starts its part of a lobby `match` that lists it only once its Session is `ready`, so its runtime is on the Host's clock. A Peer whose Session went `searching` stops its part with `link-lost` and may rejoin the same `matchId` when the Session finds the Host again. A Match that closed any other way is not rejoined. A reopened Peer tab reclaims its `deviceId` (`claimDeviceId`), rebinds, gets the lobby state while syncing, starts `runMatch` at `ready`, and is resumed with the retained state.

Tests at the interface: with a `Session` built over `MemoryHub` — `start()` throws on a manifest the roster cannot satisfy; the `MatchInfo` a Peer's lobby receives deep-equals the Host's; `setTemplate` after `start` is ignored; a Device joining after `start` is not in the Match. `pause.test.ts`: losing a Match Device pauses (a non-Match Device does not); the Device being back but unsynced does not resume; once it is synced the pause moves to the next lost Device, then resumes.

## 6. Order of work (M2 tickets, in dependency order)

1. `layout`: drop `core` dependency (§4) — no behaviour change; existing layout tests pass unchanged.
2. `core`: `Session` interface + factories + rebinding (§3); migrate `clock.test.ts` session tests to the new interface; delete `HostSession`/`PeerSession`.
3. `pwa`: `device.ts` persists `deviceId`; `main.ts` cut over to `Session`; `Lobby` + `hud.ts` (§5); M1 scene as lobby preview.
4. `sdk`: `packages/sdk` per `sdk-design.md`; `games/pong`; `runMatch` wired from the lobby.

Each step leaves the app runnable (M1 behaviour intact through step 3).
