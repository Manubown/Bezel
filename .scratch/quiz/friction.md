# Quiz: friction log

Building `games/quiz` (one board Tile, 1–4 Controllers with DOM views, targeted `publish`, timers) on `@mgc/sdk` as of 2026-11-07. Entries are ordered by how much they cost.

### 1. A Controller is never a Player: Quiz is single-player in every lobby Match

- **Where:**
  - `apps/pwa/src/lobby.ts:9-10` (`SLOTS = 2`).
  - `apps/pwa/src/lobby.ts:304-315` (`slotPlayers`: Players come only from slot Tiles).
  - `apps/pwa/src/lobby.ts:417-421` (`slotTiles`: first and last Tile; with one Tile, slot 1 has no Device).
  - `apps/pwa/src/lobby.ts:362` (the `players` range is counted from these).
  - Every Device, a Controller included, already reports its own Player id (`seatIds`, `lobby.ts:158`, `:175-181`), and Start waits for it (`:355`). The id is just never used for a Controller.
- **Expected:** one board Tile and N Controllers give N Players, one per phone in hand: the people holding the Controllers are the ones playing.
- **Actual:**
  - Quiz has `tiles {1,1}` and `bots: false`, so it always gets exactly one Player: the human "seated" at the board Tile (slot 0). With one Tile, slot 1 can only be a bot, and Quiz has none.
  - With 2–4 Controllers, all but the first show "Waiting for a player".
  - In the smoke the HUD's Players list showed only "P1 … phone 1". The Player who held the Controller is labelled as sitting at the board.
  - "Locked in" (one Holder answered and another has not yet) can never appear in a real Match: with one Holder, every answer reveals at once.
- **Workaround:** none in the Game. The tests hand-build a second Player (`p-bo`, no `deviceId`), which no lobby can produce.
- **Suggested fix (lobby rule):**
  - When the picked Game has `controllers.max > 0`, the lobby makes one Player per Device marked Controller, in Controller order.
    - `playerId` is the id that Device already reported.
    - `deviceId` is the Controller.
    - The name is editable in the HUD's Players list like a slot's.
  - Tile-slot Players stay for Games without Controllers (Pong). Pass passes one Controller around, so it would declare which rule it wants. A manifest field `seats: 'tiles' | 'controllers'` (default `'tiles'`) makes that explicit.
  - Then let the platform make each Controller's own Player its first Holder, so the common case needs no `setHolder` loop in every Game.
  - Document `Player.deviceId` as "the Device this Player sits at or holds".
- **Severity:** blocker (for any multi-player Controller Game).

### 2. A Controller's `latest()` is the last state of either kind: "retained separately" does not reach the view

- **Where:**
  - `packages/sdk/src/game-side.ts:289-291`: the view sets `latest` from every `state` frame, `to` or not.
  - `packages/sdk/src/match.ts:139-148`: the runtime keeps the broadcast and the targeted state apart.
  - `packages/sdk/src/match.ts:165`, `:462-463`: a late view and a resume get both, in arrival order.
  - `docs/sdk-design.md:98`: "A targeted `publish(s, to)` is retained per Device separately from the broadcast". Also `:220`.
