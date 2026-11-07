# Air Hockey: friction log

What I hit while building Air Hockey on `@mgc/sdk` (2026-11-07), most valuable first.

## Did `Surface` handle rotation transparently?

**Yes, for input and drawing.** I tested a row with the far Tile at `rot: 0` and at `rot: Math.PI` (hand-built `MatchInfo`), and a column with the first Tile at `rot: Math.PI`. The host and view code never read `rot`. Input arrived in world mm: the same world point gave the same paddle position at both rotations. On the turned phone the canvas transform turned the whole drawing: a score drawn upright in world terms for the Player at that end came out right-way-up on the phone turned toward them, with no code for it. The one place rotation leaked in was *layout geometry*: working out which part of the world a Tile covers (first entry below). No lobby template produces a rotated Tile, so none of this could be seen in the browser (third entry).

### A Tile's `x, y, w, h` is not its world rectangle, and nothing gives you that rectangle

- **Where:**
  - `packages/sdk/src/types.ts:14-18`: `interface Tile extends Rect`, documented only as "rot radians, clockwise about (x, y)"; `docs/sdk-design.md:16` is the same.
  - `packages/layout/src/types.ts:24-34` is where it says `x, y` is the screen's top-left corner and `w, h` the screen's own size.
  - `packages/sdk/src/index.ts:1` re-exports `Surface` but not `aabbOf` (`packages/layout/src/surface.ts`).
- **Expected:** `Tile extends Rect` reads as "a world rect", so I expected the table band to be `max(t.y)`…`min(t.y + t.h)` across Tiles, as Pong computes it.
- **Actual:**
  - A phone lying upside down in the same place as an upright one has `x, y` at the world's bottom-right of that place. Pong's band math (`games/pong/src/index.ts:110-111`) on such a Tile gives an empty band, and only its "no common band → use the bounds" fallback saves it.
  - Finding the real meaning took `packages/layout/src/types.ts` and `surface.ts`.
- **Workaround:** `new Surface({ id: t.deviceId, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }, 1).worldAabb()` per Tile. That is a value import of a class meant for the platform, a dummy `pxPerMm`, and a `deviceId` → `id` remap, because `Surface` takes a layout `DeviceRect`. The SDK does the same remap twice itself: `game-side.ts:257`, `testing.ts:118`.
- **Suggested fix:**
  - Export a `tileBox(tile: Tile): Rect` (world AABB) from `@mgc/sdk`, or put a `box: Rect` on each `MatchInfo.tiles` entry.
  - Let `Surface` take a `Tile`.
  - Say in `Tile`'s doc comment that `x, y, w, h` are the rotation origin and the screen's own size, not a world rect.
- **Severity:** doc-gap. A blocker for any Game that does band math on a rotated Tile without reading `@mgc/layout` source.

### `t.input` takes world mm and inverts them through the same `Surface`, so a test cannot pin px → world

- **Where:** `packages/sdk/src/testing.ts:162`: `surface.worldToPx(at)`, then the view's capture maps back through `surface.pxToWorld` (`game-side.ts:329`).
- **Expected:** the spec asks for "the Tile-local finger position must map to the same world point" at rot 0 and π. I expected to put a finger at a Tile-local/screen px and assert the world point.
- **Actual:** the harness only takes world coordinates, so the round trip goes through the class under test. A `Surface` bug that is consistent in both directions would pass every Game's test.
- **Workaround:** I worked out the Tile-local position by hand (`local()` in the test). I then asserted that the view *draws* the paddle at exactly that px: the transform recorded on the `arc` call, set against hand-computed `local × pxPerMm`.
- **Suggested fix:** `t.inputPx(deviceId, phase, px, pointerId?)`, i.e. a pointer at CSS px on that Device's screen, next to the world-mm `t.input`.
- **Severity:** papercut (missing test helper).

### No lobby template or HUD control produces a rotated Tile

