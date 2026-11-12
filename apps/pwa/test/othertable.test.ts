import { describe, expect, it } from 'vitest';
import { otherTable } from '../src/othertable';

describe('otherTable', () => {
  it("refuses this table's own code with a sentence saying so", () => {
    expect(otherTable('REZV', 'REZV')).toEqual({ refusal: 'REZV is this table’s code: scan the QR above with the other phones.' });
  });

  it("refuses this table's own code in any letter case, with spaces around it", () => {
    const refused = { refusal: 'REZV is this table’s code: scan the QR above with the other phones.' };
    expect(otherTable('rezv', 'REZV')).toEqual(refused);
    expect(otherTable('ReZv', 'REZV')).toEqual(refused);
    expect(otherTable(' rezv ', 'REZV')).toEqual(refused);
  });

  it('joins any other code, in capitals', () => {
    expect(otherTable('KMPQ', 'REZV')).toEqual({ code: 'KMPQ' });
    expect(otherTable('kmpq', 'REZV')).toEqual({ code: 'KMPQ' });
    expect(otherTable('REZ', 'REZV')).toEqual({ code: 'REZ' });
  });

  it('does nothing when no letter or digit was typed', () => {
    expect(otherTable('', 'REZV')).toBeUndefined();
    expect(otherTable(' - ', 'REZV')).toBeUndefined();
  });
});
