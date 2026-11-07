import { describe, expect, it } from 'vitest';
import { describeResult } from '../src/result';

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
