import { defineConfig } from 'astro/config';
import brand from '../../brand.json';
import { makers, openBlanks } from './src/makers';

// The site is the public address's root (`brand.json`'s `address`); the app's two builds sit below it at `play/` and
// `next/` (`scripts/pages.mjs`). Static output: GitHub Pages serves the files as they are.
const address = new URL(brand.address);

export default defineConfig({
  site: address.origin,
  base: address.pathname,
  trailingSlash: 'always',
  integrations: [
    {
      // The imprint's blanks still open (`src/makers.ts`): listed on every build, never failing it (spec D18).
      name: 'makers-blanks',
      hooks: {
        'astro:build:done': ({ logger }) => {
          const open = openBlanks(makers);
          if (open.length > 0) {
            logger.warn(`the imprint still has blanks for the makers to fill in src/makers.ts: ${open.join(', ')}. Link the site from nowhere public until they are filled (spec D18).`);
          }
        },
      },
    },
  ],
});
