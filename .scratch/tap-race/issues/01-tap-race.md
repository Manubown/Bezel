# 01: Tap Race: the tutorial Game

**What to build:** Tap Race per `.scratch/tap-race/spec.md`: a 3-2-1 countdown on a `timer`, then `TAP_RACE.rounds` targets one at a time, each after a seeded random wait, on a Tile that seats a human Player (any Tile when only bots play); the first tap in the ring scores for the Player seated at the tapped Tile; a bot Player taps after a seeded reaction time or misses; after the last target the result ranks by score. Canvas views: the ring with a shrinking inner ring, the scores along each Tile's top, the countdown digits, "<name> wins". `ctx.log` the hits. `src/index.ts` under 150 lines, commented as the tutorial.

**Blocked by:** none

**Status:** resolved

- [x] Manifest `tiles {1,4}`, `controllers {0,0}`, `players {1,4}`, `bots: true`, `tickHz: 0`; imports only `@mgc/sdk` (test pins both)
- [x] Test: the countdown runs on the timer (3 → 2 → 1 → play, one `countMs` apart) and every Tile draws the digit
- [x] Test (3-Tile row, Ann at `d0`, Bo at `d2`): the first target is on `d0` or `d2`, never `d1`, wholly on its Tile and clear of the bands
- [x] Test: a tap inside the ring on the target's Tile scores for the Player seated there and the next target follows within `spawnMs`; the same world point through the other seated Tile, through the middle Tile, and a tap just outside the ring score nothing
- [x] Test: after `rounds` targets every Tile shows "<name> wins", then the result ranks by score
- [x] Test: a bot in slot 1 scores on its own within its reaction time, misses some (seed 1: 3 hits, 3 misses of 6), and loses a target Ann taps first
- [x] Test: a pause freezes the spawn timer (the first target appears exactly the paused time later)
- [x] `src/index.ts` 148 lines; each SDK hook commented where first used
- [x] Smoke (two tabs, Host + Peer): targets reachable and tapped on the right tab, the score visible on both, a result card on both
- [x] Smoke (one tab with a bot): plays to the end by itself and shows the result card
- [x] `pnpm exec tsc -p games/tap-race` clean; `pnpm vitest run games/tap-race` green

## Comments

### 2026-11-07

