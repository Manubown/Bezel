# App design audit: what a stranger sees, and what to fix first

Checked 2026-11-11 on the working tree (`apps/pwa`, `games/pong`, `games/air-hockey`) and on the hosted build <https://manubown.github.io/Bezel/> (HTML and manifest read the same day). This is an audit. No app code was changed.

**How it was checked.** One reviewer, one context. The review used the impeccable critique and audit heuristics; there was no split into separate reviewers. The dev server ran on port 5193 (`pnpm --filter @mgc/pwa dev --port 5193`). Headless Chromium used an iPhone Safari user agent, touch emulation and two phone sizes (390×844 and 360×780 CSS px). One tab was the Host, a second tab joined as a Peer with `?room=<code>`. One Pong Match was played to the end (7:5), and Air Hockey was started in Row and in Column; the Column Match was ended from the Host. A lost connection was forced, and a wrong code and the Host typing its own code were both tried. The automatic `impeccable detect` scan of `apps/pwa/index.html` and `apps/pwa/src` found 0 issues. That says little: most of the UI is built inside TypeScript strings, which the scan does not read.

**Limits.** This was Chromium, not Safari, and not real phones. Sound, haptics, notch and safe areas could not be tested. The "Turn your phone upright" overlay did not show in emulation (`pointer: coarse` was false there). Timings were measured with both tabs on one computer. Phone timings come from the live-test logs in `.scratch/live-test-1/findings.md`. While the test ran, Vite reloaded both pages once because someone edited `apps/pwa/src/main.ts` at the same time; that is not an app bug.

Screenshots are in [`img/`](img/). Paths in this report are relative to `docs/strategy/`.

---

## Bottom line

