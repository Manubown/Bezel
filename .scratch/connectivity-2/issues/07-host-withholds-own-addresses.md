# 07: A Host whose connections die stops signaling its own addresses

**What to build:** A fail-safe before the Relay. Every dying attempt of live runs 5 and 6 (9 of 9) shows the Peer checking an address the Host signaled and getting no answer; the research traces that to the hotspot iPhone signaling its cellular address (`docs/research/iphone-hotspot-webrtc.md`, cause 1; `docs/research/README.md`, option 4). A Host that has seen a connection die leaves its own addresses out of what it signals from then on, so a Peer never learns the address and never checks it. Nothing changes for a first attempt, so a network that works today is not touched.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] A Host signals its own addresses (ICE `typ host` candidates) until one connection ends within 15 s of coming up; connections that get their peer after that carry none, in the session description or as trickled candidates
- [x] A Peer never withholds: a connection whose two ends both do has no local path
- [x] The Host's session log says when it switched (`withhold`, with the failure count)
- [x] A connection still forms when the Host withholds (the Peer learns the Host from its checks)
- [ ] On an iPhone Personal Hotspot with the hotspot phone as Host: a Peer's second or third attempt lives, with a `prflx` pair, before the Relay is used (needs a phone run)

## Comments

### 2026-11-11, Main (implementation)

**Changed**
- `packages/core/src/own-addresses.ts` (new, internal to core): `isOwnAddress`, `withoutOwnAddresses`, the policy `OwnAddressWithholding` (sticky once on; a connection that lived 15 s restarts the count), and `withholdingOwn(Base, withhold)`, an `RTCPeerConnection` subclass for Trystero's `rtcPolyfill`. Its `localDescription` reads without own addresses in every mode; own-address candidates are held until the remote description is set (the moment a connection Trystero made ahead of time gets its peer), then passed on or dropped.
- `packages/core/src/trystero-transport.ts`: `TrysteroOptions.withholdOwnAfter`, `onWithhold`; `recording` takes its base class so the two wrappers stack.
- `apps/pwa/src/main.ts`: `WITHHOLD_AFTER = 1`, Host only; log line `withhold`.
- Guide: the `withhold` log row, connectivity flags, the troubleshooting entry.

**Decisions**
- Adaptive, not "every iPhone Host always": a first attempt is unchanged, so the home-Wi-Fi path that works today (`host ↔ host`, 4–14 ms) cannot regress on it. The cost is one failed attempt (about 5 s) for the first Peer on a hotspot.
- Threshold 1: the Host sees a dying attempt's leave about 4 s after its join and before the next join (run 5 and 6 Host logs), so attempts two and three run withheld before `RELAY_AFTER = 3` sends the Peer to the Relay.
- Decided per connection when the remote description is set, not when the connection is made: Trystero makes offers ahead of time and keeps them up to 3 minutes.
- No flag. The run compares by itself: attempt one is signaled as before, attempts two and three are not.

**Verified**
- `pnpm vitest run packages/core/test/own-addresses.test.ts`: 9 tests passed.
- Two Chrome tabs on the dev server, the Peer's `addIceCandidate` / `setRemoteDescription` recorded: with the Host not withholding the Peer was given 1 `host`, 4 `srflx`, 12 `relay` candidates; after a connection that ended 4.5 s after its join the Host logged `withhold {failures: 1}` and the next connection gave the Peer 0 `host`, 2 `srflx`, 6 `relay`, and reached `ready` (Peer's pair `host ↔ prflx`, rtt 1 ms). A connection that ended after 17 s did not switch it on.

**Not verified**
- Anything on phones. Whether an iPhone hotspot's direct path lives this way rests on the research's inference.
- A Peer's checks toward the Host's `srflx` candidate are still possible; on an IPv6 cellular network that could be the same address as the withheld one. The Peer's `weak` and `settled` snapshots would show such a pair unanswered.
- The mirrored table (a Peer's phone is the hotspot, the Host a member) is not covered: only the Host withholds.

**What the next hotspot run should show** (Host = the hotspot iPhone, export both logs)
- Host log: a `withhold` line about 4 s after the first Peer's first join.
- Peer log: attempt one dies as before; attempt two's `ice join` pair is `host ↔ prflx`, a `settled` line follows 6 s later with no pair toward a `host` remote candidate, no `relay` line.
- If attempts two and three die as well: the inference is wrong or incomplete; the `weak` snapshot's `others` say which pair the Peer was checking.
