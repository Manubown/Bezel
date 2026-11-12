# 15: The README and the files around it

**What to build:** A visitor of the repository sees the product, a way to try it and its limits before any install command, and an outsider can report a problem without knowing the makers' tracker (spec D19).

**Blocked by:** 02, 12

**Status:** resolved

- [x] README, in this order: name, pitch and a picture; try it now with a QR code to the app for everyone and three steps; works on; known limits (iPhone hotspot, no offline play, screen sizes are estimated, early project); what you can play (Pong and Air Hockey, then the five as SDK examples in one table); how it works in three plain sentences with a link to the architecture document; build a Game; develop locally; contribute; status in five lines with a link to the plan; privacy in one paragraph; licence
- [x] The picture is the drawn one (ticket 07) until the makers' clip exists; the QR code is generated with the QR package the app already uses and committed as an image
- [x] The mermaid diagram lives in the architecture document and the milestone table in the plan; nothing in them is lost
- [x] Every command in the README was run and every link resolves
- [x] Added: a code of conduct (Contributor Covenant 3.0 with a contact), a security policy (private reports; what is known and by design: the Relay credential in the public app, four-letter codes), an issue form for a problem at the table (phones and browsers, network, Game and arrangement, what happened, logs), an issue form for a Game idea, blank issues off, a pull-request checklist with the three rules of the contributing guide
- [x] Added: a changelog written for players, newest first, with an entry for this round
- [x] Added: one paragraph each for the tracker folder ("the makers' design notes and work logs; bugs and ideas from outside go to GitHub Issues") and the log folder; one README line says what `AGENTS.md` and the agents' docs are
- [x] The contributing guide says where outsiders report and that the makers' tickets stay in the tracker folder
- [x] No tracked file is deleted or moved (the log folder's stub files stay; removing them is the makers' call)

## Comments

### 2026-11-13, Ticket15Readme (implementation)

