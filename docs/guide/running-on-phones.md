# Running on phones

## Serve over HTTPS on the LAN

`pnpm dev` starts Vite on port 5173 with `host: true` (reachable from the LAN) and a self-signed certificate from `@vitejs/plugin-basic-ssl` (`apps/pwa/vite.config.ts`). HTTPS is required on phones for the screen wake lock and a secure context for WebRTC.

- Open the `Network` address Vite prints (`https://<your-LAN-ip>:5173/`) on the Host phone. Each phone's browser warns about the self-signed certificate once; accept it.
- Do not open the Host page as `localhost`: the join QR code is the Host page's own URL with `?room=CODE`, plus `&noturn` when the Host has it and `&maker` in [Maker mode](#connectivity-flags) (`apps/pwa/src/hud.ts:127-129`), so a `localhost` Host hands the other phones an address they cannot reach.
- Another port: `pnpm --filter @mgc/pwa dev --port 5181`.
- Without a laptop: every push to `master` publishes the PWA to https://manubown.github.io/Bezel/next/ (`.github/workflows/pages.yml`), with a real certificate but only the Games on `master`. `BASE_PATH=/Bezel/next/ pnpm build` builds the same into `apps/pwa/dist`; `pnpm pages` builds the whole published site ([two hosted builds](#two-hosted-builds-the-latest-and-a-known-good-one)).

## Network

- Put every phone on the same Wi-Fi, or on one phone's hotspot. The Match itself runs phone-to-phone over WebRTC.
- Every phone also needs **internet**: signaling (how phones find each other) goes through public Nostr relays via Trystero (`packages/core/src/trystero-transport.ts:159-161`). The offline fallback (SDP by QR code) is planned for M5 (`docs/PLAN.md:88`) and not built.
- The Session is a star: Peers talk only to the Host (ADR-0002). If the Host's page goes away, the Session is gone until the Host is back under the same code; Peers show "Lost the table. Reconnecting…" and look for it again by themselves.

## Join

