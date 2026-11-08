import { Surface, type Vec2 } from '@mgc/layout';
import { version as SDK_VERSION } from '../package.json';
import { GameClock } from './clock';
import { REAL_ENV, type Env } from './env';
import type { Frame, Game, HostContext, HostHandlers, ViewContext, ViewHandlers } from './game';
import { holderRefusal } from './holders';
import { assertJson } from './json';
import type { DeviceId, HolderEntry, Input, JsonValue, MatchInfo, PlayerId, RawInput } from './types';
import { WIRE_VERSION, type Down, type Fault, type Up } from './wire';

/** The game's end of a link. */
export interface GamePort {
  post(f: Up): void;
  onFrame(h: (f: Down) => void): void;
}

/** `draw` throws on this many frames in a row: the view stops painting and its link closes. */
export const DRAW_FAULTS_TO_CLOSE = 10;

type CloseFrame = Extract<Down, { t: 'close' }>;
type ViewSelf = Extract<Down, { t: 'init'; side: 'view' }>['self'];

/**
 * Runs one side of `game` in this realm, speaking the wire protocol over
 * `port`: `ready` first, nothing before `init`, every handler call guarded so a
 * throw becomes a `fault` frame instead of crossing the seam. Identical code
 * behind every link adapter. The returned teardown disposes the game side if
 * the link goes away without a `close` frame.
 */
export function serveGame(game: Game, side: 'host' | 'view', port: GamePort, root?: HTMLElement, env: Env = REAL_ENV): () => void {
  let runtime: GameSide;
  if (side === 'host') runtime = new HostSide(game, port, env);
  else if (root) runtime = new ViewSide(game, port, root, env);
  else throw new Error('a view needs a root element');
  runtime.open();
  return () => runtime.shutdown();
}

abstract class GameSide {
  protected readonly clock: GameClock;
  private phase: 'waiting' | 'running' | 'closed' = 'waiting';
  private outbox: Up[] = [];
  private depth = 0;

  constructor(
    private readonly side: 'host' | 'view',
    private readonly port: GamePort,
    env: Env,
  ) {
    this.clock = new GameClock(env);
  }

  open(): void {
    this.port.onFrame((f) => this.receive(f));
    this.port.post({ v: WIRE_VERSION, t: 'ready', side: this.side, sdk: SDK_VERSION });
  }

  /** `close` is the frame that closed the Match, if one arrived. */
  shutdown(close?: CloseFrame): void {
    if (this.phase === 'closed') return;
    const started = this.phase === 'running';
    this.phase = 'closed';
    if (started) this.stop(close);
  }

  /** Frames posted while game code runs leave after it returns, in order; none leave after close. */
  protected post(f: Up): void {
    if (this.phase === 'closed') return;
    if (this.depth > 0) this.outbox.push(f);
    else this.port.post(f);
  }

  /**
   * Runs game code; a throw is reported as a `fault` frame, `fatal` when this
   * side cannot go on without what `run` was to set up. True if it returned.
   */
  protected guard(where: string, run: () => void, fatal = false): boolean {
    const thrown = this.attempt(run);
    if (thrown) this.post(fault(`${this.side}.${where}`, thrown.error, fatal));
    return !thrown;
  }

  /** Runs game code, holding what it posts until it returns. Returns what it threw, if anything. */
  protected attempt(run: () => void): { error: unknown } | undefined {
    this.depth++;
    try {
      run();
      return undefined;
    } catch (error) {
      return { error };
    } finally {
      if (--this.depth === 0) {
        const out = this.outbox;
        this.outbox = [];
        for (const f of out) this.post(f);
      }
    }
  }

  /** `ctx.log`: never throws into the game. */
  protected log(args: readonly unknown[]): void {
    this.post({ v: 1, t: 'log', args: args.map(logArg) });
  }

  protected abstract start(f: Extract<Down, { t: 'init' }>): void;
  protected abstract frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void;
  protected abstract stop(close: CloseFrame | undefined): void;

