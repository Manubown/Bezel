import { Surface, type Vec2 } from '@mgc/layout';
import type { Env } from './env';
import type { Game, ViewContext } from './game';
import { headlessScreen, SteppedFrames, type HeadlessScreen } from './headless';
import { linkInProcess } from './in-process';
import { runMatchWith, type MatchEvent, type MatchHandle } from './match';
import type { DeviceId, Input, JsonValue, MatchInfo, MatchResult, PauseReason } from './types';
import type { NetFrame } from './wire';

export interface TestMatchOptions {
  game: Game;
  match: MatchInfo;
  /** The Device that hosts; default the first in `match.devices`, as the lobby orders them. */
  host?: DeviceId;
  /** CSS px per mm on every Device; default 6. */
  pxPerMm?: number;
}

export interface TestMatch<S extends JsonValue = JsonValue> {
  /** Shared time, ms; starts at 0. */
  now(): number;
  /**
   * Advances the fake clock by `ms`, one animation frame per fixed step (60 per
   * second without one), and lets every frame's frames land before the next.
   */
  tick(ms: number): Promise<void>;
  /**
   * A pointer event on `deviceId`'s view at `at` (a Tile: world mm; a
   * Controller: its screen mm), on its topmost element (the SDK's capture, or
   * a DOM view's own button), then one animation frame at the current time:
   * it reaches the host game before the next tick (at once when event-driven).
   */
  input(deviceId: DeviceId, phase: Input['phase'], at: Vec2, pointerId?: number): Promise<void>;
  /**
   * The Host platform's `setPaused`, as on a Device's loss (a reason) and
   * return (`null`), then everything it set off. Time does not move.
   */
  setPaused(reason: PauseReason | null): Promise<void>;
  /** The latest state `deviceId`'s view has applied. */
  state(deviceId: DeviceId): S | undefined;
  /** The same with its host time: the view's `latest()`. */
  latest(deviceId: DeviceId): { state: S; t: number } | undefined;
  /** The result, once the host game ended the Match. */
  result(): MatchResult | undefined;
  /** What `runMatch` reported on `deviceId`, in order. */
  events(deviceId: DeviceId): readonly MatchEvent[];
  /** Aborts the Match if it still runs. */
  stop(): Promise<void>;
}

/**
 * A whole Match in one process for a game's tests: `runMatch` on every Device
 * of `match` over the in-process link (so every frame is cloned as it will be
 * in an iframe), a headless screen per Device, a fake shared clock, and pointer
 * input scripted through each view's own capture. Never touches global timers.
 */