- A phone that opens the address **without** `?room=` becomes a Host with a new 4-letter code (letters and digits without 0, O, 1, I, L: `apps/pwa/src/main.ts:20-21`). A reloaded Host tab keeps its code, so its Peers find it again (`apps/pwa/src/main.ts:22-23`, `41-46`), and its lobby: arrangement, Tile order, Controllers, Game and bots come back as the phones do; the running Match does not ([the host phone reloaded](troubleshooting.md#the-host-phone-reloaded)).
- **QR:** a Peer scans the Host's QR code and opens `…/?room=CODE`.
- **Code:** a Peer opens the address (the Host's sheet shows it: "Other phones: open the camera and scan this, or open <address> and join table <CODE>."), which makes it the first phone of a table of its own, opens "Join a different table" at the bottom of its sheet, types the code and presses Join; the page reloads as `?room=CODE` (`apps/pwa/src/hud.ts:199-210`). Typing `/?room=CODE` by hand is the same; the code is not case-sensitive (`apps/pwa/src/main.ts:67`). A Host's own code typed there, in any letter case, is refused ("<CODE> is this table’s code: scan the QR above with the other phones.", `apps/pwa/src/othertable.ts`): the page stays and its Session goes on.

A Peer's top strip says where it is (`apps/pwa/src/hud.ts:443-481`):

| Strip | Meaning |
|---|---|
| Finding table CODE… · keep the first phone’s screen on | no Host has answered since this page loaded |
| Connecting… | a Host answered and the shared clock is being measured, or an attempt failed and the phone tries again; it has not been in yet |
| Lost the table. Reconnecting… | it had been in and lost the Host: the connection closed, the Host was silent for 5 s, or the clock did not sync within 4 s. It reconnects by itself ([reconnecting](troubleshooting.md#lost-the-table-reconnecting-on-a-peer)) |
| You’re in · waiting for the first phone | in; the Host's lobby state has not arrived yet |
| Phone N of M · <where it goes> · <Player> | a Tile, its place in the Tile order, and who sits there |
| Controller · hold this phone in hand | the Host marked it a Controller |
| A match is on · you join the next one | a Match started without this phone; no joins mid-Match |

After 15 s without getting in (`HELP_AFTER_MS`, `apps/pwa/src/join.ts`), counted from the page's start or from the moment it lost the table, a card over the lobby names the code ("Table CODE not found yet", "Still connecting to table CODE", "Still reconnecting to table CODE"), says to check the code on the first phone and keep that phone's screen on, and that an iPhone hotspot often fails, so to use the same Wi-Fi or mobile data on every phone. **Try again** reloads the page for the same code; the code field opens the same address with another code, keeping its other flags. The card goes by itself once the phone is in. Over a running Match the reconnect notice speaks instead; the card shows in the lobby if the 30 s grace runs out.

In [Maker mode](#connectivity-flags) the second line holds the makers' words ("looking for the host", "syncing clocks · measuring the offset to the host", "reconnecting to the host · the connection dropped", "synced · waiting for arrangement") and every line ends in this phone's clock figures (`rtt · Δoffset`, "—" before it has any), and a **Log** button exports the session log; without it the strip shows neither.

## The Host's sheet

Top to bottom, the steps of getting a table going, then the rest (`apps/pwa/src/hud.ts:136-175`):

| Control | What it does |
|---|---|
| banner (only inside another app's browser) | at the top, folded or open: "Open this page in Safari or Chrome" ([Installing as a PWA](#installing-as-a-pwa)) |
| advice line (only when one phone keeps dropping) | above the bar, folded or open: "<phone> keeps losing its connection. An iPhone hotspot often fails: use the same Wi-Fi on every phone, or mobile data on every phone." once one phone's connection ended three times in a row within 15 s of coming in (the transport's measure of a connection that did not work, `RELAY_STABLE_MS`); it goes once that phone's connection lasts 15 s. Maker mode adds the count (`apps/pwa/src/hud/advice.ts`, `apps/pwa/src/join.ts`) |
| bar: code · "N phones · in a row" · Setup/Hide | folds the sheet. It also folds by itself once, when the first other phone is ready in the lobby, so the Host's own placement cue shows; opened again, it stays open. While a Match runs the folded sheet is only a small "Setup" pill in the bottom-right corner (`apps/pwa/src/hud.ts:268-274`, `apps/pwa/index.html:42-44`); it fades 3 s after play starts and comes back while a touch lands near it, and a tap on it while it is faded only brings it back (`apps/pwa/src/hud/corner.ts`); opened then, the bar reads "<Game> · playing/paused", in Maker mode with "· N faults" and the newest game-log line under it. When the Match ends it stays folded: the result card offers what comes next |
| QR code, "Other phones: open the camera and scan this, or open <address> and join table <CODE>." | how Peers join |
| "Lay the phones like this": the roster | every phone in Tile order with where it goes, its Player and a dot for its connection (ivory once its clock is synced; grey and pulsing with "connecting" before; in Maker mode the clock figures `rtt · Δoffset` or "syncing"); ◀ ▶ move a Tile; Controllers listed as "C"; a phone not heard for 2.5 s reads "weak connection" with an amber dot instead ([weak connection](troubleshooting.md#the-hosts-roster-says-weak-connection-for-a-phone)), a lost one "disconnected" |
| Game cards | one per Game: its name, how many play and how the phones lie ("2 players · phones in a row"); a tap picks the Game "Start" starts. Players see Pong, then Air Hockey; Maker mode every Game, sorted by name (`apps/pwa/src/gamelist.ts`). The Host's last pick is picked again, kept with the lobby across a reload of the Host's page (`sessionStorage` `mgc.lobby.<CODE>`, `lobby.picked`), when the list has it, else Pong. The Game decides how the lobby seats Players ([seats](concepts.md#seats-and-bots)) |
| Arrangement: In a row / End to end / In a grid | the template; picking a Game selects the first its manifest's `templates` names (any, when it names none). Shown only when the Game names more than one, offering only those (Air Hockey: end to end, in a row) |
| Controllers, or "Players’ phones" when the Game has `seats: 'controllers'` (`apps/pwa/src/hud.ts:289-292`): one chip per phone; shown only when the Game takes Controllers, and picking one that takes none puts every phone back on the table | pressed = Controller (held in hand, out of the Layout and the Tile order); press again to make it a Tile. Under "Players’ phones" each pressed phone is one Player's |
| Players: P1, P2 (`seats: 'ends'`), or one row per Controller phone (`seats: 'controllers'`) | each Player's name (editable, up to 24 characters), where it sits ("phone 1", or "Controller"), and, with `'ends'`, a **Bot** chip when the Game's manifest has `bots: true` (`apps/pwa/src/hud.ts:316-335`) |
| Start <Game> / End match | Start freezes the Match; End match stops it on every phone ("Game ended on the first phone") |
| reason line | why Start was refused ([messages](troubleshooting.md#start-is-refused)), in amber; else "Last match: …", in grey |
| game log (Maker mode only) | the running (or last) Match's faults, `ctx.log` lines and close, newest first; the last 50 (`apps/pwa/src/gamelog.ts:10`) |
| install row (after this phone's first finished Match, unless installed) | the app for the home screen: Install (Android) or the steps (iPhone, iPad) ([Installing as a PWA](#installing-as-a-pwa)) |
| Export log · Clear · "N lines" (Maker mode only) | the session log ([below](#the-session-log-what-each-phone-records-and-how-to-get-it-off-the-phone)) |
| "Join a different table", folded | opened: a code field and Join, which leave this table for that one (the page reloads as `?room=CODE`). This table's own code, in any letter case, is refused in words and nothing else happens |

When a Match ends with the sheet folded, the Host's result card ("Ana wins 7–5") offers **Play again**, the same Game with the same Players, arrangement and bots (`apps/pwa/src/lobby.ts` `startAgain`), and **Change game**, which opens the sheet. Play again is refused in words when a phone of that Match is no longer at the table ("Phone 2 is no longer at the table"), when a phone joined since (it has to be placed: use Change game), or when the Host changed the table since. A Match that ends while the sheet is open shows no card on the Host, only the "Last match" line.

### Templates

The Layout is built from the Tile phones in Tile order, 4 mm apart, never rotated (`packages/layout/src/templates.ts`):

| Template | Placement | Hint on each phone |
|---|---|---|
| Row | left to right, centred vertically on the tallest | phone 1 "on the left", then "right of phone N−1" |
| Column | top to bottom, centred horizontally on the widest | phone 1 "at the top", then "below phone N−1" |
| Grid | ⌈√n⌉ columns, filled row by row; each cell as large as its row's and column's largest phone | phone 1 "top left", then "right of phone N−1"; the first of each row "below" the first of the row above |

Phone 1 is the phone the others are laid from, not necessarily the first phone (the Host): a reorder can put the Host anywhere. On every phone the lobby draws a millimetre grid (10 mm lines, stronger every 50 mm) continuous across the bezels and the World's bounds in grey, and over them the placement cue: the phone's number in the foreground colour, about 60 % of the screen's width; under it the hint as a sentence ("Lay me right of phone 1", phone 1's "Lay me first, on the left"); under that a pictogram of the Layout with this phone filled (`apps/pwa/src/scene.ts`, the wording in `apps/pwa/src/placement.ts`). Reordering on the Host updates all three on every phone. Lay the phones so the grid lines meet; where they cannot, `pxPerMm` is off.

### Tile order, seats and bots

- The Tile order starts as the join order, Host first. ◀ moves a Tile towards the first place, ▶ towards the last; both stop at the ends and are disabled while a Match runs.
- With `seats: 'ends'` (the default; [seats](concepts.md#seats-and-bots)), P1 is whoever sits at the **first** Tile, P2 whoever sits at the **last** (`SLOTS = 2`, `apps/pwa/src/lobby.ts:9-10`). Middle Tiles seat nobody; Controllers are never seated. With one Tile, P2 can only be a bot ("no phone"). With `seats: 'controllers'` (Quiz) every phone pressed under "Players’ phones" seats one Player, in roster order, and no Tile seats anyone (`apps/pwa/src/lobby.ts:421-430`).
- A **Bot** chip (`seats: 'ends'` only) turns its slot into a bot the host game plays (`playerId: 'bot:0'` or `'bot:1'`). The lobby refuses Start with a bot if the Game does not support bots.
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

- Each phone's size is measured once, when the page loads (`apps/pwa/src/main.ts:65`), from `visualViewport`, which excludes browser toolbars where `innerHeight` may not (`apps/pwa/src/device.ts:131-143`).
- Load the page with the phone sideways, or let iOS Safari show or hide its toolbars after that, and its Tile no longer matches its screen. Hold the phone upright, then reload it.
- A phone added to the home screen opens without browser toolbars (`display: fullscreen` in the web manifest, which the build writes: `apps/pwa/brand.ts`).

## Screen wake lock

Every phone asks for a screen wake lock on its first tap or key press on the page (the join field, the Host's sheet, the lobby, the Game), asks again when the page is visible again (the system drops the lock while it is hidden), and on the next tap if a request was refused; it holds the lock for as long as the page is open, lobby and Match alike (`apps/pwa/src/wake.ts:9-56`, `apps/pwa/src/main.ts:92-93`). The request needs that one tap: a phone nobody has touched since its page loaded follows its own auto-lock, and can sleep, drop out, and pause the Match. Tap every phone once after it joins. Browsers without the Screen Wake Lock API just keep their auto-lock. The `tick` log line says whether the lock is held (`wake`).

## Losing a phone

The Host notices a silent phone after 2.5 s (its roster row reads "weak connection", `WEAK_MS`; no pause) and gives it up after 5 s of silence (`LOST_MS`, `packages/core/src/session.ts`), or at once when its connection closes; the 1 Hz clock pings are the heartbeat. Before connectivity-1 only the transport's own leave told it, 10–13 s after the phone went. The Match then pauses on every phone ("Waiting for <Player>", or "phone N" / "the controller") and resumes once the phone is back and has synced its clock (`apps/pwa/src/pause.ts:12-35`). The lost phone itself keeps its part of the Match for 30 s, showing "Lost the table. Reconnecting…", while its connection is rebuilt; back within that, it plays on in the same Match ([reconnecting](troubleshooting.md#lost-the-table-reconnecting-on-a-peer)). Reloading the lost phone's page (its address still holds `?room=CODE`) also brings it back, under the same Device id. A Game that must notice an absent Player sooner does it itself (Pong holds play until each human keeps touching: `PONG.presence`, `games/pong/src/index.ts:27-31`).

## What a Peer sees

1. The lobby: the strip above and the placement preview.
2. On Start: the strip folds away and the Game's view fills the screen. A Peer that is not in the Match stays in the lobby ("A match is on · you join the next one").
3. During a pause: a card "Waiting for …" over the frozen view. While this phone's own connection is down: "Lost the table. Reconnecting… · the match goes on when the connection is back", for up to 30 s; back before the Match resumes: "You’re back · the match goes on in a moment".
4. When the Match closes: the result card on every phone that played (two sides in one line, "Ana wins 7–5" or "Draw, 3–3"; more sides "<name> wins" or "Draw" with everyone's points; without a result, why it closed: "Game ended on the first phone", "The game crashed", "Connection lost", "Connection lost · The host phone restarted", … from `apps/pwa/src/result.ts`), with "The first phone starts the next game", until tapped or the next Match starts, then the lobby. After this phone's first finished Match the card also offers the app for the home screen, once ([Installing as a PWA](#installing-as-a-pwa)); a tap on the offer leaves the card open.

## Installing as a PWA

What a phone gets from its home-screen icon. The web manifest the build writes (`apps/pwa/brand.ts`) asks for `display: fullscreen` and `orientation: portrait`.

- **Android:** the app opens full screen, with no browser bars and no status bar, and stays upright: the installed app keeps the manifest's portrait and `screen.orientation.lock`.
- **iPhone and iPad:** the app opens without Safari's bars, but the status bar stays, because iOS knows `standalone`, not `fullscreen`. It does **not** lock the orientation, installed or not: iOS supports neither the manifest's `orientation` nor `screen.orientation.lock`, so the "Turn your phone upright" overlay is the only guard there. The screen wake lock works in a Home Screen app from iOS 18.4.
- **Every phone:** no pull-to-refresh and no tab to close by accident. There is no service worker, so the installed app still loads from the server it was installed from (the dev server, or the hosted build), and it needs the internet as the tab does.

**The offer.** A phone offers the app for its home screen once it has finished its first Match, meaning a Match its Game ended (the count is kept on the Device, `localStorage` `mgc.matchesFinished`). The offer shows under the buttons of the first result card after that, and stays as a row at the bottom of the first phone's sheet. Once a card that carried it closes (Play again, Change game, a tap, the next Match), the offer does not return to a card (`mgc.installDismissed`); the sheet's row stays. A joined phone has no row, because its strip is its status, so it gets the offer on the result card only. What to offer is one pure function, `installOffer` in `apps/pwa/src/install.ts`, of the platform, whether the app runs installed, whether the page is inside another app's browser, the count and the dismissal. `apps/pwa/src/installer.ts` reads those from the browser.

- **Android:** an **Install** button, with the reason (full screen, no browser bars). It opens the browser's own install dialog when the browser has offered one (`beforeinstallprompt`, held from the page's start). Chrome's own install bar is held back, so nothing is offered before the first finished Match. Without an offered install, the button gives way to the menu steps (⋮, Install app).
- **iPhone and iPad:** the steps: Share (in Safari's ⋯ menu since iOS 26), then Add to Home Screen. Chrome on iOS gets its own: Share, right of the address bar, then Add to Home Screen.
- **A computer:** nothing.
- **Inside another app's browser** (Instagram, Facebook and Messenger, TikTok, Line, or any app's Android WebView, recognised by the user agent): a banner from the first screen on, "Open this page in Safari or Chrome", heading the first phone's sheet and under a joined phone's strip. There is no install offer there, because such a browser cannot add to the home screen.
- **Running installed** (display mode `fullscreen`, `standalone` or `minimal-ui`, or iOS's `navigator.standalone`), or installed from this tab: none of it.

## The session log: what each phone records, and how to get it off the phone

Every page keeps a log of what it saw (`apps/pwa/src/recorder.ts`), in IndexedDB, so it survives reloads and crashes: the newest 20 000 lines (about 3 MB), one database per Device id. Nothing leaves the phone until you export it.

**Export:** in [Maker mode](#connectivity-flags), the Host's sheet has **Export log** (and **Clear**) at the bottom and a Peer's strip has **Log** at the top right; without it the log still records, and switching Maker mode on later exports everything recorded before. On a phone the browser's share sheet opens (`navigator.share` with a file): send the `.txt` to yourself by mail, AirDrop, Drive, a chat. Where files cannot be shared (desktop browsers), the file downloads. The name is `mgc-<code>-<host|peer>-<time>.txt`.

**Format:** NDJSON, one JSON object per line, the first a summary (`k: "export"`: Device, role, code, line count, when the log started). Every other line has `t` (shared time, ms: the Host's clock, this phone's own until it synced), `w` (wall time, ms since the epoch) and `k` (the kind), then the kind's fields:

| `k` | When | Fields |
|---|---|---|
| `device` | page load | `ua`, `platform`, `pxPerMm`, `viewport`, `screen`, `dpr`, `touchPoints`, `cores`, `standalone`, `url`, `turn` (this page has TURN servers), `turnProblem` (the build's TURN setting is unusable, and why) |
| `viewport` | load, and every resize / toolbar change | `width`, `height`, `inner`, `dpr` |
| `tick` | once a second | `fps` (this page's animation frames), `hidden`, `wake` (a screen wake lock is held), `peers` (WebRTC connections this page holds: on the Host one per Peer; on a Peer above 1 means Trystero's Peer↔Peer mesh); `tx` / `rx`: frames `n` and bytes `b` sent / received since the last tick, per channel (`msg` carries Match frames and the lobby, `clk` clock pings, `clkrep` clock reports, `roster`, `hello`, `info`); on a Peer in a Match, `state`: the Host's state frames that arrived this second: `n`, `gap` (the longest time between two consecutive ones, ms; a silence of several seconds is on the line of the second that ends it), `ageMin` / `ageAvg` / `ageMax` (shared time at arrival minus the time the Host published it, ms) |
| `peer-join`, `peer-leave` | the transport sees a connection come or go | `peer` (transport id), `peers` left, `afterMs` connected |
| `roster` | status, presence or any Device's sync changed | `status`, `roster[]` with `deviceId`, `name`, `present`, `synced`, `rtt`, `offset` |
| `link` | a Device's connection changed, as this page's roster says: `ok`, `weak` (2.5 s silent), `lost` (5 s, or the connection closed); one line for each Device's first entry | `deviceId`, `link` |
| `clock` | a Peer gets a clock reply (10 in the first second, then one a second: the heartbeat) | `q`, `rtt`, `offset` (ms, this sample alone) |
| `device-lost`, `device-back` | the Session gave a Device up (`LOST_MS` of silence or its connection closed) / has it back | `deviceId` |
| `match`, `lobby` | the lobby froze a Match (the whole `MatchInfo`, `game`, `template`) / returned to the lobby | |
| `match:<event>` | every `runMatch` event on this page: `started`, `paused`, `resumed`, `holders`, `ended`, `closed`, `view-closed`, `fault` (with the stack), `log` (every `ctx.log`, not just the last 50) | the event's fields and `matchId` |
| `visibility` | the page went to the background or came back | `hidden` |
| `error` | an uncaught error or rejection on the page | `message`, `stack` |
| `ice` | a peer connection joined (`event: join`), changed connection/ICE state, left, is still there 6 s after its join (`settled`), or a link turned `weak`/`lost` | `peer`, `event`, `connection`, `ice`, `gathering`, `signaling`, `sdp` (which side offered), `pair` (the selected candidate pair: `local`/`remote` with `type` host/srflx/prflx/relay, `net` (the kind of network the address is on: `hotspot` for an iPhone hotspot's own subnet, `private`, `cgnat`, `public`, `mdns`, `v6`, `link-local`, `hidden`; never the address), `proto`, `mdns`, `v6`; `rtt`, bytes, STUN requests sent / answered / received), `others` (every other pair ICE holds), `dc` (the data channel's state and message counts) |
| `relay` | this Peer's transport went relay-only, or back to every path | `relayOnly`, `failures` (connection attempts in a row that did not last, before it went relay-only) |
| `withhold` | this Host stopped signaling its own addresses to the connections that follow | `failures` (connections in a row that ended within 15 s of coming up) |

Reading it: `jq -c 'select(.k=="clock") | [.t,.rtt,.offset]' log.txt` plots a Peer's sync; `select(.k=="tick") | .fps` the frame rate; `select(.k=="tick") | .peers` on a Peer shows whether it holds connections to other Peers besides the Host (the mesh); `select(.k=="link")` lists every `weak`/`lost` stretch; the gap between a `peer-leave` and the `device-lost` that follows is the leave-detection latency; `match:paused`/`match:resumed` and `match:fault` carry their reasons. `select(.k=="tick" and .state) | [.t, .state.n, .state.gap, .state.ageMax]` on a Peer shows how the Host's states arrived: at 60 states a second a `gap` near 17 ms is an even stream, a `gap` of hundreds of ms a delivery stall (the view had nothing new to draw for that long), and `ageMax` how stale the oldest one was; a pause shows as one large `gap` at the resume. Faults with stacks and every `ctx.log` line are in there even after the HUD's 50-line log has rolled over.

## Connectivity flags

- **The TURN relay.** A build carries the TURN servers of an account its maintainer owns, as the build-time setting `VITE_MGC_TURN_SERVERS` (a JSON array of ICE servers; `apps/pwa/src/turn.ts`). `pnpm setup-turn` (run it from Git Bash on Windows) walks you through a free Metered account, writes the setting to `apps/pwa/.env.local` for the dev server and local builds, and sets the repository secret `MGC_TURN_SERVERS` the hosted build reads (`.github/workflows/pages.yml`). The servers are readable in the published JavaScript; the wizard says how to revoke them. A build without the setting has no relay: phones connect directly or not at all, and the `device` log line says `turn: false` (with `turnProblem` when the setting is there and unusable).
- **When a phone uses it.** ICE prefers a direct pair, so on a network that works the relay carries nothing. A Peer whose connection to the Host died three times in a row without lasting 15 s stops trying the direct path and joins through the relay only (`RELAY_AFTER` in `apps/pwa/src/main.ts`; the policy is `packages/core/src/relay-escalation.ts`); its log gets a `relay` line and its `ice` lines show a `relay` pair. If the relay does not connect within 20 s the phone goes back to trying every path. A relayed connection costs latency (the packets leave the table and come back) and counts against the account's quota.
- **A Host that stops signaling its own addresses.** After one connection to a Peer ended within 15 s of coming up, the Host leaves its own addresses (ICE `typ host` candidates) out of what it signals for every connection that follows, until the page is reloaded (`WITHHOLD_AFTER` in `apps/pwa/src/main.ts`; `packages/core/src/own-addresses.ts`). A Peer still finds the Host: it sees where the Host's connectivity checks come from, and its `ice` lines then show the Host as `prflx`. It is there for an iPhone that is the Personal Hotspot: that phone signals its cellular address, and a Peer's checks toward it are what every dying attempt of live runs 5 and 6 had in common. Whether it makes the hotspot's direct path live is not yet shown on phones; the Host's log gets a `withhold` line, and a Peer that still fails goes to the relay as before. A Peer leaving within 15 s of joining on a healthy network switches it on too; there the connection forms the same way, checked between two Chrome tabs.
- `?noturn` on the Host's address leaves the relay out, for comparison runs; the QR carries the flag so every Peer does the same.
- `?maker` switches on **Maker mode**, the app as its makers see it (`apps/pwa/src/maker.ts`): the clock figures and the makers' words beside the players' ("syncing clocks", `rtt · Δoffset`, the count on the first phone's advice line), the counting beat on a phone's screen before it is in, the game log, and the session log's **Export log**, **Clear** and **Log**. The phone remembers it for later visits without the flag (`localStorage` `mgc.maker`); `?maker=no` switches it off again, and that is remembered too. The Host's QR code and its typed address ("open <address>/?maker") carry the flag, so one scan sets the whole table. The session log records the same lines with Maker mode on or off.
- Phones are measured upright: the manifest asks for portrait (locked when installed on Android; an iPhone ignores it, installed or not), and a phone turned sideways shows "Turn your phone upright" until turned back.
- Safari Page Zoom is corrected for (`device.ts` `pageZoom`): 75 % zoom no longer makes a phone's Tile a third too large. Safari applies the zoom some tens of ms after the page starts, so the phone is measured once its viewport has been still for 120 ms (`viewportSettled`).

## Two hosted builds: the latest and a known-good one

Every push to `master` publishes the PWA to **https://manubown.github.io/Bezel/next/**. The same site also serves **https://manubown.github.io/Bezel/play/**, the app for everyone: the commit the git tag `stable` points at, built from its own tree. Both sit below the site at **https://manubown.github.io/Bezel/** (`apps/site`), and one workflow publishes all three (`.github/workflows/pages.yml`, `scripts/pages.mjs`). So a change that misbehaves on phones is tested against the known-good build by opening the other address: no rollback, no redeploy, both are live at once.

- `pnpm stable` prints where `stable` points; `pnpm stable <ref>` moves the tag to a commit, tag or branch, pushes it, and Pages rebuilds the site and both builds (`scripts/stable.mjs`). `/play/COMMIT` and `/next/COMMIT` name the commit each build was made from.
- Put every phone on the **same** address: a Host on `/play/` and a Peer on `/next/` are different builds, and the QR code only guarantees that by encoding the Host page's own URL.
- The old addresses forward, each with its query: `/Bezel/stable/` to `/Bezel/play/`; `/Bezel/?room=CODE`, the QR of a first phone still on a build from before the move, to `/Bezel/next/?room=CODE`; `/Bezel/` opened from an icon installed from it to `/Bezel/play/`.
- Both builds share the origin, so a phone keeps its Device id and its session logs across them.
- `pnpm pages` builds what Pages publishes into `apps/site/dist` and checks that every link resolves and every forward keeps its query; `pnpm --filter @mgc/site preview` serves it under `/Bezel/` (Node 22.23.4 or newer, for Astro).

## Several tabs on one computer

Each tab of one desktop browser gets its own Device id (a Web Lock per id; a reloaded tab takes its own back: `apps/pwa/src/device.ts:41-57`), so one computer can run a Host tab (`https://localhost:5173/`) and Peer tabs (`https://localhost:5173/?room=CODE`). Keep every tab visible, in separate windows: a hidden tab stops its view's `draw` (`packages/sdk/src/game-side.ts:419`), and a hidden Host tab gets no animation frames, so its host's `tick` stops. Desktop tabs use `pxPerMm` 3.78.
