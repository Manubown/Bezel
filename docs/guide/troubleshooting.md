# Troubleshooting

One entry per symptom: what you see, why, what to do. Where a Game says something, look in two places: the Host's sheet in [Maker mode](running-on-phones.md#connectivity-flags) (open it with `?maker`; "game log": faults, `ctx.log` lines, refusals and closes) and the browser console of the phone it happened on (`<Game>: fault in host.tick: …` with the stack, `<Game> host: …` for logs; `apps/pwa/src/main.ts:186-187`). In a test, the same lines are `t.events(deviceId)`.

## Setup

### The browser says the connection is not private

- **Cause:** the dev server's certificate is self-signed (`@vitejs/plugin-basic-ssl`, `apps/pwa/vite.config.ts`). HTTPS is required for the wake lock and WebRTC on phones.
- **Fix:** accept the warning once on each phone and browser. To avoid it, use the hosted build (https://manubown.github.io/Bezel/), which has only the Games on `master`.

### `pnpm install` refuses the lockfile after `pnpm new-game`

- **Symptom:** `pnpm install` stops with a frozen-lockfile error ("specifiers in the lockfile … don't match").
- **Cause:** the new `games/<slug>/package.json` adds a workspace package, so `pnpm-lock.yaml` must change, and pnpm will not change it when the `CI` environment variable is set (seen in `.scratch/dev-onboarding/issues/01-template-discovery-typecheck.md:31`).
- **Fix:** `pnpm install --no-frozen-lockfile`, and commit the updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile` (`.github/workflows/pages.yml:37`).

### My Game is not in the Host's Game row

In Maker mode the PWA lists exactly the default exports of `games/*/src/index.ts`, minus `games/_template`, sorted by `manifest.name` (`apps/pwa/src/games.ts:8-15`). Without it, players see Pong and Air Hockey only (`apps/pwa/src/gamelist.ts`).

| Cause | Fix |
|---|---|
| the Host is not in Maker mode | open the Host's address with `?maker` (remembered on that phone; `?maker=no` switches it off) |
| the entry is not at `games/<slug>/src/index.ts` | move it there; that path is the glob |
| the folder is `games/_template` | `pnpm new-game <slug> "<Name>"` copies it under a new name |
| it is there, but further down: the list is alphabetical | look for its `manifest.name` |
| the dev server was started before the folder existed | reload the page; restart `pnpm dev` if it still does not show |

### The page stays blank and the console shows "does not default-export a Game" or "Two Games share the manifest id"

- **Cause:** `apps/pwa/src/games.ts` throws while the page loads (lines 12 and 19), so nothing starts: a `games/*/src/index.ts` has no `export default defineGame(…)`, or two Games have the same `manifest.id` (a hand-copied folder keeps its source's id).
- **Fix:** default-export `defineGame({ … })`; give every Game its own id (`mgc.<slug>`; `pnpm new-game` does this).

## Joining

### Phones cannot find each other ("Finding table CODE…")

| Cause | Fix |
|---|---|
| a phone has no internet: signaling goes through public Nostr relays (`packages/core/src/trystero-transport.ts:159-161`) | give every phone internet; there is no offline mode yet (M5, `docs/PLAN.md:88`) |
| the phones are on different networks | put them on one Wi-Fi or one phone's hotspot (README) |
| the Host page was opened as `localhost`, so its QR code points at `localhost` (`apps/pwa/src/hud.ts:127-129`) | open the Host page at the `Network` address Vite prints |
| the Peer opened the address without `?room=`, so it became a Host of its own table | type the Host's code into its "Code" field, or open `/?room=CODE` |
| the Host's page is closed, hidden or asleep: the Session lives on the Host (ADR-0002) | keep the Host's screen on and the page open |
| the code is wrong: after 15 s the card reads "Table CODE not found yet" | type the code the first phone shows into the card's field and press Join; the page opens that table with the same flags |

### A phone stays in the lobby when the Match starts

| Cause | Fix |
|---|---|
| it joined after Start: no joins mid-Match ("A match is on · you join the next one") | wait for the next Match |
| its build does not have that Game: the console says `This phone has no Game <id>: it sits Match <id> out` (`apps/pwa/src/main.ts:160-164`). A phone on the hosted build can join a dev-server table's code | open every phone on the same server |

## Starting

### Start is refused

The reason shows under the Start button. Never the arrangement: Start picks the Game, and picking a Game lays the phones in an arrangement it names. The lobby checks in this order (`apps/pwa/src/lobby.ts:455-479`):

| Message | Cause | Fix |
|---|---|---|
| `<Game> does not support bots` | a Bot chip is pressed and the manifest has no `bots: true` | release the Bot chip, or add `bots: true` and play the bots in the host |
| `<Game> needs 1–4 Tiles; 5 present` | `manifest.tiles` (Controllers are not Tiles) | add or remove phones, or mark some as Controllers |
| `<Game> needs 1 Controller; 0 present` / `needs 1 Controller; 2 present` | `manifest.controllers`; a Game that takes no Controllers puts every phone on the table when it is picked | press or release Controller chips |
| `Phone 2 is 61.3 × 120 mm; <Game> needs Tiles of at least 65 × 120 mm` | `manifest.minTileMm`; sizes come from the `pxPerMm` guess | use a bigger phone, or lower `minTileMm` |
| `Phone 2 is still joining` | a phone has not synced its clock or said who sits there yet | wait for its sync dot in the roster |
| `Two Players have the same id` | two phones reported one Player id; each phone's Player id is stored in its browser (`apps/pwa/src/device.ts:59-71`) | clear the site data on one of them, so it gets new ids |
| `<Game> needs 2 Players; 1 seated` | `manifest.players` counts the seated Players, bots included: with `seats: 'ends'` only the first and the last Tile seat anyone and an empty slot counts for nobody; with `seats: 'controllers'` each Controller phone that has said who holds it seats one ([seats](concepts.md#seats-and-bots)) | `'ends'`: add a phone at the end, or press a Bot chip (if the Game has bots); `'controllers'`: press another phone's chip under "Players’ phones" |
| `A Match is already running` (`apps/pwa/src/lobby.ts:318`) | | End match first |

Numbers in the table are examples; the message names the Game and the real counts.

## During a Match

### The Match pauses ("Waiting for …") when a phone sleeps

- **Cause:** the phone's screen turned off or its page was hidden, and its connection dropped. A phone holds a wake lock from its first tap on the page, lobby included (`apps/pwa/src/wake.ts:9-56`), so only a phone nobody has touched since its page loaded follows its own auto-lock. The Host notices after 5 s of silence (`LOST_MS`, `packages/core/src/session.ts`; at once when the connection closes), then pauses every phone (`apps/pwa/src/pause.ts:12-35`).
- **Fix:** tap every phone once after it joins. To resume, wake the phone: back within 30 s, it plays on in the same Match ([reconnecting](#lost-the-table-reconnecting-on-a-peer)); later, it rejoins the Match by itself once its connection is back; reload its page if it does not come back. The Match resumes when it is back and synced.

### The pause never ends

- **Cause:** the platform resumes only when every lost Match phone is back **and** has synced its clock.
- **Fix:** reload the lost phone's page (its address keeps `?room=CODE`, and it rejoins under the same Device id); or press End match on the Host.

### "Lost the table. Reconnecting…" on a Peer

- **What it means:** this phone had the Host and lost it: the connection closed, the Host was silent for 5 s (`LOST_MS`; the 1 Hz clock pings are the heartbeat), or a re-attach did not sync its clock within 4 s (`SYNC_TIMEOUT_MS`, `packages/core/src/session.ts`). The phone drops its connections and looks for the Host again by itself. In the lobby its strip says so, and after 15 s a card: "Still reconnecting to table CODE", what to check, **Try again** and the code; during a Match a card over the Game does: "Lost the table. Reconnecting… · the match goes on when the connection is back".
- **During a Match:** the phone keeps its part of the Match, its Game view and state, for 30 s (`REJOIN_GRACE_MS`, `apps/pwa/src/rejoin.ts:5-6`). Back with the same Host within that time, and the Host's lobby still names the Match, it says `hello` and the Host replays the current state and its pause to it: the Match goes on, no lobby, no result card (`apps/pwa/src/rejoin.ts:37-60`, `apps/pwa/src/main.ts:236-270`). Meanwhile the Host has lost the phone too: within 5 s it pauses the Match on every other phone ("Waiting for phone 2 · It lost its connection · the match goes on when it is back") and resumes once the phone is back and synced; the returning phone reads "You’re back · the match goes on in a moment" until that resume. In the browser smoke a dropped connection was back and playing within 1.7 s.
- **When it gives up:** after 30 s without the Host, the phone stops its part: "Connection lost", then the lobby. The Host keeps waiting until End match, and the phone rejoins the same Match by itself once its connection is back (its part starts afresh from the Host's state). If the Host is back without the Match, the card reads "Connection lost · The host phone restarted": its page reloaded ([the host phone reloaded](#the-host-phone-reloaded)), or it ended the Match while this phone was away, which a returning phone cannot tell apart. If the Host has started another Match meanwhile, the card reads "Connection lost".
- **Fix:** keep every phone awake and on one network ([wake lock](running-on-phones.md#screen-wake-lock)). If it does not come back, reload the phone's page (its address keeps `?room=CODE`). Its log has the cause: a `peer-leave` (the connection closed) or `link` lines going `weak` before the `roster` line with `status: "reconnecting"` (silence).

### The Host's roster says "weak connection" for a phone

- **What it means:** the Host has not heard that phone for 2.5 s, two missed clock heartbeats (`WEAK_MS`, `packages/core/src/session.ts`); the row shows its green dot again (in Maker mode its clock numbers) as soon as the phone is heard (`apps/pwa/src/hud.ts:382-388`). Not a pause: the Match goes on. After 5 s of silence (`LOST_MS`) the phone counts as lost: its row reads "disconnected", and a Match it is in pauses.
- **Fix:** usually nothing; it was a blip. Often or for long: the phone's screen is turning off (tap it once), it is far from the Wi-Fi, or the network drops packets (live test 1's hotspot). The `link` lines in the Host's log list every `weak` and `lost` stretch per phone.

### "The game crashed" on every phone, or "The game stopped on this phone"

- **Cause:** the fault ladder closed a side (`packages/sdk/src/match.ts:92-93`, `packages/sdk/src/game-side.ts:18`):

| Detail on the card / in the log | Why |
|---|---|
| `4 faults within 5 s, the last host.tick: <message>` | more than 3 handler throws within 5 s on one side |
| `host.factory: <message>`, `view.factory: <message>` | a factory threw or returned no handlers |
| `view.draw: <message> (threw on 10 frames in a row)` | `draw` threw on 10 frames in a row |

A host side that closes ends the Match everywhere ("The game crashed"). A Peer's view that closes takes only that phone out; the Host's own view closing shows "The game stopped on this phone" while the others play on.
- **Fix:** read the first fault in the Host's game log or that phone's console (`<Game>: fault in <where>: <message>` with the stack) and fix the throw. A test shows the same as `fault` events: assert there are none ([testing](testing.md#asserting)).

### The log says `publish rejected: the Match has ended`

- **Cause:** the host game called `publish` after `end` in the same turn; `setHolder`, `timer` and a second `end` are refused the same way (`end rejected: the Match has already ended`) (`packages/sdk/src/match.ts:430-437`). Nothing reaches the views after `end`.
- **Fix:** publish the final state first, then call `end` (Pong and Pass do).

### The log says `set-holder rejected: …`

| Message | Cause |
|---|---|
| `set-holder rejected: d1 is a Tile, not a Controller` | the Device is a Tile |
| `set-holder rejected: "d9" is not a Device of the Match` | no such Device in `match.devices` |
| `set-holder rejected: "p-zed" is not a Player of the Match` | no such Player in `match.players` |
| `set-holder rejected: the Match has ended` | after `end` |

- **Fix:** take Controller ids from `match.devices.filter((d) => d.role === 'controller')` and Player ids from `match.players` (`packages/sdk/src/holders.ts`). `holderOf` keeps its old value after a refusal.

### A tap or message during a pause had no effect

- **Cause:** while paused the Host drops every input and message; the view still sends them (`packages/sdk/src/match.ts:235-251`, `264-272`). A finger held across the pause gets a `cancel`, and its moves are dropped until it lifts and touches again.
- **Fix:** grey out a DOM view's buttons in the view's `onPause` and enable them in `onResume`; never depend on a message sent around a pause.

### `TypeError: send: msg is undefined, not JSON` (or `publish: state.ball.x is NaN, not JSON`)

- **Cause:** `send`, `publish` and `end` accept plain JSON only and throw at the call site otherwise: `undefined`, `NaN` or `Infinity`, functions, `Map`, `Set`, `Date` or other class instances, cycles (`packages/sdk/src/json.ts`). The message names the path. Thrown inside a handler it is a fault (a `publish` in `tick` faults every step, and the fault budget then closes the Match); thrown in your own DOM listener it is an uncaught error in that phone's console.
- **Fix:** send `null` or leave the key out instead of `undefined`; guard the arithmetic that produced `NaN`; turn `Map`/`Set` into objects or arrays and `Date` into milliseconds.

### The screen stays black after Start

| Cause | Fix |
|---|---|
| the host has not published yet: a view's `Frame.state` is `undefined` until the first state arrives, and most views draw nothing without one | publish a first state in the host factory (`games/_template/src/index.ts:56-57`) |
| the view draws outside its Tile: `Frame.ctx` is in world mm and each Tile shows only its own part of the World | draw at world coordinates; for per-phone text, draw relative to `tile.x`, `tile.y` (template: `games/_template/src/index.ts:86`) |
| `draw` throws: frames are skipped, the first throw is in the log | fix the fault |

### Touches on one phone do nothing

| Cause | Fix |
|---|---|
| the phone is a Tile that seats nobody: with `seats: 'ends'` only the first and the last Tile seat a Player (`apps/pwa/src/lobby.ts:9-10`), with `seats: 'controllers'` no Tile does ([seats](concepts.md#seats-and-bots)), so a lookup by `Player.deviceId` finds no one (the template ignores it: `games/_template/src/index.ts:63-64`) | decide what an unseated Tile's touch means in your Game; it still arrives with its `deviceId` |
| the phone is a Controller nobody holds: its input carries no `playerId` | `setHolder` it to a Player first |
| the Match is paused, or the finger was down across a pause | see above |
| the view set `input: 'off'`: the SDK captures no pointers on it, so only the view's own listeners see touches | keep the default (`'coalesced'`) for a canvas view; a DOM view that sets `'off'` sends what it needs with `send` |

### Nothing animates on a phone in the background, or the whole Match freezes when the Host's screen is hidden

- **Cause:** `draw` runs only while the page is visible (`packages/sdk/src/game-side.ts:419`). The host's `tick` runs on the Host tab's animation frames, which a hidden tab does not get; when it is back, at most 5 steps are caught up and the rest is dropped (`packages/sdk/src/match.ts:86`, `366-381`).
- **Fix:** keep game logic in the host and out of `draw`; keep the Host's screen on. On a computer, put each tab in its own visible window.

### Objects are different sizes on different phones, or do not line up across a bezel

- **Cause:** each phone's px per mm is a guess from its user agent (`apps/pwa/src/device.ts:73-83`); a phone whose real density differs draws everything too large or too small. A phone whose page loaded while it was sideways, or whose iOS toolbar appeared after its page loaded, keeps the size it measured then.
- **Fix:** none in a Game (it sees only mm). Check the lobby's millimetre grid across the phones; reload a phone while holding it upright ([running on phones](running-on-phones.md#pxpermm-is-a-guess)).

### The host phone reloaded

- **What comes back:** the room code, so the Peers find the Host again within a few seconds (`apps/pwa/src/main.ts:22-23`), and the lobby as the Host set it: arrangement, Tile order, Controllers, the picked Game, the Bot chips. The Host's page keeps them per room code in that tab's `sessionStorage` (`mgc.lobby.<CODE>`, `apps/pwa/src/lobby.ts:85-126`). Each phone takes its old place when it is back, a phone that does not come back leaves no gap, a new phone joins at the end. Moving a phone with ◀ ▶ before all are back gives up the places of the missing ones.
- **What does not:** the running Match: its host game lived in the Host's page. Every Peer shows "Lost the table. Reconnecting…" until it finds the reloaded Host (2 s in the browser smoke), then its Match ends with "Connection lost · The host phone restarted" (`apps/pwa/src/rejoin.ts:62-68`); press Start again.
- **Fix:** keep the Host's page from reloading: install the app ("Add to Home Screen"), which has no pull-to-refresh, and keep the Host's screen on. A new tab, or a closed and reopened one, is a new Host with a new code and an empty lobby (`sessionStorage` lives per tab).

### Every phone reloads and the Match is gone when someone saves a file

- **Cause:** the PWA imports every Game into one bundle (`apps/pwa/src/games.ts:8`), so the dev server answers a change to any Game's source, yours or another Game's, with a full page reload of every tab connected to it (seen in the Quiz Game's browser smoke). The reloaded Host keeps its code and the Peers find it again, but the Match is over; the lobby comes back as it was set ([the host phone reloaded](#the-host-phone-reloaded)).
- **Fix:** do not save while a Match on phones matters. An automated browser run that must survive other people's edits blocks Vite's live-reload connection in its tabs before loading the page (abort requests whose URL contains `/@vite/client`).

## On phones (from live test 1, `.scratch/live-test-1/findings.md`)

### A phone stays on "Connecting…" or "Lost the table. Reconnecting…", and the first phone says it keeps losing its connection

- **Symptom in its log:** `peer-join` → `roster` → one or two `clock` samples → `peer-leave` after ~11 s → `peer-join` again, for minutes. Since connectivity-1 the phone does not wait for the transport: it gives up after 4 s without a synced clock and reconnects itself, so the cycle is a `peer-leave` about 4 s after each `peer-join` and the strip stays on "Connecting…" ("Lost the table. Reconnecting…" once it had been in; in Maker mode its second line alternates "syncing clocks" and "reconnecting to the host"), with the help card after 15 s. The first phone shows "<phone> keeps losing its connection…" above its sheet once that phone's connection ended three times in a row within 15 s.
- **Cause:** the connection opens fine (ICE `connected`, a direct UDP pair with 4–50 ms rtt, the first clock replies arrive), then within 0.1–1.5 s the Host's packets stop reaching the Peer while the Peer's still reach the Host; ICE notices nothing for ~6 s. Seen between iPhones on a Personal Hotspot whose Host is the hotspot phone (its own address is only ever a peer-reflexive candidate), on ~90 % of attempts; the Android phones on the same table connected first time. The `ice` lines in the log (states, every candidate pair with STUN counters, the data channel's message counts, on join and whenever a link turns `weak`) are what settles the rest.
- **Fix:** give the build a TURN relay (`pnpm setup-turn`; [connectivity flags](running-on-phones.md#connectivity-flags)). With one, a Peer that failed three times in a row joins through the relay only and its log gets a `relay` line; without one it keeps looping. Before that, the Host tries a cheaper thing by itself: after the first failed connection it stops signaling its own addresses (its log gets a `withhold` line), so the Peer's second and third attempts run without the address suspected of causing the cut; if one of them holds, the Peer's `ice` line shows a `prflx` pair and no `relay` line follows. The builds up to `02edc2e` named a public relay host that no longer exists, so they had none, whatever their `device` line said about `turn`. Also try hosting on a phone that is not the hotspot, or a normal Wi-Fi router. Export the logs either way.

### The ball does not show on a phone it crosses, or jumps

- **Cause:** that phone's view had no new state for a moment. States travel on one reliable, ordered channel: a lost packet holds back everything behind it until it is sent again, and a view only knows the last state it got. A Game's view decides how long it follows a state on its own; Pong follows the ball's path for up to a second (`MAX_AHEAD_MS`, `games/pong/src/index.ts`), so a stall shorter than that does not hide it.
- **Check:** the Peer's log: `tick` lines with `state.gap` in the hundreds of ms are stalls ([the session log](running-on-phones.md#the-session-log-what-each-phone-records-and-how-to-get-it-off-the-phone)); `fps` far below 60 on that phone is the phone drawing slowly, not the network.
- **Fix in a Game:** extrapolate what moves predictably from the state's own time (`Frame.now - Frame.t`), as Pong does, instead of drawing the last state as it is ([concepts](concepts.md)).

### The page reloads under my finger; the Host's Match dies, a Controller phone keeps pausing the Match

- **Cause:** iOS Safari pull-to-refresh on a downward swipe. Fixed in the current build (`html, body { overscroll-behavior: none; touch-action: none }`); the installed app ("Add to Home Screen") never had it.
- **Fix:** update, or install the app.

### One phone's Tile is a third too big; lines do not meet across its bezel

- **Cause:** Safari's Page Zoom (the `Aa` menu) at 75 % lays out 1.33× the CSS px across the same screen; the phone's log shows `viewport 520×932` with `screen 390×844`. The current build corrects `pxPerMm` for the zoom (`apps/pwa/src/device.ts` `pageZoom`); the `device` line logs `zoom`.
- **Fix:** update, or set Page Zoom back to 100 %.

### The lobby sheet cannot scroll; the QR code is cut off; the Game row is out of reach

- **Cause:** the sheet was taller than the phone and not scrollable. Fixed: the sheet's body scrolls (`.sheet .body { overflow-y: auto }`).

### The phone turned sideways and the Layout is wrong

- **Cause:** phones are measured upright; a turned phone keeps the size it had at load. The current build asks for portrait (`manifest.webmanifest` `orientation: portrait`, locked when installed; in a browser tab a "Turn your phone upright" overlay covers a landscape screen).

### Export log shared a 37-byte "Text.txt" with just the file name

- **Cause:** iOS passed the share's `title` to Notes/Files as a text item. Fixed: no `title` is passed; share the `.txt` file.

## In tests

### `t.state()` did not change after `t.input()`

- **Cause:** a ticking host gets input just before its next `tick`; `t.input` runs only one animation frame at the current time.
- **Fix:** `await t.tick(1000 / tickHz)` after the input (Pong's tests step `1000 / 60`).

### A DOM view faults in `view.mount` with `document is not defined` or `… is not a function`

- **Cause:** tests run in Node on a headless screen (`packages/sdk/src/headless.ts`): no global `document`, and elements have only `append`, `prepend`, `remove`, `style`, listeners and box sizes.
- **Fix:** create elements with `root.ownerDocument.createElement(…)`, add them with `append` (as `games/pass/src/index.ts` does). See [what the headless screen can do](testing.md#what-the-headless-screen-can-and-cannot-do).

### `t.input` presses the wrong button

- **Cause:** the headless screen does not hit-test by position: the event goes to the last element appended (descending into its last child), whatever `at` says.
- **Fix:** none through `createTestMatch` today. A test reaches only the element appended last, so append the button under test last, or render one button at a time. Send what the button would send with `await t.send(deviceId, msg)` instead.

### A Match that runs for minutes of game time times out

- **Cause:** four Devices simulate at roughly 6–12× real time (every animation frame is one macrotask), so a 175 s Match takes 15–40 s; vitest's default timeout is 5 s.
- **Fix:** pass a timeout to `it(…, async () => { … }, 120_000)` for long Matches, or end them sooner with a smaller tunable in the test.

### `drawn()` does not show the state I just published

- **Cause:** views draw in the same frame batch as the host step, possibly before that step's publish has landed.
- **Fix:** `await t.tick(1000 / tickHz)` once more, then read `drawn(deviceId)`.

### The test's `tickHz` and the manifest's disagree

- **Cause:** `createTestMatch` runs the `MatchInfo` you hand it; the lobby would have copied `manifest.tickHz` into it, a test must do so itself. A ticking Game under a `tickHz: 0` Match never gets a `tick`.
- **Fix:** `tickHz: game.manifest.tickHz ?? 60` in the hand-built Match.

## Designing a Game

### Two Players can never race for the same spot on a Tile

- **Cause:** a Tile's input identifies the Device, not the finger: whoever sits at that Tile (`Player.deviceId`) gets the tap. Two humans cannot both tap one phone for themselves.
- **Fix:** give each Player their own Tile or region, or use Controllers (their input carries the Holder). Seen building Tap Race.

### A middle phone, or a phone in a grid's top row, does nothing for anyone

- **Cause:** with `seats: 'ends'` (the default) the lobby seats two Players, at the first and the last Tile in Tile order (`apps/pwa/src/lobby.ts`); every other Tile seats nobody, and in a row-major grid the first Tile is always top-left.
- **Fix:** today, treat unseated Tiles as field (Breakout) or spawn nothing there (Tap Race), and let the Host reorder phones with ◀ ▶. A Game that wants a Player at every phone declares `seats: 'tiles'` (Tap Race, Breakout do); `seats: 'controllers'` seats the Controller phones (Quiz).

### Quiz has one Player although three phones are Controllers

- **Cause:** a build before `Manifest.seats`. Now Quiz declares `seats: 'controllers'`: every phone pressed under "Players' phones" in the Host's sheet is a Player, named in the Players list.
- **Fix:** update; mark each player's phone as a Controller before Start; the board phone stays on the table.

### The result card says "Player 1 wins" after a draw or a team win

- **Cause:** with a `ranking`, the card names `ranking[0]` the winner whatever the scores (`apps/pwa/src/result.ts`).
- **Fix:** omit `ranking` for a draw (the card then says "Draw" on equal top scores). A team result has no good form yet (backlog B10).

### The winner screen never shows: the Match closes the moment `end` is called

- **Cause:** views close at once on `end`; a state published in the same turn is never drawn.
- **Fix:** publish the final state, arm `ctx.timer('end', 3000)`, and call `end` from `onTimer` (Tap Race).

### A phone that reloaded mid-Match shows nothing until something changes

- **Cause:** a build before connectivity-1 02. A reloaded Peer starts a fresh runtime with nothing retained, and the Host then re-sent retained states only on a resume, so a Game that publishes a part of its state only on change (Breakout's brick wall) left that phone blank until the next change. Now the Peer's runtime sends `hello` as its view opens, and the Host answers that phone alone with the Holders, its retained states and the pause while paused (`packages/sdk/src/match.ts:252-263`), so it draws the last published state at once (B4, closed).
- **Fix:** update. A Game's own test can reload a phone with `await t.reload(deviceId)` ([testing](testing.md#createtestmatchoptions)) and check what it draws.

### The resting ball or serve spot is invisible with two phones

- **Cause:** with an even number of Tiles the world centre is in a bezel gap.
- **Fix:** spawn things on a Tile (`match.tiles[i]` with a margin), not at `bounds`' centre; draw a marker so the spot is obvious.

### A state is far bigger on the wire than it looks

- **Cause:** every published number is a 17-digit double, and every frame carries ~235 B of transport envelope on top of the state (measured by Breakout and Snake). Half of a typical state is digits.
- **Fix:** round world mm to 0.1 before publishing (`Math.round(x * 10) / 10`): −43 % on Breakout's state. Budget: Host upload ≈ (N − 1) × tickHz × (state + 235 B); Pong is ~36 KB/s with 3 Peers.

### A tap in the bottom-right corner of the Host's Tile opens the Host's sheet

- **Cause:** while a Match runs, the Host's folded sheet is a small "Setup" pill 8 px in from the bottom-right corner of its screen, over its Tile (`apps/pwa/src/hud.ts:268-274`, `apps/pwa/index.html:42-44`). A tap on it opens the sheet over the Game (`apps/pwa/src/hud.ts:191-197`); the Game never sees that tap. Peers have no pill.
- **Fix:** keep small targets and controls out of the Host Tile's bottom-right corner; tap "Hide" to fold the sheet back to the pill.
