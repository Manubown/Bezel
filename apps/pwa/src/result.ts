import type { MatchResult, Player, PlayerId } from '@mgc/sdk';

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
