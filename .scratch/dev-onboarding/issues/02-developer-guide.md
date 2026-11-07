# 02: `docs/guide/`: the developer wiki, and `docs/sdk-design.md` brought back in line with the code

**What to build:** The pages a developer reads to build, test, run and debug a Game, and the fixes to the design document where it no longer matches the code.

Per `.scratch/dev-onboarding/spec.md` §2.

**Blocked by:** 01 (Rails); the tutorial item also by `games/tap-race`

**Status:** ready-for-agent (every item but the tutorial is done; the tutorial waits for the finished `games/tap-race`)

- [x] `docs/guide/README.md` (index + reading order)
- [x] `docs/guide/getting-started.md`: clone, install, dev server, open on a phone, join, start Pong
- [x] `docs/guide/your-first-game.md`: tutorial that builds `games/tap-race` from `pnpm new-game` — **left open:** the page is a one-paragraph stub that says it will be written from the finished `games/tap-race` and points at `games/_template`
- [x] `docs/guide/concepts.md`: Session/Device/Tile/Controller/Player/Holder, world mm, the state stream, pause, timers, faults; links to GLOSSARY and ADRs
- [x] `docs/guide/testing.md`: `createTestMatch`, scripting fingers, asserting states/events/results, headless screen limits
- [x] `docs/guide/running-on-phones.md`: HTTPS cert, LAN, QR/code join, templates, Tile order, bots, installing as PWA
- [x] `docs/guide/troubleshooting.md`: one entry per known symptom with cause and fix
- [x] `docs/guide/api.md`: every exported type and function of `@mgc/sdk` and `@mgc/sdk/test`, from the code
- [x] `docs/sdk-design.md`: remove `iframeLink` from §3 or mark it M3; §6 pwa call site matches `apps/pwa/src/main.ts`; Pong sketch constants match `games/pong`; §8 "mount-less" headless row corrected
- [x] README.md points at `docs/guide/`

## Comments

### 2026-11-07

**Changed**
- `docs/guide/` (new):
  - `README.md`: reading order and what each page is for; links to GLOSSARY, ADRs, `sdk-design.md`, the template and the reference Games.
  - `getting-started.md`: prerequisites (Node 22 from CI, pnpm pinned in `package.json`), clone → install → test/typecheck → `pnpm dev` → Host by LAN address (the QR encodes the Host page's own URL, so not `localhost`) → join by QR, code field or `/?room=CODE` → start Pong (pick it: the Game row is alphabetical) → `pnpm new-game` + `pnpm install --no-frozen-lockfile` + per-package test/typecheck; where the Game shows up (`apps/pwa/src/games.ts`).
  - `your-first-game.md`: stub (see the open item).
  - `concepts.md`: the two factories; who is who; seats and bots (two slots, `lobby.ts:9-10`); World, Tiles, `rot` and the Surface, with a world-box table per rotation and upright text on a rotated Tile (as `scene.ts` does); units; the state stream (one call = one frame, JSON only, stamping, one latest state per view, first publish, extrapolation, seed); ticking vs event-driven; input; Holders; timers; pause/resume table; ending; the fault ladder with the constants (`match.ts:78-85`, `game-side.ts:18`).
  - `testing.md`: the template's test as the worked example; `createTestMatch` options and members; scripting fingers (Pong's `finger`); asserting states, results, no faults, host logs, pause; hand-building a `MatchInfo` the way the lobby does, with Controllers (Pass) and a rotated pair (180°); the imports-only test; the headless screen's can/cannot table.
  - `running-on-phones.md`: HTTPS/cert, LAN + internet for Nostr signaling, join paths, the Peer strip's states, every Host-sheet control, templates, Tile order/seats/bots, the `pxPerMm` table (`device.ts:73-83`), size measured once at load (iOS toolbars, rotation), wake lock from first touch, losing a phone (10–13 s), what a Peer sees, PWA install (no service worker), several tabs on one computer.
  - `troubleshooting.md`: 22 symptoms → cause → fix, every lobby refusal quoted from `lobby.ts:339-364` plus `:236`, every `set-holder`/`publish`/`end` refusal, the fault-ladder details, the dev server's full reload on any Game edit (reported from the Quiz smoke), and three test-only entries.
  - `api.md`: every export of `@mgc/sdk` (Game-facing; platform-facing: `runMatch`, `MatchOptions`/`MatchHandle`/`MatchEvent`, `inProcessLink`, `HolderEntry`, `RawInput`, the wire types) and `@mgc/sdk/test`, signatures copied from `types.ts`, `game.ts`, `match.ts`, `in-process.ts`, `wire.ts`, `testing.ts`, `@mgc/layout`'s `Surface`.