- **The Match itself is clean and works; everything around it is a developer console.** The Host's first screen has 26 tappable controls: QR, a code field, 7 Games, 3 arrangements, Controllers, name fields, Bot chips, Start, ◀ ▶ buttons, Export log and Clear. It also shows clock figures such as "1.0 ms · Δ7178.0 ms". No product name appears anywhere ([img/01](img/01-host-first-load-390.png), `apps/pwa/src/hud.ts:136-175`).
- **Put one name on screen this week.** Strangers asked for the app's name, but no screen shows it. The tab title and the manifest say "MobileGameConnect" and "MGC"; only the URL says "Bezel" (`apps/pwa/index.html:8`, `apps/pwa/public/manifest.webmanifest:2-3`). Size S, 0 €.
- **One trap stops first use; fix it first.** Directly under the QR, the Host's sheet has a "Code / Join" field, and the hint text says "enter the code". When the Host types its own code, the page reopens as a Peer of its own table and waits for ever on "Looking for the host…". I tested this ([img/30](img/30-host-typed-own-code-360.png), `apps/pwa/src/hud.ts:146-150`, `:205-210`). Size S.
- **Players cannot see where to put their phone.** The only cues are "right of phone 1" in small grey text and a Tile number drawn at 1.31:1 contrast, which is close to invisible (`apps/pwa/src/scene.ts:49`). On the Host, the open sheet also hides that number. Fix: a big bright number and an arrow. Size S–M.
- **Hide the technical text by default** behind `?debug`: clock ms and Δoffset, "Syncing clocks", the game log, and the Export / Clear / Log buttons. This is the same work as giving a 20-second video a clean screen. Size S.
- **A failing connection and a wrong code both leave people stuck.** On an iPhone hotspot, the Peer shows "Syncing clocks", then "Reconnecting to the host…", for 8–20 s and at worst for 3 minutes, with no advice (findings.md §1, §1f). A wrong code waits for ever. Add a help card after 15 s and a "Change code" button. Size M.
- **The end of a Match has no "Play again".** Peers can do nothing, and the score reads "Player 2 7 · Player 1 5" ([img/12](img/12-pong-result-host-390.png)). Size S–M.
- **The PWA cannot be installed properly yet.** The manifest has `icons: []` and the short name "MGC", and the page has no link-preview tags. Without 192 px and 512 px icons, Chrome on Android does not offer install ([web.dev](https://web.dev/articles/install-criteria)). Size S, 0 €.
- **Cost:** work-list items 1–7 come to about 4–7 developer days [INFERENCE] and 0 € in cash. Fonts from Google Fonts are free ([Google Fonts FAQ](https://fonts.google.com/faq)); host them yourself in the EU (see F19).
- **Do not do yet:** a logo or brand agency, a design system, tutorial carousels, more Games in the list, or a native app for design reasons.

---

## 1. First run, as a stranger

### 1a. The Host: a stranger opens the link, or is handed the first phone

| Time | What is on screen | What they must understand | Where they get stuck |
|---|---|---|---|
| 0–1 s | A black page and nothing else ([img/00](img/00-host-loading-390.png)). `index.html` has no static content; everything waits for the script (`apps/pwa/index.html:144-149`, `apps/pwa/src/main.ts:64`) | — | They cannot tell whether it is loading or broken. No name. |
| ~1 s | A full-height sheet: the code "REZV" in large letter-spaced type, "1 phone · Row", a green "Hide", the QR, "Scan to join, or open manubown.github.io/Bezel and enter the code.", a code field with a Join button, then the Game row (starting at Air Hockey), Row/Column/Grid, Controllers, P1/P2 with Bot, Start, the roster, Export log ([img/01](img/01-host-first-load-390.png)) | This phone is the first of a table, and the other phones scan this QR | "enter the code" sits next to a code field, so they type the code here: the trap ([img/30](img/30-host-typed-own-code-360.png)). "Row", "Controllers", "Bot" and "3 lines · ndjson .txt" mean nothing to them. |
| Friend joins | A new roster row: "2 · right of phone 1 · Player 2 · ● 1.0 ms · Δ7178.0 ms" ([img/06](img/06-host-two-phones-390.png)) | Lay the phones side by side in this order | On real phones every iPhone is called "iPhone", because the name comes from `navigator.platform` (`apps/pwa/src/device.ts:137`) [INFERENCE: not seen on two real iPhones here]. The Host's own Tile number is hidden behind the sheet (`hud.ts:263`). |
| Choose a Game | Air Hockey is preselected because the list is sorted A–Z (`apps/pwa/src/games.ts:15`, `hud.ts:212`). Row is preselected. | Pong is the Game they were shown | Air Hockey belongs end to end (Column; `games/air-hockey/src/index.ts:182`). In Row its text runs sideways and the score overlaps the prompt ([img/table-airhockey-row](img/table-airhockey-row.png)). Picking Pong while Column is set is refused only after Start: "Pong needs the row arrangement, not column" ([img/27](img/27-host-start-refused-360.png), `apps/pwa/src/lobby.ts:459`). |
| Start | The sheet folds into a small "Setup" pill. Both phones show "Player 1, touch to start" and "Player 2, touch to start" ([img/table-pong-touch-to-start](img/table-pong-touch-to-start.png)) | Which player am I? P1 is the leftmost phone. | Nothing on screen links "Player 1" to a phone. Both lines appear on every phone (`games/pong/src/index.ts:311-321`). |
| Play | Paddles, ball, small dim scores ([img/table-pong-playing](img/table-pong-playing.png)) | Drag to move the paddle | The scores are hard to read (2.97:1). There is no sound and no vibration. |
| End | The card "Player 2 wins / Player 2 7 · Player 1 5 / Tap to close" over the sheet, which has reopened ([img/12](img/12-pong-result-host-390.png)) | Tap, then press Start again | There is no "Play again". The sheet with the QR and the debug text is back, an amber "Last match: …" line has appeared, and a game-log box says "closed match closed (ended): the game ended the Match". |

### 1b. The friend who scans the QR

| Time | What is on screen | Where they get stuck |
|---|---|---|
| 0 s | The camera shows a link banner; one tap opens Safari at `…/?room=REZV` | — |
| 0–1.2 s | A black page | No name, no sign of life |
| 1.2 s | "REZV ● Looking for the host… keep the host screen open" and a large grey number counting up in the middle ([img/03](img/03-peer-searching-390.png)) | The number looks like a countdown or a timer. It is a clock beat for developers (`apps/pwa/src/metronome.ts:63-79`). |
| 1.7 s | "Syncing clocks · measuring the offset to the host" ([img/04](img/04-peer-syncing-390.png)) | Technical wording |
| 2.2 s | "Phone 2 of 2 · right of phone 1 · Player 2 · 1.0 ms · Δ7178.0 ms", a large dim "2" on a grid, and a "Log" button ([img/05](img/05-peer-placed-390.png)) | "Right of phone 1" seen from where? The "2" is barely visible. The meaning of "Δ7178.0 ms" is unclear. |
| On an iPhone hotspot | "Syncing clocks", then "Reconnecting to the host… the connection dropped · trying again", repeating: 7.6–19.7 s to ready in run 5 and 3 min 6 s in run 1 (`.scratch/live-test-1/findings.md:8-14`, `:76-80`) | No time limit, no advice, no way out (`packages/core/src/session.ts:42-44` resets every 4–5 s) |
| Wrong code | "Looking for the host…" for ever (tested 25 s, [img/29](img/29-peer-wrong-code-after-25s-360.png)) | The Peer strip has no field to correct the code (`hud.ts:446`) |
| Match ends | "Player 2 wins … Tap to close" ([img/13](img/13-pong-result-peer-390.png)) | Then nothing to do and nothing saying "waiting for the first phone" |

### 1c. Taps and seconds from link to the first Match (two phones, Pong)

| Step | Who | Taps | Measured (two tabs, one computer) | On phones |
|---|---|---|---|---|
| Open the link | Host | 1 | sheet visible after about 1 s (not timed exactly) | not measured |
| Read the sheet and work out what to do | Host | 0 | — | [INFERENCE] 10–30 s for a stranger |
| Camera, aim, tap the banner | Friend | 2 | — | [INFERENCE] 5–10 s |
| Load → Looking → Syncing → "Phone 2 of 2" | Friend | 0 | 1.2 s / 1.7 s / 2.2 s | 1.2–1.6 s when the first attempt lives (run 6); 7.6–19.7 s on an iPhone hotspot (run 5); up to 3 min 6 s (run 1) |
| Lay the phones in order (◀ ▶ if wrong) | Host | 0–2 | — | — |
| Pick Pong (Air Hockey is preselected) | Host | 1 | — | — |
| Start Pong | Host | 1 | — | — |
| Each player touches their own phone | both | 1 each | play starts on the touch | — |
| **Total** | | **Host 4–6, friend 3** | | **[INFERENCE] 30–60 s on good Wi-Fi; minutes on an iPhone hotspot** |

The best case is short. What costs the time is reading a sheet full of controls and the connection loop on a hotspot.

---

## 2. Findings

Severity: **Blocks first use** (a stranger cannot get to a Match alone), **Hurts** (they get there, but confused, or the result looks worse than it is), **Polish**.

| ID | Area | Finding | Severity | Size |
|---|---|---|---|---|
| F1 | Join flow | The Host's own code typed into "Join" leaves the table | Blocks first use | S |
| F2 | Errors | No help when the connection fails or the code is wrong | Blocks first use (hotspot) | M |
| F3 | Branding | No name on any screen; three names in use | Hurts | S |
| F4 | Onboarding | The Host's first screen: 26 controls, 7 Games, Controllers, logs | Hurts | S–M |
| F5 | HUD | Clock figures, game log, Export/Clear/Log shown to players | Hurts | S |
| F6 | Arrangement | Placement cues nearly invisible; identical phone names | Hurts | S–M |
| F7 | Game selection | Wrong default Game and arrangement; refusal only after Start | Hurts | S |
| F8 | In-game copy | "Player 1, touch to start" on every phone; Air Hockey text overlap | Hurts | S |
| F9 | End of Match | No rematch, unclear score, sheet reopens, amber info text | Hurts | S–M |
| F10 | Feedback | No sound, no haptics | Hurts | M |
| F11 | Game identity | Both Games plain white on black; puck the same colour as the paddles; no player colours | Hurts | M |
| F12 | Contrast | Tile number 1.31:1, scores 2.97:1, Setup pill 4.48:1 at 12 px | Hurts / Polish | S |
| F13 | Loading | Black screen until the JavaScript runs | Polish | S |
| F14 | Touch targets | 34–40 px controls; ◀ ▶ 36 px | Polish | S |
| F15 | Inputs | 14 px fields: iOS zooms in on focus | Hurts (Host) | S |
| F16 | Safe areas, orientation | Sheet has no top inset; manifest orientation and lock ignored on iOS | Polish | S |
| F17 | PWA install | `icons: []`, "MGC", no link preview, colour mismatch | Hurts (sharing) | S |
| F18 | Pause copy | A reconnected phone is told it is waiting for itself | Polish | S |
| F19 | Typography | System font at 14 px, 12 px meta, monospace log; no voice | Polish | M |

### F1. Typing the table's own code into "Join" leaves the table (Blocks first use)
- **Evidence.** `hud.ts:146` says "Scan to join, or open **manubown.github.io/Bezel** and enter the code." The form directly below (`hud.ts:147-150`) takes any code, and `hud.ts:205-210` calls `location.assign('?room=…')` without comparing it with the table's own code. Tested: the Host typed its own code and became a Peer of its own table, stuck on "Looking for the host…" ([img/30](img/30-host-typed-own-code-360.png)). Its friends lose their Host at the same moment.
- **Fix (S).** Refuse the table's own code with a message: "That is this table's code. Scan the QR with the other phone." Rename the form "Join a different table" and move it to the bottom of the sheet, folded behind a text link. Change the hint to "Other phones: open the camera and scan this code."
- **Later (M).** A first screen with two large buttons, "Start a table" and "Join a table". It costs one extra tap and removes the confusion for good.

### F2. A failing connection or a wrong code: no help, no exit (Blocks first use on a hotspot)
- **Evidence.** The Peer strip runs "Looking for the host…", then "Syncing clocks / measuring the offset to the host", then "Reconnecting to the host… the connection dropped · trying again" (`hud.ts:457-465`). The Session resets after 4 s without `ready` and after 5 s of silence (`packages/core/src/session.ts:42-44`), so on an iPhone hotspot the text loops. The live runs measured 7.6–19.7 s and 3 min 6 s (findings.md §1, §1f). A wrong code stays on "Looking for the host…" with no limit ([img/29](img/29-peer-wrong-code-after-25s-360.png)). The Peer screen has no field to fix the code and no way back.
- **Fix (M).** Count the seconds on the Peer. After 15 s, show a card:
  > **Still connecting to table REZV**
  > Check the code on the first phone. Keep its screen on.
  > On an iPhone hotspot this often fails: turn the hotspot off and use mobile data or the same Wi-Fi on every phone.
  > [Try again] [Change code]
- Rewrite the states in plain words: "Finding table REZV…", "Connecting…", "Lost the table. Reconnecting…". Move "Syncing clocks" and "offset" to the debug view. Show the same card on the Host when a Peer drops again and again.

### F3. No name on screen; three names in use (Hurts)
- **Evidence.** The tab title is "MobileGameConnect" (`index.html:8`). The manifest has `name` "MobileGameConnect" and `short_name` "MGC" (`manifest.webmanifest:2-3`). The URL and repository say "Bezel", and the README header says "MobileGameConnect". No screen shows any of these; the largest text on the Host is the random room code ([img/02](img/02-host-sheet-folded-390.png)).
- **Fix (S).** Choose one name (see the open questions). Then show it:
  1. on a static splash in `index.html` (see F13);
  2. at the top of the Host's sheet ("Bezel · table REZV");
  3. on the Peer strip ("Bezel · phone 2");
  4. on the result card footer ("bezel.example — play on your phones", once a domain exists);
  5. in `<title>`, the manifest `name`/`short_name`, and the link-preview tags (F17).

### F4. The Host's first screen is a control panel (Hurts)
- **Evidence.** I counted 26 interactive elements. There are 7 Games, including five SDK proof Games (Breakout, Pass, Quiz, Snake, Tap Race) that failed or ended in seconds in the live test (findings.md §5). There are Row/Column/Grid, a "Controllers" row that does nothing for Pong or Air Hockey (both take 0 Controllers; `games/pong/src/index.ts:145`), Bot chips, ◀ ▶, the roster with clock figures, and Export log / Clear ([img/01](img/01-host-first-load-390.png), [img/07](img/07-host-sheet-bottom-log-390.png)). The Game row alone offers 7 choices; more than 4 visible options at one decision point is a known cognitive-load problem.
- **Fix (S–M).**
  - List only Pong and Air Hockey unless `?dev` is in the URL.
  - Hide the Controllers row when the Game takes no Controllers.
  - Show Row/Column/Grid only when the Game allows more than one arrangement, and then as pictures.
  - Move Export log / Clear behind `?debug`.
  - Order the sheet: (1) join QR, (2) "Lay phones like this" with a picture, (3) Game (two large cards), (4) Players, (5) Start.

### F5. Technical text shown to players (Hurts; also blocks a clean video)
- **Evidence.**
  - Roster and Peer strip: `syncStats` "1.0 ms · Δ7178.0 ms" (`hud.ts:382-388`, `:468`, `:471`, `:475`, `:478`).
  - The game log with lines such as "closed match closed (aborted): stopped by the platform" (`hud.ts:168`, `:300-314`). The card on the same screen says "Ended from the host phone" ([img/26](img/26-host-after-stop-360.png)).
  - "Export log", "Clear", "465 lines · ndjson .txt" (`hud.ts:170-174`, `:530`). "Clear" deletes without asking.
  - "Log" on every Peer (`hud.ts:446`).
  - During a Match the "Setup" pill stays in the Host's corner (`index.html:42-44`).
- **Fix (S).** Render all of these only with `?debug`. A long-press on the name could also switch debug on, so the makers can still export logs at a live test. Keep the session log recording in the background; only its buttons move. Fade the Setup pill to 30% after 3 s of play and bring it back on a tap near it.

### F6. Players cannot see where their phone goes (Hurts)
- **Evidence.**
  - The lobby preview draws each phone's number in `#2a2a2a` on `#121212`, a contrast of 1.31:1 (`scene.ts:49`), and the alignment grid at 1.18–1.65:1 (`scene.ts:25`) ([img/05](img/05-peer-placed-390.png), [img/02](img/02-host-sheet-folded-390.png)).
  - The Host's number is covered by the sheet, which opens by default (`hud.ts:263`).
  - The words "right of phone 1" do not say from whose side. Phones get platform names, so two iPhones are both "iPhone" (`device.ts:137`).
  - Reordering uses 36 px ◀ ▶ buttons ([img/06](img/06-host-two-phones-390.png)).
- **Fix.**
  - (S) Draw the Tile number in full white at about 60% of the screen width, with one sentence under it: "Phone 2 → put me to the right of phone 1". On the Host, fold the sheet to its bar as soon as the first Peer is ready, so its "1" shows.
  - (S) Draw a small row of phone outlines on each Tile with "you" filled in.
  - (M, later) Ordering by touch: "Tap the phone on the far left first." Each tap gives the next number. That replaces ◀ ▶ and fixes identical names.
  - (S) Name phones by a colour or an animal ("Fox", "Owl") instead of the platform.

### F7. Wrong default Game and arrangement (Hurts)
- **Evidence.**
  - The default Game is the first by name, Air Hockey (`games.ts:15`, `hud.ts:212`).
  - The default arrangement is Row. Air Hockey is meant for two phones end to end (`games/air-hockey/src/index.ts:182`, `:201`); in Row its prompts read sideways and collide with the score ([img/table-airhockey-row](img/table-airhockey-row.png)).
  - Choosing a Game does not change the arrangement. A wrong pair is refused only after Start, in amber ([img/27](img/27-host-start-refused-360.png), `lobby.ts:458-459`).
- **Fix (S).** When a Game is picked, switch to its first arrangement (Pong to Row, Air Hockey to Column) and grey out the others. Make Pong the default Game. Put each Game's player count and arrangement on its card ("2 players · phones in a row").

### F8. In-game prompts do not say which phone is whose (Hurts)
- **Evidence.**
  - Pong draws "Player 1, touch to start" and "Player 2, touch to start" on every Tile (`games/pong/src/index.ts:311-321`, [img/table-pong-touch-to-start](img/table-pong-touch-to-start.png)).
  - In Air Hockey Row, the score sits 45 mm in from the end (`games/air-hockey/src/index.ts:52`). The prompt sits at half the half-table plus 10 mm (`:469`), which on two 64 mm-wide phones is about 42 mm, so the two overlap ([img/table-airhockey-row](img/table-airhockey-row.png)).
  - In Column the text is the right way up for each player ([img/table-airhockey-column](img/table-airhockey-column.png)); that part is good.
- **Fix (S).**
  - On the player's own Tile: "Touch here to start". On the other Tiles: "Waiting for Ana". Prompts need a phone-to-player link; the Game knows it.
  - Move Air Hockey's prompt toward the centre line, or hide the score until play starts.
  - "BOT" at 4.5 mm (`games/pong/src/index.ts:296-297`) is fine as a label, but it should use the player's colour (F11).

### F9. End of Match: no rematch, an unclear score, clutter (Hurts)
- **Evidence.**
  - The card reads "Player 2 wins / Player 2 7 · Player 1 5 / Tap to close" (`result.ts:12-16`, `hud.ts:103-104`).
  - On the Host the sheet opens again with the QR, a "Last match" line in amber and a log box (`hud.ts:270`, `:296-298`; `index.html:106` colours `.reason` with `--wait`, the warning colour). See [img/12](img/12-pong-result-host-390.png).
  - Peers get "Tap to close" and then nothing ([img/13](img/13-pong-result-peer-390.png)).
- **Fix (S–M).**
  - Host card: "**Ana wins 7–5**" with two buttons, [Play again] (same Game, same players) and [Change game]. Keep the sheet folded.
  - Peer card: "Ana wins 7–5 · Waiting for phone 1 to start the next game".
  - Show the "Last match" line in neutral grey, not amber.
  - The win is the best moment for a short celebration across all Tiles (confetti or a light sweep crossing the bezels). That is cheap, and it is the clip people film.

### F10. No sound, no haptics (Hurts)
- **Evidence.** There are no `vibrate`, `AudioContext` or `Audio(` calls anywhere in `apps/`, `games/` or `packages/` (searched 2026-11-11).
- **What the platforms allow, checked 2026-11-11:**

| Feature | iOS Safari | Android Chrome | Source |
|---|---|---|---|
| `navigator.vibrate()` | not supported, any version | supported since 32; needs a user gesture since 60 | [MDN BCD api.Navigator.vibrate](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Navigator.vibrate.json) (data of 2026-11-10) |
| Haptic tick from `<input type=checkbox switch>` | iOS 18+: a tap on a switch control is felt | — | [WebKit, Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) |
| Web Audio | plays after a user gesture [INFERENCE: standard autoplay rule] | same | — |
| `navigator.audioSession.type = 'playback'` | Safari 16.4+ | not supported | [MDN BCD api.Navigator.audioSession](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Navigator.audioSession.json) |

- Web Audio on iPhone is muted by the silent switch unless the page sets `audioSession.type = 'playback'`. This comes only from developer reports, for example [this one](https://huddee.com/blog/apple-quietly-fixed-web-audio-bug); Apple has no page on it, so it is `[unverified, secondary source]`. Triggering the switch haptic from code works by clicking a hidden switch label. Developers use it widely ([Ionic issue 29942](https://github.com/ionic-team/ionic-framework/issues/29942)), but it is a workaround Apple may change.
- **Fix (M).**
  - Short synthesized sounds (paddle hit, wall, goal, win). Create the AudioContext on the "touch to start" tap, which every player already makes.
  - A sound on/off icon on the Host.
  - `vibrate(15)` on a goal on Android.
  - Try the switch haptic on iOS for goals only, and keep it optional.
  - Sound also makes the video work without music.

### F11. Both Games look the same, and players cannot tell their side (Hurts)
- **Evidence.**
  - Pong and Air Hockey both draw off-white `#f2f0ea` shapes on `#121212` in system-ui (`games/pong/src/index.ts:36-37`, `games/air-hockey/src/index.ts:55-56`).
  - Scores are at 35% opacity (2.97:1).
  - Air Hockey's puck and paddles are the same colour and differ only in size (`:473-491`; [img/table-airhockey-column](img/table-airhockey-column.png)).
  - No player colour exists, so on video nobody can follow who is who.
- **Fix (M).**
  - Give each Player a colour and use it for their paddle, score and "touch here" prompt.
  - Keep the ball or puck white with a short trail that crosses the bezel.
  - Draw scores large at 70% opacity.
  - Give each Game one accent (Pong: the net as a dotted line across all Tiles; Air Hockey: a coloured rink edge) so the two look related but not the same.

### F12. Contrast, measured with the WCAG 2 formula (Hurts for the Tile number; Polish for the rest)

| Element | Colours | Ratio | Needed | Result |
|---|---|---|---|---|
| Body text on the sheet | `#f2f0ea` on `#1b1b1b` | 15.11 | 4.5 | pass |
| Secondary text on the sheet | `#a8a59c` on `#1b1b1b` | 6.99 | 4.5 | pass |
| "Hide"/"Setup" | `#5bc46a` on `#1b1b1b` | 7.83 | 4.5 | pass |
| Start button label | `#121212` on `#5bc46a` | 8.52 | 4.5 | pass |
| Amber notes | `#e0b94a` on `#1b1b1b` | 9.19 | 4.5 | pass (wrong meaning, F9) |
| Setup pill during play (opacity 0.7, 12 px) | ≈`#458f50` on ≈`#181818` | 4.48 | 4.5 | **fails, narrowly** |
| Game scores (35% of `#f2f0ea`, large) | ≈`#60605e` on `#121212` | 2.97 | 3.0 (large text) | **fails, narrowly** |
| Lobby Tile number (the placement cue) | `#2a2a2a` on `#121212` | 1.31 | 3.0 (large text) | **fails** |
| Metronome number before sync | `#4a4a4a` on `#121212` | 2.11 | 3.0 | fails |
| Button and field borders | `#2a2a2a` on `#1b1b1b` / `#121212` | 1.20 / 1.31 | 3.0 if the border is the only cue | Bot chips and ◀ ▶ barely read as buttons |

Rules: [WCAG 2.2, 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) and [1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast). Ratios were computed from the CSS values in `index.html:10-19`, `scene.ts`, `metronome.ts` and the two Games. **Fix (S):** Tile number in `--fg`, scores at 70%, the pill fully opaque, borders at least `#555`.

### F13. Loading shows a black page (Polish; first impression)
- **Evidence.** `index.html` has only an empty canvas and `#hud` (`:144-149`). The first paint waits for the module, the Device id lock (up to 1.5 s on a reload, `device.ts:11`), `viewportSettled` (up to 600 ms, `main.ts:64`) and the QR ([img/00](img/00-host-loading-390.png)).
- **Fix (S).** Put static HTML inside `#hud`: the name, one line ("Phones side by side become one table"), and a small pulsing dot. The script replaces it. No JavaScript is needed for it.

### F14. Touch targets (Polish; ◀ ▶ matter for strangers)
Measured at 390 px width:

| Control | Size (CSS px) | Apple HIG default 44×44 pt | Android 48×48 dp | WCAG 2.5.8 (AA) 24×24 |
|---|---|---|---|---|
| Bot chip, Controllers chip | 47×34, 94×34 | below | below | pass |
| ◀ ▶ move | 36×36 | below | below | pass |
| Game / arrangement segments | 55–119×40 | below in height | below | pass |
| Code field, Join | 290×40, 60×40 | below in height | below | pass |
| Name fields | 202×36 | below | below | pass |
| Start | 358×44 | meets | below | pass |
| Peer "Log" | about 40×26 (estimated from [img/05](img/05-peer-placed-390.png)) | below | below | pass |

Sources: [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) (iOS default control size 44×44 pt, minimum 28×28 pt), [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps) (48×48 dp), [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (24×24 CSS px). Everything passes the legal minimum. **Fix (S):** set `min-height: 44px` on all sheet controls and make the Start button 52–56 px tall.

### F15. 14 px text fields make iPhones zoom in (Hurts the Host)
- **Evidence.** Inputs use `font: inherit` at 14 px (`index.html:23`, `:58`, `:98`). iOS Safari zooms in on a field below 16 px when it gets focus, and iOS 10+ ignores `user-scalable=no` ([CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/); this is a widely reported behaviour, with no Apple page, `[secondary source]`). The canvas loop sizes itself to `visualViewport` (`metronome.ts:23-33`). [INFERENCE] A zoom left in place after typing a name could therefore mis-draw the Host's Tile; not tested on a phone.
- **Fix (S).** `font-size: 16px` on every `input`.

### F16. Safe areas and orientation (Polish)
- **Safe areas.** The Peer strip pads for the notch (`index.html:122`). The Host's sheet pads only the bottom (`:39`). When the sheet is taller than the screen, as on 390×844 (824 px of content in 787 px), its bar reaches the top edge. [INFERENCE] As a Home Screen app with `viewport-fit=cover` (`:5`), that bar sits under the status bar or Dynamic Island. Fix (S): `padding-top: env(safe-area-inset-top)` on `.sheet`.
- **Orientation.** The manifest asks for `orientation: portrait` and `main.ts:95` calls `screen.orientation.lock`. Safari on iOS supports neither ([BCD manifests.webapp.orientation](https://bcd.developer.mozilla.org/bcd/api/v0/current/manifests.webapp.orientation.json), [BCD ScreenOrientation.lock](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.ScreenOrientation.lock.json)). The CSS overlay "Turn your phone upright" (`index.html:139-141`, `:148`) is therefore the only guard on iPhone, which is fine.
- **Docs.** The guide's line "installs it full-screen … locked when installed" (`docs/guide/running-on-phones.md:108`, `:144`) is wrong for iPhone; `display: fullscreen` is not supported there (F17).

### F17. PWA install and link preview (Hurts sharing)

| Item | Now | Needed | Source |
|---|---|---|---|
| `name` / `short_name` | "MobileGameConnect" / "MGC" | the chosen name in both | — |
| `icons` | `[]` | 192 px and 512 px PNG (purpose `any`), plus one 512 px `maskable` | Chrome needs 192 and 512 for install ([web.dev install criteria](https://web.dev/articles/install-criteria)). iOS 15.4+ uses manifest icons when there is no `apple-touch-icon` ([BCD manifests.webapp.icons](https://bcd.developer.mozilla.org/bcd/api/v0/current/manifests.webapp.icons.json)). Safari 26 accepts SVG icons everywhere, including the Home Screen ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)) |
| `display` | `fullscreen` | keep for Android; iOS supports only `standalone`/`browser` | [BCD manifests.webapp.display](https://bcd.developer.mozilla.org/bcd/api/v0/current/manifests.webapp.display.json) |
| Home Screen on iOS 26 | — | every site added to the Home Screen opens as a web app by default; no manifest needed, but its icons are used | [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| `background_color`, `theme_color` | `#111111` | `#121212`, same as `--bg` and `<meta name="theme-color">` (`index.html:6`) | — |
| `description`, `screenshots` | none | one sentence and 2 screenshots for Chrome's richer install sheet | [web.dev install criteria](https://web.dev/articles/install-criteria) (tip) |
| Link preview | none: a shared link shows a bare URL | `og:title`, `og:description`, `og:image` (a photo of phones on a table), `og:url` | [ogp.me](https://ogp.me/) |
| Service worker | none | not needed for install in Chrome's current list, or on iOS 26; add one only when offline play is built (M5) | same sources |
| Wake lock | requested on first tap (`main.ts:93`) | works in Safari Home Screen apps only from iOS 18.4 | [BCD WakeLock.request](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.WakeLock.request.json) |

The live test also logged `wake: false` on the iPhone throughout (findings.md:58, :88). That belongs in the connectivity work, not here.

### F18. A reconnected phone is told it waits for itself (Polish)
- **Evidence.** After a forced drop, the Peer first showed "Reconnecting to the host… the match goes on when the connection is back" (`rejoin.ts:9`). Then, for about 0.4 s, it showed the Host's notice "Waiting for Player 2 · Phone 2 lost its connection" on phone 2 itself ([img/table-pause](img/table-pause.png); `pause.ts:55-56`).
- **Fix (S).** On the lost Device, replace the notice with "You're back · resuming…". The pause copy is otherwise good: it names the person and says what happens next.

### F19. Typography and colour system (Polish, for the direction work)
- **Now.**
  - Type: `system-ui` at 14 px for everything; 12 px for meta, the pill and the log (`index.html:23`, `:43`, `:89`, `:111`); a monospace game log (`:113`).
  - Colour: one green accent used for status, links and the main button at once; amber for both warnings and the "last match" note (`index.html:10-19`, `:106`).
  - Neutral and readable, but without voice. The room code is the largest text on screen.
- **Fix.** 16 px base, one display face for the name, Game titles and scores, tabular numbers (already on, `:23`). Self-host the font file. In Germany, loading Google Fonts from Google's servers without consent was ruled unlawful ([LG München I, 20.01.2022, 3 O 17493/20](https://www.gesetze-bayern.de/Content/Document/Y-300-Z-GRURRS-B-2022-N-612?hl=true)); serving the file from your own domain avoids it ([Google Fonts privacy FAQ](https://developers.google.com/fonts/faq/privacy)).

### What already works (keep it)
- **The cross-bezel moment.** The ball is drawn on both phones at the right place as it crosses (it sits half on each edge in [img/table-pong-touch-to-start](img/table-pong-touch-to-start.png)). The resting ball is a ring, so nobody mistakes a serve for play (`games/pong/src/index.ts:301-308`).
- **Pause and reconnect copy** names a person and says what happens next. When both pages reloaded at once (the Vite reload), the Session re-formed by itself under the same code, with the Peer back as "Phone 2 of 2".
- **Air Hockey in Column** turns each player's text to face them ([img/table-airhockey-column](img/table-airhockey-column.png)).
- **The Host's pick is kept across a reload of its page** (`hud.ts:211-213`). The page does not rubber-band or pull to refresh (`index.html:22-23`). The sheet scrolls on short phones; at 360×780 the Start button is above the fold ([img/22](img/22-host-first-load-360.png)).

### Heuristic scores (Nielsen, 0–4, for a stranger)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | States exist but use technical words; no elapsed time; endless search (F2) |
| 2 | Match with the real world | 1 | "ms", "Δ", "Syncing clocks", "Controllers", "ndjson" (F5) |
| 3 | User control and freedom | 2 | End match exists; no way off a wrong table; "Clear" without undo |
| 4 | Consistency and standards | 2 | Amber for warnings and for info; "stopped by the platform" next to "Ended from the host phone" |
| 5 | Error prevention | 1 | Own-code trap; impossible Game and arrangement pairs allowed until Start (F1, F7) |
| 6 | Recognition rather than recall | 2 | Players must work out which phone is "Player 1" and which "iPhone" is which (F6, F8) |
| 7 | Flexibility and efficiency | 2 | Picks are remembered; no rematch shortcut (F9) |
| 8 | Aesthetic and minimalist design | 1 | 26 controls plus debug text on the first screen (F4) |
| 9 | Recognise and recover from errors | 2 | Pause and resume are good; connection failure gives no guidance (F2) |
| 10 | Help and documentation | 1 | No help in the app; the guide is written for developers |
| | **Total** | **16/40** | **Poor** for a stranger. That is normal for a working prototype, and most points come back with S-sized changes. |

---

## 3. Design direction

The product idea is "phones become one table". The look should make the gaps between phones part of the show and make the name readable on camera. Three directions follow, all described in words; none needs new images to try.

| | A. Night table (recommended) | B. Game-room felt | C. Paper and signal |
|---|---|---|---|
| Idea | Dark screens make the black bezels disappear, so the phones read as one surface; colour comes only from the players | A pub table: green felt, chalk lines, brass | Bright paper screens; the bezels become black seams, and the seam is the brand |
| Palette | Near-black `#0B0B0C`; ivory `#F2F0EA` for the ball and text (17.3:1); Player colours coral `#FF6B4A` (7.0:1) and teal `#2EC4B6` (9.1:1); one more pair for players 3–4 | Felt `#0F3B2E`; chalk `#F2EAD3` (10.4:1); brass `#E3B341` (6.4:1) | Paper `#F4F1EA`; ink `#111111` (16.7:1); signal orange `#D63F00` (4.1:1, large text only; the brighter `#FF4F00` is 2.9:1 and fails) |
| Type | One wide geometric display face for the name and scores, system UI for the rest | A condensed sports face for scores, a friendly sans for the UI | A strict grotesk in one weight; very large numbers |
| Motion | A short light trail behind the ball across the bezels; a goal flashes the scorer's colour across every Tile; at Match start the name sweeps letter by letter across the phones | Weighty, eased; the puck slows with friction; chalk dust on a goal | Hard cuts; on a goal the seam between phones flashes; no easing |
| Logo idea | Two rounded rectangles side by side with a dot halfway across the gap | A puck crossing a split rink | The word split by a gap: "BE ZEL" |
| Strength | Smallest change from today (palette, Game drawing, one font); bezels vanish; colours fix "which side is mine"; strong on video in a dim room | Warm and different from "neon web game"; suits Air Hockey and Pong | Most distinctive; turns the bezel into the name's story; reads well in daylight and on camera |
| Weakness | Dark screens look like switched-off phones until something moves; risks looking generic if trails turn "neon" | A texture costs drawing time on old phones [INFERENCE]; can look kitsch; bezels show as black lines on green | White screens use more battery on OLED phones [INFERENCE] and glare at night; every bezel is visible; a large change to all drawing |
| Effort | M (2–4 days) | M–L | L |

**Recommendation: A, Night table.**
- It keeps today's dark base and only adds what is missing: a name, Player colours, a ball trail, readable scores.
- It hides the bezels, which helps the "one table" illusion more than any other choice.
- It fixes F11 and part of F8 for free.
- Keep C in mind for a later landing page or poster, where the split word works well in print.

### What a 20-second video needs from the UI
1. **A clean screen**: no clock figures, no "Log", no "Setup" pill, no room code during play. A `?clean` flag, or debug off by default (F5).
2. **The name on the phones.** A 1–2 s title at Match start that runs across all Tiles. This is the shot that shows "one table" and the name in one frame.
3. **A ball you can follow on camera**: white with a trail, and Player colours on the paddles.
4. **Big scores** at 70% opacity or more, so a viewer can read them at phone-video resolution.
5. **Sound** for hits and goals, so the clip works without music (F10).
6. **An end card** on every Tile: the winner, the score, the name and the address, visible for 2–3 s before "Play again".
7. Screens stay on during filming (wake lock; F17 note).

---

## 4. Ordered work list (best effect for the effort)

Sizes: **S** is up to half a day, **M** is 1–2 days, **L** is a week or more, for one developer who knows the code [INFERENCE]. Cash cost is 0 € for all ten.

**Before showing strangers**

| # | Change | Size | Fixes | Done when |
|---|---|---|---|---|
| 1 | Close the own-code trap; rename and move the join form; hint text "Other phones: scan this code" | S | F1 | Typing the table's own code shows a message and stays Host |
| 2 | Hide all technical text behind `?debug` (clock figures, game log, Export/Clear/Log, "Syncing clocks"); fade the Setup pill | S | F5, part of F4, video | A Host and a Peer screen show no "ms", "Δ", "log" or "ndjson" |
| 3 | Name everywhere: splash in `index.html`, sheet header, Peer strip, result card, `<title>`, manifest names, OG tags | S | F3, F13, F17 (part) | A screenshot of any screen shows the name |
| 4 | Lobby for two Games: list only Pong and Air Hockey by default, Pong first; auto-pick each Game's arrangement; hide Controllers when unused | S | F4, F7 | A stranger sees two Games and one Start button above the fold |
| 5 | Placement: big bright Tile number with "put me right of phone N" and a row pictogram; fold the Host's sheet once a Peer is ready | S–M | F6, F12 | Each phone shows its number, readable from 1 m |
| 6 | End of Match: "Ana wins 7–5", [Play again] on the Host, "Waiting for phone 1" on Peers; no reopened sheet; grey "last match" | S–M | F9 | Two Matches in a row take one tap |
| 7 | Connection help: plain status words, a 15 s help card with the hotspot advice, [Change code] on the Peer | M | F2 | A wrong code or a hotspot loop shows advice within 15 s |

**Later (after the first strangers have played)**

| # | Change | Size | Fixes |
|---|---|---|---|
| 8 | Player colours, "Touch here to start" on the player's own Tile, Air Hockey text overlap, scores at 70% | M | F8, F11, F12 |
| 9 | Sound (Web Audio with `audioSession` on iPhone) and haptics (Android `vibrate`, optional iOS switch tick) | M | F10 |
| 10 | Night-table visual direction: one font (self-hosted), palette, ball trail, name sweep at Match start; icons 192/512/maskable; 16 px inputs; 44 px controls; top safe area | M–L | F11, F14, F15, F16, F17, F19, video |

Items 1–7 are about 4–7 working days in total [INFERENCE]. Items 1–3 fit in one day and already make a demo to strangers far less confusing.

### What not to do yet, and why
- **No brand or logo agency, and no paid fonts.** The name is not settled (open question 1); a logo for the wrong name is wasted money.
- **No design system or Figma library.** Two Games and one sheet do not need one; tokens in `index.html:10-19` are enough.
- **No tutorial screens or carousels.** One sentence and a picture on each phone beats a three-step intro that people skip.
- **No more Games in the player list.** Five of seven are SDK proofs; showing them makes the product look unfinished.
- **No German translation yet.** Fix the English copy first; then translate the roughly 40 strings once (M). [INFERENCE] Most of the players will be German-speaking.
- **No native app for design reasons.** Every finding here is fixable in the PWA. A native app is a connectivity question (`docs/research/README.md`, option 8).

---

## Copy: current and proposed (examples)

| Where | Now | Proposed |
|---|---|---|
| Host hint (`hud.ts:146`) | Scan to join, or open manubown.github.io/Bezel and enter the code. | Other phones: open the camera and scan this. |
| Host join form (`hud.ts:147-150`) | Code [Join] | Join a different table ▸ (folded) |
| Peer searching (`hud.ts:458-459`) | Looking for the host… · keep the host screen open | Finding table REZV… · keep the first phone's screen on |
| Peer syncing (`hud.ts:464-465`) | Syncing clocks · measuring the offset to the host | Connecting… |
| Peer placed (`hud.ts:474-475`) | Phone 2 of 2 · right of phone 1 · Player 2 · 1.0 ms · Δ7178.0 ms | You are phone 2 · lay me right of phone 1 |
| Peer late (`hud.ts:467-468`) | Match in progress · you join the next one · … | A game is on. You join the next one. |
| Reconnecting (`hud.ts:461-462`) | Reconnecting to the host… · the connection dropped · trying again | Lost the table. Reconnecting… (after 15 s: help card, F2) |
| Pong prompt (`games/pong/src/index.ts:312`) | Player 1, touch to start (on every phone) | Own phone: Touch here to start · others: Waiting for Ana |
| Result (`result.ts:12-16`) | Player 2 wins · Player 2 7 · Player 1 5 · Tap to close | Ana wins 7–5 · [Play again] |
| Stop (`result.ts:22`, game log `hud.ts:300-314`) | Match stopped · Ended from the host phone, plus the log "stopped by the platform" | Game ended on phone 1 (log hidden) |

---

## Open questions for the makers

1. **Which name?** "Bezel" (URL, repository), "MobileGameConnect" (title, README) or something else? Has anyone checked it against trademarks and app names? (Not checked here; another report covers naming and the landing page.)
2. **Who is the first stranger?** Adults at a bar or party, teenagers, families? That decides between direction A (night, party) and C (daylight, family), and whether sound is on by default.
3. **Which Games are public?** Is it only Pong and Air Hockey for now, with the other five behind `?dev`?
4. **English or German first** for strangers in your country?
5. **Do you still need the logs at live tests?** If so, is a hidden switch (`?debug` or a long-press on the name) acceptable?
6. **Start screen or QR first?** One extra tap ("Start a table" / "Join a table") removes the join trap completely, but costs a step for the Host.
7. **Who draws the icon and the 1200×630 link-preview image?** A photo of real phones on a table is probably the best preview image [INFERENCE].

---

## Sources (all checked 2026-11-11)

- WebKit, *WebKit Features in Safari 18.0*: haptic feedback for `<input type=checkbox switch>` on iOS 18. <https://webkit.org/blog/15865/webkit-features-in-safari-18-0/>
- WebKit, *WebKit Features in Safari 26.0*: every site added to the Home Screen opens as a web app; manifest icons used; SVG icons. <https://webkit.org/blog/17333/webkit-features-in-safari-26-0/>
- MDN browser-compat-data (data dated 2026-11-10): `Navigator.vibrate`, `Navigator.audioSession`, `ScreenOrientation.lock`, `WakeLock.request`, manifest `display`, `orientation`, `icons`. <https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Navigator.vibrate.json> (and the sibling URLs linked above)
- web.dev, *What does it take to be installable?* <https://web.dev/articles/install-criteria>
- Apple Human Interface Guidelines, *Accessibility* (control sizes, contrast). <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- Android Developers, *Make apps more accessible* (48 dp touch targets). <https://developer.android.com/guide/topics/ui/accessibility/apps>
- W3C, *Understanding SC 2.5.8 Target Size (Minimum)*. <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>; WCAG 2.2 1.4.3 and 1.4.11. <https://www.w3.org/TR/WCAG22/>
- The Open Graph protocol. <https://ogp.me/>
- Google Fonts FAQ (all fonts are open source and free). <https://fonts.google.com/faq>; privacy FAQ. <https://developers.google.com/fonts/faq/privacy>
- LG München I, judgment of 20.01.2022, 3 O 17493/20 (Google Fonts and IP addresses). <https://www.gesetze-bayern.de/Content/Document/Y-300-Z-GRURRS-B-2022-N-612?hl=true>
- Secondary, marked where used: CSS-Tricks on the 16 px input zoom <https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/>; the iPhone silent switch and `audioSession` <https://huddee.com/blog/apple-quietly-fixed-web-audio-bug>; the switch-haptic technique <https://github.com/ionic-team/ionic-framework/issues/29942>.
- Repository: `.scratch/live-test-1/findings.md` (phone timings, player reports), `docs/research/README.md` (connection options).

## Screenshot index

| File | State |
|---|---|
| [00-host-loading-390](img/00-host-loading-390.png) | First paint: black |
| [01-host-first-load-390](img/01-host-first-load-390.png) | Host sheet, one phone |
| [02-host-sheet-folded-390](img/02-host-sheet-folded-390.png) | Sheet folded: Tile number at 1.31:1 |
| [03](img/03-peer-searching-390.png) / [04](img/04-peer-syncing-390.png) / [05](img/05-peer-placed-390.png) | Peer: looking, syncing, placed |
| [06-host-two-phones-390](img/06-host-two-phones-390.png) | Host with a Peer: roster with ms and Δ |
| [07-host-sheet-bottom-log-390](img/07-host-sheet-bottom-log-390.png) | Export log and Clear |
| [table-pong-touch-to-start](img/table-pong-touch-to-start.png) / [table-pong-playing](img/table-pong-playing.png) | Pong across two Tiles |
| [12](img/12-pong-result-host-390.png) / [13](img/13-pong-result-peer-390.png) | Pong result, Host and Peer |
| [table-airhockey-row](img/table-airhockey-row.png) / [table-airhockey-column](img/table-airhockey-column.png) | Air Hockey in Row (overlap) and in Column |
| [table-pause](img/table-pause.png) | Lost connection: Host "Waiting for Player 2", Peer "Reconnecting" |
| [20-host-sheet-during-match-360](img/20-host-sheet-during-match-360.png) | Host sheet opened during a Match |
| [21-peer-match-stopped-360](img/21-peer-match-stopped-360.png) / [26-host-after-stop-360](img/26-host-after-stop-360.png) | Match ended from the Host |
| [22-host-first-load-360](img/22-host-first-load-360.png) / [23-peer-placed-360](img/23-peer-placed-360.png) | 360×780 phone size |
| [27-host-start-refused-360](img/27-host-start-refused-360.png) | Pong refused in Column |
| [29-peer-wrong-code-after-25s-360](img/29-peer-wrong-code-after-25s-360.png) | Wrong code after 25 s |
| [30-host-typed-own-code-360](img/30-host-typed-own-code-360.png) | Host typed its own code: stranded |
