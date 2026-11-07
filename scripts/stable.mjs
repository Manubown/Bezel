#!/usr/bin/env node
// Moves the `stable` tag (the known-good build Pages serves under /stable/) and pushes it.
// Usage: pnpm stable            → where stable points
//        pnpm stable <ref>      → move it to <ref> (a commit, tag or branch) and push
import { execSync } from 'node:child_process';

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
const [ref] = process.argv.slice(2);

const current = (() => {
  try {
    return git('rev-parse --short stable^{commit}');
  } catch {
    return undefined;
  }
})();

if (!ref) {
  console.log(current ? `stable → ${current}  ${git('log -1 --format=%s stable')}` : 'no stable tag yet');
  console.log('Move it: pnpm stable <ref>');
  process.exit(0);
}

const target = git(`rev-parse --short ${ref}^{commit}`);
git(`tag -f stable ${target}`);
git('push -f origin stable');
console.log(`stable: ${current ?? '(none)'} → ${target}  ${git(`log -1 --format=%s ${target}`)}
Pages rebuilds both channels; in a few minutes:
  https://manubown.github.io/Bezel/          master
  https://manubown.github.io/Bezel/stable/   ${target}`);
