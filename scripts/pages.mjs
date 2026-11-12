#!/usr/bin/env node
// Builds what GitHub Pages publishes into apps/site/dist (spec D16; `.github/workflows/pages.yml` runs it), then
// checks it. <root> is the path of brand.json's `address` (`/Bezel/`):
//   <root>         the site (apps/site)
//   <root>play/    the app for everyone: the `stable` tag, built from its own tree (this checkout when there is no tag)
//   <root>next/    the app as in this checkout (`master` on CI)
// Each app build's `COMMIT` names the commit it was built from. `VITE_MGC_TURN_SERVERS` reaches both app builds.
// Usage: pnpm pages          as CI does
//        pnpm pages --here   play/ from this checkout too, to look at work that is not tagged
// Look at it under <root>: pnpm --filter @mgc/site preview (unlike Pages, it answers 404 to a path with neither a
// trailing slash nor a file extension, `COMMIT` included)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

const workspace = join(import.meta.dirname, '..');
const brand = JSON.parse(readFileSync(join(workspace, 'brand.json'), 'utf8'));
const root = new URL(brand.address).pathname;
const out = join(workspace, 'apps/site/dist');

const run = (command, cwd, env = {}) => execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const git = (args, cwd = workspace) => execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();

/** Builds the app in `tree` (a checkout of this repository) for `<root><dir>/` and copies it there. */
function app(tree, dir) {
  run('pnpm build', tree, { BASE_PATH: `${root}${dir}/` });
  cpSync(join(tree, 'apps/pwa/dist'), join(out, dir), { recursive: true });
  writeFileSync(join(out, dir, 'COMMIT'), `${git('rev-parse --short HEAD', tree)}\n`);
}

run('pnpm --filter @mgc/site build', workspace);
app(workspace, 'next');
const stable = !process.argv.includes('--here') && tagged('stable');
if (stable) {
  const tree = mkdtempSync(join(tmpdir(), 'mgc-stable-'));
  git(`worktree add --detach "${tree}" stable`);
  try {
    run('pnpm install --frozen-lockfile', tree);
    app(tree, 'play');
  } finally {
    // Not `git worktree remove`: on Windows it cannot delete pnpm's junctions.
    rmSync(tree, { recursive: true, force: true, maxRetries: 3 });
    git('worktree prune');
  }
} else {
  app(workspace, 'play');
}

const problems = [...brokenLinks(), ...lostQueries()];
for (const problem of problems) console.error(`pages: ${problem}`);
if (problems.length) process.exit(1);
console.log(`pages: apps/site/dist holds the site, play/ (${stable ? 'the stable tag' : 'this checkout'}) and next/; every link resolves, every forward keeps its query`);

function tagged(tag) {
  try {
    git(`rev-parse -q --verify refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

/** The output's file for an address of the published site, if it has one (a directory's is its `index.html`). */
function fileOf(url) {
  if (url.origin !== new URL(brand.address).origin || !url.pathname.startsWith(root)) return undefined;
  const path = join(out, decodeURIComponent(url.pathname.slice(root.length)));
  if (existsSync(path) && statSync(path).isFile()) return path;
  const index = join(path, 'index.html');
  return existsSync(index) ? index : undefined;
}

/** Every page of the output with its public address. */
function pages(dir = out) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    if (!entry.name.endsWith('.html')) return [];
    const address = new URL(relative(out, path).replaceAll('\\', '/').replace(/(^|\/)index\.html$/, '$1'), brand.address);
    return [{ path, address }];
  });
}

/** Links of every page (`href`, `src`, and absolute addresses in `content`) that point into the site and miss. */
function brokenLinks() {
  return pages().flatMap(({ path, address }) => {
    const html = readFileSync(path, 'utf8');
    const links = [...html.matchAll(/\s(href|src|content)="([^"]*)"/g)]
      .filter(([, attribute, value]) => attribute !== 'content' || /^https?:/.test(value))
      .map(([, , value]) => new URL(value.replaceAll('&amp;', '&'), address));
    return links
      .filter((url) => /^https?:$/.test(url.protocol) && url.origin === address.origin && url.pathname.startsWith(root))
      .filter((url) => !fileOf(url))
      .map((url) => `${address.pathname} links to ${url.pathname}, which is not in the output`);
  });
}

/**
 * The forwards (spec D16), run from the output's own inline scripts: the root sends a join link to the latest build
 * and a launch from an installed icon to the app for everyone; the old stable address sends everyone to the app for
 * everyone. Each keeps the query it was opened with, and its target is in the output.
 */
function lostQueries() {
  const cases = [
    { page: '', query: '?room=ABCD', installed: false, expect: 'next/?room=ABCD' },
    { page: '', query: '?room=ABCD&maker', installed: true, expect: 'next/?room=ABCD&maker' },
    { page: '', query: '?maker', installed: true, expect: 'play/?maker' },
    { page: '', query: '', installed: false, expect: undefined },
    { page: 'stable/', query: '?room=ABCD', installed: false, expect: 'play/?room=ABCD' },
    { page: 'stable/', query: '', installed: true, expect: 'play/' },
  ];
  return cases.flatMap(({ page, query, installed, expect }) => {
    const address = new URL(page + query, brand.address);
    const target = forwardOf(address, installed);
    const expected = expect && new URL(expect, brand.address).href;
    const opened = `${address.pathname}${query}${installed ? ' from an installed icon' : ''}`;
    if (target !== expected) return [`${opened} forwards to ${target ?? 'nowhere'}, not ${expected ?? 'nowhere'}`];
    if (target && !fileOf(new URL(target))) return [`${opened} forwards to ${target}, which is not in the output`];
    return [];
  });
}

/** Where the page at `address` sends a phone before it renders: its inline scripts run against a stand-in `location`. */
function forwardOf(address, installed) {
  const file = fileOf(address);
  if (!file) return `${address.pathname} (missing)`;
  let target;
  const location = {
    href: address.href,
    pathname: address.pathname,
    search: address.search,
    replace: (url) => (target ??= new URL(url, address).href),
  };
  const scripts = [...readFileSync(file, 'utf8').matchAll(/<script(?![^>]*\bsrc=)(?![^>]*\btype=)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, code] of scripts) {
    runInNewContext(code, { location, URLSearchParams, matchMedia: () => ({ matches: installed }), navigator: {} });
  }
  return target;
}
