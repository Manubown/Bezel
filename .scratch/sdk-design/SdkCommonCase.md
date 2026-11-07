# `@mgc/sdk` — design optimised for the common case

**Bet:** the modal caller is one person writing a 2–4 Tile realtime game, JSON snapshot state, Canvas2D.
That caller writes one file, two closures, zero configuration (§5). Controllers, private messages and
handover are the same interface with more fields filled in. §2–§3 are names a hobbyist never types.

## 1. Game-facing interface
```ts
type DeviceId = string; type PlayerId = string; type Ms = number; type Seconds = number;
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
interface Vec2 { x: number; y: number }   interface Rect extends Vec2 { w: number; h: number }
interface TileRect extends Rect { id: DeviceId; rot: number }  // radians cw about x,y; lengths in mm
interface Player { playerId: PlayerId; name: string }   interface Snap<S> { state: S; t: Ms }
interface MatchResult { scores?: Record<PlayerId, number>; ranking?: PlayerId[] }
interface DeviceEntry { deviceId: DeviceId; role: 'tile'|'controller'; tile?: TileRect; playerId?: PlayerId }
interface MatchInfo {   // deep-frozen for the Match; no mid-Match joins; seed is equal in every context
  matchId: string; seed: number; devices: readonly DeviceEntry[]; players: readonly Player[];
  tiles: readonly TileRect[]; world: Rect;   // Layout order, Tile Devices only; Layout bounds
}
interface Input {   // world: on a Tile → World mm; on a Controller → its own mm, origin top-left
  deviceId: DeviceId; playerId?: PlayerId; pointerId: number; t: Ms;
  phase: 'down'|'move'|'up'|'cancel'; world: Vec2;
}
interface HostContext extends MatchInfo {   // a factory argument: ctx is captured, never stashed
  now(): Ms;  publish(state: JsonValue, to?: DeviceId): void;  // publish broadcasts when no `to`
  send(msg: JsonValue, to?: DeviceId): void;  setHolder(controller: DeviceId, p: PlayerId|null): void;
  end(result: MatchResult): void;  playerAt(d: DeviceId): PlayerId | undefined;  // seat, or holder
}
interface HostHandlers<S extends JsonValue> {
  state?(): S;                        // declared → the SDK publishes it for you (§4 cadence)
  tick?(dt: Seconds, now: Ms): void;  onInput?(i: Input): void;  // dt: multiply it by a velocity
  onMessage?(msg: JsonValue, from: { deviceId: DeviceId; playerId?: PlayerId }): void;
  onPause?(): void; onResume?(): void; onEnd?(r: MatchResult | { aborted: string }): void;
}
interface ViewContext<S> extends MatchInfo {  // same on Host/Peers; a Controller gets a private Surface
  deviceId: DeviceId; role: 'tile'|'controller'; playerId?: PlayerId;   // playerId = current holder
  tile?: TileRect; surface: Surface; now(): Ms; send(m: JsonValue): void; latest(): Snap<S>|undefined;
}
interface Frame<S> {   // ctx is cleared and transformed: 1 unit = 1 world mm, hi-DPI handled
  ctx: CanvasRenderingContext2D; state: S | undefined;   // state: sampled at `now` (§5), undefined
  now: Ms; world: Rect; w: number; h: number; tile?: TileRect; surface: Surface;  // until publish #1
}
interface ViewHandlers<S> {
  draw?(g: Frame<S>): void;         // the common case: the SDK owns the canvas and the loop
  mount?(root: HTMLElement): void;  // instead of draw: own the DOM (Controller UIs)
  onState?(s: S, t: Ms): void; onMessage?(m: JsonValue): void; onInput?(i: Input): void;
  onHolder?(p: PlayerId|null): void; onPause?(): void; onResume?(): void; onEnd?(r: MatchResult): void;
}
interface GameSpec<S extends JsonValue> {
  id: string; name: string; version: string; tiles: { min: number; max: number };
  host: (ctx: HostContext) => HostHandlers<S>;
  view: (v: ViewContext<S>) => ViewHandlers<S>;
  controllers?: { min: number; max: number };  // ↓ defaults in comments, never set here: {min:0,max:0}
  players?: { min: number; max: number };      // = `tiles`: one Player per Tile Device
  templates?: TemplateId[]; minTileMm?: number; publishHz?: number; tickHz?: number;  // 20 Hz, 60 Hz
  clear?: string | false;  // '#000', painted before every draw    capture?: 'pointer'|'none';
  sample?: 'auto'|'latest'|((newest: Snap<S>, prev: Snap<S>|undefined, now: Ms) => S);  // 'auto'
}
declare function defineGame<S extends JsonValue>(spec: GameSpec<S>): GameModule<S>;
export { Surface, type Vec2, type Rect } from '@mgc/layout';   // one dependency per game bundle
```
`manifestOf(game)` derives PLAN §4's data `Manifest`; its `host`/`view` are bundle entry paths (default
`./host.html`, `./view.html`), both loading the one module via `@mgc/sdk/host-entry` and `/view-entry`.

