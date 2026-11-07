# 01: Quiz: a board Tile, Controllers with private DOM views

**What to build:** A pub-quiz Game. One Tile is the board: its canvas shows the question, the four choices, a countdown and the scores. Every Controller is a DOM view for its Holder: four buttons, then "Locked in", then right or wrong. A right answer scores more the sooner it reaches the host.

Per `.scratch/quiz/spec.md`:
- Manifest: `tiles {1,1}`, `controllers {1,4}`, `players {1,4}`, `tickHz: 0`, `bots: false`.
- Holders: the host factory gives Controllers to Players with `setHolder`, `match.players` order to `match.devices` order. A Controller left over waits for a player.
- Messages: `{ t: 'answer', choice }`. The host takes the first per Holder per question and times it with its own `now()` when the message arrives.
- Private state: `publish(state)` for the board and `publish(own, controller)` for each Controller. Record what a Controller's `latest()`/`onState` sees.
- Timers: `reveal` (`QUIZ.answerMs`) and `next` (`QUIZ.revealMs`).
- Result: `scores` and `ranking`.

**Blocked by:** None

**Status:** resolved

- [x] Test: one Tile, three Controllers, two Players. The Holders are set at the start, and the third Controller is idle and shows "Waiting for a player".
- [x] Test: only the first answer per Holder counts; a second one is ignored, and so are answers from the idle Controller and from the Tile.
- [x] Test: a right answer scores more the sooner it arrives.
- [x] Test: the private state on `c0` differs from `c1` after answering. Observed and pinned what a Controller's `latest()`/`onState` hold when there is a broadcast state and a targeted one.
- [x] Test: the answer is revealed when the timer runs out.
- [x] Test: the Match ends after every question, with the scores and the ranking.
- [x] Test: `t.input` on a Controller hits a DOM button, and the button sends the message.
- [x] `src/index.ts` imports `@mgc/sdk` only (pinned) and exports `QUIZ`, `QUESTIONS`, `QuizState` (with `BoardState` and `ControllerState`) and `QuizMessage`.
- [x] Smoke (two tabs, port 5183): the Host is the board Tile and the Peer is marked Controller in the HUD. An answer on the Peer updates the board. Screenshots of both.
- [x] `pnpm exec tsc -p games/quiz` is clean, and the friction log is written (`.scratch/quiz/friction.md`).

## Comments

### 2026-11-07

**Changed**
- `games/quiz/src/index.ts`, replacing the template copy:
  - `QUIZ = { questions: 5, answerMs: 15000, revealMs: 4000, fastest: 1000, slowest: 500 }`.
  - `QUESTIONS`: 12 built-in questions with four choices each. Each Match shuffles them with Fisher–Yates on Pong's mulberry32 seeded from `match.seed` and asks the first `min(QUIZ.questions, QUESTIONS.length)`.
  - `QuizState = BoardState | ControllerState`, told apart by `kind`.
    - `BoardState` (broadcast): `phase` (`ask`/`reveal`), `round`, `question`, `choices`, `until` (shared ms), `answered` (Player ids in the order they arrived), `scores`, and from the reveal `answer` and `gained` per Player.
    - `ControllerState` (to one Controller): `phase`, `round`, `choices`, `picked`, `score`, and from the reveal `answer` and `gained`.
    - The right answer is in no state until the reveal.
  - Host:
    - `setHolder` for each Controller that has a Player. The holders stay fixed for the Match.
    - `ask` arms `reveal`. `reveal` cancels `reveal`, adds the points, arms `next` and logs `Answer B: Mars`. `next` asks the next question or calls `end({ scores, ranking })`. Ties keep `match.players` order because the sort is stable.
    - `onMessage` checks the phase, that the sender has a Holder, that the Holder has not answered yet, and that the choice is a valid index. Points are `round(fastest − (fastest − slowest) · min(1, (now − askedAt) / answerMs))` if right, else 0.
    - When every Holder has answered, the answer is revealed at once. Otherwise only the board state and the answering Controller's own state are published.
    - `onPause`/`onResume` move `askedAt` and `until` on by the paused time, so a pause costs no points and the countdown stays right.
  - Board view (`draw`):
    - It draws in Tile-local mm (`translate(tile.x, tile.y)`, `rotate(tile.rot)`), so the board reads upright on its own phone.
    - The layout is in fractions of the Tile: header with the countdown, the question wrapped to four lines at most, the A–D rows, and a Player list with ✓ / `+gained` / score.
  - Controller view (`mount`, `input: 'off'`):
    - Inline styles only. Sizes in platform mm come from `root.clientWidth / screenMm.x`.
    - A head line (`Ann · 958`, `2 / 5`), a status line, and four full-width buttons sharing the rest of the height (`flex: 1`).
    - A button sends on `pointerdown`, and only while its Holder has not answered.
    - The view keeps the last `kind: 'controller'` state from `onState`, ignores broadcasts, and renders again on `onHolder` for its own Device.
