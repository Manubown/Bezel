# API reference

Every export of `@mgc/sdk` (`packages/sdk/src/index.ts`) and `@mgc/sdk/test` (`packages/sdk/src/testing.ts`), with signatures copied from the source. Times are shared-clock milliseconds, `dt` is seconds, lengths are world millimetres unless a line says otherwise ([concepts](concepts.md#units)).

- [Game-facing](#game-facing): what a Game imports.
- [Platform-facing](#platform-facing): what `apps/pwa` uses to run a Match; a Game never calls these.
- [Testing](#testing-mgcsdktest): `@mgc/sdk/test`.

## Game-facing

### `defineGame`

```ts
export function defineGame<S extends JsonValue, M extends JsonValue>(spec: GameSpec<S, M>): Game;
```

Returns `spec` typed as a `Game`. A Game module does `export default defineGame<State, Message>({ … })`; `S` is the published state, `M` the view→host message (`never` if views send none).

### `GameSpec<S, M>`, `Game`

```ts
export interface GameSpec<S extends JsonValue, M extends JsonValue> {
  manifest: Manifest;
  host(ctx: HostContext<S, M>): HostHandlers<M>;
  view(ctx: ViewContext<S, M>): ViewHandlers<S, M>;
}
export type Game = GameSpec<JsonValue, JsonValue>;
```

| Member | Semantics |
|---|---|
| `manifest` | what the Game needs; the lobby checks it before Start |
| `host(ctx)` | runs once, on the Host; it is the init; its handlers run only after it returned. A throw closes the Match |
| `view(ctx)` | runs once per Device, the Host included. A throw closes that view only |

### `Manifest`, `Range`

```ts
export interface Manifest {
  id: string;
  name: string;
  version: string;
  tiles: Range;
  controllers: Range;
  players: Range;
  templates?: ('row' | 'column' | 'grid')[];
  minTileMm?: { w: number; h: number };
  bots?: boolean;
  seats?: 'ends' | 'tiles' | 'controllers';
  tickHz?: number;
  host: string;
  view: string;
}
export interface Range { min: number; max: number; }
```

| Field | Semantics |
|---|---|
| `id` | unique among Games; `mgc.<slug>` by convention. Two Games with one id stop the PWA from loading |
| `name` | shown on the Game's card in the Host's Game list and on "Start <name>"; in Maker mode the list is sorted by it |
| `version` | the Game's version string |
| `tiles`, `controllers`, `players` | inclusive ranges the lobby enforces; `players` counts bots |
| `templates` | the arrangements the Game can be played in; absent: any. Picking the Game lays the phones in the first; the Host's sheet offers only these, and only when there are two or more |
| `minTileMm` | the smallest Tile the Game accepts |
| `bots` | default `false`; `true`: the Host may make a Player slot a bot and the host game plays every `Player.bot` |
| `seats` | default `'ends'`: the lobby seats at most two Players, at the first and the last Tile, a bot in either slot when `bots` allows. `'controllers'`: one Player per Controller phone, seated at it, no bots ([concepts](concepts.md#seats-and-bots)) |
| `tickHz` | default 60; `0` = event-driven host, no `tick` |
| `host`, `view` | bundle entry paths for M3; may be the same file. Unused while Games run in-process |

### `HostContext<S, M>`

```ts
export interface HostContext<S extends JsonValue, M extends JsonValue> {
  readonly match: MatchInfo;
  now(): number;
  publish(state: S, to?: DeviceId): void;
  setHolder(controller: DeviceId, playerId: PlayerId | null): void;
  holderOf(controller: DeviceId): PlayerId | null;
  timer(tag: string, delayMs: number | null): void;
  end(result: MatchResult): void;
  log(...args: unknown[]): void;
}
```

| Member | Semantics |
|---|---|
| `match` | the frozen Match, identical on every Device |
| `now()` | shared clock, ms |
| `publish(state, to?)` | sends `state` to every view, or to Device `to` alone. One call = one wire frame, never coalesced. `TypeError` if not plain JSON. Stamped with the step's `now` inside `tick`, else `now()`. While paused it is kept, and views get the last ones on resume. After `end` in the same turn: refused (`publish rejected: the Match has ended`) |
| `setHolder(controller, playerId)` | hands a Controller to a Player (`null`: nobody). `onHolder` follows on host and views; input and messages from that Controller carry the new Holder from then on. A non-Controller or unknown Player is refused with a log line |
| `holderOf(controller)` | the Holder as of the last accepted `setHolder`, at once; `null` for nobody or a Tile |
| `timer(tag, delayMs)` | calls `onTimer(tag, now)` after `delayMs`; the same tag replaces, `null` cancels; paused time does not count. A delay that is not a finite number ≥ 0 is refused |
| `end(result)` | ends the Match on every Device with `result`; afterwards only `dispose` runs. `TypeError` if not plain JSON |
| `log(...args)` | to the Host's console and HUD game log (shown in Maker mode, `?maker`): JSON values as they are, an `Error` as its stack, anything else as text. Never throws |

### `HostHandlers<M>`

```ts
export interface HostHandlers<M extends JsonValue> {
  tick?(dt: number, now: number): void;
  onInput?(i: Input): void;
  onMessage?(msg: M, from: Sender): void;
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;
  onTimer?(tag: string, now: number): void;
  onPause?(reason: PauseReason): void;
  onResume?(now: number, pausedMs: number): void;
  dispose?(): void;
}
```

| Handler | Semantics |
|---|---|
| `tick(dt, now)` | fixed step, `dt = 1 / tickHz` s, `now` the step's shared time. Never while paused; restarts at the resume's `now`. Without it, or with `tickHz` 0, the host is event-driven |
| `onInput(i)` | every input in arrival order, before the step's `tick` (at once when event-driven). Per Device and pointer: `down → move* → (up \| cancel)`. A pause sends a `cancel` for every open pointer before `onPause` |
| `onMessage(msg, from)` | a view's `send`, in arrival order with input; `from` is stamped by the platform. Sent while paused: dropped |
| `onHolder(controller, playerId)` | a Controller's Holder changed; what arrived before it was stamped with the previous Holder |
| `onTimer(tag, now)` | a timer elapsed; `now` is the shared time it was due |
| `onPause(reason)` | the Match paused: no `tick`, input, message or timer until `onResume`. Again if the reason changes; `onResume`'s `pausedMs` counts from the first |
| `onResume(now, pausedMs)` | the Match resumed at `now`; `pausedMs`: how long the Match stood still on the shared clock, from the first pause; shift your deadlines by it, or use a timer (timers are pause-aware already). A Game that publishes only on change re-publishes here |
| `dispose()` | the Match closed; last call |

### `ViewContext<S, M>`

```ts
export interface ViewContext<S extends JsonValue, M extends JsonValue> {
  readonly match: MatchInfo;
  readonly deviceId: DeviceId;
  readonly role: 'tile' | 'controller';
  readonly tile?: Tile;
  readonly surface?: Surface;
  readonly screenMm: Vec2;
  readonly pxPerMm: number;
  readonly dpr: number;
  readonly root: HTMLElement;
  readonly sound: boolean;
  now(): number;
  latest(): { state: S; t: number } | undefined;
  holder(controller?: DeviceId): PlayerId | null;
  send(msg: M): void;
  log(...args: unknown[]): void;
}
```

| Member | Semantics |
|---|---|
| `match` | the frozen Match |
| `deviceId`, `role` | this Device and its role |
| `tile`, `surface` | Tiles only: this Device's rectangle in world mm and its world ↔ px mapping (`surface.worldToPx` places DOM elements over world points) |
| `screenMm` | this Device's own screen, mm; a Controller's input and `draw` use it (origin top-left) |
| `pxPerMm` | CSS px per mm on this Device, for DOM sized in mm (CSS `mm` units are not physical on phones): the user-agent guess times the page's zoom (`apps/pwa/src/device.ts:73-83`, `141`) |
| `dpr` | the device pixel ratio, read live |
| `root` | an SDK-owned element (`position:absolute; inset:0`) the view may fill; `mount` gets the same element |
| `sound` | whether this Device plays sound: its person's setting on it (the Host's sheet, a Peer's strip), on by default. Read live: it can change during a Match. While `false` play no tone and no vibration ([Concepts: sound](concepts.md#sound)) |
| `now()` | shared clock, ms |
| `latest()` | the last state this view applied, of either kind (broadcast or published to this Device alone), and its host time; a view that needs both keeps its own from `onState` |
| `holder(controller?)` | who holds that Controller (default: this Device) as the platform last said; `null` for nobody or a Tile |
| `send(msg)` | to the host's `onMessage`, stamped with this Device and, on a Controller, its Holder. `TypeError` if not plain JSON. Dropped while paused |
| `log(...args)` | to this Device's console (and the HUD on the Host). Never throws |

### `ViewHandlers<S, M>`

```ts
export interface ViewHandlers<S extends JsonValue, M extends JsonValue> {
  draw?(f: Frame<S>): void;
  mount?(root: HTMLElement): void;
  onState?(state: S, t: number): void;
  onInput?(i: Input): void;
  onHolder?(controller: DeviceId, playerId: PlayerId | null): void;
  onPause?(reason: PauseReason): void;
  onResume?(now: number, pausedMs: number): void;
  onEnd?(r: { reason: CloseReason; result?: MatchResult }): void;
  dispose?(): void;
  input?: 'coalesced' | 'off';
}
```

| Member | Semantics |
|---|---|
| `draw(f)` | every animation frame on the SDK's canvas, except while paused or while the page is hidden. A throw skips the frame; 10 in a row close this view |
| `mount(root)` | the DOM alternative to `draw` (both may be used; the canvas lies below): called once, right after the factory |
| `onState(state, t)` | a state arrived; `t` is its host time |
| `onInput(i)` | this Device's own input as it leaves for the host: local echo for prediction |
| `onHolder(controller, playerId)` | any Controller's Holder changed; a Controller's own view checks `controller === ctx.deviceId` |
| `onPause(reason)` | `draw` stops (the canvas keeps its last frame) until `onResume`. Again if the reason changes |
| `onResume(now, pausedMs)` | the kept states arrived just before (`latest()` is current); extrapolate from `max(t, now)`. `pausedMs`: how long the Match stood still on the shared clock, from the first pause, the same as the host's; shift your deadlines by it. A Peer's view started during the pause hears the pause from the Host's answer to its runtime's `hello`, so it gets `onPause` first, unless the resume came before that answer |
| `onEnd({ reason, result? })` | the Match closed; `result` when the host ended it. `dispose` follows |
| `dispose()` | last call |
| `input` | `'coalesced'` (default): the SDK captures pointers on `root` (`touch-action: none`, pointer capture), maps px to mm, sends at most one move per pointer per frame. `'off'`: no capture; a DOM view handles its own events |

### `Frame<S>`

```ts
export interface Frame<S extends JsonValue> {
  ctx: CanvasRenderingContext2D;
  now: number;
  state: S | undefined;
  t: number;
  bounds: Rect;
  tile?: Tile;
  screenMm: Vec2;
}
```

| Field | Semantics |
|---|---|
| `ctx` | cleared, and transformed so 1 unit = 1 mm: world mm on a Tile, screen mm on a Controller |
| `now` | shared time of this frame |
| `state` | the latest state, `undefined` before the first |
| `t` | host time of `state` (`now` before the first); extrapolate with `now - t` |
| `bounds` | `match.bounds` |
| `tile` | this Device's Tile (absent on a Controller) |
| `screenMm` | this Device's screen, mm |

### Match data

```ts
export type DeviceId = string;
export type PlayerId = string;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export type Tile = Rect & { deviceId: DeviceId; rot: number };   // x,y: the screen's top-left corner in the World; w,h: the screen's own size. Not the world box when rot ≠ 0
export interface Player {
  playerId: PlayerId;
  name: string;
  deviceId?: DeviceId;
  bot?: true;
}
export interface Device {
  deviceId: DeviceId;
  role: 'tile' | 'controller';
  name: string;
  tile?: Tile;
  screenMm: Vec2;
}
export interface MatchInfo {
  matchId: string;
  seed: number;
  tickHz: number;
  players: readonly Player[];
  devices: readonly Device[];
  tiles: readonly Tile[];
  bounds: Rect;
}
export interface MatchResult {
  scores?: Record<PlayerId, number>;
  ranking?: PlayerId[];
}
export interface Sender {
  deviceId: DeviceId;
  role: 'tile' | 'controller';
  playerId?: PlayerId;
}
export interface Input extends Sender {
  pointerId: number;
  phase: 'down' | 'move' | 'up' | 'cancel';
  t: number;
  world: Vec2;
}
export type PauseReason = { kind: 'device-lost'; deviceId: DeviceId } | { kind: 'platform'; note?: string };
export type CloseReason = 'ended' | 'aborted' | 'version' | 'protocol' | 'fault' | 'link-lost';
```

| Type | Semantics |
|---|---|
| `JsonValue` | everything that crosses the seam: plain JSON, no `undefined`, no non-finite numbers |
| `Tile` | a Device's rectangle in world mm; `rot` radians, clockwise about `(x, y)`, the screen's top-left corner |
| `Player` | a participant. `deviceId`: the Device that seats them (never on a bot). `bot`: the host game plays them; only with manifest `bots` |
| `Device` | one phone in the Match; `tile` present iff `role === 'tile'`; `screenMm` its own screen |
| `MatchInfo` | frozen at Start, identical everywhere. `seed`: for the Game's randomness. `tiles`: Layout (Tile) order. `bounds`: box around every Tile |
| `MatchResult` | what `end` reports; the result card names `ranking[0]` the winner, else sorts by `scores` ("Draw" on equal top scores, "Game over" with neither), and reads two sides that both scored in one line ("Ana wins 7–5", "Draw, 3–3"): omit `ranking` for a draw |
| `Sender` | who sent an input or message, stamped by the Host; `playerId` is a Controller's Holder when it has one |
| `Input` | one pointer sample. `t`: shared time at capture, not monotone across Devices. `world`: world mm on a Tile, the Controller's screen mm (origin top-left) on a Controller |
| `PauseReason` | why the Match paused; `apps/pwa` pauses with `device-lost` |
| `CloseReason` | why a Match or view closed: the host ended it, the Host aborted it, a wire version mismatch, a protocol error, the fault ladder, or a lost link |

### `playerColour`

```ts
export function playerColour(position: number): string;   // the colour of match.players[position]: '#ff6b4a' coral, '#2ec4b6' teal, '#a98bff' violet, '#c2e05a' lime; past the fourth they repeat
```

A Player's colour is the one of their place in `match.players`, the same on every Device and in the platform's screens; nothing on the wire carries it. The four are the night table's `--player-1` … `--player-4` (`packages/look/tokens.css`), and a test keeps them equal. `playerColour` throws a `RangeError` for a position that is not a whole number from 0 ([concepts](concepts.md#players-colours-and-the-own-tile)).

### `Surface`, `Rect`, `Vec2` (re-exported from `@mgc/layout`)

```ts
export type Vec2 = { x: number; y: number };   // type aliases, not interfaces: they are JsonValue and may appear in a state
export type Rect = { x: number; y: number; w: number; h: number };
export class Surface {
  constructor(rect: DeviceRect, pxPerMm: number);   // DeviceRect = { id: string; x: number; y: number; w: number; h: number; rot: number }
  readonly rect: DeviceRect;
  readonly pxPerMm: number;
  localToWorld(p: Vec2): Vec2;
  worldToLocal(p: Vec2): Vec2;
  worldToPx(p: Vec2): Vec2;
  pxToWorld(p: Vec2): Vec2;
  worldAabb(): Rect;
  applyTo(ctx: CanvasRenderingContext2D, dpr: number): void;
}
```

| Member | Semantics |
|---|---|
| `localToWorld`, `worldToLocal` | the screen's own mm (origin top-left, x right, y down) ↔ world mm |
| `worldToPx`, `pxToWorld` | world mm ↔ CSS px on this screen |
| `worldAabb()` | the axis-aligned world box the screen covers (exact when `rot` is 0) |
| `applyTo(ctx, dpr)` | sets the context's transform so drawing is in world mm; the SDK does this before every `draw` |

`DeviceRect` is not exported by `@mgc/sdk`; pass an object literal (`packages/layout/src/surface.ts`, `packages/layout/src/types.ts:16-25`).

## Platform-facing

`apps/pwa` runs a Match with these (`apps/pwa/src/main.ts:177-221`). A Game does not import them; they are listed so the seam is complete.

### `runMatch`

```ts
export function runMatch(o: MatchOptions): MatchHandle;

export interface MatchOptions {
  link: LinkFactory;
  match: MatchInfo;
  self: { deviceId: DeviceId; pxPerMm: number; mount: HTMLElement };
  now(): number;
  send(frame: NetFrame, to?: DeviceId): void;
  onEvent(e: MatchEvent): void;
  authority?: boolean;
  sound?: boolean;
}
export interface MatchHandle {
  deliver(frame: NetFrame, from: DeviceId): void;
  setPaused(reason: PauseReason | null): void;
  hello(): void;
  setSound(on: boolean): void;
  stop(reason: 'aborted' | 'link-lost'): void;
}
```

Runs one Device's part of a Match: its view, plus the host side with `authority`. Throws only when misused (`runMatch: Device … is not in Match …`, `runMatch: mount is not in a window`); everything a Game does arrives as a `MatchEvent`.

| Member | Semantics |
|---|---|
| `link` | opens each side of the Game (`inProcessLink` today) |
| `match` | the frozen Match from the lobby |
| `self` | this Device, its px per mm, and the positioned element the view fills (its window drives animation frames and the dpr) |
| `now()` | the shared clock (`session.clock.now`) |
| `send(frame, to?)` | forwards a frame over the Transport. Host: `to` omitted = every other Device. Peer: always for the Host |
| `onEvent(e)` | every `MatchEvent` on this Device |
| `authority` | `true` on the Host: also runs the host side |
| `sound` | this Device's sound setting as the Match starts, what its view reads as `ctx.sound`; default `true` |
| `deliver(frame, from)` | a frame off the Transport; `from` is the Device whose channel carried it |
| `setPaused(reason \| null)` | Host only: pause everywhere, or resume with `null` (the `resume` frame carries `pausedMs`) |
| `hello()` | Peer only (a no-op on the Host): asks the Host again for every Holder (if any is set), this Device's retained states, and the pause while paused. The view link sends it by itself when it opens, so a page that starts mid-Match draws the current state; the platform calls it on re-attach with the runtime still running. The Host ignores it from a Device outside the Match |
| `setSound(on)` | this Device's sound setting changed: its view reads the new one as `ctx.sound` at once, and a view that opens later starts with it. Nothing crosses to other Devices |
| `stop(reason)` | closes this Device's part; on the Host, the Match on every Device |

### `MatchEvent`

```ts
export type MatchEvent =
  | { t: 'started' }
  | { t: 'paused'; reason: PauseReason }
  | { t: 'resumed' }
  | { t: 'holders'; holders: HolderEntry[] }
  | { t: 'ended'; result: MatchResult }
  | { t: 'closed'; reason: CloseReason; detail: string }
  | { t: 'view-closed'; reason: CloseReason; detail: string }
  | { t: 'fault'; where: string; message: string; stack?: string }
  | { t: 'log'; side: 'host' | 'view'; args: JsonValue[] };
```

| Event | Semantics |
|---|---|
| `started` | every link this Device opens is open |
| `paused` | the Match paused; again when the reason changes |
| `resumed` | the Match resumed |
| `holders` | a Controller changed hands; every Controller's Holder |
| `ended` | the host game ended the Match with `result`; `closed` follows |
| `closed` | this Device's part is over; `detail` says why in words. Nothing follows |
| `view-closed` | Host only: its own view closed; the Match goes on |
| `fault` | a game handler threw; `where` is `side.handler` (`host.tick`, `view.draw`, …) |
| `log` | `ctx.log(...)` on this Device, or the host runtime refusing a host game's request (`publish rejected: …`) |

### `HolderEntry`, `RawInput`

```ts
export interface HolderEntry {
  deviceId: DeviceId;
  playerId: PlayerId | null;
}
export type RawInput = Omit<Input, 'deviceId' | 'role' | 'playerId'>;
```

`HolderEntry`: one Controller's Holder, as `holders` events and frames carry it. `RawInput`: an input as a view sends it, before the Host stamps the sender.

### `inProcessLink`

```ts
export function inProcessLink(load: () => Promise<{ default: Game }>): LinkFactory;
```

The link adapter used in M2 and in tests: the Game runs in this page, but every frame is `structuredClone`d both ways and delivered asynchronously in order, as `postMessage` would. The iframe adapter is M3 and not implemented.

### Wire protocol

```ts
export const WIRE_VERSION = 1;
export interface Link {
  post(f: Down): void;
  onFrame(h: (f: Up) => void): () => void;
  close(): void;
}
export type LinkFactory = (o: { side: 'host' | 'view'; root?: HTMLElement }) => Promise<Link>;
export interface ClockWire {
  epochOffset: number;
  sentAt: number;
}
export type RejectOf = 'publish' | 'set-holder' | 'timer' | 'end';
```

| Export | Semantics |
|---|---|
| `WIRE_VERSION` | the protocol version a game side announces in `ready`; a mismatch closes with `version` |
| `Link` | the platform's end of one link: post Down frames, hear Up frames, close |
| `LinkFactory` | opens a link for one side; a view link gets the `root` to draw in |
| `ClockWire` | `epochOffset = shared.now() − Date.now()` at send; `sentAt` the shared time at send |
| `Shared` | Down frames both sides get: `holders`, `clock`, `pause`, `resume`, `close` |
| `HostDown` | platform → host game: `Shared`, `init`, `tick`, `input`, `msg`, `timer`, `reject` |
| `ViewDown` | platform → view: `Shared`, `init` (with this Device's `sound`), `state`, `sound` (the setting changed) |
| `HostUp` | host game → platform: `fault`, `log`, `ready`, `handlers`, `publish`, `set-holder`, `timer`, `end` |
| `ViewUp` | view → platform: `fault`, `log`, `ready`, `input`, `send`, `hello` (sent by a Peer's runtime, not a game) |
| `Down`, `Up` | `HostDown \| ViewDown`, `HostUp \| ViewUp` |
| `Fault` | a handler threw; `fatal` when that side cannot go on |
| `Log` | `ctx.log` arguments |
| `RejectOf` | which host request a `reject` refuses |
| `NetDown`, `NetUp`, `NetFrame` | the frames that cross between Devices: `state`, `holders`, `pause`, `resume` (with `pausedMs`), `close` from the Host; `input`, `send`, `hello` to it |

The full frame grammar and its ordering rules: `packages/sdk/src/wire.ts` and [`docs/sdk-design.md`](../sdk-design.md) §4–§5.

## Testing (`@mgc/sdk/test`)

```ts
export async function createTestMatch<S extends JsonValue = JsonValue>(o: TestMatchOptions): Promise<TestMatch<S>>;

export interface TestMatchOptions {
  game: Game;
  match: MatchInfo;
  host?: DeviceId;
  pxPerMm?: number;
  sound?: boolean;
}
export interface TestMatch<S extends JsonValue = JsonValue> {
  now(): number;
  tick(ms: number): Promise<void>;
  input(deviceId: DeviceId, phase: Input['phase'], at: Vec2, pointerId?: number): Promise<void>;
  send(deviceId: DeviceId, msg: JsonValue): Promise<void>;
  drawn(deviceId: DeviceId): readonly CanvasOp[];
  setPaused(reason: PauseReason | null): Promise<void>;
  reload(deviceId: DeviceId): Promise<void>;
  setSound(deviceId: DeviceId, on: boolean): Promise<void>;
  state(deviceId: DeviceId): S | undefined;
  latest(deviceId: DeviceId): { state: S; t: number } | undefined;
  result(): MatchResult | undefined;
  events(deviceId: DeviceId): readonly MatchEvent[];
  stop(): Promise<void>;
}
```

A whole Match in one process: `runMatch` on every Device over the in-process link, a headless screen per Device, JSON delivery between Devices, a fake shared clock from 0. `host` defaults to the first Device, `pxPerMm` to 6, `sound` (every Device's setting as the Match starts) to `true`.

| Member | Semantics |
|---|---|
| `now()` | shared time, ms |
| `tick(ms)` | advances the clock one animation frame per fixed step (60 per second without one), firing due timers and letting every frame's frames land |
| `input(deviceId, phase, at, pointerId = 1)` | a pointer event at `at` (Tile: world mm; Controller: screen mm) on the last element the view appended to its root (else the SDK's capture), whatever the position; `at` is not checked against the screen. Then one animation frame at the current time |
| `send(deviceId, msg)` | that Device's view `send`s `msg` to the host game, then everything it set off lands |
| `drawn(deviceId)` | what that view drew in its last frame: every canvas call as `[name, ...args]` (`['fillStyle=', v]` for a property write), after the SDK's clear and world transform. Read it one frame after the state you expect it to show |
| `setPaused(reason)` | the Host platform's pause (`null` resumes); time does not move |
| `reload(deviceId)` | a Peer's page reloads mid-Match: its `runMatch` stops and a new one starts on a fresh screen, its view starting from the Host's answer to its `hello`; the Host does not pause. `drawn`, `state`, `latest`, `events` then read the new page. Throws for the Host |
| `setSound(deviceId, on)` | that Device's person switches its sound: its view reads `on` as `ctx.sound`, and so does the view a `reload` starts there; time does not move |
| `state(deviceId)` | the latest state that view applied |
| `latest(deviceId)` | the same with its host time |
| `result()` | the result once the host game ended the Match |
| `events(deviceId)` | the `MatchEvent`s on that Device, in order |
| `stop()` | aborts the Match if it still runs |

How to use it: [Testing](testing.md).
