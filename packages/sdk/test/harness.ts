import { vi } from 'vitest';
import { MemoryHub, hostSession, joinSession, type Session } from '@mgc/core';
import { buildLayout } from '@mgc/layout';
import {
  defineGame,
  inProcessLink,
  runMatch,
  type CloseReason,
  type Device,
  type DeviceId,
  type Down,
  type Frame,
  type Game,
  type HostContext,
  type Input,
  type LinkFactory,
  type MatchEvent,
  type MatchHandle,
  type MatchInfo,
  type MatchResult,
  type NetFrame,
  type PauseReason,
  type Tile,
  type Up,
  type ViewContext,
} from '../src';
import { SteppedFrames, headlessScreen, type HeadlessScreen, type HeadlessScreenOptions, type Matrix } from '../src/headless';

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

/** `got`: the phase of the input the host published this state for. */
export type ProbeState = { n: number; to?: DeviceId; got?: Input['phase'] };

export interface Probe {
  game: Game;
  rec: ProbeRecord;
}

/** What one view saw, in order: states, the local echo of its own input, pauses and resumes. */
export type Seen = { state: ProbeState } | { input: Input } | { pause: PauseReason } | { resume: number };

/** A host `onPause`/`onResume`, with how many ticks and inputs had run before it. */
export type HostPause = ({ pause: PauseReason } | { resume: number }) & { afterTicks: number; afterInputs: number };

export interface ProbeRecord {
  /** Host ticks in order. */
  ticks: { dt: number; now: number }[];
  /** Host `onInput` in order, with how many ticks had run before it. */
  inputs: { input: Input; afterTicks: number }[];
  /** Host `onPause`/`onResume` in order. */
  pauses: HostPause[];
  host: HostContext<ProbeState, never> | undefined;
  views: Map<DeviceId, ViewContext<ProbeState, never>>;
  /** Every state each view received, in order. */
  states: Map<DeviceId, { state: ProbeState; t: number }[]>;
  /** States, input echoes, pauses and resumes per view, interleaved as they happened. */
  seen: Map<DeviceId, Seen[]>;
  /** Each view's `onEnd`. */
  ends: Map<DeviceId, { reason: CloseReason; result?: MatchResult }[]>;
  /** Every frame each view drew, with the transform it was handed. */
  draws: Map<DeviceId, { frame: Frame<ProbeState>; transform: Matrix }[]>;
}

/**
 * A recording Game. Its host publishes `{ n }` on tick n unless `onTick` takes
 * over, and hands every input to `onInput`; its views record states, input
 * echoes and the end, and frames when `draw` is on (a function is also called
 * on each frame, after it was recorded, and may throw). `view` runs first in
 * every view's factory and may throw.
 */
export function probeGame(
  o: {
    onTick?: (ctx: HostContext<ProbeState, never>, n: number) => void;
    onInput?: (ctx: HostContext<ProbeState, never>, i: Input) => void;
    view?: (ctx: ViewContext<ProbeState, never>) => void;
    draw?: true | ((deviceId: DeviceId, n: number) => void);
    input?: 'off';
  } = {},
): Probe {
  const rec: ProbeRecord = { ticks: [], inputs: [], pauses: [], host: undefined, views: new Map(), states: new Map(), seen: new Map(), ends: new Map(), draws: new Map() };
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
        onInput(input) {
          rec.inputs.push({ input, afterTicks: rec.ticks.length });
          o.onInput?.(ctx, input);
        },
        onPause(reason) {
          rec.pauses.push({ pause: reason, afterTicks: rec.ticks.length, afterInputs: rec.inputs.length });
        },
        onResume(now) {
          rec.pauses.push({ resume: now, afterTicks: rec.ticks.length, afterInputs: rec.inputs.length });
        },
      };
    },
    view(ctx) {
      o.view?.(ctx);
      rec.views.set(ctx.deviceId, ctx);
      const states: { state: ProbeState; t: number }[] = [];
      const seen: Seen[] = [];
      const ends: { reason: CloseReason; result?: MatchResult }[] = [];
      const draws: { frame: Frame<ProbeState>; transform: Matrix }[] = [];
      rec.states.set(ctx.deviceId, states);
      rec.seen.set(ctx.deviceId, seen);
      rec.ends.set(ctx.deviceId, ends);
      rec.draws.set(ctx.deviceId, draws);
      return {
        onState(state, t) {
          states.push({ state, t });
          seen.push({ state });
        },
        onInput(input) {
          seen.push({ input });
        },
        onPause(reason) {
          seen.push({ pause: reason });
        },
        onResume(now) {
          seen.push({ resume: now });
        },
        onEnd(r) {
          ends.push(r);
        },
        ...(o.draw && {
          draw(frame: Frame<ProbeState>) {
            const m = frame.ctx.getTransform();
            draws.push({ frame, transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } });
            if (typeof o.draw === 'function') o.draw(ctx.deviceId, draws.length);
          },
        }),
        ...(o.input && { input: o.input }),
      };
    },
  });
  return { game, rec };
}

