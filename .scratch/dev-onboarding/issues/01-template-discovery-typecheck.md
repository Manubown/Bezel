# 01: Rails: `games/_template`, `pnpm new-game`, Game discovery, whole-workspace typecheck

**What to build:** The starter Game, the script that copies it, the PWA's automatic Game list, and a `typecheck` that covers every package.

Per `.scratch/dev-onboarding/spec.md` §1 and the Implementation Decisions.

**Status:** resolved

- [x] `games/_template`: `package.json` (`@mgc/game-template`), `tsconfig.json`, `README.md`, `src/index.ts` (manifest, host, view, under 100 lines, every hook commented), `test/template.test.ts` over `createTestMatch`
- [x] `scripts/new-game.mjs` + root script `new-game`
- [x] `apps/pwa/src/games.ts` with `import.meta.glob`; `main.ts` imports `GAMES` from it; `apps/pwa/package.json` drops `@mgc/pong`/`@mgc/pass`
- [x] root `typecheck` = `pnpm -r exec tsc -p .`
- [x] Typecheck and suite green; the HUD lists Pong, Pass and the template-derived Games

## Comments

### 2026-11-07

**Changed**
- `games/_template`: "Tap" (event-driven, `tickHz: 0`): taps count for the Player seated at the tapped Tile, a ring marks the last tap, first to `TEMPLATE.tapsToWin` ends with scores + ranking. 96 lines, every hook commented. Test pins "imports `@mgc/sdk` only" and one play-through.
- `scripts/new-game.mjs`: copies the template, rewrites package name / manifest id+name / `Template*` identifiers / `TEMPLATE`, renames the test. `pnpm new-game <slug> "<Name>"`.
- `apps/pwa/src/games.ts`: `import.meta.glob(['../../../games/*/src/index.ts', '!../../../games/_template/**'], { eager: true, import: 'default' })`, sorted by name, duplicate-id guard. `main.ts` drops the static imports; `apps/pwa/package.json` no longer depends on Game packages (each Game resolves `@mgc/sdk` through its own `workspace:*`).
- root `typecheck`: `pnpm -r exec tsc -p .` (9 packages); `new-game` script.
- Scaffolded `games/{tap-race,snake,quiz,air-hockey,breakout}` from the template (each starts as a renamed copy; see `.scratch/<slug>/spec.md`).

**Verified**
- `pnpm typecheck` clean (9 packages). `pnpm test`: 20 files, 97 tests (template + 5 copies added 12).
- Dev server on 5180, headless Chromium 420×860: the HUD's Game row reads Air Hockey · Breakout · Pass · Pong · Quiz · Snake · Tap Race; Template absent; no page errors.

**Friction noted**
- `pnpm install` refused the lockfile change (`specifiers in the lockfile don't match`) until `--no-frozen-lockfile`: a developer's first `pnpm new-game` + `pnpm install` will hit this if `CI` is set. → troubleshooting.
- Seven Games wrap the HUD's Game row into two cramped lines; the default pick is now alphabetical ("Air Hockey"), it was Pong.