## 2. The link port (remote-but-owned)
```ts
interface GameLink { post(e: JsonValue): void; onPost(h: (e: JsonValue) => void): void; close(): void }
interface LinkAdapter { open(half: 'host'|'view', mount?: HTMLElement): Promise<GameLink> }
interface ClockAnchor { epochOffset: Ms }    // sharedNow = Date.now() + epochOffset
declare function inProcessLink(g: GameModule): LinkAdapter;  // M2 + tests
declare function iframeLink(o: { src: string }): LinkAdapter;  // M3, sandbox="allow-scripts", no network
type ToHost = { k:'init'; match: MatchInfo; clock: ClockAnchor } | { k:'tick'; dt: Seconds; now: Ms }
  | { k:'input'; input: Input } | { k:'clock'; anchor: ClockAnchor } | { k:'pause' } | { k:'resume' }
  | { k:'msg'; msg: JsonValue; from: { deviceId: DeviceId; playerId?: PlayerId } } | { k:'stop'; why: string };
type FromHost = { k:'ready' } | { k:'state'; state: JsonValue; t: Ms; to?: DeviceId }
  | { k:'msg'; msg: JsonValue; to?: DeviceId } | { k:'end'; result: MatchResult }
  | { k:'holder'; deviceId: DeviceId; playerId: PlayerId|null } | { k:'error'; where: string; message: string };
type ToView = { k:'init'; match: MatchInfo; self: { deviceId: DeviceId; pxPerMm: number }; clock: ClockAnchor }
  | { k:'state'; state: JsonValue; t: Ms } | { k:'msg'; msg: JsonValue } | { k:'clock'; anchor: ClockAnchor }
  | { k:'holder'; playerId: PlayerId|null } | { k:'pause' } | { k:'resume' } | { k:'stop'; why: string } | { k:'end'; result: MatchResult };
type FromView = { k:'ready' } | { k:'input'; input: Input } | { k:'msg'; msg: JsonValue } | { k:'error'; where: string; message: string };
```

