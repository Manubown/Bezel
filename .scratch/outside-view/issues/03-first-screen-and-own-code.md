# 03: The first phone's sheet: scan, lay, pick, start; its own code cannot end the table

**What to build:** The first phone's sheet reads top to bottom as the steps of getting a table going: the code to scan with one sentence for the other phones, how to lay the phones, the Game cards, the Players, Start. Joining a different table is a folded link at the bottom, and typing this table's own code there says so and changes nothing (spec D4, D5).

**Blocked by:** 02

**Status:** resolved

- [x] The sheet's order is: QR and code, placement, Games, Players, Start; at 360×780 Start is reachable without hunting
- [x] The hint under the QR speaks to the other phones ("Other phones: open the camera and scan this") and no longer tells anyone to enter a code here
- [x] "Join a different table" is folded by default; opened, it takes a code
- [x] The table's own code, in any letter case, is refused with a sentence that says it is this table's code; the page does not navigate and the Session goes on
- [x] Another code joins that table as today
- [x] Copy on the sheet says "table" and "first phone" (`GLOSSARY.md`), never "host", "session" or "room"
- [x] The own-code check is a pure function with unit tests
- [x] Two-tab browser smoke with a second phone joined: the first phone types its own code and both stay in the table

## Comments

### 2026-11-12, Ticket03FirstScreen (implementation)

**Changed**
- `apps/pwa/src/othertable.ts` (new): `tableCode(typed)` reads a typed code the way an address carries it (in capitals, letters and digits only); the sheet's code field uses it as you type. `otherTable(typed, own)` returns the table a code typed on the first phone opens (`{ code }`), or `{ refusal }` for this table's own code in any letter case: "REZV is this table’s code: scan the QR above with the other phones." It returns undefined when nothing is left of what was typed. `apps/pwa/test/othertable.test.ts`: 4 tests. Ticket 04's `joinAddress` (`join.ts`, landed while this was built) still reads the code with its own copy of the same expression; that file is 04's.
- `apps/pwa/src/hud/sheet.ts`: the body now reads top to bottom as the QR with its hint, then "Lay the phones like this" over the roster (moved up from below Start, ◀ ▶ included), then the Game cards, arrangement, Controllers, Players, Start / End match and the reason line. After those come the game log and Export log (Maker mode) and, last, `<details class="other-table">` "Join a different table", folded. It holds the `.enter` form and a `.other-refusal` status line. Submit goes through `otherTable`: the own code shows the sentence and nothing else happens; another code reloads as `?room=CODE` as before, without flags. Opening the fold focuses the code field, and typing clears the sentence.
- Hint: "Other phones: open the camera and scan this, or open **<address>** and join table **<CODE>**." The typed address stays, because D3 and ticket 01 carry the Maker flag on it.
- `apps/pwa/index.html`: `.other-table summary`, `.other-refusal`, `.lay`, `.lay-label` (layout only, existing tokens). `.enter` loses its `grid-column`, now that it is no longer in the `.join` grid. `.hint b` wraps anywhere, so a long address (`manubown.github.io/Bezel/play`) cannot widen the sheet at 360 px.
- Guide sentences made false: `running-on-phones.md` (the Code bullet under Join, the sheet table's order, the QR row, the new "Join a different table" row), `getting-started.md` step 2 and the "became a Host of its own table" fix in `troubleshooting.md`. No citation re-anchored.

**Decisions**
- The placement step is the roster under a one-line label, "Lay the phones like this". There is no second picture: the canvas behind the sheet draws the number and pictogram (ticket 05). The arrangement picker and Controllers stay with the Game cards, since they follow the Game (D6).
- The fold is a native `<details>`/`<summary>`: folded with no script, keyboard-operable, and the marker shows it opens. It sits below Export log, so it is the last thing on the sheet in both modes.
- The pure function also normalises (case, stray characters), so the refusal does not depend on the field's live capitalising.
- A Peer that opened the bare address is itself a first phone, and "Join a different table" on its sheet is how it joins by code. That is what the hint's "join table <CODE>" points at.
- The reason line's "Last match: Match stopped · Ended from the host phone" comes from `result.ts`. Ticket 06 rewrites it as "Game ended on the first phone"; it was staged in its worktree when this was written. Nothing else on the sheet says host, session or room. The remaining hits are URL parameters, the input's `name` and comments.

**Verified**
- Red then green for each slice: `pnpm vitest run apps/pwa/test/othertable.test.ts`. The red runs failed on: the missing module, the lower-case own code (undefined), another code (undefined) and the empty input (`{ code: '' }`). Final run: 4 passed.
- `pnpm typecheck && pnpm test`: typecheck clean; 34 test files, 254 tests passed. After merging `outside-view` (ticket 04) and moving the code field onto `tableCode`: typecheck exit 0; 35 test files, 267 tests passed.
- Headless Chrome, one profile per tab, dev server on 5203:
  - First phone at 360×780: bar "Bezel N77G 1 phone · in a row · Hide", QR with the new hint beside it, "Lay the phones like this" with "1 This phone · on the left · Player 1", the two Game cards, P1/P2, Start Pong at 665–708 px with nothing scrolled, and "▸ Join a different table" folded at the bottom (form not shown).
  - A second tab at `?room=N77G` (390×844) joined; the sheet folded itself (ticket 05). Opened again: two roster rows, P1/P2 "phone 1"/"phone 2", Start Pong still at 665–708 px of 780.
  - Tapped "Join a different table": it opened and the code field had focus. Typed `n77g` (the field showed `N77G`) and pressed Join. The URL stayed `https://localhost:5203/`, the line read "N77G is this table’s code: scan the QR above with the other phones.", the roster still listed both phones, and the second tab still read "Phone 2 of 2 · right of phone 1 · Player 2" at `?room=N77G`. Start Pong then started the Match on both tabs, and End match ended it.
  - Typed `kmpq` (the sentence cleared, the field showed `KMPQ`) and pressed Join: the page went to `https://localhost:5203/?room=KMPQ`. The fold was opened by setting `details.open` from the test script for this step; the first opening above was a tap on the summary.
  - A long address measured by setting the hint's address text to `manubown.github.io/Bezel/play` in the page: it wrapped inside its 130 px column, and the sheet body's scroll width stayed 360. The page was reloaded after.
  - New table at `/?maker` (360×780) with a second tab joined, Air Hockey picked. The visible blocks, in order: join, lay, cards games, seg arrangement, players, go, diag, other-table. With seven cards and the picker, Start sits at 899–942 px and is reached by scrolling. The same tab reloaded at `/?maker=no` (players' sheet, same two phones, Air Hockey with "End to end | In a row" shown): Start Air Hockey at 709–752 px of 780 with nothing scrolled.

**Not verified**
- Real phones; a screen reader announcing the refusal (`role="status"`).
- Three or more phones at 360×780, and a Game with Controllers in Maker mode.