  private receive(f: Down): void {
    if (this.phase === 'closed') return;
    if (this.phase === 'waiting') {
      if (f.t !== 'init' || f.side !== this.side) return;
      this.phase = 'running';
      this.clock.receive(f.clock);
      this.start(f);
    } else if (f.t === 'clock') this.clock.receive(f.clock);
    else if (f.t === 'close') this.shutdown(f);
    else if (f.t !== 'init') {
      // A resume re-anchors the clock before any handler sees it.
      if (f.t === 'resume') this.clock.receive(f.clock);
      this.frame(f);
    }
  }
}

class HostSide extends GameSide {
  private handlers: HostHandlers<JsonValue> = {};
  /** Shared time of the step being ticked; stamps what `tick` publishes. */
  private tickNow: number | undefined;
  /** Set by `end`: frames already in flight run no handler. */
  private ended = false;
  /** Each Controller's Holder as the host game set it: what `holderOf` says. */
  private readonly holders = new Map<DeviceId, PlayerId | null>();
  /** The same as the platform last broadcast it: `onHolder` fires on its changes. */
  private readonly heard = new Map<DeviceId, PlayerId | null>();

  constructor(
    private readonly game: Game,
    port: GamePort,
    env: Env,
  ) {
    super('host', port, env);
  }

  protected start(f: Extract<Down, { t: 'init' }>): void {
    const { match } = f;
    for (const { deviceId, playerId } of f.holders) {
      this.holders.set(deviceId, playerId);
      this.heard.set(deviceId, playerId);
    }
    // After `end` these still go out, refused or not: the host runtime is the one that rejects them.
    const ctx: HostContext<JsonValue, JsonValue> = {
      match,
      now: () => this.clock.now(),
      publish: (state, to) => {
        assertJson(state, 'publish: state');
        const at = this.tickNow ?? this.clock.now();
        // Frames posted inside a handler wait for it to return: copy now, so a later mutation is not what gets sent.
        const copy = structuredClone(state);
        this.post(to === undefined ? { v: 1, t: 'publish', state: copy, at } : { v: 1, t: 'publish', state: copy, to, at });
      },
      setHolder: (controller, playerId) => {
        if (!this.ended && holderRefusal(match, controller, playerId) === undefined) this.holders.set(controller, playerId);
        this.post({ v: 1, t: 'set-holder', deviceId: controller, playerId });
      },
      holderOf: (controller) => this.holders.get(controller) ?? null,
      timer: (tag, delayMs) => this.post({ v: 1, t: 'timer', tag, delayMs }),
      end: (result) => {
        assertJson(result, 'end: result');
        this.ended = true;
        this.post({ v: 1, t: 'end', result });
      },
      log: (...args) => this.log(args),
    };
    if (!this.guard('factory', () => (this.handlers = handlersOf(this.game.host(ctx), 'host')), true)) return;
    // The platform steps a host with `tick` only; it waits for this before the first step.
    this.post({ v: 1, t: 'handlers', tick: typeof this.handlers.tick === 'function' });
  }

  protected frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void {
    // A refusal changes nothing here: the host runtime already logged it.
    if (f.t === 'reject') return;
    if (f.t === 'input') {
      for (const i of f.inputs) {
        if (this.ended) return;
        this.guard('onInput', () => this.handlers.onInput?.(i));
      }
      return;
    }
    if (f.t === 'holders') return this.hear(f.holders);
    if (this.ended) return;
    if (f.t === 'msg') this.guard('onMessage', () => this.handlers.onMessage?.(f.msg, f.from));
    else if (f.t === 'timer') this.guard('onTimer', () => this.handlers.onTimer?.(f.tag, f.now));
    else if (f.t === 'pause') this.guard('onPause', () => this.handlers.onPause?.(f.reason));
    else if (f.t === 'resume') this.guard('onResume', () => this.handlers.onResume?.(f.now, f.pausedMs));
    else if (f.t === 'tick' && this.handlers.tick) {
      this.tickNow = f.now;
      this.guard('tick', () => this.handlers.tick?.(f.dt, f.now));
      this.tickNow = undefined;
    }
  }

