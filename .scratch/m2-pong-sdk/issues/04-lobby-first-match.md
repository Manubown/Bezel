# 04: First Match on phones: Lobby Start runs a Game on every Device

**What to build:** The Host arranges the phones as in M1, sees the two outer phones listed as Players with editable names, presses **Start**, and every phone switches at once from the arrangement preview to a running Game — a trivial tracer Game (the M1 ball, now as a `defineGame` whose host ticks and publishes the ball and whose views draw it) that crosses the bezels under host authority. A phone joining after Start waits in the lobby. Start is refused with a reason when the manifest cannot be satisfied by the phones present.

The pwa gains a `Lobby` module over a `Session` with one interface for both roles: live `layout` preview, `match` (set once, frozen), `onChange`, and Host-only `setTemplate`, `setRole`, `setPlayers`, `start(manifest)`, `close` (no-ops on a Peer, where `layout`/`match` arrive from the Host). `start` validates the manifest (Tile/Controller/Player ranges, minimum Tile size, supported templates), builds `MatchInfo` (matchId, seed, tickHz, players, devices with roles and Tiles, tiles in Layout order, bounds), freezes it and broadcasts it. Player ids are platform-issued persisted UUIDs; default Players for a two-player manifest are the Devices on the two outer Tiles. The HUD renders from the Lobby and the Session and offers template, Player names, Start. The main entry becomes transport → session → lobby → `runMatch` → lobby again when the Match closes; the M1 grid scene is the lobby's stage preview.

**Blocked by:** 02 (Session with Device identity and rebinding), 03 (SDK runtime, verified end-to-end in memory)

**Status:** ready-for-agent

- [x] Lobby test over a Session on the in-memory hub: `start` throws with a reason for a manifest needing 3 Tiles when 2 are present, and for a minimum Tile size larger than a present Tile
- [x] Lobby test: after the Host's `start`, the Peer's lobby `match` deep-equals the Host's; `setTemplate` after `start` is ignored; a Device joining after `start` is absent from `match.devices`
- [x] The tracer Game imports only the SDK and draws nothing until its first state
- [x] Smoke (two tabs): preview → Start → ball crossing the bezel on both tabs with no visible jump; the Host's own Tile is driven by the same view path as the Peer
- [x] Smoke: a third tab opened after Start shows the lobby strip, not the Game
- [x] Typecheck and suite green; M1 preview behaviour intact before Start

## Comments

### 2026-11-07

**Changed**
- `apps/pwa/src/lobby.ts` (new): `openLobby(session, pxPerMm, playerId): Lobby`, one interface for both roles.
  - It exposes `layout`, `surface`, `players`, `seatOf(playerId)`, `match` and `onChange`. The Host-only methods are `setTemplate`, `setRole`, `setPlayers`, `start(manifest)` and `close`.
  - Host:
    - It builds the Layout from the present Tile-role Devices in roster order. It rebuilds only when the `template|id:w×h` key changes.
    - It sends the whole lobby state (`layout`, `players`, seats, `match`) to every Peer on the `lobby` channel when that state changes. A Device that appears without a change still gets it directly.
    - Each Peer reports its persisted Player id once its Session is `ready`.
    - The default Players are the ones seated at the first and last Tile in Layout order, named "Player N".
    - `setPlayers` overrides that choice until the Tiles change. Names stay with their Player id.
  - `start(manifest)` refuses with an `Error` whose message is the reason. It checks, in this order:
    - the template is in `templates`;
    - the Tile and Controller ranges;
    - `minTileMm`, naming the first phone that is too small;
    - every Device in the Match is synced and has reported its Player id (otherwise "Phone N is still joining");
    - Player ids are distinct;
    - the Player range.
  - Then `start` builds `MatchInfo`:
    - `matchId` is a `crypto.randomUUID()`;
    - `seed` is a random u32;
    - `tickHz` is the manifest's value, or 60;
    - `players`;
    - `devices` is the present Devices in roster order, with role, name, Tile and `screenMm`;
    - `tiles` is in Layout order;
    - `bounds`.
  - `start` deep-freezes the `MatchInfo` and sends it before anything local reacts. While `match` is set, the setters and a second `start` are ignored or refused. `close()` clears `match` on every Device.
  - Peer: it accepts lobby state only from `roster()[0]`, validates it into fresh deep-frozen objects, and keeps the `match` object it already has for the same `matchId`. It clears everything when its Session goes `searching`. Its setters and `close` are no-ops.
