import { describe, expect, it } from 'vitest';
import { logLineOf } from '../src/gamelog';
import { HOST_RESTARTED, describeClose, describeResult } from '../src/result';

const PLAYERS = [
  { playerId: 'p-ann', name: 'Ann' },
  { playerId: 'p-bo', name: 'Bo' },
];
const TRIO = [...PLAYERS, { playerId: 'p-cy', name: 'Cy' }];

describe('the result overlay text', () => {
  it('reads a two-sided result as the winner’s name and both scores in one line, the winner’s first', () => {
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 4, 'p-bo': 7 }, ranking: ['p-bo', 'p-ann'] })).toEqual({ headline: 'Bo wins 7–4', detail: '', player: 1 });
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 7, 'p-bo': 2 } })).toEqual({ headline: 'Ann wins 7–2', detail: '', player: 0 });
  });

  it('calls equal top scores a draw, with the score when there are two sides', () => {
    expect(describeResult(PLAYERS, { scores: { 'p-ann': 3, 'p-bo': 3 } })).toEqual({ headline: 'Draw, 3–3', detail: '' });
    expect(describeResult(TRIO, { scores: { 'p-ann': 5, 'p-bo': 2, 'p-cy': 5 } })).toEqual({ headline: 'Draw', detail: 'Ann 5 · Cy 5 · Bo 2' });
  });

  it('names the winner of more than two sides, then everyone’s points in ranking order', () => {
    expect(describeResult(TRIO, { scores: { 'p-ann': 4, 'p-bo': 7, 'p-cy': 1 }, ranking: ['p-bo', 'p-ann', 'p-cy'] })).toEqual({ headline: 'Bo wins', detail: 'Bo 7 · Ann 4 · Cy 1', player: 1 });
  });

  it('reads a result without scores by its ranking alone, and one without either as the game being over', () => {
    expect(describeResult(PLAYERS, { ranking: ['p-bo', 'p-ann'] })).toEqual({ headline: 'Bo wins', detail: '', player: 1 });
    expect(describeResult(PLAYERS, {})).toEqual({ headline: 'Game over', detail: '' });
  });
});

describe('the close overlay text and the Host’s game log', () => {
  it('names why a Match closed without a result in the words players read, for every reason', () => {
    expect(describeClose({ reason: 'ended', detail: 'the game ended' }, false)).toEqual({ headline: 'Game over', detail: '' });
    expect(describeClose({ reason: 'aborted', detail: 'stopped by the platform' }, false)).toEqual({ headline: 'Game ended on the first phone', detail: '' });
    expect(describeClose({ reason: 'fault', detail: 'host.tick: boom' }, false)).toEqual({ headline: 'The game crashed', detail: '' });
    expect(describeClose({ reason: 'version', detail: 'host link: the game speaks wire v2, the platform v1' }, false)).toEqual({ headline: 'The game does not fit this version of the app', detail: '' });
    expect(describeClose({ reason: 'protocol', detail: 'view link: unexpected ready' }, false)).toEqual({ headline: 'The game stopped with an error', detail: '' });
    expect(describeClose({ reason: 'link-lost', detail: 'view link: no ready within 5 s' }, false)).toEqual({ headline: 'Connection lost', detail: '' });
  });

  it('says that the first phone restarted when it came back without the game, the reason the runtime could not name', () => {
    expect(HOST_RESTARTED).toBe('The first phone restarted');
    expect(describeClose({ reason: 'link-lost', detail: 'the platform lost the connection', said: HOST_RESTARTED }, false)).toEqual({ headline: 'Connection lost', detail: 'The first phone restarted' });
  });

  it('adds the runtime’s own words in Maker mode only', () => {
    expect(describeClose({ reason: 'fault', detail: 'host.tick: boom' }, true)).toEqual({ headline: 'The game crashed', detail: 'host.tick: boom' });
    expect(describeClose({ reason: 'link-lost', detail: 'the platform lost the connection', said: HOST_RESTARTED }, true)).toEqual({
      headline: 'Connection lost',
      detail: 'The first phone restarted · the platform lost the connection',
    });
    expect(describeClose({ reason: 'aborted', detail: 'stopped by the platform' }, true)).toEqual({ headline: 'Game ended on the first phone', detail: 'stopped by the platform' });
  });

  it('turns faults, logs and closes into log lines, and nothing else', () => {
    expect(logLineOf({ t: 'fault', where: 'host.tick', message: 'boom', stack: 'Error: boom' })).toEqual({ kind: 'fault', text: 'host.tick: boom' });
    expect(logLineOf({ t: 'log', side: 'view', args: ['x', { n: 1 }, 2] })).toEqual({ kind: 'log', text: 'view: x {"n":1} 2' });
    expect(logLineOf({ t: 'view-closed', reason: 'fault', detail: 'view.draw: boom' })).toEqual({ kind: 'closed', text: 'this phone’s view closed (fault): view.draw: boom' });
    expect(logLineOf({ t: 'closed', reason: 'fault', detail: 'view.factory: boom' })).toEqual({ kind: 'closed', text: 'match closed (fault): view.factory: boom' });
    expect(logLineOf({ t: 'started' })).toBeUndefined();
  });
});
