# 09: Player colours and "touch here" on the Player's own Tile, in Pong and Air Hockey

**What to build:** Each Player has a colour that is the same on every phone and in the platform's own screens: paddle, score, prompt, name on the sheet and the result card. A Player's own Tile says "Touch here to start"; the other Tiles say "Waiting for Ana". Scores are readable, the ball and puck stay ivory with a short trail (spec D10, D11).

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] `@mgc/sdk` exports the Player palette and a function from a Player's position in the Match's Player list to a colour; four colours, the first two coral and teal; nothing new travels on the wire; a test at the SDK's game seam pins position to colour
- [ ] The platform's sheet, pause card and result card show a Player's name in that colour
- [ ] Pong and Air Hockey draw each side's paddle, score and prompt in its Player's colour; a bot's label too
- [ ] On the Tile where a waited-for Player sits the prompt is "Touch here to start" (or the mid-Match equivalent); on every other Tile it is "Waiting for <name>"; harness tests in both Games show the two views differ for the same state
- [ ] Scores are at 70 % opacity or more and pass 3:1
- [ ] Air Hockey in a row: prompt and score do not overlap on two 64 mm wide Tiles
- [ ] The ball and the puck are ivory and distinct from the paddles; a short trail follows them and continues across the gap between Tiles
- [ ] Both Games' existing tests pass unchanged in what they assert about play
- [ ] Two-tab browser smoke, screenshots in a comment: Pong before the first touch, during play, Air Hockey end to end
- [ ] The developer guide's concepts page shows the palette and the own-Tile pattern in a few lines
