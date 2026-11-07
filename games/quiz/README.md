# Quiz

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
