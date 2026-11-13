import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '@mgc/core';
import { REJOIN_GRACE_MS, decideRejoin, linkLostDetail, type Rejoin } from '../src/rejoin';

const STATUSES: SessionStatus[] = ['searching', 'syncing', 'ready', 'reconnecting'];

/** A Peer (d1) running Match m1, started under Host d0, its lobby naming m1, no reconnect under way: `over` changes that. */
const peer = (over: Partial<Rejoin>): Rejoin => ({
  status: 'ready',
  lobbyMatchId: 'm1',
  currentMatchId: 'm1',
  rejoining: false,
  graceExpired: false,
  hostId: 'd0',
  matchHostId: 'd0',
  ...over,
});

describe('rejoin: what a Peer does about its Match on a Session or lobby change (connectivity-1 D7)', () => {
  it('no Match running: none, whatever the Session and lobby say', () => {
    for (const status of STATUSES) {
      expect(decideRejoin(peer({ status, currentMatchId: undefined }))).toBe('none');
      expect(decideRejoin(peer({ status, currentMatchId: undefined, lobbyMatchId: undefined, rejoining: true, graceExpired: true }))).toBe('none');
    }
  });

  it('reconnecting, grace not expired: keep', () => {
    // The lobby keeps the Host's last word meanwhile; nothing about it decides here.
    expect(decideRejoin(peer({ status: 'reconnecting', hostId: undefined }))).toBe('keep');
    expect(decideRejoin(peer({ status: 'reconnecting', hostId: undefined, rejoining: true }))).toBe('keep');
  });

  it('syncing after reconnecting, grace not expired: keep, even once the lobby says the Match is gone (only `ready` settles it)', () => {
    expect(decideRejoin(peer({ status: 'syncing', rejoining: true }))).toBe('keep');
    expect(decideRejoin(peer({ status: 'syncing', rejoining: true, lobbyMatchId: undefined }))).toBe('keep');
  });

  it(`grace (${REJOIN_GRACE_MS} ms) expired while reconnecting or syncing: stop with link-lost`, () => {
    expect(REJOIN_GRACE_MS).toBe(30000);
    expect(decideRejoin(peer({ status: 'reconnecting', rejoining: true, graceExpired: true, hostId: undefined }))).toBe('stop-link-lost');
    expect(decideRejoin(peer({ status: 'syncing', rejoining: true, graceExpired: true }))).toBe('stop-link-lost');
    expect(linkLostDetail(peer({ status: 'reconnecting', rejoining: true, graceExpired: true, hostId: undefined }))).toBeUndefined();
  });

  it('ready again and the lobby names the same Match: hello', () => {
    expect(decideRejoin(peer({ rejoining: true }))).toBe('hello');
  });

  it('hello only once per re-attach: once the caller acted on it (rejoining cleared), ready with the same Match is none', () => {
    const back = peer({ rejoining: true });
    expect(decideRejoin(back)).toBe('hello');
    expect(decideRejoin({ ...back, rejoining: false })).toBe('none');
    // The next reconnect is a new re-attach: keep, then hello again.
    expect(decideRejoin(peer({ status: 'reconnecting', hostId: undefined }))).toBe('keep');
    expect(decideRejoin(peer({ rejoining: true }))).toBe('hello');
  });

  it('ready again and the lobby names no Match: stop with link-lost, "The first phone restarted" when it is the Host the Match began under', () => {
    const restarted = peer({ rejoining: true, lobbyMatchId: undefined });
    expect(decideRejoin(restarted)).toBe('stop-link-lost');
    expect(linkLostDetail(restarted)).toBe('The first phone restarted');
    // Another Host under this code: the runtime's own words.
    const other = peer({ rejoining: true, lobbyMatchId: undefined, hostId: 'd9' });
    expect(decideRejoin(other)).toBe('stop-link-lost');
    expect(linkLostDetail(other)).toBeUndefined();
  });

  it('ready again and the lobby names another Match: stop with link-lost, the runtime’s own words', () => {
    const moved = peer({ rejoining: true, lobbyMatchId: 'm2' });
    expect(decideRejoin(moved)).toBe('stop-link-lost');
    expect(linkLostDetail(moved)).toBeUndefined();
  });

  it('searching with a Match running: stop with link-lost, as before reconnecting existed', () => {
    expect(decideRejoin(peer({ status: 'searching', hostId: undefined }))).toBe('stop-link-lost');
    expect(decideRejoin(peer({ status: 'searching', hostId: undefined, rejoining: true }))).toBe('stop-link-lost');
    expect(linkLostDetail(peer({ status: 'searching', hostId: undefined }))).toBeUndefined();
  });

  it('ready the whole time and the lobby Match is gone or another: stop with aborted (the Host closed it)', () => {
    expect(decideRejoin(peer({ lobbyMatchId: undefined }))).toBe('stop-aborted');
    expect(decideRejoin(peer({ lobbyMatchId: 'm2' }))).toBe('stop-aborted');
  });

  it('ready the whole time and the lobby names the Match: none', () => {
    expect(decideRejoin(peer({}))).toBe('none');
  });
});
