---
status: accepted
---

# Host-authoritative star over WebRTC; host loss ends the Session

One Device is the Host: it runs the authoritative game logic and every other Device talks only to it over a WebRTC data channel (star, not mesh). If the Host leaves, the Session ends and Peers return to the join screen; there is no host migration and the SDK offers no state hand-off API, so games may assume a single, never-changing authority for the life of a Match.

A star keeps game state trivially consistent and needs zero infrastructure (signaling is one-shot via Trystero relays, QR-SDP as offline fallback). Host migration would require every game to serialise its full state on demand and every Peer to hold a hot standby; for a party game where the host's phone is on the table, that cost buys nothing.

## Consequences

- Host upload scales with Peer count (N−1 copies of each published state). Acceptable on LAN for ≤6 Devices; measured before adding binary/delta encoding.
- Reconnect (M5) is Peer-side only: a returning Device rejoins the same Host under its persisted `deviceId`.