**Changed**
- `README.md` rewritten in the box's order. Title "Bezel" and pitch from `brand.json`; the picture is `apps/pwa/public/preview.png` (relative path, linked to `play/`); a link row (Start a table, Build a game, Contribute, Report a problem); three badges (Pages, play, licence; the TypeScript and pnpm badges dropped). The repository tree stays in "Develop locally" with `apps/site/` added; the documentation table went (its targets are linked from "How it works" and `docs/README.md` is the index). The licence section's line: the packages keep the `@mgc` scope and `mgc.<slug>` ids from the first name, MobileGameConnect.
- `docs/media/qr-play.svg` (new): `brand.json`'s address + `play/`, made by the app's `qrcode` 1.5.4 CLI; the command sits in an HTML comment beside the image in the README.
- `docs/architecture.md` §2: the README's flowchart, unchanged, after step 8, with the old README's clock figure ("within a few milliseconds", from `docs/PLAN.md` §6 M0); step 8's "the logs of the first live test" now points at the live runs and `docs/liveLogs/README.md`.
- `docs/PLAN.md` §6: the README milestone table's facts that were missing are in. Connectivity 2: built 2026-11-10 and 2026-11-11, the Host fail-safe (ticket 07), live run 5's relay on an iPhone hotspot, fail-safe not run on phones. M3 "(next)", M4 and M5 "(planned)". Rows edited in place, so no line moved (`docs/guide/` cites `docs/PLAN.md:88`). Every other row of the README's table was already in §6 (M0 rtt 5–8 ms and ≤ 2 ms, M1, M2's seven Games and live test 1, connectivity 1 with "star-only after the next phone run").
- New: `CODE_OF_CONDUCT.md` (the official Contributor Covenant 3.0 Markdown, its two `[NOTE: …]` placeholders replaced: reports go to the private reporting form or the contact on @Manubown's profile; the maintainers are the Community Moderators), `SECURITY.md`, `.github/ISSUE_TEMPLATE/table-problem.yml` (labels `bug`, `needs-triage`), `game-idea.yml` (`game-idea`, `needs-triage`), `config.yml` (blank issues off; contact links to the security form and the developer guide), `.github/pull_request_template.md`, `CHANGELOG.md`, `.scratch/README.md`, `docs/liveLogs/README.md`.
- `CONTRIBUTING.md` "Issues and tickets": outsiders use GitHub Issues through the two forms, security goes privately, the code of conduct, the PR checklist; the makers' tickets stay in `.scratch/`. "Releases": what changes for players goes into `CHANGELOG.md`.

**Where each fact came from** (code, built output or the repo's records; no older doc taken on trust)
- Try it now: `apps/pwa/src/hud/sheet.ts` (the QR, the hint "Other phones: open the camera and scan this, or open … and join table …", "Join a different table"), `placement.ts` ("Lay me first, on the left"), `gamelist.ts` `FEATURED`, Air Hockey's manifest (`templates: ['column', 'row']`).
- Works on: the `device` lines' user agents in `docs/liveLogs/*` (Safari 27.2 on the iPhone 12 and 15 Pro Max, 26.6.1 on the iPhone 14, Firefox 159 on Android 15 as Host in `02edc2eTest/`); `.scratch/live-test-1/findings.md` line 4 and §1d; `docs/PLAN.md` §6 M2 ("4 iPhones + 2 Androids", so one iPhone beyond the three named).
- Known limits: `docs/research/README.md` findings 1, 4, 5 and option 2; findings §1f (18.9 and 19.7 s to `ready` over the Relay, states up to 0.9 s old). Screen sizes are not in the research README: `apps/pwa/src/device.ts` `guessPxPerMm` (6.1 iPhone, 6.3 Android). The hotspot advice is the app's own (`join.ts` `HOTSPOT`).
- Games: each `games/*/src/index.ts` manifest (tiles, controllers, players, templates, bots, seats, tickHz); `lobby.ts` `arrangements` (no templates = all three); `gamelist.ts` `gameList`; the template is 97 lines.
- Status: `main.ts` `RELAY_AFTER = 3`, `WITHHOLD_AFTER = 1`; `.scratch/connectivity-2/issues/07-…` still `ready-for-human`; `rejoin.ts`; `scripts/pages.mjs` (`play/` = the `stable` tag, `next/` = the checkout).
- Privacy: Trystero 0.26 in `node_modules`: `@trystero-p2p/core/dist/peer.mjs:378` (default STUN servers: three of Google's and Cloudflare's; the strategy doc names Cloudflare only), `@trystero-p2p/nostr/dist/index.mjs` (`defaultRelayUrls`, `defaultRedundancy = 5`); what the relays see (a hashed topic of the code, offers encrypted with a key from the code) agreed with Ticket14PrivacyImprint, who read `strategy.mjs`/`crypto.mjs`; `turn.ts` + `pages.mjs` (the Relay comes from the build), `scripts/setup-turn.sh` (Metered); `device.ts`, `maker.ts`, `main.ts`, `lobby.ts` (storage keys), `recorder.ts` (`networkOf`: no addresses in the log); no `https://` request in `apps/pwa/src`. The paragraph names the STUN servers too because the code talks to them.
- Security policy: `turn.ts` (credentials compiled into the bundle), `main.ts` `CODE_ALPHABET` (31 characters, 31⁴ = 923,521 codes; no `password` passed to the transport), `games.ts` (only this repository's Games), `recorder.ts`.
- Changelog: each entry checked in code (`REJOIN_GRACE_MS`, `SavedLobby`, `MAX_AHEAD_MS = 1000`, `viewportSettled`, `overscroll-behavior` and the upright overlay in `index.html`, Breakout's `serveWait`, `seats`, `result.ts`, `cards.ts`, `join.ts` `HELP_AFTER_MS`, `brand.ts` and the `og:image` tags, `pages.mjs` forwards); grouped by `git log f6222a6..master`; the `stable` entry from `git ls-tree stable` (seven Games, three templates, `pause.ts`).
- Log folder: runs mapped to folders from findings.md; `stat` found eleven 37-byte files; no IPv4 pattern anywhere in `docs/liveLogs/`.

**Decisions**
- The QR is black on white (the CLI's default) so it scans in GitHub's light and dark themes. No committed check for it: a test would need `vitest.config.ts` to include a root folder, outside this ticket's files; the regeneration command beside the image derives the address from `brand.json`.
- The link check was a throwaway script (relative links and `#anchors` by GitHub's slug rule); not committed: `pnpm pages` already checks the site, and nothing else in the repo checks Markdown links.
- No promised response time in `SECURITY.md`: the draft's "7 days" is a promise only the maintainer can make. No email address anywhere.
- The table-problem form adds a "Which app" choice (`play/`, `next/`, a dev server) and tells how to get a log out through `?maker`, since Export log is Maker mode only.
- Changelog: Keep a Changelog's format without version numbers; what is not in `play/` yet is everything above the `stable` entry, said once at the top instead of on each entry.
- `docs/architecture.md` §6's own milestone map was left as it is.

**Verified**
- README commands, each run once in this worktree: `pnpm install` ("Done in 5.1s"); `pnpm dev` (Vite 7.3.7, "Local: https://localhost:5173/", two "Network:" lines); `pnpm build` (exit 0, `dist/index.html` 18.67 kB); `pnpm new-game my-game "My Game"` (exit 0), `pnpm install --no-frozen-lockfile` (exit 0), `pnpm vitest run games/my-game` (2 tests passed); with that dev server, headless Chrome at `https://localhost:5173/?maker` listed Air Hockey, Breakout, My Game, Pass, Pong, Quiz, Snake, Tap Race, and at `?maker=no` Pong, Air Hockey; a second window at `?room=DR8E` appeared in the first phone's roster (2 entries). `games/my-game` removed and `pnpm-lock.yaml` restored afterwards. `git clone https://github.com/Manubown/Bezel.git` + `cd Bezel` in a temp folder (cloned `2a1b161`). The QR command printed "saved qrcode to: docs/media/qr-play.svg". `pnpm test` and `pnpm typecheck`: below.
- The committed SVG decodes (its modules redrawn as an image, read with zxing-cpp) to `https://manubown.github.io/Bezel/play/`.
- Links: the throwaway checker over README, CONTRIBUTING, CHANGELOG, CODE_OF_CONDUCT, SECURITY, `.scratch/README.md`, `docs/liveLogs/README.md`, `docs/architecture.md`, `docs/PLAN.md`, the PR template and the three issue-template files: "69 links in 13 files, 0 broken relative" (anchors included; a planted `README.md#nope` and `missing.md` were reported). Absolute URLs with `curl -L`: 200 for every github.com, shields.io, keepachangelog, contributor-covenant, creativecommons and `manubown.github.io/Bezel/` link; `…/play/`, `…/next/` and `…/privacy/` answer 404 on the live site today (master is not deployed with ticket 12). Against the build: `pnpm pages --here` (Node 22.23.5) printed "every link resolves, every forward keeps its query" and `apps/site/dist` has `play/` and `next/`; it has no `privacy/` until ticket 14 merges.
- Issue forms parsed with PyYAML: unique ids, labels on every field, unique non-empty dropdown options; the labels they use exist (ticket 16's read-back).
- `pnpm typecheck` exit 0; `pnpm test`: 35 files, 271 tests passed.

**Not verified**
- How GitHub renders the README, the issue forms and the PR template: they show only once on the default branch (no push).
- `privacy/` in a built site: it comes with ticket 14.
- Nothing here was run on phones.
- **Why "every link resolves" stays unticked and the status `ready-for-agent`** (Main's decision): every command was run and every other link resolves, but the README's `privacy/` is not in a build of this branch until ticket 14 is in `outside-view`. Then: merge it, `pnpm pages --here`, tick the box if `apps/site/dist/privacy/` exists, resolve.

**For the next tickets**
- `scripts/new-game.mjs` still prints `pnpm dev  # the Host's game list shows "My Game"`: since ticket 01/02 only with `?maker`.
- `docs/README.md`'s row for `liveLogs/` says "live test 1 (2026-11-07)"; the folder holds runs 1–6.
- Spec D18 keeps the site unlinked from public places until the imprint's blanks are filled; the README links `play/` and `privacy/`, so the README reaches `master` with the go-public step (ticket 17).
- When `stable` moves, `CHANGELOG.md` gets a dated heading over what moved.

### 2026-11-13, Ticket15Readme (after tickets 08, 11 and 14 landed)

**Changed**
- Merged `outside-view` at `8391f47`. One conflict, the README's repository tree: kept this ticket's lines and added ticket 08's `packages/look/` line.
- README privacy paragraph now says what the site's privacy page (`apps/site/src/pages/privacy.astro`, `src/kept.ts`) says. It names five relays, "a scrambled form of the table's name" and the offer locked with a key made from the code. Metered sees a phone's IP address at every connection set-up, while the game passes through the Relay only when no direct path works. The phone keeps a few settings (Maker mode, the install offer's count and dismissal) and, on the first phone, its table until the tab closes. "No ads" is added, and the link reads "with how to delete it".
- README "Try it now": the app offers the home screen after the first finished game (ticket 11, `apps/pwa/src/install.ts`).
- `CHANGELOG.md` this round: the install offer and the in-app-browser banner (11), the privacy page and imprint (14), the night-table look (08: `packages/look/tokens.css`: `--bg` near-black, `--fg` ivory, `--player-1`/`--player-2` coral and teal, Unbounded served with the app, `--tap: 44px`, `--text-m: 16px` for every text field).

**Verified**
- `pnpm install --frozen-lockfile`: "Done in 1.7s".
- `pnpm typecheck` exit 0; `pnpm test`: 41 files, 333 tests passed.
- `pnpm pages --here` (Node 22.23.5): "0 errors", ticket 14's blanks warning for the imprint, then "pages: apps/site/dist holds the site, play/ (this checkout) and next/; every link resolves, every forward keeps its query", exit 0. `apps/site/dist` has `play/`, `next/`, `privacy/` and `imprint/` `index.html`: the README's `privacy/` link resolves in the build.
- The built `privacy/index.html` contains "Five public signaling relays", "scrambled", `stun.l.google.com`, `stun.cloudflare.com`, "Metered", "No cookies", "no ads", "How many games this phone has finished", "Maker mode, on or off", "The table you opened".
- The throwaway link checker again: "69 links in 13 files, 0 broken relative". The README's preview picture is unchanged by ticket 08, so the alt text still fits.
- Ticket 14's last box (the README and the page say the same) is its owner's to tick.
