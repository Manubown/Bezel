# 01: Maker mode: one switch for everything players should not see

**What to build:** A player's screens show no clock figures, no game log, no log export and no "syncing clocks"; a maker gets all of it back, on every phone of a table, with one address flag (spec D3). This is the prefactor the other screen tickets stand on: after it, "is this for players or for makers" has one answer in the app.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Maker mode is on when the address carries the flag and stays on for that Device on later visits; the flag with a "no" value switches it off again
- [x] The first phone's QR and its typed-address hint carry the flag when Maker mode is on, like the relay flag today
- [x] With Maker mode off, neither a first phone nor a joined phone shows a millisecond figure, an offset, the game log, the log's line count, Export, Clear or Log
- [x] With Maker mode on, every one of those is where it is today
- [x] The session log records the same lines in both modes (a log exported after switching Maker mode on holds the lines from before)
- [x] The reading of the flag and the remembered value is a pure function with unit tests: flag on, flag off, no flag with and without a remembered value
- [x] Two-tab browser smoke at phone sizes, screenshots in a comment: both modes, first phone and joined phone
- [x] The phone guide's flag table gains the row; "Maker mode" is used as `GLOSSARY.md` defines it

## Comments

### 2026-11-12, Ticket01MakerMode (implementation)

**Changed**
- Prefactor, its own commit, no behaviour change: `apps/pwa/src/hud.ts` keeps `openHud` and the types (`Play`, `LastMatch`, `HudOptions`, `Hud`); the surfaces moved to `apps/pwa/src/hud/sheet.ts` (the first phone's sheet), `hud/strip.ts` (the other phones' strip), `hud/cards.ts` (result and pause cards) and `hud/shared.ts` (`describeLast`, `placementHint`, `syncStats`, `statusDot`, `esc`). `docs/architecture.md` §5 names them.
- `apps/pwa/src/maker.ts` (new): `MAKER_FLAG = 'maker'`, `makerMode(params, remembered)` (pure), `claimMakerMode(params)` (reads and writes `localStorage` `mgc.maker`). `apps/pwa/test/maker.test.ts`: 4 tests.
- `apps/pwa/src/main.ts`: claims Maker mode at start, passes it to the HUD as `HudOptions.maker`; the canvas draws the counting beat (`drawMetronome`) before the lobby preview only in Maker mode, the bare ground otherwise.
- `hud/sheet.ts`: the QR's address gets `&maker` and the typed-address hint `<address>/?maker` in Maker mode; the game log, the playing bar's newest log line and its "N faults", Export log / Clear / "N lines" and the roster's clock figures and "syncing" only in Maker mode (players see the dot, and "connecting" before a phone's clock is in).
- `hud/strip.ts`: the clock figures, "Syncing clocks · measuring the offset to the host", "Synced" and the Log button only in Maker mode; players read "Connecting…" and "Connected".
- Guide: the `?maker` row under "Connectivity flags" in `running-on-phones.md`, the strip, sheet and export sentences there; every sentence that put the game log, "Syncing clocks" or Export log in front of everyone (`getting-started.md`, `api.md`, `concepts.md`, `troubleshooting.md`, `your-first-game.md`, `README.md`). No citation re-anchored.

**Decisions**
- The flag is `?maker` (the glossary avoids "debug" and "dev"). `no` switches it off; `off`, `0` and `false` do too, so `?maker=0` cannot switch it on by surprise. Any other value, or none, is on.
- Remembered only when the address carries the flag, both ways: a visit without it never changes the Device's value, and `?maker=no` is remembered as off.
- The QR and the hint carry the flag only when it is on, never `maker=no`: a player's table cannot switch a maker's phone off. The Join field still reloads as `?room=CODE` without flags; the remembered value carries Maker mode across it.
- The counting beat before a phone is in is a clock figure (the audit read it as a countdown), so it is a maker's; the faults count on the playing bar comes from the game log, so it is too.
- Players' words for the states whose makers' words left ("Connecting…", "Connected", "connecting") are the smallest that are true; ticket 04 owns the wording.
- The session log is untouched: no Maker mode field in any line, so both modes record the same lines; the `device` line's `url` shows the flag when the address had it.
- D3's other gates (the full Game list, the Controllers and arrangement controls a featured Game does not need) are ticket 02's: it reads `HudOptions.maker`.

**Verified**
- `pnpm vitest run apps/pwa/test/maker.test.ts`: red first (no module), then 4 tests passed.
- `pnpm typecheck && pnpm test`: typecheck clean; 30 test files, 227 tests passed.
- After the prefactor alone: `tsc -p .` in `apps/pwa` clean, `pnpm vitest run apps/pwa`: 7 files, 45 tests passed.
- Two headless Chrome tabs at 390 × 844, one profile each, dev server on 5201 (screenshots looked at, not committed):
  - Maker mode off, first phone at `/`: the sheet reads code, "2 phones · Row", QR, "Scan to join, or open localhost:5201 and enter the code.", the Games, Row/Column/Grid, Controllers, P1/P2, Start, the roster with a green dot and no figure for phone 2; nothing below the roster. The QR's canvas equals one drawn for `https://localhost:5201/?room=VDC2` and differs from one for `…&maker`. After a Pong Match ended with End match: "Last match: Match stopped · Ended from the host phone", no game log, `.log` and `.diag` hidden; during the Match the folded bar read only "Setup".
  - Maker mode off, joined phone at `?room=VDC2`: "VDC2 · Phone 2 of 2 · right of phone 1 · Player 2", no figure, no Log button. Watched every 20 ms while joining: "Looking for the host… keep the host screen open" → "Connecting…" → "Phone 2 of 2 right of phone 1 · Player 2". On a code nobody hosts (`ZZZZ&maker=no`) the screen under the strip is the bare ground.
  - Maker mode on, first phone reloaded as `/?maker` (same code): hint "open localhost:5201/?maker", QR equals one for `…?room=VDC2&maker`. During a second Pong Match the opened bar read "Pong · playing" (Pong logs nothing while playing, so no log line under it); then the game log "closed · match closed (aborted): stopped by the platform", phone 2's "0.9 ms · Δ511.9 ms", Export log, Clear, "99 lines · ndjson .txt".
  - Maker mode on, joined phone at the QR's address `?room=VDC2&maker`: "right of phone 1 · Player 2 · 0.9 ms · Δ511.9 ms" and Log. Joining: "Looking for the host…" → "Syncing clocks measuring the offset to the host" → "… · — · Δ—" → "… · 0.9 ms · Δ7684.0 ms", as before. On `ZZZZ&maker` the counting beat ("02") and its bar are drawn.
  - Remembered: the joined phone at `?room=VDC2` with no flag kept its figures and Log; the first phone at `/` kept the `?maker` hint and Export log; at `/?maker=no` both were gone and the QR was plain again; at `/` after that they stayed gone.
  - Export log on the first phone after switching Maker mode on downloaded `mgc-VDC2-host-2026-11-12T22-18-48.txt` (125 lines): its `device` lines are `https://localhost:5201/` (the visit with Maker mode off) and `https://localhost:5201/?maker`, and it holds the `match:closed` of both Matches, the first played with Maker mode off.

**Not verified**
- Anything on phones, including Export through a phone's share sheet.
- The first phone's roster showing "connecting" for a phone whose clock is not yet in, and a faults count on the playing bar: no state held long enough or no Game faulted in the smoke; both are read from the code.
- A Controller's strip line in either mode.