export async function createTestMatch<S extends JsonValue = JsonValue>(o: TestMatchOptions): Promise<TestMatch<S>> {
  const hostId = o.host ?? o.match.devices[0]?.deviceId;
  if (hostId === undefined || !o.match.devices.some((d) => d.deviceId === hostId)) {
    throw new Error(`createTestMatch: host ${String(hostId)} is not a Device of the Match`);
  }
  const pxPerMm = o.pxPerMm ?? 6;

  let clock = 0;
  /** `every` 0: fires once. */
  const timers: { every: number; due: number; fn: () => void; live: boolean }[] = [];
  const schedule = (every: number, ms: number, fn: () => void): (() => void) => {
    const timer = { every, due: clock + ms, fn, live: true };
    timers.push(timer);
    return () => void (timer.live = false);
  };
  const env: Env = {
    wall: () => clock,
    mono: () => clock,
    every: (ms, fn) => schedule(ms, ms, fn),
    after: (ms, fn) => schedule(0, ms, fn),
  };
  const frames = new SteppedFrames();

  // The views' contexts, to read what each view holds.
  const views = new Map<DeviceId, ViewContext<JsonValue, JsonValue>>();
  const game: Game = {
    ...o.game,
    view(ctx) {
      views.set(ctx.deviceId, ctx);
      return o.game.view(ctx);
    },
  };
  const link = linkInProcess(() => Promise.resolve({ default: game }), env);

  const devices = new Map<DeviceId, { handle: MatchHandle; events: MatchEvent[]; screen: HeadlessScreen; surface: Surface | undefined }>();
  // Between Devices frames cross as JSON, in order, asynchronously: like the Transport.
  const deliver = (to: DeviceId, frame: NetFrame, from: DeviceId): void => {
    const wire = JSON.parse(JSON.stringify(frame)) as NetFrame;
    queueMicrotask(() => devices.get(to)?.handle.deliver(wire, from));
  };
  for (const d of o.match.devices) {
    const { deviceId, tile } = d;
    const screen = headlessScreen(frames, { widthPx: d.screenMm.x * pxPerMm, heightPx: d.screenMm.y * pxPerMm, dpr: 1 });
    const events: MatchEvent[] = [];
    const isHost = deviceId === hostId;
    const handle = runMatchWith(
      {
        link,
        match: o.match,
        self: { deviceId, pxPerMm, mount: screen.mount },
        now: () => clock,
        send(frame, to) {
          if (!isHost) deliver(hostId, frame, deviceId);
          else if (to !== undefined) deliver(to, frame, deviceId);
          else for (const other of o.match.devices) if (other.deviceId !== deviceId) deliver(other.deviceId, frame, deviceId);
        },
        onEvent: (e) => events.push(e),
        ...(isHost && { authority: true }),
      },
      env,
    );
    const surface = tile && new Surface({ id: deviceId, x: tile.x, y: tile.y, w: tile.w, h: tile.h, rot: tile.rot }, pxPerMm);
    devices.set(deviceId, { handle, events, screen, surface });
  }

  const device = (id: DeviceId) => {
    const d = devices.get(id);
    if (!d) throw new Error(`createTestMatch: no Device ${id} in the Match`);
    return d;
  };
  /** Advances the clock to `to`, firing due timers on the way, then one animation frame. */
  const frame = async (to: number): Promise<void> => {
    for (;;) {
      const next = timers.filter((t) => t.live && t.due <= to).sort((a, b) => a.due - b.due)[0];
      if (!next) break;
      clock = next.due;
      if (next.every > 0) next.due += next.every;
      else next.live = false;
      next.fn();
    }
    clock = to;
    frames.fire(clock);
    await settle();
  };
  const frameMs = o.match.tickHz > 0 ? 1000 / o.match.tickHz : 1000 / 60;
  const latest = (deviceId: DeviceId): { state: S; t: number } | undefined => {
    device(deviceId);
    // The view's own record of the state it applied; `S` is the caller's claim about the game.
    return views.get(deviceId)?.latest() as { state: S; t: number } | undefined;
  };

  await settle();
  const notStarted = [...devices].filter(([, d]) => !d.events.some((e) => e.t === 'started')).map(([id]) => id);
  if (notStarted.length > 0) throw new Error(`createTestMatch: not started on ${notStarted.join(', ')}: ${JSON.stringify(device(notStarted[0]!).events)}`);

  return {
    now: () => clock,
    async tick(ms) {
      const end = clock + ms;
      // Steps land exactly on frames: the runtime adds the same step to the same start.
      while (clock + frameMs <= end + 1e-9) await frame(clock + frameMs);
      if (clock < end) await frame(end);
    },
    async input(deviceId, phase, at, pointerId = 1) {
      const { screen, surface } = device(deviceId);
      const px = surface ? surface.worldToPx(at) : { x: at.x * pxPerMm, y: at.y * pxPerMm };
      screen.pointer(`pointer${phase}`, { pointerId, x: px.x, y: px.y });
      frames.fire(clock);
      await settle();
    },
    async setPaused(reason) {
      device(hostId).handle.setPaused(reason);
      await settle();
    },
    latest,
    state: (deviceId) => latest(deviceId)?.state,
    result() {
      const ended = device(hostId).events.find((e) => e.t === 'ended');
      return ended?.t === 'ended' ? ended.result : undefined;
    },
    events: (deviceId) => device(deviceId).events,
    async stop() {
      device(hostId).handle.stop('aborted');
      await settle();
    },
  };
}

/**
 * Lets every queued microtask (link and network deliveries, and whatever they
 * set off) run: one macrotask, from a channel no fake-timer library replaces.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}
