# `@mgc/sdk` — design under "maximise flexibility and extension"

One Module, three Interfaces: **game-facing** (what `games/pong` imports), **platform-facing** (what `apps/pwa` calls), and the **link port** `GameLink` — the one thing with two real Adapters. Flexibility is bought with exactly four mechanisms, each priced in §5: an **open frame envelope**, **capability negotiation**, **state slots**, and **one open event union**. Everything else is deliberately closed. A message-type registry with schemas was rejected: a game's host entry and view entry ship in the *same* bundle at the *same* version, so there is no cross-version message-schema problem to solve.

## 1. Interface
### 1.1 Shared data vocabulary (all structured-clone-safe)
```ts
export type DeviceId = string; export type PlayerId = string;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
/** Everything crossing the seam. ArrayBuffer is clone+transfer safe → binary state needs no new type. */
export type Data = JsonValue | ArrayBuffer | ArrayBufferView;
/** Open on purpose: 'tile' | 'controller' exist in v1, 'spectator' is additive. */
export type Role = 'tile' | 'controller' | 'spectator' | (string & {});
export interface Vec2 { x: number; y: number } export interface Rect { x: number; y: number; w: number; h: number }
export interface Tile extends Rect { deviceId: DeviceId; rot: number }   // World mm; never a PeerId
export interface MatchLayout { tiles: Tile[]; bounds: Rect }
export interface Player { playerId: PlayerId; name: string }
export interface DeviceSlot { deviceId: DeviceId; role: Role; name: string; tile?: Tile; screenMm: Vec2 }
export interface MatchInfo { matchId: string; seed: number; tickHz: number;        // all frozen for the Match
  devices: DeviceSlot[]; players: Player[]; layout: MatchLayout }
export interface Caps { has(name: string, minVersion?: number): boolean; version(n: string): number | undefined }
// v1 caps (all version 1): state.json · msg.reliable · input.pointer · role.tile · role.controller.  Reserved,
// unimplemented: state.binary · channel.unreliable · role.spectator · input.region · bundle.remote

export interface Manifest {                  // Range = { min: number; max: number }; bare string entry = { entry }
  id: string; name: string; version: string; tiles: Range; controllers: Range; players: Range;
  templates?: TemplateId[]; minTileMm?: number;
  host: string | HostSpec; view: string | ViewSpec;        // `view` is the default view for every Role
  views?: Partial<Record<Role, string | ViewSpec>>;        // Role overrides; absent Role falls back to `view`
  needs?: Record<string, number>;    // capability → min version; the Match refuses to start if unmet
  wants?: Record<string, number>;    // negotiated; the game branches on ctx.caps at runtime
}
export interface HostSpec { entry: string; tickHz?: number }       // 0 = event-driven, no tick at all
export interface ViewSpec { entry: string; input?: InputSpec }
export interface InputSpec { capture?: 'pointer' | 'none'; coalesce?: 'frame' | 'raw';
  attribute?: 'sole-holder' | 'region' | 'none' }
```

### 1.2 Game-facing: host
```ts
export interface Holder { playerId: PlayerId; region?: Rect }      // region in World mm
export interface Sender { deviceId: DeviceId; role: Role; playerId?: PlayerId }
export interface PublishOpts { to?: DeviceId; slot?: string; reliable?: boolean; keepLatest?: boolean }
export interface SendOpts { channel?: string; reliable?: boolean }
export interface MatchResult { scores?: Record<PlayerId, number>; ranking?: PlayerId[]; [k: string]: unknown }
export interface HostContext {
  readonly match: MatchInfo; readonly caps: Caps;
  now(): number;                                           // shared clock, ms
  publish(state: Data, opts?: PublishOpts): void;          // broadcast unless opts.to
  send(msg: Data, to: DeviceId, opts?: SendOpts): void;
  setHolder(deviceId: DeviceId, playerId: PlayerId | null): void;  // sugar over setHolders
  setHolders(deviceId: DeviceId, holders: Holder[]): void;         // ≥2 holders → region attribution
  timer(tag: string, delayMs: number | null): void;        // pause-aware; null cancels; same tag replaces
  end(result: MatchResult): void;
  log(...args: unknown[]): void;                           // a sandboxed iframe has no reachable console
}
export interface GameHost {                                // every hook optional; `tick` absent ⇒ pure event game
  init?(ctx: HostContext): void | Promise<void>; tick?(dt: number, now: number): void;   // tick: fixed step
  onInput?(input: Input): void; onMessage?(msg: Data, from: Sender): void;
  onEvent?(e: MatchEvent): void; dispose?(): void;         // onEvent is the single extension hook
}
```