## 3. Platform-facing interface (what `apps/pwa` calls)
```ts
const MATCH_CHANNEL = 'match';
interface MatchSpec { matchId: string; seed?: number; world: Rect; devices: DeviceEntry[]; players: Player[] }
interface HostOptions {
  spec: MatchSpec; link: LinkAdapter; selfId: DeviceId; clock: { now(): Ms }; // core SharedClock fits
  deliver(to: DeviceId, env: ToView): void;   // remote Devices only; the local one is short-circuited
  onEnd(r: MatchResult | { aborted: string }): void; onError?(e: { where: string; message: string }): void;
}
interface MatchHost {
  deliver(env: FromView, from: DeviceId): void;          // envelopes arriving off the transport
  presence(deviceId: DeviceId, present: boolean): void;  // false → pause; true → resume + re-publish
  attachView(o: { mount: HTMLElement; pxPerMm: number }): Promise<MatchView>;   // the Host's own Tile
  abort(why: string): void; dispose(): void; }
interface ViewOptions {   // a Peer's half: the same spec, its own Device, its own transport closure
  spec: MatchSpec; link: LinkAdapter; mount: HTMLElement; clock: { now(): Ms };
  self: { deviceId: DeviceId; pxPerMm: number }; deliver(env: FromView): void; }
interface MatchView { deliver(env: ToView): void; dispose(): void }
declare function startHost(o: HostOptions): Promise<MatchHost>;  declare function startView(o: ViewOptions): Promise<MatchView>;
```
`attachView` is `startView` wired to the local host: constraint 3 by construction, the Host's own Tile on
the same envelope grammar as a Peer's, minus the transport.

## 4. Invariants, ordering, errors, cost
- **Clone or die.** Both adapters `structuredClone` every envelope, so unserialisable state fails
  identically in M2 and M3. This one rule is what makes "same source on both links" true.
- **Handshake, then the tick frame.** `init` is first and the platform buffers until `ready`. Then per
  step: queued `input`/`msg` in arrival order, `tick(dt, now)`, auto-publish. `dt` is constant
  (`1/tickHz`) via an accumulator, 5 catch-up steps max; `now()` never decreases; `t ≤` last is ignored.
- **Paused.** No ticks, inputs dropped (not queued: no teleporting paddle), `publish` warned+dropped;
  resume re-publishes `state()` first. First `end()` wins, `abort` is the platform's; both `stop`→close.
- **Errors never escape.** A handler throw becomes `error`; a host-init throw or >10 errors in 1 s aborts
  `{aborted:'game-error'}`; a `draw` throw skips the frame (10 bad ones stop the loop); bad `to` dropped.
- **Cost, 4 Tiles.** 20 Hz × ~220 B pong snapshot ≈ 4.4 KB/s per Peer, 13 KB/s host upload (ADR-0002);
  identical snapshots skipped (~10 µs compare), >8 KB warns, ≤1 move per pointer per frame, no draw alloc.

