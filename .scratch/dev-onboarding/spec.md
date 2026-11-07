# Developer onboarding — the first games, and the path other developers walk

Status: ready-for-agent
Created: 2026-11-07

## Problem Statement

M2 and seats-and-bots ship a working `@mgc/sdk` with two reference Games, but a developer who wants to write a third has no starter, has to edit `apps/pwa` in three places and the root `typecheck` script, and has one 46 KB design document to learn from. Nothing says what goes wrong on phones (self-signed cert, signaling needs internet, iOS toolbar, 10–13 s leave detection, `pxPerMm` is a guess) or how to test without them. The SDK has been exercised by one tick-driven Tile game and one event-driven Controller game only; rotated Tiles, grid layouts, several Controllers, DOM views with many messages, large state, and fan-out to many Tiles are unproven.

## Solution

1. **Rails.** `games/_template` is the smallest complete Game (manifest, host, view, test, README); `pnpm new-game <slug> "<Name>"` copies it. The PWA discovers every `games/*` package through `import.meta.glob`, so a Game is in the Host's list the moment its folder exists. `pnpm typecheck` covers every workspace package without a hand-kept list.
2. **Docs.** `docs/guide/` is the developer-facing wiki, versioned with the code: getting started, your first Game (tutorial), concepts, testing without phones, running on phones, troubleshooting, API reference. `docs/sdk-design.md` stays the contract; its divergences from the code (`iframeLink`, the pwa call-site sketch, Pong constants, the "mount-less" headless path) are fixed.
3. **Five Games**, each chosen for a distinct SDK path, each with a friction log at `.scratch/<slug>/friction.md` recording every SDK, platform, doc or tooling problem met while building it:
   - `tap-race`: Tiles only, event-driven host, timers, bots. The tutorial Game.
   - `snake`: tick-driven continuous world over 1–4 Tiles in any template, including rotated Tiles.
   - `quiz`: one Tile as the board, 1–4 Controllers with private DOM views; messages, `mount`, Holders.
   - `air-hockey`: two Tiles facing each other (rotated 180°), 2D paddles, prediction under rotation.
   - `breakout`: grid template, shared bricks over many Tiles; large state and fan-out.
4. **Consolidation.** Friction logs become SDK fixes, troubleshooting entries, and guide corrections; M3 (iframe bundles) follows with these Games as its "no source change" fixture.

## Implementation Decisions

- Rails and Games are in-process (`inProcessLink`), as M2 left them; M3 is explicitly after.
- Discovery: `apps/pwa/src/games.ts` exports `GAMES: Game[]` from `import.meta.glob('../../../games/*/src/index.ts', { eager: true, import: 'default' })` minus `_template`; sorted by manifest `name`. `apps/pwa/package.json` lists no Game packages; each Game resolves `@mgc/sdk` through its own `workspace:*` dependency.
- `pnpm typecheck` = `pnpm -r exec tsc -p .` (every workspace package has a `tsconfig.json`).
- `scripts/new-game.mjs`: copies `games/_template` to `games/<slug>`, rewrites the package name, manifest `id`/`name`, and identifiers; prints the next steps (`pnpm install`, `pnpm test`, `pnpm dev`).
- A Game's friction log is the artefact the SDK work is derived from: one entry per problem, with the file:line, what the developer expected, what happened, and the workaround used.
- Game ids are `mgc.<slug>`; package names `@mgc/<slug>`; every Game imports `@mgc/sdk` only (pinned by its own test, as Pong and Pass do).

## Testing Decisions

- `games/_template/test` runs in the suite: the template is a working Game at all times.
- `pnpm typecheck` and `pnpm test` green with every Game present; the HUD lists every Game.
- Each Game: `createTestMatch` tests for its rules and its SDK path; a browser smoke over the dev server with the tab count its manifest needs.

## Out of Scope

M3 bundles; a Game store or remote loading; `pxPerMm` calibration (logged as friction, not fixed here); design/visual direction (`/impeccable` is a separate effort).
