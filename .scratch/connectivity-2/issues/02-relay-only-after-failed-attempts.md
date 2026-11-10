# 02: A Peer that cannot hold a direct connection joins through the relay only

**What to build:** A Peer whose connection to the Host died three times in a row without lasting stops trying the direct path: its next joins use the TURN relay only, its session log says so, and if the relay brings no connection for 20 s it goes back to trying every path. A build without TURN servers, and a Host, behave as before. Spec D2, D3.

**Blocked by:** None (can start immediately). It does nothing on a phone until 01 gives the build TURN servers.

**Status:** resolved

- [x] Exactly three resets in a row whose connections lived under 15 s switch to relay-only; a connection that lived 15 s restarts the count; a reset with no connection since the last one changes nothing
- [x] Relay-only without a connection for 20 s (from the switch, a reset, or the last connection ending) switches back with the count at zero; a connection that comes up in time cancels that
- [x] After the switch, the `RTCPeerConnection`s Trystero builds carry `iceTransportPolicy: 'relay'`, as offerer and as answerer; after switching back they carry none
- [x] Each switch reaches the PWA, which logs a `relay` line with `relayOnly` and `failures`
- [x] Without `relayAfter`, or without TURN servers, or with `?noturn`: no policy, `reset()` as before

## Comments

### 2026-11-10, RelayEscalation (implementation), Main (policy change, wiring)

**Changed**
- `packages/core/src/relay-escalation.ts` (new, internal to `@mgc/core`): `RelayEscalation` (`joined`, `left`, `reset`, `expire`, `mode`, `failures`, `deadline`), `RELAY_STABLE_MS = 15000`, `RELAY_PROBE_MS = 20000`. Pure: every call takes the time.
- `packages/core/src/trystero-transport.ts`: `TrysteroOptions.relayAfter`, `onRelayOnly(relayOnly, failures)`. The policy exists only with TURN servers and `relayAfter`. In relay mode the join passes `rtcConfig: { ...rtcConfig, iceTransportPolicy: 'relay' }`. One probe timer, armed from the policy's deadline after every join, leave and rejoin, cleared on `close()`.
- A switch of mode closes every connection the transport made, recorded through Trystero's `rtcPolyfill` option, not only the ones `getPeers()` lists: Trystero keeps a left room's connections for 123 s per app and hands a live one to the new room in place of a new one (`shared-peer.mjs:72`, `105-106`, `367-375`); `getPeers()` misses those still in its handshake.
- `apps/pwa/src/main.ts`: `RELAY_AFTER = 3`; the options are passed only when the page has TURN servers; `onRelayOnly` logs `relay`.
- Main, after the agent: the first version kept relay-only "for good" once a relay connection had lived 15 s. Removed: a relay that works and later stops (quota, outage) would have stranded the phone until a reload, since without a Host no reset comes and nothing ran a deadline. Now the deadline runs whenever relay mode has no connection (spec D2).
- Main, after the review (`/code-review`, both axes): going back to every path now forgets the lifetime of what the relay carried (it had forgiven the first failed direct attempt afterwards, so four attempts instead of three); the unused `relayOnly` getter and the policy's exports from the package index are gone.

**Verified**
- `pnpm vitest run packages/core/test/relay-escalation.test.ts`: 18 tests passed. Whole workspace after the last change: `pnpm typecheck` clean, `pnpm test` 28 files, 209 tests passed.
- Chromium, two tabs on the dev server, signaling over the public Nostr relays, a second `TrysteroTransport` per tab with a throwaway app id, a TURN server at an unroutable test address and `relayAfter: 1`, every `RTCPeerConnection` constructor argument recorded by an init script. Times in ms after that tab's `reset()`:

  | Tab | Role | Before | After the switch | `onRelayOnly` | After the deadline |
  |---|---|---|---|---|---|
  | A | offerer | no policy | `iceTransportPolicy: "relay"` at +182 | `(true, 1)` at +3; `(false, 0)` at +20006 | no policy at +27806, rejoined +28132 |
  | B | answerer | no policy | `iceTransportPolicy: "relay"` at +286 | `(true, 1)` at +1; `(false, 0)` at +20005 | no policy at +27795, rejoined +27960 |

  A transport with TURN servers and no `relayAfter`: three resets in a row, never relay-only, every connection without a policy, each leave followed by a join within about 0.5 s.
- That run was made before Main's policy change; the change touches when the deadline starts (also at the last leave), not how a switch is applied. The unit tests cover the new rule.
- **With the maintainer's relay, 2026-11-11** (the PWA itself on the dev server with `apps/pwa/.env.local`, a Host tab and a Peer tab in Chromium, the Peer's transport reset three times, 1.5 s after each `ready`): the Peer's log has `relay { relayOnly: true, failures: 3 }` after the third reset and nothing before; its four `ice join` lines read `host ↔ host` three times (rtt 0–4 ms), then `relay ↔ relay` over UDP (rtt 40 ms), data channel `open`; the Host's fourth reads `prflx ↔ relay`; the Peer was `ready` 0.8 s after the third reset, clock rtt 42–43 ms. The Host's log has no `relay` line: it never reset.

**Not verified**
- The closing of connections still in Trystero's handshake at a switch: none could be produced in the browser; it rests on the source reading.
- The relay on the network it is for: the iPhone hotspot Host of live tests 1–3. Ticket 05.

**Seen in that run:** one of Trystero's signaling relays (`relay.nostrmap.net`) answered the quick resets with `rate-limited: max 30 events/60s` (a `console` line each); the other relays carried the joins. A Peer looping every 4 s for a minute sends as many announces; worth a look in the phone logs.
