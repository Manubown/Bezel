import { RELAY_STABLE_MS, type DeviceId, type SessionStatus } from '@mgc/core';

/** How long (ms) a phone tries to get in before it shows the help card (spec D7). */
export const HELP_AFTER_MS = 15000;

/**
 * What usually helps when the connections of a Session do not hold: the help card's advice, the first phone's, and the
 * site's known limits.
 */
export const HOTSPOT = 'An iPhone hotspot often fails: use the same Wi-Fi on every phone, or mobile data on every phone.';

/** A Peer's page at one moment of joining its Session. */
export interface Joining {
  /** The Session's code, from the page's address. */
  code: string;
  status: SessionStatus;
  /** How long (ms) this phone has been trying to get in: since the page began to join, or, once it was in, since it lost its Session. */
  waited: number;
  /** It was in its Session (`ready`) at least once since the page loaded. */
  wasIn: boolean;
  /** A result card is on show over the lobby (a Match closed, "Connection lost" after the grace ran out, say); absent: none. */
  resultCard?: boolean;
}

/** After `HELP_AFTER_MS` without getting in: what to check, in the order to check it. */
export interface HelpCard {
  headline: string;
  advice: readonly string[];
}

/** The strip's words while a phone is not in its Session. */
export interface JoinView {
  /** The status line, in the words players read. */
  line: string;
  /** Under the line; may be empty. */
  detail: string;
  /** The same state in the makers' words, shown beside the line in Maker mode. */
  makers: string;
  help: HelpCard | undefined;
}

/** The makers' words for a status (Maker mode shows them beside the players' line); the session log keeps the status itself. */
const MAKERS: Record<Exclude<SessionStatus, 'ready'>, string> = {
  searching: 'looking for the host',
  syncing: 'syncing clocks · measuring the offset to the host',
  reconnecting: 'reconnecting to the host · the connection dropped',
};

/**
 * What a joining phone says; undefined once it is in (`ready`): then the lobby speaks.
 * - Never in: "Finding table CODE…" until a first phone answers (`searching`), then "Connecting…", through every
 *   failed attempt (`syncing` and `reconnecting` alternate on a network whose direct path dies).
 * - Was in: "Lost the table. Reconnecting…" until it is in again, whatever the attempts in between.
 * - After `HELP_AFTER_MS` of either: the help card, its headline after the case, its advice the same; while a result
 *   card is on show, not yet: the help card waits until that card is closed, so the two never stand one over the other.
 */
export function describeJoin(j: Joining): JoinView | undefined {
  const { code, status } = j;
  if (status === 'ready') return undefined;
  const found = status !== 'searching';
  const headline = j.wasIn ? `Still reconnecting to table ${code}` : found ? `Still connecting to table ${code}` : `Table ${code} not found yet`;
  const help: HelpCard | undefined =
    j.waited < HELP_AFTER_MS || j.resultCard === true
      ? undefined
      : {
          headline,
          advice: [
            `Check that the first phone shows ${code}, and keep its screen on.`,
            HOTSPOT,
          ],
        };
  const makers = MAKERS[status];
  if (j.wasIn) return { line: 'Lost the table. Reconnecting…', detail: '', makers, help };
  if (found) return { line: 'Connecting…', detail: '', makers, help };
  return { line: `Finding table ${code}…`, detail: 'keep the first phone’s screen on', makers, help };
}

/** Connections of one phone in a row that ended without lasting, after which the Host shows its advice (spec D7). */
export const DROPS_FOR_ADVICE = 3;

/**
 * How long (ms) a Device may stay away after its last connection ended and still count as trying: longer than a Peer
 * that keeps trying is away, a few seconds between attempts or up to the transport's 20 s Relay probe. Away longer, it
 * gave up: its count is forgotten and the Host's advice goes.
 */
export const STAYED_AWAY_MS = 30000;

/** The Device the Host's advice names. */
export interface Dropping {
  deviceId: DeviceId;
  /** Its connections in a row that ended without lasting. */
  drops: number;
  /**
   * When the advice goes unless the roster changes first: while the Device is in the Session again, when that
   * connection will have lasted; while it is away, when it will have stayed away `STAYED_AWAY_MS`.
   */
  until: number;
}

/**
 * The Host's count, per Device, of connections in a row that ended within `RELAY_STABLE_MS` of coming in: the
 * transport's measure of a connection that did not work (its own-address fail-safe and its relay escalation). The
 * transport's own count cannot serve: it counts every connection together, by the transport's ids, and stops at the
 * first. A Device that stays away `STAYED_AWAY_MS` is forgotten. Fed the Devices in the Session at each change of the
 * Host's roster; pure and timer-free, every call takes the time (ms, any monotonic clock).
 */
export class Dropouts {
  /** When each Device in the Session came in. */
  private readonly since = new Map<DeviceId, number>();
  /** When each Device with a count, away now, last lost its connection. */
  private readonly left = new Map<DeviceId, number>();
  private readonly streak = new Map<DeviceId, number>();

  /** The Devices in the Session at `now`: one missing since the last call lost its connection, one new to it came in. */
  see(present: Iterable<DeviceId>, now: number): void {
    this.forget(now);
    const here = new Set(present);
    for (const [id, at] of this.since) {
      if (here.has(id)) continue;
      this.since.delete(id);
      this.left.set(id, now);
      this.streak.set(id, now - at >= RELAY_STABLE_MS ? 0 : (this.streak.get(id) ?? 0) + 1);
    }
    for (const id of here) {
      if (this.since.has(id)) continue;
      this.since.set(id, now);
      this.left.delete(id);
    }
  }

  /**
   * A Device whose connection ended `DROPS_FOR_ADVICE` times in a row without lasting, unless the one it has now has
   * lasted, or it has stayed away `STAYED_AWAY_MS`.
   */
  dropping(now: number): Dropping | undefined {
    this.forget(now);
    for (const [deviceId, drops] of this.streak) {
      if (drops < DROPS_FOR_ADVICE) continue;
      const at = this.since.get(deviceId);
      if (at !== undefined && now - at >= RELAY_STABLE_MS) continue;
      return { deviceId, drops, until: at === undefined ? this.left.get(deviceId)! + STAYED_AWAY_MS : at + RELAY_STABLE_MS };
    }
    return undefined;
  }

  /** The counts of the Devices that have stayed away `STAYED_AWAY_MS` since their connection last ended. */
  private forget(now: number): void {
    for (const [id, at] of this.left) {
      if (now - at < STAYED_AWAY_MS) continue;
      this.left.delete(id);
      this.streak.delete(id);
    }
  }
}

/** The Host's advice line about the Device `name` (as its roster names it), and the count beside it in Maker mode. */
export function describeDropping(name: string, drops: number): { line: string; makers: string } {
  return { line: `${name} keeps losing its connection. ${HOTSPOT}`, makers: `${drops} connections in a row ended within ${RELAY_STABLE_MS / 1000} s` };
}
