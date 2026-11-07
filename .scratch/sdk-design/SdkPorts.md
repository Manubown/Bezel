# `@mgc/sdk` — ports & adapters (SdkPorts)
One cross-seam dependency deserves a real port: the **link** (`inProcessLink` ‖ `iframeLink`). Three small ports — **clock**, **input source**, **loop** — exist so the runner is drivable without a browser; the **net** port keeps `PeerId` out of everything. Everything else is in-process and merged. Entry points: `wire` (frames), `runtime` (`mountHost`/`mountView`/`surfaceOf`, what a game imports), `runner` (`createHostRunner`/`createViewRunner`/`transportNet`, what `apps/pwa` calls), root re-exports `Surface`/`aabbOf`/`unionRect` from `@mgc/layout`. The runner is the deep module; the versioned wire protocol is the contract it defends.

## 1. Shared data (`@mgc/sdk/wire`) — clone-safe; no functions, DOM, `Transport`, `PeerId`
```ts
export type DeviceId = string; export type PlayerId = string; export type MatchId = string;
export type JsonValue = null|boolean|number|string|JsonValue[]|{[k:string]:JsonValue};
export interface Vec2 { x:number; y:number } export interface Rect { x:number;y:number;w:number;h:number }
export interface Player { playerId:PlayerId; name:string }
export interface MatchDevice { deviceId:DeviceId; role:DeviceRole; name:string }
export interface TileRect { deviceId:DeviceId; x:number;y:number;w:number;h:number;rot:number } // world mm
export interface MatchLayout { tiles:TileRect[]; bounds:Rect }   // frozen per Match, like devices and players
export interface SurfaceSpec { rect:TileRect; pxPerMm:number }   // enough to rebuild a Surface view-side
/** `pos` is millimetres: world mm for tiles (mapped via Surface), that screen's own mm for controllers. */
export interface Input { deviceId:DeviceId; playerId?:PlayerId; pointerId:number; phase:Phase; at:number;
  pos:Vec2; space:'world'|'device' }
export interface HolderEntry { deviceId:DeviceId; playerId:PlayerId|null }
export interface Sender { deviceId:DeviceId; playerId?:PlayerId }   // stamped on input and view messages
export interface MatchResult { scores?:Record<PlayerId,number>; ranking?:PlayerId[] }
export type PauseReason = {kind:'device-lost'; deviceId:DeviceId}|{kind:'platform'; note?:string};
export type CloseReason = 'ended'|'aborted'|'version'|'protocol'|'fault'|'link-lost';
export interface GameManifest { id:string; name:string; version:string; host:string; view:string;
  tiles:{min:number;max:number}; controllers:{min:number;max:number}; players:{min:number;max:number};
  templates?:('row'|'column'|'grid')[]; minTileMm?:number }
export interface MatchSpec { matchId:MatchId; manifest:GameManifest; config:JsonValue; devices:MatchDevice[];
  players:Player[]; layout:MatchLayout; surfaces:Record<DeviceId,SurfaceSpec>; stepMs?:number /* 1000/60 */ }
```
## 2. Game-facing interface (`@mgc/sdk/runtime`)
```ts
export type HostFactory<S=JsonValue,M=JsonValue> = (ctx:HostContext<S,M>) => GameHost<M>;
export interface GameHost<M=JsonValue> {
  tick(dt:number, now:number): void;              // required; fixed step; dt seconds, now shared ms
  onInput?(i:Input): void;                        // playerId already stamped by the platform
  onMessage?(msg:M, from:Sender): void; onHolderChange?(d:DeviceId, p:PlayerId|null): void;
  onPause?(r:PauseReason): void; onResume?(now:number): void; onClose?(r:CloseReason): void; } // re-publish
export interface HostContext<S=JsonValue,M=JsonValue> {
  readonly matchId:MatchId; readonly devices:readonly MatchDevice[]; readonly players:readonly Player[];
  readonly layout:MatchLayout; readonly config:JsonValue; readonly clock:ClockPort;
  readonly holders:{ playerOf(d:DeviceId):PlayerId|null; deviceOf(p:PlayerId):DeviceId|null };
  publish(state:S, to?:DeviceId): void; send(msg:M, to?:DeviceId): void;   // broadcast when `to` omitted
  setHolder(controllerDeviceId:DeviceId, playerId:PlayerId|null): void; end(result:MatchResult): void; }
export type ViewFactory<S=JsonValue,M=JsonValue> = (ctx:ViewContext<M>) => GameView<S,M>;
export interface GameView<S=JsonValue,M=JsonValue> {
  onState?(state:S, t:number): void;              // t = shared time the host stamped
  onFrame?(now:number): void;                     // SDK-driven rAF; extrapolate here
  onMessage?(msg:M): void; onHolderChange?(h:readonly HolderEntry[]): void;
  onPause?(r:PauseReason): void; onResume?(now:number): void; dispose?(): void;
  onClose?(r:CloseReason, result?:MatchResult): void; }
export interface ViewContext<M=JsonValue> {
  readonly role:DeviceRole; readonly deviceId:DeviceId; readonly matchId:MatchId; readonly config:JsonValue;
  readonly players:readonly Player[]; readonly devices:readonly MatchDevice[];
  readonly layout?:MatchLayout; readonly surface?:Surface; readonly clock:ClockPort;   // layout/surface: tiles only
  readonly holders:readonly HolderEntry[];
  readonly root:HTMLElement;                      // supplied locally by the adapter, never over the wire
  canvas(): WorldCanvas;                          // sugar: DPR, resize, surface.applyTo per frame
  send(msg:M): void; input:{ setEnabled(on:boolean):void }; }   // opt-out of SDK pointer capture
export interface WorldCanvas { el:HTMLCanvasElement; begin():CanvasRenderingContext2D; end():void }
export function mountHost<S,M>(f:HostFactory<S,M>): void;        // both self-attaching, §3.2
export function mountView<S,M>(f:ViewFactory<S,M>): void;
export function surfaceOf(spec:SurfaceSpec): Surface;            // adapts TileRect → layout's DeviceRect
```
## 3. The link port and its wire protocol
```ts
export interface Endpoint<Out,In> { post(m:Out):void; onMessage(h:(m:In)=>void):()=>void; close():void }
export type PlatformEnd = Endpoint<HostDown|ViewDown, HostUp|ViewUp>;   // game half: the mirror of this
export interface LinkPort { open(entry:'host'|'view',
  o:{ matchId:MatchId; deviceId:DeviceId; root:HTMLElement }): Promise<PlatformEnd> }
export const WIRE_VERSION = 1;
export interface ClockWire { epochOffset:number; sentAt:number; maxErrorMs?:number }
export type Shared =                                           // present in both down-unions
  | { v:1; t:'holders'; holders:HolderEntry[] } | { v:1; t:'clock'; clock:ClockWire }
  | { v:1; t:'pause'; reason:PauseReason; now:number } | { v:1; t:'resume'; now:number; clock:ClockWire }
  | { v:1; t:'close'; reason:CloseReason; result?:MatchResult };
export type HostDown = Shared
  | { v:1; t:'init'; entry:'host'; spec:Omit<MatchSpec,'surfaces'>; holders:HolderEntry[]; clock:ClockWire }
  | { v:1; t:'tick'; n:number; dt:number; now:number }          // n strictly +1; now non-decreasing
  | { v:1; t:'input'; inputs:Input[] }                          // coalesced batch, ordered by `at`
  | { v:1; t:'msg'; msg:JsonValue; from:Sender }
  | { v:1; t:'reject'; of:'publish'|'send'|'set-holder'|'end'; reason:string };
export type ViewDown = Shared
  | { v:1; t:'init'; entry:'view'; matchId:MatchId; role:DeviceRole; deviceId:DeviceId; config:JsonValue;
      devices:MatchDevice[]; players:Player[]; layout?:MatchLayout; surface?:SurfaceSpec;  // tiles only
      holders:HolderEntry[]; clock:ClockWire }
  | { v:1; t:'state'; state:JsonValue; at:number } | { v:1; t:'msg'; msg:JsonValue }
  | { v:1; t:'surface'; surface:SurfaceSpec };                  // recalibration / orientation change
export type Fault = { v:1; t:'fault'; where:string; message:string; stack?:string };
export type HostUp = Fault
  | { v:number; t:'ready'; entry:'host'; sdk:string }           // FIRST frame on the link, always
  | { v:1; t:'publish'; state:JsonValue; to?:DeviceId; at:number }
  | { v:1; t:'msg'; msg:JsonValue; to?:DeviceId } | { v:1; t:'end'; result:MatchResult }
  | { v:1; t:'set-holder'; deviceId:DeviceId; playerId:PlayerId|null };
export type ViewUp = Fault
  | { v:number; t:'ready'; entry:'view'; sdk:string } | { v:1; t:'send'; msg:JsonValue }
  | { v:1; t:'input'; inputs:RawInput[] };                       // runner stamps deviceId and playerId
export type RawInput = Omit<Input,'playerId'|'deviceId'>;
```
| When | Frame | Path |
|---|---|---|
| game runtime loaded; then `ready` seen with `v===WIRE_VERSION` | `ready`, then `init` | g→p, then p→g |
| every fixed step while running (host link only) | `tick` | p→g |
| every rAF a view has pending pointer samples | `input` | view g→p→net→p→g host |
| game calls `publish` / `send` | `publish`→`state`; `send`→`msg{from}`; `msg{to}`→`msg` | host ↔ net ↔ views |
| `set-holder` accepted; every ~2 s | `holders` to the host **and every view**; `clock` | p→g |
| device drop / return | `pause`; then `resume`+`clock` — host and all views | p→g |
| `end`, abort, or fault budget blown | `close` | p→g |
### 3.1 Clock across the link (constraint 4)
`epochOffset = platformClock.now() − Date.now()` at send. Game-side `WireClock` pins `base = performance.now()` and `shared0 = epochOffset + Date.now()` on receipt, then returns `shared0 + (performance.now() − base)`; later `clock` frames **slew** (≤2 % rate correction, never a backwards jump). `Date.now()` is the only epoch two browsing contexts share; `performance.now()` gives the monotonic delta. Identical code on both links — in-process merely happens to be exact. The game sees one `now()`.
### 3.2 Ordering · errors · performance · mount
- **Order.** `ready` is the only up-frame before `init`; `init` is the only down-frame, exactly once. No `tick` between `pause` and `resume`. `holders` always precedes the first `input` stamped with the new `playerId`. Up-frames after `close` are dropped. Per `(deviceId,pointerId)` the runner enforces `down → move* → (up|cancel)`, drops orphans, and emits a synthetic `cancel` for every open pointer on device drop or close.
- **Errors.** `ready.v ≠ 1` → `close{'version'}`. Unknown or out-of-order tag → `close{'protocol'}`. A throw in any game handler is caught game-side and reported as `fault`; >3 faults in 5 s, or one in `init`, → `close{'fault'}`. No `ready` within 5 s of `open()`, or iframe unload → `close{'link-lost'}`. `set-holder` naming a non-controller/unknown device or unknown player, or `publish` after `end` → `reject`, state unchanged. All surface to the platform as `MatchEvent`; none throw into `apps/pwa`.
- **Performance.** `move` coalesces per `pointerId` per frame (one up-frame per view per rAF); `down/up/cancel` never coalesce. `tick` catch-up caps at 5 steps/frame, then wall time is dropped. `publish` is never coalesced — rate is the game's call; host upload is (N−1) × publish rate (ADR-0002). `inProcessLink` **always** `structuredClone`s `publish`/`state`/`msg`: identical semantics to postMessage, so a game that publishes a `Map` fails in M2 instead of surprising us in M3.
- **Mount.** `mountHost`/`mountView` register into a module-scoped one-shot queue. In an iframe the runtime self-attaches to `window.parent`; `inProcessLink` serialises `load()` behind a mutex and takes the registered entry after `import()` resolves. Game source is identical on both links.
## 4. Platform-facing interface (`@mgc/sdk/runner`)
```ts
export interface ClockPort { now():number }                   // core's SharedClock satisfies this as-is
export interface LoopPort { start(cb:(localMs:number)=>void):()=>void }        // rafLoop | timerLoop | manualLoop
export interface RawPointer { pointerId:number; phase:Phase; px:Vec2; at?:number }
export interface InputSource { start(sink:(s:RawPointer)=>void):()=>void }     // domInput | scriptedInput | noInput
export interface HostNetPort { send(to:DeviceId|'all', f:ViewDown):void;
  onFromView(h:(from:DeviceId, f:ViewUp)=>void):()=>void;
  onDeviceDrop(h:(d:DeviceId)=>void):()=>void; onDeviceReturn(h:(d:DeviceId)=>void):()=>void }
export interface ViewNetPort { send(f:ViewUp):void; onFromHost(h:(f:ViewDown)=>void):()=>void }
export type Sub<E> = (h:(e:E)=>void) => () => void;
export type MatchEvent = { t:'started' } | { t:'paused'; reason:PauseReason } | { t:'resumed' }
  | { t:'holders'; holders:HolderEntry[] } | { t:'ended'; result:MatchResult }
  | { t:'aborted'; reason:CloseReason; detail?:string } | { t:'fault'; where:string; message:string };
export function createHostRunner(o:{ match:MatchSpec; link:LinkPort; clock:ClockPort; net:HostNetPort;
  loop:LoopPort; root:HTMLElement }): { matchId:MatchId; start():Promise<void>; abort(r?:string):void;
    events:Sub<MatchEvent>; dispose():void };
export function createViewRunner(o:{ link:LinkPort; clock:ClockPort; net:ViewNetPort; loop:LoopPort;
  input:InputSource; root:HTMLElement }): { start():Promise<void>; events:Sub<MatchEvent>; dispose():void };
/** Structural subset of @mgc/core's Transport — satisfied by it, imported from it never. */
export interface WireTransport { readonly selfId:string; send(c:string,d:unknown,to?:string):void;
  onMessage(c:string,h:(d:unknown,from:string)=>void):()=>void;
  onPeerJoin(h:(id:string)=>void):()=>void; onPeerLeave(h:(id:string)=>void):()=>void }
export interface DeviceIdMap { deviceOf(p:string):DeviceId|undefined; peerOf(d:DeviceId):string|undefined;
  bind(peer:string, device:DeviceId):void }                   // rebind on reconnect: new PeerId, same Device
/** On the Host, send('all') also feeds the local `view` port, so constraint 3 needs no host-view path: */
export function transportNet(t:WireTransport, ids:DeviceIdMap, self:DeviceId): { host:HostNetPort; view:ViewNetPort };
```
## 5. Usage
```ts
// games/pong/src/host.ts — byte-identical in M2 and M3
import { mountHost, type GameHost, type HostContext, type DeviceId, type PlayerId } from '@mgc/sdk';
interface State { ball:{x:number;y:number;vx:number;vy:number}; paddles:Record<DeviceId,number>;
  score:Record<PlayerId,number> }
const PAD = 70, BALL = 20, WIN = 5;                                        // mm, mm, goals
const pong = (ctx: HostContext<State>): GameHost => {
  const b = ctx.layout.bounds, ends = [ctx.layout.tiles[0]!, ctx.layout.tiles.at(-1)!];  // outer tiles
  const pad = Object.fromEntries(ends.map(t => [t.deviceId, b.y+b.h/2])) as Record<DeviceId,number>;
  const ball = { x: b.x+b.w/2, y: b.y+b.h/2, vx: 420, vy: 170 }, score: Record<PlayerId,number> = {};
  const snap = (): State => ({ ball: {...ball}, paddles: {...pad}, score: {...score} });
  const goal = (side: 0|1) => {                        // the Player holding the far Controller scores
    const p = ctx.holders.playerOf(ends[1-side]!.deviceId) ?? ctx.players[1-side]!.playerId;
    Object.assign(ball, { x: b.x+b.w/2, y: b.y+b.h/2, vx: side ? 420 : -420, vy: 170 });
    if ((score[p] = (score[p] ?? 0) + 1) >= WIN)
      ctx.end({ scores: score, ranking: Object.keys(score).sort((a,c)=>score[c]!-score[a]!) }); };
  return {
    onInput(i) { if (i.space === 'world' && i.deviceId in pad)             // controllers send space 'device'
      pad[i.deviceId] = Math.min(b.y+b.h-PAD/2, Math.max(b.y+PAD/2, i.pos.y)); },
    onResume() { ctx.publish(snap()); },
    tick(dt) {
      ball.x += ball.vx*dt; ball.y += ball.vy*dt;
      if (ball.y < b.y+BALL/2 || ball.y > b.y+b.h-BALL/2) ball.vy *= -1;
      ends.forEach((t, side) => { const face = side ? t.x+t.w-BALL/2 : t.x+BALL/2;
        if (side ? ball.x > face : ball.x < face)
          Math.abs(ball.y - pad[t.deviceId]!) < PAD/2 ? (ball.vx *= -1) : goal(side as 0|1); });
      ctx.publish(snap()); }, };
};
mountHost(pong);
```
```ts
// games/pong/src/view.ts
import { mountView, type GameView, type ViewContext } from '@mgc/sdk';
const view = (ctx: ViewContext): GameView<State> => {
  const c = ctx.canvas(), left = ctx.layout?.tiles[0]?.deviceId;  // tile → world mm; controller → device mm
  let s: State | undefined, at = 0;
  return {
    onState(next, t) { s = next; at = t; },
    onFrame(now) {
      const g = c.begin(), dt = Math.min((now - at)/1000, 0.1);   // extrapolate from the stamped state time
      if (ctx.role === 'controller') g.fillRect(4, 4, 52, 52);    // private touchpad, device mm
      else if (s) {
        g.fillRect(s.ball.x + s.ball.vx*dt - 10, s.ball.y + s.ball.vy*dt - 10, 20, 20);
        for (const [d, y] of Object.entries(s.paddles)) { const t = ctx.layout!.tiles.find(t=>t.deviceId===d)!;
          g.fillRect(t.x + (d === left ? 6 : t.w - 14), y - 35, 8, 70); } }
      c.end(); }, };
};
mountView(view);
```
```ts
// apps/pwa/src/match/start.ts
import { createHostRunner, createViewRunner, transportNet, inProcessLink, rafLoop, domInput } from '@mgc/sdk';
const net = transportNet(session.transport, idMap, myDeviceId);         // core Transport fits WireTransport
const link = inProcessLink({ load: e => e === 'host' ? import('@mgc/pong/host') : import('@mgc/pong/view') });
// M3, same call site: const link = iframeLink({ base: '/games/pong/', sandbox: 'allow-scripts' });
if (isHost) {                                                           // SharedClock already is a ClockPort
  const h = createHostRunner({ match, link, clock: session.clock, net: net.host, loop: rafLoop(), root: stage });
  h.events(e => hud.render(e)); await h.start(); }
await createViewRunner({ link, clock: session.clock, net: net.view, loop: rafLoop(),
  input: domInput(stage), root: stage }).start();                       // the Host runs a view too (§4)
```
## 6. End-to-end test — Host + 3 Peers in one vitest process, public interfaces only
```ts
// packages/sdk/test/match.e2e.test.ts  (@mgc/core is a devDependency, used only here)
import { MemoryHub } from '@mgc/core';
import { createHostRunner, createViewRunner, transportNet, inProcessLink, manualLoop, scriptedInput,
  staticIdMap, type MatchEvent } from '@mgc/sdk';
import { recordingGame } from './fixtures/pong-lite';  // written against §2 only; view records, never draws
it('runs a Match across 4 devices', async () => {
  vi.useFakeTimers();
  const hub = new MemoryHub(() => 2);                                     // 2 ms one-way
  const ids = staticIdMap({ p0:'d0', p1:'d1', p2:'d2', p3:'d3' });        // d0..d2 tiles, d3 controller
  const clock = { t: 0, now() { return this.t } }, loop = manualLoop();
  const nets = (['p0','p1','p2','p3'] as const).map((p,i) => transportNet(hub.connect(p), ids, `d${i}`));
  const link = inProcessLink({ load: e => Promise.resolve(recordingGame[e]) });
  const host = createHostRunner({ match, link, clock, net: nets[0]!.host, loop, root: el() });
  const views = nets.map(n => createViewRunner({ link, clock, net: n.view, loop, input: scriptedInput(),
    root: el() }));                                                      // d0's view is the Host's own Tile
  const ev = [host, ...views].map(r => { const a:MatchEvent[]=[]; r.events(e=>a.push(e)); return a; });
  await Promise.all([host.start(), ...views.map(v => v.start())]);
  await loop.advanceMs(100, clock);                                       // 6 fixed steps @ 16.67 ms
  expect(recordingGame.states('d3')).toHaveLength(6);                     // every view, incl. the Host's own
  scriptedInput.of(views[1]!).down(1, { x: 40, y: 90 }); await loop.frame();
  expect(recordingGame.inputs().at(-1)).toMatchObject({ deviceId:'d1', space:'world', pos:{ y: tile1.y+90 } });
  recordingGame.host().setHolder('d3', 'alice'); await loop.frame();
  scriptedInput.of(views[3]!).down(2, { x: 10, y: 10 }); await loop.frame();
  expect(recordingGame.inputs().at(-1)).toMatchObject({ deviceId:'d3', playerId:'alice', space:'device' });
  hub.disconnect('p2'); await vi.advanceTimersByTimeAsync(5);
  expect(ev.map(a => a.at(-1)!.t)).toEqual(Array(5).fill('paused'));      // host + all four views
  const before = recordingGame.states('d1').length; await loop.advanceMs(100, clock);
  expect(recordingGame.states('d1')).toHaveLength(before);                // paused: no tick, no state
  ids.bind('p2b','d2'); hub.connect('p2b'); await vi.advanceTimersByTimeAsync(5);   // same Device, new PeerId
  expect(recordingGame.states('d1').length).toBe(before + 1);             // host re-published on resume
  recordingGame.host().end({ scores: { alice: 5 } }); await vi.advanceTimersByTimeAsync(5);
  expect(ev[0]!.at(-1)).toMatchObject({ t:'ended', result:{ scores:{ alice:5 } } }); });
```
Nothing here touches runner internals: it drives `MemoryHub`, three test adapters and the game-facing interface. Swapping `inProcessLink` for `iframeLink` in a Playwright run reuses the same fixture game unchanged.
## 7. What the seam hides
Clock transport and monotonic re-derivation (§3.1); px→mm capture, coalescing, pointer-lifecycle repair, synthetic cancels; the holder map and `playerId` stamping (the game's `setHolder` is one line, its invariants ~40); the pause state machine and tick suppression; peerId↔deviceId mapping and reconnect rebinding; `'all'` fan-out including the Host's own loopback view; DPR/resize/orientation and `Surface` application; fault isolation and the close ladder; in-process vs iframe transport, mount resolution, clone validation. Deliberately *not* hidden: game state semantics, prediction, lobby, role assignment.
## 8. Dependency strategy
- **In-process (merged, no adapter):** `Surface` math from `@mgc/layout` (re-exported); `ClockPort` on the platform side — core's `SharedClock` *is* the port, so an adapter would add nothing but an import.
- **Remote-but-owned → port + two real adapters:** the **link** (`inProcessLink` is production in M2 *and* the test adapter; `iframeLink` is production in M3) and the **net** (`transportNet` over WebRTC; `loopbackNet` for single-device runs and the Host's own view). Both have ≥2 live adapters: real seams, not hypothetical.
- **Local-substitutable:** `LoopPort` (`rafLoop`/`manualLoop`), `InputSource` (`domInput`/`scriptedInput`/`noInput`); each has 2+ adapters actually in use and buys deterministic tests for ~15 lines. **True-external:** none.
- **Tests at the interface:** (a) §6 end-to-end; (b) *wire conformance* — a table of frame sequences replayed against both link adapters asserting identical game-visible effects, which keeps "identical source in M2/M3" honest rather than hopeful; (c) `WireClock` drift/slew units against a scripted `ClockWire` stream.

## 9. Trade-offs and the deletion test
**High leverage.** `createHostRunner` is ~500 lines behind six public names; delete it and every concern in §7 reappears in `apps/pwa` *and* in every game. `transportNet` is smaller, but deleting it forces `PeerId` into the runner and makes the Host's own view a special case — two invariants lost to save ~60 lines. `WireClock` deletes into "every game reimplements epoch correction", exactly the bug class nobody notices until two phones disagree by 40 ms.

**Thin by admission.** `ClockPort` is one method whose platform adapter is the identity: a *type*, justified only because the game side needs the same shape over a derived clock. `rafLoop` is five lines; `surfaceOf` is a field rename. If this had to shrink, `LoopPort` merges into the runner as an injectable `schedule` and `scriptedInput` becomes `runner.injectInput` — at the cost of the test no longer exercising the capture path. **Cost accepted:** a first-class link port with a versioned protocol taxes every new capability with a frame, an ordering rule and a conformance row. That tax is the point: it stops community games depending on accidents of the in-process path, and it is cheaper than the alternative for exactly as long as it takes to reach M3.