**Changed**
- `games/tap-race/src/index.ts` (148 lines; was the template copy):
  - `TAP_RACE`: `target` 9 mm radius, `rounds` 7, `count` 3 × `countMs` 1000, `spawnMs` 600–2000, `lifeMs` 2500, `bot { reactMs 400–1200, miss 0.3 }`, `resultMs` 3000, `edge` 12, `band` 15.
  - `TapRaceState` as in the spec: `phase`, `count?`, `target? { x, y, deviceId, since }`, `scores`, `round` (targets shown, faded ones included), `lastHit?`. `TapRaceMessage = never`.
  - Host, event-driven. Timers: `count` (re-armed per digit), `spawn`, `expire`, `bot:<playerId>` and `end`. `next(hit?)` scores a hit (`lastHit`, `scores`, `ctx.log("<name> scored (n)")`), clears the target, cancels `expire` and every bot timer (`null`), and arms the next `spawn` or, after the last target, sets `done` and arms `end`. A `spawn` places the target on a random Tile of `spots` (Tiles seating a human, or every Tile with bots alone), arms `expire` and, per bot, `bot:<id>` after `reactMs` unless it misses (drawn per target). Seats come from `Player.deviceId` (a `Map` of Device → Player). `onInput` scores a `down` only on the target's own Tile, only within its ring, only for the Player seated at that Tile. Randomness: mulberry32 over `match.seed`, inline in the host.
  - `result(players, scores)`: scores, plus the ranking by score unless the best score is shared, so the platform's result card reads "Draw" for a tie.
  - View, canvas only: the ring and an inner ring that shrinks over `lifeMs`, a 3 mm mark where the last hit landed until the next target, then (from the Tile's top-left corner) every Player's name and score along the top, the countdown digit at 40 mm, and "<name> wins" / "Draw" during `done`.
- `games/tap-race/test/tap-race.test.ts`: 8 tests (below). `withTexts()` wraps the view to read each frame's `fillText` strings off the SDK's headless recording canvas.
- `games/tap-race/README.md`: describes Tap Race instead of the template (its file list named `test/template.test.ts`).

**Verified**
- `pnpm vitest run games/tap-race`: 8 passed (≈2 s):
  1. manifest ranges, `bots`, `tickHz: 0`; imports only `@mgc/sdk`;
  2. countdown: `{ phase: 'countdown', count: 3 }` at 0, still 3 at 999 ms, 2 at 1000, 1 at 2000, `{ phase: 'play' }` with no target at 3000; `d0`, `d1`, `d2` all draw `['Ann 0', 'Bo 0', '3']`;
  3. first target on `d0`/`d2`, inside its Tile and the bands; the other seated Tile, the middle Tile, and 0.5 mm outside the ring score nothing; 0.5 mm inside scores for the seated Player (`lastHit` = the tap point, host log `"<name> scored (1)"`); a second tap scores nothing; target 2 appears `spawnMs` later with `round: 2`;
  4. full Match, seed 1: targets `d0 d0 d2 d0 d0 d0 d2` (never `d1`); Bo taps his, Ann only her first, the rest fade no earlier than `lifeMs` after they appeared; `done` with no target; every Tile draws `['Ann 1', 'Bo 2', 'Bo wins']`; no result until `resultMs` later, then `{ scores: { p-ann: 1, p-bo: 2 }, ranking: [p-bo, p-ann] }`; host log `Ann scored (1), Bo scored (1), Bo scored (2)`; no faults; every Device closed `ended`;
  5. bot in slot 1 (`[Ann@d0, bot:1]`): Ann taps target 1 at once → `{ p-ann: 1, bot:1: 0 }` (the bot's timer was cancelled); targets 2–7 all go to `d0`; the bot scores 3, each 400–1205 ms after the target appeared with `lastHit` at its centre, and misses 3 (they fade after `lifeMs`); result `{ p-ann: 1, bot:1: 3 }`, ranking `[bot:1, p-ann]`;
  6. bots alone (`[bot:0, bot:1]`): targets on `d0`, `d1` and `d2`; the Match ends by itself with 1–7 points scored;
  7. a 1:1 tie (each taps one target): result `{ scores: { p-ann: 1, p-bo: 1 } }`, no ranking;
  8. pause: paused 100 ms into the first spawn wait for 10 s, no target meanwhile, then the target's `since` is exactly 10 s later than in the same run unpaused.
- `pnpm exec tsc -p games/tap-race`: clean. `wc -l src/index.ts`: 148.
- Smoke: `pnpm --filter @mgc/pwa dev --port 5181 --strictPort`, headless managed Chromium (shared with other agents' tabs), 420×860 tabs, real Trystero. Every tab ran an init script that blocks Vite's HMR WebSocket (a sibling Game's edit had reloaded my tabs once, mid-session, back to "Start Air Hockey") and wraps `CanvasRenderingContext2D.prototype` `clearRect`/`arc`/`fillText` on the `#game` canvas: each frame's rings (world point, radius, client px through `getTransform()`) and texts, with the frame's time. Taps were trusted `clickAt` at a ring's client px from a frame under 200 ms old.
  - **Two tabs** (room WJ36): Host "This phone · first phone · Player 1", Peer "Windows · right of phone 1 · Player 2". Picked Tap Race, "Start Tap Race".
    - Countdown `3 → 2 → 1` on both tabs (screenshot `taprace-two-countdown-host`).
    - All 7 targets tapped on the tab whose screen showed the ring (3 on the Peer, 4 on the Host); each raised that tab's Player's score on **both** tabs within 0.1–0.3 s: `0:0 → 0:1 → 1:1 → 1:2 → 2:2 → 3:2 → 4:2 → 4:3`. Host console: `Tap Race host: Player 2 scored (1)`, `Player 1 scored (1)`, …; the Host's HUD bar shows `log · host: Player 1 scored (1)` (screenshot `taprace-two-hit-host-host`).
    - Both tabs drew "Player 1 wins" (screenshot `taprace-two-done-peer`), then the card "Player 1 wins · Player 1 4 · Player 2 3" on both. No page errors.
    - An earlier Match in the same room where nobody tapped ended 0:0 with the card "Draw · Player 1 0 · Player 2 0" on both tabs (screenshots `taprace-two-draw-host`/`-peer`).
  - **One tab with a bot** (room WJ36 after the Peer left, then room TX4Y): `.players button[data-slot="1"]` pressed (P2 "Bot"), "Start Tap Race".
    - Nobody tapping: the bot played to the end by itself, "Bot 4 · Player 1 0" (and in a second run "Bot 5 · Player 1 0"), card "Bot wins". Screenshot `taprace-one-target`: the ring with its inner ring shrunk, "Player 1 0 · Bot 3".
    - The human tapping every ring as soon as it was drawn (inner ring ≥ 8.93 of 9 mm, i.e. within ~20 ms): 7:0, card "Player 1 wins · Player 1 7 · Bot 0": the bot is beaten when the human is quicker. Host log `Player 1 scored (1)` … `(7)`. No page errors.
  - Screenshots, `.png` in `%TEMP%`: `taprace-two-lobby`, `-two-countdown-host/-peer`, `-two-hit-peer-host/-peer`, `-two-hit-host-host/-peer`, `-two-done-host/-peer`, `-two-result-host/-peer`, `-two-draw-host/-peer`, `-one-lobby`, `-one-target`, `-one-done`, `-one-result`, `-one-result-beaten`.
  - Dev server stopped, tabs closed.
- Not observed: real phones; three or more tabs; a pause in the browser (the test covers the spawn timer); a rotated Tile (the lobby makes none).

**Deviations / notes**
- **Targets fade** after `TAP_RACE.lifeMs` (the spec leaves it open). A tap counts for the Player seated at the tapped Tile, so with two humans a target on Ann's Tile can only ever score for Ann; without a fade every Match would be decided by where the targets spawned. With it, each target is "tap it in time" for its Tile's Player, a race against the bots, and a bots-only Match can never stall on a target every bot missed. The shrinking inner ring is the fade's clock. `round` counts faded targets too, so a Match is always `rounds` targets long.
- **Bot miss** = the bot does not tap that target at all (drawn once per target); a non-missing bot always beats `lifeMs` (`reactMs.max` 1200 < 2500).
- **"<name> wins" stays up `resultMs`** before `ctx.end`: the platform hides the view the moment the Match closes, so a `done` state published with `end` is never seen.
- **Ties**: the result leaves out `ranking` when the best score is shared, so the platform's card says "Draw" (with a ranking it would name the first). The view says "Draw" too. Ties are possible with faded targets.
- **Bands**: `band` (15 mm) keeps targets off the scores along the top and off the Host's HUD bar along the bottom (56 CSS px ≈ 14.8 mm at 3.78 px/mm), which swallowed a tap in the first smoke run.
- **Cut for the 150-line budget**: (a) rotation: target placement and text assume `rot` 0, as Pong does (no lobby template rotates a Tile); (b) the target's `since` is not moved on by a pause, so after a pause the inner ring shows less time left than the fade timer (which is pause-correct) really has. Both need ~10 lines; see the friction log.
- Every Tile draws every Player's score (the spec says "the scores along the Tile's top edge"); with two Players each gets half the width.
