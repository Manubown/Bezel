# `@mgc/sdk` — interface design

Decided 2026-11-07 after a design-it-twice round (`.scratch/sdk-design/`: Minimal, Flexible, CommonCase, Ports). Shape from Minimal, wire contract from Ports, `draw(frame)` and always-present `Input.world` from CommonCase, optional `tick` + timers from Flexible. Binding decisions: ADR-0003 (state stream), ADR-0004 (sandboxed data-only seam), ADR-0005 (world mm). Terms: `GLOSSARY.md`.

**One sentence.** A game author writes `defineGame({ manifest, host, view })` with two factories; the platform calls `runMatch(...)` once per Device; the only real seam is the **link** between them, with an in-process adapter (M2, tests) and an iframe adapter (M3) that speak the same versioned wire protocol and both `structuredClone` every frame.

## 1. Shared data

Everything crossing the seam is `JsonValue` (not merely clone-safe: the same payloads cross WebRTC). Lengths are world millimetres, times are shared-clock milliseconds, `dt` is seconds.

```ts
type DeviceId = string; type PlayerId = string;
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
type Vec2 = { x: number; y: number }               // re-exported from @mgc/layout; type aliases, so they are JsonValue
type Rect = { x: number; y: number; w: number; h: number }
type Tile = Rect & { deviceId: DeviceId; rot: number }   // x,y: the screen's top-left corner in the World; w,h: the screen's own size; rot radians, clockwise about (x,y). Not the world box when rot ≠ 0
interface Player { playerId: PlayerId; name: string;
                   deviceId?: DeviceId;    // the Device that seats this Player (Pong: an outer Tile); never on a bot
                   bot?: true }            // a bot: no Device, the host game plays it; only if the manifest has `bots`
interface Device { deviceId: DeviceId; role: 'tile' | 'controller'; name: string;
                   tile?: Tile;            // present iff role === 'tile'
                   screenMm: Vec2 }        // this Device's own screen size
interface MatchInfo {                      // frozen for the Match (no mid-Match joins)
  matchId: string; seed: number; tickHz: number;
  players: readonly Player[]; devices: readonly Device[];
  tiles: readonly Tile[];                  // Layout order; Tile Devices only
  bounds: Rect }                           // Layout bounds
interface Sender { deviceId: DeviceId; role: 'tile' | 'controller'; playerId?: PlayerId }
interface Input extends Sender { pointerId: number; phase: 'down' | 'move' | 'up' | 'cancel';
  t: number;                               // shared clock at capture
  world: Vec2 }                            // Tile: world mm. Controller: its own screen mm, origin top-left
interface MatchResult { scores?: Record<PlayerId, number>; ranking?: PlayerId[] }
type PauseReason = { kind: 'device-lost'; deviceId: DeviceId } | { kind: 'platform'; note?: string };
type CloseReason = 'ended' | 'aborted' | 'version' | 'protocol' | 'fault' | 'link-lost';
interface Manifest { id: string; name: string; version: string;
  tiles: Range; controllers: Range; players: Range;   // Range = { min: number; max: number }
  templates?: ('row' | 'column' | 'grid')[]; minTileMm?: { w: number; h: number };
  bots?: boolean;                          // default false; true: the Host may make a Player slot a bot
  tickHz?: number;                         // default 60; 0 = event-driven host, no tick
  host: string; view: string }             // bundle entry paths; may be the same file
```

## 2. Game-facing interface

```ts
export function defineGame<S extends JsonValue, M extends JsonValue>(spec: GameSpec<S, M>): Game;
interface GameSpec<S, M> { manifest: Manifest;
  host(ctx: HostContext<S, M>): HostHandlers<M>;    // called once, on the Host Device; the factory IS init
  view(ctx: ViewContext<S, M>): ViewHandlers<S, M> } // called once per Device, Host included

interface HostContext<S, M> {
  readonly match: MatchInfo;
  now(): number;
  publish(state: S, to?: DeviceId): void;          // broadcast when `to` omitted; 1:1 with a wire frame
  setHolder(controller: DeviceId, playerId: PlayerId | null): void;
  holderOf(controller: DeviceId): PlayerId | null;
  timer(tag: string, delayMs: number | null): void; // pause-aware; same tag replaces; null cancels
  end(result: MatchResult): void;
  log(...args: unknown[]): void }                   // reaches the platform's console/HUD
interface HostHandlers<M> {
  tick?(dt: number, now: number): void;            // fixed step 1/tickHz; absent or tickHz 0 → never called
  onInput?(i: Input): void;                        // playerId/deviceId stamped by the platform
  onMessage?(msg: M, from: Sender): void;
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;
  onTimer?(tag: string, now: number): void;
  onPause?(reason: PauseReason): void; onResume?(now: number): void;
  dispose?(): void }

interface ViewContext<S, M> {
  readonly match: MatchInfo;
  readonly deviceId: DeviceId; readonly role: 'tile' | 'controller';
  readonly tile?: Tile; readonly surface?: Surface;   // tile only; Surface re-exported from @mgc/layout
  readonly screenMm: Vec2; readonly pxPerMm: number; readonly dpr: number;   // pxPerMm: for DOM sized in mm (CSS mm is not physical on phones)
  readonly root: HTMLElement;                      // SDK-owned element the view may fill (DOM UIs)
  now(): number;
  latest(): { state: S; t: number } | undefined;   // last applied state of either kind (broadcast or to this Device) and its host time
  holder(controller?: DeviceId): PlayerId | null; // that Controller's Holder (default: this Device; a Tile's own: null)
  send(msg: M): void;
  log(...args: unknown[]): void }
interface ViewHandlers<S, M> {
  draw?(f: Frame<S>): void;                        // SDK-owned canvas + rAF; see Frame
  mount?(root: HTMLElement): void;                 // DOM alternative; both allowed
  onState?(state: S, t: number): void;
  onInput?(i: Input): void;                        // this Device's own input, local echo for prediction
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;   // every view, for every Controller
  onPause?(reason: PauseReason): void; onResume?(now: number): void;
  onEnd?(r: { reason: CloseReason; result?: MatchResult }): void;
  dispose?(): void;
  input?: 'coalesced' | 'off' }                    // default 'coalesced'
interface Frame<S> {
  ctx: CanvasRenderingContext2D;   // cleared; transformed so 1 unit = 1 mm (world mm on a Tile, screen mm on a Controller)
  now: number; state: S | undefined; t: number;    // t = host time of `state`; extrapolate with now - t
  bounds: Rect; tile?: Tile; screenMm: Vec2 }
```