- **Where:** `packages/layout/src/templates.ts:17`, `:29`, `:52`: `rot: 0` in `row`, `column` and `grid`. `apps/pwa/src/hud.ts:357-361` (the roster's ◀ ▶ order buttons) is the only per-Tile control.
- **Expected:** the spec's premise is phones turned toward their Players (`rot: π` on one end).
- **Actual:** rotation is reachable only through a hand-built `MatchInfo` in `createTestMatch`. The browser smoke could not exercise it; a Game's rotated drawing has never been seen on a screen.
- **Workaround:** none; tested headless only.
- **Suggested fix:**
  - A "turn 180°" chip per Tile in the roster row, next to ◀ ▶. Or a `head-to-head` template: a column with the first Tile at `rot: π` (and a row at ±π/2 for landscape play).
  - `buildLayout` must then place the turned Tile's origin at its far corner. `aabbOf` already handles the bounds.
- **Severity:** papercut. It blocks seeing rotation outside tests.

### The SDK's own `Vec2`/`Rect` cannot appear in published state

- **Where:** `packages/layout/src/types.ts:4` and `:9` declare `Vec2` and `Rect` as `interface`s. `@mgc/sdk` re-exports them (`packages/sdk/src/index.ts:1`), and `Input.world` is a `Vec2`.
- **Expected:** `type State = { pads: Vec2[] }` for `defineGame<State, never>`.
- **Actual:** `TS2344: Type 'S' does not satisfy the constraint 'JsonValue' … Index signature for type 'string' is missing in type 'Vec2'`, checked with a throwaway file. Interfaces get no implicit index signature, so they are not `JsonValue`.
- **Workaround:** a local `type P = { x: number; y: number }` (and `Puck`, `Box`), and state built from those.
- **Suggested fix:** declare `Vec2` and `Rect` as `type` aliases in `@mgc/layout` (nothing extends them as interfaces), or note the rule beside `defineGame`.
- **Severity:** papercut. The error message does not point at the cause.

### No way to read what a view drew in `createTestMatch`

- **Where:**
  - `packages/sdk/src/testing.ts:99` builds a headless screen per Device, whose canvases carry a recording context (`packages/sdk/src/headless.ts:44-87`). `TestMatch` exposes neither.
  - The recording keeps `ops`, but not the transform each op ran under (`headless.ts:77`).
- **Expected:** the spec asks to "assert drawing orientation holds" on a rotated Tile.
- **Actual:** I had to wrap the Game's `view` and proxy `f.ctx` so that each `arc`/`fillText` call is recorded with `getTransform()` (`recorded()` in the test, ~30 lines). Without the per-call matrix, `ops` alone cannot say where on the screen anything landed.
- **Workaround:** as above.
- **Suggested fix:** `t.canvas(deviceId)` returning the last frame's ops with the matrix recorded on each drawing op (`arc`, `fill*`, `stroke*`, text). For example `['arc', x, y, r, a0, a1, { matrix }]`, or a helper `t.drawn(deviceId, 'arc')` → `{ args, px }[]`.
- **Severity:** papercut (missing test helper).

### In the harness, one `t.tick` may draw before the state it published

- **Where:** `packages/sdk/src/testing.ts:23-26` (`tick` doc) and the shared `SteppedFrames.fire` that runs the host step and every paint loop in one batch.
- **Expected:** after `await t.tick(STEP_MS)` the Host's own view has drawn the new state.
- **Actual:** my column test found no score `fillText` on `d0` after one step. The first draw with a state comes a frame later.
- **Workaround:** `await t.tick(STEP_MS * 2)` before reading draw calls.
- **Suggested fix:** document in `tick` that views draw in the same frame batch as the host step, possibly before its publish lands; or have a `t.drawn(...)` helper fire one extra frame.
- **Severity:** doc-gap.

### The Host's HUD bar covers the bottom 15 mm of the Host's Tile during a Match

- **Where:** `apps/pwa/index.html:36-38` (`.sheet` fixed at the bottom; collapsed it is the `.bar`). The Peer's `.strip` (`:106-107`) is hidden during a Match.
- **Expected:** the whole Tile is play surface, as the Layout says it is.
- **Actual:**
  - In the smoke the collapsed bar spanned CSS px 803–860 of an 860 px tab: 57 px, ≈ 15 mm at 3.78 px/mm, over the game canvas. The puck along the bottom wall, and a paddle low in the Host Player's half, disappear under it on the Host only.
  - Neither `screenMm` nor the Tile reports it, so a Game cannot keep out of it.
- **Workaround:** none in the Game.
- **Suggested fix:** collapse the bar to a corner pill while a Match runs, or report a safe-area inset (`ViewContext.insetMm`) and shrink the Tile the Layout uses for the Host.
- **Severity:** papercut.

### Every real-time Game has to invent "everyone ready"

- **Where:** `docs/sdk-design.md` §2 has no ready/presence concept. Pong added its own touch-to-start and presence hold (`games/pong/src/index.ts`, `hold`/`started`).
- **Expected:** the Match starts when the Players can play.
- **Actual:**
  - The Match starts the moment the Host presses Start, while the Peer is still looking at the HUD.
  - Without a gate, Air Hockey's first serves drift into unguarded goals: in the smoke, with both paddles parked, serves scored on their own between my harness cells.
- **Workaround:** a minimal `hold` (human sides that have not touched yet; nothing but the paddles moves), the same idea as Pong's, written again.
- **Suggested fix:** a documented pattern in the developer guide. Better, a platform "touch to start" overlay that holds `tick` (like a pause) until every seated human has touched their Tile once.
- **Severity:** doc-gap.

### Seat-to-side mapping and seeded randomness are copied from Game to Game

- **Where:**
  - `docs/sdk-design.md:103` states the rule: slot 0 is the first Tile, slot 1 the last, a bot has no `deviceId`.
  - `games/pong/src/index.ts` `seats()` and `random()`; my `seats()`, `random()`, `fold()` and `clamp()` are near-verbatim copies.
- **Expected:** a helper for the rule the platform itself defines.
- **Actual:** each Game re-derives "who sits at the first/last Tile, bots fill the rest", and the contract forbids a shared package.
- **Workaround:** copy.
- **Suggested fix:** `sidesOf(match): [Player, Player]` and `random(seed)` in `@mgc/sdk`, the two pieces every Player-vs-Player Game needs.
- **Severity:** papercut.

### With two Tiles the table's centre is in the bezel gap

- **Where:** any Game that serves or spawns at the world centre of a 2-Tile row or column. Not an SDK bug; a guide gap.
- **Expected:** the centre spot is visible.
- **Actual:** the resting puck (Ø 10 mm) sits in the 4 mm gap. Each phone shows only a sliver inside the centre circle, so a Player cannot see where the serve sits. With three Tiles (checked in a throwaway test) it lands on the middle Tile.
- **Workaround:** kept the centre serve (spec, Pong parity); the centre circle marks the spot.
- **Suggested fix:** a line in the developer guide: "with an even number of Tiles the world centre is in a bezel; spawn things on a Tile".
- **Severity:** doc-gap.

### `pnpm new-game` leaves the template's README text in the new Game

- **Where:** `scripts/new-game.mjs:31-44` only rewrites ids and names. `games/_template/README.md` arrives as "The smallest complete Game for MobileGameConnect. Copy it with `pnpm new-game`…", listing `test/template.test.ts`, which the script renamed (`:47`).
- **Expected:** a README for the new Game, or none.
- **Actual:** a README that describes the template and a file that no longer exists.
- **Workaround:** rewrote `games/air-hockey/README.md`.
- **Suggested fix:**
  - Rename the README's test path in the script.
  - Mark the template-only sentences, so the script can drop them or a reader knows to.
- **Severity:** papercut.

### Smoke tabs reload whenever any Game changes

- **Where:**
  - `apps/pwa/src/games.ts:8` `import.meta.glob` bundles every Game into the PWA, so Vite's HMR full-reloads every open tab on an edit to *any* Game. Here that was sibling agents' Games, mid-Match.
  - Main relayed the workaround.
- **Expected:** a smoke Match survives other Games' edits.
- **Actual:** not hit, because I applied the workaround before opening tabs. It cost a reopen: my own source edit (score inset) did not reach the open tabs, so I had to close both and start a new room.
- **Workaround:** an `init_scripts` entry that makes `WebSocket` throw for URLs containing `token=` (Vite's HMR socket), then reopen tabs to pick up changes.
- **Suggested fix:** a `?nohmr` query or env flag the PWA honours, or document the init script in the smoke guide.
- **Severity:** papercut (tooling).

### [INFERENCE] Two headless tabs share one browser; the Host's frames stall while the Peer tab is driven

- **Where:** the Host's fixed step runs on its own rAF (`docs/sdk-design.md:221`, `:230`).
- **Expected:** 60 fps on both tabs.
- **Actual:**
  - Both tabs painted at ~30 fps (33 ms frames).
  - During a burst of puppeteer mouse input to the Peer tab, the Host's puck trace had a ~1 s gap with no frames. That points to the Host tab getting no animation frames, and so no host steps, while the other tab was driven.
  - I did not isolate the cause (it could be screenshots or input focus).
- **Workaround:** none needed for the evidence: the bezel crossing was read where both tabs were drawing.
- **Suggested fix:** in the smoke guide, open the Peer in a separate browser context or window (`headed`, or a second `app` instance) when timing matters. On real phones the Host's screen must stay foreground for the same reason.
- **Severity:** papercut (tooling).

## Worked well

- **`Surface` and rotation:** a game written entirely in world mm needed no code for a phone lying upside down. Input and drawing both came out right at rot 0 and π, and in the column with the first Tile turned.
- **`Player.deviceId` for seats:** together with `match.tiles` order, the halves and the touch gate fell out directly. A finger on a Tile that seats nobody, or a bot's Tile, is dropped with a single `indexOf`.
- **`createTestMatch`:** fast and deterministic. The full suite (19 tests, about 20 simulated Matches) runs in ~1.5 s. Throwaway tuning sims of 8 minutes of play took ~25 s.
- **Pong as a reference:** `fold`, the extrapolation one-liner with `max(t, resumedAt)`, `onResume` re-publish, and a separate aim stream all transferred directly.
- **Smoke:** the platform's in-process link let a prototype wrapper on `CanvasRenderingContext2D` read world positions and px straight off both tabs. Wall-clock stamps (`performance.timeOrigin + frame time`) compared the two views to within 0.05 mm at a bezel crossing.
