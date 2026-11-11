# Internet-carried Sessions: every phone on its own connection

As of 2026-11-11. The question: what if the phones on the table share no local network at all? Every Device uses its own mobile data (or whatever Wi-Fi it is on), and the Session runs across the internet. How well does that work for MobileGameConnect, and what is the best way to carry it?

Conventions: Host, Peer, Device, Session, Relay (a server that carries a connection when no direct path works) as in the rest of the docs. `[INFERENCE]` marks my reasoning or arithmetic, not a measurement. "Unconfirmed" marks a gap I could not close. Project evidence is cited by path; everything else by URL.

## Verdict

Internet-carried Sessions work with the stack as it is today. Each Peer connects to the Host directly where the two carriers' NATs allow it, and through the TURN Relay otherwise. Nothing in the evidence suggests the iPhone-hotspot failure (a direct path that connects and then goes silent one way) happens on this path. The hotspot gives no offline benefit today either: signaling runs over public Nostr relays, so every Device already needs the internet. Three weaknesses carry over or appear. The single reliable, ordered data channel stalls on lossy mobile paths. The Relay's free allowance is unclear. And with four or five Peers, the Host's mobile uplink becomes the bottleneck.

| Option | iOS Safari? | Android? | Needs internet? | Needs install? | Expected latency (Peer↔Host round trip) | Effort | Main risk |
|---|---|---|---|---|---|---|---|
| **A. Own connections, direct WebRTC, today's TURN Relay as fallback** (a new instruction to players, no code) | Yes | Yes | Yes, every Device | No | Direct: 53–73 ms seen in project logs. Relay: 84–98 ms seen (on the hotspot path) | None to ship; one phone run to measure | The Relay quota (20 GB or 500 MB, §2); 0.15–1 s stalls on the reliable channel (§4) |
| **B. A, with Cloudflare Realtime TURN and a credential minted per Session by a Worker** | Yes | Yes | Yes | No | About the same as A `[INFERENCE]` | Small: one Worker endpoint and one fetch before joining | One more moving part; credentials last 48 h at most |
| **C. A or B, plus an unreliable lane for states** (`ordered: false, maxRetransmits: 0`) | Yes (Safari 11+) | Yes | n/a | No | Removes retransmission waits; adds no latency | Small to medium: sequence numbers and a reliable tail | No gain where the Relay leg is TCP/TLS; change-only states need care |
| **D. WebSocket fan-out server** (Durable Objects/PartyServer, Fly.io, a VPS) | Yes | Yes | Yes | No | Both mobile legs, plus the detour through the server's city, plus TCP stalls under loss | Medium: server code and a new transport | TCP head-of-line blocking on lossy links; the free tier counts messages |
| **E. WebTransport to our own server** (datagrams and streams) | iOS/iPadOS 26.4+ only | Chrome 97+, Firefox 114+ | Yes | No | Like D, without head-of-line blocking for datagrams | Medium to high: an HTTP/3 server on a VM, because Workers cannot host it | iPhones below 26.4 are excluded (one logged iPhone runs iOS 18.7); a young Safari implementation |
| **F. Cloudflare Realtime SFU DataChannels** (a WebRTC Relay in the middle) | Yes | Yes | Yes | No | About the same as TURN; each Device reaches its nearest Cloudflare site | High: replace Trystero's star and add a backend for the SFU API | Vendor-specific API; a backend is mandatory |

## 1. Direct WebRTC between phones on mobile data

