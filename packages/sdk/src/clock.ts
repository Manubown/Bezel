import { REAL_ENV, type Env } from './env';
import type { ClockWire } from './wire';

/** Largest rate change a correction may apply: the clock runs between 0.98× and 1.02×. */
export const MAX_SLEW = 0.02;

/**
 * The shared clock as a game sees it, rebuilt from `ClockWire` frames on the
 * game's side of the link. The first frame anchors it on the realm's own
 * monotonic clock (so an iframe's private time origin is irrelevant); later
 * frames are absorbed by slewing at most `MAX_SLEW`, so `now()` never steps
 * and never runs backwards.
 */
export class GameClock {
  private anchored = false;
  /** Reading at `p0` (the monotonic clock); runs at `1 + rate` until `until`, then at 1. */
  private s0 = 0;
  private p0 = 0;
  private rate = 0;
  private until = 0;

  constructor(private readonly env: Pick<Env, 'wall' | 'mono'> = REAL_ENV) {}

  receive(c: ClockWire): void {
    const p = this.env.mono();
    const target = this.env.wall() + c.epochOffset;
    if (!this.anchored) {
      this.anchored = true;
      this.s0 = target;
      this.p0 = this.until = p;
      this.rate = 0;
      return;
    }
    const cur = this.at(p);
    const err = target - cur;
    this.s0 = cur;
    this.p0 = p;
    this.rate = Math.sign(err) * MAX_SLEW;
    this.until = p + Math.abs(err) / MAX_SLEW;
  }

  now(): number {
    return this.at(this.env.mono());
  }

  private at(p: number): number {
    const slewed = Math.min(p, this.until) - this.p0;
    return this.s0 + slewed * (1 + this.rate) + Math.max(0, p - this.until);
  }
}
