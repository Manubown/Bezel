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

- [ ] Relay: on a Peer that looped, three `peer-leave` lines about 4 s after their `peer-join`, then a `relay` line `{ relayOnly: true, failures: 3 }`, then a `peer-join` whose `ice` line has `pair.local.type: "relay"`, then `status: "ready"` that holds. Time from page load to `ready`.
- [ ] Relay refused: a `relay` line `{ relayOnly: false }` about 20 s after the first one means the relay did not connect. Then the `ice` lines of that stretch say why (no `relay` pair at all: credentials or reachability).
- [ ] The stall itself, if it shows before the relay takes over: the `ice weak` line's `dc.msgRecv` against the `rx` totals, as `.scratch/live-test-1/findings.md` §1c describes, and the selected `pair` of the `weak` line against the `join` line's (types, rtt): a pair that changed in between is §1e's late-candidate switch.
- [ ] State stream: on each Peer, `select(.k=="tick" and .state)`: the share of Match seconds with `gap` above 150 ms while that phone's `link` lines stay `ok`. Above 1 %: spec D6's unreliable lane is the next round. Also `ageMax` on a relayed Peer against a direct one.
- [ ] What the players saw on the middle phone, next to that phone's `gap` and `fps` at the time.
- [ ] The iPhone's `fps` in its first half minute and its `wake` flag (run 4 had 22–27 fps and never a wake lock).

## Comments
