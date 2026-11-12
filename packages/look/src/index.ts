/**
 * The night table, the one look of the app and the site: `tokens.css` beside this file holds its colour and type
 * tokens and the display face; these functions read them where CSS does not reach (the build's manifest colours, the
 * contrast check of the token pairs).
 */

/** A style sheet's custom properties, by name (`--bg`), their values trimmed; comments are skipped. */
export function tokensOf(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    tokens[name!] = value!.trim();
  }
  return tokens;
}

/** The ground colour, the `--bg` token: the page's, the web manifest's and the browser bar's. */
export function groundOf(css: string): string {
  const ground = tokensOf(css)['--bg'];
  if (!ground || !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(ground)) throw new Error('tokens.css: no `--bg: #rrggbb;` ground colour');
  return ground;
}

/** The contrast ratio of two opaque colours (`#rgb` or `#rrggbb`), by the WCAG 2.2 formula: 1 to 21, in either order. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG 2.2's relative luminance of an sRGB colour. */
function luminance(hex: string): number {
  const digits = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex)?.[1];
  if (!digits) throw new Error(`not a #rgb or #rrggbb colour: ${hex}`);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
