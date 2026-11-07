# 01: Round-1 fixes: the clear-cut part of five friction logs

**What to build:** Part A of `.scratch/sdk-friction-1/spec.md`: one SDK bug, three harness fixes, four small API additions, the missing TSDoc sentences, three PWA papercuts, and the guide pages that mirror them.

**Status:** resolved

- [x] A1 `publish` copies the state at the call (`packages/sdk/src/game-side.ts`); regression test in `packages/sdk/test/game-seam.test.ts` ("sends a publish as the state was at the call"), red without the fix (`{ n: -1, list: [1, -1] }`), green with it
- [x] A2 recording canvas keeps one frame (`clearRect` resets `ops`); A4 `append(...nodes)` (`packages/sdk/src/headless.ts`)
- [x] A3 Pass `pausedAt ??=` (`games/pass/src/index.ts`)
- [x] A5 `ViewContext.pxPerMm`; A6 `Vec2`/`Rect`/`Tile` as type aliases (`packages/layout/src/types.ts`, `packages/sdk/src/types.ts`)
- [x] A7 `TestMatch.drawn(deviceId)`; A8 `TestMatch.send(deviceId, msg)`; `CanvasOp` exported from `@mgc/sdk/test`
- [x] A9–A20 TSDoc in `packages/sdk/src/game.ts`, `types.ts`, `testing.ts`
- [x] A21 Game row scrolls (`apps/pwa/index.html`); A22 last picked Game remembered per tab (`apps/pwa/src/hud.ts`, `sessionStorage` `mgc.game`)
- [x] A23 `pnpm new-game` writes the new Game a README; A24 template Game renamed "Taps"
- [x] Guide: `api.md`, `testing.md`, `troubleshooting.md` (+13 entries from the logs), `your-first-game.md` (the tutorial, from the finished Tap Race); `docs/sdk-design.md` §1/§2 updated
- [x] `pnpm typecheck` clean (9 packages); `pnpm test` 20 files / 139 tests

## Comments

### 2026-11-07

**Not done here, by design:** everything in Part B (seating model, rotation UI, HUD bar, rejoin replay, ready gate, private-state typing, pause bookkeeping, 3-phone grid, shared helpers, team results, wire precision, remaining test helpers, dev tooling, wire envelope). Each needs a decision on the API or the product; the spec carries the proposal the logs converged on.
