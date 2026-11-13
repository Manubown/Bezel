# Changelog

What changed for the people at the table, newest first, in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no version numbers yet.

The app for everyone ([`play/`](https://manubown.github.io/Bezel/play/)) is the build the `stable` tag points at; the makers move the tag after a good run on phones. Everything above the `stable` entry is in the latest build ([`next/`](https://manubown.github.io/Bezel/next/)) once it is on `master`, and reaches `play/` when the tag moves.

## This round: what a stranger meets (2026-11-12 to 2026-11-13)

### Added

- A name, Bezel, with an icon for the home screen and a picture that shows when a link to the app is shared.
- A site in front of the app: the app for everyone at `play/`, the latest build at `next/`. Old links, old QR codes and icons installed from the old address still lead to the app.
- Every phone shows its place on the table: its number, a sentence such as "Lay me first, on the left", and a small drawing of how the phones lie.
- A phone that is joining says what it is doing ("Connecting…", "Lost the table. Reconnecting…"). After 15 seconds without getting in, it shows a card with what to check.
- At the end of a game every phone shows who won ("Ana wins 7–5", "Draw, 3–3"). The first phone can play again or change the game; the other phones say that the first phone starts the next one.
- After the first finished game, the result card offers to put the app on the home screen, where it opens full screen with no browser bars: an Install button on Android, the steps on an iPhone. Inside another app's browser, a banner says to open the page in Safari or Chrome.
- A privacy page and an imprint on the site; the first phone's sheet links the privacy page.
- Each player has a colour, the same on every phone: their paddle, their score and their name on the first phone's sheet, the pause card and the result card. In Pong and Air Hockey a player's own phone says "Touch here to start" and the other phones say "Waiting for Ana", and the ball and the puck leave a short trail that crosses from one phone to the next.
- Sound in Pong and Air Hockey: a short tone on the phone where the ball or puck meets a paddle or a wall, and on every phone at a goal and at the win; an Android phone also buzzes at a goal. A phone plays nothing until someone touches it. A Sound switch on the first phone's sheet and at the top of the other phones turns it off for that phone, which remembers it. Whether an iPhone's silent switch mutes it has not been tried on phones yet.

### Changed

- The night-table look: a near-black table, ivory text, coral and teal for the first two players, and a display face of its own, served with the app, for the name, the game titles and the result card's headline. Every control on the first phone's sheet is at least 44 px high, and typing a code no longer makes an iPhone zoom in.
- Scores in Pong and Air Hockey are brighter, and Air Hockey's message before the start no longer runs into the score when the phones lie in a row.
- The first phone offers two games, Pong and Air Hockey, as cards that say how many play and how the phones lie; picking one lays the phones the way it needs. The other five games, the clock figures and the log export are in Maker mode (add `?maker` to the address). It offers the game last picked on that phone first, also on a later visit.
- Every card and message speaks the words of the table: a game, never a match; the first phone; phones on the table. A refused Start says what is missing ("Pong needs 2 phones on the table; there are 3"), and the technical detail of a game that stopped shows in Maker mode only.
- The first phone's sheet reads as steps: the QR code ("Other phones: open the camera and scan this"), how to lay the phones, the game, the players, Start. "Join a different table" is folded at the bottom and refuses the table's own code, so the first phone cannot end its own table by mistake.

## Connecting, round 2 (2026-11-10 to 2026-11-11)

### Added

- When the phones cannot reach each other directly, a phone that failed three times in a row connects through a Relay server, in builds that have one.
- A first phone whose connection to a joining phone died stops sending its own network addresses to the next ones. It is meant for an iPhone that shares its hotspot, and has not been tried on phones yet.

### Fixed

- When the network stalls, Pong's ball keeps moving along its path for up to a second instead of disappearing from the middle phone.
- A phone with Safari's page zoom is measured after the zoom applies, so its game no longer draws at three quarters of its size.

## Connecting, round 1, and the fixes from the first test on phones (2026-11-08)

### Added

- A phone that loses the table for up to 30 seconds reconnects and comes back into the running game; the other phones wait for it, paused.
- The first phone keeps its table code, its game, the order of the phones and the players when its page reloads.
- Quiz seats one player at each phone held in hand; Tap Race and Breakout seat a player at every phone on the table.

### Fixed

- Pulling the page down no longer reloads it in the middle of a game.
- The app stays upright; a phone turned sideways asks to be turned back.
- Safari's page zoom no longer makes a phone's game the wrong size.
- The first phone's sheet scrolls, so the QR code and the games stay in reach on small phones.
- Breakout waits for a touch before the balls start; snakes in Snake live longer on a row of phones.

## 2026-11-07: the app for everyone (`stable`)

- One phone shows a QR code; the others scan it and join its table.
- The phones lie in a row, end to end or in a grid, and seven games run across them: Pong, Air Hockey, Pass, Tap Race, Snake, Quiz and Breakout.
- A phone that drops out pauses the game on every phone.
