# Connectivity and Match failsafes, round 1

Status: resolved (2026-11-08: tickets 01–04 resolved, three-tab smokes in 03 and 04; next: a phone run reading `peers`/`link` lines for D6)
Created: 2026-11-08
Sources: `.scratch/live-test-1/findings.md` §1–§2, `.scratch/sdk-friction-1/spec.md` B4/B7/B14, `docs/platform-design.md` §3, ADR-0002, `packages/core/src/{session,clock,transport,trystero-transport}.ts`, `packages/sdk/src/match.ts`, `apps/pwa/src/{main,pause,lobby}.ts`.

## Problem Statement

Live test 1 (4 iPhones + 2 Androids on a hotspot) showed the platform has no liveness of its own: a data channel that stops passing packets 0.2 s after it opens is noticed only when Trystero gives up 11 s later (`.scratch/live-test-1/findings.md` §1), the Peer meanwhile reads "Syncing clocks" forever because its 10-ping burst never completes, and every Peer reload or Host reload (14 in 30 min, §2) ends a Match or the Session. What exists today, and the gap:

| Today (`packages/core`, `apps/pwa`) | Gap |
|---|---|
| Presence = the transport's `onPeerLeave` (Trystero: ICE `disconnected` ~5 s + `disconnectedCloseDelayMs` 5 s). | No app-level heartbeat; a dead channel is "present" for 11 s; nothing in between "fine" and "gone". |
| Peer `status`: `searching → syncing → ready`; a Peer that never gets 4 clock samples stays `syncing`. | No timeout, no retry: the Peer waits for Trystero. |
| `ClockSync` pings every 100 ms for 10 pings, then every 5 s. | Too sparse to serve as liveness. |
| `Transport` has `close()` only. | A Peer that knows its Host connection is dead cannot ask for a fresh one. |
| `main.ts follow()`: a Peer whose Session turns `searching` stops its Match part with `link-lost`; it may rejoin the same `matchId` when the Host is found again, but the runtime is gone (its view, its retained states). | A 3 s blip ends the Match on that phone: lobby, result card "Connection lost", then a cold rejoin. |
| A Peer runtime gets retained states only on the Host's `resume` (`match.ts:453-471`). | A Peer that starts or re-attaches while the Match is *not* paused draws nothing until the next publish (B4). |
| `onResume(now)` | A Game cannot shift its deadlines by the pause length without bookkeeping of its own (B7). |
| A reloaded Host keeps its room code (`HOST_ROOM_KEY`) and Peers re-attach, but its lobby is blank: template, Tile order, roles, Game, seats are gone; Peers see "Connection lost". | The party re-does the lobby after every Host reload. |
| Wake lock from a Match's first touch only (`wake.ts`). | Phones dim and sleep in the lobby; a hidden page's WebRTC dies (B14). |
| ICE lines are logged, mesh size is not. | H2 (Trystero's Peer↔Peer mesh dragging the Host star down) cannot be read off the next live log. |

## Decisions

- **D1 Liveness rides on the clock channel at 1 Hz.** `ClockSync.periodicMs` becomes 1000 (was 5000; the burst stays 10 × 100 ms). Every request the Host receives is a heartbeat from that Peer; every reply the Peer receives is a heartbeat from the Host. No new channel, no new frame type; ~60 B/s per Peer. `ClockEstimator`'s window of 16 then spans 16 s of steady state, fine for drift.
- **D2 Presence thresholds** (constants in `session.ts`, exported for tests): `WEAK_MS = 2500` (two missed beats), `LOST_MS = 5000`, `SYNC_TIMEOUT_MS = 4000` (attach → `ready`), `REJOIN_GRACE_MS = 30000` (pwa: how long a Peer keeps a Match alive while `reconnecting`). Measured against the Session's `localNow`, driven by one `setInterval(…, 500)` per Session so tests run on fake timers.
- **D3 Roster gains `link`.** `RosterEntry.link: 'ok' | 'weak' | 'lost'`. `present` stays and means `link !== 'lost'` (every current caller keeps working). The Host is always `ok`. A Peer's own entry mirrors what the Host says (the roster is the Host's word), except the Peer flips the *Host's* entry to `weak`/`lost` from its own silence timer.
- **D4 Peer status gains `reconnecting`.** `SessionStatus = 'searching' | 'syncing' | 'ready' | 'reconnecting'`. `searching` = never had a Host this page; `reconnecting` = had one, lost it (transport leave, `LOST_MS` of silence, or `SYNC_TIMEOUT_MS` without `ready`), looking again. Re-attach from `reconnecting` goes `syncing → ready` as before. The pwa treats `reconnecting` as "keep everything, wait" and `searching` as today.
- **D5 `Transport.reset()`.** New interface method: forget every connection and rediscover. `TrysteroTransport`: `room.leave()` then `joinRoom` again with the same options, re-wiring the action and the join/leave handlers (the module-level `selfId` stays, which `HostedSession.bind` handles: the leave unbinds, the new `info` binds). `MemoryTransport`: `hub.disconnect(self)` then re-register, emitting leave then join to the others. Only Peers call it (from the Session: on `LOST_MS` silence and on `SYNC_TIMEOUT_MS`); a Host marks a silent Peer lost and leaves the reconnecting to that Peer, whose replies stopped at the same moment (a reply needs a request).
- **D6 No star-only transport in this round.** Trystero builds a full mesh and offers no public way to refuse Peer↔Peer connections (`onPeerHandshake` rejection kicks and re-announces: churn, not a star). Whether the mesh is the iPhone problem (H2) is open until the next phone run; this round makes the log answer it: the recorder's `tick` line gains `peers` (transport connections) next to the roster size, and `peer-join`/`peer-leave` lines already carry `peers`. Star-only (own signaling, or QR-SDP, M5) is decided after that run.
- **D7 A Peer keeps its Match through a reconnect.** `main.ts follow()` on `reconnecting`: the runtime stays, `play.paused` shows "Reconnecting to the host…", a `REJOIN_GRACE_MS` timer starts. The Host meanwhile paused the Match (`pauseOnDeviceLoss`: lost → pause). When the Session is `ready` again and the Host's lobby still names the same `matchId`, the runtime sends `hello` (D8) and plays on; if the lobby names no Match or another one, or the grace runs out, the runtime stops with `link-lost` as today. Decision logic lives in a pure module (`apps/pwa/src/rejoin.ts`) with unit tests; `main.ts` wires it.
- **D8 `hello` frame (B4).** `NetUp` gains `{ v: 1, t: 'hello' }`. A Peer runtime sends it when its view link opens and on `MatchHandle.hello()` (the pwa calls it on re-attach). The Host runtime answers that Device alone, in this order: `holders` (if any Holder is set), `retainedFor(d)`, the pause frame if paused. Idempotent; a Host runtime ignores `hello` from a Device not in the Match. The resume path keeps re-posting retained states (a Device back during a pause is covered twice, harmlessly: states are idempotent).
- **D9 `pausedMs` (B7).** The `resume` frame carries `pausedMs` (shared time of the resume minus the pause's `now`); `HostHandlers.onResume(now, pausedMs)` and `ViewHandlers.onResume(now, pausedMs)`. A runtime that started during the pause and has no pause start uses the pause frame's `now` it received (D8 delivers it). Games that ignore the second argument are unchanged.
- **D10 Host lobby survives a reload.** The Host lobby persists its configuration per room code in `sessionStorage` (`mgc.lobby.<CODE>`): template, Tile order and roles keyed by `deviceId`, Game, seats mode, bot slots. A fresh Host lobby for a code with a saved configuration restores it as Devices rebind (unknown Devices appear as today; Devices in the saved order that have not returned yet are not shown). The running Match cannot survive (the host game's state lived in the page); Peers get, through D7, a lobby with no Match on re-attach and close with `link-lost`, detail "The host phone restarted". Nothing in `core` changes for this.
- **D11 Wake lock in the lobby.** `wake.ts` gains `keepAwake()` requested at the first user gesture on the page (the lobby sheet, the join field, any tap) and re-requested on `visibilitychange` to visible; a Match's `keepAwakeOnTouch` keeps working as today and releases to the lobby's lock, not to nothing.

## Contract

```ts
// @mgc/core
interface Transport { …; reset(): void }
type SessionStatus = 'searching' | 'syncing' | 'ready' | 'reconnecting';
interface RosterEntry { info; present: boolean; link: 'ok' | 'weak' | 'lost'; sync }
export const WEAK_MS = 2500, LOST_MS = 5000, SYNC_TIMEOUT_MS = 4000;
// Session events unchanged: onChange fires on any link change; onDeviceLost/onDeviceBack on present flips.

// @mgc/sdk wire
type NetUp = … | { v: 1; t: 'hello' };
type Shared = … | { v: 1; t: 'resume'; now: number; clock: ClockWire; pausedMs: number };
interface MatchHandle { …; hello(): void }  // Peer only; a no-op on the Host
// game.ts
onResume?(now: number, pausedMs: number): void   // host and view handlers

// apps/pwa
export const REJOIN_GRACE_MS = 30000;
// rejoin.ts: pure decision of what the Peer does on each (status, lobby.match, current) change.
```

## Acceptance

1. Core, over `MemoryHub` with fake timers (`packages/core/test/session.test.ts` + a new `liveness.test.ts`): `hub.sever(a, b)` silently drops traffic both ways without a leave event; after `WEAK_MS` the Host's roster shows the Peer `weak` and the Peer's shows the Host `weak`; after `LOST_MS` the Host emits `onDeviceLost`, the Peer is `reconnecting` and has called `transport.reset()` (observable: the hub saw leave + join for that id); `hub.heal` → re-attach, `syncing → ready`, `onDeviceBack`, roster length unchanged, a message to that Device arrives on the new connection. A Peer that never hears a Host stays `searching` (it never had one); a Peer that gets `hello` but no clock replies hits `SYNC_TIMEOUT_MS`, resets, and is `reconnecting`. A Host whose Peer stays silent marks it lost without calling `reset()` itself.
2. SDK (`packages/sdk/test`): a Peer runtime that starts mid-Match (not paused) receives the retained broadcast state and its own targeted state within one frame of its `hello`; `hello` from a Device not in the Match changes nothing; `onResume` on host and view receives `pausedMs` equal to the pause length on the shared clock; a runtime that started during the pause gets the same `pausedMs`.
3. pwa (`apps/pwa/test/rejoin.test.ts`): the decision table of D7 (reconnecting keeps; ready + same match → `hello`; ready + other/no match → stop `link-lost`; grace expiry → stop; `searching` → stop as today). Lobby persistence (`lobby.test.ts`): a Host lobby built from a saved configuration reproduces template, order, roles, Game, seats once the same Devices are present.
4. Browser smoke (three tabs, real Trystero, `pnpm dev`): kill a Peer's connection (DevTools offline for 3 s, or `transport.reset()` from the console): the Host pauses within ~5 s naming that phone, the Peer shows "Reconnecting to the host…", and within a few seconds both resume the same Match with the state drawn; reload the Host: its lobby comes back with the same template/order/Game, the Peers' cards read "The host phone restarted". `pnpm typecheck` and `pnpm test` green.

## Out of Scope

Star-only transport, TURN by default, QR-SDP signaling (M5): after the next phone run (D6). B14's resize/rotation re-measure, calibration, insets: the geometry round. M3.
