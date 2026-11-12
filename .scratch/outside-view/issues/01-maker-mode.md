# 01: Maker mode: one switch for everything players should not see

**What to build:** A player's screens show no clock figures, no game log, no log export and no "syncing clocks"; a maker gets all of it back, on every phone of a table, with one address flag (spec D3). This is the prefactor the other screen tickets stand on: after it, "is this for players or for makers" has one answer in the app.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Maker mode is on when the address carries the flag and stays on for that Device on later visits; the flag with a "no" value switches it off again
- [ ] The first phone's QR and its typed-address hint carry the flag when Maker mode is on, like the relay flag today
- [ ] With Maker mode off, neither a first phone nor a joined phone shows a millisecond figure, an offset, the game log, the log's line count, Export, Clear or Log
- [ ] With Maker mode on, every one of those is where it is today
- [ ] The session log records the same lines in both modes (a log exported after switching Maker mode on holds the lines from before)
- [ ] The reading of the flag and the remembered value is a pure function with unit tests: flag on, flag off, no flag with and without a remembered value
- [ ] Two-tab browser smoke at phone sizes, screenshots in a comment: both modes, first phone and joined phone
- [ ] The phone guide's flag table gains the row; "Maker mode" is used as `GLOSSARY.md` defines it
