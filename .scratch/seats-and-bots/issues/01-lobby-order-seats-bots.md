# 01: Lobby: Tile order, seats in the Match, bot Player slots

**What to build:** The Host arranges the Tile order from the HUD (move a phone left/right), sees which phones are Players because they sit at the ends, and can flip any Player slot to a bot when the selected Game supports bots. The frozen Match tells games which Device seats which Player and which Players are bots.

Per `.scratch/seats-and-bots/spec.md`: additive SDK types (`Player.deviceId?`, `Player.bot?`, `Manifest.bots?`), Lobby `setOrder`/`move`/`setBot`, `players` with seats and bots, `start` refusal for bots on a Game without `bots`, HUD controls, docs.

**Blocked by:** None

**Status:** ready-for-agent

- [x] `Player` carries `deviceId?` and `bot?`; `Manifest.bots?` exists; `docs/sdk-design.md` updated; validators in `lobby.ts` accept the new fields
- [x] Lobby test: `move`/`setOrder` reorder the Layout on Host and Peer; a Device that drops and returns keeps its position; Controllers are never in the order
- [x] Lobby test: `setBot(1, true)` → `players[1]` is `{ bot: true, no deviceId }`, `players[0].deviceId` is the first Tile's Device; `setBot(1, false)` restores the seated human; with one Tile and a bot there are two Players
- [x] Lobby test: `start` refuses a bot slot for a manifest without `bots`; with `bots: true` the Peer's `match.players` deep-equals the Host's including `deviceId`/`bot`
- [x] HUD: ◀ ▶ per Tile Device (disabled at ends / for Controllers), Bot toggle per Player slot shown only when the picked Game has `bots`; preview numbers and hints follow the order live
- [x] Smoke (three tabs): move the Host from position 1 to 3 → every tab's preview renumbers and the Peer hints change; mark slot 2 as Bot → the Players list shows "Bot"; the Pass game (no `bots`) refuses Start with the reason while a bot is on
- [x] Typecheck and suite green; Pong source unchanged in this ticket

## Comments

### 2026-11-07

**Changed**
- `packages/sdk/src/types.ts` (additive): `Player.deviceId?: DeviceId` (the Device that seats the Player, never on a bot) and `Player.bot?: true`; `Manifest.bots?: boolean` (default false).
- `apps/pwa/src/lobby.ts`:
  - New Host-only `setOrder(deviceIds)`, `move(deviceId, delta)`, `setBot(slot, on)`; no-ops on a Peer, ignored while `match` is set.
  - Tile order: the Host keeps `order` (Tile-role roster Devices, present or not). The Layout is built from `order` followed by the remaining Tile Devices in roster order, skipping absent ones; the change key includes the order, so a reorder rebuilds the Layout (and drops a `setPlayers` choice, as any Tile change does). `setOrder` ignores ids not in the roster and Controllers. `move` shifts among the present Tiles, clamps at the ends, and keeps an absent Device at its index in the order. `setRole(id, 'controller')` takes the Device out of the order, so a Device that is a Tile again joins at the end.
  - Player slots: slot 0 = first Tile, slot 1 = last Tile (with one Tile, slot 1 has none). The default Players are, per slot, its bot `{ playerId: 'bot:<slot>', name: names.get(id) ?? 'Bot', bot: true }` or the human whose Device sits at the slot's Tile, `{ playerId, name, deviceId }`. Bots are kept by slot while the Tiles change. `setBot` drops a `setPlayers` choice. `setPlayers` keeps a `bot: true` it is given, defaults a blank bot name to "Bot", and its humans get `deviceId` from the present Device that reported that Player id.
  - New `Lobby.slots: readonly Slot[]` (always two, `{ deviceId, player }`), derived from `layout` and `players` on Host and Peer alike. The HUD renders the slot rows from it.
  - The state message no longer carries `seats`: a Player's seat is its `deviceId`, and `seatOf(id)` reads it from `players`.
  - `start`: the first check is now `!game.bots && a bot Player` → "`<Game>` does not support bots". Bots count in the Player range. `match.players` are copies with `deviceId`/`bot`.
  - `readPlayer` (state and Match) accepts `deviceId` (a string) and `bot` (exactly `true`); a bot with a `deviceId`, or any other `bot` value, is rejected.