export interface RigDevice {
  handle: MatchHandle;
  events: MatchEvent[];
  screen: HeadlessScreen;
  session: Session;
}

export interface Rig {
  frames: SteppedFrames;
  devices: Map<DeviceId, RigDevice>;
  /** Added to every Device's shared clock as `runMatch` sees it: a test's stand-in for a clock re-estimate. */
  skewMs: number;
  /** The Host's shared clock, skew included. */
  sharedNow(): number;
  /**
   * Peer `id`'s tab goes away: its connection leaves the hub and its
   * `runMatch` stops with its page. Returns what it had; its Session still
   * sends, from the stale connection.
   */
  drop(id: DeviceId): RigDevice;
  /**
   * Peer `id` comes back as a new page: a new Session under a new peer id with
   * the same `deviceId`, then, once that Session is ready, a new `runMatch` on
   * a fresh screen in `devices`, as the app does.
   */
  rejoin(id: DeviceId): void;
}

/** The channel the app would use for Match frames; the SDK never sees it. */
const MATCH_CHANNEL = 'match';

/**
 * One Session per Device of `match` over a MemoryHub (`host` hosts, the rest
 * join and sync), then `runMatch` on each with `send`/`deliver` bound to the
 * Session, as the app wires it: a Peer's frames go to the Host, and the Host
 * pauses on the loss of a Match Device. `host` gets `authority`.
 */
export function startMatch(o: {
  game: Game;
  match: MatchInfo;
  host: DeviceId;
  latencyMs?: number;
  /** Per-Device module load; defaults to resolving `game` at once. */
  load?: (id: DeviceId) => Promise<{ default: Game }>;
  /** Per Device, what `runMatch` opens its links through instead of the in-process link `base` (e.g. `tapLink(base)`). */
  link?: (id: DeviceId, base: LinkFactory) => LinkFactory;
  pxPerMm?: number;
  screen?: HeadlessScreenOptions;
}): Rig {
  const hub = new MemoryHub(() => o.latencyMs ?? 0);
  const pxPerMm = o.pxPerMm ?? 6;
  const screen = o.screen ?? { widthPx: 390, heightPx: 844, dpr: 3 };
  /** Each Session's transport peer id: a Device that comes back gets a new one. */
  const peerIdOf = new Map<Session, string>();
  const join = (id: DeviceId, open: typeof hostSession): Session => {
    const peerId = `peer-${peerIdOf.size + 1}-of-${id}`;
    const session = open(hub.connect(peerId), { deviceId: id, name: id, width: screen.widthPx, height: screen.heightPx, dpr: screen.dpr, pxPerMm });
    peerIdOf.set(session, peerId);
    return session;
  };
  const sessions = new Map<DeviceId, Session>([[o.host, join(o.host, hostSession)]]);
  for (const d of o.match.devices) if (d.deviceId !== o.host) sessions.set(d.deviceId, join(d.deviceId, joinSession));
  vi.advanceTimersByTime(3000);
  const unsynced = [...sessions.values()].filter((s) => s.status !== 'ready');
  if (unsynced.length > 0) throw new Error(`Sessions not ready: ${unsynced.map((s) => s.self.deviceId).join(', ')}`);

  const frames = new SteppedFrames();
  const run = (id: DeviceId, session: Session): void => {
    const fake = headlessScreen(frames, screen);
    const events: MatchEvent[] = [];
    const load = o.load ?? (() => Promise.resolve({ default: o.game }));
    const base = inProcessLink(() => load(id));
    const handle = runMatch({
      link: o.link ? o.link(id, base) : base,
      match: o.match,
      self: { deviceId: id, pxPerMm, mount: fake.mount },
      now: () => session.clock.now() + rig.skewMs,
      send: (frame, to) => session.send(MATCH_CHANNEL, frame, id === o.host ? to : o.host),
      onEvent: (e) => events.push(e),
      ...(id === o.host && { authority: true }),
    });
    session.onMessage(MATCH_CHANNEL, (data, from) => handle.deliver(data as NetFrame, from));
    if (id === o.host) pauseOnDeviceLoss(session, o.match, handle);
    rig.devices.set(id, { handle, events, screen: fake, session });
  };
  const rig: Rig = {
    frames,
    devices: new Map(),
    skewMs: 0,
    sharedNow: () => sessions.get(o.host)!.clock.now() + rig.skewMs,
    drop(id) {
      const gone = rig.devices.get(id)!;
      gone.handle.stop('link-lost');
      hub.disconnect(peerIdOf.get(gone.session)!);
      return gone;
    },
    rejoin(id) {
      const session = join(id, joinSession);
      const off = session.onChange(() => {
        if (session.status !== 'ready') return;
        off();
        run(id, session);
      });
    },
  };
  for (const [id, session] of sessions) run(id, session);
  return rig;
}

