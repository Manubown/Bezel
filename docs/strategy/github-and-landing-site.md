# The GitHub front page and a landing site

Researched 2026-11-11. Every external fact links its source and was checked that day. Facts about this repo cite the file. `[INFERENCE]` marks a conclusion of ours that no source states. This is not legal advice.

## Bottom line

- **Pick one public name before anything else.** A stranger now meets four names: "Bezel" (repo, URL), "MobileGameConnect" (README title, page title, glossary, licence), "MGC" (the label under the home-screen icon) and `@mgc` (packages). "Bezel" is already used: an App Store app called "Bezel • Phone Mirror" ([App Store search, DE](https://itunes.apple.com/search?term=bezel&entity=software&country=de)), a watch marketplace at getbezel.com, and `bezel.app` is registered ([RDAP](https://rdap.org/domain/bezel.app)). Cost: one conversation. Do it this week.
- **This week, one evening, €0: fix the repo front page.** Today it has no description, no website link, no topics, no social preview image, no picture of the product, and a "health" score of 42 % ([GitHub API](https://api.github.com/repos/Manubown/Bezel/community/profile)). The checklist in §2 takes about 3 hours. The README's first screen gets a GIF of phones on a table, a QR code, three steps, the phones it works on, and the iPhone hotspot limit.
- **Record a 20-second demo first.** Everything else (README, social preview, landing page, press kit, Kickstarter) reuses it. A GIF or video in a README may be up to 10 MB on a free plan ([GitHub Docs](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)).
- **Build the landing site with plain Astro, in this repo, on the same GitHub Pages site.** Proposed layout: `/Bezel/` = landing page, `/Bezel/play/` = the app for strangers, `/Bezel/next/` = the latest `master` for you, `/Bezel/stable/` and `/Bezel/?room=` forward to the right place. One workflow builds all three (§3.3, §3.4). Cost: €0, about 3 evenings.
- **Strangers should get a known-good build, not `master`.** Today the QR link everyone shares is the `master` build. The `stable` tag still points at `f6222a6` (2026-11-07), 19 commits behind `master`, before the connectivity fixes. Move `stable` after your next good phone run, then point the public button at it.
- **A custom domain is optional and costs about $12 a year (.com).** Get it before the URL is printed anywhere, or never. It changes the app's origin: every phone gets a new Device id and old session logs stay behind. A renamed repo also breaks the github.io URL with no redirect ([GitHub Docs](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)).
- **Imprint and privacy pages are needed once the site is public** (Germany: [MStV § 18](https://www.gesetze-bayern.de/Content/Document/MStV-18); Austria: [MedienG § 25](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10000719&Paragraf=25); both: GDPR Art. 13). Someone's name and postal address will be public. Decide whose before launch.
- **Skip for now:** Starlight docs, GitHub Discussions, self-hosted Listmonk, paid analytics, a separate site repo, a German translation of every page. Each costs time that the demo and README pay back better (reasons in §3).
- **Money:** €0 required. Optional: a domain ($3–12 in year one, see §3.5), Plausible analytics from $9 a month (not recommended yet). **Time:** about 6 evenings in total for everything in §4. One evening already gives a front page you can show people.

## 1. What a stranger sees today

### 1.1 Facts, checked 2026-11-11

| What | State | Source |
|---|---|---|
| Visibility | public, created 2026-11-07, 1 star, 0 forks | [API](https://api.github.com/repos/Manubown/Bezel) |
| About box: description | empty (`null`) | same |
| About box: website | empty (`null`) | same |
| Topics | none | same |
| Releases | none | [API](https://api.github.com/repos/Manubown/Bezel/releases) |
| Licence | MIT, detected by GitHub | [`LICENSE`](../../LICENSE) |
| Community files | README, CONTRIBUTING, LICENSE; no Code of Conduct, no issue or PR template, no SECURITY.md; score 42 % | [API](https://api.github.com/repos/Manubown/Bezel/community/profile) |
| Social preview | GitHub's default card: "Manubown/Bezel", the owner's avatar, "1 Contributor, 2 Issues, 1 Star, 0 Forks". Link text in chats: "Contribute to Manubown/Bezel development by creating an account on GitHub." | the page's `og:` tags, read with curl |
| GitHub Issues | 2 open, both about "GameTiles", a Hub that links to `github.com/Manubown/GameTiles`, which returns 404 to strangers | [#1](https://github.com/Manubown/Bezel/issues/1), [#2](https://github.com/Manubown/Bezel/issues/2) |
| The hosted app | opening the link starts a Host Session at once: no explanation, title "MobileGameConnect". A phone held sideways shows only "Turn your phone upright". | https://manubown.github.io/Bezel/, [`apps/pwa/index.html`](../../apps/pwa/index.html) |
| Share preview of the app | no `og:` tags, no description | same |
| Home-screen icon | `manifest.webmanifest` has `"icons": []` and `short_name` "MGC". Chrome's install criteria need a 192 px and a 512 px icon ([web.dev](https://web.dev/articles/install-criteria)). | [`apps/pwa/public/manifest.webmanifest`](../../apps/pwa/public/manifest.webmanifest) |
| Offline | no service worker | [`docs/guide/running-on-phones.md`](../guide/running-on-phones.md) §Installing as a PWA |
| App weight | 227 KB JavaScript, 82 KB gzipped, plus 13 KB HTML; Pages sends `Cache-Control: max-age=600` | measured with curl |

### 1.2 One product, four names

| Where | Name |
|---|---|
| Repo, Pages URL, clone command | Bezel |
| README `<h1>`, page `<title>`, glossary title, licence holder, manifest `name` | MobileGameConnect |
| Manifest `short_name` (the label under the home-screen icon) | MGC |
| Packages, Game ids | `@mgc/*`, `mgc.<slug>` |
| Trystero app id | `mobilegameconnect` ([`apps/pwa/src/main.ts`](../../apps/pwa/src/main.ts) line 17) |

Strangers asked for "the app's name". Today there is no single answer. Keep the internal `@mgc` scope and the app id: changing the app id would stop old and new builds from finding each other `[INFERENCE: Trystero rooms are keyed by app id and room code]`, and the scope is invisible to players. Change only what people see: README title, page title, manifest `name` and `short_name`, About box, social preview, landing page.

### 1.3 Score against five well-received repos

Score: 0 = missing, 1 = partly there, 2 = done well.

| # | What a visitor needs | Bezel today | Best example |
|---|---|---|---|
| 1 | One-sentence pitch at the top | 2 ("Lay a few phones next to each other on a table. They become one screen.") | PairDrop |
| 2 | A picture or GIF of the product in use, above the fold | 0 | PairDrop, LocalSend |
| 3 | "Try it now" link above the fold | 1 (a badge and step 1; no QR; leads to `master`) | Excalidraw |
| 4 | How it works, for non-developers | 1 (three steps exist; the "How it works" section is a developer diagram) | LocalSend |
| 5 | Supported devices and known limits | 0 (the hotspot limit is only in `docs/research/`) | LocalSend |
| 6 | Developer quick start | 2 | tldraw |
| 7 | Path to build your own (SDK) | 2 | tldraw, boardgame.io |
| 8 | Contribution path for outsiders | 1 (good CONTRIBUTING, but tickets live in `.scratch/`, no templates, no good-first-issues) | LocalSend |
| 9 | About box, website, topics | 0 | all five |
| 10 | Social preview image | 0 | tldraw (a custom image; Excalidraw uses GitHub's default card) |
| 11 | Code of Conduct, security policy, templates | 1 | tldraw (Code of Conduct, community score 87 %; Excalidraw 62 %, LocalSend 50 %) |
| 12 | Releases or changelog | 0 | boardgame.io |
| 13 | One consistent name | 0 | all five |
| | **Total** | **10 of 26** | |

The five reference repos (stars and contents read 2026-11-11 through the GitHub API):

| Repo | Why it is a good model | Copy this |
|---|---|---|
| [schlagmichdoch/PairDrop](https://github.com/schlagmichdoch/PairDrop) (11.8k stars) | A WebRTC PWA like ours. Logo, one line ("Local file sharing in your web browser"), live link, "Report a bug" and "Request feature" links in the first lines; a GIF of the phone UI; topics `pwa`, `webrtc`. | The GIF of real use; the bug link at the top. |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) (135k) | A cover image with a dark-mode variant (`<picture>`), then a navigation row: Editor, Blog, Documentation. Users and developers each find their door at once. | `<picture>` hero; a one-line nav row under it. |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) (51k) | An SDK with a public app on top, like ours. Hero image with a dark variant, few badges, Quick start, Starter kits, Community, License, and its own "Trademarks" section; a custom social preview. | Starter kits = our template Games; a short naming note. |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) (12.5k) | A multiplayer game framework. The README is short (about 4 KB): logo, a few badges, features, install, a link to the docs site, changelog, "get involved". | Brevity: move depth into `docs/`. |
| [localsend/localsend](https://github.com/localsend/localsend) (98k) | Local device-to-device sharing. Screenshots, "How It Works" in plain words, a Troubleshooting section in the README, and contributing split into translation and bug fixes. | A "Known limits / Troubleshooting" section; a "works on" table. |

### 1.4 What confuses a newcomer, and how to present it

| What | Why it confuses | Fix |
|---|---|---|
| `.scratch/` (99 tracked files with `docs/liveLogs/`) | The README calls it "the in-repo issue tracker", but GitHub Issues are also in use. Specs still say `Status: ready-for-agent` for Games that are finished (e.g. `.scratch/snake/spec.md`). | Keep it; moving it breaks hundreds of citations. Add `.scratch/README.md` (5 lines: "Our design notes and work logs. Bugs and ideas from outside go to GitHub Issues."). Set finished specs to `resolved`. In the README call it "design notes and work logs". |
| `AGENTS.md`, `docs/agents/` | Readers do not know these are instructions for AI coding agents. | One README line: "AGENTS.md and docs/agents/ tell AI coding agents our conventions." |
| `docs/liveLogs/` (4.8 MB) | Folder names like `Client_IPhone12/Text 2_1.txt`; several 37-byte files that only contain another file's name. | Delete the 37-byte pointer files; add a one-line `docs/liveLogs/README.md`. |
| Issues #1 and #2 | They link a 404 repo and use "Hub", a word not in `GLOSSARY.md`. | Label them `internal`, or move them into `.scratch/` until GameTiles is public. |
| README depth | The first screen after the pitch is a developer install; a Mermaid diagram and a milestone table with "TURN", "rtt", "SDP". | Move the diagram to `docs/architecture.md` and the milestones to `docs/PLAN.md`; keep five plain lines of status. |
| No version | `package.json` says `0.0.0`, no releases. | A first release when `/play/` launches (§2.7). |

## 2. GitHub polish: ordered checklist

Do it in this order. Each later step reuses the earlier ones.

### 2.1 Decide the name

Answer in one sentence: "The game is called X." Then check: an App Store and Play Store search, a domain lookup, and the [EUIPO trademark search](https://www.tmdn.org/tmview/) `[not run by us]`. Domain lookups on 2026-11-11 through [rdap.org](https://rdap.org/): `bezel.app`, `getbezel.com`, `bezelgame.com` are registered; `bezel.games`, `playbezel.com`, `bezel.party`, `bezel.fun` returned no record (likely free; confirm at a registrar). If the name changes, rename the repo **before** the landing page goes public: project site URLs are not redirected after a rename ([GitHub Docs](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)).

### 2.2 About box (Settings gear next to "About"), 10 minutes

- **Description:** `Put your phones side by side and they become one game board. Free party games in the browser, nothing to install. Open source, with an SDK for your own games.`
- **Website:** `https://manubown.github.io/Bezel/` (later the landing page).
- **Topics** (lowercase, hyphens, at most 50 characters each, at most 20: [GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)): `party-game`, `local-multiplayer`, `multiplayer-game`, `browser-game`, `mobile-game`, `pwa`, `webrtc`, `peer-to-peer`, `multi-screen`, `game-sdk`, `typescript`, `pong`, `air-hockey`, `trystero`.
- Untick **Projects** if you do not use it (fewer empty tabs; Wiki is already off). Leave **Discussions** off for now: one more inbox to watch.

### 2.3 Social preview image, 30 minutes

GitHub wants PNG, JPG or GIF under 1 MB, at least 640×320, best 1280×640 ([GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)). Make it 1280×640, solid dark background: a top-down photo of three phones in a row with the ball mid-crossing, the name, and one line ("Your phones, one game board"). Keep text inside the middle 1000 px `[INFERENCE: some apps crop the edges]`. Upload under Settings → Social preview. The same picture at 1200×630 serves as the landing page's `og:image`.

### 2.4 README: proposed outline and first screen

Outline (about 110 lines instead of 148 today):

1. Name, one-sentence pitch, demo GIF, link row (first screen, below)
2. Try it now: QR code and three steps (first screen)
3. Works on (tested phones)
4. Known limits (iPhone hotspot, no offline play, phone sizes are estimated, early project)
5. What you can play: Pong and Air Hockey, then the five experiments in one table
6. How it works, in three plain sentences; link to `docs/architecture.md` for the diagram
7. Build a Game (today's section, unchanged)
8. Develop locally (today's quick start, unchanged)
9. Contribute: GitHub Issues for bugs and ideas, good-first-issues, CONTRIBUTING, Code of Conduct; `.scratch/` and `AGENTS.md` explained in one line each
10. Status: five lines, link to `docs/PLAN.md`
11. Privacy in one paragraph: no accounts; who sees a phone's IP address (§3.8)
12. Licence and name

Draft first screen (replace `docs/media/…` with the files from §2.5; replace the name if it changes):

```markdown
<h1 align="center">Bezel</h1>

<p align="center">
  <b>Put your phones side by side. They become one game board.</b><br>
  Free party games that run across several phones at once, in the browser. Nothing to install.
</p>

<p align="center">
  <a href="https://manubown.github.io/Bezel/play/">
    <img src="docs/media/demo.gif" width="560"
         alt="Three phones lie in a row on a table. A Pong ball rolls off one screen and onto the next.">
  </a>
</p>

<p align="center">
  <a href="https://manubown.github.io/Bezel/play/"><b>Start a table</b></a> ·
  <a href="#build-a-game">Build a game</a> ·
  <a href="CONTRIBUTING.md">Contribute</a> ·
  <a href="https://github.com/Manubown/Bezel/issues/new/choose">Report a problem</a>
</p>

## Try it now

<img align="right" src="docs/media/qr-play.svg" width="140" alt="QR code that opens manubown.github.io/Bezel/play/">

1. **One phone starts a table.** Open manubown.github.io/Bezel/play on it. It shows a QR code.
2. **The other phones join.** Scan that QR code with the camera, or type the 4-letter code.
3. **Lay the phones in a row and press Start.** Try Pong first. For Air Hockey, put two phones head to head.

Every phone needs internet for the first few seconds, so the phones can find each other.
Then the game runs phone to phone.

## Works on

| Phone | Browser | Tested by us |
|---|---|---|
| iPhone | Safari | iPhone 12, iPhone 14, iPhone 15 Pro Max |
| Android | Firefox, others | Firefox 159 as Host; two more Android phones (browser not recorded) |

On an iPhone, **Share → Add to Home Screen** gives you a full-screen icon.

## Known limits

- **iPhone Personal Hotspot.** iPhones on another iPhone's hotspot often fail to connect.
  Use a Wi-Fi network, mobile data on every phone, or an Android phone's hotspot. [Why](docs/research/README.md)
- **No offline play yet.** The phones need the internet to find each other.
- **Phone sizes are estimated** from the browser, so on some phones the picture may not line up exactly across the gap.
- **Early project.** Things break. [Tell us](https://github.com/Manubown/Bezel/issues/new/choose) which phones you used.
```

The tested phones come from `.scratch/live-test-1/findings.md` line 4 and §1d. Update the table as reports come in.

Badges: keep three (the Pages build status, a "play" link, the licence). Drop "TypeScript strict" and "pnpm 10": they speak to developers and push the pitch down. Add a "good first issues" badge once such issues exist (`https://img.shields.io/github/issues/Manubown/Bezel/good%20first%20issue`).

### 2.5 Demo media: how to film phones on a table

Recording (one evening, two people):

1. Phone settings on every phone: brightness at maximum, auto-brightness off, Do Not Disturb on, the same dark wallpaper, no notches covered by cases if possible.
2. Camera straight above the table (a phone on a lamp arm or a tripod with a side arm), 1080p, 30 fps. A matte, dark table cloth. Soft light from the side or an overcast window, never a ceiling lamp straight above (it reflects in every screen).
3. Shot list, 20 seconds in total: 0–4 s a hand lays the third phone down next to two others, already in a Session; 4–14 s Pong, the ball crosses two bezels, a hand returns it; 14–20 s Air Hockey, two phones head to head, a goal. No edits inside a shot, so it is clearly real.
4. Film 10 takes; keep the best one. Get consent from anyone whose hands or face are visible.

Converting (ffmpeg, free):

```sh
# MP4 for the landing page and GitHub: H.264, no sound, starts fast
ffmpeg -i raw.mov -t 20 -vf "scale=1080:-2,fps=30" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -an -movflags +faststart demo.mp4
# GIF for the README first screen: 480 px wide, 12 fps, own palette
ffmpeg -i demo.mp4 -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 demo.gif
# QR code to the public build, using the qrcode package the app already depends on
node apps/pwa/node_modules/qrcode/bin/qrcode -t svg -o docs/media/qr-play.svg "https://manubown.github.io/Bezel/play/"
```

GitHub limits: images and GIFs up to 10 MB; videos (`.mp4`, `.mov`, `.webm`) up to 10 MB on a free plan; H.264 is recommended for compatibility ([GitHub Docs](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)). README content beyond 500 KiB is cut off ([GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)). Aim for a GIF under 3 MB: it stays in git history forever. For the MP4, drag it into an issue comment, copy the `user-attachments` URL it gets, and put that URL on its own line in the README; it then shows as a player `[INFERENCE: common practice; GitHub documents uploads for issues and PRs, not for README files]`. That keeps the video out of git.

### 2.6 Community files, about 1 hour

| File | Content | Source |
|---|---|---|
| `CODE_OF_CONDUCT.md` | Contributor Covenant 3.0 (released 2025-07-28), with your contact email filled in | [ethicalsource.dev](https://ethicalsource.dev/blog/contributor-covenant-3/), [text](https://www.contributor-covenant.org/version/3/0/code_of_conduct/) |
| `SECURITY.md` | Draft below. Also switch on Settings → Security → **Private vulnerability reporting**. | [GitHub Docs](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository) |
| `.github/ISSUE_TEMPLATE/bug.yml` | Issue form, draft below | [GitHub Docs](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository) (issue forms are "public preview") |
| `.github/ISSUE_TEMPLATE/game-idea.yml` | Fields: game name, how many phones on the table / in hand, how one round goes, why it needs several phones | same |
| `.github/ISSUE_TEMPLATE/config.yml` | `blank_issues_enabled: false`; contact link "Security problem → Security tab" | same |
| `.github/pull_request_template.md` | Three checkboxes from CONTRIBUTING: `pnpm typecheck && pnpm test` green; a Game imports `@mgc/sdk` only; "tried on: tests / browser tabs / real phones (which)" | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) |

Draft `SECURITY.md`:

```markdown
# Security

Please report security problems privately: Security tab → "Report a vulnerability".
Do not open a public issue. We are a small hobby team and answer within 7 days.

In scope: the app at manubown.github.io/Bezel and the code in this repository.

Known and by design:
- The TURN relay credentials are part of the public web app. A browser can only use a relay it has credentials for.
- Phones find each other through public Nostr relays. Anyone who knows a table's 4-letter code can join it.
```

Draft `bug.yml`:

```yaml
name: Something went wrong at the table
description: Phones did not connect, a game misbehaved, something looked wrong
labels: [bug, needs-triage]
body:
  - type: input
    id: phones
    attributes:
      label: Phones and browsers
      placeholder: "Host: iPhone 13, Safari. Others: Pixel 7 Chrome, iPhone 12 Safari"
    validations: { required: true }
  - type: dropdown
    id: network
    attributes:
      label: Network
      options: [Same Wi-Fi, iPhone hotspot, Android hotspot, Mobile data on every phone, Not sure]
    validations: { required: true }
  - type: input
    id: game
    attributes: { label: Game and arrangement, placeholder: "Pong, 3 phones in a row" }
  - type: textarea
    id: what
    attributes: { label: What happened, and what did you expect? }
    validations: { required: true }
  - type: textarea
    id: logs
    attributes:
      label: Session logs (optional, very helpful)
      description: On each phone, tap Export log and drag the files here.
```

Labels: reuse the triage words you already use ([`docs/agents/triage-labels.md`](../agents/triage-labels.md)): `needs-triage`, `needs-info`, `wontfix`, plus `bug`, `game-idea`, `good first issue`, `help wanted`. GitHub surfaces issues labelled `good first issue` to newcomers ([GitHub Docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/encouraging-helpful-contributions-to-your-project-with-labels)). Five candidates from the repo:

1. Add home-screen icons (192 and 512 px, plus `apple-touch-icon`); the manifest has none.
2. Set the manifest `name` and `short_name` and the page `<title>` to the public name.
3. Breakout: wait for a touch before the balls start (live test 1 saw balls fall while nobody held a paddle: `.scratch/live-test-1/findings.md` line 131) `[check whether it is fixed]`.
4. A new small Game from `pnpm new-game` (for example a reaction duel), with its README.
5. A "phones we tested" page that collects reports from the bug form.

### 2.7 Releases and changelog

- Add `CHANGELOG.md` in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, newest first, written for players ("Phones reconnect after a short drop").
- GitHub's automatic release notes list merged pull requests ([GitHub Docs](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)). You commit to `master` directly, so they would be empty: write the notes by hand from the changelog.
- First release `v0.1.0 "First public table"` on the commit you move `stable` to. Afterwards: tag a version each time you move `stable`. People can then "Watch → Releases" for news, with no mailing list.

## 3. The landing site

### 3.1 Current versions (checked 2026-11-11)

| Thing | Version | Source |
|---|---|---|
| Astro | 7.4.10; needs Node ≥ 22.23.4 | [npm registry](https://registry.npmjs.org/astro/latest) |
| Node 22 (what CI pins) | latest is 22.23.4, released 2026-10-20 | [nodejs.org](https://nodejs.org/dist/index.json) |
| Starlight | 0.42.10; needs Astro ≥ 7.2.10 | [npm registry](https://registry.npmjs.org/@astrojs/starlight/latest) |
| Astro's GitHub Pages guide | uses `actions/checkout@v7`, `withastro/action@v6`, `actions/deploy-pages@v5`; set `site` and `base` | [Astro Docs](https://docs.astro.build/en/guides/deploy/github/) |
| Actions in `pages.yml` today | `checkout@v4`, `pnpm/action-setup@v4`, `setup-node@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`; latest are v7.0.1, v6.1.1, v7.1.0, v5.0.0, v5.0.1 | GitHub releases API |

Astro renders components to HTML and CSS and strips client-side JavaScript unless you opt in ([Astro Docs](https://docs.astro.build/en/concepts/islands/)). That suits a landing page. Developers' laptops need Node 22.23.4 or newer; `setup-node` with `node-version: 22` should pick that up in CI `[INFERENCE]`.

### 3.2 Same repo or a separate repo

| | Same repo (`apps/site`) | Separate repo |
|---|---|---|
| URL | One Pages site, one upload: landing at `/Bezel/`, app below it | Its own site at `manubown.github.io/<other>/`; landing and app on unrelated paths |
| Deploy | One workflow; site and app always match | Two workflows that can drift |
| Content | The site can read Game names and phone counts from `games/*` | Copied by hand |
| Downside | A text fix on the site also runs the tests (minutes) | — |
| Custom domain | One domain covers both | One domain per repo; the second needs a subdomain |

**Use the same repo.** The workspace already includes `apps/*` ([`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)), so `apps/site` is picked up with no config change. GitHub Pages allows one site per repo and site size up to 1 GB ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).

### 3.3 Proposed URL layout

| URL | What it serves | Built from |
|---|---|---|
| `/Bezel/` | Landing page (Astro) | `master` |
| `/Bezel/play/` | The app for everyone; the "Start a table" button and every printed QR code go here | the `stable` tag |
| `/Bezel/next/` | The app as on `master`, for you and testers | `master` |
| `/Bezel/stable/` | A forwarding page to `/Bezel/play/`, keeping `?room=` (old links and home-screen icons keep working) | `master` |
| `/Bezel/?room=CODE` | The landing page forwards to `/Bezel/next/?room=CODE` (QR codes shown by Hosts still on the old build) | `master` |
| `/Bezel/games/`, `/developers/`, `/about/`, `/press/`, `/imprint/`, `/privacy/` | Landing pages (§3.7) | `master` |
| `/Bezel/docs/` | Later, if ever: Starlight (§3.6) | `master` |

Why it works: the Host's QR encodes the Host page's own URL ([`apps/pwa/src/hud.ts`](../../apps/pwa/src/hud.ts) lines 127–131), so Peers always land on the same build as their Host. The manifest uses `start_url: "./"` and `scope: "./"`, so an icon installed from `/play/` stays in `/play/`. There is no service worker to migrate.

The two forwarding rules, as inline scripts (Pages has no server-side redirects):

```html
<!-- apps/site/src/pages/index.astro, first thing in <head> -->
<script is:inline>
  const q = new URLSearchParams(location.search);
  if (q.has('room')) location.replace('next/' + location.search);
  else if (matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) location.replace('play/');
</script>

<!-- apps/site/src/pages/stable/index.astro -->
<script is:inline>location.replace('../play/' + location.search);</script>
```

The second line of the first script sends a home-screen icon installed from `/Bezel/` to the app instead of the landing page.

### 3.4 Workflow change

Replace the `build` job in [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml); the `deploy` job stays as it is.

```yaml
  build:
    runs-on: ubuntu-latest
    env:
      # '' with a custom domain; '/<repo>' on github.io
      SITE_BASE: /${{ github.event.repository.name }}
      VITE_MGC_TURN_SERVERS: ${{ secrets.MGC_TURN_SERVERS }}
    steps:
      - uses: actions/checkout@v4
        with: { ref: master, fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      # 1. Landing site → apps/site/dist (astro.config reads SITE_BASE as `base`)
      - run: pnpm --filter @mgc/site build
      # 2. master's app → /next/
      - run: |
          BASE_PATH="$SITE_BASE/next/" pnpm build
          mkdir -p apps/site/dist/next && cp -r apps/pwa/dist/. apps/site/dist/next/
      # 3. The stable tag's app → /play/ (no tag yet: /play/ gets master)
      - name: Build the stable tag
        run: |
          mkdir -p apps/site/dist/play
          if git rev-parse -q --verify refs/tags/stable >/dev/null; then
            git worktree add ../stable stable
            (cd ../stable && pnpm install --frozen-lockfile && BASE_PATH="$SITE_BASE/play/" pnpm build)
            cp -r ../stable/apps/pwa/dist/. apps/site/dist/play/
            git -C ../stable rev-parse --short HEAD > apps/site/dist/play/COMMIT
          else
            BASE_PATH="$SITE_BASE/play/" pnpm build && cp -r apps/pwa/dist/. apps/site/dist/play/
          fi
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/site/dist }
```

And `apps/site/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://manubown.github.io',          // the custom domain later
  base: process.env.SITE_BASE ?? '/Bezel',
  integrations: [sitemap()],
});
```

Other places that name the old URLs and must change in the same commit: `scripts/stable.mjs` (the two printed URLs), `README.md`, `CONTRIBUTING.md` §Releases, `docs/guide/running-on-phones.md` §Two hosted builds, the comment at the top of `pages.yml`. Also decide what `pnpm typecheck` does with `apps/site`: it runs `tsc -p .` in every package, and an Astro project is checked with `astro check` instead. Exclude it with `pnpm -r --filter '!@mgc/site' exec tsc -p .` `[INFERENCE: not tried]`. Optional: show the landing address in the Host's sheet instead of `…/Bezel/play` (`hud.ts` line 131) and add a "Join with a code" field on the landing page, so the typed address stays short.

Before switching: move `stable` to a commit that passed a phone run (`pnpm stable <ref>`). Otherwise `/play/` serves the 2026-11-07 build.

### 3.5 Custom domain

Cost (Porkbun's public price list, USD, read 2026-11-11 from [its pricing API](https://api.porkbun.com/api/json/v3/pricing/get); first year / each year after):

| Ending | First year | Renewal | Note |
|---|---|---|---|
| `.com` | 11.81 | 11.81 | Safest choice for print |
| `.app` | 8.75 | 14.93 | |
| `.games` | 8.24 | 30.38 | Cheap first year, expensive after |
| `.de` | 2.90 | 4.07 | |
| `.eu` | 5.88 | 5.88 | |
| `.party` | 4.61 | 5.64 | |

Compare renewal prices, not first-year prices. Any EU registrar works the same way; prices differ.

Steps ([GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)):

1. Verify the domain for your GitHub account first (protects against takeover) ([GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)).
2. Repo Settings → Pages → Custom domain → enter `www.example.com` → Save. Do this **before** the DNS records. With a custom Actions workflow no `CNAME` file is needed; GitHub ignores one.
3. At the DNS provider: `A` records for `@` to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `AAAA` records to `2606:50c0:8000::153` … `2606:50c0:8003::153`; `CNAME` `www` → `manubown.github.io` (no repo name). No wildcard records.
4. Wait up to 24 hours. GitHub gets a Let's Encrypt certificate itself; then tick **Enforce HTTPS** ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)).
5. In the workflow set `SITE_BASE: ''`; in `astro.config.mjs` set `site` to the domain.

What changes for players:

- **New origin, new storage.** The app keeps each phone's Device id and Player id in `localStorage` and its session log in IndexedDB ([`apps/pwa/src/device.ts`](../../apps/pwa/src/device.ts), [`recorder.ts`](../../apps/pwa/src/recorder.ts)). Browsers keep storage per origin ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)). After the switch every phone is a new Device and old logs stay behind: export them first.
- **Old links.** The github.io URL forwards to the custom domain ([community answer](https://github.com/orgs/community/discussions/138850); GitHub's own docs only describe apex ↔ www redirects). Home-screen icons from the old address will go through that redirect `[INFERENCE]`.
- **Side benefit.** Today the origin `manubown.github.io` is shared with any other Pages project of the same account `[INFERENCE from the same-origin rule]`. A domain gives the app its own storage.

Recommendation: decide the name, then buy the domain and switch **before** QR stickers, a press kit or a Kickstarter page carry the URL. If you do not want a domain, stay on github.io and keep the repo name forever.

### 3.6 Starlight or plain Astro

Plain Astro now. The developer guide in `docs/guide/` cites code as `path:line` and links repo files relatively (for example `../../games/pong/`); a citation checker exists (`.scratch/dev-onboarding/issues/02-developer-guide.md`). On GitHub all of that works today. In Starlight those links would break and need rewriting `[INFERENCE]`. Starlight gives search, navigation and translation out of the box ([starlight.astro.build](https://starlight.astro.build/)); it is worth it once the SDK is published to npm (issue #1) and outside developers ask for it. Until then the "For developers" page links into the guide on GitHub.

### 3.7 Site map and page content

**Home** (`/`):

1. Hero. Heading: "Put your phones side by side. They become one game board." Sub-line: "Free party games across two or more phones, right in the browser. No app, no account." Button **Start a table** → `/play/`. Next to it: "Got a code? [____] Join" → `/play/?room=CODE`. On a desktop (`@media (pointer: fine)`) show the QR code instead: "Scan with your phone to start a table."
2. The 20-second video: `<video autoplay muted loop playsinline preload="none" poster=…>`, caption "Three phones, one ball. Filmed at our table, no edits."
3. How it works, three steps with a small drawing each: "One phone starts a table" / "The others scan its QR code" / "Lay them side by side and press Start".
4. Games: Pong and Air Hockey cards; "and five experiments" link.
5. FAQ (drafts below).
6. "Follow along": GitHub Releases, the devlog's RSS feed, a newsletter form if you add one (§3.10).
7. Footer: Imprint · Privacy · Press · GitHub · contact email.

FAQ drafts:

- **Do I need an app?** No. It is a web page. Open it in Safari or Chrome. On an iPhone you can add it to the home screen for full screen: Share → Add to Home Screen.
- **Does it work offline?** Not yet. Every phone needs the internet for a few seconds to find the others. Playing without internet is planned, not built.
- **Is it free?** Yes. No ads, no account, no purchases. The code is open source (MIT licence). *(If you might charge later, write "free to play today".)*
- **How many phones?** Most games use one to four phones on the table. Quiz also uses up to four phones held in hand.
- **Which phones work?** iPhones with Safari and Android phones. The phones we tested are listed [here].
- **My iPhones will not connect on a hotspot.** Known problem with an iPhone's Personal Hotspot when the other phones are iPhones too. Use Wi-Fi, mobile data on every phone, or an Android phone's hotspot.
- **How much mobile data does it use?** On a shared Wi-Fi, the game stays on the Wi-Fi. When phones cannot reach each other directly, a relay server carries the game over mobile data. On our test evening with Pong and Air Hockey the relay carried about 6 MB in total. *(Figure from the makers' test evening; re-measure before publishing.)*
- **Do you collect my data?** No accounts. To find each other, phones use public relay servers, and those see your IP address, as any website does. Details on the Privacy page.
- **Can I make my own game?** Yes. A game is about 100 lines of TypeScript. See For developers.

**Games** (`/games/`): one card per Game, from the README table: name, one sentence, phones on the table, phones in hand, players, a 5-second muted loop (under 500 KB each) or a still. Pong ("The ball rolls across every phone in the row. 2 players, or play a bot.") and Air Hockey ("Two phones head to head. Flick the puck into the other goal.") at the top; Pass, Tap Race, Snake, Quiz and Breakout below under "Experiments", honestly labelled.

**For developers** (`/developers/`): what the platform does for a Game (lobby, roles, clock, layout, input in millimetres, pause, results); a trimmed excerpt of `games/_template/src/index.ts` (manifest, `host()`, `view()`); the four commands from the README's "Build a Game"; links to the guide on GitHub in its reading order; status: "the SDK is not on npm yet"; how to contribute.

**About and devlog** (`/about/`, `/devlog/`): who you are (first names or handles, where you are based if you like), why you built it, a timeline from the README's milestones (M0 two phones → M2 Pong across bezels → live tests). Devlog posts are Markdown files in `apps/site/src/content/devlog/` with an RSS feed (`@astrojs/rss`). Three first posts already have material in the repo: the shared clock ("a ball that arrives at the right time"), the iPhone hotspot investigation (`docs/research/`), and what the first live test taught (`.scratch/live-test-1/findings.md`).

**Press kit** (`/press/`), after the [presskit()](https://dopresskit.com/) layout used by indie games: fact sheet (name, makers, based in, first public date, platform "iPhone and Android browsers", price "free", URL, press contact); a 50-word and a 150-word description; feature bullets; the 20-second video (MP4) and the GIF; 5 photos of phones on a table, at least 1920×1080; logo as SVG and PNG on light and dark; team credits; one line on usage ("free to use in coverage of the game"). Offer everything as one ZIP under 25 MB.

**Imprint** (`/imprint/`) and **Privacy** (`/privacy/`): see §3.8. Link both from every page footer.

### 3.8 Imprint and privacy (Germany and Austria)

| Duty | Germany | Austria | When it applies to you |
|---|---|---|---|
| Name and address on the site | [MStV § 18 (1)](https://www.gesetze-bayern.de/Content/Document/MStV-18): every telemedia offer that is "not exclusively for personal or family purposes" keeps name and address easy to find and always available | [MedienG § 25](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10000719&Paragraf=25): disclosure for websites; a small site that only presents its owner needs name, line of business if any, and place of residence (§ 25 (5)) | A public project site: yes `[INFERENCE]` |
| Full imprint | [DDG § 5](https://www.gesetze-im-internet.de/ddg/__5.html): for "geschäftsmäßige, in der Regel gegen Entgelt angebotene" services: name, address, email, register and VAT numbers where they exist | [ECG § 5](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001703&Paragraf=5): name, geographic address, email and more, for services "in der Regel gegen Entgelt" (ECG § 3 Z 1) | Once you sell, show ads or take crowdfunding money `[INFERENCE]` |
| Privacy notice | [GDPR Art. 13](https://eur-lex.europa.eu/eli/reg/2016/679/oj): who processes what, why, how long, which rights | same | Site and app process IP addresses: yes |
| Storing data on the phone | [TDDDG § 25](https://www.gesetze-im-internet.de/ttdsg/__25.html): consent needed, unless strictly necessary for the service the user asked for (§ 25 (2)) | TKG 2021 § 165 `[not checked]` | The Device id in `localStorage` is probably "strictly necessary" `[INFERENCE]`; analytics cookies would not be |
| Email newsletter | [UWG § 7 (2) Nr. 2](https://www.gesetze-im-internet.de/uwg_2004/__7.html): email advertising needs prior express consent | `[not checked]` | Use double opt-in (all services in §3.10 offer it) |

What the privacy page has to name, from the code (verify before publishing):

- The site is hosted on GitHub Pages; GitHub logs every visitor's IP address "for security purposes" ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).
- When the app opens it connects to public Nostr relays run by third parties (a list built into Trystero 0.26, for example `nos.lol`; read in `node_modules/.pnpm/@trystero-p2p+nostr@0.26.0`), to Cloudflare's STUN server (`stun.cloudflare.com`, Trystero's default), and when needed to the Metered TURN relay. Each sees the phone's IP address. The other phones in the Session also see it (WebRTC).
- On the phone: Device and Player ids in `localStorage`; the session log in IndexedDB, which stays on the phone until the user exports it ([`docs/guide/running-on-phones.md`](../guide/running-on-phones.md) §The session log).
- Analytics and newsletter provider, if added; contact; the user's rights; the right to complain to a data protection authority.

Use an Impressum/Datenschutz generator or a lawyer for the final text; this table only says which rules apply. The open question is whose name and postal address goes public (§Open questions).

### 3.9 SEO and share previews

- Each page: a unique `<title>` and `<meta name="description">`, `<link rel="canonical">`, `lang="en"`.
- Open Graph: `og:title`, `og:type`, `og:image`, `og:url` are the four required properties ([ogp.me](https://ogp.me/)); add `og:description` and `twitter:card` = `summary_large_image`. Image 1200×630 PNG under 1 MB, the same picture as the GitHub social preview. GitHub's own cards are 1200×600 (seen in its `og:image:width/height`).
- The app pages (`/play/`, `/next/`) also need `og:` tags in `apps/pwa/index.html`: that is the link people send in group chats.
- Sitemap from `@astrojs/sitemap`. A `robots.txt` only works at the root of the host ([Google](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)); on github.io you do not own that root, so keep `/next/` out of search with `<meta name="robots" content="noindex">` in that build `[INFERENCE: needs a build flag in the app]`.
- English first. A German home page only if your first audience is local (open question).

### 3.10 Newsletter or waitlist without a backend

| Option | Company and data | Free tier (checked 2026-11-11) | Works from a static page | Verdict |
|---|---|---|---|---|
| **RSS + GitHub "Watch → Releases"** | No personal data collected by you | Free | Yes | **Start here.** Zero legal work. |
| [Buttondown](https://buttondown.com/pricing) | US company; says it is GDPR compliant and offers a DPA ([Buttondown](https://buttondown.com/legal/gdpr-eu-compliance)) | First 100 subscribers free | Yes, a plain HTML form posts to Buttondown | Best when you want to email before a Kickstarter launch |
| [Brevo](https://www.brevo.com/pricing/) | Brevo SAS, Paris, France ([terms](https://www.brevo.com/legal/termsofuse/)) | Free plan sends up to 300 emails a day once the account is approved | Yes, embeddable form | The EU-based choice; a large marketing suite |
| MailerLite | `[not verified: mailerlite.com did not resolve from our machine]` | Secondary sources: since 16 June 2026 the free plan covers 250 subscribers and 2,500 emails a month ([sequenzy.com](https://www.sequenzy.com/pricing/mailerlite)) | Yes | Check the official page before choosing |
| [Listmonk](https://listmonk.app/) | Self-hosted, AGPL-3.0 ([GitHub](https://github.com/knadh/listmonk)) | Software free; you pay a server, PostgreSQL and an email-sending service | No: it is a backend | Not now |

Use a plain HTML form that posts to the service, not an iframe or script embed: nothing loads from the third party until someone submits `[INFERENCE: avoids a consent banner]`. Ask for an email address only; no name.

### 3.11 Privacy-friendly analytics

You have no numbers today. Two or three counts would answer "does anyone use it?":

| Option | Cost | Data | Note |
|---|---|---|---|
| [GoatCounter](https://github.com/arp242/goatcounter) | Free hosted service, or self-hosted | Its README: "doesn't track users with unique identifiers and doesn't need a GDPR notice" (their claim) | Open source. **Recommended.** Hosting location not verified. |
| [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) | Free | "does not use any client-side state, such as cookies or localStorage" | US company |
| [Plausible](https://plausible.io/) | Starter $9 a month, 10k pageviews | Estonian company, data stored in the EU ([data policy](https://plausible.io/data-policy)) | Good, but not worth money yet |
| GitHub Insights → Traffic | Free | Repo visits only | Already there; look at it weekly |

What to count: landing page visits; clicks on "Start a table"; and, if you add one event to the app, "a Match started with N phones" (no ids, no room codes). Name the tool on the privacy page even if it sets no cookies.

### 3.12 Performance budget

| Item | Budget | Source |
|---|---|---|
| Largest Contentful Paint | ≤ 2.5 s on a mid-range phone on 4G | [web.dev](https://web.dev/articles/vitals) |
| Interaction to Next Paint | ≤ 200 ms | same |
| Cumulative Layout Shift | ≤ 0.1 (give images and the video width and height) | same |
| Home page HTML + CSS + JS | ≤ 60 KB gzipped; JS only for the forwarding and the code field | own budget |
| Hero picture | ≤ 120 KB, AVIF or WebP | own budget |
| Video | 20 s, 720p, H.264, ≤ 2.5 MB, `preload="none"` with a poster | own budget |
| Fonts | System fonts, no web font | own budget |
| Third-party requests on load | One at most (the analytics script) | own budget |
| The app (`/play/`) | Today 82 KB gzipped JS (measured); keep it under 150 KB | own budget |

Pages sends `Cache-Control: max-age=600` and you cannot change headers there. Astro and Vite give built files hashed names, so that is fine.

## 4. Effort

Sizes: **S** = under an hour, **M** = one evening (2–4 h), **L** = several evenings.

| # | Work | Size | Needs |
|---|---|---|---|
| 1 | Decide the public name; search stores, domains, EUIPO | S | — |
| 2 | About box, website, topics; untick Projects | S | 1 |
| 3 | Record and convert the 20-second demo; QR code | M | phones, a second person |
| 4 | Social preview image | S | 3 |
| 5 | README first screen and new outline | M | 1, 3 |
| 6 | CODE_OF_CONDUCT, SECURITY.md, private vulnerability reporting, issue forms, PR template | S | — |
| 7 | Labels; 5 good first issues; deal with issues #1 and #2 | S | 6 |
| 8 | `.scratch/README.md`, tidy `docs/liveLogs/`, set finished specs to `resolved` | S | — |
| 9 | App: icons, `name`/`short_name`/`<title>`, `og:` tags | S | 1 |
| 10 | Phone run, then move `stable`; `CHANGELOG.md`; release v0.1.0 | M | a good phone run |
| 11 | `apps/site` skeleton, workflow change, forwarding pages, URL updates in docs and `stable.mjs` | M | 10 |
| 12 | Home page with FAQ and video | M | 3, 11 |
| 13 | Imprint and privacy pages | M (L with a lawyer) | who is named |
| 14 | Games and For developers pages | M | 11 |
| 15 | GoatCounter on the site, optionally one app event | S | 13 |
| 16 | Press kit page and ZIP | M | 3 |
| 17 | Devlog with RSS, first post | S, then ongoing | 11 |
| 18 | Custom domain | S, plus 24 h waiting | 1; before anything is printed |
| 19 | Newsletter form | S | only when you have something to announce |
| 20 | Starlight docs | L | SDK on npm, outside developers |

**One evening (about 3 hours):** items 1, 2, 6, 7 and 8, plus item 5 using a phone video of today's Pong as a stand-in GIF. Result: a front page you can link in a post without embarrassment. The proper demo (3) and the landing site (11–14) follow over the next two or three evenings.

**Not yet, and why:** Starlight (the guide works on GitHub; a migration breaks its citations); Discussions (one more inbox for a 1-star repo); Listmonk (needs a server); paid analytics (nothing to measure yet); a separate site repo (two deploys, two URLs); full German translation (doubles every page while the content still changes); a Kickstarter page before the landing page and the demo exist (it would link to nothing).

## Open questions for the makers

1. What is the public name? Are you fine with "Bezel" next to "Bezel • Phone Mirror" in the App Store?
2. Whose name and postal address go in the imprint, and in which country do you live? That decides German or Austrian rules. Is a private home address acceptable to you?
3. Will the game stay free? The FAQ and the press kit say "free".
4. Custom domain: yes or no? If yes, before anything is printed.
5. Should strangers get the `stable` build? Then `stable` must move after every good phone run.
6. Do you want email addresses now, or RSS and GitHub Releases until a Kickstarter date exists?
7. English only, or a German home page for your first players?
8. Will GameTiles become public? If not, issues #1 and #2 should leave the public tracker.
9. Is it fine that strangers use your Metered relay account? Its credentials are public in the app.
10. Who appears in the demo video, and have they agreed?
