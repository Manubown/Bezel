# 04: pwa: the Host's lobby survives a reload

**What to build:** A reloaded Host comes back with the same template, Tile order, roles, Game, seats and bot slots once its Devices rebind; the party does not re-do the lobby. Spec D10 in `../spec.md`.

**Files (owned by this ticket):** `apps/pwa/src/lobby.ts` (the Host lobby: `HostLobby`/`LobbyBase` state and a `LobbyStore`), `apps/pwa/test/lobby.test.ts`, `apps/pwa/src/main.ts` only the one line that passes the store (coordinate: ticket 03 edits `main.ts`'s `follow`; touch nothing else there), `docs/guide/troubleshooting.md` ("the host phone reloaded"), `docs/platform-design.md` §3 lobby paragraph.

**Status:** resolved

## Change

1. `lobby.ts`: a `LobbyStore` interface `{ load(): SavedLobby | undefined; save(s: SavedLobby): void }` with a `sessionStorage` implementation keyed `mgc.lobby.<CODE>` (the Host room code is already kept in `sessionStorage` under `mgc.hostRoom`; same lifetime, same tab). `SavedLobby`: `{ template, order: DeviceId[] (Tile order), roles: Record<DeviceId, 'tile' | 'controller'>, game: string | undefined, seats, bots: number }`: the Host's decisions, nothing derived (`layout`, `surface`, `match` are rebuilt). Save on every Host-side change that alters one of these (debounced to the next macrotask is fine); never save a `match`.
2. Restore: `openLobby(session, pxPerMm, playerId, store?)`. A Host lobby with a saved configuration applies it as a *pending* order: Devices listed in `order` take their saved position and role when they appear in the roster (rebind); Devices not in the saved order append as today; Devices in the saved order that never come back are simply absent (no ghost rows). `game`, `seats` and `bots` apply at once. The pending order lives until every saved Device has appeared or the Host changes the order by hand (then the saved file is overwritten with the new truth).
3. `main.ts`: pass the `sessionStorage` store on the Host (one argument; Peers get none).
4. Tests (`apps/pwa/test/lobby.test.ts`): a memory `LobbyStore`; a Host lobby with Devices `d1, d2, d3` set to `grid`, order `[d3, host, d1]`, `d2` a Controller, Game `quiz`, seats `controllers`, 1 bot; a *new* Host lobby over a fresh Session with the same store and the same Devices rebinding in a different join order reproduces the saved template, order, roles, game, seats, bots; a Device not in the saved order appends at the end; changing the order by hand drops the pending part; a Peer lobby never saves.
5. Docs: troubleshooting "The host phone reloaded": what comes back (lobby) and what does not (the running Match; Peers see "The host phone restarted"), and the tip to install the PWA (no pull-to-refresh). `docs/platform-design.md` §3 lobby paragraph: the saved configuration.

## Acceptance

- [x] `pnpm typecheck`, `pnpm test` green; `lobby.test.ts` has the four new clauses
- [x] Browser smoke (`pnpm dev`, Host + 2 Peer tabs, real Trystero): set `grid`, move a Device, make one a Controller, pick Quiz; reload the Host tab; within a few seconds the Peers re-attach and the Host sheet shows the same configuration; Start works. Note the time from reload to a complete roster in the comment.

## Comments

### 2026-11-08, HostLobbyPersist (agent)

**Changed**
- `apps/pwa/src/lobby.ts`: `SavedLobby` (`template`, `order` = the full Tile order, every roster Tile present or not; `roles` by `deviceId`; `game`; `seats`; `bots` = the bot slots), `LobbyStore { load; save }`, `sessionLobbyStore(code)` on `sessionStorage` `mgc.lobby.<code>`, `readSaved` (validates what it loads: a file that is not a `SavedLobby` is ignored and the lobby starts fresh). `openLobby(session, pxPerMm, playerId, store?)`: the store goes to `HostLobby` only. `HostLobby` restores template, Game, seats, bots at once; the saved order and roles go into `order`/`roles`, and the saved order's Devices not yet in the roster are `pending`: since `tileOrder()` lays out present Devices only, a Device takes its saved place when it rebinds, unknown Devices follow in roster order (at the end), and a Device that never returns has no row and leaves no gap. `pending` empties as Devices appear; `setOrder` (and so `move`) drops the pending Devices' places first. `refresh()` ends with `save()`: the decisions snapshot is compared as JSON and given to the store only when it changed (no Match, nothing derived). New `Lobby.picked` (Host: the id `setGame` got, restored from the file; Peer: undefined); `setGame` now records the id even when the seats mode stays the same. `isSeats` shared by `readState` and `readSaved`.
- `apps/pwa/src/main.ts`: the `openLobby` line passes `room ? undefined : sessionLobbyStore(code)`, plus the import of `sessionLobbyStore`. Nothing else in `main.ts`.
- `apps/pwa/src/hud.ts` (approved by Main, one spot, lines 211-218): the Game row starts from `lobby.picked`; the `mgc.game` sessionStorage key is gone. The lobby's saved `game` is now the only record of the pick.
- `apps/pwa/test/lobby.test.ts`: `table(peers, store?)` hands the store to the Host (`join` takes one as a 4th argument); `tabStorage()` stubs `sessionStorage` with a Map (`vi.unstubAllGlobals` in `afterEach`); `decide(store)` builds the ticket's Host (d1–d3, Grid, order d3/Host/d1, d2 Controller, Quiz `seats: 'controllers'`, bot in slot 0), then disconnects that Host. Four new tests: (1) the saved file is exactly `{ template: 'grid', order: ['d3','d0','d1'], roles: { d2: 'controller' }, game: 'test.quiz', seats: 'controllers', bots: [0] }`; a new Host over a fresh hub with d1, d3, d2 rebinding in that order shows `[d0, d1]` while d3 is away, then `[d3, d0, d1]` on Host and Peer, d2 a Controller on Host and Peer, `picked`/`seats` restored, the file unchanged, and the bot back in slot 0 under an `'ends'` Game; (2) d4, not in the file, joins at the end, and d3 coming back later still goes first (`[d3, d0, d1, d4]`); (3) `move('d1', -1)` before d3 is back gives `[d1, d0]`, the file now says `order: ['d1','d0']` (d2's role kept), and d3 then joins at the end; (4) a Peer given a `sessionLobbyStore` with a saved file neither applies it (it follows the Host: column, `[d0, d1]`, `picked` undefined, `'ends'`) nor writes to `sessionStorage`.
- Docs: `docs/guide/troubleshooting.md` new "The host phone reloaded" (what comes back, what does not: the Match, Peers' "The host phone restarted"; install the app, no pull-to-refresh, keep the Host's screen on; a new tab starts afresh); the "Every phone reloads … when someone saves a file" entry now says the lobby comes back. `docs/platform-design.md` §5: `picked`, the `openLobby`/`sessionLobbyStore` signatures, "the saved configuration" in Hides, a new "Saved configuration (connectivity-1 04, spec D10)" block (what is saved, restore and pending order, what does not survive), and the new tests in "Tests at the interface". `getting-started.md:44` and `running-on-phones.md:43` describe the Game pick as kept with the lobby in `mgc.lobby.<CODE>`; `running-on-phones.md:20` mentions the lobby coming back after a Host reload.

