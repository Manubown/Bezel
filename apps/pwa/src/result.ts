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
  if (first === undefined) return { headline: 'Game over', detail: '' };
  const draw = !ranking && second !== undefined && scores?.[first] === scores?.[second];
  const headline = draw ? 'Draw' : `${name(first)} wins`;
  const winner = draw ? -1 : players.findIndex((p) => p.playerId === first);
  const named = winner >= 0 ? { player: winner } : {};
  if (scored.length === 2 && scored[0] === first) return { headline: `${headline}${draw ? ',' : ''} ${scores![first]}–${scores![scored[1]!]}`, detail: '', ...named };
  return { headline, detail: scored.map((id) => `${name(id)} ${scores![id]}`).join(' · '), ...named };
}

/**
 * A Match's close as this Device saw it: why (`reason`) and the runtime's words for it (`detail`, a maker's: "host.tick:
 * boom"), and `said`, the platform's own sentence for players when it stopped the Match for a reason the runtime cannot
 * name (`HOST_RESTARTED`).
 */
export interface Close {
  reason: CloseReason;
  detail: string;
  said?: string;
}

/** What every phone says about a close that has no result, in the words players read (spec D5). */
const CLOSED: Record<CloseReason, string> = {
  ended: 'Game over',
  aborted: 'Game ended on the first phone',
  fault: 'The game crashed',
  version: 'The game does not fit this version of the app',
  protocol: 'The game stopped with an error',
  'link-lost': 'Connection lost',
};

/**
 * A Match that closed without a result: why, in the words players read, and what the platform said about it; in Maker
 * mode (`maker`) the runtime's own words after that.
 */
export function describeClose(close: Close, maker: boolean): Notice {
  const detail = [close.said, maker ? close.detail : undefined].filter(Boolean).join(' · ');
  return { headline: CLOSED[close.reason], detail };
}

/** What a `link-lost` close says when the Host came back under the same Device id without the Match: its page reloaded (connectivity-1 D10). */
export const HOST_RESTARTED = 'The first phone restarted';
