import { describe, expect, it } from 'vitest';
import { logLineOf } from '../src/gamelog';
import { describeClose, describeResult } from '../src/result';

const PLAYERS = [
  { playerId: 'p-ann', name: 'Ann' },
  { playerId: 'p-bo', name: 'Bo' },
];

describe('the result overlay text', () => {
  it('names the winner by Player name, then everyone’s points in ranking order', () => {
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 4, 'p-bo': 7 }, ranking: ['p-bo', 'p-ann'] })).toEqual({ headline: 'Bo wins', detail: 'Bo 7 · Ann 4' });
  });

  it('ranks by the scores when the Game gave no ranking, and calls equal top scores a draw', () => {
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 7, 'p-bo': 2 } })).toEqual({ headline: 'Ann wins', detail: 'Ann 7 · Bo 2' });
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 3, 'p-bo': 3 } }).headline).toBe('Draw');
    expect(describeResult(PLAYERS, {})).toEqual({ headline: 'Match over', detail: '' });
  });
});

describe('the close overlay text and the Host’s game log', () => {
  it('names why a Match closed without a result, with the runtime’s detail unless the reason says it all', () => {
    expect(describeClose('fault', 'host.tick: boom')).toEqual({ headline: 'The game crashed', detail: 'host.tick: boom' });
    expect(describeClose('version', 'host link: the game speaks wire v2, the platform v1').headline).toBe('Game version mismatch');
    expect(describeClose('protocol', 'view link: unexpected ready').headline).toBe('The game broke the protocol');
    expect(describeClose('link-lost', 'view link: no ready within 5 s')).toEqual({ headline: 'Connection lost', detail: 'view link: no ready within 5 s' });
    expect(describeClose('aborted', 'stopped by the platform')).toEqual({ headline: 'Match stopped', detail: 'Ended from the host phone' });
  });

  it('turns faults, logs and closes into log lines, and nothing else', () => {
    expect(logLineOf({ t: 'fault', where: 'host.tick', message: 'boom', stack: 'Error: boom' })).toEqual({ kind: 'fault', text: 'host.tick: boom' });
    expect(logLineOf({ t: 'log', side: 'view', args: ['x', { n: 1 }, 2] })).toEqual({ kind: 'log', text: 'view: x {"n":1} 2' });
    expect(logLineOf({ t: 'view-closed', reason: 'fault', detail: 'view.draw: boom' })).toEqual({ kind: 'closed', text: 'this phone’s view closed (fault): view.draw: boom' });
    expect(logLineOf({ t: 'closed', reason: 'fault', detail: 'view.factory: boom' })).toEqual({ kind: 'closed', text: 'match closed (fault): view.factory: boom' });
    expect(logLineOf({ t: 'started' })).toBeUndefined();
  });
});