### 1.3 Game-facing: view
```ts
export interface Input {
  deviceId: DeviceId; playerId?: PlayerId; pointerId: number;
  phase: 'down' | 'move' | 'up' | 'cancel'; t: number;     // t = shared clock at capture
  world?: Vec2;              // World mm — present iff this Device has a Tile
  local: Vec2;               // mm from this screen's top-left — always present (Controllers have no Surface)
  pressure?: number; samples?: { x: number; y: number; t: number }[];  // 'raw' history, oldest first, world ?? local
}
export interface StateMeta { slot: string; t: number; private: boolean }
export interface ViewContext {
  readonly match: MatchInfo; readonly self: DeviceSlot; readonly caps: Caps;
  readonly root: HTMLElement;      // SDK-owned element; the view fills it and owns everything inside it
  readonly surface?: Surface;      // Tile Roles (their Tile) and spectators (fitted to layout.bounds)
  now(): number; send(msg: Data, opts?: SendOpts): void; log(...args: unknown[]): void;
  input: { configure(s: InputSpec): void; onLocal(h: (i: Input) => void): () => void };
}
export interface GameView {
  init?(ctx: ViewContext): void | Promise<void>; onState?(state: Data, meta: StateMeta): void;
  onMessage?(msg: Data, meta: { channel: string }): void; onEvent?(e: MatchEvent): void;
  frame?(now: number, dt: number): void; dispose?(): void;   // frame: platform-driven rAF, silent while paused
}
export type MatchEvent =
  | { type: 'pause'; reason: 'device-lost' | 'platform'; devices: DeviceId[]; at: number }
  | { type: 'resume'; at: number }
  | { type: 'holders'; deviceId: DeviceId; holders: Holder[] }
  | { type: 'timer'; tag: string; at: number }
  | { type: 'view-ready'; deviceId: DeviceId; role: Role }            // host only
  | ({ type: string } & Record<string, unknown>);                     // unknown types MUST be ignored
export interface GameModule { manifest: Manifest; host?(): GameHost; view?(role: Role): GameView }
export function defineGame(g: GameModule): GameModule;   // returns g; also registers on globalThis.__mgc if present
export function surfaceOf(tile: Tile, pxPerMm: number): Surface;      // @mgc/layout Surface, re-exported
```

### 1.4 Link port and platform-facing
```ts
export interface Frame { readonly v: 1; readonly k: string; readonly [f: string]: unknown }
export interface GameLink {                                // the only port with two production Adapters
  post(frame: Frame, transfer?: Transferable[]): void;
  subscribe(h: (frame: Frame) => void): () => void; close(): void;
}
export function inProcessLink(o?: { clone?: boolean }): { platform: GameLink; game: GameLink };  // clone defaults true
export function iframeLink(m: Manifest, baseUrl: string, parent: HTMLElement): Promise<GameLink>;
export function runLinkContract(make: () => Promise<GameLink>): Promise<void>;     // one suite, both Adapters
export type GameSource =
  | { kind: 'module'; module: GameModule }                            // M2, in-repo import
  | { kind: 'bundle'; manifest: Manifest; baseUrl: string }           // M3 iframe; remote baseUrl later
  | { kind: 'link'; manifest: Manifest; link: GameLink };             // tests, future out-of-page workers

export interface MatchWire { send(to: DeviceId, f: Frame): void; broadcast(f: Frame): void }
export interface MatchSpec { matchId: string; seed?: number; source: GameSource; tickHz?: number;
  devices: DeviceSlot[]; players: Player[]; layout: MatchLayout; caps?: Record<string, number> }
export interface HostDeps { wire: MatchWire; clock: { now(): number }; raf?: Scheduler;
  onDiagnostic?(d: Diagnostic): void }
export interface MatchHandle { readonly matchId: string;
  deliver(from: DeviceId, f: Frame): void;                 // platform feeds in frames from its own transport
  pause(reason: 'device-lost' | 'platform', devices?: DeviceId[]): void; resume(): void;
  abort(code: string): void; readonly ended: Promise<MatchOutcome> }
export function runHost(spec: MatchSpec, deps: HostDeps): MatchHandle;
export interface ViewRunSpec { matchId: string; self: DeviceSlot; match: MatchInfo; pxPerMm: number;
  source: GameSource; caps?: Record<string, number> }
export interface ViewDeps { root: HTMLElement; clock: { now(): number }; toHost(f: Frame): void;
  raf?: Scheduler; input?: InputSource; onDiagnostic?(d: Diagnostic): void }
export function runView(spec: ViewRunSpec, deps: ViewDeps): { deliver(f: Frame): void; stop(): void };
```

