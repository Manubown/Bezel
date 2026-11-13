import { describe, expect, it } from 'vitest';
import { joinAddress, otherSession, sessionCode } from '../src/sessioncode';

describe('otherSession', () => {
  it("refuses the Session's own code with a sentence saying so", () => {
    expect(otherSession('REZV', 'REZV')).toEqual({ refusal: 'REZV is this table’s code: scan the QR above with the other phones.' });
  });

  it("refuses the Session's own code in any letter case, with spaces around it", () => {
    const refused = { refusal: 'REZV is this table’s code: scan the QR above with the other phones.' };
    expect(otherSession('rezv', 'REZV')).toEqual(refused);
    expect(otherSession('ReZv', 'REZV')).toEqual(refused);
    expect(otherSession(' rezv ', 'REZV')).toEqual(refused);
  });

  it('joins any other code, in capitals', () => {
    expect(otherSession('KMPQ', 'REZV')).toEqual({ code: 'KMPQ' });
    expect(otherSession('kmpq', 'REZV')).toEqual({ code: 'KMPQ' });
    expect(otherSession('REZ', 'REZV')).toEqual({ code: 'REZ' });
  });

  it('does nothing when no letter or digit was typed', () => {
    expect(otherSession('', 'REZV')).toBeUndefined();
    expect(otherSession(' - ', 'REZV')).toBeUndefined();
  });
});

describe('sessionCode', () => {
  it('reads a typed code the way an address carries it: capitals, letters and digits only', () => {
    expect(sessionCode('rezv')).toBe('REZV');
    expect(sessionCode(' r-e z v ')).toBe('REZV');
    expect(sessionCode(' - ')).toBe('');
  });
});

describe('joinAddress', () => {
  it('replaces the room of a Peer’s address and keeps every other flag as written', () => {
    expect(joinAddress('https://manubown.github.io/Bezel/?room=REZW&maker', 'REZV')).toBe('https://manubown.github.io/Bezel/?room=REZV&maker');
    expect(joinAddress('https://192.168.1.20:5173/?noturn&room=REZW', 'REZV')).toBe('https://192.168.1.20:5173/?room=REZV&noturn');
  });

  it('joins from the Host’s own address, which has no room, with the Host’s flags', () => {
    expect(joinAddress('https://manubown.github.io/Bezel/play/?maker&noturn', 'KMPQ')).toBe('https://manubown.github.io/Bezel/play/?room=KMPQ&maker&noturn');
    expect(joinAddress('https://manubown.github.io/Bezel/play/', 'KMPQ')).toBe('https://manubown.github.io/Bezel/play/?room=KMPQ');
  });

  it('takes the path a page links to as well as a whole address', () => {
    expect(joinAddress('/Bezel/play/', 'REZV')).toBe('/Bezel/play/?room=REZV');
  });
});
