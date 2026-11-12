import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** The public face of the product: `brand.json` at the workspace root, read by the app's build (and the site's). */
export interface Brand {
  /** What players call it: tab title, home-screen label, splash, sheet, strip, link preview. */
  name: string;
  /** One sentence that says what it is: under the name on the splash, and a link preview's description. */
  pitch: string;
  /** The public address, absolute (`https://manubown.github.io/Bezel/`); its origin is where a published build lives. */
  address: string;
}

/**
 * The build's reading of `brand.json`: fills in `index.html` (`brandPage`) and serves (dev) or writes (build)
 * `manifest.webmanifest` (`webManifest`). The app's own code imports `brand.json` for the sheet and the strip.
 */
export function brandPlugin(brand: Brand): Plugin {
  let base = '/';
  let page = '';
  const manifest = (): string => `${JSON.stringify(webManifest(brand, readFileSync(page, 'utf8')), null, 2)}\n`;
  return {
    name: 'mgc-brand',
    configResolved(config) {
      base = config.base;
      page = resolve(config.root, 'index.html');
    },
    transformIndexHtml: { order: 'pre', handler: (html) => brandPage(html, brand, base) },
    configureServer(server) {
      server.middlewares.use(`${base}manifest.webmanifest`, (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() });
    },
  };
}

/**
 * `index.html` with the brand filled in. The template spells no name: it says `%BRAND_NAME%`, `%BRAND_PITCH%` and
 * `%BRAND_URL%`, this build's own public address (the address's origin with the build's `base`), so a build at
 * `play/` previews as `play/`; and `%GROUND%`, the page's ground colour. Values are text, never markup.
 */
export function brandPage(html: string, brand: Brand, base: string): string {
  const values: Record<string, string> = {
    BRAND_NAME: brand.name,
    BRAND_PITCH: brand.pitch,
    BRAND_URL: new URL(base, brand.address).href,
    GROUND: groundOf(html),
  };
  return html.replace(/%(BRAND_[A-Z]+|GROUND)%/g, (placeholder, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`index.html: ${placeholder} is not a brand value`);
    return escapeHtml(value);
  });
}

/**
 * The web manifest: the home-screen label is the name, the splash and status bar colours are the page's ground, and
 * the icons are the ones Chrome needs to offer install without a service worker (192 and 512 px), plus one a launcher
 * may mask. Icon paths are relative to the manifest, which sits at the build's root.
 */
export function webManifest(brand: Brand, html: string) {
  const ground = groundOf(html);
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.pitch,
    start_url: './',
    scope: './',
    display: 'fullscreen',
    orientation: 'portrait',
    background_color: ground,
    theme_color: ground,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** The page's ground colour: its `--bg` token, the one place it is set. */
function groundOf(html: string): string {
  const ground = /--bg:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(html)?.[1];
  if (!ground) throw new Error('index.html: no `--bg: #rrggbb;` colour token');
  return ground;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
