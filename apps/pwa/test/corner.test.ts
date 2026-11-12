import { describe, expect, it } from 'vitest';
import { isNear, REACH_PX } from '../src/hud/corner';

/** The corner control as it sits on a 390×844 screen: a pill in the bottom right corner. */
const PILL = { left: 290, top: 792, right: 382, bottom: 836 };

describe('a touch near the corner control during play', () => {
  it('brings it back when it lands on it or within a thumb’s reach of its edge', () => {
    expect(isNear(PILL, 330, 810)).toBe(true);
    expect(isNear(PILL, PILL.left - REACH_PX + 1, 810)).toBe(true);
    expect(isNear(PILL, 330, PILL.top - REACH_PX + 1)).toBe(true);
  });

  it('leaves it faded for a touch elsewhere on the Tile, a corner’s diagonal included', () => {
    expect(isNear(PILL, 195, 422)).toBe(false);
    expect(isNear(PILL, PILL.left - REACH_PX - 1, 810)).toBe(false);
    // Within reach across and within reach up, but farther than the reach from the pill's corner.
    expect(isNear(PILL, PILL.left - REACH_PX + 2, PILL.top - REACH_PX + 2)).toBe(false);
  });
});
