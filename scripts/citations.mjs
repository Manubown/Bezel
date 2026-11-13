#!/usr/bin/env node
// Checks the developer docs' citations (CONTRIBUTING.md, "Docs"): in docs/guide/*.md, docs/sdk-design.md and README.md,
// every backticked file citation (`path`, `path:12`, `path:12-30`) names a file that exists and every line range lies
// inside it; in docs/guide/, every relative link and #anchor resolves. Exits 1 on any failure.
// Usage: pnpm citations          → the counts and every failure
//        pnpm citations --lines  → also every line citation with the first line it cites, to read against its sentence
// A path resolves from the workspace root, or as the end of a tracked file's path (`test/tap-race.test.ts` in the
// tutorial is `games/tap-race/test/tap-race.test.ts`); `*` and `{a,b}` must each match a tracked file. A line range
// needs a path from the root. "In range" is all this script knows: whether the line says what the sentence says is
// read by whoever moves the citation.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const guide = readdirSync(new URL('docs/guide/', root)).filter((f) => f.endsWith('.md')).map((f) => `docs/guide/${f}`);
const docs = [...guide, 'docs/sdk-design.md', 'README.md'];
/** The workspace's files: tracked, or new and not ignored. */
const tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const showLines = process.argv.includes('--lines');

/** A backticked span that cites a file: a path with an extension, optionally `:line` or `:from-to`. */
const CITATION = /^([\w.@/*{},-]+\.(?:ts|mts|mjs|js|json|md|html|css|astro|yml|yaml|sh|svg|png|txt|woff2))(?::(\d+)(?:-(\d+))?)?$/;

/** `a/{b,c}.ts` → `a/b.ts`, `a/c.ts`. */
const expand = (path) => {
  const m = /\{([^}]*)\}/.exec(path);
  return m ? m[1].split(',').flatMap((alt) => expand(path.slice(0, m.index) + alt + path.slice(m.index + m[0].length))) : [path];
};
const globToRegex = (path) => new RegExp(`^${path.replace(/[.+^$()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')}$`);
/** The files `path` names: from the root, else every file whose path ends with it. */
const filesOf = (path) => {
  const pattern = globToRegex(path);
  const fromRoot = tracked.filter((f) => pattern.test(f));
  if (fromRoot.length > 0) return fromRoot;
  const depth = path.split('/').length;
  return tracked.filter((f) => pattern.test(f.split('/').slice(-depth).join('/')));
};

let citations = 0;
let lineCitations = 0;
const failures = [];
const fileLines = new Map();
const linesOf = (path) => {
  if (!fileLines.has(path)) fileLines.set(path, read(path).split('\n'));
  return fileLines.get(path);
};

/** Counts a line citation of `path` and checks its range; `path` must be one file named from the root. */
const checkLines = (at, shown, path, files, from, to) => {
  lineCitations++;
  if (files.length !== 1 || files[0][1].length !== 1 || files[0][1][0] !== path) {
    failures.push(`${at}  ${shown}: a line range needs one file named from the root`);
    return;
  }
  const lines = linesOf(path);
  const last = lines.at(-1) === '' ? lines.length - 1 : lines.length;
  const [a, b] = [Number(from), Number(to ?? from)];
  if (a < 1 || b < a || b > last) failures.push(`${at}  ${shown}: out of range (${path} has ${last} lines)`);
  else if (showLines) console.log(`${at}  ${path}:${from}${to ? `-${to}` : ''}  │ ${lines[a - 1].trim().slice(0, 110)}`);
};

/**
 * In a line of prose, in order: a backticked span; a backticked `12` or `12-30` right after a line citation and ", "
 * (more lines of that file); "line 13", "lines 12 and 19" (lines of the file cited last on that line).
 */
const TOKEN = /`([^`\n]+)`|\blines? (\d+(?:-\d+)?(?:(?:, | and )\d+(?:-\d+)?)*)/g;

for (const doc of docs) {
  let fenced = false;
  read(doc)
    .split('\n')
    .forEach((text, i) => {
      // Fenced code is not prose; its backticks are not citations.
      if (text.startsWith('```')) fenced = !fenced;
      if (fenced || text.startsWith('```')) return;
      const at = `${doc}:${i + 1}`;
      /** The file cited last on this line, and where its last line citation (or a continuation of it) ended. */
      let cited;
      for (const token of text.matchAll(TOKEN)) {
        const [whole, span, prose] = token;
        if (prose !== undefined) {
          if (cited) for (const part of prose.split(/, | and /)) checkLines(at, `${cited.path} "line ${part}"`, cited.path, cited.files, ...part.split('-'));
          continue;
        }
        const more = /^(\d+)(?:-(\d+))?$/.exec(span);
        if (more) {
          if (cited?.end !== undefined && text.slice(cited.end, token.index) === ', ') {
            checkLines(at, `${cited.path} \`${span}\``, cited.path, cited.files, more[1], more[2]);
            cited.end = token.index + whole.length;
          }
          continue;
        }
        const m = CITATION.exec(span);
        if (!m) continue;
        const [, path, from, to] = m;
        if (!path.includes('/') && from === undefined && !tracked.some((f) => f === path || f.endsWith(`/${path}`))) continue;
        citations++;
        const files = expand(path).map((p) => [p, filesOf(p)]);
        const missing = files.filter(([, found]) => found.length === 0).map(([p]) => p);
        if (missing.length > 0) {
          failures.push(`${at}  \`${span}\`: no such file (${missing.join(', ')})`);
          cited = undefined;
          continue;
        }
        cited = { path, files, end: from === undefined ? undefined : token.index + whole.length };
        if (from !== undefined) checkLines(at, `\`${span}\``, path, files, from, to);
      }
    });
}

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to dashes, repeats numbered. */
const anchorsOf = (path) => {
  const seen = new Map();
  const anchors = new Set();
  let fenced = false;
  for (const line of read(path).split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const m = !fenced && /^#{1,6}\s+(.*)$/.exec(line);
    if (!m) continue;
    const base = m[1]
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
};

let links = 0;
for (const doc of guide) {
  // Links in prose only: fenced code and backticked spans dropped.
  const prose = read(doc).replace(/^```[^]*?^```/gm, '').replace(/`[^`\n]+`/g, '');
  for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    links++;
    const [file, anchor] = target.split('#');
    const path = file ? new URL(file, new URL(doc, root)).pathname.slice(root.pathname.length) : doc;
    const decoded = decodeURIComponent(path);
    if (!existsSync(new URL(decoded, root))) failures.push(`${doc}  (${target}): no such file`);
    else if (anchor !== undefined && decoded.endsWith('.md') && !anchorsOf(decoded).has(anchor)) failures.push(`${doc}  (${target}): no such heading`);
  }
}

console.log(`${citations} file citations (${lineCitations} with lines) in ${docs.length} files, ${links} relative links in docs/guide/`);
for (const f of failures) console.log(`  ${f}`);
console.log(failures.length === 0 ? '0 unresolved' : `${failures.length} unresolved`);
process.exit(failures.length === 0 ? 0 : 1);
