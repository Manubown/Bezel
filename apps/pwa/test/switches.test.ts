import { describe, expect, it } from 'vitest';
import { keptSwitch, switchValue } from '../src/switches';

describe('a switch kept on the Device', () => {
  it('is kept as on or off', () => {
    expect(switchValue(true)).toBe('on');
    expect(switchValue(false)).toBe('off');
  });

  it('reads back as it was kept, and as nothing when nothing was', () => {
    expect(keptSwitch('on')).toBe(true);
    expect(keptSwitch('off')).toBe(false);
    expect(keptSwitch(null)).toBeUndefined();
  });

  it('reads the install offer’s dismissal as earlier builds kept it, yes, as on', () => {
    expect(keptSwitch('yes')).toBe(true);
  });
});
