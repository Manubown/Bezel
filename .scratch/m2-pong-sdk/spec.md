# M2 — Pong across bezels, built on the Game SDK

Status: ready-for-agent
Created: 2026-11-07

## Problem Statement

A group of people has placed two to four phones in a row on a table and joined one Session (M0) and arranged them with a shape template (M1). All they can do is watch a demo ball cross the bezels. There is no game: nothing responds to touch, nothing is scored, and there is no way for anyone to write a game of their own because the platform has no seam a game could plug into. The M1 demo draws straight on the platform's canvas and reaches into the transport, so turning it into a game would couple that game to the platform forever.

## Solution

Ship Pong as the first playable Game: paddles on the two outer Tiles follow the fingers of the two Players, the ball crosses every bezel without visible stutter, the first to seven wins. Build it *against the Game SDK from day one*: Pong imports only the SDK, runs in-process on every Device, and is byte-identical to what will later run in a sandboxed iframe (M3). To make that possible the platform grows the three seams it is missing: a Device identity that survives reconnects in the Session, a Lobby on the Host that freezes a Match, and the SDK runtime that drives a Game's host logic and views over a cloned, versioned wire protocol.

## User Stories

### Playing
1. As a Player on an outer Tile, I want my paddle to follow my finger vertically, so that I can return the ball.
2. As a Player, I want the paddle to stop at the top and bottom of the play surface, so that it never leaves the visible area.
3. As a Player, I want to see the ball cross from one phone to the next with no visible jump or stutter at the bezel, so that the table feels like one screen.
4. As a Player, I want the ball to bounce off the top and bottom edges of the whole Layout, so that the play surface is the whole table, not one phone.
5. As a Player, I want to score when the ball passes my opponent's paddle, so that there is a winner.
6. As a Player, I want the Match to end at seven points with a result that names the winner, so that the round has a clear conclusion.
7. As a person whose phone is a middle Tile, I want to see the ball and both paddles pass over my screen, so that I am part of the table even without a paddle.
8. As a Player, I want the ball to be served from the middle toward the player who just lost the point, so that play resumes fairly.
9. As a Player, I want every phone to draw the ball at the same physical place at the same moment, so that the illusion of one surface holds.
10. As a Player, I want the ball and paddles to have the same physical size on every phone regardless of its pixel density, so that the game looks consistent across mixed devices.

### Lobby and Match start
11. As a Host, I want to pick a template and see the arrangement preview on every phone before starting, so that everyone places their phone correctly.
12. As a Host, I want to press Start once the table is arranged, so that the Match begins on every phone at once.
13. As a Host, I want Start to be refused when the game's manifest cannot be satisfied by the phones present (too few Tiles, a Tile smaller than the minimum), with a reason, so that I know what to change.
14. As a Host, I want the two Players to be the people on the outer phones by default, so that I don't have to configure anything for Pong.
15. As a Host, I want to name Players, so that the result names people rather than phone ids.
16. As a Peer, I want my phone to switch from the preview to the Match the moment the Host starts, so that nobody has to tap anything.
17. As a Host, I want to abort a running Match from the platform overlay, so that we can go back to the lobby.
18. As anyone, I want every phone to return to the lobby when the Match ends, so that we can play again without rejoining.
19. As a Host, I want a late phone that joins after Start to wait in the lobby, so that the running Match is never disturbed.

