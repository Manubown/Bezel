import { readdirSync, readFileSync } from 'node:fs';
import { tokensOf } from '@mgc/look';
import { describe, expect, it } from 'vitest';

/** The look's tokens (`@mgc/look/tokens.css`) and the app's page, as the repository has them. */
const TOKENS_CSS = readFileSync(new URL('../../../packages/look/tokens.css', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const STYLE = /<style>([\s\S]*?)<\/style>/.exec(PAGE)?.[1] ?? '';

/** Every TypeScript file under `src/`, by its path there. */
function sources(dir = new URL('../src/', import.meta.url), at = ''): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir), `${at}${e.name}/`) : e.name.endsWith('.ts') ? [[`${at}${e.name}`, readFileSync(new URL(e.name, dir), 'utf8')] as [string, string]] : [],
  );
}

/** A colour written out (`#rrggbb`, `rgb(…)`, `hsl(…)`); `&#34;` is a character reference, not a colour. */
const COLOUR = /(?<!&)#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

describe('the app’s screens wear the look', () => {
  it('spell no colour of their own: the page’s style and the screens’ code take every colour from the tokens', () => {
    expect(STYLE.match(COLOUR)).toBeNull();
    for (const [file, code] of sources()) expect(code.match(COLOUR), file).toBeNull();
  });

  it('use no token the look does not define', () => {
    const defined = new Set([...Object.keys(tokensOf(TOKENS_CSS)), ...Object.keys(tokensOf(STYLE))]);
    const used = [...STYLE.matchAll(/var\((--[\w-]+)/g), ...sources().flatMap(([, code]) => [...code.matchAll(/'(--[\w-]+)'/g)])].map((m) => m[1]!);
    expect(used.filter((t) => !defined.has(t))).toEqual([]);
  });

  it('take the look from the page itself, before any script runs', () => {
    expect(STYLE.trimStart()).toMatch(/^@import '@mgc\/look\/tokens\.css';/);
  });
});

describe('the display face', () => {
  it('is a file of the look, named relative to it, so each build serves it from its own origin', () => {
    const sources = [...TOKENS_CSS.matchAll(/url\(['"]?([^'")]+)/g)].map((m) => m[1]);
    expect(sources).toEqual(['./fonts/unbounded-600.woff2']);
    expect(readFileSync(new URL('../../../packages/look/fonts/unbounded-600.woff2', import.meta.url)).subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(readFileSync(new URL('../../../packages/look/fonts/OFL.txt', import.meta.url), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('never makes the text wait for it or move when it arrives', () => {
    expect(/@font-face\s*{[^}]*font-display:\s*optional/.test(TOKENS_CSS)).toBe(true);
  });

  it('is fetched by the page at once, from no other host', () => {
    expect(PAGE).toMatch(/<link rel="preload" href="[^"]*packages\/look\/fonts\/unbounded-600\.woff2" as="font" type="font\/woff2" crossorigin \/>/);
    const elsewhere = [...PAGE.matchAll(/<(?:link|script)[^>]*(?:href|src)="(https?:)?\/\/[^"]*"/g)];
    expect(elsewhere).toEqual([]);
  });
});
