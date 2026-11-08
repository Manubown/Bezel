# Quiz

`seats: 'controllers'`: in the lobby, mark every player's phone as a Controller ("Players' phones"); each becomes a Player seated at that phone. The one phone left on the table is the board: it shows the question, who has still to answer, then the right answer and the standings. Each Controller shows the question and the four answers as buttons.

A pub-quiz round: one phone on the table is the board, every other phone is a Controller in a Player's hand.

```
src/index.ts         manifest + host + view, exported through defineGame
test/quiz.test.ts    the rules, run in one process over createTestMatch
```

- The board (the one Tile) draws the question, the four choices, a countdown and the scores on its canvas.
- Each Controller is a DOM view: four buttons for its Holder, then "Locked in", then right or wrong.
- The host gives each Controller to a Player at the start (`setHolder`), takes the first answer per Holder per question, and times it by its arrival on the host. A right answer earns `QUIZ.fastest` points at once, falling to `QUIZ.slowest` at the deadline.
- The board's state is broadcast; each Controller also gets its own state, published to it alone. A Controller's view hears both, so the view tells them apart by `kind`.
- A question closes when every Holder answered or `QUIZ.answerMs` ran out; the next comes `QUIZ.revealMs` later. After `QUIZ.questions` questions (drawn from `QUESTIONS` in the seed's order) the most points win.
- The Game imports `@mgc/sdk` only; the test pins that.