- `apps/pwa/src/hud.ts`:
  - Roster: every Tile row has ◀ ▶ buttons (`button.move[data-device][data-delta]`, authored SVG triangles, aria-labels "Move phone N earlier/later") → `lobby.move`. They are disabled at the ends, on Controller rows, and while a Match runs. Rows are rebuilt only when phones, order, names or roles change; the sync figures are written into each row's `.sync` in place, so a tap is not lost to a clock report. Keyboard focus follows the moved phone (to its other button at an end).
  - Players: one row per `lobby.slots` entry (open lobby) or per `match.players` (running). A row has the name field and "phone N", or "joining…" / "no phone" for an empty slot. A "Bot" chip (`.chip.bot[data-slot]`, pressed = bot) → `lobby.setBot` shows on every slot row when the picked Game's manifest has `bots`. An empty slot is listed only then.
  - Seat lookups (roster meta, Peer strip) use `Player.deviceId`.
- `apps/pwa/src/main.ts`: the pause overlay's Device → Player name map comes from the frozen `match.players[].deviceId` instead of the live `lobby.seatOf`.
- `apps/pwa/index.html`:
  - Roster row grid: the number spans both lines, the ◀ ▶ group sits at the top right and the sync figures under it. `.move` styles (36 px targets; hover, active and disabled states; reduced motion).
  - The Players list uses one subgrid, so name fields line up whether or not a row has a seat or a chip; `.empty` style.
- `apps/pwa/test/lobby.test.ts`:
  - `table()` returns the hub, and `join` takes a connection id for a returning Device.
  - Test 2 now expects `deviceId` in `match.players` (`toStrictEqual`).
  - Three new tests:
    1. Order. `move('d0', 2)`, then the clamps (`±9`), then `setOrder(['d2','d0','d9'])`, all identical on Host and Peer, with Players at the ends. While d1 is away the others close up, and `move('d3', -1)` skips past its place. d1 comes back under a new connection at index 2 on the Host, the Peer and its own lobby. A Controller ignored by `setOrder`/`move` and back as a Tile joins at the end.
    2. Bots. `setBot(1, true)` gives exactly `[{seat d0, 'Player 1', deviceId 'd0'}, {'bot:1', 'Bot', bot: true}]` with no `deviceId` and no `seatOf`. `slots` matches on the Peer. A rename to "Robo" survives off/on. Off restores `{seat d2, 'Player 2', 'd2'}`. One Tile: `slots` deviceIds are `['d0', undefined]`, `setBot(2, …)` is ignored, and with a bot there are two Players.
    3. Start. "Duel does not support bots", then with `bots: true` the exact players and a Peer `match` that is `toStrictEqual` to the Host's and frozen. `setBot`/`move`/`setOrder` are ignored while running. One Tile and `tiles {1,4}`: "Duel needs 2 Players; 1 seated" until a bot is on, then `[seat d0, 'bot:1']`.
- Docs:
  - `docs/sdk-design.md` §1: `Player.deviceId?`/`bot?`, `Manifest.bots?`. §2: a "Seats and bots" rule for game authors (slots, read seats from `deviceId` not the index, the `bot:<slot>` ids, refusal without `bots`, bots count in `players`).
  - `docs/platform-design.md` §5: the Lobby interface (`slots`, `setOrder`, `move`, `setBot`), the Hides text, the pause overlay naming from `Player.deviceId`, a "Seats and bots" block (Tile order, Player slots, Host sheet) and the new Lobby tests.

