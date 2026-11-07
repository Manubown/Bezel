/**
 * A headless stand-in for the little DOM the SDK touches: a mount whose
 * window gives animation frames and the dpr, elements that take listeners and
 * report their box, canvases with a recording 2D context. `createTestMatch`
 * and the SDK's own tests run every view on one.
 */

/** Animation frames that fire only when stepped, all together. */
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

  /** Runs every callback requested so far; those they request wait for the next `fire`. */
  fire(time: number): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const cb of due) cb(time);
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

/** One canvas call (`['arc', x, y, r, a0, a1]`) or property write (`['fillStyle=', '#fff']`). */
export type CanvasOp = [name: string, ...args: unknown[]];

/** Accepts every CanvasRenderingContext2D call and records it; tracks the transform. */
export interface RecordingContext2D {
  readonly ops: CanvasOp[];
  getTransform(): Matrix;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function recordingContext2D(): RecordingContext2D {
  const ops: CanvasOp[] = [];
  const props = new Map<string, unknown>();
  let m = IDENTITY;
  const saved: Matrix[] = [];
  const transform = (a: number, b: number, c: number, d: number, e: number, f: number): void => {
    m = { a: m.a * a + m.c * b, b: m.b * a + m.d * b, c: m.a * c + m.c * d, d: m.b * c + m.d * d, e: m.a * e + m.c * f + m.e, f: m.b * e + m.d * f + m.f };
  };
  const methods: Record<string, (...args: number[]) => unknown> = {
    setTransform: (a, b, c, d, e, f) => void (m = { a, b, c, d, e, f }),
    resetTransform: () => void (m = IDENTITY),
    getTransform: () => ({ ...m }),
    transform: (a, b, c, d, e, f) => transform(a, b, c, d, e, f),
    translate: (x, y) => transform(1, 0, 0, 1, x, y),
    scale: (x, y) => transform(x, 0, 0, y, 0, 0),
    rotate: (r) => transform(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0),
    save: () => void saved.push(m),
    restore: () => void (m = saved.pop() ?? m),
    measureText: () => ({ width: 0 }),
  };
  return new Proxy({} as RecordingContext2D, {
    get(_, k) {
      if (k === 'ops') return ops;
      if (typeof k !== 'string') return undefined;
      if (props.has(k)) return props.get(k);
      return (...args: number[]) => {
        if (k !== 'getTransform') ops.push([k, ...args]);
        return methods[k]?.(...args);
      };
    },
    set(_, k, v: unknown) {
      if (typeof k !== 'string') return false;
      ops.push([`${k}=`, v]);
      props.set(k, v);
      return true;
    },
  });
}

export interface HeadlessScreenOptions {
  /** CSS px of the mount. */
  widthPx: number;
  heightPx: number;
  dpr: number;
}

export type PointerType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

type Listener = (e: unknown) => void;

class HeadlessElement {
  readonly style: Record<string, string> = { cssText: '' };
  readonly children: HeadlessElement[] = [];
  parent: HeadlessElement | undefined;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly ownerDocument: HeadlessDocument) {}

  get clientWidth(): number {
    return this.ownerDocument.screen.widthPx;
  }
  get clientHeight(): number {
    return this.ownerDocument.screen.heightPx;
  }
  getBoundingClientRect(): DOMRect {
    const { widthPx: width, heightPx: height } = this.ownerDocument.screen;
    return { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height, toJSON: () => ({}) };
  }
  append(child: HeadlessElement): void {
    child.parent = this;
    this.children.push(child);
  }
  prepend(child: HeadlessElement): void {
    child.parent = this;
    this.children.unshift(child);
  }
  remove(): void {
    const siblings = this.parent?.children;
    siblings?.splice(siblings.indexOf(this), 1);
    this.parent = undefined;
  }
  addEventListener(type: string, fn: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  /** Calls this element's listeners for `e.type`, then its ancestors'. */
  dispatch(e: { type: string }): void {
    for (let el: HeadlessElement | undefined = this; el; el = el.parent) {
      for (const fn of [...(el.listeners.get(e.type) ?? [])]) fn(e);
    }
  }
}

export class HeadlessCanvas extends HeadlessElement {
  width = 300;
  height = 150;
  readonly context = recordingContext2D();
  getContext(kind: string): RecordingContext2D | null {
    return kind === '2d' ? this.context : null;
  }
}

class HeadlessDocument {
  readonly defaultView: { requestAnimationFrame: SteppedFrames['request']; cancelAnimationFrame: SteppedFrames['cancel']; devicePixelRatio: number };
  readonly canvases: HeadlessCanvas[] = [];
  /** `document.hidden`: the page is in the background. */
  hidden = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    readonly screen: HeadlessScreenOptions,
    frames: SteppedFrames,
  ) {
    this.defaultView = { requestAnimationFrame: frames.request, cancelAnimationFrame: frames.cancel, devicePixelRatio: screen.dpr };
  }

  createElement(tag: string): HeadlessElement {
    if (tag !== 'canvas') return new HeadlessElement(this);
    const canvas = new HeadlessCanvas(this);
    this.canvases.push(canvas);
    return canvas;
  }
  addEventListener(type: string, fn: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(e: { type: string }): void {
    for (const fn of [...(this.listeners.get(e.type) ?? [])]) fn(e);
  }
}

export interface HeadlessScreen {
  /** Passed to `runMatch` as `self.mount`. */
  mount: HTMLElement;
  /** Every canvas the SDK created on this screen. */
  canvases: readonly HeadlessCanvas[];
  /** What the SDK appended to the mount. */
  children: readonly unknown[];
  /**
   * A pointer event at CSS px `x, y` from the mount's top-left. It hits the
   * topmost element (the SDK's canvas, or the last thing a view appended to its
   * root) and bubbles to the mount.
   */
  pointer(type: PointerType, p: { pointerId: number; x: number; y: number }): void;
  /** The page goes to the background (`document.hidden`) or comes back, with its `visibilitychange`. */
  setHidden(hidden: boolean): void;
}

/** A headless mount: the SDK reaches the window (frames, dpr) and creates its DOM through it. */
export function headlessScreen(frames: SteppedFrames, screen: HeadlessScreenOptions): HeadlessScreen {
  const doc = new HeadlessDocument(screen, frames);
  const mount = new HeadlessElement(doc);
  return {
    mount: mount as unknown as HTMLElement,
    canvases: doc.canvases,
    children: mount.children,
    pointer(type, { pointerId, x, y }) {
      let target = mount;
      while (target.children.length > 0) target = target.children[target.children.length - 1]!;
      const event = { type, pointerId, clientX: x, clientY: y, target };
      target.dispatch(event);
    },
    setHidden(hidden) {
      doc.hidden = hidden;
      doc.dispatch({ type: 'visibilitychange' });
    },
  };
}