- `docs/sdk-design.md`:
  - §3: `iframeLink` commented out as "M3, not implemented: `@mgc/sdk` does not export it yet".
  - §6: Pong sketch constants are `PONG`'s (`R = 3.5`, `PAD = { w: 4, h: 30, inset: 6 }`, `SPEED = 150`, `WIN = 7`; `BOT` already matched); the note under it no longer says "phone-sized geometry" and names `serveWait`/`speedUp`/`maxSpeed`. The pwa call site is `main.ts`'s: `GAMES` from `./games`, `inProcessLink(() => Promise.resolve({ default: game }))`, `mount: gameLayer`, `session.send(MATCH_CHANNEL, frame, session.role === 'host' ? to : host())`, `authority: session.role === 'host'`, the `deliver` guard, `pauseOnDeviceLoss` on the Host. The "`GAMES = [pong, pass]` in `main.ts`" paragraph now describes `games.ts` discovery and its two throws.
  - §8: the link row says "an iframe adapter (M3, not implemented)"; the DOM row says tests mount on `headlessScreen().mount` and `runMatch` throws without a mount in a window. One extra correction found while verifying: the prerequisites line named `session.sendTo(channel, data, deviceId)`, which does not exist; it is `session.send(channel, data, to?)` (`packages/core/src/session.ts:45`).
- `README.md`: a "Developers" line linking `docs/guide/README.md`.

**Verified**
- Every rule in the guide was read off the source it cites (or off `sdk-design.md` after checking that against the source). A script over `docs/guide/*.md`, `docs/sdk-design.md` and `README.md` resolved all 142 backticked file citations and checked every `:line` range is inside its file; every relative link and `#anchor` in the guide resolves.
- No code changed, so no test or typecheck run.

**Deviations**
- `pxPerMm` is cited as `apps/pwa/src/device.ts:73-83` (the function and its comment), not 70-85.
- Status stays `ready-for-agent` because the tutorial item is open.

**Found while writing (for the owners; not changed here)**
- `scripts/new-game.mjs:51` still prints `pnpm install`; the guide says `pnpm install --no-frozen-lockfile`. Its line 12 default name drops the dashes (`tap-race` → "TapRace").
- `docs/platform-design.md:108` still says `main.ts` keeps `GAMES = [pong, pass]`.
- `README.md` still says "Status: M0" and its Layout section lists neither `packages/sdk`, `packages/layout` nor `games/`.
- Test helpers: `createTestMatch` exposes neither the canvases nor `setHidden`, so a Game cannot assert what it drew or test a hidden page; the headless pointer hits the last-appended element whatever `at` says (a view with several buttons cannot be pressed one by one); headless elements lack `appendChild`/`setAttribute`/`classList`, and events lack `preventDefault`, which throws out of `t.input`. Every Game test hand-writes the same `MatchInfo` (no builder), and `Surface`'s `DeviceRect` argument type is not exported by `@mgc/sdk`.
- Platform: the lobby seats at most two Players although manifests declare more (Pass: 1–4); a Device's size is measured once at page load (`main.ts:47`), so a rotated phone or a changed iOS toolbar leaves a stale Tile; no wake lock in the lobby or before a Match's first touch; a view's `latest()` mixes broadcast and targeted states.
