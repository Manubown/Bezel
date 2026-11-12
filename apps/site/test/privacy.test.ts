import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KEPT } from '../src/kept';

/** The app's source (`apps/pwa/src`). */
const app = fileURLToPath(new URL('../../pwa/src/', import.meta.url));
/** A module keeps something on the phone when it writes the browser's storage. */
const WRITES_STORAGE = /\b(?:localStorage|sessionStorage)\.setItem\(|\bindexedDB\.open\(/;

/** The app's modules, as paths below `apps/pwa/src`, that keep something on the phone. */
function keepingModules(): string[] {
  return (readdirSync(app, { recursive: true, encoding: 'utf8' }) as string[])
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.ts') && WRITES_STORAGE.test(readFileSync(`${app}${path}`, 'utf8')))
    .sort();
}

describe('what the privacy page says the app keeps on the phone (spec D18)', () => {
  it('names every part of the app that keeps something, and no other', () => {
    expect([...new Set(KEPT.flatMap((kept) => kept.sources))].sort()).toEqual(keepingModules());
  });
});
