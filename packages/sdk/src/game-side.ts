import { Surface } from '@mgc/layout';
import { version as SDK_VERSION } from '../package.json';
import { GameClock } from './clock';
import type { Frame, Game, HostContext, HostHandlers, ViewContext, ViewHandlers } from './game';
import { assertJson } from './json';
import type { JsonValue, MatchInfo } from './types';
import { WIRE_VERSION, type Down, type Up } from './wire';

/** The game's end of a link. */
export interface GamePort {
  post(f: Up): void;
  onFrame(h: (f: Down) => void): void;
}

/**
 * Runs one side of `game` in this realm, speaking the wire protocol over
 * `port`: `ready` first, nothing before `init`, every handler call guarded so a
 * throw becomes a `fault` frame instead of crossing the seam. Identical code
 * behind every link adapter. The returned teardown disposes the game side if
 * the link goes away without a `close` frame.
 */
export function serveGame(game: Game, side: 'host' | 'view', port: GamePort, root?: HTMLElement): () => void {
  let runtime: GameSide;
  if (side === 'host') runtime = new HostSide(game, port);
  else if (root) runtime = new ViewSide(game, port, root);
  else throw new Error('a view needs a root element');
  runtime.open();
  return () => runtime.shutdown();
}

abstract class GameSide {
  protected readonly clock = new GameClock();
  private phase: 'waiting' | 'running' | 'closed' = 'waiting';
  private outbox: Up[] = [];
  private depth = 0;

  constructor(
    private readonly side: 'host' | 'view',
    private readonly port: GamePort,
  ) {}

  open(): void {
    this.port.onFrame((f) => this.receive(f));
    this.port.post({ v: WIRE_VERSION, t: 'ready', side: this.side, sdk: SDK_VERSION });
  }

  shutdown(): void {
    if (this.phase === 'closed') return;
    const started = this.phase === 'running';
    this.phase = 'closed';
    if (started) this.stop();
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
  protected abstract stop(): void;

  private receive(f: Down): void {
    if (this.phase === 'closed') return;
    if (this.phase === 'waiting') {
      if (f.t !== 'init' || f.side !== this.side) return;
      this.phase = 'running';
      this.clock.receive(f.clock);
      this.start(f);
    } else if (f.t === 'clock') this.clock.receive(f.clock);
    else if (f.t === 'close') this.shutdown();
    else if (f.t !== 'init') this.frame(f);
  }
}

class HostSide extends GameSide {
  private handlers: HostHandlers<JsonValue> = {};
  /** Shared time of the step being ticked; stamps what `tick` publishes. */
  private tickNow: number | undefined;
  /** Set by `end`: steps already in flight are not ticked. */
  private ended = false;

  constructor(
    private readonly game: Game,
    port: GamePort,
  ) {
    super('host', port);
  }

  protected start(f: Extract<Down, { t: 'init' }>): void {
    const ctx: HostContext<JsonValue, JsonValue> = {
      match: f.match,
      now: () => this.clock.now(),
      publish: (state, to) => {
        assertJson(state, 'publish: state');
        const at = this.tickNow ?? this.clock.now();
        this.post(to === undefined ? { v: 1, t: 'publish', state, at } : { v: 1, t: 'publish', state, to, at });
      },
      end: (result) => {
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
    if (f.t !== 'tick' || this.ended || !this.handlers.tick) return;
    this.tickNow = f.now;
    this.guard('tick', () => this.handlers.tick?.(f.dt, f.now));
    this.tickNow = undefined;
  }

  protected stop(): void {
    this.guard('dispose', () => this.handlers.dispose?.());
  }
}

class ViewSide extends GameSide {
  private handlers: ViewHandlers<JsonValue, JsonValue> = {};
  private latest: { state: JsonValue; t: number } | undefined;
  private root: HTMLElement | undefined;
  private stopDrawing = (): void => {};

  constructor(
    private readonly game: Game,
    port: GamePort,
    private readonly mount: HTMLElement,
  ) {
    super('view', port);
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
    if (!this.handlers.draw) return;
    if (win) this.draw(win, root, match, self, surface);
    else this.post(fault('view.draw', new Error('the view root is not in a window')));
  }

  protected frame(f: Exclude<Down, { t: 'init' | 'clock' | 'close' }>): void {
    if (f.t !== 'state') return;
    this.latest = { state: f.state, t: f.at };
    this.guard('onState', () => this.handlers.onState?.(f.state, f.at));
  }

  protected stop(): void {
    this.stopDrawing();
    this.guard('dispose', () => this.handlers.dispose?.());
    this.root?.remove();
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
    raf = win.requestAnimationFrame(paint);
    this.stopDrawing = () => win.cancelAnimationFrame(raf);
  }
}

type ViewSelf = Extract<Down, { t: 'init'; side: 'view' }>['self'];

function fault(where: string, e: unknown): Up {
  const err = e instanceof Error ? e : undefined;
  const message = err ? err.message : String(e);
  return err?.stack ? { v: 1, t: 'fault', where, message, stack: err.stack } : { v: 1, t: 'fault', where, message };
}