### Robustness
20. As a Player whose phone briefly loses the connection, I want the Match to pause on every phone and show who dropped, so that nobody plays into a frozen opponent.
21. As a Player whose phone reconnects, I want the Match to resume where it paused with my phone in its old place, so that we don't restart.
22. As a Player, I want the Match to resume only after the host re-sends the current state, so that nothing I see is stale.
23. As a Player, I want a game bug (a thrown error in the game's code) to be isolated — logged, not crashing the platform — so that one bad frame doesn't end the party.
24. As a Player, I want the screen to stay awake and the game loop to stop when the tab is hidden, so that the phone neither sleeps mid-game nor burns battery in the background.
25. As a Host, I want the game to keep real time when the Host tab stalls for a moment (a notification, a stutter), with at most a short catch-up and no spiral of death, so that the Match recovers instead of freezing.

### Identity
26. As a Device, I want a stable identity across reconnects and page reloads, so that the Session recognises me as the same phone.
27. As a Host, I want a reconnecting phone to take over its old roster entry rather than appear as a new phone, so that the Layout and Match stay valid.
28. As a Host, I want messages from a stale connection of a phone that has since reconnected to be dropped, so that no duplicate input arrives.
29. As a Player, I want a stable Player identity issued by the platform, so that a future stats server can recognise me.

### Game author
30. As a game author, I want to write a game as one module with a host factory and a view factory, so that I learn one function.
31. As a game author, I want my host logic to receive a fixed-step tick with `dt` and the shared time, so that physics is deterministic in step size.
32. As a game author, I want every touch to arrive at my host logic already in world millimetres with the Device and Player that produced it and a shared timestamp, so that I never do pixel math or clock math.
33. As a game author, I want to publish state whenever I choose and have it reach every view, so that I control my wire rate.
34. As a game author, I want to publish private state to one Device, so that a Controller can show a hand without others seeing it.
35. As a game author, I want views to receive each state with the host time it was produced, so that I can extrapolate on the shared clock.
36. As a game author, I want a `draw` callback with a canvas context already cleared and transformed to world millimetres, so that my view is a few lines of drawing.
37. As a game author, I want a `mount` alternative that gives me a DOM root, so that a Controller view can be ordinary HTML.
38. As a game author, I want to opt out of SDK pointer capture, so that a DOM view handles its own buttons.
39. As a game author, I want to see my own Device's input locally before the host echoes it, so that I can predict.
40. As a game author, I want to declare the Device roles and Player counts my game supports in a manifest, so that the lobby refuses impossible tables.
41. As a game author, I want to assign and query which Player holds a Controller, so that pass-the-phone games work.
42. As a game author, I want pause and resume callbacks, so that I can stop extrapolating while paused.
43. As a game author, I want a pause-aware timer, so that turn clocks don't run while paused.
44. As a game author, I want to omit `tick` entirely, so that a turn-based game has no loop.
45. As a game author, I want to end the Match with scores and a ranking, so that the platform shows a result.
46. As a game author, I want a `log` that reaches the platform's console or HUD, so that I can debug on a phone.
47. As a game author, I want any non-serialisable value I publish to fail immediately and identically in-process and in an iframe, so that "works on my machine" means "works sandboxed".
48. As a game author, I want a headless test harness that runs my game over the real in-process link with a fake clock and scripted input, so that I can test scoring without a browser.
49. As a game author, I want the SDK to depend only on layout math and never on the transport, so that my game cannot accidentally reach the network.
50. As a game author, I want my game source to be unchanged when the platform switches from in-process to iframe links, so that M3 costs me nothing.

### Platform maintainer
51. As a maintainer, I want one Session interface for Host and Peer keyed by Device identity, so that the app has no host/peer branches for sending, receiving, or reading the roster.
52. As a maintainer, I want the layout package free of any transport dependency, so that the SDK's dependency graph is pure math.
53. As a maintainer, I want a versioned, discriminated wire protocol between game and platform, so that a protocol mistake fails loudly rather than silently.
54. As a maintainer, I want a full Match (Host + three Peers) to run in one test process over the in-memory transport, so that regressions in input routing, pause, and reconnect are caught without phones.
55. As a maintainer, I want the Host's own Tile to be an ordinary view with no shortcut path, so that there is one code path for views.
56. As a maintainer, I want every error inside a game to reach the app only as an event, so that the app never catches exceptions from game code.

## Implementation Decisions

Vocabulary follows the glossary (Session, Device, Host, Peer, Tile, Layout, Surface, World, Game, Match, Player, Controller, Holder, Input). Binding ADRs: 0002 (host-authoritative star, host loss ends the Session), 0003 (state stream, no determinism), 0004 (sandboxed data-only seam), 0005 (world millimetres). The authoritative interface definitions are the SDK design document and the platform design document; this spec records the decisions, not the full type listings.

### Work order
Four steps, each leaving the app runnable with M1 behaviour intact until the last: (1) decouple the layout package from core; (2) the core Session with Device identity; (3) the pwa Device identity persistence, Lobby, and HUD cut-over; (4) the SDK package, Pong, and wiring the Lobby to the Match runner.

### Layout package
- The device-size identifier becomes a plain string (it is a Device id); the layout package drops its dependency on core.
- The layout publish/subscribe helpers are deleted; the layout validator stays as a pure function. Publishing the layout is the Lobby's job.

### Core: Session
- One `Session` interface replaces the two session classes. Two factories produce it: one for the Host, one for a Peer. Both take a Transport (never create one), the local Device's info, and an optional local-clock function.
- `DeviceInfo` gains `deviceId`. The caller supplies it; core does not persist anything.
- The interface exposes: `self`, `role`, `status` (searching / syncing / ready; a Host is always ready), `clock.now()`, `roster()` (Host first, immutable snapshot entries with `info`, `present`, and sync summary), `send(channel, data, toDeviceId?)`, `onMessage(channel, handler(data, fromDeviceId))`, `onChange`, `onDeviceLost`, `onDeviceBack`, `close`.
- Hidden inside: the hello/info/clock channels, the PeerId↔DeviceId map, rebinding (a joining Device whose id is already in the roster takes over that entry; its previous PeerId is forgotten; `onDeviceBack` fires instead of a roster growth), dropping messages from unknown or stale PeerIds, demultiplexing application channels from session channels.
- Invariants: a Peer's `send` before `ready` is dropped; a lost Device stays in the roster with `present: false` for the Session's life; the Host leaving flips Peers to `searching` with an empty roster (the Session is over, per ADR-0002).
- PeerId and Transport remain exported from core for adapter construction only; nothing above core uses PeerId.

### PWA: Device identity, Lobby, HUD
- The pwa persists a UUID `deviceId` in local storage and passes it in `DeviceInfo`. A Player id is likewise a platform-issued persisted UUID on the Device that seats that Player (Pong: one Player per outer Tile).
- The Lobby is a module over a Session with one interface for both roles: live `layout` preview, `match` (set once, frozen), `setTemplate`, `setRole`, `setPlayers`, `start(manifest)`, `close`. On a Peer the setters are no-ops and `match`/`layout` arrive from the Host.
- `start` validates the manifest against the roster (Tile/Controller/Player ranges, minimum Tile size, supported templates), builds `MatchInfo` (matchId, seed, tickHz, players, devices with roles and Tiles, tiles in Layout order, bounds), freezes it, and broadcasts it. Devices that join after `start` stay in the lobby until the next Match.
- The HUD renders from the Lobby and the Session; the M1 grid scene becomes the lobby's placement preview on the stage. The main entry reduces to: transport → session → lobby → match runner → back to lobby on end.
- Default Player assignment for Pong: the Devices on the two outer Tiles; names editable in the HUD.
- The pwa owns the pause trigger: `onDeviceLost` of any Match Device → pause with that Device named; `onDeviceBack` → resume. Host abort is a platform overlay action.

### SDK package
- Depends on the layout package only. Core is a dev dependency for the end-to-end test alone.
- Game-facing: `defineGame({ manifest, host(ctx) → handlers, view(ctx) → handlers })`; the factories are the init. Host context: `match`, `now()`, `publish(state, to?)`, `setHolder`, `holderOf`, `timer(tag, delayMs | null)`, `end(result)`, `log`. Host handlers (all optional): `tick(dt seconds, now ms)`, `onInput`, `onMessage`, `onHolder`, `onTimer`, `onPause`, `onResume`, `dispose`. View context: `match`, `deviceId`, `role`, `tile?`, `surface?`, `screenMm`, `dpr`, `root`, `now()`, `latest()`, `holder()`, `send`, `log`. View handlers (all optional): `draw(frame)`, `mount(root)`, `onState`, `onInput` (local echo), `onHolder`, `onPause`, `onResume`, `onEnd`, `dispose`, `input: 'coalesced' | 'off'`.
- `Frame` for `draw`: a cleared context transformed so one unit is one millimetre (world mm on a Tile, screen mm on a Controller), `now`, `state`, `t` (host time of the state), `bounds`, `tile?`, `screenMm`.
- `Input` always carries `world` (Tile: world mm; Controller: its own screen mm), `deviceId`, `role`, `playerId?`, `pointerId`, `phase`, `t`.
- Platform-facing: `runMatch({ link, match, self: { deviceId, pxPerMm, mount }, now, send(frame, toDeviceId?), onEvent, authority? })` returning `{ deliver(frame, fromDeviceId), setPaused(reason | null), stop(reason) }`. `authority: true` on the Host opens a host link and a view link through the same factory. `send`/`deliver` are closures supplied by the pwa from the Session; the SDK never sees Transport or PeerId.
- Link port: `{ post, onFrame, close }` produced by a link factory per side. M2 ships the in-process adapter only; it `structuredClone`s every frame in both directions. The iframe adapter is M3 and must need no change to games or to `runMatch`'s interface.
- Wire protocol: every frame carries `v: 1` and a discriminant `t`. Down to host: init, tick, input, msg, timer, reject, plus shared holders/clock/pause/resume/close. Down to view: init, state, plus shared. Up from host: ready, publish, set-holder, timer, end, fault, log. Up from view: ready, input, send, fault, log. The frames that cross between Devices are the non-local subset of the view grammar (state, holders, pause, resume, close down; input, send up).
- Clock across the link: `epochOffset = shared.now() − Date.now()` at send; the game side anchors once on its own monotonic clock and slews later corrections at most 2 % rate, never stepping backwards. Sent at init, every ~2 s, and on resume.
- Ordering: `ready` is the only up frame before `init`; `init` exactly once; no `tick` between `pause` and `resume`; `holders` precedes the first input stamped with the new Holder; per Device and pointer the host runtime enforces down → move* → up|cancel, drops orphans, and emits synthetic cancels on pause, drop, or close. Up frames after close are dropped.
- Authority: the host runtime overwrites `deviceId`/`role` from the channel the frame arrived on and stamps `playerId` from its Holder map at ingest; views cannot forge.
- Retention and replay: last broadcast state and last per-Device state retained; a late-ready view gets them at once; on resume they are re-posted before the first tick.
- Fixed step: `dt = 1 / tickHz` from an accumulator on the Host's animation frame; at most 5 catch-up steps per frame then the remainder is dropped; pause clears the accumulator; per step: drain inbound in arrival order, tick, flush outbound; hooks never fire during tick. `tickHz` 0 or no `tick` handler means an event-driven host.
- Paused: no ticks, no draw; inbound input dropped; timers freeze with their remaining delay; publish accepted and retained.
- Errors: version mismatch, unknown or out-of-order frame, factory throw, more than three faults in five seconds, no `ready` within five seconds → close with the matching reason; bad set-holder/timer or publish-after-end → reject frame, state unchanged; a throw in `draw` skips the frame and ten consecutive close that view. All reach the pwa as `MatchEvent`s only.
- Performance: at most one move per pointer per animation frame and one input frame per view per frame; down/up/cancel never coalesced; one clone per crossing; draw stops while hidden or paused; publish is never coalesced or rate-limited.
- Test harness exported from the SDK: `createTestMatch({ game, match })` driving the in-process link with a fake clock and scripted input, exposing tick, input, per-Device state, and result.

### Pong
- One module, manifest: tiles 2–4, controllers 0, players 2, template row. Paddles on the first and last Tile in Layout order; each outer Tile's input moves that Tile's paddle, clamped to the Layout bounds. Ball in world mm with velocity in mm/s; bounces off Layout top/bottom and off paddles; a miss scores for the other Player, serve toward the loser; first to seven ends the Match with scores and ranking. Host re-publishes on resume. Views draw the whole World and extrapolate the ball by at most 100 ms on the shared clock; the Tile transform clips.
- Pong imports only the SDK.

### Rejected (from the design round)
Auto-published state with a cadence, automatic JSON-path interpolation, capability negotiation, state slots, holder regions, open role/frame unions, binary payloads, a transport port inside the SDK, live-mutated holder fields, a required tick.

## Testing Decisions

A good test drives a module through its interface and asserts observable outcomes: frames a Device received, a roster snapshot, a Match event, a result. It never inspects runtime internals, message channel names, or PeerIds, and it survives an internal refactor. Existing tests whose assertions pin the old session shape are deleted, not kept alongside.

Seams and what is asserted at each:

1. **End-to-end Match over the SDK and the in-memory transport** (primary). Host plus three Peers (three Tiles, one Controller) in one vitest process, fake timers, a stepped animation frame, a recording probe game built with `defineGame`. Asserts: ticks fan out to every view including the Host's own; a Tile touch arrives at the host in world mm with the right Device; after `setHolder` a Controller touch arrives stamped with that Player; dropping a Peer pauses host and every view with no ticks or state in between; reconnecting under a new PeerId with the same Device id resumes after a re-publish; `end` yields an `ended` event with the scores; a non-serialisable publish fails at the call site; a thrown handler surfaces as a `fault` event and a factory throw as a close.
2. **Session over the in-memory transport.** Roster converges by Device id with sync true; `send` to a Device id arrives only there with the sender's Device id; lost then back with the same id keeps roster length and rebinds delivery; stale-PeerId messages dropped; Host leaves → Peer searching with empty roster. Replaces the session half of the existing clock test file; the clock estimator tests stay.
3. **Lobby over a Session.** `start` refuses an unsatisfiable manifest with a reason; the Peer's lobby receives a `MatchInfo` deep-equal to the Host's; setters after `start` are ignored; a Device joining after `start` is not in the Match.
4. **Pong through the SDK test harness.** Paddle follows input and clamps; ball bounces at bounds and paddles; a miss scores and serves toward the loser; seventh point ends with the right ranking.

Prior art: the existing session tests already use the in-memory hub with a latency model and fake timers; the layout tests already assert continuity across a bezel gap and transform round-trips — both patterns carry over. Layout tests are unchanged. No DOM tests; the HUD and the live game are verified by the two-browser-tab smoke run used for M0/M1, and then on two real phones.

## Out of Scope

- The iframe link adapter, sandboxing, and the link conformance suite across both adapters (M3).
- Loading game bundles from a URL; the games directory template for community games (M3).
- Cross-bezel swipe alignment (M4); QR-SDP offline signalling, PWA install (M5).
- Unreliable or binary channels; measurement-driven encoding changes.
- Controllers in Pong (manifest allows none); Controller UI; pass-the-phone games.
- Multiple Players per Device; spectator views; mid-Match joins.
- The stats server, leaderboards, accounts; Player identity beyond a persisted id.
- Visual design of the lobby and overlays (the current look is scaffolding; the product design pass is separate).
- Calibrated px-per-mm; the UA heuristic remains.

## Further Notes

- Reference documents: the SDK design (`docs/sdk-design.md`) is the authoritative interface and wire protocol; the platform design (`docs/platform-design.md`) is the authoritative Session and Lobby interface and the work order. Where this spec and those differ, the design documents win and this spec should be corrected.
- The pong snapshot cost at 60 Hz to three Peers is roughly 36 KB/s host upload; JSON stays until real phones are measured (ADR-0003).
- Smoke acceptance for the milestone, in addition to the tests: two browser tabs then two real phones (one iOS, one Android) on one Wi-Fi — the ball crosses the bezel with no visible jump, paddles respond on the outer phones, pulling one phone's connection pauses both and reconnecting resumes.
