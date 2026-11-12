# 05: Every phone shows where it lies, readable from a metre away

**What to build:** In the lobby each phone shows its number across most of its screen, one sentence ("lay me right of phone 1") and a small row of phone outlines with its own filled in. The first phone's sheet folds to its bar when the first other phone is ready, so its own number shows too (spec D8).

**Blocked by:** 01

**Status:** resolved

- [x] The Tile number is drawn in the foreground colour at about 60 % of the screen's width; its contrast against the ground is at least 3:1 (it is 1.31:1 today)
- [x] One sentence under it says where this phone lies relative to its neighbour, for a row and for a column; the first phone's says it is the first
- [x] A pictogram shows the arrangement with this phone marked, for every arrangement the picked Game allows
- [x] The first phone's sheet folds when the first other phone becomes ready; the person can open it again, and it does not fold again by itself in that lobby
- [x] Reordering phones on the first phone updates every phone's number, sentence and pictogram
- [x] The move controls on the first phone are at least 44 px
- [x] Three-tab browser smoke at phone sizes, screenshots in a comment: a row of three, then the middle phone moved to the end

## Comments

### 2026-11-12, Ticket05Placement (implementation)

**Changed**
- `apps/pwa/src/placement.ts` (new, pure): `placementHint(layout, index)` moved here from `hud/shared.ts` (the sheet's roster and the strip import it from here now), and `placementSentence(layout, index)`, the sentence under the number. `apps/pwa/test/placement.test.ts`: 4 tests (a row, a column, phone 1 in every arrangement, a grid).
- `apps/pwa/src/scene.ts`: the grid and the World bounds stay in world millimetres; over them, in screen pixels, this phone's cue: its Tile number in `--fg` (`#f2f0ea`), the ink of a full-width digit 60 % of the screen's width (capped by the height left), the sentence under it, and a pictogram of `layout.devices` scaled into a box of half the width and 16 % of the height, every phone outlined in `--fg-2` with its number, this one filled in `--fg`. The stack is centred between 64 px kept clear at the top (the strip) and the bottom (the sheet's bar).
- `apps/pwa/src/hud/sheet.ts`: the sheet folds to its bar when another phone becomes ready (present and synced) in the lobby, once per page.
- `apps/pwa/index.html`: `.move` 44 × 44 px (was 36).
- `docs/guide/running-on-phones.md`: the templates' hints, what the lobby preview draws, the sheet's automatic fold.

**Decisions**
- Phone 1's sentence is "Lay me first, on the left" (column "at the top", grid "top left"), not "I'm the first phone": in the glossary the first phone is the Host, and a reorder can put a Peer at Tile 1, which would then claim to be the Host. Phone 1's roster and strip hint is the same place ("on the left", was "first phone").
- The grid hint is relative to a neighbour like the others: "right of phone N−1", the first of each row "below" the first of the row above (was "row r, column c"). It feeds the roster and the strip too.
- The number is sized on as many 8s as it has digits, so a narrow 1 is as tall as a 2.
- The fold is on the transition to "another phone is ready" and only once: a phone that joins during a Match does not fold the sheet when the Match ends, and the last Peer leaving and a new one joining does not fold it again.
- The strip still repeats the hint in its second line ("right of phone 1 · Player 2"); that line is ticket 04's and is left as it was.
- Colours are today's tokens written into `scene.ts` as constants, as `metronome.ts` does; ticket 08 restyles.

**Verified**
- `pnpm vitest run apps/pwa/test/placement.test.ts`: red for the row before `placement.ts` existed, red for phone 1 ("I'm the first phone" received), red for the grid ("Lay me row 1, column 2" received), then 4 passed.
- `pnpm typecheck && pnpm test`: typecheck clean; 31 test files, 231 tests passed.
- Contrast (WCAG 2 formula): number `#f2f0ea` on `#121212` 16.44:1; pictogram outlines `#a8a59c` 7.61:1.
- Browser smoke on `pnpm --filter @mgc/pwa dev --port 5205 --strictPort`, three headless Chrome tabs at 390 × 844, one profile each. Host alone: sheet open, roster "1 This phone · on the left · Player 1", ◀ ▶ measured 44 × 44 px each. Second tab joined: within the wait the Host's sheet folded to its bar ("2 phones · Row · Setup"); Host canvas: a big "1", "Lay me first, on the left", two outlines with the first filled; second tab: a "2" about 55 % of the width wide, "Lay me right of phone 1", second outline filled. Third tab: "3", "Lay me right of phone 2", third filled; the Host's sheet stayed folded. Opened the sheet and pressed ▶ on phone 2 (three presses, each swapping phones 2 and 3, since the two unnamed Peers' rows read alike; net one move): the tab that showed 2 then showed "3", "Lay me right of phone 2", third outline filled; the tab that showed 3 showed "2", "Lay me right of phone 1", second filled; the Host's roster and the strips followed. Column: "Lay me first, at the top", "Lay me below phone 1", "Lay me below phone 2", a vertical pictogram of three. Grid: "Lay me first, top left", "Lay me right of phone 1", "Lay me below phone 1", two outlines over one. With the sheet open, both Peers closed (Host: "1 phone · Row") and a new Peer joined to "Phone 2 of 2": the sheet stayed open. A Peer at 360 × 640: number, sentence and pictogram fit below the strip.

**Not verified**
- Readability from a metre away on real phones (the makers' go-public ticket).
- iOS Safari's canvas text metrics (`actualBoundingBox*`): checked in Chrome only.
- A rotated Tile in the pictogram: the templates never rotate.
