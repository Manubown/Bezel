# 12: A site at the public address; the app moves one level down

**What to build:** The public address serves a site (one placeholder home page in this ticket); the app for everyone is below it, built from the `stable` tag; the app as on `master` is beside it for the makers. Old links, old QR codes and installed icons keep working. One workflow publishes all of it (spec D16).

**Blocked by:** 07

**Status:** resolved

- [x] A second app in the workspace builds the site with Astro; it reads the name, pitch and address from the one data file (ticket 07)
- [x] The published site has: the site at the root; the app for everyone at `play/`, built from the `stable` tag (from `master` when there is no tag); the app as on `master` at `next/`
- [x] The old `stable/` address forwards to `play/` and keeps its query
- [x] The root with a join code in its query forwards to `next/` with the query (a first phone still on an old build)
- [x] The root opened from an installed icon forwards to `play/`
- [x] A first phone at `play/` shows a QR that leads to `play/`; one at `next/`, to `next/`
- [x] One workflow run builds the site and both app builds, with the Relay setting in both, and publishes them together; type check and tests still gate it
- [x] The workspace's type check passes with the site present; the site is checked by Astro's own check
- [x] The stable script's printed addresses, the README's links, the contributing guide's release section, the phone guide's hosted-builds section and the workflow's own comment name the new addresses
- [x] The built output is checked locally: every internal link resolves, and each forward keeps a query
- [x] Versions the landing report named on 2026-11-11 (Astro, Node, the Pages actions) are checked against what is current before they are pinned

## Comments

### 2026-11-13, agent (implementation)

**Changed**
- `apps/site` (new, `@mgc/site`): Astro 7, static output. `astro.config.ts` takes `site` and `base` from `brand.json`'s `address` (origin `https://manubown.github.io`, base `/Bezel/`). `src/pages/index.astro`: the placeholder home page (the name as heading, the pitch, "Start a table" to `play/`), its first script the root's forwards. `src/pages/stable/index.astro`: the forward to `play/`, `noindex`, and a "has moved: open it here" link for a phone without scripts. `build` is `astro check && astro build`.
- `scripts/pages.mjs` (new, `pnpm pages`): builds what Pages publishes into `apps/site/dist` (the site; `next/` from this checkout; `play/` from a worktree of the `stable` tag, or this checkout without a tag or with `--here`; `COMMIT` in each app build), then reads the output: every `href`/`src` (and absolute `content` address) into the site must be a file of the output, and the forward pages' own inline scripts, run against a stand-in `location`, must send `?room=ABCD` from the root to `next/?room=ABCD`, an installed launch with `?maker` to `play/?maker`, a plain visit nowhere, and `stable/?room=ABCD` to `play/?room=ABCD`, each target present. Exits 1 on a problem.
- `.github/workflows/pages.yml`: install, typecheck, test, `pnpm pages` (with `VITE_MGC_TURN_SERVERS` from the secret, inherited by both app builds), upload `apps/site/dist`, deploy. The comment at the top names the five addresses. Actions at their current majors: `checkout@v7`, `pnpm/action-setup@v6`, `setup-node@v7` (`node-version: 22`, `check-latest: true`), `upload-pages-artifact@v5`, `deploy-pages@v5`.
- `package.json`: `pages` script; `typecheck` is `pnpm -r --filter "!@mgc/site" exec tsc -p .`. `.gitignore`: `.astro/`. Lockfile: astro 7.4.11, @astrojs/check 0.9.12.
- Addresses: `scripts/stable.mjs` prints `<address>play/` (the tag) and `<address>next/` (master), reading `brand.json`; README's play badge, "Try it" step and hosted-builds line; CONTRIBUTING's Node row, commands, CI paragraph and Releases; `docs/guide/running-on-phones.md` (the "without a laptop" line and §Two hosted builds); `docs/guide/troubleshooting.md` (the hosted build is `next/`); the comments in `apps/pwa/vite.config.ts` and on `Brand.address`.