- `games/quiz/test/quiz.test.ts`: 8 tests (listed under Verified).
  - A `start()` helper wraps `quiz.view` to capture each `ViewContext` (its `send`, `holder()` and `root`) and to record every state each view's `onState` heard.
  - Answers with a chosen index go through `ctx.send` followed by one macrotask, because the headless screen can only press the last button.
- `games/quiz/README.md`: describes Quiz instead of the template.

**Verified**
- `pnpm exec tsc -p games/quiz`: clean.
- `pnpm vitest run games/quiz`: 1 file, 8 tests passed:
  1. Manifest and SDK-only imports.
  2. Holders: the last `holders` event on every Device, and every view's `holder(c)`, are `c0 → p-ann`, `c1 → p-bo`, `c2 → null`. The idle Controller heard only the board broadcast, and its DOM reads "Waiting for a player". `c0` reads `Ann · 0`, `1 / 5`, "Pick an answer" and A–D.
  3. First answer:
     - Ann's wrong answer counts, and her second (right) answer is ignored. So are `c2`'s and `d0`'s, with a single host log line, `Ann locked in`.
     - `own(c0).picked` is the wrong index and `own(c1).picked` is null. The DOM reads "Locked in" on `c0` and "Pick an answer" on `c1`.
     - The private-state observation (pinned): `heard(c0)` is `board, controller, board, controller` and `heard(c1)` is `board, controller, board`. So `latest('c0')` is its own state, while `latest('c1')` is the board.
     - Bo's answer reveals at once: Ann gains 0 ("Wrong"), Bo gains `points(2000)` ("Right! +…").
  4. Speed: Ann right at 3000 ms gets 900 and Bo right at 6000 ms gets 800. `until` is about 10000. The next question comes after exactly `revealMs`.
  5. Timer: Ann answers at 1500 ms and Bo never does. The question is still open at `answerMs − 1` and revealed at `answerMs`. Bo gains 0 and his Controller reads "Too slow". His later answer is ignored.
  6. Pause: a 10 s pause two seconds in moves `until` to `answerMs + 10000`. Answers one second after the resume get `points(3000)`.
  7. End: five distinct questions; Bo is always right at 1000 ms and Ann always wrong. The result is `{ scores: { p-ann: 0, p-bo: 5·points(1000) }, ranking: [p-bo, p-ann] }`. Every Device closes with `ended` and no faults. Seed 2 asks a different first question.
  8. DOM button: `t.input('c0', 'down', …)` hits button D (the last one appended), so the board's `answered` is `[p-ann]`, `own(c0).picked` is 3 and the DOM reads "Locked in". A second tap sends nothing more.
- Smoke setup:
  - `pnpm --filter @mgc/pwa dev --port 5183 --strictPort` (HTTPS), headless managed Chromium, two 420×860 tabs (dpr 1.25, 3.78 px/mm, so about 111×227 mm), real Trystero, room B7KG.
  - Lobby actions were trusted clicks: Quiz in the Game row, the Peer's chip ("Windows") under Controllers, P1 renamed Ann, then "Start Quiz".
  - The Players list showed only P1 ("phone 1"), with no P2: one Tile and no bots.
  - The roster read "1 This phone · first phone · Ann / C Windows · Controller". The Peer's strip read "Controller · hold this phone in hand".