### 1.5 Invariants, ordering, error modes, performance
- **Clone-only.** `publish`/`send`/`end` throw `SeamError` *synchronously at the call site* on a non-cloneable value in **both** Adapters, so M2 fails exactly where M3 would.
- **Ordering.** `init` settles before any other hook; frames queue meanwhile. Each frame: drain inbound → 0..`maxSteps` ticks → flush outbound; hooks never fire *during* `tick`. FIFO per (direction, channel); **no order between slots**, none between reliable and unreliable. Input from one Device is pointer-ordered; `t` is **not** monotone across Devices (±5 ms clock error), so hosts must not sort by `t`.
- **State stamp, and terminal state.** Published state carries `t` = the `now` of the tick that produced it, so a view's `now() - t` is a correct extrapolation `dt`. After `end`/`abort` there is no tick and no `frame`, and later publishes are dropped with a diagnostic rather than a throw.
- **Errors.** Throw in `init`/`end` → abort `game-init-failed`. Throw in any other hook → caught and diagnosed; 8 consecutive faults in one hook → abort `game-faulted` (one bad frame must not kill a party). Unmet `needs` → `MatchStartError` *before* `init` runs. No `ready` inside 5 s → `game-timeout`. Unknown frame `k` or event `type` → ignored and counted. `setHolder` with an unknown id → `SeamError`: the roster is frozen, so it is always a bug.
- **Performance.** One structured clone per crossing in both Adapters (pong's ~200 B state × 60 Hz × 4 Devices sits far under the transport's JSON cost). `keepLatest` (default true) collapses repeated publishes to one frame per slot per flush. Input is ≤1 frame per pointer per rAF per Device *even in `raw` mode*, because coalesced samples ride as an array. Tick catch-up batches as `{k:'tick', dt, steps}` — one frame, N steps, capped at `maxSteps` 5 to kill the spiral of death.

## 2. Usage
### 2.1 `games/pong` — imports `@mgc/sdk` and nothing else
```ts
import { defineGame, type GameHost, type GameView, type HostContext, type Vec2 } from '@mgc/sdk';
const R = 12, PW = 14, PH = 90, SPD = 450;                 // World mm and mm/s
type State = { ball: { p: Vec2; v: Vec2 }; pads: Record<DeviceId, number>; score: Record<PlayerId, number> };

function host(): GameHost {
  let ctx!: HostContext, s!: State, ends!: { deviceId: DeviceId; x: number }[], cx = 0, cy = 0;
  const serve = (dir: number) => { s.ball = { p: { x: cx, y: cy }, v: { x: SPD * dir, y: SPD * 0.4 } }; };
  const snap = () => ctx.publish(s);                       // slot defaults to 'main', broadcast
  return {
    init(c) {
      ctx = c; const b = c.match.layout.bounds, t = [...c.match.layout.tiles].sort((a, z) => a.x - z.x);
      cx = b.x + b.w / 2; cy = b.y + b.h / 2;              // paddles live on the two outer Tiles
      ends = [{ deviceId: t[0]!.deviceId, x: t[0]!.x + PW }, { deviceId: t.at(-1)!.deviceId, x: t.at(-1)!.x + t.at(-1)!.w - PW }];
      s = { ball: { p: { x: cx, y: cy }, v: { x: 0, y: 0 } }, pads: {}, score: {} };
      for (const p of c.match.players) s.score[p.playerId] = 0;
      for (const e of ends) s.pads[e.deviceId] = cy;
      serve(1);
    },
    onInput(i) { if (i.world && i.deviceId in s.pads) s.pads[i.deviceId] = i.world.y; },
    tick(dt) {
      const bl = s.ball, b = ctx.match.layout.bounds;
      bl.p.x += bl.v.x * dt; bl.p.y += bl.v.y * dt;
      if (bl.p.y < b.y + R || bl.p.y > b.y + b.h - R) bl.v.y *= -1;
      for (const e of ends) {
        const dx = bl.p.x - e.x;
        if (Math.abs(dx) < R && Math.abs(bl.p.y - s.pads[e.deviceId]!) < PH / 2) { bl.v.x *= -1.05; bl.p.x = e.x + Math.sign(bl.v.x) * R; }
        else if (Math.sign(dx) === Math.sign(e.x - cx) && Math.abs(dx) > 60) { scoreAgainst(e); serve(-Math.sign(bl.v.x)); }
      }
      snap();                                              // every tick; keepLatest collapses duplicates
    },
    onEvent(e) { if (e.type === 'resume') snap(); },        // constraint 8: host re-publishes on resume
  };
}

function view(role: Role): GameView {
  let ctx!: ViewContext, cv!: HTMLCanvasElement, g!: CanvasRenderingContext2D, s: State | null = null, tS = 0;
  return {
    init(c) {
      ctx = c; cv = document.createElement('canvas'); c.root.append(cv); g = cv.getContext('2d')!;
      c.input.onLocal((i) => { if (s && i.world) s.pads[c.self.deviceId] = i.world.y; });  // echo, no round trip
      if (role === 'controller') c.input.onLocal((i) => c.send({ y: i.local.y / c.self.screenMm.y }));
    },
    onState(st, m) { s = st as State; tS = m.t; },
    frame(now) {
      if (!s || !ctx.surface) return;                      // a Controller draws its own strip instead
      const dt = Math.min((now - tS) / 1000, 0.15), bl = s.ball, b = ctx.match.layout.bounds;
      sizeToRoot(cv, ctx.root); g.save(); ctx.surface.applyTo(g, devicePixelRatio);   // now drawing in World mm
      g.beginPath(); g.arc(bl.p.x + bl.v.x * dt, bl.p.y + bl.v.y * dt, R, 0, 7); g.fill();   // extrapolated ball
      for (const [id, y] of Object.entries(s.pads)) {
        const t = ctx.match.layout.tiles.find((x) => x.deviceId === id)!;
        g.fillRect(t.x < b.x + b.w / 2 ? t.x : t.x + t.w - PW, y - PH / 2, PW, PH); }
      g.restore();
    },
  };
}
export default defineGame({ manifest, host, view });
```

