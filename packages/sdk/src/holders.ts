import type { MatchInfo } from './types';

/**
 * Why `setHolder(controller, playerId)` is refused in `match`, or undefined if
 * it may go. The roster is frozen, so a refusal is always a game bug. Both
 * sides of the host link check the same way: the host game's `holderOf` keeps
 * its value, and the host runtime answers with a `reject`.
 */
export function holderRefusal(match: MatchInfo, controller: unknown, playerId: unknown): string | undefined {
  const device = match.devices.find((d) => d.deviceId === controller);
  if (!device) return `${JSON.stringify(controller) ?? String(controller)} is not a Device of the Match`;
  if (device.role !== 'controller') return `${device.deviceId} is a Tile, not a Controller`;
  if (playerId !== null && !match.players.some((p) => p.playerId === playerId)) {
    return `${JSON.stringify(playerId) ?? String(playerId)} is not a Player of the Match`;
  }
  return undefined;
}
