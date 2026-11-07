# Quiz — one Tile as the board, every other phone a Controller with a private DOM view

Status: ready-for-agent
Created: 2026-11-07
Slug: quiz · id `mgc.quiz` · package `@mgc/quiz` · dir `games/quiz`

## Problem Statement

Pass is the only Controller Game: one Controller, one button, one message type. Nothing has run several Controllers, a DOM view with real layout and state-driven re-rendering, per-Controller private state (`publish(state, to)`), or a Match where the Players are the Controllers' Holders rather than Tile seats.

## Solution

A pub-quiz round: the board Tile shows the question and, after everyone answered or the time ran out, the answers and scores; each Controller shows the four answers as buttons to its Holder, then "locked in", then right/wrong. `QUIZ.questions` (a built-in list in the Game, seeded order) questions; fastest correct answer scores most.

## Implementation Decisions

- Manifest: `tiles {1,1}`, `controllers {1,4}`, `players {1,4}`, `tickHz: 0`, `bots: false`.
- Holders: the host factory assigns each Controller to a Player with `setHolder`: Players in `match.players` order to Controllers in `match.devices` order; a Controller left over has no Holder and shows "waiting for a player". Record in the friction log that the lobby only ever produces two Players (`apps/pwa/src/lobby.ts:9-10`) and that a Controller's Device is not a Player, so with three Controllers one is idle; propose the lobby rule you would want (e.g. a Player per Controller).
- Messages: `{ t: 'answer', choice: number }` from a Controller; the host accepts the first per Holder per question, stamps the shared time from the `onMessage` moment (not a client time), and ignores the rest.
- Private state: the board gets the public state (`publish(state)`); each Controller gets its own (`publish(privateState, controllerDeviceId)`) with whether it answered and, after reveal, whether it was right. Verify what a Controller's `latest()`/`onState` sees when both a broadcast and a targeted publish exist (the doc says they are retained separately): record the observed behaviour.
- Timers: `timer('reveal', QUIZ.answerMs)` per question, `timer('next', QUIZ.revealMs)` after reveal; pause-aware for free.
- Views: the board view draws with `draw` (canvas, world mm). The Controller view uses `mount(root)` and `input: 'off'`, DOM buttons with `pointerdown` → `send`, re-rendered from `onState`; it must look acceptable on a 65 × 140 mm phone (large touch targets, no scrolling). Keep the DOM view's CSS inline on elements (no stylesheet: the view must not reach outside `root`).
- Result: `scores` per Player and `ranking`.

## Testing Decisions

- `createTestMatch` with one Tile and three Controllers, two Players: holders set at start, third Controller idle; the first answer per Holder counts and a second is ignored; a correct answer scores more the sooner it arrives; the private state on `c0` differs from `c1` after answering; reveal on the timer; the Match ends after all questions with the ranking; DOM buttons on a Controller (`t.input` on a Controller hits the topmost element) send the message.
- Browser smoke: dev server port 5183; two tabs, Host as the board Tile, the Peer marked Controller in the HUD; answer on the Peer, see the board update; screenshots of both.

## Out of Scope

Question packs from outside the bundle, images, more than one board Tile.