### 2.2 `apps/pwa` call site
```ts
// Host Device: runs a GameHost AND its own GameView, through the same runView every Peer uses (constraint 3).
const match = runHost({ matchId, source: { kind: 'module', module: pong },   // M3: { kind:'bundle', manifest, baseUrl }
  devices, players, layout, caps: PLATFORM_CAPS }, { clock: session.clock,
  wire: { send: (to, f) => (to === selfId ? selfView.deliver(f) : transport.send(CH, f, peerOf(to))),
          broadcast: (f) => { selfView.deliver(f); transport.send(CH, f); } } });
const selfView = runView({ matchId, self: slotOf(selfId), match: info, pxPerMm, source: { kind: 'module', module: pong } },
  { root: stage, clock: session.clock, toHost: (f) => match.deliver(selfId, f) });
transport.onMessage(CH, (d, from) => match.deliver(deviceOf(from), d as Frame));
session.onPeerLeave((p) => match.pause('device-lost', [deviceOf(p)]));
match.ended.then(showResults);
// Peer Device — identical runView; only `toHost` differs.
const view = runView(spec, { root: stage, clock: peer.clock, toHost: (f) => transport.send(CH, f, hostPeerId) });
transport.onMessage(CH, (d) => view.deliver(d as Frame));
```

## 3. What the Module hides behind the seam
- **Clock.** The platform sends `{k:'clock', skew}` with `skew = clock.now() - Date.now()` at handshake and then at 1 Hz. In the game's context the runtime re-derives `local = (Date.now() + skew) - performance.now()` and serves `now() = performance.now() + local`, **slewing** corrections at ≤2 %/s and snapping only past 20 ms. So `now()` is monotone and sub-ms despite `Date.now()`'s coarseness and each iframe's own `performance` time origin — and `Date`/`performance` never appear in game source.
- **Input.** Root element, `touch-action: none`, capture-phase listeners, pointer capture, DPR and root-rect offsets, per-frame coalescing (or `getCoalescedEvents` under `raw`), px→mm→`Surface.pxToWorld`, `t` stamping on the shared clock, `playerId` from the holder map, synthesised `cancel` on blur/pause, and the opt-out.
- **Holder map.** `Map<DeviceId, Holder[]>`: 0 holders → no `playerId`; 1 → stamp it; ≥2 → stamp by which `region` (World mm) the touch fell in, else leave it blank. The same stamping feeds `onMessage`'s `Sender`.
- **Pause.** Tick and `frame` frames stop; pending `timer`s freeze with their remaining delay and resume with it; input is dropped rather than queued and open pointers are cancelled; `pause`/`resume` reach host and every view.
- **Link and fan-out.** Iframe creation (`sandbox="allow-scripts"`, `srcdoc`, blob entry, `MessageChannel` handshake, start timeout), clone enforcement, transferables reserved for the binary slot, fault counting, diagnostics; and outbound, slot demux, keep-latest per (slot, destination), private vs broadcast routing, reliable/unreliable channel choice, `enc` tag selection.