  /** `onHolder` for each Controller whose Holder the broadcast changed. */
  private hear(holders: readonly HolderEntry[]): void {
    for (const { deviceId, playerId } of holders) {
      if (this.heard.get(deviceId) === playerId) continue;
      this.heard.set(deviceId, playerId);
      if (!this.ended) this.guard('onHolder', () => this.handlers.onHolder?.(deviceId, playerId));
    }
  }

  protected stop(): void {
    this.guard('dispose', () => this.handlers.dispose?.());
  }
}

const PHASE_OF: Readonly<Record<string, Input['phase']>> = {
  pointerdown: 'down',
  pointermove: 'move',
  pointerup: 'up',
  pointercancel: 'cancel',
};

class ViewSide extends GameSide {
  private handlers: ViewHandlers<JsonValue, JsonValue> = {};
  private latest: { state: JsonValue; t: number } | undefined;
  private root: HTMLElement | undefined;
  private sender: Pick<Input, 'deviceId' | 'role'> | undefined;
  /** Each Controller's Holder, as the platform last said. */
  private readonly holders = new Map<DeviceId, PlayerId | null>();
  /** The paint loop behind `draw`: it runs while not paused and not hidden, until closed. */
  private painter = { pause: (): void => {}, resume: (): void => {}, close: (): void => {} };
  private stopCapture = (): void => {};
  /** Captured since the last animation frame, in order; at most one move per pointer. */
  private pending: RawInput[] = [];

  constructor(
    private readonly game: Game,
    port: GamePort,
    private readonly mount: HTMLElement,
    env: Env,
  ) {
    super('view', port, env);
  }

  protected start(f: Extract<Down, { t: 'init' }>): void {
    if (f.side !== 'view') return;
    const { match, self } = f;
    const doc = this.mount.ownerDocument;
    const win = doc.defaultView;
    const root = doc.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    this.mount.append(root);
    this.root = root;
    this.sender = { deviceId: self.deviceId, role: self.role };
    for (const { deviceId, playerId } of f.holders) this.holders.set(deviceId, playerId);

    const tile = self.tile;
    const surface = tile && new Surface({ id: self.deviceId, x: tile.x, y: tile.y, w: tile.w, h: tile.h, rot: tile.rot }, self.pxPerMm);
    const ctx: ViewContext<JsonValue, JsonValue> = {
      match,
      deviceId: self.deviceId,
      role: self.role,
      ...(tile && surface && { tile, surface }),
      screenMm: self.screenMm,
      pxPerMm: self.pxPerMm,
      get dpr() {
        return win?.devicePixelRatio || 1;
      },
      root,
      now: () => this.clock.now(),
      latest: () => this.latest,
      holder: (controller = self.deviceId) => this.holders.get(controller) ?? null,
      send: (msg) => {
        assertJson(msg, 'send: msg');
        this.post({ v: 1, t: 'send', msg });
      },
      log: (...args) => this.log(args),
    };
    // Without handlers there is nothing to run: the platform closes this view.
    if (!this.guard('factory', () => (this.handlers = handlersOf(this.game.view(ctx), 'view')), true)) return;
    if (this.handlers.mount) this.guard('mount', () => this.handlers.mount?.(root));
    if (!win) {
      if (this.handlers.draw) this.post(fault('view.draw', new Error('the view root is not in a window'), true));
      return;
    }
    if (this.handlers.input !== 'off') this.capture(win, root, self, surface);
    if (this.handlers.draw) this.draw(doc, win, root, match, self, surface);
  }