- `apps/pwa/src/hud.ts` (new): the platform overlay, rendered from the lobby, the Session and a `Play` record kept by `main`.
  - Host sheet:
    - join code and QR;
    - template picker;
    - Player name inputs, which are not rebuilt while you type;
    - Start, with the refusal reason, which clears on the next lobby change;
    - "End match" while playing;
    - roster with placement hints, Player names, "joins the next match" and sync.
  - The sheet folds away while the Host plays and reopens afterwards.
  - The Peer strip hides while that Device plays. A Device not in the running Match shows "Match in progress · you join the next one".
  - Device and Player names are HTML-escaped (they come off the network).
  - `placementHint`, `syncStats` and `statusDot` moved here from `main.ts`.
- `apps/pwa/src/main.ts` (rewritten): transport → `hostSession`/`joinSession` → `openLobby` → `runMatch` → lobby.
  - `runMatch` starts on a `lobby.match` that lists this Device, once per `matchId`. It mounts on the new `#game` layer, with `authority` on the Host.
  - `send` addresses a Peer's frames to the Host (`roster()[0]`) and passes the Host's `to` through.
  - Frames from `session.onMessage('match')` are delivered on the Host, and on a Peer only when they come from the Host.
  - On `closed`, the layer hides and `lobby.close()` runs; on the Host that reopens the lobby everywhere.
  - A running Match whose `lobby.match` disappears is stopped: `link-lost` when the Session went `searching`, otherwise `aborted`.
  - The stage canvas draws the preview (or the metronome) only while this Device is not playing.
  - The game is `@mgc/tracer` through `inProcessLink`.
- `apps/pwa/src/scene.ts`: `drawScene` became `drawPreview(frame, surface, layout)`: the M1 grid, bounds and phone numbers. The ball moved into the tracer.
- `apps/pwa/src/device.ts`: `claimPlayerId(deviceId)` persists one UUID per Device id in localStorage (`mgc.playerIds`). `deviceSize` was removed; the lobby computes sizes.
- `apps/pwa/index.html`: `<div id="game" hidden>` (positioned, opaque) between stage and HUD; a global `[hidden]` rule; styles for players, Start/End and the reason line. `apps/pwa/package.json`: depends on `@mgc/sdk` and `@mgc/tracer`. `apps/pwa/tsconfig.json` includes `test`.
- `games/tracer` (new, `@mgc/tracer`): `defineGame<Ball, never>` with manifest tiles 2–4, controllers 0, players 2, any template, and the default tickHz.
  - The host starts the ball at the World centre with a seed-picked diagonal, at 120 / 74 mm/s. Every tick it moves the ball by an exact reflection inside the bounds inset by R, and publishes `{ x, y, vx, vy }`.
  - Views return early without a state. Otherwise they extrapolate up to 100 ms on the shared clock with the same reflection, and draw the M1 ball plus an 8-step trail in world mm.
  - It imports `@mgc/sdk` only. `@types/node` is a devDependency for the test.
- `apps/pwa/test/lobby.test.ts` (new), over `MemoryHub` with fake timers:
  1. Refusals: "Duel needs 3–4 Tiles; 2 present", "Phone 1 is 65 × 140 mm; Duel needs Tiles of at least 70 × 100 mm", the template refusal, and "Phone 3 is still joining" for a Peer still syncing. No `match` appears anywhere.
  2. Freezing and propagation:
     - the default Players are the seats at Tiles d0 and d2, renamed via `setPlayers`;
     - the `MatchInfo` has those Players, the tiles/devices/`screenMm`/bounds/tickHz, and is deep-frozen;
     - a second `start` is refused;
     - the Peer's `match` deep-equals the Host's and is frozen;
     - `setTemplate`/`setPlayers` after `start` change nothing on either side;
     - a late `d3` is absent from `match.devices`, and its own lobby knows the Match runs.
  3. `close` on a Peer is a no-op and a Peer `start` throws. The Host's `close` clears `match` on both, the lobby takes `setTemplate` again (and the Peer sees it), and a new `start` works.
- `games/tracer/test/tracer.test.ts` (new):
  - the import scan of every file under `src` gives only `@mgc/sdk`, and `package.json` depends on `@mgc/sdk` only;
  - the Host alone (`runMatch` + `inProcessLink` on a recording headless mount): frames painted before the first fixed step contain no game canvas calls, and the frame after it draws an arc with radius 6 within 2.1 mm of the published state;
  - 300 frames: every state is inside the inset bounds, each step moves the ball no more than its speed allows, and the ball is wholly on Tile 2 and later wholly back on Tile 1.
- `vitest.config.ts` includes `apps/**/*.test.ts`. Root `typecheck` adds `tsc -p games/tracer`. `pnpm-lock.yaml` was updated with `pnpm install --no-frozen-lockfile`.
- Docs:
  - `docs/sdk-design.md` §4 lists `state.to?: DeviceId`, and §5 Retention explains it.
  - `docs/platform-design.md` §5 shows the shipped Lobby interface and wiring.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, tracer, pwa).
