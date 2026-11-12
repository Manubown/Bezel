import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandPage, webManifest } from '../brand';

/** A name the makers might pick instead: the template must take it everywhere and keep no other. */
const TABLO = { name: 'Tablo', pitch: 'Phones side by side become one "table" & more.', address: 'https://tablo.example/' };
const PAGE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** What the page shows before its script runs: the `#hud` section as the HTML has it. */
function splash(html: string): string {
  return /<section id="hud"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
}

/** The `content` of a `<meta name|property="key">`, as the HTML has it. */
function meta(html: string, key: string): string | undefined {
  return new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(html)?.[1];
}

/** A PNG in `public/`: its width × height, from its header. */
function pngSize(file: string): string {
  const png = readFileSync(new URL(`../public/${file}`, import.meta.url));
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe('the page a build serves, for the public name in brand.json', () => {
  it('shows the name in the tab title and, before the script runs, the name and the pitch', () => {
    const html = brandPage(PAGE, TABLO, '/');
    expect(html).toContain('<title>Tablo</title>');
    expect(splash(html)).toContain('Tablo');
    expect(splash(html)).toContain('Phones side by side become one &#34;table&#34; &#38; more.');
  });

  it('carries preview tags for a shared link: the name, the pitch, a picture and the address of this build', () => {
    const html = brandPage(PAGE, TABLO, '/play/');
    const pitch = 'Phones side by side become one &#34;table&#34; &#38; more.';
    expect(meta(html, 'description')).toBe(pitch);
    expect(meta(html, 'og:title')).toBe('Tablo');
    expect(meta(html, 'og:description')).toBe(pitch);
    expect(meta(html, 'og:url')).toBe('https://tablo.example/play/');
    expect(meta(html, 'og:image')).toBe('https://tablo.example/play/preview.png');
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  it('spells no other name', () => {
    expect(brandPage(PAGE, TABLO, '/')).not.toMatch(/Bezel|MobileGameConnect|MGC|%BRAND_/);
  });
});

describe('the web manifest a build serves', () => {
  it('labels the home-screen icon and the installed app with the name, and says the pitch', () => {
    expect(webManifest(TABLO, PAGE)).toMatchObject({ name: 'Tablo', short_name: 'Tablo', description: TABLO.pitch });
  });

  it('takes its colours from the page’s ground colour, as the page’s theme colour does', () => {
    const page = PAGE.replace(/--bg: #[0-9a-fA-F]+;/, '--bg: #0b0b0c;');
    expect(webManifest(TABLO, page)).toMatchObject({ background_color: '#0b0b0c', theme_color: '#0b0b0c' });
    expect(meta(brandPage(page, TABLO, '/'), 'theme-color')).toBe('#0b0b0c');
  });

  it('has the icons Chrome asks for before it offers install: 192 and 512 px, and a 512 px one a launcher may mask', () => {
    const icons = webManifest(TABLO, PAGE).icons;
    expect(icons.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(icon.src)).toBe(icon.sizes);
    }
  });

  it('leaves an iPhone its own home-screen icon, named by the page', () => {
    const href = /<link rel="apple-touch-icon" href="\/([^"]+)"/.exec(PAGE)?.[1];
    expect(href && pngSize(href)).toBe('180x180');
  });
});
