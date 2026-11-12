import { describe, expect, it } from 'vitest';
import { DROPS_FOR_ADVICE, Dropouts, HELP_AFTER_MS, describeDropping, describeJoin, joinAddress } from '../src/join';

const BEFORE = 14999;
const AFTER = 15000;
const CHECK = 'Check that the first phone shows REZV, and keep its screen on.';
const HOTSPOT = 'An iPhone hotspot often fails: use the same Wi-Fi on every phone, or mobile data on every phone.';

describe('What a joining phone says (spec D7)', () => {
  it('the help card comes after 15 s', () => {
    expect(HELP_AFTER_MS).toBe(15000);
  });

  it('searching, never in: "Finding table REZV…"; after 15 s the card says the table was not found yet', () => {
    expect(describeJoin({ code: 'REZV', status: 'searching', waited: BEFORE, wasIn: false })).toEqual({
      line: 'Finding table REZV…',
      detail: 'keep the first phone’s screen on',
      makers: 'looking for the host',
      help: undefined,
    });
    expect(describeJoin({ code: 'REZV', status: 'searching', waited: AFTER, wasIn: false })?.help).toEqual({
      headline: 'Table REZV not found yet',
      advice: [CHECK, HOTSPOT],
    });
  });

  it('found the table but not in yet, while syncing or after a failed attempt: "Connecting…"; after 15 s the card says it is still connecting', () => {
    expect(describeJoin({ code: 'REZV', status: 'syncing', waited: BEFORE, wasIn: false })).toEqual({
      line: 'Connecting…',
      detail: '',
      makers: 'syncing clocks · measuring the offset to the host',
      help: undefined,
    });
    expect(describeJoin({ code: 'REZV', status: 'reconnecting', waited: BEFORE, wasIn: false })).toEqual({
      line: 'Connecting…',
      detail: '',
      makers: 'reconnecting to the host · the connection dropped',
      help: undefined,
    });
    for (const status of ['syncing', 'reconnecting'] as const) {
      expect(describeJoin({ code: 'REZV', status, waited: AFTER, wasIn: false })?.help).toEqual({
        headline: 'Still connecting to table REZV',
        advice: [CHECK, HOTSPOT],
      });
    }
  });

  it('in the table: nothing, before and after 15 s (the lobby speaks)', () => {
    for (const wasIn of [false, true]) {
      expect(describeJoin({ code: 'REZV', status: 'ready', waited: BEFORE, wasIn })).toBeUndefined();
      expect(describeJoin({ code: 'REZV', status: 'ready', waited: AFTER, wasIn })).toBeUndefined();
    }
  });

  it('was in and lost the table: "Lost the table. Reconnecting…" through every attempt; after 15 s of it the card says it is still reconnecting', () => {
    for (const status of ['reconnecting', 'syncing', 'searching'] as const) {
      const view = describeJoin({ code: 'REZV', status, waited: BEFORE, wasIn: true });
      expect(view).toMatchObject({ line: 'Lost the table. Reconnecting…', detail: '', help: undefined });
      expect(describeJoin({ code: 'REZV', status, waited: AFTER, wasIn: true })?.help).toEqual({
        headline: 'Still reconnecting to table REZV',
        advice: [CHECK, HOTSPOT],
      });
    }
    expect(describeJoin({ code: 'REZV', status: 'reconnecting', waited: BEFORE, wasIn: true })?.makers).toBe('reconnecting to the host · the connection dropped');
  });
});

describe('The help card’s code field', () => {
  it('opens the same address with the corrected code, in capitals, keeping the other flags', () => {
    expect(joinAddress('https://manubown.github.io/Bezel/?room=REZW&maker', 'rezv')).toBe('https://manubown.github.io/Bezel/?room=REZV&maker');
    expect(joinAddress('https://192.168.1.20:5173/?noturn&room=REZW', ' r-e z v ')).toBe('https://192.168.1.20:5173/?room=REZV&noturn');
  });

  it('does nothing without a code', () => {
    expect(joinAddress('https://manubown.github.io/Bezel/?room=REZW', '')).toBeUndefined();
    expect(joinAddress('https://manubown.github.io/Bezel/?room=REZW', ' - ')).toBeUndefined();
  });
});

describe('The first phone’s advice when one phone keeps dropping (spec D7)', () => {
  /** The first phone `h` and phone `p`, whose connection comes in at `at` and ends `lived` ms later: three times, for `lived` each. */
  const drops = (d: Dropouts, lived: readonly number[], from = 0): number => {
    let t = from;
    for (const ms of lived) {
      d.see(['h', 'p'], t);
      t += ms;
      d.see(['h'], t);
      t += 2000;
    }
    return t;
  };

  it('names a phone once its connection ended three times in a row within 15 s of coming in; twice is not enough', () => {
    expect(DROPS_FOR_ADVICE).toBe(3);
    const d = new Dropouts();
    d.see(['h'], 0);
    let t = drops(d, [4000, 4000], 100);
    expect(d.dropping(t)).toBeUndefined();
    t = drops(d, [14999], t);
    expect(d.dropping(t)).toEqual({ deviceId: 'p', drops: 3, until: undefined });
  });

  it('a connection that lasted 15 s starts the count again', () => {
    const d = new Dropouts();
    let t = drops(d, [4000, 4000, 15000]);
    t = drops(d, [4000, 4000], t);
    expect(d.dropping(t)).toBeUndefined();
  });

  it('while the named phone is back, it stays named until that connection has lasted 15 s', () => {
    const d = new Dropouts();
    const back = drops(d, [4000, 4000, 4000]);
    d.see(['h', 'p'], back);
    expect(d.dropping(back + 14999)).toEqual({ deviceId: 'p', drops: 3, until: back + 15000 });
    expect(d.dropping(back + 15000)).toBeUndefined();
  });

  it('names one phone among several, the one that keeps dropping', () => {
    const d = new Dropouts();
    d.see(['h', 'q'], 0);
    let t = 100;
    for (let i = 0; i < 3; i++) {
      d.see(['h', 'q', 'p'], t);
      d.see(['h', 'q'], t + 3000);
      t += 5000;
    }
    expect(d.dropping(t)).toMatchObject({ deviceId: 'p' });
  });

  it('says which phone and what usually helps; the count is a maker’s figure', () => {
    expect(describeDropping('iPhone', 3)).toEqual({
      line: 'iPhone keeps losing its connection. ' + HOTSPOT,
      makers: '3 connections in a row ended within 15 s',
    });
  });
});
