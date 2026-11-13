import { describe, expect, it } from 'vitest';
import { joinByCode } from '../src/join';

/** The app for everyone, as the home page links it. */
const PLAY = '/Bezel/play/';

describe('the home page’s join field', () => {
  it('opens the app for everyone joined to the table, the code in capitals', () => {
    expect(joinByCode('REZV', PLAY)).toEqual({ href: '/Bezel/play/?room=REZV' });
    expect(joinByCode('rezv', PLAY)).toEqual({ href: '/Bezel/play/?room=REZV' });
  });

  it('reads a code the way the app does: spaces, dashes and other marks are left out', () => {
    expect(joinByCode(' re-zv ', PLAY)).toEqual({ href: '/Bezel/play/?room=REZV' });
  });

  it('refuses a code that is not four letters or digits, in words, and opens nothing', () => {
    expect(joinByCode('REZ', PLAY)).toEqual({ refusal: 'REZ is not a table code: a code has four letters or digits. Check it on the first phone.' });
    expect(joinByCode('rezvx', PLAY)).toEqual({ refusal: 'REZVX is not a table code: a code has four letters or digits. Check it on the first phone.' });
  });

  it('asks for the code when none was typed', () => {
    const ask = { refusal: 'Type the table’s code: the four letters or digits the first phone shows.' };
    expect(joinByCode('', PLAY)).toEqual(ask);
    expect(joinByCode(' - ', PLAY)).toEqual(ask);
  });
});
