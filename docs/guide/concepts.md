# Concepts

The model a Game is written against. Terms are the ones in [`GLOSSARY.md`](../../GLOSSARY.md); the decisions behind them are the ADRs: [0001 PWA runtime](../adr/0001-web-pwa-runtime.md), [0002 host-authoritative star](../adr/0002-host-authoritative-star.md), [0003 state stream](../adr/0003-state-stream-not-lockstep.md), [0004 sandboxed data seam](../adr/0004-games-sandboxed-behind-data-seam.md), [0005 world millimetres](../adr/0005-world-millimetres.md). The full contract, with every ordering rule, is [`docs/sdk-design.md`](../sdk-design.md); the types in `packages/sdk/src/types.ts` and `packages/sdk/src/game.ts` win where anything disagrees.

## A Game is two factories

```ts
export default defineGame<State, Message>({ manifest, host(ctx) { return { /* HostHandlers */ } }, view(ctx) { return { /* ViewHandlers */ } } });
```

| Part | Runs | Owns |
|---|---|---|
| `host(ctx)` | once, on the Host | the state: takes input, messages and timers, runs `tick`, calls `publish` and `end` |
| `view(ctx)` | once per Device, the Host's own included | the screen: `draw` on the SDK's canvas and/or `mount` a DOM view; sends input (automatic) and messages (`send`) |

Each factory is the init: its handlers run only after it returned, so async setup must be lazy inside handlers (`packages/sdk/src/game.ts:4-8`). `State` and `Message` must be JSON types. A Game imports `@mgc/sdk` only; every Game's test pins that ([testing](testing.md#the-imports-only-mgcsdk-test)).

## Who is who

| Term | In the API | Notes |
|---|---|---|
| Session | (platform only) | the connected Devices; outlives Matches. If the Host leaves, the Session ends (ADR-0002) |
| Device | `Device`, `DeviceId` | one phone; its id is persisted per browser and survives reloads (`apps/pwa/src/device.ts:41-57`) |
| Host | `host(ctx)` runs here | runs the host game and routes everything; there is no host migration |
| Peer | every other Device | talks only to the Host (a star, not a mesh) |
| Tile | `Device.role === 'tile'`, `Tile`, `match.tiles` | a phone lying in the Layout; has a rectangle in world mm |
| Controller | `Device.role === 'controller'` | a phone held in hand; not in the Layout, no Tile, draws in its own screen mm |
| Player | `Player`, `match.players` | a participant; may sit at a Tile (`deviceId`), be a bot (`bot: true`), or sit nowhere |
| Holder | `setHolder`, `holderOf`, `holder()`, `onHolder` | the Player holding a Controller now; the host game decides when it changes |
| Match | `MatchInfo` (`ctx.match`) | one run of one Game, frozen at Start: no joins mid-Match |
| Input | `Input` | one pointer sample, stamped by the platform with who sent it |

## Seats and bots

Where the Players come from is the Game's choice, `Manifest.seats`:

- `'ends'` (default): the lobby seats at most **two** Players, slot 0 at the first Tile and slot 1 at the last Tile in Tile order (`SLOTS = 2`, `apps/pwa/src/lobby.ts:9-10`). Pong, Air Hockey, Tap Race, Snake, Breakout.
- `'tiles'`: one Player per phone on the table, in Tile order, seated at it; the Bot chip adds a bot after them when the manifest has `bots`. Tap Race, Breakout.
- `'controllers'`: one Player per phone the Host marks as a Controller (the "Players' phones" chips), the person holding it, seated at that Controller (`Player.deviceId`); no bots (`apps/pwa/src/lobby.ts:421-430`). Quiz. The Game's host hands each Controller to the Player seated at it (`setHolder`).

For `'ends'`:

