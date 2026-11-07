# Running on phones

## Serve over HTTPS on the LAN

`pnpm dev` starts Vite on port 5173 with `host: true` (reachable from the LAN) and a self-signed certificate from `@vitejs/plugin-basic-ssl` (`apps/pwa/vite.config.ts`). HTTPS is required on phones for the screen wake lock and a secure context for WebRTC.

- Open the `Network` address Vite prints (`https://<your-LAN-ip>:5173/`) on the Host phone. Each phone's browser warns about the self-signed certificate once; accept it.
- Do not open the Host page as `localhost`: the join QR code is the Host page's own URL with `?room=CODE` (`apps/pwa/src/hud.ts:124-129`), so a `localhost` Host hands the other phones an address they cannot reach.
- Another port: `pnpm --filter @mgc/pwa dev --port 5181`.
- Without a laptop: every push to `master` publishes the PWA to https://manubown.github.io/Bezel/ (`.github/workflows/pages.yml`), with a real certificate but only the Games on `master`. `BASE_PATH=/Bezel/ pnpm build` builds the same into `apps/pwa/dist` (README).

## Network

- Put every phone on the same Wi-Fi, or on one phone's hotspot. The Match itself runs phone-to-phone over WebRTC.
- Every phone also needs **internet**: signaling (how phones find each other) goes through public Nostr relays via Trystero (`packages/core/src/trystero-transport.ts:28-31`). The offline fallback (SDP by QR code) is planned for M5 (`docs/PLAN.md:80`) and not built.
- The Session is a star: Peers talk only to the Host (ADR-0002). If the Host's page goes away, the Session ends; Peers show "Looking for the host".

## Join