**Decisions**
- One script does what the workflow publishes, and the workflow runs it: the local proof runs the same code as CI, and tickets 13 and 14 get the link check for free (`pnpm pages`).
- The site's base and both app bases come from `brand.json`'s `address` (`/Bezel/`, `/Bezel/play/`, `/Bezel/next/`), no longer from the repository's name: a custom domain or a rename is one edit there. A fork has to edit `brand.json` too (ticket 07's preview tags already needed that). Each app build's `og:url`/`og:image` keep pointing at the build itself through ticket 07's origin-plus-base rule: `…/Bezel/play/` and `…/Bezel/next/` in the output.
- The forwards are inline scripts at the top of `<head>` (nothing renders first), with absolute paths from the base, so they do not depend on the trailing slash. A join code wins over an installed launch. "Installed" is `display-mode` `fullscreen` (what the manifest asks for) or `standalone` (what an iPhone's home-screen app reports).
- The workspace's type check leaves out `@mgc/site`; `astro check` runs in the site's `build`, so it gates `pnpm pages` and the publish. Double quotes in the filter, so cmd.exe passes it on.
- `play/COMMIT` and `next/COMMIT` replace `stable/COMMIT`.
- The stable worktree is deleted with `rmSync` plus `git worktree prune`: `git worktree remove --force` failed on Windows ("Directory not empty", pnpm's junctions).
- Versions, checked 2026-11-12: astro 7.4.11 (report: 7.4.10), engines node `>=22.23.4`; Node 22's latest is 22.23.5 (2026-11-11), so CI uses `check-latest` rather than trusting the runner's cached 22. Actions' latest releases equal the report's (checkout v7.0.1, action-setup v6.1.1, setup-node v7.1.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1); release notes read for each major: setup-node v6 caches npm only by itself (`cache: pnpm` is explicit here), upload-pages-artifact v4 leaves out dotfiles (the output has none), the Node 24 runtimes need runner 2.327.1 (hosted runners have it).
- The placeholder is unstyled and has no sitemap: the look comes with tickets 08 and 13. No new dependency beyond Astro and its checker.

**Verified**
- Red first: `pnpm pages --here` before the forwards existed printed five problems (e.g. `pages: /Bezel/?room=ABCD forwards to nowhere, not https://manubown.github.io/Bezel/next/?room=ABCD`, `pages: /Bezel/stable/?room=ABCD forwards to /Bezel/stable/ (missing), …`), exit 1. With them: `astro check` "Result (4 files): 0 errors, 0 warnings, 0 hints", Astro "2 page(s) built", then `pages: apps/site/dist holds the site, play/ (this checkout) and next/; every link resolves, every forward keeps its query`, exit 0.
- The check catches what it should: with `stable/` forwarding without its query and a home-page link to `games/`, `pnpm pages --here` printed `pages: /Bezel/ links to /Bezel/games/, which is not in the output` and `pages: /Bezel/stable/?room=ABCD forwards to https://manubown.github.io/Bezel/play/, not https://manubown.github.io/Bezel/play/?room=ABCD`, exit 1. Both reverted.
- The CI path, `pnpm pages` with the `stable` tag present: "Preparing worktree (detached HEAD f6222a6)", frozen install, build; `play/COMMIT` f6222a6, `next/COMMIT` 842943c, exit 0, no worktree or temp folder left behind. The old build's links resolve in the check too.
- Output read back (both copies from this worktree, `pnpm pages --here`): `play/index.html` has `og:url` `https://manubown.github.io/Bezel/play/`, `og:image` `…/Bezel/play/preview.png`, script `/Bezel/play/assets/…`; `next/` the same with `next/`; both manifests `start_url` and `scope` `./`.
- Browser, the output of `pnpm pages --here` (the `stable` tag is from before this work, so both app copies were built from this worktree) served by `pnpm --filter @mgc/site preview --port 5212` at `http://127.0.0.1:5212/Bezel/`, headless Chrome at 390×844, one profile per tab: the root shows "Bezel", the pitch and "Start a table", which leads to `/Bezel/play/`; `/Bezel/stable/?room=ABCD` ended at `/Bezel/play/?room=ABCD`; `/Bezel/?room=ABCD` at `/Bezel/next/?room=ABCD`; `/Bezel/stable/` at `/Bezel/play/`; `/Bezel/?maker` stayed. A first phone at `play/` (code TRD9) read "Scan to join, or open 127.0.0.1:5212/Bezel/play and enter the code."; its QR canvas, sampled module by module, matched the QR of `http://127.0.0.1:5212/Bezel/play/?room=TRD9` in all 841 modules, against 306 and 311 differing modules for the root's and `next/`'s address. At `next/` (D34C) the same: 0 differing for `next/?room=D34C`, 188 and 287 for the controls. A second tab opened at each QR address joined: the first phone's bar "2 phones · Row", the second's strip "Phone 2 of 2 right of phone 1 · Player 2".
- With scripts off (Chrome's script execution disabled): the root, also with `?room=ABCD`, shows the name, the pitch and "Start a table"; `stable/?room=ABCD` shows "Bezel has moved: open it here."
- `actionlint` 1.7.12 on `.github/workflows/pages.yml`: no findings.
- `pnpm typecheck && pnpm test` before the merge of `outside-view`: type check clean (`@mgc/site` filtered out); 31 files, 234 tests passed.

**Not verified**
- The first real run on GitHub: the action majors, `check-latest`, the stable worktree on Linux, the upload and the deploy. Read and linted only.
- A real installed icon opening the root. Chrome's `display-mode` media emulation over CDP did not take (`matchMedia` kept answering `browser`); the launch was stood in for by answering `display-mode: fullscreen/standalone` as matching before the page's script ran: the root went to `/Bezel/play/`, and with `?room=WXYZ` to `/Bezel/next/?room=WXYZ`. Belongs on the go-public ticket's phone run.
- That Pages keeps the query when it adds a missing trailing slash (`/Bezel/stable?room=…`) `[INFERENCE]`; the addresses in circulation end in a slash. `astro preview` answers 404 to such paths and to `COMMIT`, unlike Pages.
- Developers' machines need Node 22.23.4 or newer to build the site (Astro refuses 22.22.3, which this machine has; the local runs used a downloaded 22.23.5). `pnpm typecheck` and `pnpm test` do not touch Astro.

**For the next tickets**
- 13: replace the body of `apps/site/src/pages/index.astro`; keep its first script where it is. `pnpm pages --here` then `pnpm --filter @mgc/site preview` shows the whole layout, and the check fails on a link to a page that does not exist yet. The first phone's hint now names `…/Bezel/play` (it is the page's own address).
- 14: the legal pages go under `apps/site/src/pages/`; the check reads only HTML attributes, not links the app builds in script.
- 17: once this is on `master`, `/Bezel/` is the placeholder and `play/` serves the `stable` tag (2026-11-07) until it is moved.
