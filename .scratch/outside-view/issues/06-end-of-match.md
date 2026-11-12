# 06: The end of a Match leads to the next one

**What to build:** A finished Match reads "Ana wins 7–5". The first phone's card offers Play again (same Game, Players, arrangement and bots) and Change game; the other phones read that the first phone starts the next game. The sheet stays folded (spec D9).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A two-sided result's headline is the winner's name and both scores in one line; a draw and a result without scores still read sensibly; the existing result tests are extended to these
- [ ] Play again on the first phone starts a Match with the same Game, Players, Layout and bots through the lobby's ordinary start; a test at the lobby's interface shows the second Match's frozen info equals the first's except for its identity
- [ ] Play again is refused in words when a phone of that Match is no longer in the table
- [ ] Change game opens the sheet
- [ ] Other phones' cards say the first phone starts the next game and offer nothing to tap but closing
- [ ] The sheet does not reopen by itself when a Match ends
- [ ] The last-Match line uses the neutral text colour; a Match stopped from the first phone reads "Game ended on the first phone"
- [ ] Two-tab browser smoke: two Pong Matches in a row with one tap between them
