# 05: Every phone shows where it lies, readable from a metre away

**What to build:** In the lobby each phone shows its number across most of its screen, one sentence ("lay me right of phone 1") and a small row of phone outlines with its own filled in. The first phone's sheet folds to its bar when the first other phone is ready, so its own number shows too (spec D8).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The Tile number is drawn in the foreground colour at about 60 % of the screen's width; its contrast against the ground is at least 3:1 (it is 1.31:1 today)
- [ ] One sentence under it says where this phone lies relative to its neighbour, for a row and for a column; the first phone's says it is the first
- [ ] A pictogram shows the arrangement with this phone marked, for every arrangement the picked Game allows
- [ ] The first phone's sheet folds when the first other phone becomes ready; the person can open it again, and it does not fold again by itself in that lobby
- [ ] Reordering phones on the first phone updates every phone's number, sentence and pictogram
- [ ] The move controls on the first phone are at least 44 px
- [ ] Three-tab browser smoke at phone sizes, screenshots in a comment: a row of three, then the middle phone moved to the end