- A phone that opens the address **without** `?room=` becomes a Host with a new 4-letter code (letters and digits without 0, O, 1, I, L: `apps/pwa/src/main.ts:17-18`). A reloaded Host tab keeps its code, so its Peers find it again (`apps/pwa/src/main.ts:19-20`, `32-37`).
- **QR:** a Peer scans the Host's QR code and opens `…/?room=CODE`.
- **Code:** a Peer opens the address (the Host's sheet shows it: "Scan to join, or open <address> and enter the code."), types the code into its own sheet's "Code" field and presses Join; the page reloads as `?room=CODE` (`apps/pwa/src/hud.ts:189-200`). Typing `/?room=CODE` by hand is the same; the code is not case-sensitive (`apps/pwa/src/main.ts:48`).

A Peer's top strip says where it is (`apps/pwa/src/hud.ts:409-444`):

| Strip | Meaning |
|---|---|
| Looking for the host · keep the host screen open | no Host has answered yet, or the Host is gone |
| Syncing clocks · measuring the offset to the host | connected; the shared clock is being measured |
| Synced · waiting for arrangement | synced; the Host's lobby state has not arrived yet |
| Phone N of M · <where it goes> · <Player> | a Tile, its place in the Tile order, and who sits there |
| Controller · hold this phone in hand | the Host marked it a Controller |
| Match in progress · you join the next one | a Match started without this phone; no joins mid-Match |

## The Host's sheet

Top to bottom (`apps/pwa/src/hud.ts:132-166`):

| Control | What it does |
|---|---|
| bar: code · "N phones · Row" · Setup/Hide | folds the sheet; while a Match runs: "<Game> · playing/paused · N faults" and the newest game-log line |
| QR code, address, "Code" field + Join | how Peers join; Join leaves this table for another one |
| Game row | picks the Game "Start" starts; sorted by name, the first is picked until you pick another |
| Arrangement: Row / Column / Grid | the template; the default is Row (`apps/pwa/src/lobby.ts:151`) |
| Controllers: one chip per phone | pressed = Controller (held in hand, out of the Layout and the Tile order); press again to make it a Tile |
| Players: P1, P2 | each slot's name (editable, up to 24 characters), where it sits ("phone 1"), and a **Bot** chip when the Game's manifest has `bots: true` |
| Start <Game> / End match | Start freezes the Match; End match stops it on every phone ("Match stopped") |
| reason line | why Start was refused ([messages](troubleshooting.md#start-is-refused)), else "Last match: …" |
| game log | the running (or last) Match's faults, `ctx.log` lines and close, newest first; the last 50 (`apps/pwa/src/gamelog.ts:10`) |
| roster | every phone in Tile order with where it goes, its Player and clock sync; ◀ ▶ move a Tile; Controllers listed as "C"; dropped phones as "disconnected" |

### Templates

The Layout is built from the Tile phones in Tile order, 4 mm apart, never rotated (`packages/layout/src/templates.ts`):

| Template | Placement | Hint on each phone |
|---|---|---|
| Row | left to right, centred vertically on the tallest | "right of phone N−1" |
| Column | top to bottom, centred horizontally on the widest | "below phone N−1" |
| Grid | ⌈√n⌉ columns, filled row by row; each cell as large as its row's and column's largest phone | "row r, column c" |

Phone 1 is always the "first phone". On every phone the lobby draws a millimetre grid (10 mm lines, stronger every 50 mm) continuous across the bezels, the World's bounds in green, and the phone's number (`apps/pwa/src/scene.ts`). Lay the phones so the grid lines meet; where they cannot, `pxPerMm` is off.

### Tile order, seats and bots

- The Tile order starts as the join order, Host first. ◀ moves a Tile towards the first place, ▶ towards the last; both stop at the ends and are disabled while a Match runs.
- P1 is whoever sits at the **first** Tile, P2 whoever sits at the **last** (`SLOTS = 2`, `apps/pwa/src/lobby.ts:9-10`). Middle Tiles seat nobody; Controllers are never seated. With one Tile, P2 can only be a bot ("no phone").
- A **Bot** chip turns its slot into a bot the host game plays (`playerId: 'bot:0'` or `'bot:1'`). The lobby refuses Start with a bot if the Game does not support bots.
- Names stay with the Player id, and a phone keeps its Player id across reloads (`apps/pwa/src/device.ts:59-71`).

## `pxPerMm` is a guess

Browsers expose no physical screen size, so each phone's CSS px per mm is guessed from its user agent (`apps/pwa/src/device.ts:73-83`) until calibration lands:

| User agent | `pxPerMm` | Basis |
|---|---|---|
| contains `Android` | 6.3 | Android dp = 1/160 in |
| contains `iPhone` or `iPod` | 6.1 | iPhone points ≈ 150–165 ppi |
| contains `iPad`, or `Macintosh` with more than one touch point | 5.2 | iPad ≈ 132 ppi |
| anything else (desktop) | 3.78 | the CSS reference pixel, 96 dpi |

A Tile's size in mm is its visible CSS size divided by this, so a 420 × 860 px desktop tab is a ≈ 111 × 227 mm Tile. On a phone whose real density differs, Game objects come out larger or smaller than on its neighbours and do not line up across the bezel. Games cannot correct this; they see only mm (ADR-0005).

## Screen size, rotation, iOS toolbars

- Each phone's size is measured once, when the page loads (`apps/pwa/src/main.ts:47`), from `visualViewport`, which excludes browser toolbars where `innerHeight` may not (`apps/pwa/src/device.ts:85-97`).
- Rotate a phone, or let iOS Safari show or hide its toolbars, after that and its Tile no longer matches its screen. Hold the phone the way it will lie, then reload it.
- A phone added to the home screen opens without browser toolbars (`display: fullscreen` in `apps/pwa/public/manifest.webmanifest`).

## Screen wake lock

During a Match each phone asks for a screen wake lock on its first touch, and again on a touch after the system dropped it; it releases the lock when the Match closes (`apps/pwa/src/wake.ts:1-34`). Before that first touch, and in the lobby, the phone's own auto-lock applies: a phone nobody touches can sleep, drop out, and pause the Match. Touch every phone once after Start.

## Losing a phone

The Host learns that a phone is gone only when the transport reports it, 10–13 s after it went (observed 10.2–12.8 s, `.scratch/m2-pong-sdk/issues/06-pause-resume.md:158`). The Match then pauses on every phone ("Waiting for <Player>", or "phone N" / "the controller") and resumes once the phone is back and has synced its clock (`apps/pwa/src/pause.ts:12-35`). Reloading the lost phone's page (its address still holds `?room=CODE`) brings it back under the same Device id. A Game that must notice an absent Player sooner does it itself (Pong holds play until each human keeps touching: `PONG.presence`, `games/pong/src/index.ts:27-31`).

## What a Peer sees

1. The lobby: the strip above and the placement preview.
2. On Start: the strip folds away and the Game's view fills the screen. A Peer that is not in the Match stays in the lobby ("Match in progress").
3. During a pause: a card "Waiting for …" over the frozen view.
4. When the Match closes: the result card on every phone ("<name> wins", the scores, or "Draw"; without a result, why it closed: "Match stopped", "The game crashed", "Connection lost", … from `apps/pwa/src/result.ts`), until tapped, then the lobby.

## Installing as a PWA

The web manifest asks for `display: fullscreen` and any orientation. On iOS, Share → "Add to Home Screen" installs it full-screen (README). There is no service worker, so the installed app still loads from the server it was installed from (the dev server, or the hosted build).

## Several tabs on one computer

Each tab of one desktop browser gets its own Device id (a Web Lock per id; a reloaded tab takes its own back: `apps/pwa/src/device.ts:41-57`), so one computer can run a Host tab (`https://localhost:5173/`) and Peer tabs (`https://localhost:5173/?room=CODE`). Keep every tab visible, in separate windows: a hidden tab stops its view's `draw` (`packages/sdk/src/game-side.ts:416`), and a hidden Host tab gets no animation frames, so its host's `tick` stops. Desktop tabs use `pxPerMm` 3.78.
