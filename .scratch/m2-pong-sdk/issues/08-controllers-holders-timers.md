# 08: Controllers, Holders, timers, and event-driven hosts

**What to build:** The SDK supports the game shapes beyond Pong that the design committed to, so a second game can be written without touching the platform: a Device in hand as a Controller with a private DOM or canvas view; a Game passing a Controller from Player to Player and seeing every input and message from it stamped with the current Holder; pause-aware timers; and a host with no tick loop at all. Pong is unchanged; the Lobby lets the Host mark a Device as a Controller.

View side: `role: 'controller'` views get no Surface or Tile, `screenMm` for their own screen, a `Frame` whose context is in screen millimetres, `mount(root)` for DOM UIs, `holder()` for the current Holder, `onHolder` on change; their `Input.world` is screen mm. Host side: `setHolder(controller, playerId | null)` validated against the frozen roster (reject on a non-Controller or unknown Player), `holderOf`, `onHolder`; the runtime broadcasts `holders` to the host game and every view, and `holders` precedes the first input or message stamped with the new Holder, including an input in flight during the handover. `send(msg)` from a view arrives at `onMessage(msg, from)` with `from` stamped the same way. `timer(tag, delayMs | null)` with same-tag replacement and cancel, firing `onTimer(tag, now)`, frozen across pause. A manifest `tickHz: 0` or a host without `tick` runs event-driven: inbound frames are drained as they arrive, never a `tick` frame. Lobby: `setRole(deviceId, 'controller')` removes that Device from the Layout and the manifest validation counts it as a Controller.

**Blocked by:** 05 (Playable Pong: input, scoring, end), 06 (Pause and resume across Device loss)

**Status:** ready-for-agent

- [x] E2E (three Tiles + one Controller): before `setHolder` a Controller touch arrives with no `playerId`; after `setHolder(c, 'alice')` it arrives with `playerId: 'alice'` and `role: 'controller'` and `world` in the Controller's screen mm; `holderOf(c)` is `'alice'`; every view's `onHolder` fired before that input was delivered
- [x] E2E: `setHolder` on a Tile Device or an unknown Player → `reject`, `holderOf` unchanged
- [x] E2E: a view `send(msg)` reaches `onMessage` with `from.playerId` = the current Holder; a message sent just before a handover is stamped with the previous Holder, one sent after with the new one
- [x] E2E: `timer('turn', 1000)` fires `onTimer` after 1 s of fake time; re-arming replaces; `null` cancels; a pause at 600 ms and resume later fires it 400 ms after resume
- [x] E2E: a probe game with `tickHz: 0` receives inputs and messages promptly with no `tick` frames ever
- [x] Lobby test: a Device marked `controller` is absent from `match.tiles`, present in `match.devices` with that role, and counts toward the manifest's Controller range
- [x] Smoke (three tabs): mark one as Controller in the lobby, start a probe game whose Controller view is a DOM button that `send`s; the Host HUD log shows the message with the Holder's name after the Host assigns it
- [x] Typecheck and suite green; Pong source unchanged

## Comments

### 2026-11-07

**Changed**
- `packages/sdk/src/types.ts`: `HolderEntry { deviceId, playerId | null }`, exported from the index.
- `packages/sdk/src/wire.ts`:
  - `Shared.holders { holders: HolderEntry[] }`; both `init`s carry `holders`.
  - `HostDown`: `msg { msg, from: Sender }`, `timer { tag, now }`. `HostUp`: `set-holder { deviceId, playerId }`, `timer { tag, delayMs | null }`, and the new `handlers { tick: boolean }` (see Deviations). `ViewUp.send { msg }`.
  - `NetDown` gains `holders`, `NetUp` gains `send`. `isNetDown` checks the holder entries; `isNetUp` takes `send` when `msg` is plain JSON (`json.ts` `isJson`).
- `packages/sdk/src/holders.ts` (new): `holderRefusal(match, controller, playerId)`, the one rule both sides apply: `"d9" is not a Device of the Match`, `d1 is a Tile, not a Controller`, `"p-zed" is not a Player of the Match`.
- `packages/sdk/src/game.ts`:
  - `HostContext.setHolder`, `holderOf`, `timer`; `HostHandlers.onMessage(msg, from)`, `onHolder(controller, playerId)`, `onTimer(tag, now)`.
  - `ViewContext.holder(controller?)` (default this Device), `send(msg)`; `ViewHandlers.mount(root)`, `onHolder(controller, playerId)`.
  - Docs for each, including event-driven hosts and what `end` rejects.
