import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, groundOf, tokensOf } from '../src/index';

const TOKENS = tokensOf(readFileSync(new URL('../tokens.css', import.meta.url), 'utf8'));

describe('the contrast of two colours, by the WCAG 2.2 formula', () => {
  it('is 21:1 for black and white in either order, and 1:1 for a colour on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrast('#fff', '#000')).toBeCloseTo(21, 6);
    expect(contrast('#2ec4b6', '#2EC4B6')).toBe(1);
  });

  it('gives the ratios the design audit measured on the old screens', () => {
    expect(contrast('#2a2a2a', '#121212')).toBeCloseTo(1.31, 2); // the lobby's Tile number
    expect(contrast('#f2f0ea', '#1b1b1b')).toBeCloseTo(15.11, 2); // the sheet's text
    expect(contrast('#121212', '#5bc46a')).toBeCloseTo(8.52, 2); // the old Start label
  });

  it('refuses a colour it cannot read', () => {
    expect(() => contrast('coral', '#000')).toThrow(/coral/);
  });
});

describe('the tokens of a style sheet', () => {
  it('are its custom properties, by name, without comments', () => {
    const css = '/* --fg: #000; */ :root {\n  --bg: #0b0b0c;\n  --font-ui: system-ui, sans-serif;\n}';
    expect(tokensOf(css)).toEqual({ '--bg': '#0b0b0c', '--font-ui': 'system-ui, sans-serif' });
  });

  it('have a ground colour, the `--bg` token: the manifest’s and the browser bar’s colour', () => {
    expect(groundOf(':root { --fg: #f2f0ea; --bg: #0b0b0c; }')).toBe('#0b0b0c');
    expect(() => groundOf(':root { --fg: #f2f0ea; }')).toThrow(/--bg/);
  });
});

describe('the night table (tokens.css)', () => {
  it('is the audit’s palette: a near-black ground, ivory text, coral and teal for the first two Players', () => {
    expect(groundOf(readFileSync(new URL('../tokens.css', import.meta.url), 'utf8'))).toBe('#0b0b0c');
    expect(TOKENS).toMatchObject({ '--fg': '#f2f0ea', '--player-1': '#ff6b4a', '--player-2': '#2ec4b6' });
    expect(TOKENS['--player-3']).toBeDefined();
    expect(TOKENS['--player-4']).toBeDefined();
  });

  /**
   * What the app's screens (and the site) put on what, and what WCAG 2.2 asks of the pair: 4.5:1 for text (1.4.3),
   * 3:1 for a control's border or a graphic someone needs to see (1.4.11). Large-text pairs are held to 4.5 as well.
   */
  const PAIRS: [fore: string, back: string, minimum: number, where: string][] = [
    ['--fg', '--bg', 4.5, 'text on the ground: the strip, the splash, the Tile number and its sentence'],
    ['--fg', '--raise', 4.5, 'text on the sheet, its corner control and the cards'],
    ['--fg-2', '--bg', 4.5, 'secondary text on the ground, a field’s placeholder, the pictogram’s other phones'],
    ['--fg-2', '--raise', 4.5, 'secondary text on the sheet and the cards'],
    ['--bg', '--fg', 4.5, 'a label on an ivory fill: Start, a picked Game, a pressed chip; the QR code'],
    ['--warn', '--raise', 4.5, 'a warning on the sheet or a card'],
    ['--warn', '--bg', 4.5, 'a warning on the ground: the strip'],
    ['--line', '--raise', 3, 'a control’s border on the sheet and the cards'],
    ['--line', '--bg', 3, 'a control’s border on the ground, a field’s border around its ground'],
    ['--off', '--raise', 3, 'the dot of a phone that is not connected'],
    ...[1, 2, 3, 4].flatMap((n): [string, string, number, string][] => [
      [`--player-${n}`, '--bg', 4.5, `Player ${n}’s name or score on the ground`],
      [`--player-${n}`, '--raise', 4.5, `Player ${n}’s name on the sheet or a card`],
      ['--bg', `--player-${n}`, 4.5, `a label on Player ${n}’s colour`],
    ]),
  ];

  it.each(PAIRS)('%s on %s reaches %s:1 (%s)', (fore, back, minimum) => {
    const [f, b] = [TOKENS[fore], TOKENS[back]];
    expect(f, fore).toBeDefined();
    expect(b, back).toBeDefined();
    expect(contrast(f!, b!)).toBeGreaterThanOrEqual(minimum);
  });

  /** `fore` at `alpha` over the opaque `back`, as the screen shows it: each channel mixed in sRGB, as canvases blend. */
  const over = (fore: string, back: string, alpha: number): string =>
    `#${[1, 3, 5].map((i) => Math.round(alpha * parseInt(fore.slice(i, i + 2), 16) + (1 - alpha) * parseInt(back.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('')}`;

  it.each([1, 2, 3, 4])('Player %s’s colour at 70 %% over the ground reaches 3:1 (a score in a Game, large text: spec D11)', (n) => {
    const [f, b] = [TOKENS[`--player-${n}`]!, TOKENS['--bg']!];
    expect(contrast(over(f, b, 0.7), b)).toBeGreaterThanOrEqual(3);
  });
});