Rules a game author must know:
- Handlers run only after the factory returned; async setup must be lazy inside handlers.
- `publish` is never coalesced or rate-limited: the game owns the wire rate (host upload = (N−1) × publish rate, ADR-0002; every frame also carries ~235 B of transport envelope, measured by Snake). The state is copied at the call: a mutation after `publish` in the same handler is not sent. A targeted `publish(s, to)` is retained per Device separately from the broadcast, but a view's `latest()` is simply the last state it applied of either kind: a view that needs both keeps its own from `onState`.
- Extrapolation/prediction is the game's (ADR-0003); `Frame.t` and `latest()` make it one line.
- Pause (shipped in M2 06): between `onPause` and `onResume` the host gets no `tick` and no input, and views do not `draw` (the canvas keeps its last frame). A `publish` while paused is retained, not sent; on resume every view gets the retained states, then `onResume(now)`. The host game gets its `resume` first, so state it publishes in `onResume` follows the retained states. `onPause` comes again with the new reason if the reason changes while paused. A view that started during the pause (a reloaded phone) gets `onResume` without `onPause`. States stamped before the resume's `now` describe the paused moment, so a view extrapolates from `max(t, now)` (Pong does).
- `Input.t` is not monotone across Devices (clock error ≤ 5 ms); never sort inputs by `t` across Devices.
- `setHolder` on a non-Controller or unknown Player is rejected (`reject` frame, logged); the roster is frozen so it is always a bug.
- Seats and bots (seats-and-bots 01; `Manifest.seats`): with `seats: 'controllers'` the lobby makes one Player per Controller phone, seated (`deviceId`) at that Controller, in roster order, no bots (Quiz); with `seats: 'tiles'` one Player per Tile in Tile order, seated at it, then the bots that are on (Tap Race, Breakout). Otherwise (`'ends'`, the default) the Host orders the Tiles in the lobby, and `match.players` lists the Player slots' Players, Player 1 first: slot 0 belongs to the first Tile, slot 1 to the last (with one Tile, slot 1 holds a Player only as a bot). Each is the human seated at that Tile, with its `deviceId`, or a bot (`bot: true`, no `deviceId`, id `bot:<slot>`, name "Bot" unless the Host renamed it). A game reads who sits where from `Player.deviceId`, never from a Player's index, and maps a `Sender.deviceId` to its Player the same way. A bot appears only when the manifest declares `bots: true` (the lobby refuses Start otherwise: "Pass does not support bots"); the host game then plays every bot Player itself. Bots count toward `players`, so a one-Tile Match can hold a human and a bot.
- Controllers, Holders, messages and timers (shipped in M2 08):
  - A Controller's view has no `tile`/`surface`; its `draw` context, its `Input.world` and `t.input` positions are in its own screen mm (origin top-left, `screenMm`). `mount(root)` runs once, right after the factory, with `ctx.root`; a DOM view that handles its own events sets `input: 'off'` (the canvas, if it also draws, lies below).
  - `setHolder` takes effect at once for `holderOf`; the host game hears `onHolder(controller, playerId)` when the platform broadcast it, and so does every view (`onHolder` has the host's signature: every view hears of every Controller, so a Controller's own view checks `controller === ctx.deviceId`). Inputs and messages that reached the Host before the handover come first, stamped with the previous Holder; everything that arrives after it, including what was already on its way, carries the new one. The local echo carries the Holder the Controller's view knew. A `setHolder` to the current Holder changes nothing and fires nothing.
  - `send(msg)` is plain JSON (a `TypeError` at the call site otherwise) and reaches `onMessage(msg, from)` in arrival order with input; `from` is stamped like an input's. A message sent while paused is dropped.
  - `timer(tag, delayMs)` arms (same tag replaces, also one that came due but was not handed over yet), `null` cancels; `onTimer(tag, now)` gets the shared time it was due. Paused time does not count. The delay runs from when the host runtime received the request, so a chain of timers drifts by that latency. A delay that is not a finite number ≥ 0, or a tag that is not a string, is rejected.
  - A host without `tick`, or a manifest `tickHz: 0`, is event-driven: no `tick` ever, and every input, message and timer is handed over as it arrives.
