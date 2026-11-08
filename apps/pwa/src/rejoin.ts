import type { DeviceId, SessionStatus } from '@mgc/core';
import type { PauseNotice } from './pause';
import { HOST_RESTARTED } from './result';

/** How long (ms) a Peer keeps its Match while its Session reconnects: from the first `keep` until it is `ready` again (connectivity-1 D2, D7). */
export const REJOIN_GRACE_MS = 30000;

/** Over a Peer's running Match while it rides out a reconnect; the Host's own pause notice cannot reach it meanwhile. */
export const RECONNECTING: PauseNotice = { headline: 'Reconnecting to the host…', detail: 'the match goes on when the connection is back' };

/**
 * What a Peer does about the Match it runs: `keep` it through a reconnect (show `RECONNECTING`, run the grace timer),
 * say `hello` to the Host it is back with, stop it with `link-lost` or `aborted`, or nothing (`none`).
 */
export type RejoinAction = 'keep' | 'hello' | 'stop-link-lost' | 'stop-aborted' | 'none';

/** A Peer's Session, lobby and running Match at one change of either, and the reconnect it may be riding out. */
export interface Rejoin {
  status: SessionStatus;
  /** The Match the lobby names: the Host's word, kept while the Session reconnects. */
  lobbyMatchId: string | undefined;
  /** The Match running on this Device. */
  currentMatchId: string | undefined;
  /**
   * A reconnect is under way for the running Match: the caller sets it on `keep` and clears it once it acted on
   * `hello` or the Match closed. Makes the next `ready` a re-attach, so `hello` comes once per re-attach.
   */
  rejoining: boolean;
  /** `REJOIN_GRACE_MS` passed since this reconnect's first `keep`. */
  graceExpired: boolean;
  /** The Session's Host now (`roster()[0]`); undefined while it has none. */
  hostId: DeviceId | undefined;
  /** The Host the running Match began under. */
  matchHostId: DeviceId | undefined;
}

/**
 * The Peer's side of connectivity-1 D7, one row per case:
 * - no Match running: `none` (a lobby Match that lists this Device is `main.ts`'s `begin`, not this);
 * - `searching`: `stop-link-lost` (a Session that had a Host reports `reconnecting` instead, so this is the defensive row);
 * - `reconnecting`, or `syncing` (with a Match running, always on the way back from `reconnecting`): `keep`,
 *   or `stop-link-lost` once the grace ran out;
 * - `ready` while `rejoining`: `hello` when the lobby still names the Match, else `stop-link-lost`;
 * - `ready` otherwise: `none` while the lobby names the Match, `stop-aborted` once it does not (the Host closed it).
 */
export function decideRejoin(r: Rejoin): RejoinAction {
  if (r.currentMatchId === undefined) return 'none';
  switch (r.status) {
    case 'searching':
      return 'stop-link-lost';
    case 'reconnecting':
    case 'syncing':
      return r.graceExpired ? 'stop-link-lost' : 'keep';
    case 'ready': {
      const same = r.lobbyMatchId === r.currentMatchId;
      if (r.rejoining) return same ? 'hello' : 'stop-link-lost';
      return same ? 'none' : 'stop-aborted';
    }
  }
}

/**
 * The close detail of a `stop-link-lost`: `HOST_RESTARTED` when the Host the Match began under is back and its lobby
 * names no Match (its page reloaded and the host game with it), else undefined (the runtime's own words).
 */
export function linkLostDetail(r: Rejoin): string | undefined {
  return r.lobbyMatchId === undefined && r.hostId !== undefined && r.hostId === r.matchHostId ? HOST_RESTARTED : undefined;
}
