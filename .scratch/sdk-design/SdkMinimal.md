# @mgc/sdk — minimal-surface design (SdkMinimal)

A game author learns **one function**: `defineGame`; the platform calls **one function**, `runMatch`, plus
one of two link adapters. All else is plain data. Units are millimetres and milliseconds (`mm/ms` = `m/s`).

## 1. Interface

### 1.1 Data (must survive structured clone *and* JSON — the same payloads cross the WebRTC transport)

```ts
type DeviceId = string; type PlayerId = string;
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
interface Vec2 { x: number; y: number }                        // Vec2/Rect re-exported from
interface Rect { x: number; y: number; w: number; h: number }  // @mgc/layout; lengths are world mm
interface Tile extends Rect { rot: number }                    // radians, clockwise
interface Player { playerId: PlayerId; name: string }
/** Live object: `role`/`tile` frozen per Match, `playerId` mutated in place on handover. */
interface Seat { readonly deviceId: DeviceId; readonly role: 'tile' | 'controller';
                 readonly tile?: Tile; playerId?: PlayerId }
interface MatchInfo { readonly matchId: string; readonly players: readonly Player[];
                      readonly devices: readonly Seat[]; readonly bounds: Rect }
interface Input { deviceId: DeviceId; playerId?: PlayerId; pointerId: number; t: number;
                  phase: 'down' | 'move' | 'up' | 'cancel';
                  world?: Vec2;   // world mm — present iff this Device's role is 'tile'
                  norm: Vec2 }    // 0..1 of this Device's own screen — always present
interface MatchResult { scores?: Record<PlayerId, number>; ranking?: PlayerId[] }
interface Manifest { id: string; name: string; version: string; minTileMm?: number; templates?: string[];
  tiles: { min: number; max: number }; controllers: { min: number; max: number }; players: { min: number; max: number }; host: string; view: string }
```

### 1.2 Game-facing: `defineGame`

```ts
export function defineGame<S extends JsonValue = JsonValue, M extends JsonValue = JsonValue>(
  spec: GameSpec<S, M>): Game;  // default export; self-registers, so an iframe entry is `import './g.js'`
interface GameSpec<S, M> { manifest: Manifest;
  host(ctx: HostContext<S>): HostHandlers<M>;   // called once, on the Host Device only
  view(ctx: ViewContext<M>): ViewHandlers<S> }  // called once, on every Device (Host included)
interface HostContext<S> { readonly match: MatchInfo; now(): number;
  publish(state: S, to?: DeviceId): void;                      // broadcast when `to` is omitted
  setHolder(controller: DeviceId, playerId: PlayerId | null): void;
  end(result: MatchResult): void }
interface HostHandlers<M> { tick?(dt: number, now: number): void; onInput?(i: Input): void;
  onMessage?(msg: M, from: Seat): void;        // from.playerId = holder, stamped by the platform
  onPause?(): void; onResume?(): void; dispose?(): void }
type ViewContext<M> = ViewBase<M> & ({ readonly role: 'tile'; readonly surface: Surface }
                                   | { readonly role: 'controller'; readonly surface: null });
interface ViewBase<M> { readonly deviceId: DeviceId; playerId?: PlayerId;  // live: current holder
  readonly match: MatchInfo; now(): number; send(msg: M): void;
  readonly root: HTMLElement;          // game-owned subtree (DOM UIs, controllers)
  readonly canvas: HTMLCanvasElement;  // full-bleed, created and kept sized (× dpr) by the SDK
  readonly dpr: number }
interface ViewHandlers<S> { onState?(state: S, t: number): void;
  draw?(now: number): void;            // SDK-driven rAF, `now` is shared time
  onInput?(i: Input): void;            // local copy of this Device's own input, for prediction
  onPause?(): void; onResume?(): void; dispose?(): void; input?: 'coalesced' | 'raw' | 'off' }  // 'coalesced'
```

### 1.3 Platform-facing: `runMatch` + two link adapters

```ts
export function runMatch(opts: MatchOptions): MatchHandle;
export function inProcessLink(load: () => Promise<{ default: Game }>): LinkFactory;
export function iframeLink(src: { host: string; view: string }): LinkFactory;
interface MatchOptions { link: LinkFactory;
  match: { matchId: string; players: Player[]; devices: Seat[]; bounds: Rect };  // frozen
  self: { deviceId: DeviceId; pxPerMm: number; mount: HTMLElement };
  now(): number;                                  // SharedClock.now, bound
  send(frame: WireFrame, to?: DeviceId): void;    // platform forwards over its own Transport
  onOutcome(o: MatchOutcome): void;               // exactly once per Device runtime
  authority?: boolean;                            // true on the Host: also runs the GameHost
  tickHz?: number }                               // Host only, default 60
interface MatchHandle { deliver(frame: WireFrame, from: DeviceId): void;
  setPaused(reason: string | null): void; stop(reason: string): void }
type MatchOutcome = { reason: 'game'; result: MatchResult } | { reason: 'stopped' | 'fault'; detail: string };
```