- `pnpm test`: 7 files, 31 tests passed (lobby 3, tracer 3, plus the earlier 25).
- Smoke: `pnpm dev` (on :5174 because :5173 was in use), headless Chromium, 420×860 tabs over the real Trystero transport.
  - Host alone, Start → "Tracer needs 2–4 Tiles; 1 present". The preview showed the grid with "1".
  - A Peer joined and showed "Phone 2 of 2". The Host listed P1/P2 at phones 1/2. Renaming them to Ann/Bo showed on the Host roster and the Peer strip. Row/Grid/Column gave the M1 hints on both tabs.
  - Start: both tabs hid the preview and each got one SDK canvas inside `#game`. The Peer strip hid and the Host sheet folded to "Tracer · playing".
  - Ball positions: I wrapped `CanvasRenderingContext2D.prototype.arc` in both tabs and logged the world-mm position each view drew, with the wall time and the context transform, for 8 s.
    - Every draw on both tabs came from the canvas in `#game`. The transform offsets were 0 mm on the Host and 115.11 mm (111.11 + 4 gap) on the Peer, at scale pxPerMm × dpr.
    - Host and Peer agreed on the ball's world position at the same instant: median 0.05 mm, p95 0.19 mm. The maximum, 1.41 mm, was at the right-wall bounce and comes from linear interpolation between the Host's 30 fps frames.
    - Within 99–127 mm of the bezel the disagreement was median 0.05 mm, max 0.19 mm.
    - There were 4 bezel crossings. The fastest frame-to-frame motion was 142 mm/s on the Host and 154 mm/s on the Peer, against a true 141 mm/s.
  - Screenshots taken at a crossing show the ball cut at the Host's right edge and its sliver at the Peer's left edge, at the same height.
  - A third tab opened mid-Match showed the strip "Match in progress · you join the next one" over the preview grid "3", with no game canvas. The Host roster tagged it "joins the next match", and the Host and Peer kept playing.
  - "End match" brought all three tabs back to the lobby. The Host showed "Last match: aborted", the third tab showed "Phone 3 of 3", and the previews were back. Start again ran the Match on all three tabs, and End returned them all to the previews.
  - No page errors in any tab.
- Not observed: real phones (ticket 09). The Host tab painted at about 30 fps in the headless browser and the Peer at 60. Ticks kept 60 Hz through catch-up steps.

**Deviations / notes for later tickets**
- `openLobby(session, pxPerMm, playerId)` takes a third argument: the Device's persisted Player id has to reach the Host, and core's `DeviceInfo` reader drops unknown fields. `pxPerMm` builds `lobby.surface`, this Device's preview Surface.
- Additions to the §5 interface: `surface`, `players`, `seatOf`. The HUD needs them to list "the two outer phones as Players".
- `close()` means "this Match is over; reopen the lobby on every Device", not "dispose the lobby".
- A Peer's `start` throws "Only the Host starts a Match" instead of being a no-op, because it must return a `MatchInfo`.
- The lobby preview no longer draws the M1 ball. Per the ticket and the cut-over note, it is the grid scene, and the ball is the tracer Game. Everything else in the M1 preview is unchanged: the grid continuous across bezels, the bounds, the phone numbers, the placement hints, and the Peer metronome before a layout.
- `start` also refuses while any Match Device is not yet synced or has not reported its Player id. A Device whose Session is not `ready` drops its sends, and its clock is not shared yet.
- The Host's live Layout keeps following the roster during a Match, as the preview for the next one. A late joiner can therefore become the new outer Tile, and the default Players for the next Match follow it.
- `MatchInfo` does not name the Game; the pwa runs one (`GAME` in `main.ts`). Ticket 05 swaps `tracer` for Pong there and can delete `games/tracer`. A second Game needs the lobby state to carry a game id (additive).
- An "End match" Host action (`handle.stop('aborted')`) was added so that the lobby→Match→lobby loop can be exercised; the tracer never ends. Ticket 05's result overlay and ticket 07's close reasons plug into `onEvent` in `main.ts`, which today only logs `fault` events to the console and records `closed.reason` for the HUD.
- For ticket 06: by design, though neither tested nor smoke-checked, a Peer that reloads mid-Match rebinds, receives the lobby state and re-runs the same `matchId`, because its new page has not joined it yet. `setPaused` is not wired yet: `onDeviceLost`/`onDeviceBack` → `setPaused` belongs in `begin` in `main.ts`.
- For ticket 08: `setRole` is implemented but not tested here; ticket 08's Lobby test covers it. A Controller leaves the Layout, counts against `controllers`, and is put in `match.devices` with `role: 'controller'` and no Tile. There is no HUD control for it yet.
