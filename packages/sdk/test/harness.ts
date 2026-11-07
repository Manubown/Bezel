import { vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type Session } from '@mgc/core';
import { buildLayout } from '@mgc/layout';
import {
  defineGame,
  inProcessLink,
  runMatch,
  type Device,
  type DeviceId,
  type Frame,
  type Game,
  type HostContext,
  type MatchEvent,
  type MatchHandle,
  type MatchInfo,
  type NetFrame,
  type Tile,
  type ViewContext,
} from '../src';

/** Animation frames that fire only when a test steps them, all together, at the fake clock's time. */
export class SteppedFrames {
  private readonly pending = new Map<number, FrameRequestCallback>();
  private next = 1;

  readonly request = (cb: FrameRequestCallback): number => {
    const id = this.next++;
    this.pending.set(id, cb);
    return id;
  };

  readonly cancel = (id: number): void => {
    this.pending.delete(id);
  };

  fire(): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    const t = performance.now();
    for (const cb of due) cb(t);
  }
}

export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** The slice of CanvasRenderingContext2D the SDK and the probe use, recording what happened. */
export class FakeContext2D {
  readonly ops: string[] = [];
  private m: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  private readonly saved: Matrix[] = [];

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.m = { a, b, c, d, e, f };
  }
  getTransform(): Matrix {
    return { ...this.m };
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.ops.push(`clearRect ${x} ${y} ${w} ${h}`);
  }
  save(): void {
    this.saved.push(this.m);
  }
  restore(): void {
    this.m = this.saved.pop() ?? this.m;
  }
}

class FakeElement {
  readonly style = { cssText: '' };
  readonly children: FakeElement[] = [];
  private parent: FakeElement | undefined;

  constructor(readonly ownerDocument: FakeDocument) {}

  get clientWidth(): number {
    return this.ownerDocument.screen.widthPx;
  }
  get clientHeight(): number {
    return this.ownerDocument.screen.heightPx;
  }
  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }
  prepend(child: FakeElement): void {
    child.parent = this;
    this.children.unshift(child);
  }
  remove(): void {
    const siblings = this.parent?.children;
    siblings?.splice(siblings.indexOf(this), 1);
    this.parent = undefined;
  }
}

class FakeCanvas extends FakeElement {
  width = 300;
  height = 150;
  readonly context = new FakeContext2D();
  getContext(kind: string): FakeContext2D | null {
    return kind === '2d' ? this.context : null;
  }
}

class FakeDocument {
  readonly defaultView: { requestAnimationFrame: SteppedFrames['request']; cancelAnimationFrame: SteppedFrames['cancel']; devicePixelRatio: number };
  readonly canvases: FakeCanvas[] = [];

  constructor(
    readonly screen: FakeScreenOptions,
    frames: SteppedFrames,
  ) {
    this.defaultView = { requestAnimationFrame: frames.request, cancelAnimationFrame: frames.cancel, devicePixelRatio: screen.dpr };
  }

  createElement(tag: string): FakeElement {
    if (tag !== 'canvas') return new FakeElement(this);
    const canvas = new FakeCanvas(this);
    this.canvases.push(canvas);
    return canvas;
  }
}

export interface FakeScreenOptions {
  /** CSS px of the mount. */
  widthPx: number;
  heightPx: number;
  dpr: number;
}

export interface FakeScreen {
  /** Passed to `runMatch` as `self.mount`. */
  mount: HTMLElement;
  /** Every canvas the SDK created on this screen. */
  canvases: FakeCanvas[];
  /** What the SDK appended to the mount. */
  children: readonly unknown[];
}

/** A headless mount: the SDK reaches the window (frames, dpr) and creates its DOM through it. */
export function fakeScreen(frames: SteppedFrames, screen: FakeScreenOptions = { widthPx: 390, heightPx: 844, dpr: 3 }): FakeScreen {
  const doc = new FakeDocument(screen, frames);
  const mount = new FakeElement(doc);
  return { mount: mount as unknown as HTMLElement, canvases: doc.canvases, children: mount.children };
}

export const TILE_MM = { w: 70, h: 150 };

/** A row of Tiles in the given order, then Controllers. */
export function matchOf(o: { tiles: DeviceId[]; controllers?: DeviceId[]; tickHz?: number }): MatchInfo {
  const layout = buildLayout('row', o.tiles.map((id) => ({ id, ...TILE_MM })));
  const tiles: Tile[] = layout.devices.map(({ id, x, y, w, h, rot }) => ({ deviceId: id, x, y, w, h, rot }));
  return matchFromTiles(tiles, layout.bounds, o.controllers ?? [], o.tickHz ?? 50);
}