### 1.4 The link port (remote-but-owned)

```ts
type WireFrame = { readonly k: string };  // opaque to the platform; JSON-safe; ordered per Device
interface Link { post(f: ToGame): void; onFrame(h: (f: FromGame) => void): void; close(): void }
type LinkFactory = (r: { side: 'host' | 'view'; mount?: HTMLElement; boot: Boot }) => Promise<Link>;
interface Boot { matchId: string; players: Player[]; devices: Seat[]; bounds: Rect; tickHz: number;
  deviceId: DeviceId; role: 'tile' | 'controller' | 'host';
  epochOffset: number; pxPerMm?: number; tile?: Tile }  // shared = Date.now()+epochOffset; last two: view only
type ToGame = { k: 'boot'; b: Boot } | { k: 'state'; s: JsonValue; t: number } | { k: 'stop' }
  | { k: 'msg'; m: JsonValue; from: Pick<Seat, 'deviceId' | 'role' | 'playerId'> } | { k: 'input'; i: Input[] }
  | { k: 'holder'; d: DeviceId; p: PlayerId | null } | { k: 'clock'; epochOffset: number } | { k: 'pause'; on: boolean };
type FromGame = { k: 'ready'; manifest: Manifest } | { k: 'msg'; m: JsonValue } | { k: 'input'; i: Input[] }
  | { k: 'state'; s: JsonValue; t: number; to?: DeviceId } | { k: 'end'; r: MatchResult }
  | { k: 'holder'; d: DeviceId; p: PlayerId | null } | { k: 'fault'; detail: string };
```

### 1.5 Invariants, ordering, errors, performance

- **Ordering.** Per Device: `boot` first, `stop`/`end` last, reliable and ordered between. `onState` never
  fires before `view()` returned; `tick` never runs while paused; `now()` is monotone in every realm.
- **Authority.** The host-side runtime overwrites `deviceId` (from the authenticated channel) and stamps
  `playerId` (from the holder map) on every inbound `Input`/`msg` **at ingest**: a view cannot forge another
  Device's input, and an input in flight during a handover gets the *new* holder.
- **Retention.** The last broadcast and the last per-Device state are retained; a view that becomes ready
  later gets them at once (no iframe-load race) and they are re-posted on resume — so a game that ignores
  `onPause`/`onResume` is still correct.
- **Fixed step.** `dt = 1000 / tickHz` exactly; ≤ 5 catch-up steps per animation frame, then the accumulator
  is dropped (`now` jumps forward rather than burning CPU). Pausing clears it.
- **Errors.** A throwing handler → `fault` (Host: ends the Match via `onOutcome`; view: kills only that view).
  `publish` of a non-JSON value and `setHolder` on a non-controller/unknown Player throw in the game realm;
  unknown `from`/frame kinds and anything after `end`/`stop` are ignored; no `ready` within 5 s → `fault`.
- **Performance.** ≤ 1 `move` per `pointerId` per frame, one batched `input` frame per rAF whatever the
  pointer rate, no per-event allocation beyond the `Input`. `publish` is never coalesced — 1:1 with a wire
  message, so the game owns the wire rate. `draw` stops when hidden or paused.

## 2. Usage

### 2.1 `games/pong/src/index.ts` — the whole game, host and view, one module, `@mgc/sdk` only

