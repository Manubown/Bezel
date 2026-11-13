import type { CloseReason, MatchResult, Player, PlayerId } from '@mgc/sdk';

/**
 * What a card over the lobby or the Game says: the result card (`describeResult`, `describeClose`), the pause card
 * (`describePause`). `player`: the place in the Match's Player list of the Player the headline names, whose colour it
 * is shown in (`playerColour`, spec outside-view D10); absent when it names nobody.
 */
export interface Notice {
  headline: string;
  detail: string;
  player?: number;
}

/**
 * A Match result in Player names: who won, and the points. Two sides that both scored read in one line, the
 * winner's score first ("Ana wins 7–5", "Draw, 3–3"); more sides list everyone's points in finishing order as
 * the detail. The ranking decides the order; without one, the scores do, and equal top scores are a draw.
 * `player` is the winner's place in `players`.
 */
export function describeResult(players: readonly Player[], result: MatchResult): Notice {
  const name = (id: PlayerId): string => players.find((p) => p.playerId === id)?.name ?? 'A player';
  const { scores, ranking } = result;
  const order = ranking ?? (scores ? Object.keys(scores).sort((a, b) => scores[b]! - scores[a]!) : []);
  const scored = scores ? order.filter((id) => id in scores) : [];
  const [first, second] = order;
  if (first === undefined) return { headline: 'Match over', detail: '' };
  const draw = !ranking && second !== undefined && scores?.[first] === scores?.[second];
  const headline = draw ? 'Draw' : `${name(first)} wins`;
  const winner = draw ? -1 : players.findIndex((p) => p.playerId === first);
  const named = winner >= 0 ? { player: winner } : {};
  if (scored.length === 2 && scored[0] === first) return { headline: `${headline}${draw ? ',' : ''} ${scores![first]}–${scores![scored[1]!]}`, detail: '', ...named };
  return { headline, detail: scored.map((id) => `${name(id)} ${scores![id]}`).join(' · '), ...named };
}

/** What every phone says about a close that has no result; `detail` (the runtime's words) unless the reason says it all. */
const CLOSED: Record<CloseReason, { headline: string; detail?: string }> = {
  ended: { headline: 'Match over' },
  aborted: { headline: 'Game ended on the first phone', detail: '' },
  fault: { headline: 'The game crashed' },
  version: { headline: 'Game version mismatch' },
  protocol: { headline: 'The game broke the protocol' },
  'link-lost': { headline: 'Connection lost' },
};

/** A Match that closed without a result: why, in words. */
export function describeClose(reason: CloseReason, detail: string): Notice {
  const said = CLOSED[reason];
  return { headline: said.headline, detail: said.detail ?? detail };
}

/** The detail of a `link-lost` close when the Host came back under the same Device id without the Match: its page reloaded (connectivity-1 D10). */
export const HOST_RESTARTED = 'The host phone restarted';
