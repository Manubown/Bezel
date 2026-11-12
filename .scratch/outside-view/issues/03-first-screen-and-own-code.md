# 03: The first phone's sheet: scan, lay, pick, start; its own code cannot end the table

**What to build:** The first phone's sheet reads top to bottom as the steps of getting a table going: the code to scan with one sentence for the other phones, how to lay the phones, the Game cards, the Players, Start. Joining a different table is a folded link at the bottom, and typing this table's own code there says so and changes nothing (spec D4, D5).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The sheet's order is: QR and code, placement, Games, Players, Start; at 360×780 Start is reachable without hunting
- [ ] The hint under the QR speaks to the other phones ("Other phones: open the camera and scan this") and no longer tells anyone to enter a code here
- [ ] "Join a different table" is folded by default; opened, it takes a code
- [ ] The table's own code, in any letter case, is refused with a sentence that says it is this table's code; the page does not navigate and the Session goes on
- [ ] Another code joins that table as today
- [ ] Copy on the sheet says "table" and "first phone" (`GLOSSARY.md`), never "host", "session" or "room"
- [ ] The own-code check is a pure function with unit tests
- [ ] Two-tab browser smoke with a second phone joined: the first phone types its own code and both stay in the table
