import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepLastGame, lastGame } from '../src/lastgame';

describe('the Game this Device last picked (story 6)', () => {
  /** The phone's storage for the app: what one visit keeps, the next finds. */
  let kept: Map<string, string>;
  beforeEach(() => {
    kept = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is none on a Device that never picked, which keeps nothing', () => {
    expect(lastGame()).toBeUndefined();
    expect(kept.size).toBe(0);
  });

  it('is the last pick, on the next visit too', () => {
    keepLastGame('mgc.pong');
    keepLastGame('mgc.air-hockey');
    expect(lastGame()).toBe('mgc.air-hockey');
  });
});
