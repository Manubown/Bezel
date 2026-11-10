# Connectivity 2: a relay that exists, a way onto it, and a state stream we can measure

Status: resolved (2026-11-10: tickets 01–04 resolved; 05, the phone run, is ready-for-human and waits for the maintainer's `pnpm setup-turn`)
Created: 2026-11-10
Sources: `docs/liveLogs/02edc2eTest/` (run 4, 2026-11-09), `.scratch/live-test-1/findings.md` §1–§1d, `.scratch/connectivity-1/spec.md` D6, ADR-0002, ADR-0003, the player report of 2026-11-10 ("Pong with three phones, one in the middle: the ball's direction arrives late, sometimes it does not show on the middle phone or on a Peer").

## Problem Statement

Two things keep a table of phones from playing:

1. **A Peer on a bad path has nowhere to go.** On an iPhone Personal Hotspot the direct WebRTC path connects and stops carrying the Host's data on about 80 % of attempts (live tests 1–3). Connectivity-1 made the Peer notice within 4 s and try again, so it loops. The fallback that was meant to end the loop, "TURN on by default" (`02edc2e`), never existed: the configured relay host `openrelay.metered.ca` resolves to `192.0.2.1`, a documentation address, on Cloudflare's and Google's resolvers (2026-11-10), and no log of any run holds a single candidate pair of type `relay`. Run 3's "connected first time with TURN" was one of the 20 % of direct attempts that live.
2. **A state that arrives late hides the ball.** Pong's host publishes 60 states a second per Peer (measured in run 4: 58–64 arrive each second, about 19 KB/s, no loss at one-second resolution). Every state travels on one reliable, ordered data channel, so one lost packet holds back everything behind it until it is retransmitted. Pong's view followed a state for at most 100 ms; the ball crosses a middle Tile (65–70 mm) in 0.2–0.45 s. A delivery stall of that length shows a ball frozen at the edge of the first phone, then on the third: never on the middle one. The session log cannot show such stalls: it counts states per second and nothing finer.

## Solution

- A build carries the TURN servers of an account its maintainer owns; a wizard walks the maintainer through getting them. A build without any says so in its log and connects directly, as before.
- A Peer that failed to hold a connection to its Host three times in a row stops trying the direct path and goes through the relay only. If the relay does not answer either, it goes back to trying everything. The log says when it switched.
- Pong's view follows the ball along its known path for up to a second without a new state, so a stall no longer hides it.
- Every Peer's log says, per second, how old the states were when they arrived and the longest silence between two of them. The next phone run then shows whether the state stream stalls, how long, and on which phone, and that decides whether the stream needs its own unreliable lane.

## User Stories

1. As a player on a Peer phone whose connection to the Host keeps dying, I want my phone to switch to a path that works by itself, so that I am in the Session within about a quarter of a minute instead of watching "Reconnecting to the host…" for minutes.
2. As a player, I want my phone to prefer the direct path while it works, so that play has LAN latency whenever the network allows it.
3. As a player on a phone that switched to the relay, I want it to stay there while the relay holds a connection, and through a short absence of the Host, so that it does not go back to the path that failed.
4. As a player on a phone that switched to the relay, I want it to try the direct path again when the relay brings no connection for 20 s, whether it never answered or stopped answering later, so that a dead relay never strands my phone or makes things worse than no relay.
5. As a player at the middle phone of a row, I want to see the ball cross my screen even when the network hiccups, so that the table looks like one surface.
6. As a player, I want the ball to bounce off the top and bottom and off a paddle that is in its way during such a hiccup, so that what I see is what the Host will confirm.
7. As a player, I want a held ball and a ball resting before a serve to stay where they are however old the last state is, so that nothing moves that the Host has stopped.
8. As the maintainer, I want to set up the relay once by following prompts, so that I do not have to learn a provider's dashboard or where each value goes.
9. As the maintainer, I want the relay's servers in one build-time setting for the dev server, a local build and the hosted build alike, so that every channel I test behaves the same.
10. As the maintainer, I want a build whose relay setting is broken to say what is wrong in its session log, so that I do not mistake a build without a relay for one with it, as happened for two test runs.
11. As the maintainer reading a session log, I want a line each time a phone goes relay-only or back, with the number of failures that caused it, so that I can tell which phones needed the relay.
12. As the maintainer reading a Peer's log, I want each second's state count, the oldest and youngest state on arrival and the longest gap between two states, so that I can see a delivery stall and its length.
13. As the maintainer, I want a gap that spans several seconds reported once, on the second in which the next state arrives, so that a long silence is not hidden by seconds without lines.
14. As the maintainer comparing runs, I want `?noturn` to keep leaving the relay out on every phone of a table, so that I can still measure the direct path alone.
15. As a Game author, I want Pong to show how far a view may run ahead of its last state and why, so that I can copy the pattern for my own moving things.
16. As a player on the Host phone, I want none of this to change how my phone behaves, so that the authority of the Match stays where it is (ADR-0002).

## Implementation Decisions

- **D1 The relay's servers are a build-time setting, a JSON array of ICE servers.** The PWA reads it once at start, keeps the `turn:`/`turns:` entries with their credentials and drops the rest (the transport has its own STUN servers). No setting: no relay. A setting it cannot use (not JSON, not an array, a TURN server without credentials, no TURN server at all) yields no relay and a problem text on the log's `device` line. The dead Open Relay constant is deleted. No runtime fetch of credentials: the provider's dashboard hands out long-lived ones, and a fetch would delay every page load.
- **D2 Escalation lives in the Trystero transport, as a pure policy it consults.** The policy counts resets in a row whose longest-lived connection did not reach 15 s; a reset after a connection that did restarts the count; a reset with no connection since the last one counts for nothing. At three it turns relay-only: later joins pass `iceTransportPolicy: 'relay'`. Relay-only without any connection for 20 s (from the switch, from a reset, or from its last connection ending) turns back to every path with the count at zero. There is no "relay for good": a relay that worked and then stops (quota, outage) must not strand a phone until its page is reloaded; the price is that a Host away for more than 20 s costs a relayed Peer three more direct attempts when it returns. On a switch the transport closes every connection it made, also those Trystero still holds from the room it left, so no connection built with the old configuration is handed to the new room. The Session does not know: it keeps calling `reset()`. Only Peers reset (connectivity-1 D5), so only Peers escalate, and one relay-only side is enough: every candidate pair then holds its relay candidate.
- **D3 The transport reports each switch through an option callback**; the PWA logs it as a `relay` line (`relayOnly`, `failures`). Escalation is on only when the build has TURN servers and the address has no `?noturn`.
- **D4 The recorder measures state arrivals.** The PWA tells it about each state frame a Peer takes off the Session's Match channel (the Match id and the state's publish time on the shared clock). The `tick` line gains `state: { n, gap, ageMin, ageAvg, ageMax }` for a second with arrivals: `age` is shared time at arrival minus publish time, `gap` the longest time between two consecutive arrivals of one Match ending in that second. The Host's own view gets its states in-process and is not measured.
- **D5 Pong's view extrapolates up to 1000 ms** (was 100). Between paddle contacts the ball's path is determined by the state it carries; the view already folds the path at the table's top and bottom and returns it off a paddle that covers it. Beyond a second the link is visibly weak (`WEAK_MS` is 2.5 s) and a frozen ball is the honest picture.
- **D6 No unreliable lane for states in this round.** Trystero opens one reliable, ordered channel per connection and offers no other. A second, negotiated channel (`ordered: false, maxRetransmits: 0`) on its `RTCPeerConnection` is possible, but it changes the delivery contract of `publish` (a change-only state must still arrive), needs a reliable tail and a sequence number, and rests on stalls nobody has measured. D4 measures them. The lane is built if a phone run shows `gap` above 150 ms in more than 1 % of the seconds of a Match on a link whose `link` lines stay `ok`.
- **D7 The relay account is the maintainer's step**, walked by a wizard script: sign up, create a credential, copy the ICE servers array, check that the relay answers, set the hosted build's secret. The servers are readable in the published bundle, like the public credentials before them; the wizard says so and how to revoke.