**Verified**
- `pnpm typecheck`: clean (core, layout, sdk, pong, pass, pwa).
- `pnpm test`: 13 files, 75 tests passed (pwa lobby 7, up from 4).
- `git diff --stat -- games/pong`: empty.
- Impeccable detector on `hud.ts` + `index.html`: `[]`.
- Smoke: `pnpm dev` on :5174 (:5173 was taken), headless managed Chromium, three 420×860 tabs over real Trystero, room AVNY. The visible preview number was read by wrapping `CanvasRenderingContext2D.prototype.fillText` on the stage canvas, which recorded the number drawn inside the screen.
  - **Before:** previews were Host 1, Peer A 2, Peer B 3. Peer A's strip read "Phone 2 of 3 · right of phone 1", Peer B's "Phone 3 of 3 · right of phone 2 · Player 2". Roster ◀ was disabled on row 1 and ▶ on row 3.
  - **Moving the Host.** A trusted click on the Host's ▶ gave previews Host 2, A 1, B 3, and A read "Phone 1 of 3 · first phone · Player 1". A second click gave previews Host 3, A 1, B 2, and B read "Phone 2 of 3 · right of phone 1". The roster read "1 Windows · Player 1 / 2 Windows / 3 This phone · Player 2", with the Host's ▶ disabled and keyboard focus on its "Move phone 3 earlier". Screenshots of the three previews show 3 / 1 / 2.
  - **Bot.** With the Bot chips showing (see Deviations), a trusted click on P2's chip made the Players list read "P1 Player 1 · phone 1 · [Bot]" / "P2 [Bot] · [Bot pressed]", and the roster's row 3 lost "Player 2" (screenshot).
  - **Pass refusal.** After picking Pass, "Start Pass" refused with "Pass does not support bots" (screenshot). No Match started: the game layer stayed hidden, and the Peers kept their lobby strips. Unpressing the chip (it stays visible on a bot slot) cleared it. The next Start read "Pass needs 1 Controller; 0 present".
  - **Sanity.** With Pong and the reordered humans, Start ran Pong on all three tabs, with the move buttons disabled and the Player fields frozen. "End match" brought all three back to the lobby with the order kept.
  - No page errors in any tab.
- Not observed:
  - a Game that really declares `bots` (Pong gets it in 02);
  - a Match that ran with a bot Player;
  - real phones;
  - a Device dropping and returning in the browser (the Lobby test covers it);
  - column/grid ordering in the browser (the same code path; the Lobby test uses the row template).

**Deviations / notes for 02**
- **Smoke stand-in for `bots`.** No shipped Game declares `bots` before 02, so the Host tab set `bots = true` on Pong's manifest object in page memory: a dynamic `import()` of the module URL Vite already served. No source changed. That was the only thing injected; every lobby action was a trusted click on the HUD.
- **A bot slot keeps its pressed chip under a Game without bots.** Otherwise a Host who picked Pass after making a bot could not see or undo it without switching back. Unpressed chips appear only when the picked Game has `bots`, as the ticket says.
- **Bot refusal comes first.** It is checked before template, Tiles, Controllers and sizes, so Pass (which also needs a Controller) names the bot.
- **`Lobby.slots` added** to the interface, because the HUD needs a slot → Player mapping that `players` alone cannot give: an empty slot, or one Tile with a bot. The lobby state's `seats` map was removed, since `Player.deviceId` carries the seat.
- `setPlayers` keeps its M2 meaning (it replaces the list until the Tiles change) and is now also dropped by `setBot`.
- For 02:
  - `match.players` is `[slot 0 Player, slot 1 Player]` (only the filled ones). A human has `deviceId` = its Tile Device. A bot is `{ playerId: 'bot:<slot>', name, bot: true }`, with no `deviceId`.
  - With one Tile, the human's `deviceId` is both `tiles[0]` and the last Tile. Pong's "first Tile → side 0, last → side 1, the bot takes what is left" must give the human side 0 there.
  - If slot 0 is the bot, `players[0]` is the bot and the human at the last Tile is `players[1]`.
  - The lobby allows a bot only with `manifest.bots: true` and counts bots in `players`. `tiles: {1,4}` lets one Tile start once a bot fills slot 1.
  - Smoke selectors: `.roster button[data-device="<id>"][data-delta="±1"]` and `.players button[data-slot="0|1"]` (aria-pressed). A Pong `bots: true` makes the chips appear without any stand-in.
