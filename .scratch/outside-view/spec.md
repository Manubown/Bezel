# Outside view: what a stranger meets in the app, on the site and on GitHub

Status: resolved (2026-11-13: tickets 01–16 resolved on the branch `outside-view`, reviewed in `review.md` with every finding fixed or decided against; 17, the makers' go-public steps, is ready-for-human and comes before the merge to `master`)
Created: 2026-11-12
Sources: `docs/strategy/app-design-audit.md` (findings F1–F19, work list 1–10), `docs/strategy/github-and-landing-site.md` (§1–§3), `docs/strategy/README.md`, `docs/strategy/competition-and-audience.md` §1.2, a two-profile browser session against BIGBOARD.GAMES on 2026-11-12 (its first screen, join, connection pill, install prompts and UI strings; no phones, no hotspot), the makers' decisions of 2026-11-12 (grilling round 1, twelve questions, all answered "yes").

"Outside view" means the three places a stranger meets this project: the app's first run, the site in front of it, and the repository's front page.

## Problem Statement

A stranger who is handed a phone, scans a QR code or opens the repository cannot get to a Match alone, and cannot tell what the thing is called.

1. **The first phone opens a control panel.** Its first screen has 26 controls: seven Games, three arrangements, Controllers, Bot chips, clock figures ("1.0 ms · Δ7178.0 ms"), a game log and a log export. Five of the seven Games are SDK proofs. The default Game is Air Hockey in an arrangement it does not suit, and a wrong pair is refused only after Start.
2. **One trap ends a table.** The first phone's sheet says "enter the code" above a code field; a first phone that types its own code becomes a phone of its own table and waits for ever, and its friends lose their table.
3. **A phone that cannot connect gets no help.** "Looking for the host…", "Syncing clocks", "Reconnecting to the host…" loop without a limit, without advice and without a way to correct a wrong code. On an iPhone Personal Hotspot this is the normal first attempt.
4. **Players cannot see where their phone goes or which side is theirs.** The placement number is drawn at a contrast of 1.31:1; "Player 1, touch to start" stands on every phone; both Games are off-white on black with no Player colours; there is no sound.
5. **A Match ends in a dead end.** "Player 2 wins / Player 2 7 · Player 1 5 / Tap to close"; no rematch; the other phones get nothing to do; the sheet reopens with the QR and the log.
6. **Nothing can be installed or shared well.** The manifest has no icons and the short name "MGC"; a shared link shows a bare address; the page is black until its script runs. Installed to the home screen the app would run full-screen, which is also what keeps a browser toolbar off a Tile's edge.
7. **There is no page that says what this is.** The public address is the app itself, built from `master`; the known-good build is 21 commits behind and nobody is sent to it.
8. **The repository's front page is empty.** No description, topics or picture; a README whose first screen after the pitch is a developer install; no way for an outsider to report a problem except the makers' internal tracker.
9. **The product has four names** (Bezel, MobileGameConnect, MGC, `@mgc`) and shows none of them on any screen.

The rival that shipped the same idea (BIGBOARD.GAMES) answers 1, 3, 5, 6 and 7 visibly: a first screen of games with two actions, a connection pill in plain words with different advice per cause, Rematch and "Waiting for {name}", install steps per browser, a landing page in front of the app. Its instant join and its same-network discovery need a server and are not copied here.

## Solution

- **Two Games for players.** Pong, then Air Hockey. The other five stay in the repository and the build and show in Maker mode.
- **Maker mode.** One switch holds everything the makers need at a live test and players never should see: clock figures, the game log, the session log's export, every Game.
- **A first screen with one job per step:** the QR, how to lay the phones, two Game cards, Start. Joining a different table is folded away and refuses the table's own code.
- **Words players read.** "Table" and "first phone" (`GLOSSARY.md`), plain status words, and a help card after 15 seconds of not getting in.
- **A placement cue readable from a metre away,** Player colours, a prompt on the Player's own Tile, readable scores, sound.
- **An end of Match that leads to the next one:** the winner by name with the score, Play again on the first phone, "waiting" on the others.
- **An app that installs:** a name, icons, a splash, a link preview, and an install offer after the first finished Match.
- **A site in front of the app** at the public address, with the app for everyone on the known-good build and the latest build beside it for the makers.
- **A repository front page** that shows the product, says how to try it, what it works on and what its limits are, and takes reports from outsiders.
- **One look** for the app and the site: the audit's "night table".

## User Stories

First phone

1. As the person who opens the app first, I want to see the product's name while it loads, so that I know the page is not broken and what it is called.
2. As the person at the first phone, I want the first thing on my screen to be the code other phones scan, with one sentence telling the others what to do, so that I do not have to work out a control panel.
3. As the person at the first phone, I want typing my own table's code to tell me so and leave my table alone, so that I cannot end the table by following the hint.
4. As the person at the first phone, I want joining a different table to be out of the way but findable, so that a phone that should have been a guest can still become one.
5. As the person at the first phone, I want to see two Games, each with how many play and how the phones lie, so that I can pick without knowing the project.
6. As the person at the first phone, I want Pong picked when I have never picked, and my last pick remembered after that, so that the Game people were shown is one tap away.
7. As the person at the first phone, I want the arrangement to follow the Game I pick, so that Start is never refused for a wrong arrangement.
8. As the person at the first phone, I want no control for phones in hand when the Game uses none, so that nothing on the sheet is meaningless.
9. As the person at the first phone, I want my sheet to fold away once a second phone is in, so that my own phone shows its place at the table too.
10. As the person at the first phone, I want one tap to play the same Game again with the same people, so that a second Match does not mean setting up again.
11. As the person at the first phone, I want to be told when a phone keeps losing its connection and what usually helps, so that I can fix the network instead of waiting.

Any phone that joins

12. As a friend who scans the code, I want to read "finding table REZV", then "connecting", in plain words, so that I know what my phone is doing.
13. As a friend whose phone has not got in after 15 seconds, I want a card that says what to check, that an iPhone hotspot often fails and what to use instead, with a way to try again and a way to correct the code, so that I am never left watching a loop.
14. As a friend who typed a wrong code, I want to correct it on my own phone, so that I do not have to find the address again.
15. As a friend who is in, I want a number filling my screen and one sentence saying where my phone lies relative to its neighbour, with a small picture of the row and my place in it, so that I can place my phone without asking.
16. As a friend who joins while a Match runs, I want to be told I join the next one, so that I do not think the app is stuck.
17. As a friend whose phone dropped and came back, I want it to say I am back and the Match resumes, so that my phone does not tell me it is waiting for me.

During and after a Match

18. As a Player, I want my paddle, my score and my prompt in my colour on every phone, so that I can tell my side at a glance and a video of the table can be followed.
19. As a Player, I want "touch here to start" on the phone I play at and "waiting for Ana" on the others, so that everyone knows whose touch is missing.
20. As a Player, I want scores I can read from where I sit, so that I do not have to lean over the table.
21. As a Player, I want a ball or puck that stands out from the paddles and leaves a short trail across the gap between phones, so that the table reads as one surface.
22. As a Player, I want to hear a hit where it happens and a goal on every phone, so that the table feels like one thing and a filmed Match works without music.
23. As a Player, I want to switch sound off on my phone, so that I can play in a quiet room.
24. As a Player on an Android phone, I want a short vibration on a goal, so that I feel it.
25. As a Player, I want the end of a Match to say who won and by how much in one line, so that the result reads like a result.
26. As a Player at a phone that is not the first, I want to be told the first phone starts the next game, so that I know nothing is expected of me.
27. As a Player, I want the corner control of the first phone to fade during play, so that it does not sit in the picture.

Installing and sharing

28. As a Player who has just finished a Match, I want to be offered the app for my home screen once, with the steps my phone needs, so that next time it opens full-screen with no browser bars.
29. As a Player who said no, I want the offer to stay away but remain findable on the sheet, so that I am not nagged.
30. As a person who opened the link inside another app's browser, I want to be told to open it in Safari or Chrome, so that I do not fail for a reason I cannot see.
31. As a person who installed the app, I want an icon with the product's name under it that opens the app, not the site, so that it behaves like an app.
32. As a person who is sent the link in a chat, I want a preview with a picture, the name and one sentence, so that I know what I am opening.

The site

33. As a stranger, I want one page that shows phones becoming one table within the first screen, so that I understand the idea before I read anything.
34. As a stranger, I want one button that starts a table and one field that joins one by code, so that the site is also the shortest way in.
35. As a stranger, I want to know which phones it works on and where it does not (an iPhone hotspot), so that I try it on a network where it works.
36. As a stranger, I want to know who made this and what my phone gives away, so that I can decide to use it.
37. As a developer, I want a line that says this is open source with an SDK and where to start, so that I find the repository.
38. As a person with an old link, a QR code from an older build or an installed icon, I want it to keep working, so that the move costs nobody their table.

The repository

39. As a visitor of the repository, I want to see the product, a way to try it and its limits before any install command, so that I know in ten seconds whether to stay.
40. As a visitor, I want the description, the website and the topics filled in, so that search and link previews say what this is.
41. As an outsider with a problem, I want a form that asks for my phones, my network and what happened, so that my report is useful without knowing the project's vocabulary.
42. As an outsider, I want to know what `.scratch/`, `AGENTS.md` and the log folders are, so that they do not look like debris.
43. As a contributor, I want a pull-request checklist that repeats the three rules of `CONTRIBUTING.md`, so that I do not learn them from a review.

The makers

44. As a maker at a live test, I want one address flag that gives every phone of the table the clock figures, the logs and all seven Games, and I want it remembered on each phone, so that hiding them from players costs me nothing.
45. As a maker, I want every phone to keep recording its session log whether or not Maker mode is on, so that a player's report can still be backed by a log.
46. As a maker, I want the public name in one place, so that deciding it later is one change.
47. As a maker, I want the app everyone is sent to built from the known-good tag and the latest build at its own address, so that a push to `master` cannot break someone's evening.
48. As a maker, I want the site, both app builds and the forwards published by one workflow, so that they cannot drift apart.
49. As a Game author, I want Pong and Air Hockey to show how a Game uses the Players' colours, knows its own Tile and plays a sound, so that I can copy the pattern.

## Implementation Decisions

- **D1 The public name has one source.** One small data file at the workspace root holds the name, the one-sentence pitch and the public address; the app's build and the site's build both read it. Its value is "Bezel" until the makers decide. What players never see keeps its names: the package scope, the transport's application id (changing it would stop builds from finding each other), storage keys, Game ids.
- **D2 The Games players see are a list the app owns,** Pong then Air Hockey, in that order. It is not a field of a Game's Manifest: which Games are shown to players is the platform's decision, not the Game's. Maker mode lists every discovered Game as today. The Game remembered from a previous visit is used only if it is in the list the Device shows.
- **D3 Maker mode is one switch.** On when the address carries the flag, then remembered on that Device; the flag with a "no" value switches it off again. The first phone's QR and typed-address hint carry it like the existing relay flag, so one scan sets the whole table. It gates the clock figures, "syncing clocks" wording, the game log, the session log's export and clear, the Peer's log button, the full Game list and the Controllers and arrangement controls a featured Game does not need. The session log records regardless.
- **D4 The first phone still becomes the first phone on opening the app;** there is no "start or join" screen. The sheet's order is: the code to scan with one sentence for the other phones, how to lay the phones, the Game cards, the Players, Start. Joining a different table is a folded link at the bottom; it refuses the table's own code with a sentence and stays where it is.
- **D5 Copy uses the words players read** (`GLOSSARY.md`: Table, First phone). Every status, hint and card is rewritten to them; the makers' words stay in Maker mode and in the log.
- **D6 The arrangement follows the Game.** Picking a Game selects the first template its Manifest names; the picker appears only when the Game names more than one, and only offers those. Start can no longer be refused for the arrangement.
- **D7 What a joining phone says is decided by one pure function** of the Session's status, the time since the page tried to join, and whether it has ever been in: the status line, and after 15 seconds without getting in, a help card. The card names the table code, says to check it on the first phone and keep that phone's screen on, says that an iPhone hotspot often fails and to use the same Wi-Fi or mobile data on every phone instead, and offers "Try again" and a code field. The first phone shows the same advice line once it has seen one phone's connection end three times in a row without lasting.
- **D8 The placement cue is drawn by the platform's lobby preview,** not by a Game: the Tile's number in the foreground colour at about 60 % of the screen's width, one sentence ("lay me right of phone 1"), and a row of phone outlines with this one filled. The first phone's sheet folds to its bar when the first other phone is ready.
- **D9 The end of a Match:** the headline is the winner's name and the score in one line for a two-sided result; the first phone's card offers Play again (the same Game, Players, arrangement and bots, started through the lobby's ordinary start) and Change game (the sheet); other phones' cards say the first phone starts the next game. The sheet does not reopen by itself after a Match. The last-Match line is neutral, not the warning colour. A phone that was the lost one reads "You're back" instead of the Host's notice about itself.
- **D10 Player colours cross the seam as a palette, not as data.** `@mgc/sdk` exports the palette and a function from a Player's position in the Match's Player list to a colour; the platform's HUD and the Games both use it, so they agree without a new field on the wire. Four colours; the first two are the night table's coral and teal.
- **D11 A Game says whose touch it waits for from what it already knows:** the Player seated at a Tile and the view's own Device. On the Player's own Tile: "Touch here to start"; elsewhere: "Waiting for <name>". Scores are drawn in the Player's colour at 70 % opacity or more; Air Hockey's prompt no longer overlaps its score in a row; the ball and the puck stay ivory with a short trail.
- **D12 Sound is played by a Game's view** with synthesised tones (no audio files): a hit and a wall on the Tile the ball is on, a goal and the win on every Tile. Whether a Device plays sound is that Device's setting, on by default, kept on the Device, shown on the first phone's sheet and the other phones' strip; the view learns it from the SDK's view context (an added, read-only field: a Game imports `@mgc/sdk` only, so the preference has to cross the seam). The audio context is created on the "touch to start" touch. On Android a goal also vibrates briefly. An iPhone's silent switch may mute it; that is checked on a phone, not assumed.
- **D13 The install offer is decided by one pure function** of: the platform, whether the app already runs installed, whether the page is inside another app's browser, how many Matches this Device has finished, and whether the offer was dismissed. Inside another app's browser: a banner at once, "open in Safari or Chrome". Otherwise nothing before the first finished Match; then once on the result card and always as a row on the sheet. Android gets a button that triggers the browser's own install; an iPhone gets the steps (Share, Add to Home Screen) with the reason (full screen, no browser bars). Installed: nothing.
- **D14 No service worker in this round.** Every phone of a table has to run the same build as its first phone, signaling needs the internet anyway, and current browsers install without one.
- **D15 One look, the audit's "night table":** near-black ground, ivory text and ball, coral and teal Players, one self-hosted display face for the name, Game titles and scores, system type for the rest. The colour and type tokens live once and are used by the app and the site. Inputs are 16 px so an iPhone does not zoom on focus; controls are at least 44 px high; the sheet respects the top safe area; the corner control fades during play.
- **D16 The site is a second app in this workspace, built with Astro, published on the same GitHub Pages site by the one workflow.** The site takes the public address's root. The app for everyone is one level below it, built from the `stable` tag; the app as on `master` is beside it for the makers. The old stable address forwards to the app for everyone and keeps its query; the root forwards a join link from a first phone still on an old build to the latest build, and forwards a launch from an installed icon to the app. Every place that names the old addresses changes in the same change: the stable script's printed addresses, the README, the contributing guide, the phone guide, the workflow's comment. The workspace's type check leaves the site to Astro's own check.
- **D17 The site is English, one home page and two legal pages.** Home: the name and one sentence, a looping illustration of two phones with a ball crossing the gap (drawn, not filmed; replaced by the makers' clip later), three steps, "Start a table", a join-by-code field, the two Games read from their Manifests, why and how to install, what it works on and its known limits, one paragraph and a link for people who want to build a Game. Client script only where the page needs it: the forwards, the join field, the illustration.
- **D18 Privacy and imprint pages are written as complete pages with the makers' details as marked blanks.** The privacy page names every party a phone talks to (the host of the pages, the public signaling relays, the Relay provider) and what each sees; the app links to it. The site is not linked from anywhere public until the blanks are filled.
- **D19 The README is rewritten to the audit's outline:** name, pitch and a picture; try it now with a QR code; works on; known limits; what you can play (the two Games, then the five as SDK examples); how it works in three sentences with the diagram moved to the architecture document; build a Game; develop locally; contribute; status in five lines; privacy in a paragraph; licence. Added beside it: a code of conduct, a security policy, issue forms for a problem at the table and a Game idea, a pull-request checklist, a changelog written for players, one-paragraph READMEs for the tracker folder and the log folder. Outsiders use GitHub Issues; `.scratch/` stays the makers' tracker.
- **D20 Repository settings are set through the command line on the maintainer's account** (approved): description, website, topics, the labels the forms use, the two open issues marked internal, private vulnerability reporting on.
- **D21 The Relay stays as it is** (the maintainer's Metered account). No connectivity work in this spec.
- **No ADR.** None of these is at once hard to reverse, surprising and the result of a real trade-off; D16 comes closest and is carried by the workflow's own comment.

## Testing Decisions

A good test here states what a player or a maker would see for a given situation, through the module's public interface, without reading its markup or its private state.

- **Pure "what to show" functions get unit tests,** as `rejoin`, `pause` and `result` have today: the join status and help card (D7), the install offer (D13), the result headline (D9, extending the existing result tests), the featured-Game list and remembered pick (D2), Maker mode's reading of the address and the remembered value (D3), the own-code refusal (D4).
- **The lobby's interface carries the arrangement rule and Play again** (D6, D9), tested where the lobby is tested today, over the in-memory transport: picking a Game changes the arrangement; a start after a finished Match reproduces the Match's Game, Players and Layout.
- **The Games are tested through the SDK's test harness** as today: whose touch a state waits for, that a view's prompt differs between the Player's own Tile and another, that colours come from the palette. Sound is not unit-tested beyond "a hit on this Tile asks for a tone when sound is on and for none when it is off".
- **The SDK's added exports** (palette, the view's sound preference) get a test at the SDK's existing game seam.
- **Screens are checked in a browser, not in unit tests:** a first phone and a second phone as two tabs at phone sizes, as the earlier tickets recorded their three-tab smokes. Each ticket's comment describes the screens it checked in words; one final set of pictures of the finished branch is attached to this spec (Further Notes). No test reads the HUD's markup.
- **The site is checked by building it** and by reading the built output: every internal link resolves, the forwards keep a query, the home page works with scripts off except for the three scripted parts.
- **Only phones can show:** sound against an iPhone's silent switch, the install steps on Safari and Chrome, vibration, the safe areas, the placement number from a metre away. These are boxes on the makers' go-public ticket.

## Out of Scope

- Connectivity: a second Relay provider, pinned signaling relays, states on an unreliable channel, anything for the iPhone hotspot beyond telling the player.
- A server of any kind; same-network discovery; an instant lobby.
- Calibrating a screen's size with a card; a layout editor; cross-bezel swipe alignment (M4).
- Sandboxed Game bundles (M3); the SDK on npm.
- A service worker and offline play (M5).
- Counting and analytics; feedback taps.
- German or any second language.
- New Games; changes to the five Games that leave the players' list beyond what the palette or the view context force.
- A custom domain; renaming the repository (the makers' go-public ticket decides both).
- Donation links, grants, social media.

## Further Notes

- **The join problem is not solved here.** A stranger sent to the site from an iPhone hotspot still meets the failure of live runs 1–6; D7's card and the site's known limits are the answer in this round. The phone run of `.scratch/connectivity-2/issues/07-host-withholds-own-addresses.md` is still open and decides what the card may promise.
- **The app for everyone is the `stable` tag,** which is 21 commits behind `master` today. Nothing in this spec reaches players until the makers move it; the go-public ticket holds that step.
- **The rival's "coming soon" list** (a card game with "your hand on your own screen", a word game with a guide) approaches the Tiles-plus-Controllers shape `docs/strategy/README.md` names as this project's own. That belongs in the strategy index, not here.
- Versions named by the landing report (Astro 7.4.10 needing Node 22.23.4 or newer, the Pages actions) were read on 2026-11-11; check them when the site is set up.
- **Pictures of the finished branch** (review B13), in `img/` beside this spec, 390 px wide (the app and the imprint at 390×844, the home page and the privacy page whole). Taken on 2026-11-13 from `ov/review` in headless Chrome: the app from the dev server, both tabs with an iPhone Safari user agent (so both report a phone's size and the install offer shows) and Player 2 a Bot; the site from `pnpm pages --here` and its preview. Players' view throughout, no `?maker`.
  - [`01-first-phone-sheet.png`](img/01-first-phone-sheet.png): a new first phone's sheet: the QR and "Other phones: open the camera and scan this…", "Lay the phones like this" over the roster, the Pong and Air Hockey cards, the Player slots with Bot chips, Start Pong, Sound, "Join a different table", Privacy.
  - [`02-joined-phone-lobby.png`](img/02-joined-phone-lobby.png): a joined phone in the lobby: "Phone 2 of 2" with "Player 2" in teal on the strip, the large 2, "Lay me right of phone 1" and the drawing of the two phones.
  - [`03-help-card.png`](img/03-help-card.png): a phone joining a code no first phone hosts, after 15 s: "Table QX7Q not found yet", the two pieces of advice, Try again, the code field.
  - [`04-pong-before-first-touch.png`](img/04-pong-before-first-touch.png): the first phone as Pong starts: "Touch here to start" in the Player's coral, the faded Setup pill in the corner.
  - [`05-pong-in-play.png`](img/05-pong-in-play.png): the same phone in play, the ball with its trail.
  - [`06-result-card-first-phone.png`](img/06-result-card-first-phone.png): the first phone's result card: "Bot wins 7–1", Play again, Change game, and the install offer after the first finished game.
  - [`07-result-card-joined-phone-install-offer.png`](img/07-result-card-joined-phone-install-offer.png): a joined phone's result card: "The first phone starts the next game" and the install offer with the iPhone steps. Not touched while the first phone pressed Play again and the next game ended, its next result card showed the offer again.
  - [`08-site-home.webp`](img/08-site-home.webp): the site's home page, whole.
  - [`09-site-privacy.webp`](img/09-site-privacy.webp): the privacy page, whole (reduced to 128 colours to stay under 100 kB); the makers' blanks still show.
  - [`10-site-imprint.webp`](img/10-site-imprint.webp): the imprint, the makers' blanks still showing.
