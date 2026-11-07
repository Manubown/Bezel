# 01: Air Hockey: two Tiles facing each other, 2D paddles, prediction under rotation

**What to build:** Air Hockey on `@mgc/sdk` per `.scratch/air-hockey/spec.md`: the table is the Tiles' common band with a goal at each end; each Player's half comes from the Tile they are seated at (`Player.deviceId`); the paddle is a disc that follows the finger in 2D and carries its velocity into the puck; the puck has friction, restitution, a maximum speed and a stall re-serve; bots; views extrapolate the puck; scores drawn near each Player's end, upright for them. Built and tested with the far Tile at `rot: 0` and at `rot: Math.PI`.

**Status:** resolved

- [x] `createTestMatch`, a row Match with the second Tile at `rot: 0` and at `rot: Math.PI` (hand-built `MatchInfo`): the same world finger point (Tile-local 36, 40 or 34, 110) puts the paddle there, in the state of both views and drawn under the finger in that Tile's px
- [x] Scores drawn near each Player's end and upright for that Player at both rotations; on the turned Tile the SDK's transform turns the drawing (the game reads no `rot`)
- [x] Puck reflects off the side walls and off the ends outside the mouths, keeping `restitution` of its speed into the wall
- [x] A puck in a goal scores for the other Player; re-served from the centre toward the scored-on Player
- [x] A puck slower than `stall` for `stallFor` (3 s) is re-served
- [x] A paddle hit transfers velocity (at rest: (1 + restitution) × paddle speed, capped; moving puck vs moving paddle: relative bounce)
- [x] A bot returns a straight puck, never faster than `bot.speed`
- [x] First to `win` ends the Match with the ranking
- [x] Smoke, two tabs, row template, port 5184: drags move the paddle on both views; a goal updates the score on both; the puck crosses the bezel smoothly
- [x] `pnpm exec tsc -p games/air-hockey` clean; friction log in `.scratch/air-hockey/friction.md`

## Comments

### 2026-11-07

