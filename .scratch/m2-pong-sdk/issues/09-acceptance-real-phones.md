# 09: M2 acceptance on real phones

**What to build:** Nothing new — a human verifies the milestone on hardware. Two browser tabs first, then one iOS and one Android phone on the same Wi-Fi: join by QR, arrange as a row, start Pong, play to seven; pull one phone's connection (airplane mode for a few seconds) and restore it. Record the numbers and the verdict in the plan's milestone table.

**Blocked by:** 05 (Playable Pong: input, scoring, end), 06 (Pause and resume across Device loss), 07 (Fault isolation and the close ladder)

**Status:** ready-for-human

- [ ] Two tabs: full game to seven, no visible jump at the bezel, paddles follow the pointer on the outer tiles
- [ ] iOS + Android on one Wi-Fi: QR join, arrangement, Start reaches both phones at once
- [ ] Ball crosses the physical bezel with no visible stutter; ball and paddle sizes match physically across the two phones (ruler check against the mm sizes in the Pong source)
- [ ] Airplane mode on the Peer for ~5 s: both phones pause naming the Peer; restoring Wi-Fi resumes mid-rally within a few seconds, same Tile
- [ ] Hiding the browser on the Host and returning does not end the Match; the catch-up is bounded (no long fast-forward)
- [ ] Host roster shows rtt and offset for the Peer; both recorded in the plan's M2 row with the date and device models
- [ ] Any defect found is filed as a new issue in this directory rather than fixed inline
