#!/usr/bin/env node
// Moves the `stable` tag (the known-good build Pages serves as the app for everyone, under play/) and pushes it.
// Usage: pnpm stable            → where stable points
//        pnpm stable <ref>      → move it to <ref> (a commit, tag or branch) and push
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { address } = JSON.parse(readFileSync(new URL('../brand.json', import.meta.url), 'utf8'));

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
// `rev-list -n 1` resolves a tag to its commit without `^{commit}`, which cmd.exe would eat.
const commitOf = (r) => git(`rev-parse --short ${git(`rev-list -n 1 ${r}`)}`);
const [ref] = process.argv.slice(2);

const current = (() => {
  try {
    return commitOf('stable');
  } catch {
    return undefined;
  }
})();
if (!ref) {
  console.log(current ? `stable → ${current}  ${git('log -1 --format=%s stable')}` : 'no stable tag yet');
  console.log('Move it: pnpm stable <ref>');
  process.exit(0);
}

const target = commitOf(ref);
git(`tag -f stable ${target}`);
git('push -f origin stable');
console.log(`stable: ${current ?? '(none)'} → ${target}  ${git(`log -1 --format=%s ${target}`)}
Pages rebuilds the site and both app builds; in a few minutes:
  ${address}play/   ${target}, the app for everyone
  ${address}next/   master`);