- Controller view on the Peer: the head read `Ann · 0` and `1 / 5`, the status "Pick an answer", and there were four buttons. Each button was 390×181 CSS px (≈ 103×48 mm) with a 22.68 px (6 mm) font. Nothing scrolled (`scrollHeight` 860 = `innerHeight`).
- Board on the Host: "Question 1 of 5", a countdown in seconds, the question wrapped onto two lines, A–D, and "Ann 0". Its canvas text was read by wrapping `CanvasRenderingContext2D.prototype.fillText`/`fillRect`/`clearRect` for canvases inside `#game`.
- Answering on the Peer (trusted clicks on `#game button:nth-of-type(n)`) updated the board:
  - Run 1, Q2 Mars: the Host's canvas drew "Answer" about 65 ms after the click returned. The board showed B green and `Ann +958 958`; the Controller "Right! +958" (`quiz01-reveal-*`).
  - Run 2, a full Match:
    - Q1: Ottawa right. The Controller read "Right! +827" and the board `+827 827`.
    - Q2: wrong. The Controller read "Wrong", with the pick red and the right answer green (DOM text).
    - Q3: no answer. After 15 s the Controller read "Too slow" (DOM text) and the board showed B Mars green, with Ann still at 827.
    - Q4: right, +952. Q5: right, +917.
    - The Match closed 45.4 s after Start. Both tabs showed the card "Ann wins · Ann 2696".
    - The Host's log listed "Ann locked in" and "Answer …" lines, then "match closed (ended): the game ended the Match".
    - No page errors in either tab.
- Screenshots, `.png` in `%TEMP%`:
  - Run 2: `quiz01-lobby-host`, `quiz01-lobby-peer`, `quiz01-ask-host`, `quiz01-ask-peer`, `quiz01-r1-right-host`, `quiz01-r1-right-peer`, `quiz01-r3-slow-host`, `quiz01-r4-right-*`, `quiz01-r5-right-*`, `quiz01-result-host` and `quiz01-result-peer`.
  - Run 1: `quiz01-reveal-host` and `quiz01-reveal-peer`.
  - Some Peer screenshots show the next question, because a headless screenshot took longer than `revealMs`: `quiz01-r2-wrong-peer` and `quiz01-r3-slow-peer`. "Wrong" and "Too slow" on the Peer were read from its DOM.
- Not observed:
  - "Locked in" in the browser. With a single Holder every answer reveals at once, and the lobby never makes two Players for Quiz (friction log).
  - More than one Controller.
  - A rotated board.
  - A pause in the browser.
  - Real phones.

**Deviations / notes**
- **`QUIZ.questions` is a count, not the question list.** The bank is the separate export `QUESTIONS`, because the questions are content, not a tunable. Tests read it to find the right answer from the board's question text.
- **Idle Controllers get no private state.** They hear only the board's broadcasts, and their view shows "Waiting for a player" from `ctx.holder()`. A Player without a Controller is in `scores` and `ranking` with 0.
- **The Controller view renders from its own state only.** The board's broadcasts reach it too, and `latest()` switches between the two kinds. Showing only its own state keeps the screen consistent between a reveal's broadcast and the targeted state that follows it.
- **An answer is accepted until the reveal timer is handed over**, even a frame after `askedAt + answerMs` (the timer drifts by its request latency). It then scores `slowest`.
- **One `append` per node** in the Controller's `mount`: the headless test DOM's `append` takes only its first argument (friction log).
- **Smoke harness:** while the smoke ran, other agents' edits to their Games made Vite reload both tabs. That killed a Match and reset the lobby. In run 2 an init script in both tabs answered the `vite-hmr` WebSocket with an inert object, so Vite's reloads could not reach the tabs. Nothing in the repo was changed or injected; every action was a trusted click.