## 5. The whole of pong
```ts
// games/pong/src/index.ts — the entire game
import { defineGame, type DeviceId, type Vec2 } from '@mgc/sdk';
const R = 9, PAD = { w: 10, h: 110, inset: 14 }, SPEED = 520, WIN = 7;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
type S = { ball: Vec2; pads: Record<DeviceId, number>; score: Record<DeviceId, number> };

export default defineGame<S>({
  id: 'mgc.pong', name: 'Pong', version: '1.0.0', tiles: { min: 2, max: 4 }, templates: ['row'],
  host: (ctx) => {
    const w = ctx.world, mid = { x: w.x + w.w / 2, y: w.y + w.h / 2 };
    const ends = [ctx.tiles[0]!.id, ctx.tiles[ctx.tiles.length - 1]!.id] as const;   // outer Tiles
    const pads = { [ends[0]]: mid.y, [ends[1]]: mid.y }, score = { [ends[0]]: 0, [ends[1]]: 0 };
    let ball = { x: mid.x, y: mid.y, vx: SPEED, vy: SPEED * 0.4 };
    const serve = (d: number) => (ball = { ...mid, vx: SPEED * d, vy: (Math.random() - 0.5) * SPEED });
    const hit = (padY: number) => Math.abs(ball.y - padY) < PAD.h / 2 + R;
    const lx = w.x + PAD.inset + PAD.w + R, rx = w.x + w.w - PAD.inset - PAD.w - R;
    return {
      state: () => ({ ball: { x: ball.x, y: ball.y }, pads, score }),
      onInput: (i) =>
        void (i.deviceId in pads && (pads[i.deviceId] = clamp(i.world.y, w.y + PAD.h / 2, w.y + w.h - PAD.h / 2))),
      tick: (dt) => {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if ((ball.y < w.y + R && ball.vy < 0) || (ball.y > w.y + w.h - R && ball.vy > 0)) ball.vy *= -1;
        if (ball.x < lx && ball.vx < 0 && hit(pads[ends[0]]!)) ball.vx *= -1;
        if (ball.x > rx && ball.vx > 0 && hit(pads[ends[1]]!)) ball.vx *= -1;
        if (ball.x < w.x - R || ball.x > w.x + w.w + R) {
          const scorer = ball.x < w.x ? ends[1] : ends[0];
          if (++score[scorer]! >= WIN) return ctx.end({ scores: Object.fromEntries(ends.map((d) => [ctx.playerAt(d)!, score[d]!])) });
          serve(scorer === ends[0] ? 1 : -1);
        }
      },
    };
  },
  view: (v) => {
    const ends = [v.tiles[0]!.id, v.tiles[v.tiles.length - 1]!.id];
    return {
      draw: ({ ctx, state: s, world: w }) => {
        if (!s) return;
        ctx.fillStyle = '#f2f0ea';
        ctx.fillRect(w.x + PAD.inset, s.pads[ends[0]!]! - PAD.h / 2, PAD.w, PAD.h);
        ctx.fillRect(w.x + w.w - PAD.inset - PAD.w, s.pads[ends[1]!]! - PAD.h / 2, PAD.w, PAD.h);
        ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, R, 0, Math.PI * 2); ctx.fill();
      },
    };
  },
});
```
Every view draws the **whole** World; its Tile transform clips it, so nothing says "my tile". No canvas
setup, resize, rAF, pointer listener, px→mm, `publish`, snapshot buffer, pause or clock arithmetic is in
the game. **Extrapolation is the default:** `sample:'auto'` lerps the two newest snapshots at `now` and
extrapolates past the newest (clamped to 75 ms) under one rule — *numbers at the same JSON path move,
anything else snaps* — 60 fps off 20 Hz with no game code; velocity publishers or deltas override it.

## 6. The `apps/pwa` call site
```ts
import { startHost, startView, inProcessLink, MATCH_CHANNEL, type FromView, type ToView } from '@mgc/sdk';
import pong from '@mgc/game-pong';
// Host Device, once the lobby has frozen roster + Layout
const spec = {
  matchId, seed: Date.now() & 0xffff, world: layout.bounds, players: lobby.players,
  devices: layout.devices.map((t) => ({ deviceId: t.id, role: 'tile' as const, tile: t, playerId: lobby.seat(t.id) })),
};
const match = await startHost({
  spec, link: inProcessLink(pong),   // M3: iframeLink({ src: '/games/pong/host.html' })
  selfId: session.transport.selfId, clock: session.clock, onEnd: (r) => showResults(r),
  deliver: (to, env) => session.transport.send(MATCH_CHANNEL, env, to),
});
await match.attachView({ mount: stage, pxPerMm: self.pxPerMm });   // the Host's own Tile
session.transport.onMessage(MATCH_CHANNEL, (env, from) => match.deliver(env as FromView, from));
session.transport.onPeerLeave((id) => match.presence(id, false));  session.transport.onPeerJoin((id) => match.presence(id, true));
const view = await startView({   // Peer Device
  spec, link: inProcessLink(pong), mount: stage, clock: session.clock,
  self: { deviceId: session.transport.selfId, pxPerMm: self.pxPerMm },
  deliver: (env) => session.transport.send(MATCH_CHANNEL, env, session.hostId!),
});
session.transport.onMessage(MATCH_CHANNEL, (env) => view.deliver(env as ToView));
```
`spec` is plain data: a Peer receives the identical object over the existing layout channel. `PeerId ===
DeviceId` today, but the pwa owns that mapping — `Transport`/`PeerId` never appear in an sdk signature.

