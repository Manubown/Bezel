/**
 * The clocks and timer the SDK runtimes read, on both sides of a link. Real
 * in production; `createTestMatch` substitutes its fake clock so a game test
 * is deterministic without touching globals.
 */
export interface Env {
  /** Wall clock, ms since the epoch (`Date.now`). */
  wall(): number;
  /** Monotonic clock, ms (`performance.now`). */
  mono(): number;
  /** Calls `fn` every `ms`; returns the cancel. */
  every(ms: number, fn: () => void): () => void;
}

export const REAL_ENV: Env = {
  wall: () => Date.now(),
  mono: () => performance.now(),
  every(ms, fn) {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};