## Testing Decisions

- A good test here pins what a phone or a log reader would see break: when the policy switches and switches back at its boundaries, which servers a setting yields, what a `tick` line says for a given arrival pattern, where the ball is drawn for a state of a given age. Nothing about wiring or wording.
- The escalation policy is tested alone, without timers or WebRTC (prior art: the clock estimator's tests). That Trystero applies a changed RTC configuration on a rejoin cannot be unit-tested; it is proven once in a real browser by recording the configuration each `RTCPeerConnection` is constructed with.
- The TURN setting parser is tested alone (prior art: the PWA's pure modules, `rejoin`, `pause`).
- The recorder's `state` figures are tested through its `tick` line on fake timers (prior art: its wire-total tests).
- Pong's extrapolation is tested through the SDK's test match at the view's drawing (prior art: Pong's existing view tests): three Tiles, a state 300 ms old, the ball on the middle Tile.
- Whole workspace: typecheck and test suite green; a two-tab browser run of the PWA joins and plays a Match with the new `tick` figures in the Peer's log.

## Out of Scope

- The unreliable state lane (D6), delta or binary state encoding, lower publish rates.
- Star-only transport, own signaling, QR-SDP (M5).
- The cause of the stall on the iPhone hotspot Host. This round gives the Peer a way around it and the log more to say about it.
- The iPhone that drew at 22–27 fps for its first 27 s and never held a wake lock in run 4 (noted in the findings; its own ticket when it shows again).

## Further Notes

- Until the maintainer has run the wizard, a build has no relay and behaves as the builds of live tests 1–2 did, plus connectivity-1's reconnects.
- The next phone run needs: the relay set up, an iPhone as hotspot Host (the failing case), three phones in a row playing Pong, and every phone's log exported. What to read in them is in ticket 05.
- The escalation policy counts every connection the transport holds, and Trystero builds a mesh: a Peer's connection to another Peer counts like its connection to the Host. Every reset closes them all, so no connection outlives an attempt while a Peer loops, and the count is right in the case this round is for. A relay-only Peer that reaches another Peer but not the Host would keep its probe deadline cancelled; the transport cannot tell which connection is the Host's. A star-only transport (M5) removes the question.
- Decisions here are tuning and a deferral (D6), all cheap to reverse: no ADR. "Relay" is in the glossary, as it now names three things in the docs.
- Seen in the browser smoke: a Host that draws at 30 fps sends its 60 states a second in pairs (ticket 03).
