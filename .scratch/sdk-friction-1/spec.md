# SDK friction, round 1 — what five Games taught us

Status: ready-for-human (Part A done in issues/01; Part B needs decisions)
Created: 2026-11-07
Sources: `.scratch/{tap-race,snake,quiz,air-hockey,breakout}/friction.md`, `.scratch/dev-onboarding/issues/01-*.md` (Friction noted), DevGuide's findings in `.scratch/dev-onboarding/issues/02-*.md`.

## Problem Statement

Five Games built in parallel on `@mgc/sdk` by developers who had only the code and `docs/sdk-design.md` produced ~70 friction entries. Deduplicated and ranked below. Part A is clear-cut (a bug, a one-line API gap, a doc sentence) and is fixed in this round (ticket 01). Part B needs a design decision and is left for triage with the proposal each log converged on.

## Part A — fixed in this round (ticket 01)

### Bugs
| # | Where | What | Fix |
|---|---|---|---|
| A1 | `packages/sdk/src/game-side.ts:66-71,155-158` | `publish(s)` posts the caller's object; frames wait in the outbox until the handler returns, so a mutation after `publish` in the same handler is what gets sent (Tap Race, probe-verified). Same would hold over `postMessage`. | `publish` snapshots at the call (`structuredClone`). |
| A2 | `packages/sdk/src/headless.ts:44-88` | The recording canvas keeps every call forever: a long test (Breakout, 175 s of play × 4 views) runs out of heap. | `ops` is cleared at each frame's `clearRect`; last frame only. |
| A3 | `games/pass/src/index.ts:84-91` | `onPause` fires again when the reason changes; `pausedAt = ctx.now()` records the second call and under-shifts `turnEndsAt`. | `pausedAt ??= ctx.now()`, reset on resume. |
| A4 | `packages/sdk/src/headless.ts:119-122` | `append(a, b, c)` silently keeps `a` only (Quiz). | Variadic `append`. |

### Small API gaps every log asked for
| # | Add | Why |
|---|---|---|
| A5 | `ViewContext.pxPerMm` | A Controller's DOM view cannot size in platform mm (CSS `mm` is 1.7× off on Android); the value is already in the view's `init` frame. (Quiz) |
| A6 | `Vec2`/`Rect` as `type` aliases | `interface`s are not `JsonValue`, so the SDK's own point type cannot appear in a state; the TS error does not say why. (Air Hockey, Quiz) |
| A7 | `TestMatch.drawn(deviceId)` | Three Games each wrote a `Reflect.get(f.ctx, 'ops')` wrapper to assert what a view drew. Returns the last frame's recorded calls. (Tap Race, Air Hockey, Breakout) |
| A8 | `TestMatch.send(deviceId, msg)` | A Controller test cannot send a message without wrapping the view. (Quiz) |

### Doc sentences that were missing (in the TSDoc, which `api.md` mirrors)
| # | Where | Sentence |
|---|---|---|
| A9 | `MatchResult` | `ranking[0]` is named the winner on the result card; omit `ranking` for a draw (the card then sorts by `scores`, "Draw" on equal top scores, "Match over" with neither). |
| A10 | `HostContext.end` | Views close at once: a final state published with `end` is never drawn; delay `end` with a timer for a closing frame. |
| A11 | `Frame.ctx` | Saved before `draw` and restored after: transforms and styles do not carry over. |
| A12 | `HostHandlers.onResume` | Retained states are re-posted on resume by the platform; re-publish only if the pause itself changes the state. |
| A13 | `HostHandlers.onMessage` | `msg` is unchecked JSON from a view; validate it. |
| A14 | `Input` | On a Tile an input identifies the Device, never a finger or a Player; a Game that needs per-Player input on a shared surface gives each Player a region or a Controller. |
| A15 | `Tile` | `x, y` is the screen's top-left corner, `w, h` the screen's own size; with `rot ≠ 0` this is not the world rectangle the screen covers. |
| A16 | `ViewContext.latest` | The last state of either kind (broadcast or targeted to this Device); a view that needs both keeps its own in `onState`. |
| A17 | `HostContext.publish` | The state is copied at the call. |
| A18 | `TestMatch.tick` | Views draw in the same frame batch as the host step, possibly before its publish lands: read drawing after one more frame. Four Devices run at ~6–12× real time; set a test timeout for long Matches. |
| A19 | `TestMatch.input` | Takes a world point and does not check it lies on the Device's screen. |
| A20 | `HostContext.timer` | A chain of timers drifts by the handover latency (one animation frame in tests). |
| A25 | `docs/guide/testing.md`, troubleshooting | A hand-built `MatchInfo.tickHz` silently overrides the manifest's (Snake); a ticking Game under `tickHz: 0` never ticks. |