  protected frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void {
    if (f.t === 'state') {
      this.latest = { state: f.state, t: f.at };
      this.guard('onState', () => this.handlers.onState?.(f.state, f.at));
    } else if (f.t === 'pause') {
      // Input is still captured and sent while paused: the host drops it.
      this.painter.pause();
      this.guard('onPause', () => this.handlers.onPause?.(f.reason));
    } else if (f.t === 'resume') {
      this.guard('onResume', () => this.handlers.onResume?.(f.now, f.pausedMs));
      this.painter.resume();
    } else if (f.t === 'holders') {
      for (const { deviceId, playerId } of f.holders) {
        if (this.holders.get(deviceId) === playerId) continue;
        this.holders.set(deviceId, playerId);
        this.guard('onHolder', () => this.handlers.onHolder?.(deviceId, playerId));
      }
    }
  }

  protected stop(close: CloseFrame | undefined): void {
    this.painter.close();
    this.stopCapture();
    if (close) {
      const r = close.result === undefined ? { reason: close.reason } : { reason: close.reason, result: close.result };
      this.guard('onEnd', () => this.handlers.onEnd?.(r));
    }
    this.guard('dispose', () => this.handlers.dispose?.());
    this.root?.remove();
  }

  /**
   * Pointer capture on the view's root: `touch-action: none`, pointer capture
   * on down, px → mm through the Surface (a Controller: its screen mm), `t` on
   * the shared clock. Only pointers that went down here are followed, so a
   * hovering mouse sends nothing. Samples leave on the next animation frame.
   */
  private capture(win: Window, root: HTMLElement, self: ViewSelf, surface: Surface | undefined): void {
    const toMm = (e: PointerEvent): Vec2 => {
      const r = root.getBoundingClientRect();
      const px = { x: e.clientX - r.left, y: e.clientY - r.top };
      return surface ? surface.pxToWorld(px) : { x: px.x / self.pxPerMm, y: px.y / self.pxPerMm };
    };
    const down = new Set<number>();
    let raf = 0;
    const flush = (): void => {
      raf = 0;
      this.flushInput();
    };
    const on = (e: PointerEvent): void => {
      const phase = PHASE_OF[e.type];
      const id = e.pointerId;
      if (!phase) return;
      if (phase === 'down') {
        if (down.has(id)) return;
        down.add(id);
        try {
          root.setPointerCapture(id);
        } catch {
          // Not an active pointer (a scripted event): the root still hears it.
        }
      } else if (!down.has(id)) return;
      else if (phase !== 'move') down.delete(id);
      this.sample({ pointerId: id, phase, t: this.clock.now(), world: toMm(e) });
      if (raf === 0) raf = win.requestAnimationFrame(flush);
    };
    root.style.touchAction = 'none';
    for (const type of Object.keys(PHASE_OF)) root.addEventListener(type, on as EventListener);
    this.stopCapture = () => {
      for (const type of Object.keys(PHASE_OF)) root.removeEventListener(type, on as EventListener);
      win.cancelAnimationFrame(raf);
      this.pending = [];
    };
  }

  /** Queues `i`; a move replaces the same pointer's move still waiting since its last down/up/cancel. */
  private sample(i: RawInput): void {
    if (i.phase === 'move') {
      for (let k = this.pending.length - 1; k >= 0; k--) {
        const p = this.pending[k]!;
        if (p.pointerId !== i.pointerId) continue;
        if (p.phase === 'move') this.pending.splice(k, 1);
        break;
      }
    }
    this.pending.push(i);
  }

  /** One `input` frame with everything captured since the last one, echoed to this view's `onInput` first. */
  private flushInput(): void {
    if (this.pending.length === 0 || !this.sender) return;
    const inputs = this.pending;
    this.pending = [];
    const { deviceId, role } = this.sender;
    // Stamped as the host will: a Controller's input carries its Holder.
    const playerId = this.holders.get(deviceId) ?? undefined;
    const sender = playerId === undefined ? { deviceId, role } : { deviceId, role, playerId };
    for (const { pointerId, phase, t, world } of inputs) {
      this.guard('onInput', () => this.handlers.onInput?.({ ...sender, pointerId, phase, t, world: { ...world } }));
    }
    this.post({ v: 1, t: 'input', inputs });
  }

