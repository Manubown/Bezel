import { describe, expect, it } from 'vitest';
import { DROPS_FOR_ADVICE, Dropouts, HELP_AFTER_MS, STAYED_AWAY_MS, describeDropping, describeJoin } from '../src/join';

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

  it('holds the help card back while a result card is on show, and shows it once that card is closed', () => {
    // The 30 s grace of a Match ran out: the Match closed with "Connection lost", and the first phone is still not back.
    const lost = { code: 'REZV', status: 'reconnecting', waited: 31000, wasIn: true } as const;
    expect(describeJoin({ ...lost, resultCard: true })).toMatchObject({ line: 'Lost the table. Reconnecting…', help: undefined });
    expect(describeJoin({ ...lost, resultCard: false })?.help?.headline).toBe('Still reconnecting to table REZV');
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
    // Away since its last connection ended, 2 s ago: named until it has stayed away 30 s.
    expect(d.dropping(t)).toEqual({ deviceId: 'p', drops: 3, until: t - 2000 + 30000 });
  });

  it('forgets a phone that stays away: 30 s after its last connection ended the line goes, and the count starts again', () => {
    expect(STAYED_AWAY_MS).toBe(30000);
    const d = new Dropouts();
    const left = drops(d, [4000, 4000, 4000]) - 2000;
    expect(d.dropping(left + 29999)).toMatchObject({ deviceId: 'p', drops: 3 });
    expect(d.dropping(left + 30000)).toBeUndefined();
    // Back much later, two more short connections are two in a row, not five.
    drops(d, [4000, 4000], left + 60000);
    expect(d.dropping(left + 72000)).toBeUndefined();
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