- After `end`, `publish`/`send`/`timer` are dropped with a log line; nothing throws into the game. As shipped (M2 07, M2 08): the host runtime closes the Match only after it has answered every frame the host game posted in the same turn as `end`, so a `publish`, `setHolder`, `timer` or a second `end` there gets a `reject` and a log line on the Host (`"publish rejected: the Match has ended"`) and changes nothing; once the close has reached the game they are dropped.
- Faults (shipped in M2 07): a handler that throws is reported (a `fault` event on that Device's platform, with `where` = `side.handler`, the message and the stack) and the Game goes on. More than three faults within five seconds on one side, or a throw in a factory, close that side: the host's closes the Match on every Device, a view's only that view. A `draw` that throws skips that frame; the first throw of a run is reported, and the tenth frame in a row stops that view's paint loop and closes it. `ctx.log(...)` takes any values (JSON as it is, an `Error` as its stack, anything else as its text) and never throws. `draw` does not run while `document.hidden`.

## 3. Platform-facing interface

```ts
export function runMatch(o: MatchOptions): MatchHandle;
interface MatchOptions {
  link: LinkFactory;
  match: MatchInfo;                                 // the lobby froze it; identical on every Device
  self: { deviceId: DeviceId; pxPerMm: number; mount: HTMLElement };
  now(): number;                                    // core SharedClock.now, bound
  send(frame: NetFrame, to?: DeviceId): void;       // Host: `to` omitted = every other Device. Peer: always for the Host, no `to`
  onEvent(e: MatchEvent): void;
  authority?: boolean }                             // true on the Host: also runs the GameHost
interface MatchHandle {
  deliver(frame: NetFrame, from: DeviceId): void;   // frames arriving off the Transport; `from` = the channel's Device
  setPaused(reason: PauseReason | null): void;      // Host only (no-op on a Peer); broadcast to every Device; same reason again = no-op
  stop(reason: 'aborted' | 'link-lost'): void }
type MatchEvent = { t: 'started' } | { t: 'paused'; reason: PauseReason } | { t: 'resumed' }
  | { t: 'holders'; holders: HolderEntry[] } | { t: 'ended'; result: MatchResult }
  | { t: 'closed'; reason: CloseReason; detail: string }         // this Device's part is over; nothing follows
  | { t: 'view-closed'; reason: CloseReason; detail: string }    // Host only: its own view closed, the Match goes on
  | { t: 'fault'; where: string; message: string; stack?: string }
  | { t: 'log'; side: 'host' | 'view'; args: JsonValue[] };
export function inProcessLink(load: () => Promise<{ default: Game }>): LinkFactory;   // M2 + tests
// M3, not implemented: `@mgc/sdk` does not export it yet.
// export function iframeLink(entries: { host: string; view: string }): LinkFactory;
```

`authority: true` makes `runMatch` open a host link *and* a view link through the same factory: the Host's own Tile is an ordinary view whose frames are cloned like a Peer's. `send`/`deliver` are closures: `@mgc/sdk` never sees `Transport` or `PeerId`; `PeerId ↔ DeviceId` is `@mgc/core`'s (see §8). `MatchInfo` does not name the Host, so a Peer's runtime never addresses it: every frame a Peer sends (its view's `input`, later `send`) is for the Host, and the platform delivers it there (`apps/pwa` sends to `roster()[0]`). The Host takes `NetUp` frames from any Match Device and ignores `NetDown`; a Peer takes only `NetDown`.

`setPaused(reason)` pauses the Match everywhere. Calling it with a different reason while paused sends the new reason to every Device; the pause keeps its original `now`. `setPaused(null)` resumes, and is a no-op when the Match is not paused. Every Device's `runMatch` reports `paused` (again on a new reason) and `resumed` as `MatchEvent`s, so the platform's overlay needs no other channel. When to pause is the platform's decision (§6: `apps/pwa` resumes only when every lost Match Device is back *and* synced).

Holders (shipped in M2 08). The Host's `runMatch` reports `holders` (every Controller's Holder) on each accepted change; a Peer's when the Host's `holders` frame changed what it knew (a Peer back as a new page learns them on the resume). Nothing is reported for the initial "nobody holds it" state.

Fault isolation (shipped in M2 07). Nothing a game does throws out of `runMatch`; only misusing `runMatch` itself (a Device not in the Match, a mount outside a window) throws. Every close reaches the platform as `closed` with a `detail` in words (`"the game ended the Match"`, `"stopped by the platform"`, `"host link: no ready within 5 s"`, `"4 faults within 5 s, the last host.tick: boom"`, `"view.factory: boom"`); a Peer shows the Host's `detail`, which the `close` frame carries. A failure of the host link closes the Match on every Device. A failure of a view link closes that view only: on a Peer that is its whole part (`closed`), on the Host the Match goes on for every other Device and the Host gets `view-closed` (its pointers are cancelled at the host game). `log` events are the game's `ctx.log` lines on this Device, plus the host runtime's line for each request it rejects (`side: 'host'`). On close the host game first gets a `cancel` for every pointer it holds.

## 4. The link port and wire protocol

```ts
interface Link { post(f: Down): void; onFrame(h: (f: Up) => void): () => void; close(): void }
type LinkFactory = (o: { side: 'host' | 'view'; root?: HTMLElement }) => Promise<Link>;
const WIRE_VERSION = 1;
interface ClockWire { epochOffset: number; sentAt: number }          // epochOffset = shared.now() − Date.now()
interface HolderEntry { deviceId: DeviceId; playerId: PlayerId | null }

type Shared =                                                          // in both Down unions
  | { v: 1; t: 'holders'; holders: HolderEntry[] } | { v: 1; t: 'clock'; clock: ClockWire }
  | { v: 1; t: 'pause'; reason: PauseReason; now: number } | { v: 1; t: 'resume'; now: number; clock: ClockWire }
  | { v: 1; t: 'close'; reason: CloseReason; detail?: string; result?: MatchResult };  // detail: why, in words, for the platform
type HostDown = Shared
  | { v: 1; t: 'init'; side: 'host'; match: MatchInfo; holders: HolderEntry[]; clock: ClockWire }
  | { v: 1; t: 'tick'; n: number; dt: number; now: number }           // n strictly +1; now non-decreasing
  | { v: 1; t: 'input'; inputs: Input[] }                             // stamped; ordered per Device
  | { v: 1; t: 'msg'; msg: JsonValue; from: Sender }
  | { v: 1; t: 'timer'; tag: string; now: number }
  | { v: 1; t: 'reject'; of: 'publish' | 'set-holder' | 'timer' | 'end'; reason: string };
type ViewDown = Shared
  | { v: 1; t: 'init'; side: 'view'; match: MatchInfo; self: Omit<Device, 'name'> & { pxPerMm: number };
      holders: HolderEntry[]; clock: ClockWire }
  | { v: 1; t: 'state'; state: JsonValue; at: number; to?: DeviceId };  // `to`: published to this Device alone
type Fault = { v: 1; t: 'fault'; where: string; message: string; stack?: string;
               fatal?: true };                                           // the game side cannot go on: close that link
type Log = { v: 1; t: 'log'; args: JsonValue[] };
type HostUp = Fault | Log
  | { v: number; t: 'ready'; side: 'host'; sdk: string }               // FIRST frame on any link
  | { v: 1; t: 'handlers'; tick: boolean }                            // once, right after the host factory returned (M2 08)
  | { v: 1; t: 'publish'; state: JsonValue; to?: DeviceId; at: number }
  | { v: 1; t: 'set-holder'; deviceId: DeviceId; playerId: PlayerId | null }
  | { v: 1; t: 'timer'; tag: string; delayMs: number | null }
  | { v: 1; t: 'end'; result: MatchResult };
type ViewUp = Fault | Log
  | { v: number; t: 'ready'; side: 'view'; sdk: string }
  | { v: 1; t: 'input'; inputs: RawInput[] }                          // RawInput = Omit<Input, 'deviceId'|'playerId'|'role'>
  | { v: 1; t: 'send'; msg: JsonValue };
type Down = HostDown | ViewDown; type Up = HostUp | ViewUp;

/** Between Devices over the platform Transport: the subset of the view grammar that is not local. */
type NetDown = Extract<ViewDown, { t: 'state' | 'holders' | 'pause' | 'resume' | 'close' }>;
type NetUp   = Extract<ViewUp,  { t: 'input' | 'send' }>;
type NetFrame = NetDown | NetUp;
```

Flows:

| When | Frame | Path |
|---|---|---|
| game module loaded | `ready` (with `v`, `sdk`) | game → platform, first on every link |
| `ready.v === WIRE_VERSION` | `init` | platform → game, exactly once |
| the host factory returned | `handlers` (whether it has `tick`) | host game → host runtime; the first step waits for it, and without `tick` (or with `tickHz` 0) there are none |
| every fixed step, running, host link | `tick` | platform → host game |
| each rAF with pending pointer samples | `input` | view game → view runtime → net → host runtime (stamps) → host game |
| `ctx.publish` | `publish` → `state` | host game → host runtime → net (and loopback) → view games |
| `ctx.send` | `send` → `msg{from}` | view game → net → host runtime (stamps) → host game |
| `set-holder` accepted | `holders` | host runtime → host game, its own view, and every Peer (whose runtime passes it to its view when it changed what it knew); on a resume again to every Peer while any Controller has a Holder |
| `ctx.timer` elapsed | `timer` | host runtime → host game (with input before the next step's `tick`; at once when event-driven); never while paused |
| `setPaused` / resume | `pause`, then `resume`+`clock` | host runtime → host game, net, every view; a Peer's runtime replaces the `resume`'s `clock` with its own before posting it to its view |
| every ~2 s | `clock` | each Device's runtime → its local game(s) |
| `end`, `stop`, fault budget, fatal fault, version mismatch, protocol error, no `ready` | `close` (with `detail`) | runtime → game(s), net; a view link's failure closes that view only |
| a handler throws | `fault` (`fatal` from a factory, or the tenth `draw` in a row) | game → its runtime → `fault` event on that Device |
| `ctx.log(...)` | `log` | game → its runtime → `log` event on that Device |
| a host request the runtime refuses (M2 07: `publish`/`end` after `end`; M2 08: `set-holder` naming a non-Controller, an unknown Device or Player; `timer` with a non-string tag or a delay that is not a finite number ≥ 0; either after `end`) | `reject` | host runtime → host game, plus a `log` event on the Host |

Clock: `epochOffset = shared.now() − Date.now()` at send. The game-side runtime anchors once on receipt (`shared0 = Date.now() + epochOffset`, `p0 = performance.now()`) and returns `shared0 + performance.now() − p0`, so an iframe's private time origin is irrelevant and `now()` keeps sub-ms steps. Later `clock` frames slew ≤ 2 % rate, never a backwards step. Identical code on both adapters.

## 5. Invariants, ordering, errors, performance

- **Ordering.** `ready` is the only Up frame before `init`; `init` is the only Down frame until `ready` is seen. No `tick` between `pause` and `resume`. `holders` precedes the first `input`/`msg` stamped with the new holder; an input in flight during a handover is stamped with the *new* holder. Per `(deviceId, pointerId)` the host runtime enforces `down → move* → (up | cancel)`, drops orphans (and a second `down` on an open pointer), and emits a synthetic `cancel` for every open pointer on pause, Device drop, or close. Up frames after `close` are dropped. As shipped (M2 06), a pause drops the inputs accepted but not yet delivered, then sends one `input` frame of `cancel`s for every pointer the host game holds open (its `down` delivered, its end not), each at the pause's `now` and its last delivered `world`, and only then `pause`. Every pointer counts as closed afterwards, so a finger still held across the resume is an orphan until its next `down`. A Device drop always pauses in `apps/pwa`. As shipped (M2 07), a close does the same right before the `close` frame (at the close's time), and when the Host's own view closes alone, the same happens for the Host Device's pointers only.
- **Holders, as shipped (M2 08).** The host runtime stamps `playerId` at ingest from its holder map, so an input or message carries the Holder of the moment it reached the Host. An accepted `set-holder` first hands the host game everything already accepted (stamped with the previous Holder), then posts `holders` to the host game, its own view and the net, so the host game sees one clean cut: before `onHolder`, the previous Holder; after it, the new one, including what was on its way during the handover. A `set-holder` to the current Holder posts nothing. Views hear `holders` a network hop after the host game; a Controller's local echo carries the Holder its view knew.
- **Authority.** The host runtime overwrites `deviceId`/`role` (from the authenticated channel) and `playerId` (from its holder map) on every inbound `input`/`send` at ingest. A view cannot forge another Device's input.
- **Retention and replay.** The host runtime retains the last broadcast state and the last per-Device state. A view that becomes `ready` late receives them at once (no iframe-load race); on `resume` they are re-posted to every view *before* the first tick, so a game that ignores `onPause`/`onResume` is still correct. A `state` frame carries `to` when it was published to that Device alone, so each Device's runtime keeps its last broadcast and its last targeted state apart; games never see `to`. As shipped: on resume the host game gets `resume` first. Then each Device gets its retained states in arrival order (a Peer over the net, addressed to it), then `resume`, and then steps restart. A view that becomes ready while paused gets `init`, the retained states, then `pause`.
- **Fixed step.** `dt = 1 / tickHz` exactly, driven by an accumulator on the host's rAF; ≤ 5 catch-up steps per animation frame, then the remainder is dropped (`now` jumps forward). Pause clears the accumulator: the rAF stops, and steps restart from the resume's `now` (the first tick is one step after it, with no catch-up for the paused time). Per step: drain inbound `input`/`msg`/`timer` in arrival order, then `tick`, then flush outbound. Inputs accepted since the previous step leave as one `input` frame right before the step's `tick` (the first step of a catch-up burst); with `tickHz` 0 each arriving batch leaves at once. Hooks never fire *during* `tick`. As shipped (M2 08): nothing reaches the host game, and no step runs, until its `handlers` frame says whether it has `tick`; with `tick` and `tickHz` > 0 it steps, otherwise it is event-driven (no `tick` frame ever; each input batch, message and due timer is handed over as it arrives). Runs of inputs in the inbox go as one `input` frame, each message and timer as its own frame, all in arrival order.
- **Paused.** No ticks, no `draw`; inbound input is dropped (a paddle must not teleport on resume); pending timers freeze with their remaining delay; `publish` is accepted and retained. As shipped: the view's paint loop stops, so its canvas keeps its last frame. The view still captures and sends input (its own flush frame runs without the paint loop), and the host runtime drops it at ingest. As shipped (M2 08): a pause first hands over the messages and due timers already accepted (after the cancels), then freezes every armed timer with what it has left at the pause's `now`; no `timer` frame goes while paused; a timer set while paused starts counting at the resume; on resume every frozen timer runs on from the resume's `now`. Messages sent while paused are dropped at ingest, like input.
- **Errors.** `ready.v ≠ WIRE_VERSION` → `close{'version'}`. Unknown or out-of-order frame → `close{'protocol'}`. A throw in any game handler is caught game-side and reported as `fault`; a throw in a factory, or > 3 faults in 5 s, → `close{'fault'}`. No `ready` within 5 s of `open()`, or iframe unload → `close{'link-lost'}`. Bad `set-holder`/`timer`/`publish`-after-`end` → `reject`, state unchanged. A throw in `draw` skips the frame; 10 consecutive → that view closes. Every one of these reaches `apps/pwa` only as a `MatchEvent`; nothing throws across the seam. As shipped (M2 07), per link, in the platform's `GameLink`:
  - The 5 s for `ready` run from the moment the platform opens the link (calls the factory), so a module that never loads is `link-lost` too; a factory that throws or rejects is `link-lost` at once. A `ready` from the wrong side, or any other frame first, is `protocol`. A link that fails before `ready` gets no `close` frame (it never got `init`).
  - After `ready`: a frame with `v ≠ 1`, a second `ready`, a `t` the link does not know, an `input` that fails `isNetUp`, or a malformed `fault`/`log` is `protocol`.
  - The fault budget counts per link on the platform's monotonic clock: the fourth fault within any 5 s closes the link with `"N faults within 5 s, the last <where>: <message>"`. A `fault` with `fatal` closes it at once with `"<where>: <message>"`. The game side sends `fatal` when a factory throws or returns no handlers object, when a view with `draw` has no window or no Canvas2D, and on the tenth `draw` throw in a row; it reports only the first throw of a `draw` run (each counts toward the budget), so a `draw` that throws on every other frame is closed by the budget.
  - A host-link failure closes the Match on every Device. A view-link failure closes that view only: a Peer's `closed`, or the Host's `view-closed` (the Match goes on).
  - After the host game's `end`, the host runtime closes the Match on a microtask, so every frame the host game posted in the same turn is answered first: a `publish` or second `end` gets `reject{of, reason}` and a `log` event, and changes nothing. The in-process link delivers a handler's frames in one batch; the iframe adapter (M3) must post them in one message per flush to keep this.
  - As shipped (M2 08), the refusals read `set-holder rejected: d1 is a Tile, not a Controller`, `… "d9" is not a Device of the Match`, `… "p-zed" is not a Player of the Match`, `timer rejected: "turn" needs a delay of 0 ms or more, not NaN`, and `… the Match has ended` in the turn of `end`. The game side checks `setHolder` with the same rule (`holders.ts`), so a refused one leaves `holderOf` as it was. A second `handlers` frame is `protocol`.
- **Hidden.** As shipped (M2 07), a view's paint loop runs only while the Match is not paused *and* `document.hidden` is false: it stops on `visibilitychange` to hidden (and never requests another frame while hidden) and restarts when the page is visible again. Input capture and its flush frame are unaffected. The host's fixed-step loop is not stopped by the SDK; a hidden Host tab gets no animation frames from the browser, so its steps stop and the catch-up on return is bounded by the clamp.
- **Performance.** ≤ 1 `move` per `pointerId` per rAF, one `input` frame per view per rAF; `down/up/cancel` never coalesced. The view follows only pointers that went down on it, so a hovering mouse sends nothing; the local echo (`onInput`) runs as the frame leaves, before that animation frame's `draw`. One `structuredClone` per crossing in both adapters. `draw` stops when `document.hidden` or paused. Pong reference: ~200 B state at 60 Hz × 3 Peers ≈ 36 KB/s host upload — JSON only until phones are measured (ADR-0003).

## 6. Usage

### `games/pong/src/index.ts` — the whole game, imports `@mgc/sdk` only

```ts
import { defineGame, type MatchInfo, type Player, type Vec2 } from '@mgc/sdk';
const R = 3.5, PAD = { w: 4, h: 30, inset: 6 }, SPEED = 150, WIN = 7;                 // mm, mm/s: PONG.ball, .paddle, .speed, .win
const BOT = { speed: 160, aimError: 20 };                                              // mm/s, mm
type S = { ball: Vec2 & { vx: number; vy: number }; pads: [number, number]; score: [number, number] };
type M = never;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const fold = (p: number, lo: number, hi: number) => {                                  // p bounced between lo and hi
  const span = hi - lo, u = (((p - lo) % (2 * span)) + 2 * span) % (2 * span);
  return u <= span ? lo + u : hi - (u - span);
};
// Side 0 (west): the Player seated at the first Tile; side 1 (east): the one at the last; a bot takes the side left.
// Never a Player's index in `match.players`.
function seats({ players, tiles }: MatchInfo): [Player, Player] {
  const west = players.find((p) => !p.bot && p.deviceId === tiles[0]!.deviceId);
  const east = players.find((p) => !p.bot && p !== west && p.deviceId === tiles.at(-1)!.deviceId); // one Tile: its human is west
  const rest = players.filter((p) => p !== west && p !== east);
  return [west ?? rest.shift()!, east ?? rest.shift()!];
}

export default defineGame<S, M>({
  manifest: { id: 'mgc.pong', name: 'Pong', version: '1.0.0', tiles: { min: 1, max: 4 },   // one Tile: a human and a bot
    controllers: { min: 0, max: 0 }, players: { min: 2, max: 2 }, templates: ['row'], bots: true,
    host: './index.js', view: './index.js' },
  host(ctx) {
    // Across: the Layout bounds. Up and down: only the band every Tile covers (a row centres Tiles on the
    // tallest, so a tall Tile in the middle would otherwise carry the ball off its neighbours' screens).
    const b = ctx.match.bounds, tiles = ctx.match.tiles;
    const y0 = Math.max(...tiles.map((t) => t.y)), y1 = Math.min(...tiles.map((t) => t.y + t.h));
    const mid = { x: b.x + b.w / 2, y: (y0 + y1) / 2 };
    const sides = seats(ctx.match), ids = sides.map((p) => p.playerId);
    const fingers = sides.map((p) => (p.bot ? undefined : p.deviceId));                 // the Device that moves each paddle
    const pads: [number, number] = [mid.y, mid.y], score: [number, number] = [0, 0];
    let ball = { ...mid, vx: SPEED, vy: SPEED * 0.4 }, aim = 0;                        // aim: how far off a bot goes for this shot
    const serve = (dir: number) => { ball = { ...mid, vx: SPEED * dir, vy: (Math.random() - 0.5) * SPEED }; aim = 0; };
    const ret = () => { ball.vx *= -1; aim = (Math.random() * 2 - 1) * BOT.aimError; };
    const hit = (y: number) => Math.abs(ball.y - y) < PAD.h / 2 + R;
    const face = [b.x + PAD.inset + PAD.w + R, b.x + b.w - PAD.inset - PAD.w - R] as const;
    const snap = (): S => ({ ball: { ...ball }, pads: [pads[0], pads[1]], score: [score[0], score[1]] });
    return {
      onInput(i) {
        const s = fingers.indexOf(i.deviceId);                                          // a Device that seats no side: ignored
        if (s >= 0) pads[s] = clamp(i.world.y, y0 + PAD.h / 2, y1 - PAD.h / 2);
      },
      onResume() { ctx.publish(snap()); },
      tick(dt) {
        for (const s of [0, 1] as const) if (sides[s].bot) {                            // toward where the ball will cross its face
          const coming = s === 0 ? ball.vx < 0 : ball.vx > 0;                           // else back to the centre
          const goal = coming ? fold(ball.y + (ball.vy * (face[s] - ball.x)) / ball.vx, y0 + R, y1 - R) + aim : mid.y;
          pads[s] += clamp(goal - pads[s], -BOT.speed * dt, BOT.speed * dt);            // never faster than BOT.speed
        }
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if ((ball.y < y0 + R && ball.vy < 0) || (ball.y > y1 - R && ball.vy > 0)) ball.vy *= -1;
        if (ball.x < face[0] && ball.vx < 0 && hit(pads[0])) ret();
        if (ball.x > face[1] && ball.vx > 0 && hit(pads[1])) ret();
        if (ball.x < b.x - R || ball.x > b.x + b.w + R) {
          const scorer = ball.x < b.x ? 1 : 0;
          if (++score[scorer] >= WIN) return ctx.end({ scores: { [ids[0]!]: score[0], [ids[1]!]: score[1] }, ranking: [ids[scorer]!, ids[1 - scorer]!] });
          serve(scorer === 0 ? 1 : -1);
        }
        ctx.publish(snap());
      },
    };
  },
  view() {
    return {
      draw({ ctx: g, state: s, now, t, bounds: b }) {
        if (!s) return;
        const k = Math.min((now - t) / 1000, 0.1);                                      // extrapolate ≤ 100 ms
        g.fillStyle = '#f2f0ea';
        g.fillRect(b.x + PAD.inset, s.pads[0] - PAD.h / 2, PAD.w, PAD.h);
        g.fillRect(b.x + b.w - PAD.inset - PAD.w, s.pads[1] - PAD.h / 2, PAD.w, PAD.h);
        g.beginPath(); g.arc(s.ball.x + s.ball.vx * k, s.ball.y + s.ball.vy * k, R, 0, Math.PI * 2); g.fill();
      },
    };
  },
});
```

Every view draws the whole World; its Tile transform clips it. No canvas, DPR, rAF, pointer, px→mm, clock, pause, or link code in the game. (The shipped `games/pong` is this sketch with the same sizes and speeds, plus a short rest before each serve (`PONG.serveWait`), return angles from where the ball meets the paddle, a speed-up on every return (`PONG.speedUp`, up to `PONG.maxSpeed`), and its constants exported as `PONG` for its tests, the bot's as `PONG.bot = { speed, aimError }`. Its randoms come from the Match seed, the bot's aim from a stream of its own so the serves are the same with or without a bot. A bot waits centred while the ball rests before a serve, aims a serve exactly and every returned shot off by up to `aimError`, so it loses a rally now and then. The view draws each side's score on its outer Tile (on a lone Tile, each over its own half) with a small "BOT" under a bot's. It also records `onResume(now)` and extrapolates from `max(t, now)`, so the paused ball is not thrown forward by the pause's length for a frame.)

Touch presence (seats-and-bots 03), Pong's own logic over the plain `onInput`: transport leave detection takes 10–13 s, so a human must keep touching. A human side is present while a pointer is down on its Device's Tile (from its `down` to its `up` or `cancel`) or while its last touch reached the host less than `PONG.presence.holdMs` (5000 ms, `ctx.now()` against the step's `now`) ago; a bot's side always is, and a Device that seats no side counts for nobody. Each `tick`, after the bots have moved, lists the human sides that are not present in `PongState.hold`; while any is listed the host publishes and returns, so the ball stays where it is, its serve rest does not run and nothing scores, while the paddles still follow their fingers and a bot settles toward its goal. The first serve waits the same way until every human has touched (`started` is false until play first runs). The step after a listed side's touch plays on from where the ball stopped, without a re-serve. Every view draws the hold from the state alone: it does not extrapolate a held ball, and on every Tile it shades a band with "<name>, touch your screen" for each listed side ("<name>, touch to start" before the first serve). The platform's device-lost pause is separate and unchanged; its synthetic `cancel`s count as the last touch, so after a pause longer than `holdMs` play holds until every human touches again.

### `games/pass/src/index.ts` — a Controller passed between Players (the reference for Controllers, Holders, timers and an event-driven host)

Pass the phone: one Device is a Controller, the rest Tiles. The manifest says `controllers: { min: 1, max: 1 }` and `tickHz: 0`, and the host has no `tick`. The host factory hands the Controller to the first Player (`setHolder`) and arms `timer('turn', 5000)`; each `onTimer('turn')` hands it to the next Player, and after three rounds `end`s with the taps as scores. The Controller's view is DOM: `input: 'off'` and a `mount(root)` that fills the root with one button whose `pointerdown` calls `send('tap')`; it relabels itself on `onHolder` and `onState` from `holder()` and `latest()`. The host's `onMessage(msg, from)` credits `from.playerId`, the Player who held the Controller when the tap reached the Host, and `ctx.log`s it (`"Ann tapped (1)"`), as `onHolder` logs each handover. A pause freezes the turn's timer; the host's `onPause`/`onResume` move the published turn end by the paused time. The Tiles `draw` whose turn it is, the seconds left and the taps, each on its own Tile.

### `apps/pwa` call site (`apps/pwa/src/main.ts`; every Device runs it, `authority` on the Host)

```ts
import { GAMES } from './games';                            // every games/*/src/index.ts, found by import.meta.glob (games.ts)
const host = () => session.roster()[0]?.info.deviceId;
const game = GAMES.find((g) => g.manifest.id === lobby.game);   // the Game the Host started; none here: this phone sits the Match out
const handle = runMatch({
  link: inProcessLink(() => Promise.resolve({ default: game })),   // M3: an iframe adapter (not implemented)
  match,                                                    // frozen by the lobby, sent to Peers on the lobby channel
  self: { deviceId, pxPerMm: self.pxPerMm, mount: gameLayer },     // gameLayer: the positioned #game element over the stage
  now: () => session.clock.now(),
  // A Peer's frames are for the Host alone; the Host's go where its runtime says. Core maps DeviceId → PeerId.
  send: (frame, to) => session.send(MATCH_CHANNEL, frame, session.role === 'host' ? to : host()),
  onEvent: (e) => { /* console, game log, pause and close cards: see below */ },
  authority: session.role === 'host',
});
session.onMessage(MATCH_CHANNEL, (data, from) => {
  // Down frames originate on the Host only; the runtimes check what they take.
  if (current && (session.role === 'host' || from === host())) current.handle.deliver(data as NetFrame, from);
});
// Host: pause on the loss of a Match Device; resume once every lost one is back *and* synced (apps/pwa/src/pause.ts).
if (session.role === 'host') unfollow = pauseOnDeviceLoss(session, match, handle);
```

As shipped, `apps/pwa` does not resume on the bare `onDeviceBack`. A returning phone is usually a new page. It starts its `runMatch` only once its Session is `ready`, so that the Match runs on the Host's clock, and its Session gets `ready` only after `onDeviceBack` has fired on the Host. Resuming at `onDeviceBack` would send the retained states to a page that has no `runMatch` yet, and the Host would play on while that phone shows nothing. So the Host resumes on the roster change that reports the returning Device synced. By then the new page runs its part, gets the retained states, then `resume`. With several Devices lost, the pause names the first one still missing.

As shipped (M2 07), `apps/pwa`'s `onEvent` writes `fault` (with its stack) and `log` events to the console and keeps them, with every close, as the game log the Host's HUD shows (`gamelog.ts`); `closed` puts its reason on a card on every phone (`describeClose`, or the result when the Game ended it) and returns to the lobby; the Host's `view-closed` shows a notice over its empty Tile while the Match goes on. Each Device holds a screen wake lock from its first touch in a Match until the Match closes (`wake.ts`).

As shipped (M2 08), the Host's sheet picks the Game and marks Devices as Controllers (`lobby.setRole`). The lobby state carries the started Game's manifest id (`lobby.game`), and every Device runs the module with that id, so the Peers load what the Host started. Since dev-onboarding 01 the list is `GAMES` from `apps/pwa/src/games.ts`: every `games/*/src/index.ts` default export, found by `import.meta.glob`, `games/_template` left out, sorted by manifest `name`; a module that does not default-export a Game, or two Games with one manifest `id`, throw when the page loads.

## 7. What the seam hides

Clock transport and monotone re-derivation; pointer capture (`touch-action: none`, pointer capture, DPR and root-rect offsets, px→mm via `Surface`, per-frame coalescing, `t` stamping, lifecycle repair, synthetic cancels, opt-out); the holder map and `playerId` stamping; the pause state machine, tick suppression, timer freezing; retention and replay; canvas creation, resize, `Surface.applyTo`, clear, rAF, hidden-tab pausing; the fixed-step accumulator and its clamp; fan-out including the Host's own loopback view; fault isolation and the close ladder; iframe creation, `ready` handshake, clone enforcement, teardown. Not hidden, on purpose: state semantics, prediction, lobby, role assignment, Transport.

## 8. Dependencies, adapters, tests

| Dependency | Category | Treatment |
|---|---|---|
| `@mgc/layout` `Surface`/`Vec2`/`Rect` | in-process | direct dependency, re-exported; no adapter |
| game ↔ platform link | remote-but-owned | **real seam**: `Link` + `inProcessLink` (M2 production and test adapter) + an iframe adapter (M3, not implemented) |
| cross-Device transport, roster, `PeerId ↔ DeviceId` | the platform's | **no port**: `send`/`deliver` closures on `MatchOptions`/`MatchHandle` |
| shared clock | data | `now()` in, `ClockWire` across the link |
| DOM / rAF / pointer events | local-substitutable | used directly; `runMatch` needs a `mount` in a window (it throws `runMatch: mount is not in a window` otherwise), so tests mount every view on `headlessScreen().mount` (`packages/sdk/src/headless.ts`: stepped animation frames, elements that take listeners, recording canvases) |

**Prerequisites in existing packages (part of M2):**
- `@mgc/layout` must stop depending on `@mgc/core`: `DeviceSize.id: string`; move `channel.ts` (`publishLayout`/`subscribeLayout`, the only `Transport` user) into `apps/pwa`.
- `@mgc/core` owns Device identity: `DeviceInfo.deviceId` (persisted UUID), `HostSession` keeps `PeerId ↔ DeviceId` and rebinds a returning Device to its new `PeerId`; the pwa gets `session.send(channel, data, to?: DeviceId)` / `onMessage(channel, (data, fromDeviceId))` / `onDeviceLost` / `onDeviceBack`. `@mgc/sdk` is reachable only through these closures and never imports `@mgc/core` at runtime.

**Tests at the interface.**
1. *Link conformance*: a table of frame sequences replayed against both adapters asserting identical game-visible effects; proves M2 ≡ M3.
2. *End-to-end*: `packages/sdk/test/match.e2e.test.ts`, `pause.e2e.test.ts`, `faults.e2e.test.ts` and `controllers.e2e.test.ts` — `MemoryHub` (core as devDependency) + 4 `runMatch` handles (3 Tiles, 1 Controller, `authority` on d0) cross-delivering frames, fake clock, stepped rAF, a recording probe game built with `defineGame`; the harness wires the Host's pause policy as the app does, can drop a Peer's tab and bring it back as a new page under a new peer id, and can wrap any Device's link factory (`tapLink`: record what the platform posts, rewrite or swallow what a game sends, inject frames). Asserts: ticks fan out to every view including the Host's own; world-mm input from a Tile; `playerId`-stamped input from a Controller after `setHolder`; pause on drop (no ticks, no state, no draw; synthetic cancels; input dropped); resume after rebinding (retained states, then `resume`, then the next tick; input on the new connection); a publish while paused delivered on resume; `ended` with scores; one thrown `tick` = one `fault` and the next tick runs, the fourth within 5 s closes the Match everywhere (faults 2 s apart never do); a view factory throw closes only that view (a Peer's `closed`, the Host's `view-closed`); `version` before `init`; `protocol` for an injected second `ready` (that view) or an unknown frame (the Match); `link-lost` 5 s after a link opened without `ready`; `publish`/`end` after `end` → `reject` + `log`, no state; `ctx.log` → `log` on that Device only; cancels at the host game on close. `game-seam.test.ts` (Host alone) adds: nine `draw` throws in a row are skipped and reported once, ten stop the loop and close the view; no `draw` while `document.hidden` (`HeadlessScreen.setHidden`). `controllers.e2e.test.ts` (M2 08; the probe also records `onMessage`/`onHolder`/`onTimer`, `mount`, and one journal of host and view handler calls in the order they ran) adds: a Controller view has no Tile, draws in screen mm and gets `mount(root)`; its touch arrives without `playerId`, then, in flight during `setHolder`, with the new Holder in screen mm, after the host game and every view heard `onHolder`; `setHolder` on a Tile, an unknown Device or Player and bad `timer` delays → `reject` + `log`, `holderOf` unchanged, nothing broadcast, and the same in the turn of `end`; `send` stamped with the Holder at arrival (before / after / in flight across handovers, a Tile's never), dropped while paused; `timer` after 1 s, replaced, cancelled, frozen 600 ms in and fired 400 ms after the resume (one set while paused counts from the resume), with no `timer` frame while paused; `tickHz` 0 and a host without `tick` take input, messages and timers as they land with no `tick` frame ever; a Controller back as a new page learns its Holder before the retained state and `resume`.
3. *Game tests*: `await createTestMatch({ game, match, host?, pxPerMm? })` from `@mgc/sdk/test` runs `runMatch` for every Device of `match` (host default `match.devices[0]`) over the in-process link with a headless screen each and in-memory JSON delivery between Devices, on its own fake clock (shared time starts at 0; no global timers touched). It gives a game author `await t.tick(ms)` (one animation frame per fixed step), `await t.input(deviceId, phase, at, pointerId?)` (a pointer event on the topmost element of that view, so through its own capture or onto a DOM view's own element, `at` in world mm on a Tile / screen mm on a Controller, delivered before the next tick), `await t.setPaused(reason | null)` (the Host platform's call), `t.state(deviceId)` and `t.latest(deviceId)` (that view's `latest()`: the state, and with its host time), `t.result()`, `t.events(deviceId)`, `t.now()`, `await t.stop()` — so "passes in M2" means "serialises in M3". `games/pass/test/pass.test.ts` presses Pass's DOM Controller button this way.

## 9. Rejected

- `state()` auto-publish at a `publishHz` (CommonCase): a second way to publish; the decided contract is explicit `publish`.
- `sample: 'auto'` JSON-path interpolation (CommonCase): silently wrong for delta/event state; prediction is game-owned (ADR-0003).
- Capability negotiation, state slots, holder regions, open `Role`/`Frame` unions, `ArrayBuffer` payloads (Flexible): each a hypothetical seam with one adapter today. Revisit when the first consumer exists; the wire version field is the migration path.
- A net port inside the SDK (`transportNet`, `MatchWire`; Ports/Flexible): the roster already lives in `@mgc/core`; a second home for `PeerId ↔ DeviceId` would split it.
- Live-mutated `ctx.playerId` across realms (Minimal): works only because structured clone rebuilds objects; `holderOf()` + `onHolder` is explicit.
- Required `tick` (Ports): turn-based games have no loop.