```ts
import { defineGame } from '@mgc/sdk';
type S = { ball: { x: number; y: number; vx: number; vy: number }; at: number;
           pads: Vec2[]; score: [number, number] };   type M = { claim: PlayerId };
const R = 12, PW = 8, PH = 90, V = 0.45;                 // mm; V in mm/ms = m/s
export default defineGame<S, M>({
  manifest: { id: 'mgc.pong', name: 'Pong', version: '1.0.0', tiles: { min: 2, max: 4 },
    controllers: { min: 0, max: 2 }, players: { min: 2, max: 2 }, templates: ['row'],
    minTileMm: 60, host: './index.js', view: './index.js' },   // one module, two halves
  host(ctx) {
    const B = ctx.match.bounds, [a, b] = ctx.match.players, score: [number, number] = [0, 0];
    const row = ctx.match.devices.filter((d) => d.tile).sort((p, q) => p.tile!.x - q.tile!.x);
    const side: Record<DeviceId, 0 | 1> = { [row[0]!.deviceId]: 0, [row.at(-1)!.deviceId]: 1 };
    const pads = [{ x: B.x + PW, y: B.y + B.h / 2 }, { x: B.x + B.w - PW, y: B.y + B.h / 2 }];
    const ball = { x: B.x + B.w / 2, y: B.y + B.h / 2, vx: V, vy: V * 0.4 };
    return {
      onInput(i) { const k = side[i.deviceId]; if (k !== undefined && i.world) pads[k]!.y = i.world.y; },
      onMessage(m, from) { ctx.setHolder(from.deviceId, m.claim); },     // controller handover
      tick(dt) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < B.y + R || ball.y > B.y + B.h - R) ball.vy = -ball.vy;
        pads.forEach((p, k) => { if (Math.abs(ball.x - p.x) < R + PW / 2 &&
          Math.abs(ball.y - p.y) < PH / 2) ball.vx = (k === 0 ? 1 : -1) * Math.abs(ball.vx); });
        if (ball.x < B.x || ball.x > B.x + B.w) {
          score[ball.x < B.x ? 1 : 0]++;
          Object.assign(ball, { x: B.x + B.w / 2, y: B.y + B.h / 2, vx: -ball.vx });
          if (Math.max(...score) === 5) return ctx.end({
            scores: { [a!.playerId]: score[0], [b!.playerId]: score[1] },
            ranking: (score[0] > score[1] ? [a!, b!] : [b!, a!]).map((p) => p.playerId) });
        }
        ctx.publish({ ball: { ...ball }, at: ctx.now(), pads: pads.map((p) => ({ ...p })), score: [...score] });
      },
    };
  },
  view(ctx) {
    if (ctx.role === 'controller') {                     // private view: plain DOM, no Surface
      ctx.root.innerHTML = ctx.match.players
        .map((p) => `<button data-p="${p.playerId}">${p.name}</button>`).join('');
      ctx.root.onclick = (e) => { const p = (e.target as HTMLElement).dataset['p'];
                                  if (p) ctx.send({ claim: p }); };
      return { draw() { ctx.root.dataset['holder'] = ctx.playerId ?? ''; } };  // live holder
    }
    const g = ctx.canvas.getContext('2d')!; let s: S | null = null;
    return {
      onState(next) { s = next; },
      draw(now) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!s) return;
        ctx.surface.applyTo(g, ctx.dpr);                 // from here on, drawing is in world mm
        const k = now - s.at; g.fillStyle = '#fff';      // extrapolate on the shared clock
        g.beginPath(); g.arc(s.ball.x + s.ball.vx * k, s.ball.y + s.ball.vy * k, R, 0, 7); g.fill();
        for (const p of s.pads) g.fillRect(p.x - PW / 2, p.y - PH / 2, PW, PH);
      },
    };
  },
});
```

The outer tiles drive the paddles; a middle tile just shows the ball. No rAF, DPR work, pointer listeners, clock plumbing or link awareness anywhere in the game.

### 2.2 `apps/pwa` call site (Host Device; a Peer is the same call minus `authority`)

```ts
const handle = runMatch({
  link: inProcessLink(() => import('@mgc/pong')),        // M3: iframeLink(pong.entries)
  match: { matchId, players, devices: seats, bounds: layout.bounds },
  self: { deviceId: myDeviceId, pxPerMm: info.pxPerMm, mount: stageEl },
  now: () => clock.now(),                                // core SharedClock
  send: (frame, to) => transport.send('game', frame, to ? peerOf(to) : undefined),
  onOutcome: (o) => showMatchEnd(o),
  authority: true,
});
transport.onMessage('game', (d, from) => handle.deliver(d as WireFrame, deviceOf(from)));
host.onPeersChanged(() => handle.setPaused(host.missing() ? 'A phone left the table' : null));
```

`seats` is the platform's roster mapped to `Seat`s — `PeerId → DeviceId` happens here and nowhere else; the pause overlay is the PWA's, drawn in the parent document above `stageEl`.

## 3. What the implementation hides