**Verified**
- `pnpm typecheck`: green (36.9 s wall).
- `pnpm test`: 23 files, 162 tests passed (51.5 s). `apps/pwa/test/lobby.test.ts`: 13 tests (9 existing + 4 new) in 397 ms.
- Browser smoke: not run here. The integrator does it later (Host + 2 Peer tabs on `pnpm dev`, grid / move / Controller / Quiz, reload the Host tab, same configuration back, Start works) and notes the time from reload to a complete roster.

**Deviations**
- `SavedLobby.bots` is `readonly number[]` (the bot slots), not `number`: a count cannot tell slot 0 from slot 1.
- New `Lobby.picked`: the lobby had no picked-Game state (the HUD kept it in `mgc.game`), and the restored `game` needs a reader. With Main's approval the HUD reads `lobby.picked` and `mgc.game` is removed, so there is one record of the pick.
- Saving is synchronous, not debounced: `refresh` compares the snapshot JSON and writes only when it changed, so nothing is written per clock report. It also saves when a Device joining changes the Tile order (it is appended), so a later reload puts that Device back in its place too.
- Roles of saved Devices that are not back yet survive an order set by hand. Only their places are dropped: a role is not a place, and a Controller that comes back late is still a Controller.
- Tests use the real `sessionLobbyStore` over an in-memory `sessionStorage` stub instead of a hand-written memory store, so the JSON round trip and `readSaved` are covered as well.
- `docs/platform-design.md`: the lobby section is §5 (§3 is the Session); §5 is the one updated.
- `main.ts`: the import line changed as well as the `openLobby` line.
- Doc line citations into the files I changed are re-anchored (several already pointed at the wrong lines before this change): `lobby.ts` in troubleshooting (refusal 455-479, `A Match is already running` 318), running-on-phones (default Row 203, controller seats 421-430), concepts (421-430; 399-409, 528-531), testing (`start` 317-342); `hud.ts` (-2 lines after 213) in running-on-phones (strip 440-475, pill 268-274, roles label 289-292, Players 316-335) and troubleshooting (pill 268-274). Ticket 03 edits `hud.ts` next and moves these again.

### 2026-11-08, Main (browser smoke)

Frozen `pnpm build` served by `vite preview --port 4174` (no HMR while ticket 03 edits the pwa), three headless Chromium tabs (390×844), real Trystero over the public relays. Host code `SC2Q`; both Peers were in the roster 3.1 s after opening.
- Configured: Grid, "Move phone 1 later" (order Peer A, Host), Peer B → Controller, Quiz. `sessionStorage['mgc.lobby.SC2Q']` = `{"template":"grid","order":[<A>,<host>],"roles":{<B>:"controller"},"game":"mgc.quiz","seats":"controllers","bots":[]}`; the sheet read "2 phones · Grid", Host "row 1, column 2", B "Controller", Quiz and Grid checked.
- Reloaded the Host tab: **1.1 s** to the same sheet with the full roster (Grid, Quiz checked, A "first phone", Host "row 1, column 2", B "C · Controller"), **2.1 s** until both Peers were synced; the saved file byte-identical after the reload. Peer A's strip read "Phone 1 of 2 · first phone", Peer B's "Controller · hold this phone in hand".
- Start: first refused with "Quiz needs 1 Tile; 2 present" (Quiz's manifest, not the restore); after making A a Controller too, "Start Quiz" put both Controllers on question 1/5 ("How many legs does a spider have?", answers A–D) and the Host on the board within 3 s.
- Not covered here: the Peers' "The host phone restarted" card when the Host reloads *during* a Match is ticket 03's D7 and is smoked there.
