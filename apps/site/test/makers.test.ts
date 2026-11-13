import { describe, expect, it } from 'vitest';
import { openBlanks } from '../src/makers';

describe('the makers’ blanks on the imprint (spec D18)', () => {
  it('lists every detail still open, in the imprint’s order', () => {
    expect(openBlanks({ name: null, address: null, country: null, contact: null })).toEqual(['name', 'postal address', 'country', 'contact']);
  });

  it('leaves out the details the makers filled in', () => {
    expect(openBlanks({ name: 'Ana Example', address: null, country: 'Germany', contact: null })).toEqual(['postal address', 'contact']);
  });

  it('lists nothing once every detail is filled in', () => {
    expect(openBlanks({ name: 'Ana Example', address: 'Example Street 1\n12345 Example Town', country: 'Germany', contact: 'ana@example.org' })).toEqual([]);
  });
});