**Changed**
- `games/air-hockey/src/index.ts` (replaces the template copy):
  - `AIR_HOCKEY` tunables: `puck 5`, `paddle 9`, `goal 50` mm; `friction 0.25` (share of speed lost per second), `restitution 0.85`, `maxSpeed 420` mm/s; `serve 90` mm/s within `maxServeAngle` 25°, `serveWait 1` s; `stall 20` mm/s for `stallFor 3` s; `stillMs 100`; `win 7`; `bot { speed 150, aimError 8, line 22 }`. Exports `AirHockeyState` and `AirHockeyMessage` (`never`).
  - Manifest per spec: `tiles {1,2}`, `controllers {0,0}`, `players {2,2}`, `bots: true`, `templates ['row','column']`, `tickHz 60`.
  - `table(match)`: each Tile's world box from `new Surface(...).worldAabb()` (a Tile's `x, y, w, h` is its rotation origin and own size, not a world rect). The axis runs from the first Tile toward the last (a lone Tile: its longer side). Along it the table spans the bounds; across it, the band every Tile covers. Side 0 defends the end nearer a point ¾ down the first Tile's screen, side 1 the other. Halves run from each end to the centre line; goals are centred on the ends.
  - `seats(match)`: side 0 = the human seated at the first Tile, side 1 = at the last, bots fill the rest (Pong's rule, copied: no shared helper).
  - Host:
    - The finger's world point, clamped to its half, is the paddle. Its velocity comes from the last two samples' `Input.t`. It drops to zero when no sample has arrived for `stillMs`.
    - Puck-paddle collision is swept over the step: both move in a straight line, and they touch at the first time `reach` apart. The puck bounces off the paddle as off a moving wall and is never left inside it. A finger's `down` jumps the paddle without a sweep.
    - Wall bounces keep `restitution` of the normal speed. The end walls are open across the goal mouth; a puck wholly past an end is a goal.
    - The serve is from the centre toward the scored-on side. The stall re-serve goes toward the half the puck lies in.
    - Bots move first in `tick`. A bot waits on its line `line` mm before its goal. A puck coming at its goal it meets on that line (walls folded), off by a seeded `aim` drawn at every strike from a separate stream (Pong's). A puck loose in its half, ahead of it, it goes straight through.
    - Play holds until every human has touched once (`hold`).
  - View:
    - The table edge, the centre line and circle, and a goal bar across each mouth.
    - Scores 45 mm in from each end, rotated so they read upright from that end (`atan2` of the side's into-table direction), with "BOT" under a bot's score and "<name>, touch to start" in a held side's half.
    - Paddles; the puck extrapolated by `now − max(t, resume)` (≤ 100 ms, minus the rest), folded off the walls except into a mouth. A resting or held puck is drawn as a ring.
- `games/air-hockey/test/air-hockey.test.ts`: 19 tests. The manifest/imports test; eight tests run once per far-Tile rotation (`describe.each` over rot 0 and π); a column table with the first Tile at rot π; one Tile against a bot. Draw calls are read by wrapping the view and proxying `f.ctx` so each `arc`/`fillText` carries the canvas transform it ran under.
- `games/air-hockey/README.md`: rewritten for this Game (the template's text was copied verbatim).
- `.scratch/air-hockey/smoke/*.webp`: smoke screenshots (below).

**Verified**
- `pnpm vitest run games/air-hockey`: 19 passed. `pnpm exec tsc -p games/air-hockey`: clean.
- Rotation (tests at rot 0 and π, same assertions):
  - Bo's finger at world (110, 40) is Tile-local (36, 40) at rot 0 and (34, 110) at rot π (worked out by hand, not through `Surface`). Both put his paddle at (110, 40) ± 1e-9 on both views, and his own view draws it at exactly that px (local × 6).
  - Bo's score (world 99, 75) points screen-left on his rot-0 phone and screen-right on his rot-π phone; in the world it points west (toward Ann) both times.
  - In the column test, Ann's turned phone draws her score pointing screen-up, i.e. upright for her.
  - The game reads `rot` nowhere but in `table()`, which gets each Tile's world box from `Surface`.
- Tuning (throwaway sims over `createTestMatch`, deleted; two 111 × 227 mm Tiles, as two desktop tabs make; 4 seeds × 120 s):
  - Bot at `220 / 8`: a zero-latency scripted shooter (600 mm/s) beat the bot 5:3; bot vs bot rallied with about 1 goal per 180 s; an idle human lost 0:7 in 27–60 s.
  - Bot at `150 / 8` (shipped): the 600 mm/s shooter won 13:1, a 240 mm/s one drew 5:5.
- Smoke: `pnpm --filter @mgc/pwa dev --port 5184`.
  - Setup:
    - Headless Chromium, two 420 × 860 tabs, room DYH2, row template, dpr 1.25.
    - Vite's HMR socket was blocked in both tabs (sibling Games edit the shared bundle).
    - A recorder wrapped `CanvasRenderingContext2D.prototype.arc`/`fillText`/`clearRect`. It took world positions and, through `getTransform()`, CSS px of the paddles (r 9), the puck (r 5) and the texts. It kept a puck trace stamped with `performance.timeOrigin + frame time`.
    - Lobby actions were clicks; drags were trusted mouse down/move/up.
  - **Start**:
    - Both tabs drew "Player N, touch to start" in that Player's half, upright for them. The score's screen-up vector was (+4.72, 0) device px on the Host (Ann, west) and (−4.72, 0) on the Peer (Bo, east).
    - Screenshots: `1-host-touch-to-start`, `1-peer-touch-to-start`.
  - **Drags move the paddle on both views**:
    - Host drag (150, 300) → (300, 600) px: the west paddle was at world (79.37, 158.73) on both views, drawn at px (300, 600) on the Host.
    - Peer drag (200, 700) → (100, 200) px: the east paddle was at (141.57, 52.91) on both views, drawn at px (100, 200) on the Peer.
    - Screenshots: `2-*-after-drags`.
  - **A goal updates both**:
    - With both paddles parked in corners, the served puck drifted into Ann's goal. Both views drew 0 at Ann's end and 1 at Bo's (`3-*-score-0-1`).
    - Scripted Peer strikes then scored 2:2, 2:4 (`4-*-score-2-4`) and 2:6, with both views the same each time.
    - The Match ended with the result card "Player 2 wins · Player 2 7 · Player 1 2" on both tabs (`5-*-result`).
    - No page errors in either tab.
  - **Bezel crossing**:
    - The serve leaving the centre (x 113.1, in the 4 mm gap) at 90 mm/s: per-frame speed 0.086–0.090 mm/ms on the Host and 0.086–0.091 on the Peer through the crossing. The two views drew it within 0.05 mm of each other at the same wall time.
    - A ~400 mm/s Peer strike crossing west: the Peer drew steps of 0.39–0.41 mm/ms; the Host drew it within 0.06–0.43 mm of the Peer.
    - The only jumps in either trace were at a strike, where the puck is set against the paddle's end-of-step position, never at the bezel.
  - **Bot** (P2 Bot pressed, Start):
    - The Peer drew "BOT" under the bot's score.
    - Over 6 s the bot paddle ranged x 140–204, y 61–174 mm: it left its line to go after a loose puck (`6-peer-bot`).
  - Screenshots are in `.scratch/air-hockey/smoke/`.
- Not observed:
  - Real phones, and a rotated Tile in the browser (no template or HUD control makes one).
  - The column template in the browser (only in the test).

**Deviations / notes**
- **"Goals on the short edges"** became goals on the two ends of the axis that joins the first and last Tile, the ends the Players sit at. With portrait phones in a row (the smoke's template) those ends are geometrically the long edges: 144 × 150 mm in the test, 226 × 227 mm with two desktop tabs. A lone Tile uses its short edges.
- **Touch to start** (not in the spec): the first serve waits until every human has touched once; until then nothing but the paddles moves and each held Player's half says so. Without it the first serves score on Players still holding the HUD. This is not Pong's 5 s presence hold: after the start, play never holds.
- **The resting puck is live.** A paddle that strikes it ends the rest. A paddle that only overlaps it (one parked on the centre line) pushes it clear but leaves the rest and the serve velocity alone, so it cannot stall the serve.
- **One `restitution`** for walls and paddles: a paddle is an infinitely heavy moving wall. Friction is exponential (`(1 − friction)^dt`). Views extrapolate linearly (≤ 100 ms), folding off the walls but ignoring friction and paddles; the next state carries any strike.
- **Stall re-serve** goes toward the Player in whose half the puck stopped. `stallFor` is a tunable (3 s per spec).
- **Bot**: Pong's intercept on its line, with `aimError` (8) under the reach (14), so a straight shot is always met. It is beaten by speed: far-post shots it cannot reach in time. The added strike mode exists because without it a puck dying in the bot's half waits 3 s for the stall serve.
- **Paddle speed** comes from the last two samples' capture times (one Device, so monotone). It is zeroed by *arrival* time (`stillMs` after the last sample reached the host), so a Peer's network latency does not zero it.
- **No local echo** of one's own paddle (the spec does not ask; Pong does not).
- **Score inset** moved from 30 to 45 mm after the first smoke tab showed the "0" under a paddle waiting home.
- **The serve spot is in the bezel.** With two Tiles the table centre is in the gap between them, so the resting puck shows only as slivers inside the centre circle.
- **Three Tiles would have been easy.** A throwaway `createTestMatch` with three Tiles in a row (Ann at d0, Bo at d2) worked unchanged: the middle Tile's finger moved nothing, a straight shot scored, and the serve spot lay on the middle Tile (visible). Only `manifest.tiles.max` would change; kept at 2 per spec.
- **Column test**: there it is the *first* Tile that is turned (rot π), so that Ann's phone at the top end faces her; the "far Tile at rot π" of the spec is the row case.
