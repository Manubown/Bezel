import type { DeviceId, Session } from '@mgc/core';
import type { MatchHandle, MatchInfo, PauseReason } from '@mgc/sdk';
import type { Notice } from './result';

/**
 * The Host's pause policy for a running Match: losing a Match Device pauses
 * it, naming that Device. It resumes only once every lost Match Device is back
 * *and* has synced its clock. A phone that comes back as a new page starts its
 * part of the Match once its Session is ready, and that is before it reports
 * synced, so it gets the retained state and plays from the first tick after
 * the resume. Returns the unsubscribe.
 */
export function pauseOnDeviceLoss(session: Session, match: MatchInfo, handle: Pick<MatchHandle, 'setPaused'>): () => void {
  const inMatch = new Set(match.devices.map((d) => d.deviceId));
  /** Lost Match Devices, in the order they went. */
  const lost = new Set<DeviceId>();
  /** The Device the Match waits for, as last passed to `setPaused`. */
  let waitingFor: DeviceId | undefined;
  const follow = (): void => {
    for (const e of session.roster()) if (e.present && e.sync.synced) lost.delete(e.info.deviceId);
    const [next] = lost;
    if (next === waitingFor) return;
    waitingFor = next;
    handle.setPaused(next === undefined ? null : { kind: 'device-lost', deviceId: next });
  };
  const offs = [
    session.onDeviceLost((id) => {
      if (!inMatch.has(id)) return;
      lost.add(id);
      follow();
    }),
    // A return is a roster change, and so is its clock report saying it synced.
    session.onChange(follow),
  ];
  return () => offs.forEach((off) => off());
}

/**
 * The overlay for `reason` in `match` on the Device `self`. A lost Device is named by the Player
 * who sits at it, if any, else by its phone number in Layout order. The lost Device itself, back
 * before the Host resumes, reads that it is back.
 */
export function describePause(match: MatchInfo, reason: PauseReason, self: DeviceId): Notice {
  if (reason.kind === 'platform') return { headline: 'Paused', detail: reason.note ?? '' };
  if (reason.deviceId === self) return { headline: 'You’re back', detail: 'the match goes on in a moment' };
  const tile = match.tiles.findIndex((t) => t.deviceId === reason.deviceId);
  const player = match.players.findIndex((p) => !p.bot && p.deviceId === reason.deviceId);
  const phone = tile >= 0 ? `phone ${tile + 1}` : 'the controller';
  const Phone = tile >= 0 ? `Phone ${tile + 1}` : 'The controller';
  if (player < 0) return { headline: `Waiting for ${phone}`, detail: 'It lost its connection · the match goes on when it is back' };
  return { headline: `Waiting for ${match.players[player]!.name}`, detail: `${Phone} lost its connection · the match goes on when it is back`, player };
}
