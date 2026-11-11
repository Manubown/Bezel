# A hub device on the table: does it beat a phone hotspot, and in which role?

Research note, 2026-11-11. Question: could a small dedicated device on the table (Raspberry Pi Zero 2 W, Pi 4/5, ESP32, an OpenWrt travel router, an old Android phone) give the Devices of a Session a better connection than one iPhone's Personal Hotspot, with and without internet, for iPhones (Safari) and Android phones (Chrome) together, 2–6 Devices?

Short answer: yes, as a plain **access point** (best a dual-band travel router on 5 GHz), as long as the phones still reach the internet for signaling. Offline play needs the hub to do the signaling too. A web page can reach the hub without mixed-content or certificate trouble only over WebRTC itself (a "WebRTC-direct" listener on the hub) or over WebTransport with a pinned certificate hash. Bluetooth, plain `ws://`, and serving the PWA over plain `http://` are dead ends for a no-install web app.

Words: Host, Peer, Device, Session, Relay as in `GLOSSARY.md`. "Hub" is the table device; "server" is used for software on the hub only.

## Verdict

| Role | iPhone + Android, phones have internet | No internet at all | Verdict |
|---|---|---|---|
| 1. Access point only, travel router on 5 GHz | Should work with today's code: WebRTC host-to-host on the hub's LAN; signaling over the phones' mobile data or the router's uplink | Fails: Trystero's Nostr signaling needs the internet | **Do first.** Cheapest real test of "is the iPhone hotspot the problem?" |
| 1b. Access point only, Pi Zero 2 W | Same idea, but 2.4 GHz only, a client limit near 7–10 set by the Wi-Fi chip's firmware, and the board is mostly sold out | Fails, same reason | Only if one is already on hand |
| 2. Access point that re-shares an uplink | Travel router: uplink on 2.4 GHz, phones on 5 GHz, works. Pi single radio: only one client can join while its station link is up | n/a | Router yes; **Pi AP+STA is a dead end** |
| 3. Local signaling on the hub | `ws://` from the https PWA: Android Chrome 147+ behind a permission prompt; iOS Safari blocks it as mixed content. WebRTC-direct (no signaling server) or WebTransport with a pinned certificate hash: plausible on both | Same options; these are what make offline work | **WebRTC-direct is the one to prototype**; plain `ws://` is a dead end for iPhones |
| 4. Hub serves the PWA | Over plain `http://`: no service worker, wake lock, `crypto.randomUUID`, `crypto.subtle`, Web Locks, so the app breaks. Over https: needs a public DNS name pointing at a private address plus a Let's Encrypt certificate per hub, renewed online every ~40 days from 2027 | Works only with the https variant and a certificate fetched while online | Serve-over-http is **dead**; prefer "PWA cached beforehand + signaling on the hub" |
| 5. Hub as router of game traffic, or as Host | Feasible on paper (load is small); a relay hub halves the Host's airtime; a Host hub breaks ADR 0002/0004 | Works if 3 works | Later, only if role 1 shows the Host phone's radio is the bottleneck |
| 6. Clock/state over Bluetooth LE | Android Chrome: Web Bluetooth GATT after a chooser prompt; scanning advertisements is behind a flag. iOS Safari: no Web Bluetooth at all. Bluetooth Mesh needs a native app | Same | **Dead end** |
| 7. Hardware | GL.iNet Opal $39.99, Beryl AX $98.99 (store, 2026-11-10); Pi Zero 2 W $15 list but sold out at most shops; ESP32 can be a dumb access point and little more | | Travel router first |

## What the app already measures (and why a hub could help)