- `packages/sdk/src/game-side.ts`:
  - Host: `holderOf` reads what the game set (valid calls apply at once; refused ones change nothing); `onHolder` fires on each change the platform broadcast. `setHolder`/`timer` always post, so the runtime rejects bad and after-`end` ones. After its factory returned, the host posts `handlers { tick }`. `msg` → `onMessage`, `timer` → `onTimer`; none after `end`.
  - View: `holder()`, `send()` (`assertJson` at the call site), `mount(root)` right after the factory (guarded, not fatal), `holders` → `onHolder` per changed Controller. The local echo carries `playerId` on a Controller with a Holder.
- `packages/sdk/src/match.ts`:
  - A holder map (every Controller, `null` at first) goes into both `init`s.
  - Ingest stamps `playerId` from the map onto input and `send` (`take`); both are dropped while paused. The inbox holds input, messages and due timers in arrival order. `drain` sends runs of input as one `input` frame and each message/timer as its own frame.
  - `set-holder`: rejected after `end` or by `holderRefusal`; a no-op to the current Holder; otherwise the inbox is drained first (stamped with the previous Holder), then `holders` goes to the host game, the Host's view and the net, and a `holders` event to the platform. A Peer passes a `holders` frame to its view (and reports `holders`) only when it changed its map. On resume the Host re-sends `holders` to the Peers (before the retained states) while any Controller has a Holder, so a Peer back as a new page learns it.
  - Timers: `Env.after` per tag, due on the shared clock. Same tag replaces, also one already due in the inbox; `null` cancels. A non-string tag, or a delay that is not a finite number ≥ 0, is rejected. A pause hands over the messages and due timers already accepted (after the cancels), then freezes armed timers with what they have left. A timer set while paused waits for the resume. Resume re-arms from its `now`, and close stops them all.
  - Event-driven: no step and no delivery until the host's `handlers`. Then `tick && tickHz > 0` steps as before; otherwise input, messages and timers are handed over as they arrive and no `tick` is ever posted. A second `handlers` is `protocol`.
  - `MatchEvent.holders`.
