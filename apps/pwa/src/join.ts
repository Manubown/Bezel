import { RELAY_STABLE_MS, type DeviceId, type SessionStatus } from '@mgc/core';

/** How long (ms) a phone tries to get in before it shows the help card (spec D7). */
export const HELP_AFTER_MS = 15000;

/**
 * What usually helps when the connections of a table do not hold: the help card's advice, the first phone's, and the
 * site's known limits.
 */
export const HOTSPOT = 'An iPhone hotspot often fails: use the same Wi-Fi on every phone, or mobile data on every phone.';

/** A Peer's page at one moment of joining its table. */
export interface Joining {
  /** The table's code, from the page's address. */
  code: string;
  status: SessionStatus;
  /** How long (ms) this phone has been trying to get in: since the page began to join, or, once it was in, since it lost the table. */
  waited: number;
  /** It was in the table (`ready`) at least once since the page loaded. */
  wasIn: boolean;
}

/** After `HELP_AFTER_MS` without getting in: what to check, in the order to check it. */
export interface HelpCard {
  headline: string;
  advice: readonly string[];
}

/** The strip's words while a phone is not in its table. */
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
 * - After `HELP_AFTER_MS` of either: the help card, its headline after the case, its advice the same.
 */
export function describeJoin(j: Joining): JoinView | undefined {
  const { code, status } = j;
  if (status === 'ready') return undefined;
  const found = status !== 'searching';
  const headline = j.wasIn ? `Still reconnecting to table ${code}` : found ? `Still connecting to table ${code}` : `Table ${code} not found yet`;
  const help: HelpCard | undefined =
    j.waited < HELP_AFTER_MS
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

/**
 * The address the help card's code field opens: `href` with its `room` replaced by `typed`, in capitals and without
 * anything but letters and digits; the page's other flags (`maker`, `noturn`) stay as they were written. Undefined
 * when nothing is left of `typed`.
 */
export function joinAddress(href: string, typed: string): string | undefined {
  const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code === '') return undefined;
  const url = new URL(href);
  const flags = url.search.slice(1).split('&').filter((p) => p !== '' && !/^room(=|$)/.test(p));
  url.search = [`room=${code}`, ...flags].join('&');
  return url.toString();
}

/** Connections of one phone in a row that ended without lasting, after which the first phone shows its advice (spec D7). */
export const DROPS_FOR_ADVICE = 3;

/** The phone the first phone's advice names. */
export interface Dropping {
  deviceId: DeviceId;
  /** Its connections in a row that ended without lasting. */
  drops: number;
  /** While it is in the table again: when that connection will have lasted, and the advice goes. */
  until: number | undefined;
}

/**
 * The first phone's count, per phone, of connections in a row that ended within `RELAY_STABLE_MS` of coming in: the
 * transport's measure of a connection that did not work (its own-address fail-safe and its relay escalation). The
 * transport's own count cannot serve: it counts every connection together, by the transport's ids, and stops at the
 * first. Fed the phones in the table at each change of the Host's roster; pure and timer-free, every call takes the
 * time (ms, any monotonic clock).
 */
export class Dropouts {
  /** When each phone in the table came in. */
  private readonly since = new Map<DeviceId, number>();
  private readonly streak = new Map<DeviceId, number>();

  /** The phones in the table at `now`: one missing since the last call lost its connection, one new to it came in. */
  see(present: Iterable<DeviceId>, now: number): void {
    const here = new Set(present);
    for (const [id, at] of this.since) {
      if (here.has(id)) continue;
      this.since.delete(id);
      this.streak.set(id, now - at >= RELAY_STABLE_MS ? 0 : (this.streak.get(id) ?? 0) + 1);
    }
    for (const id of here) if (!this.since.has(id)) this.since.set(id, now);
  }

  /** A phone whose connection ended `DROPS_FOR_ADVICE` times in a row without lasting, unless the one it has now has lasted. */
  dropping(now: number): Dropping | undefined {
    for (const [deviceId, drops] of this.streak) {
      if (drops < DROPS_FOR_ADVICE) continue;
      const at = this.since.get(deviceId);
      if (at !== undefined && now - at >= RELAY_STABLE_MS) continue;
      return { deviceId, drops, until: at === undefined ? undefined : at + RELAY_STABLE_MS };
    }
    return undefined;
  }
}

/** The first phone's advice line about the phone `name` (as its roster names it), and the count beside it in Maker mode. */
export function describeDropping(name: string, drops: number): { line: string; makers: string } {
  return { line: `${name} keeps losing its connection. ${HOTSPOT}`, makers: `${drops} connections in a row ended within ${RELAY_STABLE_MS / 1000} s` };
}