The session recorder writes one JSON line per event (`apps/pwa/src/recorder.ts`): `ice` lines with the selected candidate pair and its types (host / srflx / relay), mDNS, rtt and STUN counters; `clock` samples with `rtt`; per-second `tick` lines whose `state` block carries `gap` (longest time between two state frames) and `ageMin/Avg/Max`; `relay` lines when the Peer escalates to the TURN Relay (`RELAY_AFTER = 3` in `apps/pwa/src/main.ts`); `link`, `device-lost` and `device-back` lines. In a recent iPhone log the clock rtt starts at 67–571 ms and settles at 7–11 ms (`docs/liveLogs/mgc-XHZE-peer-2026-11-10T23-26-14.txt`, lines 15–57), and a Match delivers about 60 state messages and 17–19 KB per second to one Peer (same file, lines 61–63). Those numbers are the baseline a hub has to beat. The transport contract is reliable and ordered per channel (`packages/core/src/transport.ts`, lines 7–8), which matters for role 5.

Trystero 0.26 lets the app replace the public Nostr relays with its own list (`config.relayConfig?.urls` in `node_modules/.pnpm/@trystero-p2p+core@0.26.0/.../utils.mjs`, line 45), so a Nostr relay on the hub is a configuration change on the app side. The default relay list is built as `wss://` URLs (`@trystero-p2p/nostr/dist/index.mjs`, line 288).

## 1. Access point only

