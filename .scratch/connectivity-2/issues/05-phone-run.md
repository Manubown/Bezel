# 05: Phone run on the connectivity-2 build

**What to build:** Nothing; a run on real phones that answers what the code could not: does a Peer get onto the relay and stay in the Session on the iPhone hotspot, and does the state stream stall on a table of three phones.

**Blocked by:** 01, 02, 03, 04, and the maintainer having run `pnpm setup-turn` and published the build

**Status:** ready-for-human

## The run

1. Open the hosted build on one phone and export its log once: the `device` line must say `turn: true` and have no `turnProblem`. If not, the secret is missing or unusable; stop here.
2. **The failing case:** the iPhone as Personal Hotspot and Host, an iPhone and an Android as Peers. Join, wait until every strip says "Phone n of 3" or one minute has passed.
3. **Pong on three phones in a row**, the middle one a Peer if possible, two full Matches. Watch the middle phone.
4. **The same on a normal Wi-Fi router** if one is at hand, for comparison.
5. Export every phone's log into `docs/liveLogs/<build>/`.

## What to read

- [x] Relay: on a Peer that looped, three `peer-leave` lines about 4 s after their `peer-join`, then a `relay` line `{ relayOnly: true, failures: 3 }`, then a `peer-join` whose `ice` line has `pair.local.type: "relay"`, then `status: "ready"` that holds. Time from page load to `ready`.
- [x] Relay refused: a `relay` line `{ relayOnly: false }` about 20 s after the first one means the relay did not connect. Then the `ice` lines of that stretch say why (no `relay` pair at all: credentials or reachability).
- [x] The stall itself, if it shows before the relay takes over: the `ice weak` line's `dc.msgRecv` against the `rx` totals, as `.scratch/live-test-1/findings.md` §1c describes, and the selected `pair` of the `weak` line against the `join` line's (types, rtt): a pair that changed in between is §1e's late-candidate switch.
- [x] State stream: on each Peer, `select(.k=="tick" and .state)`: the share of Match seconds with `gap` above 150 ms while that phone's `link` lines stay `ok`. Above 1 %: spec D6's unreliable lane is the next round. Also `ageMax` on a relayed Peer against a direct one.
- [ ] What the players saw on the middle phone, next to that phone's `gap` and `fps` at the time.
- [x] The iPhone's `fps` in its first half minute and its `wake` flag (run 4 had 22–27 fps and never a wake lock).

## Comments

### 2026-11-11, Main: run 5 read (`docs/liveLogs/mgc-XHZE-*`, two iPhones, the hotspot phone as Host)

Full account: `.scratch/live-test-1/findings.md` §1f.

- **Relay:** as the first box describes, twice: 18.9 s and 19.7 s from page load to `ready`, relay pair `relay ↔ prflx`, rtt 84–98 ms. Never refused. One load got a direct pair on its second attempt (7.6 s, rtt 7 ms).
- **The stall:** the selected pair did not change between `join` and `weak` (no late-candidate switch); it went `succeeded` → `in-progress` while the Host's packets stopped arriving at the Peer, STUN included (Host sent 16 messages, Peer received 6–8; the Peer got 3 STUN responses to 5–9 requests). The network path, below SCTP.
- **State stream, relayed:** `gap` above 150 ms in 7 of 38 Match seconds (18 %), up to 455 ms, states up to 1 s old on arrival. The D6 trigger is met on the relay path. No direct Match in this run.
- **fps / wake:** both iPhones at 59–61 fps throughout; the Peer's `wake` was `false` because nobody touched it (the Match was Host against bot).
- **Not done in this run:** three phones in a row (the middle-phone question), an Android Peer, a Wi-Fi router for comparison.
- **Found besides:** Safari applied Page Zoom 33 ms after the page's scripts started on one load, so that Peer's Tile was measured before the zoom. Fixed (`viewportSettled`).

**Status stays `ready-for-human`** for what is left: the three-phone table, and the `?mic` experiment of findings §1f.