export function matchFromTiles(tiles: Tile[], bounds: MatchInfo['bounds'], controllers: DeviceId[], tickHz: number): MatchInfo {
  const devices: Device[] = [
    ...tiles.map((tile): Device => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    ...controllers.map((deviceId): Device => ({ deviceId, role: 'controller', name: deviceId, screenMm: { x: TILE_MM.w, y: TILE_MM.h } })),
  ];
  return {
    matchId: 'match-1',
    seed: 7,
    tickHz,
    players: [
      { playerId: 'p-ann', name: 'Ann' },
      { playerId: 'p-bo', name: 'Bo' },
    ],
    devices,
    tiles,
    bounds,
  };
}

export type ProbeState = { n: number; to?: DeviceId };

export interface Probe {
  game: Game;
  rec: ProbeRecord;
}

export interface ProbeRecord {
  /** Host ticks in order. */
  ticks: { dt: number; now: number }[];
  host: HostContext<ProbeState, never> | undefined;
  views: Map<DeviceId, ViewContext<ProbeState, never>>;
  /** Every state each view received, in order. */
  states: Map<DeviceId, { state: ProbeState; t: number }[]>;
  /** Every frame each view drew, with the transform it was handed. */
  draws: Map<DeviceId, { frame: Frame<ProbeState>; transform: Matrix }[]>;
}

/**
 * A recording Game. Its host publishes `{ n }` on tick n unless `onTick` takes
 * over; its views record states, and frames when `draw` is on.
 */
export function probeGame(o: { onTick?: (ctx: HostContext<ProbeState, never>, n: number) => void; draw?: boolean } = {}): Probe {
  const rec: ProbeRecord = { ticks: [], host: undefined, views: new Map(), states: new Map(), draws: new Map() };
  const game = defineGame<ProbeState, never>({
    manifest: {
      id: 'mgc.probe',
      name: 'Probe',
      version: '0.0.0',
      tiles: { min: 1, max: 4 },
      controllers: { min: 0, max: 1 },
      players: { min: 0, max: 2 },
      host: './probe.js',
      view: './probe.js',
    },
    host(ctx) {
      rec.host = ctx;
      return {
        tick(dt, now) {
          rec.ticks.push({ dt, now });
          const n = rec.ticks.length;
          if (o.onTick) o.onTick(ctx, n);
          else ctx.publish({ n });
        },
      };
    },
    view(ctx) {
      rec.views.set(ctx.deviceId, ctx);
      const states: { state: ProbeState; t: number }[] = [];
      const draws: { frame: Frame<ProbeState>; transform: Matrix }[] = [];
      rec.states.set(ctx.deviceId, states);
      rec.draws.set(ctx.deviceId, draws);
      return {
        onState(state, t) {
          states.push({ state, t });
        },
        ...(o.draw && {
          draw(frame: Frame<ProbeState>) {
            const m = frame.ctx.getTransform();
            draws.push({ frame, transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } });
          },
        }),
      };
    },
  });
  return { game, rec };
}

export interface Rig {
  frames: SteppedFrames;
  devices: Map<DeviceId, { handle: MatchHandle; events: MatchEvent[]; screen: FakeScreen; session: Session }>;
  /** Added to every Device's shared clock as `runMatch` sees it: a test's stand-in for a clock re-estimate. */
  skewMs: number;
  /** The Host's shared clock, skew included. */
  sharedNow(): number;
}

/** The channel the app would use for Match frames; the SDK never sees it. */
const MATCH_CHANNEL = 'match';

/**
 * One Session per Device of `match` over a MemoryHub (`host` hosts, the rest
 * join and sync), then `runMatch` on each with `send`/`deliver` bound to the
 * Session, as the app wires it. `host` gets `authority`.
 */
export function startMatch(o: {
  game: Game;
  match: MatchInfo;
  host: DeviceId;
  latencyMs?: number;
  /** Per-Device module load; defaults to resolving `game` at once. */
  load?: (id: DeviceId) => Promise<{ default: Game }>;
  pxPerMm?: number;
  screen?: FakeScreenOptions;
}): Rig {
  const hub = new MemoryHub(() => o.latencyMs ?? 0);
  const pxPerMm = o.pxPerMm ?? 6;
  const screen = o.screen ?? { widthPx: 390, heightPx: 844, dpr: 3 };
  const join = (id: DeviceId, open: typeof hostSession): Session =>
    open(hub.connect(`peer-of-${id}`), { deviceId: id, name: id, width: screen.widthPx, height: screen.heightPx, dpr: screen.dpr, pxPerMm });
  const sessions = new Map<DeviceId, Session>([[o.host, join(o.host, hostSession)]]);
  for (const d of o.match.devices) if (d.deviceId !== o.host) sessions.set(d.deviceId, join(d.deviceId, joinSession));
  vi.advanceTimersByTime(3000);
  const unsynced = [...sessions.values()].filter((s) => s.status !== 'ready');
  if (unsynced.length > 0) throw new Error(`Sessions not ready: ${unsynced.map((s) => s.self.deviceId).join(', ')}`);

  const frames = new SteppedFrames();
  const rig: Rig = {
    frames,
    devices: new Map(),
    skewMs: 0,
    sharedNow: () => sessions.get(o.host)!.clock.now() + rig.skewMs,
  };
  for (const [id, session] of sessions) {
    const fake = fakeScreen(frames, screen);
    const events: MatchEvent[] = [];
    const load = o.load ?? (() => Promise.resolve({ default: o.game }));
    const handle = runMatch({
      link: inProcessLink(() => load(id)),
      match: o.match,
      self: { deviceId: id, pxPerMm, mount: fake.mount },
      now: () => session.clock.now() + rig.skewMs,
      send: (frame, to) => session.send(MATCH_CHANNEL, frame, to),
      onEvent: (e) => events.push(e),
      ...(id === o.host && { authority: true }),
    });
    session.onMessage(MATCH_CHANNEL, (data, from) => handle.deliver(data as NetFrame, from));
    rig.devices.set(id, { handle, events, screen: fake, session });
  }
  return rig;
}

/** Lets queued link deliveries and due network messages land, advancing fake time by `ms`. */
export async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** One animation frame `ms` after the previous one, then everything it set off locally. */
export async function step(rig: Rig, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  rig.frames.fire();
  await vi.advanceTimersByTimeAsync(0);
}
