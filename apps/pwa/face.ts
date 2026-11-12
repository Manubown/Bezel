import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

/** The display face as `index.html` preloads it: by its path from the page, inside `@mgc/look`. */
const PRELOAD = 'href="../../packages/look/fonts/unbounded-600.woff2"';

/**
 * The display face's preload on the dev server. A build resolves the page's path to the face: it emits the file once
 * and names it the way `tokens.css`'s `@font-face` gets it. The dev server leaves a link's path as written, which
 * points outside the app; it gets the address the dev server serves that file at instead, `/@fs/` and its path.
 */
export function facePreloadPlugin(): Plugin {
  const file = createRequire(import.meta.url).resolve('@mgc/look/fonts/unbounded-600.woff2').replaceAll('\\', '/').replace(/^\//, '');
  return {
    name: 'mgc-face-preload',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(PRELOAD)) throw new Error(`index.html: no preload of the display face (${PRELOAD})`);
        return html.replace(PRELOAD, `href="/@fs/${file}"`);
      },
    },
  };
}