- `match.players` lists the slots' Players, Player 1 first. A human is `{ playerId, name, deviceId }`, seated at that Tile; a bot is `{ playerId: 'bot:<slot>', name: 'Bot', bot: true }` with no `deviceId` (`apps/pwa/src/lobby.ts:399-409`, `528-531`).
- Middle Tiles of a row of three or more seat nobody. Controllers are never seated. With one Tile, slot 1 can only be a bot.
- Read who sits where from `Player.deviceId`, never from a Player's index, and map an `Input.deviceId` to its Player the same way (template: `games/_template/src/index.ts:51-52`).
- A Manifest's `players` range counts bots, and the lobby never produces more than two Players, whatever the range says.
- Bots exist only if the manifest says `bots: true`; the host game then plays every `Player.bot` itself (Pong: `games/pong/src/index.ts:90-98` assigns sides, its `tick` moves bot paddles).
- A Player id is issued once per Device id and kept across reloads and Matches (`apps/pwa/src/device.ts:59-71`).
- Holders: every Controller starts with nobody holding it. The host game calls `ctx.setHolder(controller, playerId | null)`; input and messages from that Controller then carry the Holder as `playerId`, stamped when they reach the Host. See [Holders](#holders).

## World, Tiles and the Surface

The **World** is one coordinate space in millimetres shared by all Tiles (ADR-0005): x right, y down. Every `Tile` is a rectangle in it: `x, y` is where the screen's top-left corner lies, `w, h` its size, and `rot` turns the screen's own axes **clockwise, in radians, about that corner** (`packages/sdk/src/types.ts:14-18`, `packages/layout/src/types.ts:16-25`).

- `match.tiles` is the Layout in Tile order (Layout order; the HUD numbers phones 1, 2, …). `match.bounds` is the axis-aligned box around every Tile.
- The lobby's templates (row, column, grid) put a 4 mm gap between phones and always produce `rot: 0` (`packages/layout/src/templates.ts:4-5`, `16`, `27`, `54`). A rotated Tile exists today only in a hand-built `MatchInfo` in a test ([testing](testing.md#rotated-tiles)).
- The **Surface** maps one Device's screen to the World (`packages/layout/src/surface.ts`). Before every `draw` the SDK applies it to the canvas, so a Tile's view draws in world mm and shows only its own part. Every view can simply draw the whole World.

Where a rotated Tile's screen lies in the World:

| `rot` | world box covered by a `w × h` screen with its top-left corner at `(x, y)` |
|---|---|
| `0` | `[x, x + w] × [y, y + h]` |
| `Math.PI / 2` | `[x − h, x] × [y, y + w]` |
| `Math.PI` | `[x − w, x] × [y − h, y]` |
| `-Math.PI / 2` | `[x, x + h] × [y − w, y]` |

The canvas is in world axes, so text drawn on a rotated Tile is rotated with the World. To draw it upright for the person holding that phone, turn the context by the Tile's `rot` at the text's origin, as the lobby preview does (`apps/pwa/src/scene.ts:46-54`):

```ts
g.save(); g.translate(x, y); g.rotate(tile.rot); g.fillText('Your turn', 0, 0); g.restore();
```

A **Controller** has no Tile and no Surface. Its `draw` context and its `Input.world` are in its own screen mm, origin top-left, size `ctx.screenMm`.

The mm are only as good as each phone's `pxPerMm`, which is a guess from the user agent ([running on phones](running-on-phones.md#pxpermm-is-a-guess)).

### Units

| Value | Unit |
|---|---|
| `Input.world` from a Tile | world mm |
| `Input.world` from a Controller | that Controller's screen mm, origin top-left |
| `Frame.ctx` | transformed so 1 unit = 1 mm: world mm on a Tile, screen mm on a Controller |
| `Tile.rot` | radians, clockwise, about `(x, y)` |
| `now`, `t`, `Input.t`, timer delays | shared-clock milliseconds |
| `tick(dt)` | seconds (`dt = 1 / tickHz`) |

## The state stream

The host game runs the Match once, on the Host, and **publishes** state; views draw the latest state they got. There is no lockstep and no determinism requirement (ADR-0003).

- `ctx.publish(state, to?)` sends `state` to every view, or to Device `to` alone. One call is one frame on the wire: never coalesced, never rate-limited, so the Game owns the wire rate. Host upload ≈ (number of Peers) × state size × publish rate (ADR-0002); Pong's ~200 B at 60 Hz to 3 Peers is about 36 KB/s (`docs/sdk-design.md` §5).
- State is plain JSON. `publish`, `send` and `end` throw a `TypeError` at the call site for anything else: `undefined`, `NaN`/`Infinity`, functions, `Map`/`Date`/class instances, cycles (`packages/sdk/src/json.ts`).
- Each state is stamped with a host time: the step's `now` inside `tick`, else `ctx.now()`. A view reads it as `onState(state, t)`, `ctx.latest()`, or `Frame.state` / `Frame.t` in `draw`.
- A view holds **one** latest state: a state published to it alone replaces the last broadcast one and the other way round (`packages/sdk/src/game-side.ts:292-294`).
- Before the first `publish` a view has no state (`Frame.state` is `undefined`) and most views draw nothing. Publish a first state in the host factory (`games/_template/src/index.ts:56-57`).
- Extrapolation and prediction are the Game's. `Frame.now - Frame.t` is how old the state is. States arrive over a reliable, ordered channel, so one lost packet delays every state behind it: a view that draws the last state as it is shows a frozen picture for that long, then a jump. Pong moves the ball on along its path by up to a second of that age, bouncing it off the table's edges and off a paddle that covers it where it reaches the paddle's face (`games/pong/src/index.ts:35`, `284-288`), so a stall does not hide the ball on a Tile it crosses. A view's `onInput` echoes this Device's own input as it leaves, for local prediction.
- Randomness: seed it from `ctx.match.seed` (the same on every Device) so tests are deterministic. Pong's mulberry32 is at `games/pong/src/index.ts:72-82`.

### Ticking or event-driven

| Host | When it runs | Choose it for |
|---|---|---|
| ticking: has `tick`, manifest `tickHz` > 0 (default 60, `apps/pwa/src/lobby.ts:7-8`) | `tick(dt, now)` every `1 / tickHz` s; input, messages and due timers arrive just before the step's `tick` | continuous motion (Pong) |
| event-driven: no `tick`, or `tickHz: 0` | each input, message and timer as it arrives; no steps at all | turns, taps, timers (template, Pass) |

The fixed step runs on the Host tab's animation frames, at most 5 catch-up steps per frame; the rest of a longer stall is dropped (`MAX_CATCH_UP_STEPS`, `packages/sdk/src/match.ts:86`, `366-381`). A Host tab that is hidden gets no animation frames, so its steps stop.

### Input

- Per `(deviceId, pointerId)` the host sees `down → move* → (up | cancel)`; the platform drops anything else (a `move` without a `down`, a second `down`).
- By default (`input: 'coalesced'`) the SDK captures pointers on the view's root, converts px to mm, and sends at most one `move` per pointer per animation frame. A DOM view that handles its own events sets `input: 'off'` and uses `send`.
- `deviceId`, `role` and `playerId` are stamped by the Host from the channel the input came on; a view cannot forge them.
- `Input.t` is the shared time at capture and is not monotone across Devices; never sort inputs from different Devices by `t`.
- A view's `send(msg)` reaches the host's `onMessage(msg, from)` in arrival order with input, stamped like input.

## Holders

- `ctx.setHolder(controller, playerId | null)` takes effect at once for `ctx.holderOf`. The host game then hears `onHolder(controller, playerId)`, and so does every view (each view hears of every Controller; a Controller's own view checks `controller === ctx.deviceId`).
- Input and messages that reached the Host before the change come first, stamped with the previous Holder; everything after carries the new one.
- A Device that is not a Controller, or a Player not in the Match, is refused with a log line on the Host (`packages/sdk/src/holders.ts`); `holderOf` keeps its value. A `setHolder` to the current Holder does nothing.

## Timers

`ctx.timer(tag, delayMs)` calls `onTimer(tag, now)` after `delayMs`, where `now` is the shared time it was due (`packages/sdk/src/match.ts:331-346`).

- The same tag replaces the earlier timer; `null` cancels it.
- Paused time does not count: a pause freezes the delay left, the resume runs it on. A timer set while paused starts counting at the resume.
- A ticking host gets a due timer before the next step's `tick`; an event-driven host gets it at once.
- A tag that is not a string, or a delay that is not a finite number ≥ 0, is refused with a log line (`timer rejected: "turn" needs a delay of 0 ms or more, not NaN`).
- The delay runs from when the host runtime received the request, so a chain of timers drifts by that latency (`docs/sdk-design.md` §2).

Use `ctx.timer` on the host, never `setTimeout`: it is pause-aware and runs on the test clock.

## Pause and resume

The platform pauses a Match when the Host loses one of the Match's Devices, naming it (`{ kind: 'device-lost', deviceId }`), and resumes once every lost Device is back **and** has synced its clock (`apps/pwa/src/pause.ts:12-35`). The Host notices a lost phone after 5 s of silence on its connection (`LOST_MS`, `packages/core/src/session.ts`; the 1 Hz clock pings are the heartbeat, and a phone silent for 2.5 s already shows a weak link in the roster), no longer only when the transport reports it gone 10–13 s later (observed 10.2–12.8 s before, `.scratch/m2-pong-sdk/issues/06-pause-resume.md:158`). Every phone shows "Waiting for <Player>" (or "phone N", "the controller").

While paused (`packages/sdk/src/match.ts:458-498`):

| | Host game | Views |
|---|---|---|
| on pause | a `cancel` for every open pointer, then the messages and due timers already accepted, then `onPause(reason)`; `onPause` again if the reason changes | `onPause(reason)`; `draw` stops, the canvas keeps its last frame |
| meanwhile | no `tick`, no input, no messages, no timers; `publish` is kept, not sent | input and `send` still leave, and the Host drops them |
| on resume | `onResume(now, pausedMs)` first; steps restart at `now` | the kept states arrive (`latest()` is current), then `onResume(now, pausedMs)` |

- `pausedMs` is how long the Match stood still on the shared clock, from the first pause (a reason that changes mid-pause does not restart it), the same on the host and every view. Shift a deadline you keep yourself by it (`turnEndsAt += pausedMs`), or use `ctx.timer`, which is pause-aware already.
- A game that publishes only on change re-publishes in `onResume` (Pong's host: `games/pong/src/index.ts:214-217`).
- A state stamped before the resume describes the paused moment: extrapolate from `max(t, now)`, not from `t` (Pong's view: `games/pong/src/index.ts:276-284`).
- A finger held across a pause is cancelled at the host; its later moves are dropped until it lifts and touches again (`packages/sdk/src/match.ts:304-315`).
- A phone that reloads mid-Match, paused or not, asks the Host for the current picture as its view opens (its runtime's `hello`): the Holders, the kept states for it, and the pause while paused, so it draws the current state at once and a change-only state is not blank until the next change. During a pause it gets `onPause`, then `onResume` with the same `pausedMs` as everyone; if the resume reached it before that answer, `onResume` alone. A state may arrive twice (from the answer and from the resume); apply it as you would once.

## Ending

- `ctx.end({ scores?, ranking? })` closes the Match on every Device. Views get `onEnd({ reason: 'ended', result })`, then `dispose`; every phone shows the result card and returns to the lobby.
- The card names the winner from `ranking`, else from the highest score; equal top scores without a ranking are a draw (`apps/pwa/src/result.ts:3-17`).
- Publish the final state **before** `end`: a `publish`, `setHolder`, `timer` or second `end` in the same turn after `end` is refused with a log line (`publish rejected: the Match has ended`), and after the close it is dropped.
- The Host's "End match" closes the Match with `reason: 'aborted'` ("Match stopped").

## Faults and the close ladder

Nothing a Game throws crosses into the platform; it becomes a `fault` event on that Device and goes to the Host's game log and console. Repeated or fatal faults close a side (`packages/sdk/src/game.ts:10-14`, constants at `packages/sdk/src/match.ts:86-93`, `packages/sdk/src/game-side.ts:18`):

| What happens | Result |
|---|---|
| a handler throws | one `fault` (`where: 'host.tick'`, `'view.onState'`, …); the Game goes on |
| more than `FAULT_LIMIT` (3) faults within `FAULT_WINDOW_MS` (5000 ms) on one side | that side closes with reason `fault` |
| a factory throws, or returns no handlers object | that side closes at once (`fault`) |
| `draw` throws | that frame is skipped; the first throw of a run is reported; `DRAW_FAULTS_TO_CLOSE` (10) frames in a row close the view |
| a side never says `ready` within `READY_TIMEOUT_MS` (5000 ms) | `link-lost` |
| wrong wire version / malformed or unexpected frame | `version` / `protocol` |

Which side closes decides what the players see:

| Side that closes | Effect |
|---|---|
| host | the Match closes on every Device; every phone shows "The game crashed" with the detail (`apps/pwa/src/result.ts:20-27`) |
| a Peer's view | only that phone leaves the Match |
| the Host's own view | the Host shows "The game stopped on this phone"; the Match goes on for the others |

`ctx.log(...)` takes any values and never throws: JSON as it is, an `Error` as its stack, anything else as text. It reaches that Device's console and, on the Host, the HUD's game log.
