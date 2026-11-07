# `@mgc/sdk` — interface design

Decided 2026-11-07 after a design-it-twice round (`.scratch/sdk-design/`: Minimal, Flexible, CommonCase, Ports). Shape from Minimal, wire contract from Ports, `draw(frame)` and always-present `Input.world` from CommonCase, optional `tick` + timers from Flexible. Binding decisions: ADR-0003 (state stream), ADR-0004 (sandboxed data-only seam), ADR-0005 (world mm). Terms: `GLOSSARY.md`.

**One sentence.** A game author writes `defineGame({ manifest, host, view })` with two factories; the platform calls `runMatch(...)` once per Device; the only real seam is the **link** between them, with an in-process adapter (M2, tests) and an iframe adapter (M3) that speak the same versioned wire protocol and both `structuredClone` every frame.

## 1. Shared data

Everything crossing the seam is `JsonValue` (not merely clone-safe: the same payloads cross WebRTC). Lengths are world millimetres, times are shared-clock milliseconds, `dt` is seconds.

```ts
type DeviceId = string; type PlayerId = string;
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
interface Vec2 { x: number; y: number }            // re-exported from @mgc/layout
interface Rect { x: number; y: number; w: number; h: number }
interface Tile extends Rect { deviceId: DeviceId; rot: number }   // rot radians, clockwise about (x,y)
interface Player { playerId: PlayerId; name: string }
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
  readonly screenMm: Vec2; readonly dpr: number;
  readonly root: HTMLElement;                      // SDK-owned element the view may fill (DOM UIs)
  now(): number;
  latest(): { state: S; t: number } | undefined;   // last applied state and its host time
  holder(): PlayerId | null;                       // Controller: current holder; Tile: null
  send(msg: M): void;
  log(...args: unknown[]): void }
interface ViewHandlers<S, M> {
  draw?(f: Frame<S>): void;                        // SDK-owned canvas + rAF; see Frame
  mount?(root: HTMLElement): void;                 // DOM alternative; both allowed
  onState?(state: S, t: number): void;
  onInput?(i: Input): void;                        // this Device's own input, local echo for prediction
  onHolder?(playerId: PlayerId | null): void;
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
- `publish` is never coalesced or rate-limited: the game owns the wire rate (host upload = (N−1) × publish rate, ADR-0002). A targeted `publish(s, to)` is retained per Device separately from the broadcast.
- Extrapolation/prediction is the game's (ADR-0003); `Frame.t` and `latest()` make it one line.
- `Input.t` is not monotone across Devices (clock error ≤ 5 ms); never sort inputs by `t` across Devices.
- `setHolder` on a non-Controller or unknown Player is rejected (`reject` frame, logged); the roster is frozen so it is always a bug.
- After `end`, `publish`/`send`/`timer` are dropped with a log line; nothing throws into the game.

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
  setPaused(reason: PauseReason | null): void;      // Host only; broadcast to every Device
  stop(reason: 'aborted' | 'link-lost'): void }
type MatchEvent = { t: 'started' } | { t: 'paused'; reason: PauseReason } | { t: 'resumed' }
  | { t: 'holders'; holders: HolderEntry[] } | { t: 'ended'; result: MatchResult }
  | { t: 'closed'; reason: CloseReason; detail?: string } | { t: 'fault'; where: string; message: string }
  | { t: 'log'; side: 'host' | 'view'; args: unknown[] };
export function inProcessLink(load: () => Promise<{ default: Game }>): LinkFactory;   // M2 + tests
export function iframeLink(entries: { host: string; view: string }): LinkFactory;     // M3
```