- `packages/sdk/src/testing.ts`: doc only (`t.input` hits the topmost element, so a DOM view's own button).
- `packages/sdk/test/harness.ts`:
  - The probe's message type is `JsonValue`.
  - It records `messages`, `timers`, `mounts`, view `onHolder` in `seen`, and a `journal` of host `onInput`/`onMessage`/`onHolder`/`onTimer` and view `onHolder` in the one order they ran.
  - Options `tick: false` (no `tick` handler) and `mount: true`.
- `packages/sdk/test/controllers.e2e.test.ts` (new; Host + 3 Peers, d3 the Controller), 7 tests:
  1. The Controller view has no Tile/Surface, `screenMm` {70, 150}, a draw transform of pxPerMm × dpr, and `mount(root)` with `ctx.root`. A touch before any Holder arrives as `{d3, controller, …, world {10, 20}}` with no `playerId` key. A touch already sent when the host calls `setHolder(d3, 'p-ann')` arrives with `playerId: 'p-ann'` at world {30, 40} (screen mm). `holderOf` is `'p-ann'` at once. In the journal, the host's `onHolder` comes first and every view's `onHolder` comes before that input. Every Device has one `holders` event, and `holder(d3)` is `'p-ann'` on every view (`null` for a Tile's own). The in-flight echo has no Holder; the next one has it, and so does its host input. A Tile's input has no `playerId`.
  2. `setHolder` on Tile d1, unknown d9 and unknown p-zed, plus `timer('turn', -1/NaN)`: five `reject` frames with those reasons and five Host `log` events; `holderOf` stays `p-bo`, with no new `holders` anywhere. `end` + `setHolder` + `timer` in one tick → two "… the Match has ended" logs, `holderOf` unchanged, `ended`/`closed`.
  3. `send`: from d3 with no Holder and from Tile d1 → `from` with no `playerId`. A message that reached the Host just before the handover to Bo is delivered (as `p-ann`) before `onHolder(p-bo)`. One sent after is `p-bo`. One sent before the handover back to Ann, but arriving after it, is `p-ann`. Messages sent while paused never arrive, even after the resume.
  4. Timers: `turn` after exactly 1000 ms, before its step's tick. Re-armed at 500 ms, it fires only at 1500. Cancelled, it never fires, while `other` (100) does. Paused 600 ms in: no `onTimer` and no `timer` frame on the host link for 3 s. After the resume, `later` (set while paused, 100) fires at resume + 100 and `turn` at resume + 400.
  5. `tickHz: 0`: a Peer touch reaches the host game right after the network hop, with no further animation frame. The state it publishes reaches all four views. A `send` and `timer('t', 100)` arrive the same way. 100 frames later there are no ticks and no `tick` frame on the host link.
  6. A host without `tick` at 50 Hz: also event-driven, with no `tick` frame.
  7. d3 holding `p-ann` drops and comes back as a new page. Its new view sees the Holder before the retained state and `resume`, and its platform gets `holders`.
- `games/pass` (new, `@mgc/pass`; depends on `@mgc/sdk` only): **Pass**, the reference Controller/Holder game.
  - Manifest: 1–4 Tiles, exactly 1 Controller, 1–4 Players, `tickHz: 0`, any template. The host has no `tick`.
  - The factory hands the Controller to the first Player and arms `timer('turn', 5000)`. Each `onTimer` passes it on; after 3 rounds `end` gives scores = taps and a ranking.
  - `onMessage('tap', from)` credits `from.playerId` and logs `"Ann tapped (1)"`; `onHolder` logs `"Ann holds the Controller"`. `onPause`/`onResume` move the published turn end by the paused time.
  - The Controller view is DOM: `input: 'off'`, and `mount` fills the root with one button that `send`s on `pointerdown`, labelled from `holder()`/`latest()`. Each Tile `draw`s the turn, the seconds left and the taps.
  - `test/pass.test.ts` (2 tests): the manifest and an import scan; and a play-through via `createTestMatch` (taps through the DOM button, the handover at 5 s, a 10 s pause that freezes the turn and drops a tap, the end with `{p-ann: 2, p-bo: 3}`, ranking `[p-bo, p-ann]`, the log lines, no faults).
  - Root `typecheck` adds `tsc -p games/pass`; `pnpm-lock.yaml` updated.
- `apps/pwa`:
  - `lobby.ts`: `Lobby.roleOf(deviceId)` and `Lobby.game` (the manifest id of the Game `match` runs). The state message carries `controllers` (every roster Device marked Controller) and `game`, and a Peer validates both. The Host records `game.id` in `start`.
  - `hud.ts`:
    - `HudOptions.games` replaces `game`.
    - Host sheet: a Game picker (`.games`); a "Controllers" chip row, one chip per present phone, pressed = Controller → `setRole`, rebuilt only when phones or roles change; "Start <Game>"; bar meta with the running Game's name; Controllers listed in the roster as "C · Controller".
    - Peer strip: "Controller · hold this phone in hand".
  - `main.ts`: `GAMES = [pong, pass]`. `begin` runs the module whose id is `lobby.game`; a Device without it logs and sits the Match out. Its link is per Match.
  - `index.html`: chip styles. `package.json`: `@mgc/pass`.
  - `test/lobby.test.ts`, new test: d2 marked Controller (d9, not in the roster, ignored) leaves the Layout. The default Players move to d0/d1. A 0-Controller manifest is refused with "Duel needs no Controllers; 1 present", and 2–2 with "… 2 Controllers; 1 present". The started Match has tiles d0/d1 and devices d0/d1 `tile` plus `{ deviceId: 'd2', role: 'controller', name, screenMm: {65, 140} }` (no Tile), bounds 134 × 140. `game` reaches the Peer. The role is fixed while running and back to Tile after `close`.
- Docs:
  - `docs/sdk-design.md`:
    - §2: the view `holder(controller?)`/`onHolder(controller, playerId)` as shipped, and a "Controllers, Holders, messages and timers" rules block;
    - §3: `holders` events;
    - §4: `handlers` in `HostUp`, plus the flows for handlers, holders, timer and the refusals;
    - §5: the Holders ordering as shipped, event-driven stepping, timers while paused, and the reject texts;
    - §6: `games/pass` and the pwa's Game choice;
    - §8: `controllers.e2e.test.ts`, and `t.input` on a DOM view.
  - `docs/platform-design.md` §5: `game`/`roleOf`, Controllers and the Game (roles, the Host sheet, which Game runs), and the Lobby test.
  - `docs/PLAN.md` repo layout: `games/pass`.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pass, pwa).
- `pnpm test`: 13 files, 72 tests passed.
  - sdk: 9 match E2E, 4 pause E2E, 11 faults E2E, 7 controllers E2E, 6 seam.
  - pong: 6. pass: 2.
  - pwa: lobby 4, result 4, pause 2.
  - core: 8. layout: 9.
- Mutation check: with the drain before `holders` commented out, test 3 fails. With the timer freeze on pause commented out, test 4 fails. Both lines are restored.
- `git diff --stat -- games/pong`: empty.
- Smoke: `pnpm dev` on :5174 (HTTPS; :5173 was taken), headless managed Chromium, three 420×860 tabs (dpr 1.25) over real Trystero, room GNG5. Everything was done through the pwa; nothing was injected.
  - All three tabs synced. A trusted click on the third chip under "Controllers" marked phone 3 (`f6841ec1…`) as a Controller.
    - The Host sheet then read "2 phones · Row". The roster showed "C · Windows · Controller", and the Peer's strip "Controller · hold this phone in hand" (lobby screenshot).
    - Players were renamed Ann/Bo (phone 1 / phone 2). Picking Pass made the button read "Start Pass".
  - **Start Pass.** The Controller tab showed one full-screen button, "Ann: tap! (0)".
    - The Host's folded bar read "Pass · playing" and "log · host: Ann holds the Controller".
    - After a trusted click on the Controller's button, the button read "Ann: tap! (1)", and the Host log added "host: Ann tapped (1)".
    - After the 5 s turn, the button read "Bo: tap! (0)" and the log "Bo holds the Controller". Two clicks gave "Bo tapped (1)" and "Bo tapped (2)".
    - Screenshots: the Host Tile drawing "Bo's turn · 2 · Ann 1 · Bo 2" with the bar "log · host: Bo tapped (2)"; the Controller "Bo: tap! (2)"; the Peer Tile showing the same as the Host. The open sheet's game log lists the lines (screenshot).
  - The turns went on to the end. The Host log read: Ann holds / Ann tapped (1) / Bo holds / Bo tapped (1) / Bo tapped (2) / Ann holds / Bo holds / Ann holds / Bo holds / "match closed (ended): the game ended the Match". All three tabs showed "Bo wins · Bo 2 · Ann 1".
  - Picking Pong with the Controller still marked refused: "Pong needs no Controllers; 1 present". After unmarking, Pong started on all three tabs ("Pong · playing", a canvas on each). "End match" gave "Match stopped · Ended from the host phone" on all three.
  - No page errors in any tab.
- Not observed:
  - real phones (ticket 09);
  - a pause or a dropped Controller in a browser (the E2E covers the freeze and the rejoin);
  - real multi-touch on a Controller;
  - a message in flight during a handover in the browser (E2E only);
  - the iframe adapter.

**Deviations / notes for later tickets**
- **New Up frame `handlers { tick }`** (additive, still v1). Whether a host has `tick` is known only game-side, after its factory runs, so the runtime cannot learn it from the manifest (`tickHz: 0` covers only half of "or no `tick`"). The host game posts this once, right after its factory. The runtime starts steps, or event-driven delivery, only when it arrives. That keeps "never a `tick` frame" true with the M3 iframe's macrotask round trip too. In-process, the first tick lands at the same time as before.
- **View `onHolder(controller, playerId)` and `holder(controller?)`.** The design had `onHolder(playerId)` and `holder()` for a Controller's own view. The checkbox needs "every view's `onHolder`", and a Tile only makes sense of it with the Controller named, so views get the host's signature. `holder()` without an argument is still this Device's own. A Controller's own view checks `controller === ctx.deviceId`.
- **`holderOf` applies at once** for a valid `setHolder` (game-side check with the same `holderRefusal`); `onHolder` comes when the platform's broadcast arrives. Refused calls change nothing.
- **The drain at a handover.** An accepted `set-holder` hands the host game the already accepted input and messages before `holders`, so a ticking host can get input between ticks at a handover. The host game sees one clean cut, and the design's "holders precedes the first input/msg stamped with the new holder" holds. The same drain happens at a pause, for messages and due timers only (input is still dropped and cancelled).
- **Timer delays run from when the host runtime received the request** (the wire has no `at`), so chained turn timers drift by that latency, one frame in `createTestMatch`. `pass.test.ts` gives the last turns 20 ms of slack for it.
- **Game picker and `lobby.game`.** A probe in the repo needed a way to be started, so the Host sheet got a Game picker. Peers must load what the Host started, so the lobby state carries the manifest id (outside `MatchInfo`, which stays the SDK's). The probe is `games/pass`, kept as the documented reference for Controllers, Holders, timers and an event-driven host (sdk-design §6).
- For 09:
  - A Controller's button sends on `pointerdown`.
  - The Controllers chips are new UI, unchecked on phones.
  - Trystero's slow leave (10–13 s, ticket 06) also delays the pause when a Controller drops.
