import type { CloseReason, MatchResult, Player, PlayerId } from '@mgc/sdk';

/**
 * A Match result in Player names: who won, and everyone's points in finishing
 * order. The ranking decides the order; without one, the scores do, and equal
 * top scores are a draw.
 */
export function describeResult(players: readonly Player[], result: MatchResult): { headline: string; detail: string } {
  const name = (id: PlayerId): string => players.find((p) => p.playerId === id)?.name ?? 'A player';
  const { scores, ranking } = result;
  const order = ranking ?? (scores ? Object.keys(scores).sort((a, b) => scores[b]! - scores[a]!) : []);
  const detail = scores ? order.filter((id) => id in scores).map((id) => `${name(id)} ${scores[id]}`).join(' · ') : '';
  const [first, second] = order;
  if (first === undefined) return { headline: 'Match over', detail };
  const draw = !ranking && second !== undefined && scores?.[first] === scores?.[second];
  return { headline: draw ? 'Draw' : `${name(first)} wins`, detail };
}

/** What every phone says about a close that has no result; `detail` (the runtime's words) unless the reason says it all. */
const CLOSED: Record<CloseReason, { headline: string; detail?: string }> = {
  ended: { headline: 'Match over' },
  aborted: { headline: 'Match stopped', detail: 'Ended from the host phone' },
  fault: { headline: 'The game crashed' },
  version: { headline: 'Game version mismatch' },
  protocol: { headline: 'The game broke the protocol' },
  'link-lost': { headline: 'Connection lost' },
};

/** A Match that closed without a result: why, in words. */
export function describeClose(reason: CloseReason, detail: string): { headline: string; detail: string } {
  const said = CLOSED[reason];
  return { headline: said.headline, detail: said.detail ?? detail };
}

/** The detail of a `link-lost` close when the Host came back under the same Device id without the Match: its page reloaded (connectivity-1 D10). */
export const HOST_RESTARTED = 'The host phone restarted';
