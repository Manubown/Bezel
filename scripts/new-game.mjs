#!/usr/bin/env node
// Copies games/_template to games/<slug> and renames the Game. Usage: pnpm new-game <slug> "<Name>"
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [slug, nameArg] = process.argv.slice(2);
if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug) || slug.startsWith('_')) {
  console.error('Usage: pnpm new-game <slug> "<Name>"   (slug: lowercase letters, digits, dashes)');
  process.exit(1);
}
const words = slug.split('-');
const name = nameArg ?? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const pascal = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const constant = words.map((w) => w.toUpperCase()).join('_');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const from = join(root, 'games', '_template');
const to = join(root, 'games', slug);
if (existsSync(to)) {
  console.error(`games/${slug} already exists`);
  process.exit(1);
}
cpSync(from, to, { recursive: true, filter: (p) => !p.includes('node_modules') });

const rewrite = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) rewrite(p);
    else {
      const text = readFileSync(p, 'utf8')
        .replaceAll('@mgc/game-template', `@mgc/${slug}`)
        .replaceAll('mgc.template', `mgc.${slug}`)
        .replaceAll('TemplateState', `${pascal}State`)
        .replaceAll('TemplateMessage', `${pascal}Message`)
        .replaceAll('TEMPLATE', constant)
        .replaceAll("'Template'", `'${name}'`)
        .replaceAll('# Template', `# ${name}`)
        .replaceAll("describe('Template'", `describe('${name}'`);
      writeFileSync(p, text);
    }
  }
};
rewrite(to);
const test = join(to, 'test');
renameSync(join(test, 'template.test.ts'), join(test, `${slug}.test.ts`));
// The template's README is about the template; the new Game gets a stub of its own.
writeFileSync(
  join(to, 'README.md'),
  `# ${name}

_What the Game is, in two sentences: who plays, on which phones, how it ends._

\`\`\`
src/index.ts          manifest + host + view, exported through defineGame
test/${slug}.test.ts  the rules, run in one process over createTestMatch
\`\`\`

Started from \`games/_template\` (\`pnpm new-game ${slug} "${name}"\`). The Game imports \`@mgc/sdk\` only; the test pins that. Guide: \`docs/guide/your-first-game.md\`; every hook: \`docs/guide/api.md\`.
`,
);

console.log(`Created games/${slug} (@mgc/${slug}, manifest id mgc.${slug}, "${name}").

Next:
  pnpm install --no-frozen-lockfile  # links @mgc/sdk into the new package (the lockfile gains an entry)
  pnpm test games/${slug}           # its test runs over createTestMatch
  pnpm dev                          # the Host's game list shows "${name}"

Edit games/${slug}/src/index.ts; docs/guide/your-first-game.md walks through it.`);