## 4. Dependency strategy and Adapters
| Dependency | Category | Treatment |
|---|---|---|
| `@mgc/layout` Surface math | in-process | merged and re-exported (`surfaceOf`). No Adapter — pure math, no I/O. |
| game ↔ platform link | remote-but-owned | **real seam**: `GameLink` + `inProcessLink` + `iframeLink`; the in-process one doubles as the test Adapter, and `runLinkContract` runs one suite against both. |
| host ↔ other Devices | remote-but-owned | **real seam**: `MatchWire` + the PWA's WebRTC Adapter + a latency-modelled `memoryWire`. This is the wall that keeps `PeerId`/`Transport` out of `@mgc/sdk` at the type level. |
| rAF, pointer events | local-substitutable | `Scheduler`/`InputSource`, ~10 lines each: `rafScheduler`/`domInput` in production, `manualScheduler`/`scriptedInput` in tests. Two Adapters, so real but tiny. |
| shared clock | in-process | a structural `{ now(): number }` the platform passes in; not a port. |
| remote game bundles | true-external | the platform fetches; tests use a `blobBundle()` fixture rather than a mock network. The game never sees it. |

**Test strategy at the Interface.** `createTable({ game, layout, devices, players, latency })` builds an N-Device Match entirely in memory: the real `runHost` plus a real `runView` per Device over `inProcessLink` and `memoryWire`, with a manual scheduler and scripted input. `table.device('d2').drag({x,y})`, `table.step(16)`, `table.device('d1').state()`. Every game is testable headlessly against the exact Interface it ships on; the iframe path differs only in which `GameLink` Adapter gets constructed.

## 5. Trade-offs, and what each future need costs
| Future need | Absorbed by | Game source change |
|---|---|---|
| Turn-based Monopoly | `tickHz: 0` (event-driven host) + `ctx.timer` for turn clocks | none for existing games |
| Private Controller hands | `publish(hand, { to, slot: 'hand' })` → `onState(s, { slot, private })` | none |
| Drawing / whiteboard | `coalesce: 'raw'` + `input.onLocal` echo + a fast `slot:'strokes'` beside a slow `slot:'canvas'` | none |
| Spectator Role | the platform runs the game's `view` with a Surface **fitted to `layout.bounds`**; `views.spectator` only if a game wants a custom one | **none — pong gets spectators free**, because ADR-0005 already made it draw in World mm |
| Unreliable channel | `reliable: false` is always accepted and *degrades to reliable* until `caps.has('channel.unreliable')` | none |
| Binary state | `Data` already admits `ArrayBuffer`; frames carry an `enc` tag; transferables already plumbed | none |
| Remote bundle loading | `GameSource.kind: 'bundle'` with a remote `baseUrl`; `defineGame` self-registers for classic-script bundles | none |
| Multiple Players per Device | `setHolders(deviceId, [{ playerId, region }])` + `input.attribute: 'region'`; the default `'sole-holder'` stamps nothing when ambiguous | none for existing games |

**Where leverage is high.** Input capture is the deepest part: delete it and every game re-implements pointer normalisation, DPR and offset math, coalescing, px→World, holder attribution and timestamping — and gets `t` wrong, which is exactly what makes a ball jump at a bezel. The clock bridge is second: ~40 lines of slew/snap behind `ctx.now()`. Slots are third: delete them and every multi-stream game writes its own demux plus per-stream throttling in *both* host and view. The frozen `MatchInfo` paired with `Surface` is what makes the spectator Role free.

**Where it is thin.** `defineGame` is ~5 lines — identity plus a global registration that exists only so a remote classic-script bundle needs no second entry convention; it earns its keep in the remote-bundle milestone or not at all. `MatchWire` is a pass-through whose value is type-level, not behavioural. `end`/`abort` are plumbing.

**The honest weak point, and its twin.** Capability negotiation has one consumer today and pong declares no `needs`; the deletion test on `Caps` alone comes back *shallow*. It costs ~30 lines and pays only once the first of the reserved capabilities lands. I keep it because the alternative for each of those four is either a silent degradation bug or a seam change, and because the explicit degradation rule — `reliable: false` is always *callable*, never an error — is what lets game source be written today against a channel that does not exist yet. If none of the four ships by M5, delete `needs`/`wants` and keep `Caps` as a frozen record. The twin cost: the open `MatchEvent` union and open `Frame.k` trade exhaustiveness for forward compatibility, so TypeScript can no longer prove a game handles every event and an old view silently ignores a new one. That is the right trade for a plugin seam — a bundle built in 2026 must still run on the 2027 platform — but it makes "ignore what you do not recognise" a rule `games/_template` has to state, not a convention left implicit.