  /**
   * The SDK-owned canvas and animation loop behind `draw`. The loop runs while
   * the Match is not paused and the page is not hidden. A frame whose `draw`
   * throws is skipped (the first throw of a run is reported); on the tenth in a
   * row the loop stops for good and a fatal fault asks the platform to close
   * this view.
   */
  private draw(doc: Document, win: Window, root: HTMLElement, match: MatchInfo, self: ViewSelf, surface: Surface | undefined): void {
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    root.prepend(canvas);
    const g = canvas.getContext('2d');
    if (!g) {
      this.post(fault('view.draw', new Error('Canvas2D is unavailable'), true));
      return;
    }
    const place = { bounds: match.bounds, screenMm: self.screenMm, ...(self.tile && { tile: self.tile }) };
    let raf = 0;
    let paused = false;
    /** Closed, or `draw` failed too often: the loop never runs again. */
    let done = false;
    /** `draw` throws in a row. */
    let failing = 0;
    const paint = (): void => {
      raf = 0;
      if (doc.hidden) return; // `visibilitychange` restarts the loop
      raf = win.requestAnimationFrame(paint);
      // Input captured since the last frame leaves now, so this frame's draw already sees its echo.
      this.flushInput();
      const dpr = win.devicePixelRatio || 1;
      const w = Math.round(root.clientWidth * dpr);
      const h = Math.round(root.clientHeight * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.save();
      if (surface) surface.applyTo(g, dpr);
      else g.setTransform(dpr * self.pxPerMm, 0, 0, dpr * self.pxPerMm, 0, 0);
      const now = this.clock.now();
      const latest = this.latest;
      const f: Frame<JsonValue> = { ctx: g, now, state: latest?.state, t: latest ? latest.t : now, ...place };
      const thrown = this.attempt(() => this.handlers.draw?.(f));
      g.restore();
      if (!thrown) failing = 0;
      else if (++failing >= DRAW_FAULTS_TO_CLOSE) {
        done = true;
        sync();
        this.post(fault('view.draw', thrown.error, true, `threw on ${failing} frames in a row`));
      } else if (failing === 1) this.post(fault('view.draw', thrown.error));
    };
    /** Requests or cancels the next frame to match the state. */
    const sync = (): void => {
      const run = !done && !paused && !doc.hidden;
      if (run && raf === 0) raf = win.requestAnimationFrame(paint);
      else if (!run && raf !== 0) {
        win.cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    doc.addEventListener('visibilitychange', sync);
    this.painter = {
      pause() {
        paused = true;
        sync();
      },
      resume() {
        paused = false;
        sync();
      },
      close() {
        done = true;
        sync();
        doc.removeEventListener('visibilitychange', sync);
      },
    };
    sync();
  }
}

/** A factory's return value, if it is a handlers record. */
function handlersOf<H extends object>(h: H, side: 'host' | 'view'): H {
  if (h === null || typeof h !== 'object') throw new TypeError(`the ${side} factory returned ${h === null ? 'null' : typeof h}, not handlers`);
  return h;
}

/** `note` is appended to the error's message (`draw` says how often it threw). */
function fault(where: string, e: unknown, fatal = false, note?: string): Fault {
  const err = e instanceof Error ? e : undefined;
  const said = err ? err.message : text(e);
  const f: Fault = { v: 1, t: 'fault', where, message: note ? `${said} (${note})` : said };
  if (err?.stack) f.stack = err.stack;
  if (fatal) f.fatal = true;
  return f;
}

/** A `log` argument: JSON stays JSON, an Error becomes its stack, anything else its text. */
function logArg(x: unknown): JsonValue {
  if (x instanceof Error) return x.stack ?? `${x.name}: ${x.message}`;
  try {
    assertJson(x, 'log');
    return x;
  } catch {
    return text(x);
  }
}

function text(x: unknown): string {
  try {
    return String(x);
  } catch {
    return Object.prototype.toString.call(x);
  }
}