`authority: true` makes `runMatch` open a host link *and* a view link through the same factory: the Host's own Tile is an ordinary view whose frames are cloned like a Peer's. `send`/`deliver` are closures: `@mgc/sdk` never sees `Transport` or `PeerId`; `PeerId ↔ DeviceId` is `@mgc/core`'s (see §8). `MatchInfo` does not name the Host, so a Peer's runtime never addresses it: every frame a Peer sends (its view's `input`, later `send`) is for the Host, and the platform delivers it there (`apps/pwa` sends to `roster()[0]`). The Host takes `NetUp` frames from any Match Device and ignores `NetDown`; a Peer takes only `NetDown`.

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
  | { v: 1; t: 'close'; reason: CloseReason; result?: MatchResult };
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
type Fault = { v: 1; t: 'fault'; where: string; message: string; stack?: string };
type Log = { v: 1; t: 'log'; args: JsonValue[] };
type HostUp = Fault | Log
  | { v: number; t: 'ready'; side: 'host'; sdk: string }               // FIRST frame on any link
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
| every fixed step, running, host link | `tick` | platform → host game |
| each rAF with pending pointer samples | `input` | view game → view runtime → net → host runtime (stamps) → host game |
| `ctx.publish` | `publish` → `state` | host game → host runtime → net (and loopback) → view games |
| `ctx.send` | `send` → `msg{from}` | view game → net → host runtime (stamps) → host game |
| `set-holder` accepted | `holders` | host runtime → host game and **every** view |
| `ctx.timer` elapsed | `timer` | host runtime → host game |
| `setPaused` / resume | `pause`, then `resume`+`clock` | host runtime → host game, net, every view |
| every ~2 s | `clock` | each Device's runtime → its local game(s) |
| `end`, `stop`, fault budget, version mismatch | `close` | runtime → game(s), net |

Clock: `epochOffset = shared.now() − Date.now()` at send. The game-side runtime anchors once on receipt (`shared0 = Date.now() + epochOffset`, `p0 = performance.now()`) and returns `shared0 + performance.now() − p0`, so an iframe's private time origin is irrelevant and `now()` keeps sub-ms steps. Later `clock` frames slew ≤ 2 % rate, never a backwards step. Identical code on both adapters.

## 5. Invariants, ordering, errors, performance

- **Ordering.** `ready` is the only Up frame before `init`; `init` is the only Down frame until `ready` is seen. No `tick` between `pause` and `resume`. `holders` precedes the first `input`/`msg` stamped with the new holder; an input in flight during a handover is stamped with the *new* holder. Per `(deviceId, pointerId)` the host runtime enforces `down → move* → (up | cancel)`, drops orphans (and a second `down` on an open pointer), and emits a synthetic `cancel` for every open pointer on pause, Device drop, or close. Up frames after `close` are dropped.
- **Authority.** The host runtime overwrites `deviceId`/`role` (from the authenticated channel) and `playerId` (from its holder map) on every inbound `input`/`send` at ingest. A view cannot forge another Device's input.
- **Retention and replay.** The host runtime retains the last broadcast state and the last per-Device state. A view that becomes `ready` late receives them at once (no iframe-load race); on `resume` they are re-posted to every view *before* the first tick, so a game that ignores `onPause`/`onResume` is still correct. A `state` frame carries `to` when it was published to that Device alone, so each Device's runtime keeps its last broadcast and its last targeted state apart; games never see `to`.
- **Fixed step.** `dt = 1 / tickHz` exactly, driven by an accumulator on the host's rAF; ≤ 5 catch-up steps per animation frame, then the remainder is dropped (`now` jumps forward). Pause clears the accumulator. Per step: drain inbound `input`/`msg`/`timer` in arrival order, then `tick`, then flush outbound. Inputs accepted since the previous step leave as one `input` frame right before the step's `tick` (the first step of a catch-up burst); with `tickHz` 0 each arriving batch leaves at once. Hooks never fire *during* `tick`.
- **Paused.** No ticks, no `draw`; inbound input is dropped (a paddle must not teleport on resume); pending timers freeze with their remaining delay; `publish` is accepted and retained.
- **Errors.** `ready.v ≠ WIRE_VERSION` → `close{'version'}`. Unknown or out-of-order frame → `close{'protocol'}`. A throw in any game handler is caught game-side and reported as `fault`; a throw in a factory, or > 3 faults in 5 s, → `close{'fault'}`. No `ready` within 5 s of `open()`, or iframe unload → `close{'link-lost'}`. Bad `set-holder`/`timer`/`publish`-after-`end` → `reject`, state unchanged. A throw in `draw` skips the frame; 10 consecutive → that view closes. Every one of these reaches `apps/pwa` only as a `MatchEvent`; nothing throws across the seam.
- **Performance.** ≤ 1 `move` per `pointerId` per rAF, one `input` frame per view per rAF; `down/up/cancel` never coalesced. The view follows only pointers that went down on it, so a hovering mouse sends nothing; the local echo (`onInput`) runs as the frame leaves, before that animation frame's `draw`. One `structuredClone` per crossing in both adapters. `draw` stops when `document.hidden` or paused. Pong reference: ~200 B state at 60 Hz × 3 Peers ≈ 36 KB/s host upload — JSON only until phones are measured (ADR-0003).

## 6. Usage

### `games/pong/src/index.ts` — the whole game, imports `@mgc/sdk` only

```ts
import { defineGame, type DeviceId, type PlayerId, type Vec2 } from '@mgc/sdk';
const R = 9, PAD = { w: 10, h: 110, inset: 14 }, SPEED = 520, WIN = 7;                // mm, mm/s
type S = { ball: Vec2 & { vx: number; vy: number }; pads: Record<DeviceId, number>; score: Record<PlayerId, number> };
type M = never;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default defineGame<S, M>({
  manifest: { id: 'mgc.pong', name: 'Pong', version: '1.0.0', tiles: { min: 2, max: 4 },
    controllers: { min: 0, max: 0 }, players: { min: 2, max: 2 }, templates: ['row'],
    host: './index.js', view: './index.js' },
  host(ctx) {
    const b = ctx.match.bounds, mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const [l, r] = [ctx.match.tiles[0]!, ctx.match.tiles.at(-1)!];                      // outer Tiles
    const seat: Record<DeviceId, PlayerId> = { [l.deviceId]: ctx.match.players[0]!.playerId,
                                               [r.deviceId]: ctx.match.players[1]!.playerId };
    const pads = { [l.deviceId]: mid.y, [r.deviceId]: mid.y }, score = { [seat[l.deviceId]!]: 0, [seat[r.deviceId]!]: 0 };
    let ball = { ...mid, vx: SPEED, vy: SPEED * 0.4 };
    const serve = (dir: number) => { ball = { ...mid, vx: SPEED * dir, vy: (Math.random() - 0.5) * SPEED }; };
    const hit = (y: number) => Math.abs(ball.y - y) < PAD.h / 2 + R;
    const lx = b.x + PAD.inset + PAD.w + R, rx = b.x + b.w - PAD.inset - PAD.w - R;
    const snap = (): S => ({ ball: { ...ball }, pads: { ...pads }, score: { ...score } });
    return {
      onInput(i) { if (i.deviceId in pads) pads[i.deviceId] = clamp(i.world.y, b.y + PAD.h / 2, b.y + b.h - PAD.h / 2); },
      onResume() { ctx.publish(snap()); },
      tick(dt) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if ((ball.y < b.y + R && ball.vy < 0) || (ball.y > b.y + b.h - R && ball.vy > 0)) ball.vy *= -1;
        if (ball.x < lx && ball.vx < 0 && hit(pads[l.deviceId]!)) ball.vx *= -1;
        if (ball.x > rx && ball.vx > 0 && hit(pads[r.deviceId]!)) ball.vx *= -1;
        if (ball.x < b.x - R || ball.x > b.x + b.w + R) {
          const scorer = seat[ball.x < b.x ? r.deviceId : l.deviceId]!;
          if (++score[scorer]! >= WIN) return ctx.end({ scores: score, ranking: Object.keys(score).sort((a, c) => score[c]! - score[a]!) });
          serve(scorer === seat[l.deviceId] ? 1 : -1);
        }
        ctx.publish(snap());
      },
    };
  },
  view(ctx) {
    return {
      draw({ ctx: g, state: s, now, t, bounds: b }) {
        if (!s) return;
        const k = Math.min((now - t) / 1000, 0.1);                                      // extrapolate ≤ 100 ms
        g.fillStyle = '#f2f0ea';
        for (const tile of ctx.match.tiles) if (tile.deviceId in s.pads)
          g.fillRect(tile.x < b.x + b.w / 2 ? b.x + PAD.inset : b.x + b.w - PAD.inset - PAD.w,
                     s.pads[tile.deviceId]! - PAD.h / 2, PAD.w, PAD.h);
        g.beginPath(); g.arc(s.ball.x + s.ball.vx * k, s.ball.y + s.ball.vy * k, R, 0, Math.PI * 2); g.fill();
      },
    };
  },
});
```

Every view draws the whole World; its Tile transform clips it. No canvas, DPR, rAF, pointer, px→mm, clock, pause, or link code in the game. (The shipped `games/pong` is this sketch with phone-sized geometry, a short rest before each serve, return angles from where the ball meets the paddle, and its constants exported as `PONG` for its tests.)

### `apps/pwa` call site (Host Device; a Peer is the same minus `authority`)

```ts
const handle = runMatch({
  link: inProcessLink(() => import('@mgc/pong')),          // M3: iframeLink({ host: '/games/pong/host.html', view: '/games/pong/view.html' })
  match,                                                    // frozen by the lobby, sent to Peers on the existing layout channel
  self: { deviceId: session.deviceId, pxPerMm: info.pxPerMm, mount: stage },
  now: () => session.clock.now(),
  send: (frame, to) => session.sendTo(MATCH_CHANNEL, frame, to),   // core maps DeviceId → PeerId
  onEvent: (e) => hud.render(e),
  authority: true,
});
session.onMessage(MATCH_CHANNEL, (frame, fromDeviceId) => handle.deliver(frame as NetFrame, fromDeviceId));
session.onDeviceLost((d) => handle.setPaused({ kind: 'device-lost', deviceId: d }));
session.onDeviceBack(() => handle.setPaused(null));
```

## 7. What the seam hides

Clock transport and monotone re-derivation; pointer capture (`touch-action: none`, pointer capture, DPR and root-rect offsets, px→mm via `Surface`, per-frame coalescing, `t` stamping, lifecycle repair, synthetic cancels, opt-out); the holder map and `playerId` stamping; the pause state machine, tick suppression, timer freezing; retention and replay; canvas creation, resize, `Surface.applyTo`, clear, rAF, hidden-tab pausing; the fixed-step accumulator and its clamp; fan-out including the Host's own loopback view; fault isolation and the close ladder; iframe creation, `ready` handshake, clone enforcement, teardown. Not hidden, on purpose: state semantics, prediction, lobby, role assignment, Transport.

## 8. Dependencies, adapters, tests

| Dependency | Category | Treatment |
|---|---|---|
| `@mgc/layout` `Surface`/`Vec2`/`Rect` | in-process | direct dependency, re-exported; no adapter |
| game ↔ platform link | remote-but-owned | **real seam**: `Link` + `inProcessLink` (M2 production and test adapter) + `iframeLink` (M3) |
| cross-Device transport, roster, `PeerId ↔ DeviceId` | the platform's | **no port**: `send`/`deliver` closures on `MatchOptions`/`MatchHandle` |
| shared clock | data | `now()` in, `ClockWire` across the link |
| DOM / rAF / pointer events | local-substitutable | used directly; headless tests take the `mount`-less path with a stepped rAF |

**Prerequisites in existing packages (part of M2):**
- `@mgc/layout` must stop depending on `@mgc/core`: `DeviceSize.id: string`; move `channel.ts` (`publishLayout`/`subscribeLayout`, the only `Transport` user) into `apps/pwa`.
- `@mgc/core` owns Device identity: `DeviceInfo.deviceId` (persisted UUID), `HostSession` keeps `PeerId ↔ DeviceId` and rebinds a returning Device to its new `PeerId`; the pwa gets `session.sendTo(channel, data, deviceId)` / `onMessage(channel, (data, fromDeviceId))` / `onDeviceLost` / `onDeviceBack`. `@mgc/sdk` is reachable only through these closures and never imports `@mgc/core` at runtime.

**Tests at the interface.**
1. *Link conformance*: a table of frame sequences replayed against both adapters asserting identical game-visible effects; proves M2 ≡ M3.
2. *End-to-end*: `packages/sdk/test/match.e2e.test.ts` — `MemoryHub` (core as devDependency) + 4 `runMatch` handles (3 Tiles, 1 Controller, `authority` on d0) cross-delivering frames, fake clock, stepped rAF, a recording probe game built with `defineGame`. Asserts: ticks fan out to every view including the Host's own; world-mm input from a Tile; `playerId`-stamped input from a Controller after `setHolder`; pause on drop (no ticks, no state); resume + re-publish after rebinding; `ended` with scores.
3. *Game tests*: `await createTestMatch({ game, match, host?, pxPerMm? })` from `@mgc/sdk/test` runs `runMatch` for every Device of `match` (host default `match.devices[0]`) over the in-process link with a headless screen each and in-memory JSON delivery between Devices, on its own fake clock (shared time starts at 0; no global timers touched). It gives a game author `await t.tick(ms)` (one animation frame per fixed step), `await t.input(deviceId, phase, at, pointerId?)` (a pointer event through that view's own capture, `at` in world mm on a Tile / screen mm on a Controller, delivered before the next tick), `t.state(deviceId)` (that view's `latest()`), `t.result()`, `t.events(deviceId)`, `t.now()`, `await t.stop()` — so "passes in M2" means "serialises in M3".

## 9. Rejected

- `state()` auto-publish at a `publishHz` (CommonCase): a second way to publish; the decided contract is explicit `publish`.
- `sample: 'auto'` JSON-path interpolation (CommonCase): silently wrong for delta/event state; prediction is game-owned (ADR-0003).
- Capability negotiation, state slots, holder regions, open `Role`/`Frame` unions, `ArrayBuffer` payloads (Flexible): each a hypothetical seam with one adapter today. Revisit when the first consumer exists; the wire version field is the migration path.
- A net port inside the SDK (`transportNet`, `MatchWire`; Ports/Flexible): the roster already lives in `@mgc/core`; a second home for `PeerId ↔ DeviceId` would split it.
- Live-mutated `ctx.playerId` across realms (Minimal): works only because structured clone rebuilds objects; `holderOf()` + `onHolder` is explicit.
- Required `tick` (Ports): turn-based games have no loop.
