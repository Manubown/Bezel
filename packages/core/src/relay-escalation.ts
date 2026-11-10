/** Which paths a join may use: every ICE path (direct, STUN, TURN), or the TURN relay only. */
export type RelayMode = 'all' | 'relay';

/** A connection that lived this long (ms) worked: a reset after it does not count as a failure. */
export const RELAY_STABLE_MS = 15000;
/** In relay mode, how long (ms) the transport may be without any connection before the relay counts as not answering. */
export const RELAY_PROBE_MS = 20000;

/**
 * When a transport gives up on the direct path and rejoins through the TURN relay only. Pure and
 * timer-free: every call takes the current time in ms (any monotonic clock); the transport owns the
 * one timer that calls `expire()` at `deadline`.
 *
 * In `'all'` each reset is judged by the longest-lived connection since the previous reset (one still
 * up when the reset comes ends there). One that lived `RELAY_STABLE_MS` worked and ended: the failure
 * streak restarts at 0. A shorter one grows the streak by 1. No connection at all leaves it alone:
 * nothing was tried. When the streak reaches `after`, the mode becomes `'relay'`.
 *
 * In `'relay'` resets do not count. Whenever no connection is up, a deadline runs: `RELAY_PROBE_MS`
 * from entering relay mode, from a reset in it, or from its last connection ending. A connection that
 * comes up cancels it. At the deadline the relay is not answering, or nobody is there to answer
 * through it: back to `'all'` with streak 0, so a relay that stops working never strands a Device.
 */
export class RelayEscalation {
  private readonly after: number;
  private current: RelayMode = 'all';
  private streak = 0;
  /** Join time of each connection that is up. */
  private readonly open = new Map<string, number>();
  /** Longest lifetime among the connections that ended since the previous reset; -1 for none. */
  private longest = -1;
  /** In relay mode with no connection up: when it gives up unless one comes up first. Null otherwise. */
  private probeAt: number | null = null;

  /** `after`: failed resets in a row that switch to the relay; `<= 0` or not finite never switches. */
  constructor(after: number) {
    this.after = after > 0 && Number.isFinite(after) ? after : Infinity;
  }

  get mode(): RelayMode {
    return this.current;
  }
  /** The failure streak; in relay mode the one that caused the switch. */
  get failures(): number {
    return this.streak;
  }
  /** When `expire()` returns to `'all'`, or null when nothing is pending. */
  get deadline(): number | null {
    return this.probeAt;
  }

  /** A connection to `id` came up. */
  joined(id: string, now: number): void {
    if (!this.open.has(id)) this.open.set(id, now);
    this.probeAt = null;
  }
  /** The connection to `id` ended. */
  left(id: string, now: number): void {
    const since = this.open.get(id);
    if (since === undefined) return;
    this.open.delete(id);
    this.longest = Math.max(this.longest, now - since);
    if (this.current === 'relay' && this.open.size === 0) this.probeAt = now + RELAY_PROBE_MS;
  }
  /** The transport drops every connection at `now` and rejoins; returns the mode the rejoin uses. */
  reset(now: number): RelayMode {
    for (const since of this.open.values()) this.longest = Math.max(this.longest, now - since);
    this.open.clear();
    const longest = this.longest;
    this.longest = -1;
    if (this.current === 'relay') this.probeAt = now + RELAY_PROBE_MS;
    else if (longest >= RELAY_STABLE_MS) this.streak = 0;
    else if (longest >= 0 && ++this.streak >= this.after) {
      this.current = 'relay';
      this.probeAt = now + RELAY_PROBE_MS;
    }
    return this.current;
  }
  /** At or past `deadline`: back to `'all'` with streak 0. Returns whether the mode switched. */
  expire(now: number): boolean {
    if (this.probeAt === null || now < this.probeAt) return false;
    this.current = 'all';
    this.streak = 0;
    // What the relay carried says nothing about the direct path: the next reset judges only what comes after.
    this.longest = -1;
    this.probeAt = null;
    return true;
  }
}