## 7. What the seam hides
- **Clock.** The platform sends `epochOffset = clock.now() − Date.now()` at init and whenever it moves
  >2 ms (polled every 2 s). A context anchors once (`shared₀ = Date.now()+offset`, `perf₀ = perf.now()`)
  then runs on its **own** `performance.now()`, so an iframe's own time origin is irrelevant; re-anchoring
  slews ≤5 %/s under 20 ms, jumps above, and `now()` stays monotone.
- **Input.** The view runtime binds `pointerdown/move/up/cancel` on its canvas (`touch-action:none`), maps
  px→mm with its `Surface`, stamps `{deviceId, playerId?, pointerId, phase, world, t:now()}`, and coalesces
  moves to the newest per `pointerId` per rAF (down/up/cancel never coalesced, order kept).
- **Holder map & publishing.** `setHolder` → `{k:'holder'}` → the host runtime stamps `playerId` on that
  Controller's input and messages and tells its view via `onHolder`. `state()` is sampled on tick
  boundaries at `publishHz`, skipped when unchanged, stamped, cloned once, fanned out by the platform.
- **Canvas** (creation in `mount`, DPR, resize, `Surface.applyTo`, clear, loop paused on `document.hidden`
  per PLAN §7) and **link** (ready handshake, buffering, clone-on-post, error isolation, teardown).

## 8. Dependencies, adapters, tests
| Dependency | Category | Treatment |
|---|---|---|
| `@mgc/layout` `Surface`/`Vec2`/`Rect` | in-process | merged and re-exported; no port, no adapter |
| the game↔platform link | remote-but-owned | **real seam**: `LinkAdapter` + `inProcessLink` + `iframeLink` |
| shared clock | local-substitutable | a `{now(): Ms}` parameter; a fake is one line, not a module |
| transport / roster / `@mgc/core` | — | **absent**: the pwa passes `deliver` closures |
| canvas / pointer events | true-external | used directly; headless tests take the `mount`-less path |

`@mgc/layout`'s `DeviceRect.id` is typed `PeerId` from `@mgc/core`, so the sdk re-declares the identical
`TileRect.id: DeviceId` and keeps `@mgc/core` out of its graph. The in-process adapter is the test one:
```ts
const t = createTestMatch({ game: pong, spec: twoTiles });   // in-process link, fake clock
t.tick(1000); t.input({ deviceId: 'a', world: { x: 0, y: 40 } }); t.tick(100);
expect(t.state('b').ball.x).toBeGreaterThan(0);  expect(await t.result()).toEqual({ scores: … });
```
A game's suite runs the real grammar through the real `structuredClone`, so "passes in M2" means
"serialises in M3"; the platform half uses a lossy `deliver`, and postMessage needs one conformance test.

## 9. Trade-offs
**High leverage.** The deep part is the view runtime — canvas lifecycle, DPR, Surface transform, pointer
capture and coalescing, snapshot buffer, sampler, clock anchoring, pause — all behind `draw(g)`: pong's
view is 8 lines and would be ~150 without it. `defineGame` + auto-publish reduce the host half to "mutate
fields, return a snapshot", and the link port replaces a bridge per game with one grammar.

**Deliberately thin.** `MatchSpec → MatchInfo` is a rename, the `Surface` re-export is pass-through
(ADR-0004 makes the game transform itself), `send`/`onMessage` are a relay. The deletion test passes only
for the group: without the sdk every game re-writes px→mm, snapshot interpolation, a hi-DPI loop, clock
re-anchoring, pause handling and its own iframe protocol, and the pwa grows a branch per game. Delete
only the re-export and games gain a second dependency: packaging, not leverage.

**The defaults are bets.** `sample:'auto'` is wrong for delta or event-log state and overshoots a bounce
by ≤75 ms (~39 mm at pong's speed); `publishHz:20` is unmeasured on real phones (PLAN §7); `players` =
one per Tile is wrong for single-Tile co-op. Each is one named field documented at that field, because a
subtly wrong default teaches the wrong model. **Refused:** base class, emitter, entity system, scene graph.
