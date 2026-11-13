import { readdirSync, readFileSync } from 'node:fs';
import { tokensOf } from '@mgc/look';
import { describe, expect, it } from 'vitest';

/** The look's tokens (`@mgc/look/tokens.css`). */
const TOKENS_CSS = readFileSync(new URL('../../../packages/look/tokens.css', import.meta.url), 'utf8');

/** Every page, layout, component and style sheet of the site, by its path under `src/`. */
function sources(dir = new URL('../src/', import.meta.url), at = ''): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(new URL(`${e.name}/`, dir), `${at}${e.name}/`)
      : /\.(astro|css)$/.test(e.name)
        ? [[`${at}${e.name}`, readFileSync(new URL(e.name, dir), 'utf8')] as [string, string]]
        : [],
  );
}

/** A colour written out (`#rrggbb`, `rgb(…)`, `hsl(…)`); `&#34;` is a character reference, not a colour. */
const COLOUR = /(?<!&)#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

describe('the site wears the app’s look', () => {
  it('spells no colour of its own: every colour is a token of @mgc/look', () => {
    for (const [file, code] of sources()) expect(code.match(COLOUR), file).toBeNull();
  });

  it('uses no token that neither the look nor the site’s own style sheet defines', () => {
    const defined = new Set([...Object.keys(tokensOf(TOKENS_CSS)), ...sources().flatMap(([, code]) => Object.keys(tokensOf(code)))]);
    const used = sources().flatMap(([file, code]) => [...code.matchAll(/var\((--[\w-]+)/g)].map((m) => `${file}: ${m[1]}`));
    expect(used.filter((u) => !defined.has(u.split(': ')[1]!))).toEqual([]);
  });

  it('takes the tokens and the display face from @mgc/look in the layout every page shares', () => {
    const layout = sources().find(([file]) => file === 'layouts/Page.astro')?.[1] ?? '';
    expect(layout).toMatch(/import '@mgc\/look\/tokens\.css';/);
    expect(layout).toMatch(/from '@mgc\/look\/fonts\/unbounded-600\.woff2\?url'/);
    expect(layout).toMatch(/<link rel="preload" href=\{face\} as="font" type="font\/woff2" crossorigin \/>/);
  });
});