/**
 * The Host app's pause policy (`apps/pwa/src/pause.ts`): the loss of a Match
 * Device pauses the Match naming it; the Match resumes once every lost Match
 * Device is back and has synced its clock (its new page runs its part by then).
 */
function pauseOnDeviceLoss(session: Session, match: MatchInfo, handle: MatchHandle): void {
  const inMatch = new Set(match.devices.map((d) => d.deviceId));
  const lost = new Set<DeviceId>();
  let waitingFor: DeviceId | undefined;
  const follow = (): void => {
    for (const e of session.roster()) if (e.present && e.sync.synced) lost.delete(e.info.deviceId);
    const [next] = lost;
    if (next === waitingFor) return;
    waitingFor = next;
    handle.setPaused(next === undefined ? null : { kind: 'device-lost', deviceId: next });
  };
  session.onDeviceLost((id) => {
    if (!inMatch.has(id)) return;
    lost.add(id);
    follow();
  });
  session.onChange(follow);
}

/** A link factory's links with every frame seen in both directions, and a way into the stream the platform hears. */
export interface Tapped {
  link: LinkFactory;
  /** What the platform posted on each side's link, in order. */
  down: Record<'host' | 'view', Down[]>;
  /** Delivers `f` to the platform as if that side's game had sent it (cloned, at once). */
  inject(side: 'host' | 'view', f: unknown): void;
}

/**
 * Wraps `base`: `up` sees every frame a game sends before the platform does
 * and returns what the platform gets instead (`undefined`: nothing), as a
 * buggy or foreign game side would speak.
 */
export function tapLink(base: LinkFactory, up: (f: Up, side: 'host' | 'view') => Up | undefined = (f) => f): Tapped {
  const down: Tapped['down'] = { host: [], view: [] };
  const hear = new Map<'host' | 'view', (f: Up) => void>();
  return {
    down,
    inject(side, f) {
      const h = hear.get(side);
      if (!h) throw new Error(`tapLink: the ${side} link is not open`);
      h(structuredClone(f) as Up);
    },
    link: async (opts) => {
      const link = await base(opts);
      return {
        post(f) {
          down[opts.side].push(structuredClone(f));
          link.post(f);
        },
        onFrame(h) {
          hear.set(opts.side, h);
          return link.onFrame((f) => {
            const g = up(f, opts.side);
            if (g) h(g);
          });
        },
        close: () => link.close(),
      };
    },
  };
}

/** The events of a kind, in order. */
export function eventsOf<T extends MatchEvent['t']>(events: readonly MatchEvent[], t: T): Extract<MatchEvent, { t: T }>[] {
  return events.filter((e): e is Extract<MatchEvent, { t: T }> => e.t === t);
}

/** Lets queued link deliveries and due network messages land, advancing fake time by `ms`. */
export async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** One animation frame `ms` after the previous one, then everything it set off locally. */
export async function step(rig: Rig, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  rig.frames.fire(performance.now());
  await vi.advanceTimersByTimeAsync(0);
}
