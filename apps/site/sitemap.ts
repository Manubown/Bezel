import { readFileSync, writeFileSync } from 'node:fs';
import type { AstroIntegration } from 'astro';

/** A page that asks search engines to leave it out: the old stable address, which only forwards. */
const NOINDEX = /<meta name="robots" content="noindex"/;

/**
 * `sitemap.xml` at the site's root, written once the build is done: every page it wrote, by its public address,
 * except those marked `noindex`. The pages link it (`<link rel="sitemap">`); a `robots.txt` cannot, since the site is
 * not the root of its host.
 */
export function sitemap(): AstroIntegration {
  let root: URL;
  return {
    name: 'sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = new URL(config.base, config.site);
      },
      'astro:build:done': ({ pages, dir }) => {
        const addresses = pages
          .map(({ pathname }) => pathname)
          .filter((pathname) => !NOINDEX.test(readFileSync(new URL(`${pathname}index.html`, dir), 'utf8')))
          .map((pathname) => new URL(pathname, root).href)
          .sort();
        const urls = addresses.map((address) => `  <url><loc>${address}</loc></url>\n`).join('');
        writeFileSync(new URL('sitemap.xml', dir), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`);
      },
    },
  };
}