**What a Pi Zero 2 W radio is.** 2.4 GHz 802.11 b/g/n only, Bluetooth 4.2, four Cortex-A53 cores at 1 GHz, 512 MB RAM ([Raspberry Pi product brief](https://pip-assets.raspberrypi.com/categories/584-raspberry-pi-zero-2-w/documents/RP-008359-DS-1-raspberry-pi-zero-2-w-product-brief.pdf); [raspberry.tips, 2026-11-08](https://raspberry.tips/en/raspberrypi-infos/raspberry-pi-zero-2-w-alternative-sold-out)). The Wi-Fi chip differs between production runs: Raspberry Pi ships separate firmware for `43430`, `43430b0`, `43436` and `43436s` variants of the Zero 2 W ([RPi-Distro/firmware-nonfree, bookworm branch](https://github.com/RPi-Distro/firmware-nonfree/tree/bookworm/debian/config/brcm80211/brcm)).

**Client count.** The number of stations in access-point mode is bounded by RAM inside the Wi-Fi chip, not the Pi's RAM. Every firmware fix uses more of it, so the limit shrinks over time ([raspberrypi/linux#3010, Raspberry Pi engineers, 2020–2021](https://github.com/raspberrypi/linux/issues/3010)). Reported numbers: about 10 clients on a Pi Zero W (same issue, 2022-01-14). On Pi 4 the stock firmware stops at 7 stations, and an alternative "minimal" firmware raises it to 19 ([home-assistant/operating-system#3502, open since 2024](https://github.com/home-assistant/operating-system/issues/3502); [firmware README](https://github.com/RPi-Distro/firmware-nonfree/blob/bookworm/debian/config/brcm80211/cypress/README.txt)). The Pi 5 has the same chip and firmware as the Pi 4 (#3010, 2023-10-31). Unconfirmed: the limit for each Zero 2 W chip variant. Six phones sit right at the reported limits, so test with 6.

**Client-to-client forwarding.** hostapd and OpenWrt forward between stations unless isolation is switched on, and NetworkManager's hotspot mode does the same [INFERENCE: defaults from memory, not re-checked]. The Pi documentation shows how to host a hotspot with NetworkManager ([Raspberry Pi docs, Configuration](https://www.raspberrypi.com/documentation/computers/configuration.html)).

**Travel router.** GL.iNet's Beryl AX (GL-MT3000) is dual-band Wi-Fi 6 on a MediaTek MT7981, powered over USB-C at 5 V/3 A, and is supported by mainline OpenWrt since 23.05 ([OpenWrt ToH](https://openwrt.org/toh/gl.inet/gl-mt3000); [GL.iNet datasheet](https://static.gl-inet.com/www/images/products/datasheet/mt3000_datasheet_20250320.pdf)). The 5 GHz band, which the Pi Zero 2 W lacks, is usually much quieter on a table in a flat than 2.4 GHz [INFERENCE].

**Measured latency and throughput.** I found no primary measurement of phone-to-phone latency through either device. The load is small: about 20 KB/s per Peer, roughly 100 KB/s for 5 Peers, well inside what 802.11n carries [INFERENCE].

**Will phones stay on a Wi-Fi without internet? iOS.** Apple's DTS engineer describes the logic ([Quinn, "The iOS Wi-Fi Lifecycle", 2023](https://developer.apple.com/forums/thread/734361)):
- On **auto-join**, iOS checks that the network "leads to the wider Internet". If it does not, iOS "immediately turns around and leaves that network".
- On a **manual join** (Settings), iOS skips that check and "stays on that network until it leaves for some other reason, like device sleep". The app holds a Screen Wake Lock, so the phone should not sleep during play.
- The captive probe goes to an Apple server. If it redirects, the network is captive; "if the request fails, the system assumes it's not captive".

The same engineer's accessory guide adds two points ([Quinn, "Working with a Wi-Fi Accessory"](https://developer.apple.com/forums/thread/734344)):
- A network that becomes the default route gets most of the phone's connections, and those fail if it has no internet.
- A network that does not become the default route is not auto-joined again, so after a lock the user must rejoin it by hand.
- Acting as a captive portal is "generally a bad idea": if the user cancels the sheet, iOS leaves.

So the honest options are two. Either a hub that offers **no default route** (DHCP without a router option): iOS keeps mobile data as its default route and should still reach the hub's subnet over Wi-Fi, which gives table traffic on Wi-Fi and internet on cellular at once [INFERENCE: subnet routing on iOS is not documented in these posts]. Or a hub that **re-shares a real uplink** (role 2). Answering Apple's probe with a fake "Success" without an uplink would make the hub the default route for everything and break signaling. iOS 26 (2026-09) replaced Wi-Fi Assist with **Connectivity Assist**, which "uses cellular data in addition to Wi-Fi" when Wi-Fi is "slow or unusable" and can be turned off per network ([Apple, published 2026-09-14](https://support.apple.com/en-us/127686)). Unconfirmed: how it treats a Wi-Fi network that has local peers but no internet.

**Android.** A Wi-Fi network that fails validation does not become the default network; mobile data stays default ([Android Developers, Read network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state)). Android 17 adds a runtime permission, `ACCESS_LOCAL_NETWORK`, for apps that target SDK 37. It covers all TCP and UDP traffic to local addresses, has a note telling browsers how to detect blocked sockets, and exempts DNS to a local resolver on port 53 ([Android, Local network permission](https://developer.android.com/privacy-and-security/local-network-permission)). Unconfirmed: whether Chrome already targets SDK 37 and how its own Local Network Access prompt maps onto the OS permission. Also unconfirmed: whether Chrome's sockets reach an unvalidated Wi-Fi subnet while cellular is default (WebRTC binds per network [INFERENCE]; plain WebSocket may not).

## 2. Access point that re-shares an uplink

On Raspberry Pi built-in Wi-Fi, one radio can be station and access point at once only on the same channel. A Compute Module 4 user reported that while the chip is connected as a station, **only one client can connect to its access point**; while it scans for its uplink, clients drop about every minute ([raspberrypi/linux#3010, 2023-10-27](https://github.com/raspberrypi/linux/issues/3010)). That rules out a Pi Zero re-sharing a home Wi-Fi or a hotspot to 6 phones. A USB Wi-Fi dongle as a second radio is the usual workaround (same issue, 2020–2023), which spoils the "tiny" idea.

A dual-band travel router does this as its main job: uplink on 2.4 GHz, phones on 5 GHz. GL.iNet's own forum recommends exactly that split, because repeating on one channel sends every packet over the air twice ([GL.iNet forum](https://forum.gl-inet.com/t/repeater-mode-wifi-channel/62688)). Game traffic stays on the 5 GHz LAN; only signaling and the PWA download use the uplink. If the uplink is an iPhone hotspot, that iPhone sits on a different subnet from the other phones. Unconfirmed: whether this avoids the "hotspot iPhone's packets stop after 0.2 s" failure, whose cause is unknown. Test it rather than assume it.

## 3. Local signaling on the hub

**From the https PWA (GitHub Pages) to `ws://192.168.x.y`.**
- Chrome: since 142, connections from a public site to private addresses need the Local Network Access permission ([Chrome blog, 2025, updated 2025-09-29](https://developer.chrome.com/blog/local-network-access)). Once granted, `ws://` to a private IP literal or a `.local` name is exempt from mixed-content blocking ([Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)). The WebSocket gating is listed for Chrome 147 on desktop and Android ([chromestatus 5197681148428288](https://chromestatus.com/feature/5197681148428288)).
- WebKit: blocks mixed-content WebSockets ([WebKit bug 89068](https://bugs.webkit.org/show_bug.cgi?id=89068)) and in October 2026 still blocked `http://` fetches from https pages ([cors.dev, tested WebKit 26.6 on 2026-10-28](https://cors.dev/guides/mixed-content-http-api)). Safari has no Local Network Access exemption.

So **`ws://` signaling works for Android only**. A local Nostr relay at `ws://hub.local` fails on iPhones; at `wss://` it needs a trusted certificate (role 4).

**WebTransport with a pinned certificate hash.** `serverCertificateHashes` lets an https page connect to a server with a self-signed certificate. Support: Chrome 100, Firefox 125, Safari 26.4, iOS following Safari ([MDN browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json)). The spec caps such a certificate's validity at **two weeks** ([W3C WebTransport](https://w3c.github.io/webtransport/#custom-certificate-requirements)). The hub must therefore rotate it and the page must learn the new hash, which is hard offline. Chrome 147 gates WebTransport to local addresses behind the LNA prompt ([Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)).

**WebRTC-direct: a data channel to the hub with no signaling server.** libp2p specifies how a browser opens a WebRTC connection to a server whose IP, UDP port and DTLS certificate hash it already knows. The browser builds the server's SDP answer locally, and the server is an ICE-lite agent that learns the browser's credentials from the first STUN request ([libp2p webrtc-direct spec, r2 2026-06-20](https://github.com/libp2p/specs/blob/master/webrtc/webrtc-direct.md)). Version 2 needs no SDP munging, because Chromium is removing ufrag munging, and js-libp2p dials both versions from browsers ([@libp2p/webrtc README](https://github.com/libp2p/js-libp2p/blob/main/packages/transport-webrtc/README.md)). For a hub this is the cleanest path:
- WebRTC is not subject to mixed content.
- Chrome's LNA gating for WebRTC is only "proposed", with no milestone ([chromestatus 5065884686876672](https://chromestatus.com/feature/5065884686876672)).
- A hub acting as access point has a fixed address such as 192.168.4.1.

The hub then carries the Session's signaling (or the game traffic, role 5) and the phones need no internet. The spec says the v1 flow worked "across the major browsers (Safari, Firefox, Chrome)". Unconfirmed: that iOS Safari accepts the v2 synthetic ICE-lite answer. This is the first thing to prototype for offline play.

## 4. The hub serves the PWA

**Plain `http://` on the LAN is not a secure context.** Service workers, Screen Wake Lock, Web Crypto and Web Locks are secure-context only ([MDN, Features restricted to secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts)). Today's app depends on several of these:
- `crypto.randomUUID()` (`apps/pwa/src/device.ts`, lines 50, 54, 68; `apps/pwa/src/lobby.ts`, line 330).
- `navigator.locks` (`device.ts`).
- `navigator.wakeLock` (`apps/pwa/src/wake.ts`). Without it the screen sleeps, and iOS leaves Wi-Fi on sleep (Quinn, above).
- Trystero's `crypto.subtle` for room keys (`@trystero-p2p/core/dist/crypto.mjs`, lines 10–28).

`RTCPeerConnection` itself is not `[SecureContext]` in the spec IDL ([w3c/webrtc-pc](https://github.com/w3c/webrtc-pc/blob/main/webrtc.html)), and WebKit says `RTCPeerConnection`/`RTCDataChannel` are "available in any web view" ([WebKit blog, 2017](https://webkit.org/blog/7763/a-closer-look-into-webrtc/)). So data channels on `http://` are possible in principle [INFERENCE for current iOS], but the app as a whole is not. Dead end.

**A trusted certificate for a hub on a private network.** Plex's model: names like `192-168-1-7.<hash>.plex.direct` resolve to the IP they contain, and each server gets its own wildcard certificate ([Filippo Valsorda, 2015](https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/)). The same post notes that home routers' DNS-rebinding protection can block public names that resolve to private addresses. The equivalent today is a project domain with a DNS API, one name per hub, and a Let's Encrypt certificate per hub by DNS-01 ([Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/)). Costs:
- **Renewal needs internet.** Let's Encrypt moves to 64-day certificates on 2027-02-10 and to 45 days in 2028, and asks clients to renew at about two thirds of the lifetime ([Let's Encrypt, 2026-10-07](https://letsencrypt.org/2026/10/07/64-day-certs); [2025-12-02](https://letsencrypt.org/2025/12/02/from-90-to-45)). So the hub must be online every ~40 days in 2027, every ~30 in 2028.
- **Per-domain rate limits** apply ([Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/)). Unconfirmed: the current number; I recall 50 new certificates per registered domain per week [INFERENCE].
- **One key per hub.** Shipping one shared private key in every image would expose it and get the certificate revoked [INFERENCE].
- **Offline is fine once issued.** Let's Encrypt turned OCSP off on 2025-08-06, so phones do no online revocation check ([Let's Encrypt](https://letsencrypt.org/2025/08/06/ocsp-service-has-reached-end-of-life)). With the hub as access point and DNS server, its own name resolves locally [INFERENCE].
- **`.local` names cannot get a public certificate** [INFERENCE: CA/Browser Forum rules on internal names].

**The alternative is better:** install the PWA from GitHub Pages while online, so its service worker caches it, and put only signaling (WebRTC-direct) on the hub. The page keeps its https origin and so its secure-context APIs. Unconfirmed: whether WebKit's storage eviction spares a home-screen web app that goes unused for weeks.

## 5. The hub as router of game traffic, or as Host

**Load.** 6 Devices × 60 messages/s × ~300 bytes is about 360 messages and 100 KB per second. That is small for four A53 cores running Pion (Go), node-datachannel (libdatachannel) or werift [INFERENCE]. I found no published benchmark of these on a Zero 2 W.

**Air time.** Through any access point, each copy of the state stream crosses the air twice: Host to access point, then access point to Peer. Today the Host phone sends N−1 copies (ADR 0002 notes Host upload grows with Peer count). With the hub forwarding, the Host sends one copy and the hub sends the rest, which halves the Host phone's radio work. With the hub as Host, each Peer gets one hop [INFERENCE: standard Wi-Fi forwarding].

**Design cost.** A hub Host is not a Device: it breaks "one Device is the Host" (`docs/adr/0002-host-authoritative-star.md`). It would also have to run each Game's host logic outside the browser sandbox that ADR 0004 assumes. A forwarding hub keeps the Host phone authoritative and only changes routing, so it is the smaller step.

**Head-of-line blocking.** The project's transport is already reliable and ordered, so a WebSocket's TCP stall after a lost packet is the same class of delay a reliable ordered data channel shows today. Real gains need unordered or unreliable channels for the state stream, which is a transport change whichever path is used. WebSocket and WebTransport to the hub also hit the browser limits of role 3.

## 6. Clock and small packets over Bluetooth LE

- **Android Chrome** has Web Bluetooth GATT since 56 ([chromestatus 5264933985976320](https://chromestatus.com/feature/5264933985976320)). It connects to one user-chosen device through a chooser.
- **Scanning advertisements:** `requestLEScan` still needs `chrome://flags/#enable-experimental-web-platform-features` on Android ([Web Bluetooth CG implementation status](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md)), and `watchAdvertisements()` is "No longer pursuing" ([chromestatus 5180688812736512](https://chromestatus.com/feature/5180688812736512)).
- **iOS Safari has no Web Bluetooth.** WebKit's position is negative ([chromestatus entry above](https://chromestatus.com/feature/5264933985976320); [MDN compat data](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json)). Only third-party apps or a Safari extension add it (implementation-status page), which is an install.
- **Bluetooth Mesh** is built for building automation. An unsegmented message carries 11 bytes of payload; segmentation reaches 384 octets ([Bluetooth SIG Mesh Protocol](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/MshPRT_v1.1/out/en/index-en.html)). Phones take part only as GATT proxy clients ([Bluetooth SIG, Mesh introduction](https://www.bluetooth.com/wp-content/uploads/2019/03/Mesh-Technology-Overview.pdf)), which means a native app. Measured latency spreads from 20 to 220 ms ([Silicon Labs AN1142](https://www.silabs.com/documents/public/application-notes/an1142-mesh-network-performance-comparison.pdf)), against 7–11 ms clock rtt over today's data channel on a good path.

Dead end for a table that includes iPhones. The Pi's Bluetooth also shares the 2.4 GHz combo chip with its Wi-Fi [INFERENCE].

## 7. Hardware and practicalities (late 2026)

- **Raspberry Pi Zero 2 W:** $15 list, price unchanged because Raspberry Pi stockpiled its LPDDR2. It is sold out at Adafruit, Pimoroni, PiShop and Seeed as of 2026-11-08, the cause being substrate capacity; Reichelt (DE) had the WH at €22.10 ([raspberry.tips](https://raspberry.tips/en/raspberrypi-infos/raspberry-pi-zero-2-w-alternative-sold-out)). Pi 4/5 prices went up again in October and November 2026 ([Tom's Hardware, 2026-10-02](https://www.tomshardware.com/raspberry-pi/component-shortages-drive-raspberry-pi-prices-up-by-up-to-23-percent-escalating-lpddr4-lpddr5-costs-trigger-the-third-price-hike-of-the-year)). A Pi 3 A+ ($25 list, dual-band) is in stock (raspberry.tips) but has the Pi 4's chip and its 7/19-client limit.
- **GL.iNet** store prices on 2026-11-10: Mango GL-MT300N-V2 $29.99 (2.4 GHz only), Opal GL-SFT1200 $39.99 (dual-band), Beryl AX GL-MT3000 $98.99, Beryl 7 GL-MT3600BE $129.99 ([GL.iNet store, e.g. Beryl AX](https://www.gl-inet.com/en-us/products/gl-mt3000)). Stock firmware already does access point, repeater and DHCP; no flashing needed for role 1.
- **ESP32:** a soft access point with a small station limit. Unconfirmed: the exact number; I recall 10 ([ESP-IDF Wi-Fi driver](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi-driver/overview.html)). No realistic DTLS/SCTP WebRTC stack on it [INFERENCE]. Useful only as a dumb access point, and then a travel router is better.
- **Old Android phone:** its built-in hotspot plus Termux could host a WebRTC-direct listener [INFERENCE]. The report that Android phones were fine on the iPhone hotspot says nothing about an Android hotspot. Unconfirmed: client-to-client forwarding and client limits on Android hotspots.
- **Power:** the Beryl AX takes USB-C 5 V/3 A, under 8 W (datasheet); a Pi Zero 2 W runs from a micro-USB power bank [INFERENCE]. Some power banks switch off at low draw [INFERENCE].
- **Shipping it:** a router needs a settings page or one SSH script (SSID, 5 GHz, optionally no default route). A Pi needs either a script on top of Raspberry Pi OS (NetworkManager hotspot, then the hub server as a systemd unit) or a ready image. A script is cheaper to maintain until the role is settled [INFERENCE].
- **At the table:** switch the hub on, join "MGC-Table" by hand once (a Wi-Fi QR code makes that one tap), open the app as today. Manual join matters on iOS (Quinn, section 1).

## What I could not find out

- Measured phone-to-phone latency, jitter and loss through a Pi Zero 2 W or a GL.iNet router acting as access point.
- The access-point client limit of each Zero 2 W Wi-Fi chip variant.
- What iOS 26 does with a Wi-Fi network that offers a router but no internet once the captive probe fails: whether it becomes the default route, and what Connectivity Assist then does.
- Whether iOS and Android browsers reach the hub's subnet while mobile data stays the default route. How Chrome on Android 17 interacts with `ACCESS_LOCAL_NETWORK`.
- Whether iOS Safari accepts the WebRTC-direct v2 synthetic answer (ICE-lite, server-chosen ufrag).
- Firefox for Android's handling of `ws://` to private addresses from https pages.
- Boot time to a usable access point for a Zero 2 W or a GL.iNet router; I found no primary figure.
- Whether a hub's access point avoids the iPhone-hotspot failure, whose root cause is still unknown.
- WebKit's current eviction policy for an installed home-screen PWA left unused for weeks.

## Recommendation

**Smallest experiment worth doing first: a travel router as access point only, no code change.** Buy a GL.iNet Opal ($39.99; Beryl AX if one is at hand). On stock firmware, set one 5 GHz SSID with client isolation off. Run three configurations with the same 2–4 iPhones plus one Android, three Sessions of at least 10 minutes each, exporting every Device's session log:

1. **Baseline:** iPhone Personal Hotspot, as today.
2. **Router with internet:** repeater uplink on 2.4 GHz to home Wi-Fi; phones joined by hand to the 5 GHz SSID.
3. **Router without internet:** no uplink, phones on mobile data for signaling. Try once with the DHCP router option on and once with it removed (dnsmasq option 3 left empty [INFERENCE]).

Read from the logs:
- **Connection attempts:** `ice` lines per Peer, how often the connection state goes to `failed`/`disconnected`, `relay` escalations, `device-lost`/`device-back` counts.
- **Path:** the selected pair is host/host on the router's subnet, not srflx or relay.
- **Clock rtt:** median and worst 5 % of `clock` lines.
- **State stream:** `tick.state.gap` and `ageMax` during Matches, plus `link` turning `weak`/`lost`.
- **Configuration 3 only:** whether the Nostr signaling still connects and whether iOS shows "No Internet Connection" and stays joined.

**Result that justifies building it in:**
- Configuration 2 or 3 gives zero `device-lost` and zero Relay escalations on iPhones across all Sessions.
- The selected pair is host/host, clock rtt median ≤ 15 ms, and no state `gap` above ~100 ms outside Match start.
- The same iPhones keep failing on the hotspot.

Then add a documented "hub mode" (SSID QR code, join instructions). The next step for offline play is a WebRTC-direct listener on the hub (Pion on the router, or node-datachannel on a Pi) carrying signaling. Test it on iOS Safari before anything else.

**Dead ends for a no-install web app, and why:**
- **Bluetooth LE / Mesh:** no Web Bluetooth in iOS Safari; scanning is behind a flag even on Android; Mesh needs a native app.
- **Serving the PWA over plain `http://`:** service worker, wake lock, Web Crypto and Web Locks are off, and the app uses all of them.
- **Plain `ws://` signaling from the https PWA:** Safari blocks it as mixed content.
- **Pi single-radio AP+STA re-sharing an uplink:** one client while the station link is up.
- **ESP32 as anything but a dumb access point:** small station limit, no practical WebRTC.
- **Faking a captive portal or an internet "Success" to keep phones joined:** Apple advises against the first; the second steals the default route.
- **Not dead but expensive:** a per-hub public-DNS name with a Let's Encrypt certificate. It needs a domain with a DNS API, an online renewal every ~40 days from 2027, and runs into DNS-rebinding filters on home networks.
