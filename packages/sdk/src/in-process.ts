import { REAL_ENV, type Env } from './env';
import type { Game } from './game';
import { serveGame } from './game-side';
import type { Down, LinkFactory, Up } from './wire';

/**
 * The in-process link adapter (M2 production, tests): the game runs in this
 * realm, but every frame is `structuredClone`d in both directions and delivered
 * asynchronously, in order, as `postMessage` would. A view's DOM goes into the
 * `root` the platform passes (its mount); animation frames and the device
 * pixel ratio come from that root's window.
 */
export function inProcessLink(load: () => Promise<{ default: Game }>): LinkFactory {
  return linkInProcess(load, REAL_ENV);
}

/** `inProcessLink` with the game side on `env`'s clocks (the test harness's fake one). */
export function linkInProcess(load: () => Promise<{ default: Game }>, env: Env): LinkFactory {
  return async ({ side, root }) => {
    const { default: game } = await load();
    const down = new Mailbox<Down>();
    const up = new Mailbox<Up>();
    const teardown = serveGame(game, side, { post: (f) => up.post(f), onFrame: (h) => down.listen(h) }, root, env);
    return {
      post: (f) => down.post(f),
      onFrame: (h) => up.listen(h),
      close: () => {
        down.flush();
        down.close();
        up.close();
        teardown();
      },
    };
  };
}

/** One direction of a link: clone on post, deliver in order on a microtask once someone listens. */
class Mailbox<F> {
  private readonly queue: F[] = [];
  private readonly listeners = new Set<(f: F) => void>();
  private scheduled = false;
  private closed = false;

  post(f: F): void {
    if (this.closed) return;
    this.queue.push(structuredClone(f));
    this.schedule();
  }

  listen(h: (f: F) => void): () => void {
    this.listeners.add(h);
    this.schedule();
    return () => this.listeners.delete(h);
  }

  /** Delivers everything already posted, now. */
  flush(): void {
    while (!this.closed && this.listeners.size > 0 && this.queue.length > 0) {
      const f = this.queue.shift()!;
      for (const h of this.listeners) h(f);
    }
  }

  close(): void {
    this.closed = true;
    this.queue.length = 0;
    this.listeners.clear();
  }

  private schedule(): void {
    if (this.scheduled || this.listeners.size === 0 || this.queue.length === 0) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.flush();
    });
  }
}
