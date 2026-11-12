import { defineConfig } from 'astro/config';
import brand from '../../brand.json';

// The site is the public address's root (`brand.json`'s `address`); the app's two builds sit below it at `play/` and
// `next/` (`scripts/pages.mjs`). Static output: GitHub Pages serves the files as they are.
const address = new URL(brand.address);

export default defineConfig({
  site: address.origin,
  base: address.pathname,
  trailingSlash: 'always',
});
