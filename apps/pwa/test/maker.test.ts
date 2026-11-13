import { describe, expect, it } from 'vitest';
import { makerMode } from '../src/maker';

const at = (search: string) => new URLSearchParams(search);

describe('makerMode', () => {
  it('is on when the address carries the flag, whatever this Device remembered', () => {
    expect(makerMode(at('?maker'), false)).toBe(true);
    expect(makerMode(at('?room=REZV&noturn&maker'), false)).toBe(true);
    expect(makerMode(at('?maker=yes'), true)).toBe(true);
  });

  it('is off when the flag says no, whatever this Device remembered', () => {
    expect(makerMode(at('?maker=no'), true)).toBe(false);
    expect(makerMode(at('?room=REZV&maker=NO'), true)).toBe(false);
  });

  it('takes no as the one value that switches it off (spec D3): any other value is the flag', () => {
    expect(makerMode(at('?maker=off'), false)).toBe(true);
    expect(makerMode(at('?maker=0'), false)).toBe(true);
    expect(makerMode(at('?maker=false'), false)).toBe(true);
  });

  it('is what this Device remembered when the address has no flag', () => {
    expect(makerMode(at(''), true)).toBe(true);
    expect(makerMode(at('?room=REZV'), true)).toBe(true);
    expect(makerMode(at('?room=REZV'), false)).toBe(false);
  });

  it('is off for a Device that never saw the flag', () => {
    expect(makerMode(at(''), undefined)).toBe(false);
    expect(makerMode(at('?room=REZV&noturn'), undefined)).toBe(false);
  });
});