- **Expected (from the doc):** a Controller holds its own state apart from the board's, e.g. `latest()` is its own, or both can be read.
- **Actual (observed, pinned in `quiz.test.ts`, test 3):**
  - `onState` fires once per frame, in publish order.
  - `latest()` (and so `Frame.state` and the harness's `t.state()`) is simply the last frame applied, broadcast or targeted. Nothing is merged, and a targeted state has no priority.
  - Example: the host publishes the board, then Ann's own state to `c0` alone.
    - `c0` heard `board, controller, board, controller`, so its `latest()` is its own state.
    - `c1` heard `board, controller, board`, so its `latest()` is now the board. Its own state is no longer in `latest()`, although the runtime still retains it.
  - "Retained separately" only governs replay: a view that becomes ready late, or a resume, gets both states in arrival order. `latest()` then ends on whichever was published last.
  - So the order of `publish` calls decides what `draw` sees on a Controller.
- **Workaround:** the state type is a union with a `kind` field. The Controller view keeps the last `kind: 'controller'` state from `onState` and ignores broadcasts. The host publishes the board before the targeted states, so a fresh Controller's `latest()` is its own.
- **Suggested fix:**
  - State the rule in §2: "a view's `latest()` is the last state of either kind; keep your own in `onState`".
  - Better: give views both, `latest()` (last broadcast) and `own()` / `Frame.own` (last targeted). The runtime already keys them apart; only the view side mixes them.
- **Severity:** doc-gap.

### 3. One state type for the broadcast and the private state

- **Where:** `packages/sdk/src/game.ts:40` `publish(state: S, to?: DeviceId)`; `ViewHandlers.onState(state: S)`.
- **Expected:** the private state has its own shape and type.
- **Actual:** `S` must be the union of both shapes. Every view narrows every state, and a board Tile's `draw` must check for a Controller-only shape it never receives.
- **Workaround:** `QuizState = BoardState | ControllerState`, discriminated by `kind`.
- **Suggested fix:** `defineGame<S, M, P = S>` with `publish(state: S)` / `publish(state: P, to)` typed apart, and `onState`/`onOwnState`. Or at least the union pattern as an example in the doc.
- **Severity:** papercut.

### 4. `t.input` on a DOM view ignores the position: only the last element appended can be pressed

- **Where:**
  - `packages/sdk/src/headless.ts:217-221`: `pointer()` walks to the last child of the last child; x/y only go into the event.
  - `packages/sdk/src/testing.ts:27-33`: "on its topmost element (the SDK's capture, or a DOM view's own button)".
- **Expected:** `t.input('c0', 'down', { x, y })` hits the button under (x, y), as in the browser.
- **Actual:** it always hits the deepest last element: Quiz's button D, wherever the pointer is. A Controller with four answer buttons can press only D through `t.input`, and "topmost" reads like z-order.
- **Workaround:** the DOM path is tested once (button D, `quiz.test.ts`, test 8). Every chosen answer goes through a captured `ViewContext.send` (entry 5).
- **Suggested fix:**
  - Change the wording to "the last element the view appended, whatever the position".
  - Add a way to target an element, e.g. `t.press(deviceId, (el) => el.textContent?.startsWith('B'))`, or hit-test against `style` boxes.
- **Severity:** papercut.

### 5. `createTestMatch` has no `send`, no access to a view, and no way to settle without moving time

- **Where:**
  - `packages/sdk/src/testing.ts:19-49`: the `TestMatch` interface.
  - `:81-88`: the views' contexts are captured, but kept private.
  - `:154-159`: `tick(0)` runs no frame and awaits nothing.
- **Expected:**
  - Send a message as a Device would.
  - Read a view's DOM and the states it heard.
  - Let deliveries land at the current time.
- **Actual:** none of these exist. `quiz.test.ts` re-wraps `quiz.view` to:
  - capture each `ViewContext`, for `send`, `holder(c)` and `root`;
  - record every `onState`.
  
  It then flushes with `await setImmediate()` from `node:timers/promises`. That relies on every delivery being a microtask, which is internal.
- **Workaround:** the `start()` helper in `quiz.test.ts`.
- **Suggested fix:** `TestMatch.send(deviceId, msg)`, `TestMatch.view(deviceId)` (or at least its `root`), `TestMatch.heard(deviceId)` (states in order), and a `settle()`, or a `tick(0)` that flushes.
- **Severity:** papercut.

### 6. The headless DOM's `append` silently drops all but the first node

- **Where:** `packages/sdk/src/headless.ts:119-122` (`append(child)`); the whole of `HeadlessElement`, `:101-148`.
- **Expected:** a DOM view written for the browser runs under `createTestMatch`, or fails loudly where it can't.
- **Actual:**
  - `box.append(head, status, grid)` appended only `head`, with no error. The first test run showed only `['Ann · 0']` in the tree, and `t.input` hit a `<span>` with no listener.
  - There is no `replaceChildren`, `setAttribute`, `dataset` or `classList`.
  - `textContent` is a plain field: a parent's does not include its children's.
  - `append('text')` would throw [INFERENCE: a strict-mode write of `parent` on a string primitive; not run].
- **Workaround:**
  - One `append` per node, with a comment in `mount`.
  - The DOM is built once, and only `textContent`/`style.*` change afterwards.
  - A `texts()` test helper reads each element's own `textContent`.
- **Suggested fix:** `append(...nodes)` (one line), and a list of the supported DOM subset in `testing.ts`, or run DOM views under happy-dom.
- **Severity:** papercut (silent; it cost a failing run to find).

### 7. A Controller's view cannot size things in platform mm

- **Where:**
  - `packages/sdk/src/game.ts:108-119`: `ViewContext` has `screenMm` and `surface`, and the `Surface` (which holds `pxPerMm`) is for Tiles only.
  - The runtime has the value: `packages/sdk/src/match.ts:163` (`pxPerMm` in the view's `init`) and `packages/sdk/src/game-side.ts:257`.
  - `apps/pwa/src/device.ts:78-81`: 6.3 px/mm on Android and 6.1 on iPhone, while CSS `mm` is 3.78 px.
- **Expected:** size a DOM view in platform mm; the spec asks for "acceptable on a 65 × 140 mm phone".
- **Actual:** a view has to derive it: `root.clientWidth / ctx.screenMm.x`. CSS `mm` units would come out about 1.7× too small on an Android phone.
- **Workaround:** that derivation in `mount`.
- **Suggested fix:** `ViewContext.pxPerMm` on every Device (it is already in the `init` frame).
- **Severity:** papercut.

### 8. `JsonValue` rejects `readonly` arrays and `interface`s

- **Where:** `packages/sdk/src/types.ts:12`.
- **Expected:** `publish({ choices: QUESTIONS[i].choices })` from a `readonly` question bank.
- **Actual:**
  - `TS4104: The type 'readonly ["x", "y"]' is 'readonly' and cannot be assigned to the mutable type 'string[]'`.
  - An `interface` state with the same fields is not a `JsonValue` either, because it has no index signature.
  - Both were seen with a throwaway type probe under `tsc -p games/quiz`, since deleted.
- **Workaround:** copy (`[...q.choices]`), and declare states with `type`, never `interface`.
- **Suggested fix:** `readonly JsonValue[]` inside `JsonValue` (states are cloned anyway), plus "state types are `type` aliases" in the doc.
- **Severity:** papercut.

### 9. Timers survive a pause, but a deadline the game shows or scores against does not

- **Where:**
  - `packages/sdk/src/game.ts:57`: `timer(...)` returns `void`.
  - `docs/sdk-design.md:108`.
  - `games/pass/src/index.ts:84-91` does the same bookkeeping as Quiz.
- **Expected:** show a countdown and score by elapsed play time without tracking pauses by hand.
- **Actual:**
  - The timer itself pauses for free, but the game never learns when it is due, and `ctx.now()` keeps running through a pause.
  - So every game with a visible deadline or a speed score records `pausedAt` in `onPause` and shifts its own times in `onResume`. Pass and Quiz both do.
  - Forgetting this silently costs answers given after a pause their points.
- **Workaround:** Quiz's `onPause`/`onResume` move `askedAt` and `until`; `quiz.test.ts`, test 6, pins it.
- **Suggested fix:** `timer()` returns its shared due time, plus `ctx.dueAt(tag)` that moves with pauses. Or a `ctx.playTime()` that excludes paused time.
- **Severity:** papercut.

### 10. `onMessage(msg: M)` looks typed but is unchecked

- **Where:** `packages/sdk/src/game.ts:87-92`; `docs/sdk-design.md:107`.
- **Expected:** the doc says `msg` is whatever the sending view sent (only checked to be JSON), so the host validates it.
- **Actual:** the type suggests a `QuizMessage`, yet a buggy or modified phone can send `{ t: 'answer', choice: 99 }`.
- **Workaround:** the host checks `t`, that `choice` is an integer, and its range.
- **Suggested fix:** one sentence in the JSDoc and in §2.
- **Severity:** doc-gap.

### 11. Any Game's edit reloads every dev server's tabs, and the reloaded Host forgets its lobby

- **Where:**
  - `apps/pwa/src/games.ts:8`: an eager `import.meta.glob` of every `games/*/src/index.ts`.
  - The Host's lobby choices live in memory; only the room code survives a reload (`apps/pwa/src/main.ts:19-20`, `:33-37`).
  - The Vite log on my port-5183 server shows `page reload` for edits to `games/snake`, `games/air-hockey` and `games/tap-race` made by other agents.
- **Expected:** a running smoke survives edits to other Games, and a reloaded Host keeps its Game, Controller marks and Player names.
- **Actual:** each reload killed my Match mid-question. The Host came back with Air Hockey picked, no Controllers and "Player 1". The Peer rejoined, but the setup had to be redone.
- **Workaround:** an init script in both tabs that answers `new WebSocket(url, 'vite-hmr')` with an inert object.
- **Suggested fix:**
  - Keep the Host's lobby choices (Game id, roles, names) in sessionStorage next to `HOST_ROOM_KEY`.
  - `import.meta.hot.accept` in `games.ts`, so editing one Game does not reload the page.
  - For parallel smokes, a `?games=quiz` dev filter.
- **Severity:** papercut (a blocker for several agents smoking at once, without the workaround).

### 12. The Host's folded HUD bar covers the bottom of the Host's Tile

- **Where:** `apps/pwa/index.html:37-38` (`.sheet` fixed at the bottom; `.bar` padding `14px 16px`) and `:98-99` (the log line under it). `ViewContext` gives the whole screen as `screenMm`.
- **Expected:** a game knows which part of its screen is visible, or nothing covers the play area.
- **Actual:** during a Match the bar ("B7KG · Quiz · playing · Setup" and the last log line) covers about 80 CSS px, about 21 mm, at the bottom of the Host's 227 mm Tile. This was measured from the smoke screenshot. Quiz's Player list ends above it on a 420×860 tab only because of where the layout's fractions fall.
- **Workaround:** none; the board keeps its content above about 90 % of the height.
- **Suggested fix:** pass the covered inset to the view (`ViewContext.insetsMm`), or hide the bar during a Match until tapped.
- **Severity:** papercut.

### 13. The page's CSS reaches into a DOM view

- **Where:** `apps/pwa/index.html:29` (`button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }`). The in-process link mounts views in the page's document: `packages/sdk/src/in-process.ts:6-12`, `apps/pwa/src/main.ts:89-91`.
- **Expected:** the spec warns that a view must not reach outside `root`. Nothing warns about the reverse.
- **Actual:** a Game's `<button>` gets the PWA's reset. A view that leans on browser defaults would look different in the M3 iframe.
- **Workaround:** every property that matters is set inline.
- **Suggested fix:** a note in the doc now; a shadow root (or the iframe) later.
- **Severity:** doc-gap.

### 14. `new-game` leaves template text behind, and the README links docs that do not exist

- **Where:** `scripts/new-game.mjs:31-39` renames only identifiers and the README heading. The template text is in `games/_template/README.md:3`, `:7` and `:14`. `docs/guide/` did not exist while I worked.
- **Actual:**
  - `games/quiz/README.md` still said "The smallest complete Game … Copy it with `pnpm new-game`".
  - It listed `test/template.test.ts`.
  - It linked `docs/guide/your-first-game.md` and `docs/guide/api.md`, which did not exist.
  - The copied `index.ts` said "Tap: the smallest complete Game".
- **Workaround:** rewrote the README.
- **Suggested fix:** the script writes a fresh README stub for the new Game.
- **Severity:** papercut.

### 15. The host's `now()` is the harness clock only up to float error

- **Where:** `quiz.test.ts`, test 4: `until = ctx.now() + revealMs` came out as `10000.000000000025` at `t.now()` 6000.
- **Expected:** whole milliseconds equal to `t.now()`. Pass's test can assert `turnEndsAt: 5000` exactly, but only at time 0.
- **Actual:** after the clock has moved, exact equality on host times fails.
- **Workaround:** `toBeCloseTo`.
- **Suggested fix:** make the harness's clock exact, or say in `testing.ts` that it is not.
- **Severity:** papercut.

### 16. Drawing upright on a Tile has no recipe

- **Where:** `docs/sdk-design.md:90-93` (`Frame.ctx` "transformed so 1 unit = 1 mm (world mm on a Tile)") and `packages/sdk/src/types.ts:14` (`rot` "radians, clockwise about (x, y)").
- **Expected:** one line on how to draw text that reads upright on its own phone, as a board must.
- **Actual:** I had to read `packages/layout/src/surface.ts:21-26` and `:53-64` to confirm that `translate(tile.x, tile.y); rotate(tile.rot)` maps Tile-local mm into the world. No lobby makes a rotated Tile, so only a hand-built `MatchInfo` could check it, and I did not test it.
- **Workaround:** the board draws after that transform.
- **Suggested fix:** a `Frame.local()` that applies it, or the sentence in §2.
- **Severity:** doc-gap.

## Worked well

- **Test harness.** `createTestMatch` ran one Tile and three Controllers with nothing special. Holders (`holders` events, `holder(c)` on every view), targeted `publish` and the clone of every frame behaved as documented, on the first run.
- **Host model.** An event-driven host (`tickHz: 0`) with two timers, where the same tag replaces and `null` cancels, kept the question loop to about 30 lines. The only race to handle was a due `reveal` arriving after an early reveal: one guard in `onTimer`.
- **Pause.** Timers froze and resumed exactly (test 6). The only extra code is the deadline shift (entry 9).
- **Stamping.** `from.playerId` is the Holder, and a message from an idle Controller or a Tile carries none, so one check covers both.
- **Platform.** Quiz showed up in the HUD's Game row with no registration. The Controllers chip, Start and the result card ("Ann wins · Ann 2696", from `MatchResult` and the Player names) worked the first time. A trusted click on the Peer reached the board's canvas in about 65 ms.