### PWA papercuts
| # | Where | Fix |
|---|---|---|
| A21 | `apps/pwa/index.html:55` `.seg` | Seven Games wrap into two cramped lines: the Game row scrolls horizontally. |
| A22 | `apps/pwa/src/hud.ts:202` | The default Game is alphabetical since discovery; the Host's last pick is remembered in `sessionStorage`. |
| A23 | `games/_template/README.md`, `scripts/new-game.mjs` | The copied README still describes the template and names `test/template.test.ts`: the script writes a stub README for the new Game. |
| A24 | `games/_template/src/index.ts` | The template Game is called "Tap", a prefix of the tutorial's "Tap Race": renamed "Taps". |

## Part B — needs a decision (ready-for-human)

| # | Gap | Evidence | Proposal from the logs |
|---|---|---|---|
| B1 (✅ `Manifest.seats`: `'ends'` / `'tiles'` (Tap Race, Breakout) / `'controllers'` (Quiz)) | **Who is a Player.** The lobby seats two Players, at the first and last Tile (`lobby.ts:9-10`). Controllers are never Players; middle Tiles and every Tile of a grid's first row seat nobody. | Quiz is single-player in every lobby Match; Tap Race's middle phones are dead ground; in a 2×2 Breakout grid Player 1 never gets a paddle and one phone seats nobody; Pass can never have 3–4 Players. | `Manifest.seats: 'ends' \| 'tiles' \| 'controllers'` (default `'ends'` = today). `'tiles'`: a Player per Tile in Tile order; `'controllers'`: a Player per Controller (its Device already reports a Player id), and the platform sets each Controller's own Player as its first Holder. Bots fill empty slots as today. |
| B2 | **Rotated Tiles.** No template or HUD control produces `rot ≠ 0` (`templates.ts`). | Air Hockey's premise (phones turned toward their Players) was testable only headless; `Surface` handled it transparently once hand-built. | A "turn 180°" chip per roster row; `buildLayout` places the turned Tile's origin at its far corner. Later: ±90°. |
| B3 | **The Host's HUD bar covers the bottom 15–21 mm of the Host's Tile** during a Match and takes taps (`hud.ts:263-289`). | Tap Race lost a tap to it; Breakout's paddle sits under it on a bottom-row Host; Quiz and Air Hockey measured it. | Collapse to a corner pill while a Match runs, or report `ViewContext.insetMm` and shrink the Host's Tile in the Layout. |
| B4 | **A Peer that reloads mid-Match gets no retained state** until the next publish (`match.ts:143-148,449-466`; replay happens on resume only). | Breakout's change-only wall stayed blank for 10 s after a reload; Breakout now sends a 1 s keyframe. | A `hello` NetUp frame from a Peer runtime at start; the Host answers with `holders` + `retainedFor(d)` + the pause. Or `HostHandlers.onViewReady(deviceId)`. |
| B5 | **"Everyone ready" is reinvented per Game.** The Match starts on the Host's tap while Peers still look at the HUD. | Pong and Air Hockey each wrote a touch-to-start gate; Tap Race's countdown is one too. | A platform "touch to start" overlay that holds `tick` until every seated human touched once, or a documented pattern. |
| B6 | **Private state has no own type or own slot.** `publish(s, to)` shares `S`; `latest()` is the last of either. | Quiz: a `kind` union and an `onState` filter. | `defineGame<S, M, P = S>` with `publish(p: P, to)`, `ViewContext.own()`/`Frame.own`. |
| B7 | **Pause bookkeeping.** `onPause` can fire twice; `onResume(now)` does not say how long the pause was. | Pass had the bug; Tap Race's ring is off after a pause; Quiz shifts deadlines by hand. | `onResume(now, pausedMs)`, or `ctx.playTime()` that stops while paused. |
| B8 | **Grid with three phones leaves a hole in `bounds`.** (`templates.ts:33-57`) | Breakout's ball spent 24 % of a run where no phone shows it. | Centre the last row, or refuse `grid` for 3; export `coveredBy(point, tiles)`. |
| B9 | **Shared helpers every Game copies:** mulberry32, "sides from seats", `fold`/`clamp`, Tile↔world point mapping, a Tile's world AABB. | Pong, Air Hockey, Tap Race, Snake, Breakout each carry copies; the "imports `@mgc/sdk` only" rule forbids a shared package. | `@mgc/sdk` exports `random(seed)`, `sidesOf(match)`, `tileBox(tile)`, `tileToWorld`/`worldToTile`. |
| B10 | **Team results.** `MatchResult` cannot say "you all won/lost". | Breakout's cleared wall reads "Player 1 wins". | `MatchResult.outcome?: 'won' \| 'lost'` + `detail?: string`. |
| B11 | **Wire precision.** Half of every state is 17-digit doubles. | Breakout: −43 % at 0.1 mm. | A guide sentence now; `publish(s, { round })` later. |
| B12 | **Test helpers still missing:** `t.press(deviceId, predicate)` (hit-testing a DOM view: `t.input` always hits the last element appended), `t.inputPx`, `t.published()` log, `settle()`. | Quiz, Air Hockey, Breakout. | Add in the next test-harness round. |
| B13 | **Dev tooling.** Every Game is bundled into the PWA, so any Game's edit full-reloads every open tab (sibling smokes died); a chatty `ctx.log` evicts faults from the 50-line HUD log; a previous result card blocks Start; three desktop Peers all read "Windows". | All five smokes. | `import.meta.hot.accept` in `games.ts` or `?games=<slug>` filter; faults outside the ring; dismiss the card on sheet use; name Peers by position. |
| B15 | **Wire envelope.** Every state frame carries ~235 B of transport envelope on top of the state (Snake measured 488 B on the wire for a 253 B state); the design doc's upload formula omits it. | Snake, Breakout. | Measure where it comes from (`packages/core` channel framing, Trystero) and trim; put the real formula in the doc (done in §2). |
| B16 | **Rotated-Tile ergonomics.** Text drawn in world mm reads sideways on a rotated Tile; host code has no "is this point on that Tile" / local↔world helper; a rotated test needs the whole `MatchInfo` incl. `bounds` by hand. | Snake, Air Hockey, Tap Race. | Part of B9's helper set: `tileBox`, `tileToWorld`/`worldToTile`, `Frame.local(tile)`, and a `matchFromTiles` test helper exported from `@mgc/sdk/test`. |
| B17 | **Every bot is named "Bot".** Two bots in one Match are indistinguishable on the card and on screen. | Snake. | `Bot 1` / `Bot 2` by slot in `apps/pwa/src/lobby.ts` (`BOT_NAME`). |
| B14 | **Platform gaps DevGuide found in the code:** a phone's size is measured once at load (no resize/rotation); no wake lock in the lobby or before the first touch. | `apps/pwa/src/device.ts`, `wake.ts`. | Resize on `visualViewport` change; lobby wake lock. |

## Out of Scope

M3 (iframe bundles). Visual design.
