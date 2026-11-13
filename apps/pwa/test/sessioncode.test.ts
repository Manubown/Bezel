import { describe, expect, it } from 'vitest';
import { otherSession } from '../src/sessioncode';

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
