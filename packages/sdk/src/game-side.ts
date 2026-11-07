import { Surface, type Vec2 } from '@mgc/layout';
import { version as SDK_VERSION } from '../package.json';
import { GameClock } from './clock';
import { REAL_ENV, type Env } from './env';
import type { Frame, Game, HostContext, HostHandlers, ViewContext, ViewHandlers } from './game';
import { assertJson } from './json';
import type { Input, JsonValue, MatchInfo, RawInput } from './types';
import { WIRE_VERSION, type Down, type Up } from './wire';

/** The game's end of a link. */
export interface GamePort {
  post(f: Up): void;
  onFrame(h: (f: Down) => void): void;
}

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

  /** Runs game code; a throw is reported as a `fault` frame. */
  protected guard(where: string, run: () => void): void {
    this.depth++;
    try {
      run();
    } catch (e) {
      this.outbox.push(fault(`${this.side}.${where}`, e));
    } finally {
      if (--this.depth === 0) {
        const out = this.outbox;
        this.outbox = [];
        for (const f of out) this.post(f);
      }
    }
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
  /** Set by `end`: frames already in flight run no handler, and `publish` is dropped. */
  private ended = false;

  constructor(
    private readonly game: Game,
    port: GamePort,
    env: Env,
  ) {
    super('host', port, env);
  }

  protected start(f: Extract<Down, { t: 'init' }>): void {
    const ctx: HostContext<JsonValue, JsonValue> = {
      match: f.match,
      now: () => this.clock.now(),
      publish: (state, to) => {
        if (this.ended) return;
        assertJson(state, 'publish: state');
        const at = this.tickNow ?? this.clock.now();
        this.post(to === undefined ? { v: 1, t: 'publish', state, at } : { v: 1, t: 'publish', state, to, at });
      },
      end: (result) => {
        if (this.ended) return;
        assertJson(result, 'end: result');
        this.ended = true;
        this.post({ v: 1, t: 'end', result });
      },
    };
    this.guard('factory', () => {
      this.handlers = this.game.host(ctx);
    });
  }

  protected frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void {
    if (f.t === 'input') {
      for (const i of f.inputs) {
        if (this.ended) return;
        this.guard('onInput', () => this.handlers.onInput?.(i));
      }
      return;
    }
    if (this.ended) return;
    if (f.t === 'pause') this.guard('onPause', () => this.handlers.onPause?.(f.reason));
    else if (f.t === 'resume') this.guard('onResume', () => this.handlers.onResume?.(f.now));
    else if (f.t === 'tick' && this.handlers.tick) {
      this.tickNow = f.now;
      this.guard('tick', () => this.handlers.tick?.(f.dt, f.now));
      this.tickNow = undefined;
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
  /** The paint loop behind `draw`: stopped while paused, so the canvas keeps its last frame. */
  private painter = { start: (): void => {}, stop: (): void => {} };
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

    const tile = self.tile;
    const surface = tile && new Surface({ id: self.deviceId, x: tile.x, y: tile.y, w: tile.w, h: tile.h, rot: tile.rot }, self.pxPerMm);
    const ctx: ViewContext<JsonValue, JsonValue> = {
      match,
      deviceId: self.deviceId,
      role: self.role,
      ...(tile && surface && { tile, surface }),
      screenMm: self.screenMm,
      get dpr() {
        return win?.devicePixelRatio || 1;
      },
      root,
      now: () => this.clock.now(),
      latest: () => this.latest,
    };
    this.guard('factory', () => {
      this.handlers = this.game.view(ctx);
    });
    if (!win) {
      if (this.handlers.draw) this.post(fault('view.draw', new Error('the view root is not in a window')));
      return;
    }
    if (this.handlers.input !== 'off') this.capture(win, root, self, surface);
    if (this.handlers.draw) this.draw(win, root, match, self, surface);
  }

  protected frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void {
    if (f.t === 'state') {
      this.latest = { state: f.state, t: f.at };
      this.guard('onState', () => this.handlers.onState?.(f.state, f.at));
    } else if (f.t === 'pause') {
      // Input is still captured and sent while paused: the host drops it.
      this.painter.stop();
      this.guard('onPause', () => this.handlers.onPause?.(f.reason));
    } else if (f.t === 'resume') {
      this.guard('onResume', () => this.handlers.onResume?.(f.now));
      this.painter.start();
    }
  }

  protected stop(close: CloseFrame | undefined): void {
    this.painter.stop();
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
    for (const { pointerId, phase, t, world } of inputs) {
      this.guard('onInput', () => this.handlers.onInput?.({ deviceId, role, pointerId, phase, t, world: { ...world } }));
    }
    this.post({ v: 1, t: 'input', inputs });
  }

  /** The SDK-owned canvas and animation loop behind `draw`. */
  private draw(win: Window, root: HTMLElement, match: MatchInfo, self: ViewSelf, surface: Surface | undefined): void {
    const canvas = root.ownerDocument.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    root.prepend(canvas);
    const g = canvas.getContext('2d');
    if (!g) {
      this.post(fault('view.draw', new Error('Canvas2D is unavailable')));
      return;
    }
    const place = { bounds: match.bounds, screenMm: self.screenMm, ...(self.tile && { tile: self.tile }) };
    let raf = 0;
    const paint = (): void => {
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
      this.guard('draw', () => this.handlers.draw?.(f));
      g.restore();
    };
    this.painter = {
      start() {
        if (raf === 0) raf = win.requestAnimationFrame(paint);
      },
      stop() {
        win.cancelAnimationFrame(raf);
        raf = 0;
      },
    };
    this.painter.start();
  }
}

function fault(where: string, e: unknown): Up {
  const err = e instanceof Error ? e : undefined;
  const message = err ? err.message : String(e);
  return err?.stack ? { v: 1, t: 'fault', where, message, stack: err.stack } : { v: 1, t: 'fault', where, message };
}
