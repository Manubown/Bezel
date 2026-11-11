# Not depending on one provider: redundancy, a native app, a pocket device

As of 2026-11-11. The makers' position: the TURN Relay (Metered, free plan) works, and a whole test evening used about 6 MB, so it is fine for now. But they do not want to depend on one provider. They consider a native app for better connecting, and later a small device in a pocket that makes connecting to friends faster.

This report builds on the five reports in `docs/research/` (start with [README.md](README.md)) and on `.scratch/live-test-1/findings.md` §1f–1g. It cites them by path and does not repeat them. Words as in `GLOSSARY.md`: Session, Device, Host, Peer, Tile, Relay. `[INFERENCE]` marks my own reasoning or arithmetic, not a source or a measurement. Prices were checked on 2026-11-11 unless another date is given. "excl. VAT" is stated where the source says so.

## Bottom line

- **This week, 0 €, 1–2 hours, no code: add a second TURN provider from another company** to the same `MGC_TURN_SERVERS` array. ExpressTURN's free plan (1,000 GB a month, a fixed username and password) is the only one I found that needs no server. Browsers skip a dead server, and with Trystero's trickle ICE it costs no time (§1.2).
- **This week, 0 €, half a day: pin the Nostr signaling relays.** The app uses the same five relays every time, picked by chance from its `appId`; on 2026-11-11 two of them were down, and one rate-limited the phones in run 5 (§1.1, §1.4).
- **Next, about 11 USD a year, 1 day: an own domain**, with GitHub Pages behind it and Cloudflare Pages as a second host. The domain, not the mirror, is what lets the host change without losing Home Screen installs and stored data. Do it before installs grow (§1.5).
- **Minimal redundancy set: 0 € a month plus the domain.** Short-lived TURN credentials from a free Cloudflare Worker, own signaling, and an own TURN server (5–7 € a month) wait until there is a reason (§1.6).
- **Native app: not now.** A Capacitor or Tauri wrapper uses the same WebKit WebRTC as Safari and does not fix the iPhone hotspot. A Host-only app with native WebRTC probably would (read from Google's source, never tested): 5–8 person-weeks plus 99 USD a year (Apple) and 25 USD once (Google) (§2). First phone-test the `withhold` fail-safe already committed (`5a69966`) and the no-hotspot instruction.
- **Pocket device: prototype it this weekend as a 42 € travel router** (GL.iNet Opal) with a Wi-Fi QR sticker and an NFC sticker for the app. It helps only if its Wi-Fi gives the phones internet, because browsers use only the default route for WebRTC (§3.1). A pocket router with battery and 4G already exists (GL.iNet Mudi V2, 140–170 USD).
- **A custom ESP32-C5 device** costs about 11–25 USD in parts, but 2,500–8,000 € in EU tests alone before the first sale (radio, EMC, safety and the EN 18031 cybersecurity rules in force since August 2025), more with FCC tests and a mould, plus German registrations and the Cyber Resilience Act from December 2027 (§3.3). Skip it until strangers ask to buy one.
- **Do not do now:** a wrapper-only app, App Clips (no local networking), Wi-Fi Aware (no iPhone↔Android link shown), Bluetooth, an own TURN server, own hardware.
- **Single next step: the second TURN provider** (§4).

## 1. Every outside dependency of a Session today, and a second source for each

### 1.1 The list, read from the code

| # | Dependency | Where it is set | Needed for | What happens when it fails | Second source |
|---|---|---|---|---|---|
| 1 | **GitHub Pages** hosts the app at `manubown.github.io/Bezel/` (and `/stable/`) | `.github/workflows/pages.yml`. There is no service worker ([running-on-phones.md](../guide/running-on-phones.md), "There is no service worker") | Every page load on every Device, Home Screen launches included | Nobody can open the app or reload it. A Session already running keeps going until a page reloads `[INFERENCE]` | An own domain with a second host behind it (§1.5); a service worker for repeat visits |
| 2 | **GitHub Actions** builds and deploys; the repository secret `MGC_TURN_SERVERS` holds the TURN credential | `pages.yml`, `scripts/setup-turn.sh` | Each release | No new release; the live site stays as it is | A second deploy target (Cloudflare Pages builds from the same repository) |
| 3 | **Five public Nostr relays** carry signaling (Trystero's default `nostr` strategy). The five are picked from a list of 29 by shuffling with the `appId` as the seed, so this app always gets the same five: `relay.nostr.blockhenge.com`, `relay.flashapp.me`, `relay.nostrmap.net`, `relay.bullishbounty.com`, `relay.novospes.com` | `packages/core/src/trystero-transport.ts` passes no `relayConfig`; defaults in `@trystero-p2p/nostr` (`defaultRedundancy = 5`, list at lines 258–288) and `getRelays` in `@trystero-p2p/core/dist/utils.mjs` line 45. I computed the five with that code | Every join, and every rejoin after a `reset()` (each failed direct attempt, each switch to the Relay) | **On 2026-11-11 only 3 of the 5 accepted a connection from my machine**: `relay.flashapp.me` answered HTTP 503, `relay.bullishbounty.com` HTTP 522 (my probe). In run 5 `relay.nostrmap.net` rate-limited both phones (`max 30 events/60s`, findings §1f). If all five fail, no Device can join or rejoin. Data channels that are already open keep working, because game data never touches the relays ([Trystero README](https://github.com/dmotz/trystero#how-it-works)) | Pin a list of relays, add an own relay, or add a second strategy (§1.4) |
| 4 | **STUN**: `stun.l.google.com`, `stun1`, `stun2` (port 19302) and `stun.cloudflare.com:3478` | Trystero defaults (`@trystero-p2p/core/dist/peer.mjs` line 378); kept because the app passes TURN through `turnConfig`, not `rtcConfig.iceServers` | Server-reflexive candidates: the direct path between phones on different networks | Same-network tables (hotspot, router) keep working on host and peer-reflexive pairs. Phones on their own mobile data lose their direct pairs, and more of them go through the Relay. A TURN allocation does not replace STUN here: libwebrtc adds only the `relay` candidate from it ([`turn_port.cc`, `OnAllocateSuccess`](https://webrtc.googlesource.com/src/+/refs/heads/main/p2p/base/turn_port.cc)) | Already two companies. A self-hosted TURN server answers STUN too (§1.3) |
| 5 | **TURN Relay**: Metered, `standard.relay.metered.ca`, four URLs (ports 80 and 443, UDP, TCP, TLS), one credential made in the dashboard and built into the published JavaScript | `apps/pwa/src/turn.ts`; `VITE_MGC_TURN_SERVERS` in `main.ts` lines 69–72; escalation in `packages/core/src/relay-escalation.ts` | Only where the direct path fails: 7 of 8 hotspot attempts in run 5 (findings §1f), and a large share of phones on mobile data ([internet-carried-sessions.md](internet-carried-sessions.md) §1) | A Peer goes relay-only after 3 failures. If no connection comes up within 20 s (`RELAY_PROBE_MS`) it goes back to trying every path, fails 3 more times, and so on: the hotspot table never connects. Metered's quota actions can "disable credentials" ([internet-carried-sessions.md](internet-carried-sessions.md) §2) | A second provider in the same array (§1.2), later self-hosted (§1.3) |
| 6 | **The Trystero library** (`trystero@^0.26.0`, one maintainer, MIT) | `packages/core/package.json` | Build time only | Nothing breaks at run time. The risk is a breaking change or abandonment `[INFERENCE]` | It is MIT and can be vendored; its relay and strategy formats are documented (§1.4) |
| 7 | **The phones' own internet** (mobile data or Wi-Fi) | – | Page load, signaling, Relay | No join at all | Offline signaling (roadmap M5) or a pocket device that does signaling (§3) |

Nothing else at run time: the QR code is drawn on the phone (`qrcode` package, `apps/pwa/src/hud.ts` line 133), and `apps/pwa/src` contains no other external URL (my search for `http(s)://` and `ws(s)://`).

**Two facts that make redundancy easy.**
- The Trystero room is found by `appId` and room code only. The topic is the SHA-1 of `Trystero@<appId>@<roomId>` (`@trystero-p2p/core/dist/strategy.mjs` lines 39–41); the page's address plays no part. A Host on a mirror and a Peer on GitHub Pages meet in the same room `[INFERENCE from that code]`.
- The QR code carries the Host page's own address (`new URL(location.href)`, `hud.ts` line 127). Peers always load the same host and the same build as their Host.

### 1.2 TURN: several providers in one array

**What browsers do with several TURN servers.**
- The spec requires browsers to accept at least 32 ICE servers and to ignore any above their limit ([W3C webrtc-pc](https://w3c.github.io/webrtc-pc/)). Chrome caps STUN and TURN at 32 each ([`ice_server_parsing.cc`](https://webrtc.googlesource.com/src/+/main/pc/ice_server_parsing.cc)).
- A server that is down or refuses the credential fires `icecandidateerror`, once per server URL, with the server's STUN error code (401 for a refused credential) or 701 when it cannot be reached ([W3C webrtc-pc](https://w3c.github.io/webrtc-pc/)). "Each provided server is tried until a connection is established" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidateerror_event)).
- A dead server costs no time with trickle ICE: checks start while gathering goes on ([RFC 8838](https://www.rfc-editor.org/rfc/rfc8838.txt)). Trystero trickles by default. Without trickle it would wait up to 15 s per offer for a `relay` candidate ([Trystero `peer.ts`](https://raw.githubusercontent.com/dmotz/trystero/main/packages/core/src/peer.ts)). libwebrtc gives up on an unreachable server after 39.75 s ([`stun_request.h`](https://webrtc.googlesource.com/src/+/main/p2p/base/stun_request.h)), so code that waits for gathering to complete would wait that long.
- **Firefox complains already today.** It counts every STUN/TURN URL and at five or more logs "Using five or more STUN/TURN servers slows down discovery" ([Firefox source](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/PeerConnection.sys.mjs)). Trystero's 4 STUN URLs plus Metered's 4 TURN URLs make 8. Mozilla's reason in 2017 was "the combinatorial explosion of candidate pairs" ([bug 1322659](https://bugzilla.mozilla.org/show_bug.cgi?id=1322659)). Chrome warns only in its native log, above 32; Safari's limit I did not check.
- In relay-only mode (`iceTransportPolicy: 'relay'`) a Device gathers a `relay` candidate from every provider that answers and ICE picks a working pair `[INFERENCE from ICE]`. So the escalation in `relay-escalation.ts` needs no change.

**Credential lifetimes and free allowances.**

| Provider | Free allowance | Long-lived credential that needs no server | Short-lived credential | Longest lifetime | Notes |
|---|---|---|---|---|---|
| **Metered** (today) | 20 GB or a 500 MB trial a month, ambiguous ([internet-carried-sessions.md](internet-carried-sessions.md) §2) | Yes: a credential made in the dashboard has no expiry field. API credentials do not expire if `expiryInSeconds` is left out ([Metered API](https://www.metered.ca/docs/turn-rest-api/project/post-create-project-turn-credential/), [dashboard guide](https://www.metered.ca/docs/turn-server-service/creating-turn-credentials/)) | REST API with the secret key, "never call this API from the front-end" | No maximum stated | Expiry cuts calls in progress. A new credential needs up to 2 minutes to work. The free plan caps the number of credentials (number not published) ([expiring credentials](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials/)) |
| **Open Relay** (Metered) | 20 GB a month, free signup and API key ([Open Relay](https://www.metered.ca/tools/openrelay/)) | No longer: the static `openrelayproject` login is gone, and `openrelay.metered.ca` resolves to the documentation address `192.0.2.1` | – | – | Same company as Metered, so **not** a second source |
| **Cloudflare Realtime TURN** | 1,000 GB a month, then 0.05 USD/GB ([internet-carried-sessions.md](internet-carried-sessions.md) §2) | No: the key must stay on a backend | `generate-ice-servers` with `ttl` | 48 h | Needs a Worker (§1.3) |
| **ExpressTURN** | 1,000 GB a month, UDP and TCP on port 3478 only ([expressturn.com](https://www.expressturn.com/)) | Yes: a dashboard username and password that last until you press "Refresh Credentials" | Shared-secret auth in Premium only (9 USD/month, 5,000 GB, TLS, ports 80/443) | – | No German location; which locations the free plan gets is not stated |
| **Twilio** | None; 0.40 USD/GB in Europe (Germany) ([pricing](https://www.twilio.com/en-us/stun-turn/pricing)) | No | Tokens API with key and secret | 24 h ([API](https://www.twilio.com/docs/stun-turn/api)) | Needs a server or Worker |
| **Xirsys** | 500 MB a month after a 30-day trial, a hard cap; next plan 39 USD/month for 50 GB ([pricing](https://xirsys.com/pricing)) | Static credentials only on paid plans after the trial | `_turn` API | 6 h, default 60 s ([API](https://docs.xirsys.com/api/turn)) | Expiry does not end a call in progress |
| **Turnix.io** | 10 GB a month, "trial regions" ([turnix.io](https://turnix.io/)) | Not stated | REST, server-side | Not stated | Has a Karlsruhe region |

**What follows.**
- ExpressTURN is the only second company I found that works today with **no code and no server**: paste its server into the same array. Its gap: no TLS and no port 443 on the free plan, so on networks that block UDP and port 3478 only Metered's 443 entries remain. That is fine for a second source.
- At 6 MB an evening every free tier above is far from its limit. A second provider costs nothing until the app has many strangers on it.
- A public, never-expiring credential can be spent by anyone who reads the JavaScript. The damage is bounded by each provider's free cap: the credential stops working, and the wizard makes a new one (`scripts/setup-turn.sh`, "If that happens, delete the credential…").
- To stop Firefox's warning and save checks, keep two URLs per provider (one UDP, one TLS on 443) and pass the whole list yourself through `rtcConfig.iceServers`: two STUN servers (one Google, one Cloudflare) plus the TURN entries. That list replaces both Trystero's four STUN servers and `turnConfig` ([Trystero README, `turnConfig`](https://github.com/dmotz/trystero#joinroomconfig-roomid-callbacks); `@trystero-p2p/core/dist/peer.mjs` lines 17–20).

The setting with two providers, as `turn.ts` already accepts it:

```json
[
  { "urls": ["turn:standard.relay.metered.ca:80", "turns:standard.relay.metered.ca:443?transport=tcp"],
    "username": "<Metered username>", "credential": "<Metered password>" },
  { "urls": ["turn:<server from the ExpressTURN dashboard>:3478"],
    "username": "<ExpressTURN username>", "credential": "<ExpressTURN password>" }
]
```

`[INFERENCE]` Copy the exact URLs from each dashboard; the Metered ones above are the four of the maintainer's setup cut to two (`.scratch/connectivity-2/issues/01-turn-servers-from-the-build.md`).

### 1.3 Self-hosted TURN, and where short-lived credentials can come from without a server

**Software.**

| Server | Latest | Short-lived credentials (TURN REST API) | Fit for one small VPS |
|---|---|---|---|
| [coturn](https://github.com/coturn/coturn/releases) | 4.19.0, tagged 2026-11-10; 4.18.0 (2026-09-08) is the last with notes | `use-auth-secret` + `static-auth-secret`; username `expiry:id`, password `base64(HMAC-SHA1(secret, username))` ([README.turnserver](https://raw.githubusercontent.com/coturn/coturn/master/README.turnserver)) | Yes; the reference choice |
| [eturnal](https://eturnal.net/doc/readme.html) | 1.12.3 (2026-09-17) | Yes, plus static credentials | Yes: DEB/RPM for x64 and arm64, Docker, an `-acme` image that fetches its own certificate ([repositories](https://eturnal.net/repositories/)) |
| [Pion TURN](https://github.com/pion/turn) | v5.1.3 (2026-10-24) | Yes (`LongTermTURNRESTAuthHandler`) | A Go library, not a ready server; for a custom device (§3), not for a VPS |
| [STUNner](https://github.com/l7mp/stunner) | – | Yes | A Kubernetes gateway; its docs say you will "rarely need to run `stunnerd` directly". Overkill |

**TLS on 443.** coturn's TLS port is `tls-listening-port` (default 5349) with `cert=` and `pkey=`; there is no special option for 443, you set the port to 443 ([turnserver.conf](https://raw.githubusercontent.com/coturn/coturn/master/examples/etc/turnserver.conf)). `[INFERENCE]` Port 443 cannot be shared with a web server on the same address, so use a VPS of its own or a second IP.

**Abuse protection.**
- Time-limited credentials: the TURN REST draft recommends one day, and an expiry does not end allocations already running, so a Match does not break at midnight ([draft-uberti-behave-turn-rest-00](https://datatracker.ietf.org/doc/html/draft-uberti-behave-turn-rest-00)). It never became an RFC; coturn, eturnal and Pion all implement it.
- Block relaying into private networks: `denied-peer-ip` for 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0/8 and the IPv6 equivalents; quotas `user-quota=100`, `total-quota=10000` ([Enable Security guide, 2026-02-25](https://www.enablesecurity.com/blog/coturn-security-configuration-guide/)). coturn's quotas default to unlimited ([turnserver.conf](https://raw.githubusercontent.com/coturn/coturn/master/examples/etc/turnserver.conf)).

**Where the credential minting can live, with no server of our own.**
1. **A scheduled build.** A GitHub Actions cron job rebuilds the site every few days and computes a REST credential from a secret at build time (coturn/eturnal), or calls Metered's API with an expiry. A leaked credential then lives only until the next build or two `[INFERENCE]`. No runtime code. It works only while there is no service worker caching old builds.
2. **A Cloudflare Worker.** Free plan: 100,000 requests a day, 10 ms CPU per request ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)). Web Crypto in Workers has HMAC and SHA-1 ([Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)), so it can compute coturn credentials, or call Cloudflare's `generate-ice-servers` for Cloudflare TURN. The rate-limiting binding is generally available since 2025-09-19 ([docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)); whether the Free plan has it is not stated. The Host would fetch one credential when it opens a Session ([internet-carried-sessions.md](internet-carried-sessions.md) §2).

**VPS prices** (monthly).

| Offer | Price | Traffic | Notes |
|---|---|---|---|
| Hetzner CPX02, 1 vCPU, 1 GB, Falkenstein/Nuremberg | 6.49 € excl. VAT (5.49 € in Helsinki) + 0.50 € IPv4 | 20 TB, then 1 €/TB | Prices rose on 1 April and 15 June 2026 ([Hetzner](https://www.hetzner.com/cloud/regular-performance/), [IPv4](https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing/)) |
| Hetzner CX23 / CAX11 (2 vCPU, 4 GB) | 5.99 € / 6.49 € excl. VAT | 20 TB | "Not available" to order on 2026-11-11 ([Hetzner](https://www.hetzner.com/cloud/cost-optimized/)) |
| netcup VPS pico, 1 vCore, 1 GB | 2.21 €, 12-month term | Throttled to 100 Mbit/s if the 24 h average exceeds that | VAT label unclear on the page ([netcup](https://www.netcup.com/en/server/vps-lite)) |
| OVHcloud VPS-1, 2 vCores, 4 GB | 4.53 € incl. VAT | Unlimited, 500 Mbit/s | Term not stated ([OVHcloud](https://www.ovhcloud.com/de/vps/)) |
| Oracle Cloud Always Free, Arm | 0 € | 10 TB out | Idle instances "may be reclaimed"; a TURN server is idle most of the time ([Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) |
| DigitalOcean, 512 MiB (US option) | 4 USD | 500 GiB | ([DigitalOcean](https://www.digitalocean.com/pricing/droplets)) |

**Effort** `[INFERENCE]`: about one day the first time (VPS, a DNS name such as `turn.<domain>`, eturnal with its ACME image, firewall for 3478 UDP/TCP, 443 TCP and the relay port range, quotas, a test on Metered's [testing page](https://www.metered.ca/turn-server-testing)). Then about an hour a month for updates. **Worth it** only as the leg that depends on no TURN company, or once free tiers no longer cover the traffic. Cloudflare's 1,000 free GB are about 11,000 relayed Peer-hours ([internet-carried-sessions.md](internet-carried-sessions.md) §2).

### 1.4 Signaling

**Trystero's strategies** (README of 0.26.0, the version in use, published 2026-10-04 per npm): Nostr (the default package), MQTT, BitTorrent, Supabase, Firebase, IPFS, and a **self-hosted WebSocket relay**, `@trystero-p2p/ws-relay`. All use the same API. The README ranks the public ones "in the order of MQTT, BitTorrent, and IPFS, based on robustness" after Nostr ([README](https://github.com/dmotz/trystero#which-strategy-should-i-choose)).

| Strategy | Who runs the servers | Default servers (0.26.0 source) | Free limits | Fit |
|---|---|---|---|---|
| Nostr (today) | Strangers | 29 relays, 5 used at once | None, but rate limits per relay | Good with a pinned list |
| MQTT | Public test brokers | `broker.emqx.io`, `public.cloud.shiftr.io`, `broker.hivemq.com`, `test.mosquitto.org`, 4 at once | Test brokers, no promises `[INFERENCE]` | A fallback, not a second pillar |
| BitTorrent | WebTorrent trackers | 5 trackers, 3 at once | – | Trickle off by default: slower joins (README, `trickleIce`) |
| Supabase | Our free project | – | Paused "after 1 week of inactivity"; Realtime 200 connections, 2 million messages a month ([pricing](https://supabase.com/pricing)) | A hobby app is often idle a week: risky |
| Firebase | Our free project | – | Realtime Database: 100 simultaneous connections on Spark ([pricing](https://firebase.google.com/pricing)) | Works; a Google account dependency |
| ws-relay | Us | none; `relayConfig.urls` required, several allowed | Our own | **Best own option**: the server is about 130 lines of pub/sub with topic and subscription limits ([source](https://unpkg.com/@trystero-p2p/ws-relay@0.26.0/dist/server.mjs)) |

**Using two at once.** Trystero has no room that spans two strategies `[INFERENCE: none in the README's API]`. There are two ways:
- **Same strategy, more relays (no transport code).** Pass `relayConfig: { urls: [...] }` with the working public relays plus one of our own. `urls` replaces the default five ([README](https://github.com/dmotz/trystero#joinroomconfig-roomid-callbacks)), so list the old ones too: every phone loads the same build (no service worker), so there is no mixed-version table. Trystero publishes to all of them and listens on all of them. Our own Nostr relay must accept ephemeral events: Trystero uses kinds 20000–29999 (`topicToKind`, `@trystero-p2p/nostr/dist/index.mjs` line 44).
- **A second strategy as fallback (medium code).** The Host joins its room on both Nostr and ws-relay; a Peer tries Nostr and adds ws-relay if it finds no Host within a few seconds. `TrysteroTransport` would hold two rooms and merge their peers. `[INFERENCE]` 2–4 days with tests; a Peer must never hold two connections to one Host.

**Our own signaling, and what it costs.**
- **ws-relay on a Cloudflare Durable Object** `[INFERENCE: port of the 130-line server]`: 0 € on the Workers Free plan (SQLite-backed objects only, 100,000 requests a day; [internet-carried-sessions.md](internet-carried-sessions.md) §3a). Signaling is a few dozen messages per join plus one announcement a minute per room (README, `createTopicStrategy`), far below the limit. Effort 1–2 days.
- **ws-relay on the TURN VPS** behind Caddy for `wss://`: 0 € extra if the VPS exists; half a day.
- **Own Nostr relay** (strfry or nostr-rs-relay on the same VPS, or nosflare on Workers + D1, which its author recommends on the paid plan) ([strfry](https://github.com/hoytech/strfry), [nosflare](https://github.com/Spl0itable/nosflare)). An open Nostr relay also attracts other people's traffic `[INFERENCE]`; restrict it to kinds 20000–29999.

### 1.5 Hosting and the origin

| Host | Free plan | Fit |
|---|---|---|
| GitHub Pages (today) | 1 GB site, soft 100 GB/month; "not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site … or SaaS" ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | Fine for a free hobby app; read the terms again before selling anything |
| Cloudflare Pages | 500 builds a month, 20,000 files, 25 MiB per file, 100 custom domains per project ([limits](https://developers.cloudflare.com/pages/platform/limits/)); requests for static assets "are free and unlimited" ([Workers static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)) | **The mirror**: same repository, and the TURN Worker can live in the same account |
| Netlify | 300 credits a month; bandwidth 20 credits/GB, a production deploy 15 credits ([pricing](https://www.netlify.com/pricing/)) | About 15 GB a month with few deploys `[INFERENCE: arithmetic]`; tighter |
| Codeberg Pages | Moving to git-pages; the old v2 server stops serving on 2026-12-31; custom domains supported ([Codeberg docs](https://docs.codeberg.org/codeberg-pages/migrating-from-pages-v2/)) | Possible later; in transition now |

**What an origin change costs a PWA.** Browsers keep data per origin (scheme, host, port) ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). Moving from `manubown.github.io` to another host loses: the Device and Player ids in `localStorage` (`apps/pwa/src/device.ts`), the session logs in IndexedDB (`recorder.ts`), and every Home Screen icon, which keeps opening the old address `[INFERENCE]`. Safari's 7-day deletion does not apply to Home Screen web apps ([web-platform-local-connectivity.md](web-platform-local-connectivity.md) §6). Signaling is unaffected (§1.1).

**So the domain is the redundancy, not the mirror.** With `play.<domain>` as the address, the host behind it can change by a DNS edit without changing the origin. A `.com` at Cloudflare Registrar costs 11.17 USD a year (secondary source, checked 2026-11-02, [snazzy.solutions](https://www.snazzy.solutions/blog/hosting/cloudflare-vs-godaddy-domain-pricing)); Cloudflare does not register `.de` ([Cloudflare Community](https://community.cloudflare.com/t/how-can-de-domain-owners-help-cloudflare-prioritize-tld-support/832117)). GitHub Pages takes a custom subdomain by a `CNAME` record and recommends verifying the domain against takeover ([GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)); Cloudflare Pages takes up to 100 custom domains per project (above). The build's `BASE_PATH` changes from `/Bezel/` to `/` (`pages.yml` line 43). Do it before the app has many Home Screen installs: every move later strands them.

**A service worker** would let installed apps start when the host is down, and it is a precondition for offline play (M5) and for the pocket device (§3). Its cost `[INFERENCE]`: cached builds of different ages meet at one table, so the Host must refuse Peers with another protocol version.

### 1.6 The recommended minimal redundancy set

| Order | Step | Removes the single point of | Money | Effort `[INFERENCE]` |
|---|---|---|---|---|
| 1 | ExpressTURN free credential added to `MGC_TURN_SERVERS`, two URLs per provider | Metered (Relay) | 0 € | 1–2 hours, no code |
| 2 | `relayConfig.urls` with the 3 working default relays plus 3–5 well-run public relays, the relay socket states (`getRelaySockets()`) in the session log, and a short own STUN list in `rtcConfig.iceServers` | The five chance relays; Firefox's server warning | 0 € | half a day |
| 3 | Own domain, GitHub Pages behind it, Cloudflare Pages as a second deploy | GitHub Pages and the `github.io` origin | ~11 USD a year | 1 day |
| 4 | Worker that mints Cloudflare TURN credentials (or credentials for our own TURN); drop the public Metered credential to second place | Leaked public credentials; Metered's ambiguous quota | 0 € up to 1,000 GB | 1–2 days |
| 5 | Own signaling: ws-relay on a Durable Object, added as a second strategy, or an own relay added to the list | Strangers' Nostr relays | 0 € | 1–4 days |
| 6 | Own TURN on a VPS (eturnal, TLS on 443, REST credentials from step 4's Worker) | Every TURN company | 5–7 € a month | 1 day + 1 h/month |

**Minimal set = steps 1–3: 0 € a month plus about 1 € a month for the domain.** Steps 4–6 wait until there is a reason: a credential that gets abused, a free tier that runs out, or relays that keep failing in the session logs.

## 2. A native app as the connectivity layer

Settled in [native-nearby-connectivity.md](native-nearby-connectivity.md): Apple's peer-to-peer Wi-Fi is iPhone-only; Wi-Fi Aware between iPhone and Android is not shown working; Bluetooth is too slow for the state stream; an Android-owned local network that iPhones join is the cross-platform path. This section is about the product path: which shell, what an app would actually fix, and what it costs.

### 2.1 Shells around the existing web code

| Shell | Version (2026-11-11) | Where the page runs | WebRTC | Same hotspot problem as Safari? | Effort to a first store build `[INFERENCE]` |
|---|---|---|---|---|---|
| **Capacitor** | 8.6.0 (2026-10-28) ([npm](https://registry.npmjs.org/@capacitor%2Fcore)) | `capacitor://localhost` on iOS, `https://localhost` on Android; `localhost` "allows the use of Web APIs that would otherwise require a secure context" ([config](https://capacitorjs.com/docs/config)) | WKWebView has WebRTC since iOS 14.3 ([WWDC21](https://developer.apple.com/videos/play/wwdc2021/10032/)) | **Yes** `[INFERENCE]`: it is WebKit's WebRTC with WebKit's default-route rule | 1–2 person-weeks |
| **Tauri 2** | 2.12.4; 3.0 in alpha ([npm](https://registry.npmjs.org/@tauri-apps%2Fcli)) | WKWebView on iOS; at 2.0 the team was "not completely happy about the developer experience" on mobile ([Tauri](https://v2.tauri.app/blog/tauri-20/)) | Same as Capacitor | Yes `[INFERENCE]` | 2–3 person-weeks |
| **React Native** + `react-native-webrtc` | 155.0.1 (2026-10-20) ([npm](https://registry.npmjs.org/react-native-webrtc)) | Native UI; the Games draw on canvas and DOM, so they would run in a WebView anyway | Google's libwebrtc, native | No (see §2.2) | 6–12 person-weeks: a second UI stack |
| **Capacitor + own native WebRTC plugin** | – | As Capacitor | libwebrtc, handed to Trystero as `rtcPolyfill`, which Trystero documents for "a custom `RTCPeerConnection`-compatible constructor" ([README](https://github.com/dmotz/trystero#joinroomconfig-roomid-callbacks)) | No (see §2.2) | 4–6 person-weeks for iOS, 1–2 more for Android |

- No maintained plugin gives a WebView a standard `RTCPeerConnection` backed by native libwebrtc. `cordova-plugin-iosrtc` did: its last release is 8.0.4 (2023-04-17) with a 2020 libwebrtc (M87) ([repo](https://github.com/cordova-rtc/cordova-plugin-iosrtc), [npm](https://registry.npmjs.org/cordova-plugin-iosrtc)). The only Capacitor attempt found has 0 stars and its own API ([u12206050/capacitor-webrtc](https://github.com/u12206050/capacitor-webrtc)). So the plugin would be ours.
- A Capacitor plugin itself is small: one Swift class registered in `capacitorDidLoad`, one Kotlin/Java class registered in `MainActivity` ([iOS](https://capacitorjs.com/docs/ios/custom-code), [Android](https://capacitorjs.com/docs/android/custom-code)). The work is the RTCPeerConnection surface Trystero uses, its events, and moving 60 states a second per Peer across the JavaScript–native bridge `[INFERENCE: bridge cost not measured]`. The seam exists: the transport already builds its `rtcPolyfill` by subclassing a base class (`recording(Base, …)` in `packages/core/src/trystero-transport.ts`, `withholdingOwn` in `own-addresses.ts`), so a native-backed class would go underneath them `[INFERENCE]`.
- Do not count on `ws://` from the iOS Capacitor page: in a simulator test (July 2026) a `capacitor://localhost` page never opened `ws://127.0.0.1` ([elizaos #16843](https://github.com/elizaos/eliza/issues/16843)).

### 2.2 What an app can do about the measured iPhone-hotspot failure

The failure: Safari on the hotspot iPhone offers WebRTC only its cellular address ([iphone-hotspot-webrtc.md](iphone-hotspot-webrtc.md), findings §1f–1g). A wrapper does not change that, because WKWebView is the same WebKit. **Native libwebrtc should**:
- Google's network code skips only interfaces named `vmnet`, `vnic`, `vboxnet`, addresses starting with 0, an explicit ignore list, and loopback (the default ignore mask). On iOS, `pdp_ip*` is cellular, `en*` Wi-Fi, and anything else, `bridge100` included, "unknown" but kept ([`network.cc`](https://webrtc.googlesource.com/src/+/refs/heads/main/rtc_base/network.cc), [`peer_connection_interface.h`](https://webrtc.googlesource.com/src/+/refs/heads/main/api/peer_connection_interface.h)). `[INFERENCE]` A native Host app on the hotspot iPhone gathers a host candidate on `172.20.10.1`, and Peers in Safari pair `host ↔ host` with it. **Not tested by anyone I could find.** One caveat: with the optional field trial `WebRTC-Network-UseNWPathMonitor`, interfaces the system's path monitor does not list are dropped ([`objc_network_monitor.mm`](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/objc/native/src/objc_network_monitor.mm)); leave it off.
- The hotspot interface is `bridge100`, subnet `172.20.10.0/28` (iOS's own packet-filter rules, quoted by [VPNShare](https://github.com/AnAgTeam/VPNShare)).
- Apps already serve hotspot clients: **Nothering**, in the App Store (iOS 18+), runs a SOCKS5 server on port 11080 that accepts clients "only from loopback and hotspot (`bridge*`) interfaces" ([repo](https://github.com/devxoul/nothering), [App Store](https://apps.apple.com/us/app/nothering/id6817766239)). **Tether** (sideloaded) runs WireGuard on `172.20.10.1:51820` and serves a page at `http://172.20.10.1` ([repo](https://github.com/viktor-svirsky/tether)).
- **Local Network permission.** Sending UDP to a local address needs it; receiving UDP and accepting TCP do not ([TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)). ICE sends, so the Host app must ask, and Tether's README confirms "iOS blocks its replies to your devices" until it is granted.
- Apple DTS: "avoid trying to create features based on Personal Hotspot. It's a user-level feature, not a developer API" ([forum 702058](https://developer.apple.com/forums/thread/702058)). Building on it can break with any iOS release `[INFERENCE]`.

**Cheapest test** `[INFERENCE]`: a throwaway Swift app with Google's WebRTC package that prints its gathered candidates while Personal Hotspot is on and another phone is joined. One to two days. It answers the one question everything in §2.3 rests on.

### 2.3 Only the Host installs the app; Peers stay in the browser

There is a path, and it keeps the "scan a QR code, no install" promise for everyone but the Host:

1. The Host app is today's web code in a WebView, with native WebRTC behind Trystero's `rtcPolyfill` (§2.1).
2. Signaling stays on the internet (Nostr), because the hotspot gives the Peers internet. Peers load the page from the web address as today.
3. A Peer iPhone joined to the hotspot has Wi-Fi as its default route, so Safari offers its hotspot address ([web-platform-local-connectivity.md](web-platform-local-connectivity.md) §1). With the Host offering `172.20.10.1` (§2.2), the pair is `host ↔ host` on the hotspot LAN.

**What does not work, and why:**
- **The app serves the page to the Peers.** Over `http://172.20.10.1` the page is not a secure context and the app does not start (no service worker, wake lock, `crypto.subtle`) ([table-hub-device.md](table-hub-device.md) §4). Over https it needs a public certificate for a name pointing at `172.20.10.1`, whose private key would ship in every copy of the app and get revoked (same report, "One key per hub").
- **Signaling to the app over `ws://`** from the https page: Safari blocks it as mixed content (same report, §3).
- **Offline**, two more pieces are needed: the PWA cached on every Peer (a service worker, §1.5), and signaling without a server. The Host app could be a WebRTC-direct listener: the Peer's page builds the Host's answer from a QR code holding address, port and certificate fingerprint ([table-hub-device.md](table-hub-device.md) §3). Unconfirmed: that iOS Safari accepts that answer.

### 2.4 iPhone and Android without any infrastructure, November 2026

| Technology | iPhone↔Android | Status, and what is new since `native-nearby-connectivity.md` |
|---|---|---|
| Bluetooth LE (GATT, L2CAP) | Yes | Too slow for 5 Peers (unchanged) |
| Wi-Fi Aware | Not shown | No new evidence after 2026-10-30. The newest Apple thread is about Mac↔Android: "Certainly, it's not supported right now" ([forum 853064](https://developer.apple.com/forums/thread/853064)) |
| Apple peer-to-peer Wi-Fi (`includePeerToPeer`) | No | "only works between Apple devices"; Multipeer Connectivity "was deprecated in 2026" ([TN3151](https://developer.apple.com/documentation/technotes/tn3151-choosing-the-right-networking-api)) |
| Android starts a network, iPhones join | Yes | **New: fixed name and password.** `startLocalOnlyHotspotWithConfiguration` (API 36, Android 16) with `setWifiSsid`/`setPassphrase` (36.1, Android 16 QPR2) ([WifiManager](https://developer.android.com/reference/android/net/wifi/WifiManager), [SoftApConfiguration.Builder](https://developer.android.com/reference/android/net/wifi/SoftApConfiguration.Builder)). Older phones: random credentials, or a Wi-Fi Direct group named `DIRECT-xy…` (API 29) |
| iPhone app joins a network | Yes | `NEHotspotConfiguration` asks the user once. With `joinOnce`, iOS drops the network after 15 s in the background or when the phone sleeps ([joinOnce](https://developer.apple.com/documentation/networkextension/nehotspotconfiguration/joinonce)). An iPad joining an Android 16 local-only hotspot dropped 3.35 s after joining, then rejoined; Apple: "Reports like this are not uncommon" ([forum 854957](https://developer.apple.com/forums/thread/854957)) |
| Android app joins a network | Yes | `WifiNetworkSpecifier`: a system dialog, "does not provide an internet connection", no dialog for the same access point later ([Wi-Fi bootstrap](https://developer.android.com/develop/connectivity/wifi/wifi-bootstrap)). `WifiNetworkSuggestion` only lets the system choose; no immediate join ([suggestions](https://developer.android.com/develop/connectivity/wifi/wifi-suggest)) |

**A catch for every network without internet** `[INFERENCE from the earlier reports]`: a browser offers WebRTC only the address of the default route (Safari, and Chrome on Android before a camera grant; [web-platform-local-connectivity.md](web-platform-local-connectivity.md) §1). On a Wi-Fi without internet, Android keeps mobile data as the default ([table-hub-device.md](table-hub-device.md) §1), and what iOS does is unconfirmed. Browser Peers on such a network may offer their cellular address, the same class of trouble as the hotspot. Two ways out: the network has an internet uplink, or the phones are in airplane mode with only Wi-Fi on (then signaling must be local too).

### 2.5 Joining without an install: App Clips and Instant Apps

- **App Clips** still exist (last updated June 2025). They may join Wi-Fi networks, but "App Clips can't perform local network operations" ([TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)) and have no low-level sockets, which Google's WebRTC needs ([DTS, forum 730454](https://developer.apple.com/forums/thread/730454)). Size limit for QR and NFC launches: 15 MB, or 100 MB with the App Store Connect demo link; the full app must exist in the App Store ([App Clip functionality](https://developer.apple.com/documentation/appclip/choosing-the-right-functionality-for-your-app-clip)). So an App Clip could only join the table's Wi-Fi, which the Camera does from a `WIFI:` QR code without any app ([iphone-hotspot-webrtc.md](iphone-hotspot-webrtc.md), G).
- **Android Instant Apps**: gone since December 2025; Google names no replacement beyond deep links to the full app ([Google Play Instant](https://developer.android.com/topic/google-play-instant)).

### 2.6 Stores, rules and money

- **Apple Developer Program**: 99 USD a year, individuals and organizations alike ([enroll](https://developer.apple.com/programs/enroll/)). The fee waiver is for registered nonprofits, education and government only, "Not … an individual, sole proprietor, or single-person business" ([waiver](https://developer.apple.com/support/membership-fee-waiver/)).
- **Google Play**: 25 USD once ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)); the 12-tester, 14-day closed test and Android's developer verification from 2027 are in [native-nearby-connectivity.md](native-nearby-connectivity.md) §6.
- **App Review** (guidelines updated 2026-10-16, [Apple](https://developer.apple.com/app-store/review/guidelines/)):
  - 4.2: "Your app should include features, content, and UI that elevate it beyond a repackaged website." `[INFERENCE]` A shell that loads `manubown.github.io` invites rejection; bundled code plus native connecting (hotspot Host, Wi-Fi join, offline) is the "app-like" part.
  - 4.7 allows "HTML5 and JavaScript mini apps and mini games" not embedded in the binary, but 4.7.2: "Your app may not extend or expose native platform APIs or technologies to the software without prior permission from Apple"; 4.7.4 asks for an index of them. `[INFERENCE]` This matters once Games load as separate bundles (roadmap M3).
  - 2.5.2: no downloading code "which introduces or changes features or functionality of the app".
- **Google Play** refuses apps whose purpose is to "provide a webview of a website without permission from the website owner" ([policy](https://support.google.com/googleplay/android-developer/answer/9899034?hl=en)); our own site is fine, a thin shell may still fail "Limited Functionality" ([policy](https://support.google.com/googleplay/android-developer/answer/9898783?hl=en)).
- **EU alternative distribution**: since 2026-10-01 the per-install Core Technology Fee is replaced by a 5 % Core Technology Commission on digital sales outside the App Store; notarization is still required for every app ([Apple, DMA](https://developer.apple.com/support/dma-and-apps-in-the-eu/)). Web Distribution needs one of: nonprofit status, a D&B rating, a listing, listed VC money, a 1 million USD letter of credit, an audit, or two years' membership plus an app with over a million installs ([Apple](https://developer.apple.com/support/web-distribution-eu/)). A hobby team qualifies for none `[INFERENCE]`; it gains nothing over the App Store.

### 2.7 Options compared, effort, and when

| Option | Fixes the iPhone-hotspot Host? | Offline? | Mixed iPhone + Android? | Who installs | Effort `[INFERENCE]` | Money |
|---|---|---|---|---|---|---|
| A. Wrapper only (Capacitor) | No | No | Yes | Optional for all | 1–2 person-weeks | 99 USD/yr + 25 USD |
| B. Host app with native WebRTC, Peers in the browser | Probably (§2.2, untested) | No | Yes | Host only | 5–8 person-weeks (iOS first) | Same |
| C. B plus a WebRTC-direct listener: one QR, no signaling server | Probably | Yes, if Peers have the PWA cached and Safari accepts the answer | Yes | Host only | B + 3–5 person-weeks | Same |
| D. Android Host app with a local-only hotspot; iPhones join by Camera QR | Not needed (no iPhone hotspot) | Only with C's local signaling and Peers in airplane mode: the hotspot has no internet, so browsers may not use it (§2.4) | Needs an Android Host | Android Host | 3–5 person-weeks | 25 USD |
| E. Fully native on both sides (Apple peer-to-peer Wi-Fi, Nearby) | Yes | Yes | **No** | Everyone | 12+ person-weeks | 99 USD/yr + 25 USD |
| F. Wi-Fi Aware | – | – | Not shown | Everyone | – | Watch only |

How the estimates are made `[INFERENCE]`: a store build needs signing, icons, listings, privacy texts and one or two review rounds (about 1 person-week). A WebRTC plugin needs the connection, data channel, ICE and stats surface Trystero and the recorder use (2–3 person-weeks to robust), device testing on several iPhones (1 week), and Android parity (1–2 weeks). A team working evenings runs at perhaps a quarter of full time, so multiply calendar time by about four.

**Recommendation: no app now.** First run the free experiments that may make it unnecessary: no hotspot at all (README experiment 1), an Android phone or a travel router as the network (experiments 2–3), and the Host that withholds its host candidates (README option 4, built as the `withhold` fail-safe in commit `5a69966`, `WITHHOLD_AFTER = 1` in `apps/pwa/src/main.ts`; not yet run on phones). If the iPhone hotspot as Host still fails after that, run the two-day candidate test of §2.2. Only if it shows `172.20.10.1`, and players actually want an app in a store, build B. Skip A: it costs the store fees and fixes nothing.

## 3. The pocket device as a product

[table-hub-device.md](table-hub-device.md) asked which device on the table helps and in which role. This section asks what a device you carry would have to be to sell, which platforms fit, and how to find out cheaply whether it is worth it.

### 3.1 What it has to do, and the browser rules that shape it

Jobs, in order of value `[INFERENCE]`:
1. **Carry its own Wi-Fi network** that iPhones and Android phones join with one tap: a `WIFI:` QR sticker on the device (iPhone Camera since iOS 11, Android Settings; [iphone-hotspot-webrtc.md](iphone-hotspot-webrtc.md), G).
2. **Be the network the browsers use for WebRTC.** Safari, and Chrome on Android before a camera grant, offer only the address of the default route ([web-platform-local-connectivity.md](web-platform-local-connectivity.md) §1). So the device's Wi-Fi must become each phone's default route.
3. **Get the app open**: an NFC sticker with the app's address. Android: Chrome registers for `http`/`https` NFC tags, so the tag opens the browser with no app ([Chromium manifest](https://raw.githubusercontent.com/chromium/chromium/main/chrome/android/java/AndroidManifest.xml)). iPhone XS and later read URL tags in the background, show a notification, and open Safari if no app claims the link ([Apple](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading)). iPhones have no Web NFC.
4. Optional: **signaling on the device**, for play without internet.
5. Optional: forward game traffic (a Relay on the table). Not needed: the load is under 2 Mbit/s for 5 Peers (`[INFERENCE]` from 20 KB/s per Peer).

Joining Wi-Fi from NFC: Android's NFC app handles Wi-Fi tags (`application/vnd.wfa.wsc`) from Android 5.0 through 15 ([AOSP](https://android.googlesource.com/platform/packages/apps/Nfc/+/refs/heads/lollipop-release/src/com/android/nfc/NfcWifiProtectedSetup.java)); Android 16 not checked. Apple's list of tag types for background reading has no Wi-Fi entry ([Apple](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading)); a secondary source says iPhones cannot join Wi-Fi from a tag ([NFCore](https://nfcore.app/guides/iphone-cant-auto-join-wifi-nfc-tag)). So: **QR sticker for the Wi-Fi, NFC sticker for the app.**

**The browser rules, and which design gets around each:**

| Rule (source) | What it forbids | Design that avoids it |
|---|---|---|
| A page over `http://` is not a secure context; the app needs service worker, wake lock, `crypto.subtle` ([table-hub-device.md](table-hub-device.md) §4) | The device serving the app | The app stays on its internet origin; for offline it is cached beforehand by a service worker (§1.5) |
| Safari blocks `ws://` from an https page (same report, §3) | A WebSocket signaling server on the device | Signaling over the internet; offline, WebRTC-direct to the device from a QR code (same report, §3; Safari support unconfirmed) |
| iOS leaves an auto-joined Wi-Fi without internet; a manual join stays; a fake captive portal is "generally a bad idea" (same report, §1) | Silent auto-join of an offline device network | Join by hand (the QR sticker counts as that `[INFERENCE]`), keep the screen awake (the app holds a wake lock) |
| Browsers offer WebRTC only the default route's address ([web-platform-local-connectivity.md](web-platform-local-connectivity.md) §1); on a Wi-Fi without internet Android keeps mobile data as default ([table-hub-device.md](table-hub-device.md) §1) | A Wi-Fi without internet next to mobile data | Either the device gives internet (an uplink), or the phones go to airplane mode with Wi-Fi on |

That leaves **two designs that fit every rule**, and one to test:
- **D1, network with an uplink.** The device's Wi-Fi has internet (venue Wi-Fi repeated, a data SIM, or USB tethering). Phones make it their default route; the app loads from the web; Nostr signaling as today; game traffic stays on the Wi-Fi. **Works with today's code** `[INFERENCE]`.
- **D2, offline island.** The device's Wi-Fi offers a default route but no internet; phones in airplane mode with Wi-Fi on; the app cached; signaling to the device over WebRTC-direct. Needs a service worker, a signaling path, and a WebRTC stack on the device.
- **D3, Wi-Fi without a default route, internet over mobile data.** [table-hub-device.md](table-hub-device.md) §1 proposed it; [web-platform-local-connectivity.md](web-platform-local-connectivity.md) §1 predicts Safari then offers only its cellular address, so no LAN pair forms. The two reports disagree; the `net` field the session log now writes per candidate (findings §1g) settles it in one evening.

### 3.2 Candidate platforms

| Platform | Wi-Fi | Clients as access point | Signaling or WebRTC on the device | Power | Price (one unit) | Verdict |
|---|---|---|---|---|---|---|
| **ESP32-C5** | Wi-Fi 6, 2.4 **or** 5 GHz, "does not mean simultaneous dual-band" ([ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c5/api-guides/wifi-driver/overview.html)); mass production since May 2025 ([Espressif](https://developer.espressif.com/blog/2025/05/news-esp32c5-mp/)) | Up to 15; the example defaults to 4 | `esp_peer` (from libpeer) has data channels and C5 support since v1.2.7; a demo streams to a browser "no external signaling" ([releases](https://github.com/espressif/esp-webrtc-solution/releases), [repo](https://github.com/espressif/esp-webrtc-solution)); how many connections fit in RAM: unknown | RX 87 mA (2.4 GHz) / 110 mA (5 GHz), TX peaks 320 / 408 mA ([datasheet](https://documentation.espressif.com/esp32-c5_datasheet_en.html)); no power save in access-point mode ([ESP-FAQ](https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/wifi.html)) | DevKitC-1 15 USD ([Espressif](https://www.espressif.com/en/products/devkits/esp32-devkitc/overview)) | **Best custom candidate** |
| ESP32-S3 / C6 | 2.4 GHz only (802.11n / Wi-Fi 6) | Up to 15 | As C5 | RX 88 / 78 mA ([S3](https://documentation.espressif.com/esp32-s3_datasheet_en.pdf), [C6](https://documentation.espressif.com/esp32-c6_datasheet_en.html)) | DevKitC 15 / 9 USD | Fine if 2.4 GHz is enough |
| Nordic nRF7002 | Wi-Fi 6 companion chip | Access point "supports a single station", up to eight experimental, Wi-Fi 4 only ([Nordic](https://nrfconnectdocs.nordicsemi.com/ncs/latest/nrf/protocols/wifi/sap_mode/sap.html)) | Needs a host chip | – | ~3.36 USD at 1,000, plus host | No |
| Raspberry Pi Zero 2 W | 2.4 GHz | 7–10 ([table-hub-device.md](table-hub-device.md) §1) | Linux: anything | ~1–2 W `[INFERENCE]` | 15 USD list, sold out | No |
| Radxa ZERO 3W | Wi-Fi 6, a/b/g/n/ac/ax ([Radxa](https://docs.radxa.com/en/zero/zero3)) | Not documented | Linux | 5 V/2 A supply | 20–47 USD, unavailable at all three stores checked | Not now |
| Orange Pi Zero 2W | Wi-Fi 5, dual-band ([Orange Pi](http://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-Zero-2W.html)) | Not documented | Linux | – | ~35–48 USD, patchy stock | Not now |
| Luckfox Pico Zero | Wi-Fi 6, 2.4 GHz ([wiki](https://wiki.luckfox.com/Luckfox-Pico-Zero/)) | Not documented | Linux (small) | – | 46.99 USD, in stock ([Luckfox](https://www.luckfox.com/Luckfox-Pico-Zero)) | Pricier than a router |
| **GL.iNet Opal** (GL-SFT1200) | Dual-band | Router-class; AP isolation is a per-network toggle, off is possible ([GL.iNet docs](https://docs.gl-inet.com/router/en/4/interface_guide/subnet/)) | OpenWrt packages via the Plug-ins page; Docker unsupported | USB-C, from a power bank | 39.99 USD / 41.68 € ([US](https://www.gl-inet.com/en-us/products.json), [EU](https://www.gl-inet.com/en-eu/products.json)) | **The weekend prototype** |
| GL.iNet Beryl AX | Wi-Fi 6 dual-band, mainline OpenWrt | Router-class | Room for Pion (Go) | Under 8 W ([table-hub-device.md](table-hub-device.md) §1) | 98.99 USD / 103.71 € | If D2 is built |
| **GL.iNet Mudi V2** | Dual-band, **4G modem, 7000 mAh battery** ([GL.iNet](https://www.gl-inet.com/en-us/products/gl-e750)) | Router-class | OpenWrt | Battery | 139.99–169.99 USD / 146–179 € | **D1 in a pocket, already for sale** |
| 4G pocket routers (TP-Link M7350 with 2000 mAh, D-Link DWR-932W, …) | Mostly 2.4 GHz `[INFERENCE]` | Not documented; client-to-client forwarding unknown | No | Battery | 29–43 € on Amazon.de ([search](https://www.amazon.de/s?k=mobiler+WLAN+Router+Akku+4G+MiFi)) | Cheap D1 with a SIM, if clients can reach each other |
| TP-Link TL-WR902AC / Cudy TR1200 | Dual-band AC | Router-class | No / OpenWrt-based `[INFERENCE]` | USB | 20.17 € / 35.20 € ([TP-Link](https://www.amazon.de/dp/B01N5RCZQH), [Cudy](https://www.amazon.de/dp/B0BXN86Q7Q)) | Cheaper Opal alternatives |

**Throughput is not the limit**: Espressif's over-the-air lab figure is 20 Mbit/s TCP and 30 Mbit/s UDP for C5, S3 and C6 ([ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c5/api-guides/wifi-driver/wifi-performance-and-power-save.html)), against under 2 Mbit/s for five Peers `[INFERENCE]`. The open question for an ESP32 is the number of phones and of WebRTC connections, not bandwidth.

### 3.3 Battery, bill of materials, certification

**Battery life** `[INFERENCE from datasheets]`:
- ESP32-C5 access point: no power save, so the radio sits at its receive current (87 mA at 2.4 GHz, 110 mA at 5 GHz) plus transmit bursts: about 90–130 mA at 3.3 V on average, 0.3–0.45 W. A 2000 mAh LiPo (7.4 Wh) through a converter at 85–90 % lasts about **15–20 h** at 2.4 GHz and **12–16 h** at 5 GHz. No Espressif figure exists for an access point with clients.
- GL.iNet Opal on a 10,000 mAh power bank (37 Wh): at an assumed 2–4 W, about 9–18 h. Its typical draw is not published.
- GL.iNet Mudi 7 states "Bis zu 13.5h" for its 5150 mAh battery ([GL.iNet](https://www.gl-inet.com/en-us/products/gl-e5800)).

**Bill of materials for an ESP32-C5 pocket hub** (USD per unit) `[INFERENCE: sum; part prices sourced, the rest estimated]`:

| Part | At 100 | At 1,000 | Source |
|---|---|---|---|
| ESP32-C5-WROOM-1-N8R8 module | 4.06 | 3.73 (1,300 pcs) | [LCSC](https://www.lcsc.com/product-detail/C51950749.html), **out of stock** on 2026-11-11 |
| 2000 mAh LiPo (103450) | 2.40 | 2.30 | [supplier listing](https://dtpbattery.en.made-in-china.com/product/bTrUKdXPfFVR/China-Wholesale-103450-Lithium-Batteries-Kc-Certified-3-7V-2000mAh-Rechargeable-Li-Polymer-Lipo-Battery.html) (Adafruit sells one at 10.00) |
| Charger IC (TI BQ24074; TP4056 at ~0.10 is the cheap option) | 1.50 | 1.25 | [LCSC](https://www.lcsc.com/product-detail/C54313.html) |
| Converter, USB-C socket, button, LED, passives | ~1.50 | ~1.00 | `[INFERENCE]`, no source |
| NTAG213 NFC sticker | 0.25 | 0.15 | [ABC RFID](https://www.abcrfid.com/product/13-56mhz-ntag213-18mm-diameter-wet-inlay-thin-tag-round-adhesive-sticker) |
| PCB + assembly | ~3–5 | ~1–1.5 | `[INFERENCE]` from [JLCPCB fees](https://jlcpcb.com/help/article/pcb-assembly-price): 25.56 setup, 0.0016 per joint, 41–164 fixtures; no quote |
| Enclosure | ~3–8 (3D printed, no quote) | ~0.5 + tooling | Tooling 3,000 USD (aluminium prototype) to 12,000–60,000 (steel) ([Enhance PD](https://enhancepd.com/injection-molding-tooling-cost)); "up to $10,000" for 1,000–2,000 small parts ([Xometry](https://www.xometry.com/resources/injection-molding/injection-molding-cost/)) |
| Box, cable, printed QR | ~1–2 | ~1 | `[INFERENCE]` |
| **Total** | **~16–25** | **~11–12 + tooling 3,000–10,000 total** | |

**Certification and registration before the first sale.**
- **EU, Radio Equipment Directive 2014/53/EU**: radio, EMC, electrical safety, RF exposure. A pre-certified module does not certify the product: module compliance is "without prejudice to any new obligations" once built in ([RED Guide](https://www.ancom.ro/wp-content/uploads/2025/11/RED-guide_versiune-publicata-in-5-iunie-2018.pdf)); EMC on the complete product is "mandatory in every case" ([AES Techno](https://www.aestechno.com/en/ce-red-certification-iot)).
- **Cybersecurity under the RED** since 1 August 2025 ([Regulation 2023/2444](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R2444) moving [2022/30](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R0030)): "internet-connected radio equipment … whether it communicates directly or via any other equipment". The harmonised standards EN 18031-1/-2/-3 were cited on 28 January 2025 "with restrictions": no presumption of conformity "if … the user is allowed not to set and use any password" ([Decision 2025/138](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025D0138)). `[INFERENCE]` A unique Wi-Fi password per device, printed on it, and no open admin page.
- **Cyber Resilience Act**: applies from 11 December 2027; its reporting duties (Article 14) from 11 September 2026 ([Regulation 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R2847)). Means security updates and vulnerability handling for the support period `[INFERENCE: summary]`.
- **General Product Safety Regulation** since 13 December 2024 ([2023/988](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0988)).
- **Germany, before selling**: register with stiftung ear under ElektroG §6 ([law](https://www.gesetze-im-internet.de/elektrog_2015/__6.html)), register the battery under BattDG §5 ([law](https://www.gesetze-im-internet.de/battdg/__5.html)), register packaging in LUCID ([register](https://www.verpackungsregister.org/)). Fees not found. Austria not checked.
- **Test cost**: radio + EMC + safety + EN 18031, about **2,500–8,000 €** indicative; 5 GHz adds DFS testing, which a C5 on 5 GHz needs ([LCAS](https://lcas.info/packages/red-wireless-en-300-328-testing-cost/)). About 4–6 weeks with a pre-certified module ([AES Techno](https://www.aestechno.com/en/ce-red-certification-iot)).
- **USA**: with a pre-certified module the label says "Contains FCC ID: …" ([47 CFR 15.212](https://www.ecfr.gov/api/versioner/v1/full/2026-11-01/title-47.xml?part=15&section=15.212)); the product still needs Part 15 Subpart B testing (FCC KDB 996369 D04, read from a search excerpt). Cost: 660 USD at a Chinese lab ([JJR](https://www.jjrlab.com/news/how-much-does-fcc-part-15-b-certification-testing-cost.html)) to 3,000–10,000 USD ([MarkReady](https://markready.io/learn/fcc-certification-cost)).

`[INFERENCE]` Fixed costs before one unit is sold: 2,500–8,000 € for the EU tests alone; about 6,000–28,000 € with US tests (660–10,000 USD) and an injection mould (3,000–10,000 USD). On top: the parts of the first batch (about 1,600–2,500 USD for 100 units, about 11,000–12,000 USD for 1,000), a legal entity and the registrations. Spread over 1,000 units the fixed costs add 3–28 € per unit to the parts, so a retail price near 50 € or more, above the GL.iNet Opal at 41.68 € that already does job 1.

**Comparable gadgets.** GL.iNet Mudi V2, a 4G pocket router with a battery: 139.99–169.99 USD. Kiwix Hotspot, an offline Wi-Fi content box on a Raspberry Pi 5: CHF 260 ([Kiwix](https://get.kiwix.org/en/product/kiwix-hotspot)). JCorp Nomad, an ESP32-S3 stick that "creates a local Wi-Fi hotspot, and serves media through a browser" to several phones: 100–120 USD prebuilt, the closest analogue ([GitHub](https://github.com/Jstudner/jcorp-nomad), [shop](https://nomad.jcorptech.net/products.json)). Flipper Zero: 169 USD ([shop](https://shop.flipperzero.one/products/flipper-zero)). I found no product sold as a local hotspot for multiplayer games.

### 3.4 A staged plan

**(a) A prototype in a weekend, from parts you can buy now.**

| Part | Price | Why |
|---|---|---|
| GL.iNet Opal GL-SFT1200 | 41.68 € (EU store) | Dual-band access point, stock firmware, USB-C |
| USB-C power bank you already own | 0 € | Makes it a pocket device |
| 10 NTAG213 stickers | ~3 € `[INFERENCE: 0.27–0.32 USD each at GoToTags]` ([GoToTags](https://store.gototags.com/nfc-sticker-ntag213-25-mm-circle)) | One with the app's address, one spare |
| A printed `WIFI:T:WPA;S:Bezel-Table;P:<password>;;` QR sticker | 0 € | One-tap join on both platforms |
| Optional: ESP32-C5-DevKitC-1 | 15 USD | Only to test an ESP32 access point with 6 phones (raise `ESP_MAX_STA_CONN` above the default 4) |

Set up: one 5 GHz network, AP isolation off, WPA2 password; write the NFC tag with an NDEF URI record (any NFC writer app). The test, at least 10 joins per configuration with 3–4 phones (iPhone Host, iPhone and Android Peers), every log exported:

1. **Hotspot baseline**: the iPhone hotspot as today (with the `withhold` fail-safe of commit `5a69966`).
2. **D1**: the Opal repeating home Wi-Fi on 2.4 GHz, phones on 5 GHz.
3. **D3**: the Opal without uplink and with an empty DHCP router option (`dhcp-option=3`, [dnsmasq](https://thekelleys.org.uk/dnsmasq/docs/dnsmasq-man.html)), mobile data on.
4. **Join speed**: from phone out of pocket to `ready`, by NFC tag + QR sticker, against scanning the Host's QR on the hotspot.

Read: the `ice` pair types and `net` on both ends, `relay` lines, clock rtt, `tick.state.gap`, and whether iOS stays on the network.

**(b) What would justify going further.**
- D1 gives first-try `host ↔ host` pairs on `private` addresses for every phone, clock rtt median ≤ 15 ms, no `relay` line, and load→`ready` under 3 s in at least 9 of 10 joins: then **document "table mode" with a travel router**. It needs no product, only a guide page and the stickers.
- D3 works too: a device without uplink is enough while phones have mobile data.
- Neither works without internet. Only if people then ask for play without any internet, and ask for it more than once, does D2 (service worker, WebRTC-direct, a stack on the device) become worth weeks of work.
- Custom hardware only if all of these hold: D1 or D2 works; strangers ask to buy a device (for example a sign-up list on the landing page that reaches a few hundred `[INFERENCE]`); and the device does something a 42 € router cannot (battery and one button, live room code on the NFC tag, offline signaling).

**(c) What it would take to sell it.**
- **Cheapest: recommend or bundle an existing router.** A guide plus stickers, or an affiliate link. `[INFERENCE]` Reselling unchanged CE-marked routers keeps the maker's certification with GL.iNet; putting your own brand on them makes you the manufacturer under EU product law (not verified here).
- **Own device**: firmware (access point, DHCP, optionally `esp_peer` signaling), PCB, enclosure, RED tests including EN 18031 and DFS, FCC Part 15B, stiftung ear, battery and packaging registrations, GPSR duties, CRA updates from December 2027, a legal entity, stock to pre-finance. `[INFERENCE]` 3–6 months of evenings and the fixed costs of §3.3 (2,500–28,000 €) plus the first batch, before the first sale.

## 4. Ranked answer

The question: "faster, more reliable connecting to friends without depending on one provider". Ranked by benefit per effort `[INFERENCE]`; "effort" is for this team.

| Rank | Step | Benefit | Effort | Money |
|---|---|---|---|---|
| 1 | **Second TURN provider** (ExpressTURN free) in `MGC_TURN_SERVERS`, two URLs per provider (§1.2) | The Relay rescues 7 of 8 failing hotspot attempts; today one company carries it | 1–2 hours, no code | 0 € |
| 2 | **Phone run of the `withhold` fail-safe** (commit `5a69966`) together with README experiment 1 (no hotspot) | May make hotspot tables connect without the Relay; tells which instruction to give players | One evening | 0 € |
| 3 | **Pinned Nostr relay list** plus relay states in the session log (§1.4) | 2 of the 5 chance relays were down today; every join needs them | Half a day | 0 € |
| 4 | **Travel router weekend** (§3.4 a) | Answers whether "table mode" makes joining fast on any table, and settles D3 | A weekend | ~45 € |
| 5 | **Own domain**, Cloudflare Pages as second host (§1.5) | Hosting can move without losing installs; do it before installs grow | 1 day | ~11 USD/year |
| 6 | Unreliable lane for states ([internet-carried-sessions.md](internet-carried-sessions.md)) | Removes the 0.15–1 s stalls on Relay paths | Medium | 0 € |
| 7 | Worker-minted short-lived TURN credentials (§1.3) | Abuse-proof credentials; 1,000 free GB at Cloudflare | 1–2 days | 0 € |
| 8 | Service worker | Installed apps start when the host is down; needed for any offline play | 1–3 days `[INFERENCE]` | 0 € |
| 9 | Own signaling: ws-relay on a Durable Object (§1.4) | No stranger's relay needed | 1–4 days | 0 € |
| 10 | Two-day native candidate test (§2.2) | Says whether a Host app could fix the iPhone hotspot | 2 days | 0 € (own device) `[INFERENCE]` |
| 11 | Self-hosted TURN (§1.3) | Independent of every TURN company | 1 day + 1 h/month | 5–7 €/month |
| 12 | Host app with native WebRTC (§2.7 B) | Fixes the hotspot Host if rank 10 is positive | 5–8 person-weeks | 124 USD first year |
| 13 | Offline island D2 (§3.1) | Play with no internet at all | Weeks | Router 42–104 € |
| 14 | Custom pocket device (§3.4 c) | A product to sell | Months | 2,500–28,000 € fixed, plus the first batch |
| – | Not now: wrapper-only app, App Clips, Wi-Fi Aware, Bluetooth | No connectivity gain shown | | |

**The single next step: put a second TURN provider into the build** (rank 1). It takes an hour, needs no code, and removes the one dependency whose failure stops a hotspot table from playing at all. Then use the next phone evening for rank 2.

## Open questions for the makers

1. Which Metered allowance does the account have, 20 GB or 500 MB? The dashboard's usage page says.
2. Will the app stay free and non-commercial? GitHub Pages' terms, Apple's fee waiver, and the effort for a device all depend on it.
3. Is a name and domain decided? The domain should come before many Home Screen installs (§1.5).
4. Do you accept running one small server (5–7 € a month), or should everything stay on free managed services?
5. How often are you somewhere without any Wi-Fi? That decides between D1 (needs an uplink) and D2 (offline, much more work).
6. Who at the table has an Android phone, and does anyone own a travel router already?
7. Would you sell hardware yourselves (legal entity, registrations, warranty), or rather recommend a router?

## What I could not verify

- That native libwebrtc on an iPhone gathers the hotspot address `172.20.10.1`; read from source only (§2.2).
- That iOS Safari accepts a WebRTC-direct answer built in the page (D2).
- What Safari offers on a Wi-Fi without a default route (D3); the two earlier reports point different ways.
- Which locations ExpressTURN's free plan uses; whether Cloudflare's rate-limit binding is on the Free plan.
- An Espressif figure for an access point's average current with clients; how many WebRTC connections `esp_peer` holds at once.
- Access-point client limits of Radxa, Orange Pi and Luckfox boards; client-to-client forwarding on 4G pocket routers.
- Prices for a PCB quote and a 3D-printed enclosure; fees at stiftung ear; Austrian registration; whether the CRA replaces the RED cybersecurity act from December 2027.
- iPhones joining Wi-Fi from an NFC tag: only a secondary source says they cannot.