**Carrier-grade NAT is the norm on mobile, and much of it is the hard kind.**
- More than 90 % of cellular networks (ASes) deploy carrier-grade NAT (CGN). Per network, the most permissive NAT type observed was symmetric in about 40 % of cellular CGN networks and full cone in about 20 %. "Major cellular networks in the US" were among the symmetric ones ([Richter et al., IMC 2016](https://arxiv.org/abs/1605.05606), Netalyzr data from 2014–2015).
- Symmetric mapping breaks the IETF's own rules for CGNs: [RFC 6888](https://www.rfc-editor.org/rfc/rfc6888) REQ-1 requires CGNs to meet [RFC 4787](https://www.rfc-editor.org/rfc/rfc4787), whose REQ-1 is "Endpoint-Independent Mapping" and REQ-9 is hairpinning.
- Unconfirmed / possibly stale: Richter et al. is the newest per-network measurement of mobile NAT types I found. A September 2026 survey of published relay-rate figures also found no newer re-measurement ([LUMND](https://www.lumnd.com/insights/webrtc-turn-relay-percentage/), a secondary source).

**How often a direct path forms.** No published figure is specific to two phones on cellular data.
- Tailscale (October 2025): "well north of 90 %" of its connections end up direct. But "if you have two mobile devices trying to connect peer-to-peer from different cellular networks, there's a good chance they'll have to use DERP", its Relay ([Tailscale](https://tailscale.com/blog/nat-traversal-improvements-pt-1)).
- libp2p/IPFS (2025): hole punching succeeded in 70 % ± 7.1 % of 4.4 million attempts from 85,000+ networks. Success was the same over TCP and QUIC ([Trautwein et al., arXiv 2510.27500](https://arxiv.org/abs/2510.27500)). Those were not phones.
- appear.in (2017): 17.7 % of successful Chrome peer-to-peer calls were relayed: 12.1 % TURN/UDP, 5 % TURN/TCP, under 0.5 % TURN/TLS. That covers all network types ([Hancke](https://medium.com/@fippo/what-kind-of-turn-server-is-being-used-d67dbfc2ff5d)).
- `[INFERENCE]` Plan for the Relay to carry a large, unknown share of Peers. This is a single-digit-percent case only on home Wi-Fi.

**Same carrier against different carriers.**
- Two phones on one carrier often sit behind the same CGN. A server-reflexive pair between them then needs that CGN to hairpin (RFC 4787 REQ-9).
- `[INFERENCE]` Host candidates do not help. Browsers hide them behind mDNS names, which do not resolve across a mobile network, and the addresses behind them are carrier-private anyway.
- Different carriers need both NATs to cooperate. Either way, ICE falls back to the Relay in the same attempt, because the TURN servers are always configured ([running-on-phones.md](../guide/running-on-phones.md)).

**IPv6 may be the bigger lever than NAT traversal.**
- German networks are mostly IPv6-capable. APNIC's per-network table, read 2026-11-11, shows Deutsche Telekom (AS3320) at 80.8 %, Vodafone (AS3209) at 73.2 % and Telefónica Germany (AS6805) at 88.6 %. These figures mix fixed and mobile customers ([APNIC Labs](https://stats.labs.apnic.net/ipv6/DE)).
- libwebrtc, the engine in Chrome on Android, gathers IPv6 candidates by default, on Wi-Fi as well ([`pc/peer_connection.cc`](https://webrtc.googlesource.com/src/+/refs/heads/main/pc/peer_connection.cc)).
- When mDNS hides host candidates, libwebrtc still signals the STUN-reflected address even if it equals the local one ([`p2p/base/stun_port.cc`](https://webrtc.googlesource.com/src/+/refs/heads/main/p2p/base/stun_port.cc)). So a phone's public IPv6 address reaches the other side as a server-reflexive candidate.
- Trystero's default STUN servers are `stun:stun{,1,2}.l.google.com:19302` and `stun:stun.cloudflare.com:3478` (`node_modules/.pnpm/@trystero-p2p+core@0.26.0/node_modules/@trystero-p2p/core/dist/peer.mjs`). All of them had AAAA records on 2026-11-11 (my lookup against 1.1.1.1).
- `[INFERENCE]` Two IPv6 phones need no NAT traversal, only two stateful carrier firewalls that let a simultaneous outgoing exchange through.
- Unconfirmed: whether Safari on iOS gathers IPv6 candidates on cellular, and how German carriers' IPv6 firewalls filter. No project log can tell: all 386 pair records in `docs/liveLogs/` say `"v6":false`, and all of those runs used a hotspot or a LAN.

**Round-trip times.**
- Project logs: direct `srflx ↔ prflx` pairs ran at 53–73 ms ([.scratch/live-test-1/findings.md](../../.scratch/live-test-1/findings.md)). An Android Firefox Host and an iPhone Peer connected over a server-reflexive pair at 60 ms.
- Rohde & Schwarz measured one-way latency on Telekom in Munich (2021). Uplink latency was generally higher than downlink. The best 5G case was under 7 ms one way downlink; the worst 5G case was around 18 ms uplink at 15 Mbit/s. 5G's gain over LTE was mostly in the uplink ([R&S](https://www.rohde-schwarz.com/fr/solutions/critical-infrastructure/mobile-network-testing/stories-insights/5g-nr-and-lte-latency-analysis-in-a-public-network_255963.html)).
- `[INFERENCE]` A phone-to-phone round trip in one country crosses two uplinks, two downlinks and the carriers' cores, so 40–80 ms on LTE/5G is the expected range. The logs agree. No public dataset gives phone-to-phone distributions.

## 2. The TURN Relay

**Metered (used today). The free allowance is ambiguous as of 2026-11-11.**
- The Open Relay page says "The TURN Server provides 20 GB of free TURN Usage every month" ([Metered Open Relay](https://www.metered.ca/tools/openrelay/)).
- The pricing page lists "Free: 500 MB trial — 500 MB monthly TURN usage (ingress + egress)". The next tier is Growth: $99 a month for 150 GB, then $0.40/GB. The page also says "TURN server usage is calculated as both ingress and egress data transfer" ([Metered pricing](https://www.metered.ca/pricing)).
- Metered offers per-project quotas with the actions "notify only, disable credentials, or none" ([Metered TURN](https://www.metered.ca/stun-turn)).
- freetier.wiki (checked 9 Nov 2026, a secondary source) reports the same conflict, and that the consequence of running out is not published ([freetier.wiki](https://freetier.wiki/services/metered-turn/)).
- Unconfirmed: which allowance the maintainer's account has. Its credential points at `standard.relay.metered.ca` on ports 80 and 443, over UDP, TCP and TLS ([.scratch/connectivity-2/issues/01-turn-servers-from-the-build.md](../../.scratch/connectivity-2/issues/01-turn-servers-from-the-build.md)). The dashboard's usage page will answer it.

**Cloudflare Realtime TURN.**
- $0.05 per GB, billed on data from Cloudflare to the phone that holds the allocation. Ingress is free. The first 1,000 GB each month are free and shared with the SFU. STUN is free ([pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/), [TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)).
- Allocations are homed in the nearest data center by anycast. It issues IPv4 relay addresses only and does no TCP relaying towards the other side (RFC 6062). It does accept TCP and TLS from the phone (same FAQ).

**What this project pushes through a Relay** `[INFERENCE: arithmetic]`.
- The state stream measured 18.4–19.5 KB/s of JSON at 60 states a second, about 320 B each ([findings.md](../../.scratch/live-test-1/findings.md)).
- Headers add about 93 B per packet: IPv4 20, UDP 8, DTLS record 13, AES-GCM 24, SCTP 12, DATA chunk 16. The Relay leg adds a 4 B ChannelData header ([RFC 8656](https://www.rfc-editor.org/rfc/rfc8656)). That makes about **25 KB/s Host → Peer** on the wire.
- Back: about 2 KB/s of input, plus one SCTP SACK for every second packet ([RFC 9260](https://www.rfc-editor.org/rfc/rfc9260)), makes about **5 KB/s Peer → Host**.
- Together: about **110 MB per relayed Peer-hour**.
- Metered counts ingress plus egress: about 0.22 GB per relayed Peer-hour.
  - 20 GB is about **90 Peer-hours a month**.
  - A four-phone table whose three Peers all relay gets about **30 table-hours**. With one relayed Peer per table it gets about 90.
  - 500 MB is about 2 Peer-hours.
  - The logged Relay pair was `relay ↔ prflx`, one allocation (the Peer's), in `docs/liveLogs/mgc-XHZE-peer-2026-11-10T23-26-14.txt`. A `relay ↔ relay` pair would count twice again.
- Cloudflare bills only egress to the allocation holder: about 0.09 GB per Peer-hour, so 1,000 GB is about 11,000 Peer-hours. After that it costs about half a cent per Peer-hour.

**Handing credentials to a static site.**
- Today the credential sits in the published bundle (D7 in [.scratch/connectivity-2/spec.md](../../.scratch/connectivity-2/spec.md)).
- Metered: a stolen credential "cannot do anything other than use up your TURN Server quota". Metered recommends expiring credentials created by a backend that holds the secret key ("You should never call this API from the front-end"). The expiry is a hard cutoff, even mid-call. A new credential needs up to 2 minutes to propagate, so mint it ahead of play ([Metered guide](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials/)).
- Cloudflare: the TURN key must stay on a backend. The backend calls `generate-ice-servers` with a `ttl` (at most 48 h); credentials can be revoked and refreshed with `setConfiguration()` ([Cloudflare credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/), [FAQ](https://developers.cloudflare.com/realtime/turn/faq/)).
- `[INFERENCE]` The static-site version is a single Worker endpoint. The Host calls it when it opens a Session and gets a credential that lasts one evening; the QR carries it to the Peers.
  - This bounds the damage a leaked credential can do.
  - It does not authenticate players: anyone can call the endpoint.
  - A per-address rate limit is the cheap guard.

**UDP against TCP/TLS.**
- TURN always relays to the other side over UDP. The phone-to-Relay leg may use UDP, TCP or TLS; TCP exists "because some firewalls are configured to block UDP entirely" ([RFC 8656 §3.1](https://www.rfc-editor.org/rfc/rfc8656#section-3.1)).
- Chrome prefers TURN/UDP over TCP over TLS (local type preferences 2, 1, 0), so TCP carries a call only where UDP fails ([Hancke](https://medium.com/@fippo/what-kind-of-turn-server-is-being-used-d67dbfc2ff5d)).
- On a TCP leg, a lost segment holds back everything after it. The wait is at least one round trip, "commonly … 2*RTT, and another one way trip" ([Gaffer On Games](https://gafferongames.com/post/udp_vs_tcp/)).
- `[INFERENCE]` No data-channel setting above can undo that. A 60 Hz stream on TURN/TCP behaves like a WebSocket.
- Every Relay candidate in the project logs was `proto: udp`.

## 3. A server in the middle

What every server option shares: the Host uploads each state once, and the server copies it to the Peers. Peer to peer, the Host uploads one copy per Peer. That matters for four or five Peers (§6).

**3a. WebSocket fan-out.**
- WebSockets run over TCP, so WebKit's own WebTransport announcement says "head-of-line blocking can cause delays when packets are lost" ([WebKit, Safari 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)).
- Cloudflare Durable Objects run on the Workers Free plan (SQLite-backed only), with 100,000 requests a day and 13,000 GB-s of duration. Over the limit, "further operations of that type will fail" ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)).
  - On the paid plan ($5 a month minimum), incoming WebSocket messages count 20:1 as requests and outgoing messages are free. The Hibernation API avoids duration charges.
  - An object is created near its first `get()` and does not move ([DO data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
- `[INFERENCE]` A Host sending 60 states a second makes 216,000 messages an hour. At 20:1 that is 10,800 requests, so the free day lasts about 9 hours of Host traffic alone.
- Unconfirmed: whether the 20:1 ratio applies to the Free plan's daily limit. The footnote sits in the paid column. If it does not apply, the free day ends after about 28 minutes.
- PartyKit's hosted platform shut down on 23 October 2026. PartyServer, the same model, runs on your own Cloudflare account, the free plan included ([PartyKit](https://blog.partykit.io/posts/hosted-platform-shutdown)).
- Fly.io has no free allowance beyond a $1 trial. A shared-cpu-1x 256 MB machine costs $2.19 a month in Ashburn and $2.53 in Frankfurt; egress in Europe costs $0.02/GB; "invoices under $5 are waived" ([Fly.io pricing](https://fly.io/pricing)).
- `[INFERENCE]` Latency is both mobile legs plus the detour to the server's city: probably 5–20 ms more than a direct path within Germany, plus TCP stalls under loss.
- What the maintainer runs: a Worker and a Durable Object (or a VM), its deploys, and its monitoring.

**3b. WebTransport.**
- Safari 26.4 (24 March 2026) added WebTransport with streams and datagrams. It "can run over HTTP/2 and TCP as a fallback" where QUIC is blocked ([WebKit](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)).
- MDN's compatibility data lists Safari 26.4, Chrome 97 and Firefox 114, iOS mirroring Safari ([BCD `WebTransport.json`](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json)).
- Apple: 79 % of all iPhones ran iOS 26 on 7 June 2026, with no split by point release ([Apple](https://developer.apple.com/support/app-store/)). The project's own logs include an iPhone on iOS 18.7, which has no WebTransport.
- Cloudflare Workers cannot terminate WebTransport. Their protocol list has none ([Workers protocols](https://developers.cloudflare.com/workers/reference/protocols/)), and a maintainer said in March 2026 that it is "not currently on our priority list" ([workerd #6451](https://github.com/cloudflare/workerd/issues/6451)). So this option means our own HTTP/3 server on a VM with a certificate.
- Cloudflare's MoQ relays speak QUIC and are "free to use during the beta period". They implement drafts 14 and 16 of a media protocol ([Cloudflare MoQ](https://developers.cloudflare.com/moq/)), which is not a fit for game state today `[INFERENCE]`.
- An open WebKit bug reports permanent stalls with many incoming unidirectional streams ([WebKit 317084](https://bugs.webkit.org/show_bug.cgi?id=317084); I did not check its status).

**3c. Cloudflare Realtime SFU DataChannels.**
- A publisher creates a named channel that many subscribers receive. At most one subscriber can reply on it, so each Peer would publish its own input channel ([DataChannels](https://developers.cloudflare.com/realtime/sfu/features/datachannels/), [limits](https://developers.cloudflare.com/realtime/sfu/platform/limits/)).
- Since 13 August 2026 it supports `ordered: false, maxRetransmits: 0`, which Cloudflare recommends for "Replaceable state" ([changelog](https://developers.cloudflare.com/changelog/post/2026-08-13-datachannels-reliability-ordering/)).
- Authenticated API calls come from a backend. Pricing is as for TURN: ingress is free and egress shares the 1,000 GB free tier. Cloudflare says SFU and TURN "share the same data path" with "no meaningful latency or throughput penalty" ([TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)).
- What the maintainer runs: a Worker holding the app secret that creates sessions and channels. Trystero's star is replaced for the game traffic.

## 4. Unreliable delivery for the state stream

**Support.** `ordered`, `maxRetransmits` and `maxPacketLifeTime` have been in Safari since 11, with iOS mirroring it, and in Chrome and Firefox ([BCD `RTCDataChannel.json`](https://github.com/mdn/browser-compat-data/blob/main/api/RTCDataChannel.json)). Safari 26.4 fixed `[EnforceRange]` on the last two ([WebKit](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)).

**Message size.** libwebrtc's SCTP stack defaults to `max_message_size = 256 * 1024` ([`dcsctp_options.h`](https://webrtc.googlesource.com/src/+/refs/heads/main/net/dcsctp/public/dcsctp_options.h)). A 320 B state fits one packet, so losing a packet loses one state, not part of one `[INFERENCE]`.

**Through TURN.** Over TURN/UDP the Relay forwards datagrams, and SCTP's partial reliability works end to end inside DTLS `[INFERENCE from the layering in RFC 8656]`. Cloudflare's SFU supports the same policy (above). Over TURN/TCP or TLS it gains nothing (§2).

**Why the reliable channel stalls.**
- SCTP retransmits early only after three miss indications. Otherwise it waits for its timer, and [RFC 9260](https://www.rfc-editor.org/rfc/rfc9260) recommends `RTO.Min` of 1 second.
- libwebrtc's dcSCTP uses `rto_min = 400 ms`, `delayed_ack_max_timeout = 200 ms` and `min_rtt_variance = 220 ms` ([`dcsctp_options.h`](https://webrtc.googlesource.com/src/+/refs/heads/main/net/dcsctp/public/dcsctp_options.h)).
- `[INFERENCE]` A lost state that the next ones cannot reveal (a burst, or a lost SACK) therefore waits 400 ms or more, and every later state waits behind it.
- The logged Relay run fits: 7 of the 38 seconds of its Match had a `gap` above 150 ms (151–455 ms); the median per-second `ageAvg` was 68 ms (`mgc-XHZE-peer-2026-11-10T23-26-14.txt`, my count).
- The project's trigger for building the lane is "`gap` above 150 ms in more than 1 % of the seconds of a Match on a link whose `link` lines stay `ok`" (D6 in [spec.md](../../.scratch/connectivity-2/spec.md)). This run had 18 %, and both phones' `link` lines read `ok` from 23:25:16 to the Match's end (the `weak` lines of that log belong to the direct attempts before the Relay took over; checked by the maintainer's agent against both logs). The rule is met on the Relay path.
- Unconfirmed: whether Safari uses dcSCTP or usrsctp, and with which minimum timer.

**Guidance.** Glenn Fiedler: for player input and positions "the game only cares about the most recent data", so "never use TCP when networking time-critical data" ([Gaffer On Games](https://gafferongames.com/post/udp_vs_tcp/)). Cloudflare: send replaceable state with `ordered: false, maxRetransmits: 0`, and "use application timestamps or sequence numbers to discard stale updates" ([DataChannels](https://developers.cloudflare.com/realtime/sfu/features/datachannels/)). A reliable, ordered channel suits only discrete commands.

## 5. Clock synchronisation over mobile paths

**Need.** At 300 mm/s, 10 ms of clock error puts the ball 3 mm off. `[INFERENCE]` What shows at a seam is the difference between the errors of the two neighbouring Devices: two Peers offset in opposite directions add up.

**Bound.**
- An NTP-style exchange cannot be off by more than half the round trip. RFC 5905's "synchronization distance" `λ = δ/2 + ε` "represents the maximum error due all causes" ([RFC 5905](https://www.rfc-editor.org/rfc/rfc5905)). The actual error is half the asymmetry between the two directions.
- NIST: on wide-area networks "the delay asymmetry … is usually the dominant source of error", limiting NTP there to about a millisecond ([NIST](https://tf.nist.gov/general/pdf/2776.pdf)).

**Our estimator.** It keeps 16 samples, drops those more than 2 ms above the window's minimum round trip, and takes the median offset. It samples in a burst of ten and then once a second ([`packages/core/src/clock.ts`](../../packages/core/src/clock.ts)).
- Worst case direct (minimum round trip 53–73 ms): at most 27–37 ms, or 8–11 mm.
- Worst case through the Relay (84–98 ms): at most 42–49 ms, or 13–15 mm.

**Mobile asymmetry.**
- Uplink is slower than downlink on LTE and 5G ([R&S](https://www.rohde-schwarz.com/fr/solutions/critical-infrastructure/mobile-network-testing/stories-insights/5g-nr-and-lte-latency-analysis-in-a-public-network_255963.html)).
- `[INFERENCE]` Host → Peer crosses the Host's uplink and the Peer's downlink; Peer → Host crosses the other two. So the radio asymmetries largely cancel when both phones sit on similar links, giving a few ms (1–3 mm). They add up when one phone is on 5G outdoors-grade signal and the other on weak LTE indoors. Nobody has measured this on our paths.
- Unfiltered samples are useless on cellular. SNTP over 4G showed a mean offset of 192 ms (sd 55 ms, maximum 840 ms). Filtering on channel conditions reached 25 ms ([MNTP, IMC 2016](http://ix.cs.uoregon.edu/~ram/papers/IMC-2016.pdf)). Our minimum-round-trip filter is the right kind of tool.

**Risks** `[INFERENCE]`.
- After a path change (direct to Relay, or a cell handover), old minimum-round-trip samples persist for up to 16 s and hold a stale offset.
- Clock pings ride the same reliable, ordered channel, so stalls inflate their round trips. The filter discards those samples, which leaves fewer good ones.

## 6. Cost and failure modes for players

**Mobile data** `[INFERENCE: §2 arithmetic]`.
- A Peer uses about 110 MB an hour (90 MB down, 20 MB up).
- A Host uses about 110 MB an hour per Peer. With five Peers that is about 550 MB an hour, 460 MB of it upload. Nostr signaling comes on top; I did not measure it.

**The Host's uplink.**
- Five Peers need about 1.0 Mbit/s up.
- Ookla's Germany report for Q1–Q2 2026 gives 10th-percentile uploads of 5.12 Mbit/s (Telekom), 1.40 (Vodafone), 1.36 (O2) and 1.23 (1&1); the medians are 28.8, 12.0, 12.7 and 11.3 ([Ookla](https://www.ookla.com/s/media/2026/07/Q1Q2-26-Germany-Fastest-Mobile-Network-Report.pdf)). So one test in ten on three networks would leave a five-Peer Host no headroom.
- The same report's median loaded latency, measured while a test fills the link, is 504–711 ms down and 305–852 ms up. `[INFERENCE]` A photo backup running on the Host queues the state stream behind it.

**Indoors.**
- High-band TDD uplinks are power-limited, and networks lean on low-band FDD spectrum for uplink ([stadium study, arXiv 2604.04371](https://arxiv.org/abs/2604.04371)).
- R&S saw mean round trips above 100 ms while moving ([R&S](https://www.rohde-schwarz.com/fr/solutions/critical-infrastructure/mobile-network-testing/stories-insights/5g-nr-and-lte-latency-analysis-in-a-public-network_255963.html)).
- `[INFERENCE]` A phone lying flat in a living room falls back to LTE or low-band 5G, and jitter rises. The Host is the Device to put near a window.

**Roaming.**
- Roaming adds about 60 ms or more, depending on distance, because traffic is routed through the home network (16 networks in 6 countries; [Mandalari et al., MobiCom 2018](https://vaibhavbajpai.com/documents/papers/proceedings/roaming-mobicom-2018.pdf)).
- Roam-like-at-home in the EU is valid until 2032, subject to fair use ([Regulation (EU) 2022/612](https://eur-lex.europa.eu/eli/reg/2022/612/oj)). Outside the EU, players' own tariffs apply.

**Other failure modes.**
- A Device switching between Wi-Fi and cellular loses its path. Cloudflare recommends supporting ICE restart ([TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)).
- A Device without mobile data still needs Wi-Fi or someone's hotspot.
- Safari 26.4 adds "network slicing support for WebRTC" on iOS ([WebKit](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)). It depends on the carrier and is not something to rely on.

## What I could not find out

- **Direct-path share for two phones on cellular, 2024–2026.** No public measurement exists. The newest per-network NAT data is from 2014–2015 (Richter et al.). The project's `ice` lines (pair types, `v6`) can measure it in one phone run.
- **Whether iPhones use IPv6 between each other on cellular** (Safari's candidate gathering, carrier IPv6 firewalls). Every project log so far is IPv4.
- **Which Metered allowance applies** to the maintainer's account (20 GB or 500 MB), and what Metered does at the limit.
- **Safari's SCTP stack and its minimum retransmission timer.**
- **The share of iPhones on iOS 26.4 or later.** Apple publishes only major versions.
- **Phone-to-phone round-trip distributions in Germany.** I found only one-way measurements to a server (R&S 2021) and the project's own handful of pairs.
- **The actual clock error on mobile paths.** It needs a ground truth, for example two phones filmed flashing at the same shared time.
- **Whether Durable Objects' 20:1 message ratio applies to the Free plan.**

## Recommendation

**Yes: with a working TURN Relay, "every phone on its own connection, no hotspot" is already the better default instruction.** The alternatives in rank order: stay on your own mobile data or the venue's normal Wi-Fi; use a hotspot only for a Device that has no data, and never make the hotspot phone the Host.
- The iPhone hotspot as Host loses the direct path on about 80 % of attempts. It reaches the Relay only after three failures, 19–20 s after page load. Its Relay path then crosses the Host's mobile link twice for every byte (the established real-phone logs).
- On separate connections, ICE either finds a direct pair or picks the Relay in the same attempt. No logged run shows the hotspot's one-way silence on such a path. Direct round trips were 53–73 ms ([findings.md](../../.scratch/live-test-1/findings.md)).
- The costs are real but bounded: about 110 MB an hour per Peer, about 110 MB an hour per Peer for the Host, and a large Relay share on mobile networks (Richter 2016, Tailscale 2025).
- Before telling players, do one thing: confirm the Metered allowance. At 500 MB it lasts about 2 Peer-hours. At 20 GB it lasts about 90.

**The next thing to build: an unreliable lane for states.** Open a second, negotiated data channel with `ordered: false, maxRetransmits: 0` on the existing `RTCPeerConnection`, with a sequence number per state and a periodic full state on the reliable channel as the tail.
- It targets the one quality problem measured on an internet path: 18 % of Match seconds with 151–455 ms gaps through the Relay.
- Those gaps match reliable, ordered SCTP with a 400 ms retransmission floor ([dcSCTP](https://webrtc.googlesource.com/src/+/refs/heads/main/net/dcsctp/public/dcsctp_options.h)).
- It works in every browser the project supports ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/RTCDataChannel.json)), on direct pairs and over TURN/UDP.
- It needs no new service, and it carries over unchanged if the project later moves to an SFU, where Cloudflare recommends exactly this setting for replaceable state ([Cloudflare](https://developers.cloudflare.com/changelog/post/2026-08-13-datachannels-reliability-ordering/)).

The two next steps after that, in this order:
1. A Worker that mints short-lived Cloudflare TURN credentials (1,000 GB free a month against about 0.09 GB per Peer-hour), if the Metered allowance proves to be small.
2. SFU fan-out, only if runs with four or five Peers show the Host's uplink saturating.