- **Clock transport.** `boot.epochOffset = platform.now() − Date.now()`; the game realm anchors once
  (`base = Date.now() + epochOffset`, `p0 = performance.now()`) and returns `base + performance.now() − p0`,
  so each iframe's private time origin is irrelevant and `now()` keeps sub-ms steps despite `Date.now()`
  quantisation. Later `clock` frames are **slewed** ≤ 1 ms/100 ms: `now()` never jumps backwards.
- **Input capture.** Listeners on the SDK's canvas/root with `touch-action:none` and pointer capture;
  `pxToWorld` through a `Surface` built from `boot.tile` + `boot.pxPerMm`; `norm` always, `world` on tiles;
  coalescing; per-frame batching; `playerId` stamped at host ingest, never trusted from a view.
- **Holder map and pause.** One authority (the host-side runtime): `setHolder` → `holder` frame → the
  `playerId` of the live `Seat`/`ViewContext` objects is mutated in every realm, so no callback exists.
  `setPaused` stops the accumulator and `draw`, drops in-flight input, and re-posts the retained state to
  every view on resume, before the first tick.
- **In-process vs iframe.** `inProcessLink` runs the game module in the page but `structuredClone`s every
  frame **in both directions**, so a leaked function or DOM node fails in M2 exactly as in M3. `iframeLink`
  creates `sandbox="allow-scripts"` iframes (host hidden) and, the origin being opaque, authenticates by
  `event.source === frame.contentWindow`; its `ready` frame carries the manifest, which `runMatch` validates
  against the Match (counts, `minTileMm`) before the first tick.

## 4. Dependencies and adapters

| dependency | category | treatment |
|---|---|---|
| `@mgc/layout` (`Surface`, `Vec2`, `Rect`) | in-process, pure math | direct dependency + re-export; **no adapter** |
| game ↔ platform link | remote-but-owned | port `Link`; `inProcessLink` (M2 production **and** the test adapter) + `iframeLink` (M3). **Real seam: two adapters** |
| cross-Device transport | the platform's, not the SDK's | **no port**; `send`/`deliver` are plain functions on `MatchOptions`/`MatchHandle`. Refusing to own it is what keeps `Transport` and `PeerId` out of the SDK |
| shared clock | data | `now()` in, `epochOffset` across the link; no adapter |
| DOM / rAF | local-substitutable | used directly; tests run happy-dom with a pumped `requestAnimationFrame` |

**Test strategy at the interface.** One conformance suite against the two public faces: a probe game built
with `defineGame` that logs every callback, driven through a 2-tile + 1-controller Match by two `runMatch`
handles cross-delivering each other's `WireFrame`s, with a fake clock and a stepped rAF. Run it over
`inProcessLink` in Node and the *same* suite over `iframeLink` in Playwright; the two logs must be identical.
That proves constraint 2 — and is why the in-process adapter clones: a test adapter must be lossy like prod.

## 5. Trade-offs

- **High leverage.** `defineGame` hides the fixed-step accumulator and its clamp, the rAF loop, canvas sizing
  and DPR, pointer capture with px→mm and coalescing, per-realm monotone clock derivation, retention and
  resume replay, and holder stamping — behind two functions returning records of optional callbacks.
  `runMatch` hides two runtimes, two links, manifest validation, pause and fault isolation behind eight
  fields, and on the Host builds the GameHost *and* GameView links through the same factory: no shortcut
  path for the Host's own Tile, its frames are cloned like every Peer's.
- **Thin.** `send`/`onMessage` is pass-through plus stamping; `WireFrame` is an opaque envelope; the
  `Surface` re-export is pure pass-through, kept so a game has exactly one import and the seam pins the
  version — the one piece that fails the deletion test (cost of removing it: one import line).
- **Collapses and their cost.** No `init` (the factory *is* init) → async setup must be lazy in `tick`/`draw`.
  No view-side `onMessage` → a host signals one view with `publish(state, to)`, at the cost that a targeted
  publish overwrites that Device's retained broadcast, so `to` is for private state only. No `onHolder` →
  read `ctx.playerId` in `draw`, diffing it if you need the edge. `onPause`/`onResume` stay literal methods
  but auto-replay makes both optional. `authority?: boolean` beats `runMatch` + `joinMatch` at 90 % overlap.
- **Deletion test.** Delete `@mgc/sdk` and the accumulator and clamp, DPR/resize, pointer capture with mm
  mapping and coalescing, the monotone clock, holder authority, retention/replay and the iframe handshake
  reappear in *every* game and once per game in `apps/pwa`: it earns its keep. The one real risk is
  `ViewContext`'s ten members — still fewer than an `init`/`attach`/`resize`/`destroy` + `Stage` lifecycle.
