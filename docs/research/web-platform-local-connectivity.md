# What a web page can use to connect phones on a table (late 2026)

As of 2026-11-11.
The question: what can a PWA, with no native wrapper, use on iOS Safari and Android Chrome to connect phones lying next to each other, other than a shared Wi-Fi access point or hotspot? And on a shared network, under exactly which rules does WebRTC get a direct LAN path on iOS Safari?

Sources and versions: WebKit and Chromium source read at `main` on 2026-11-11 (WebKit for the Safari 26/27 line, Chromium for the Chrome 156 line).
The rules below come from source unless a release note is cited; source on `main` can run ahead of the Safari or Chrome a phone has.
The live logs are from iOS 18.7.
One measurement was taken in a headless desktop Chrome 156.

## Verdict

| Option | iOS Safari (tab / Home Screen app) | Android Chrome | Needs internet? | Needs install? | 20 KB/s at 60 msg/s? Latency | Effort | Main risk |
|---|---|---|---|---|---|---|---|
| 1. WebRTC data channel on one LAN (today) | Yes / yes | Yes | Data path: no. Today's Nostr signaling: yes | No | Yes; rtt 4–14 ms in the logs | Built | The iPhone that *is* the hotspot never gathers a host candidate on the hotspot interface |
| 1a. Same, after a granted `getUserMedia` | Raw IPs, but still only the default-route interface plus the page-load interface | Raw IPs on every interface | As 1 | No | As 1 | Small (`?mic` exists) | Adds nothing on the hotspot iPhone; a new prompt on every launch of a Home Screen app |
| 2a. Signaling by QR code, both ways | Yes (camera; a JS QR decoder is needed) | Yes (`BarcodeDetector`) | No | No | Signaling only; under 1 s per scan in one author's tests | Medium (M5) | 2 scans per Peer; Chrome is removing ICE-credential munging |
| 2b. Signaling by sound (ggwave) | Yes (microphone) | Yes | No | No | Signaling only; 8–16 bytes/s, 5–10 s per message | Medium | Noise; microphone prompt; ultrasound unreliable |
| 2c. NFC tag carrying the Session link | iOS itself reads the tag (iPhone XS and later); the page has no NFC API | Read and write (Web NFC) | The page must still load | No | The link only | Small | Needs a physical tag; no phone-to-phone NFC |
| 2d. Discovery run by the page (mDNS, UDP broadcast) | No | No | – | – | – | – | No web API for it exists on phones |
| 3. Web Bluetooth, Web NFC, WebUSB, Web Serial | None shipped | Shipped, but central/reader role only | – | – | Not phone-to-phone | – | A page cannot be a BLE peripheral, an NFC tag, a USB device or a serial port |
| 4. WebSocket, WebTransport | Outgoing only (WebTransport since Safari 26.4) | Outgoing only | Yes, a server on the internet | No | Only through an internet Relay | Medium | Not local; same cellular path as TURN |
| 4b. Direct Sockets (Isolated Web Apps) | No | No (not compiled for Android) | – | Yes (managed ChromeOS only) | – | – | Not on phones |
| 5. Local Peer-to-Peer API, Open Screen Protocol, Presentation API | No | No (the Presentation API only targets Cast-type receivers) | – | – | – | – | Drafts with no implementation |
| 6. Web Share (AirDrop, Quick Share) | Yes | Yes | No for the share itself `[INFERENCE]` | No | Link or text only | Small | Manual; untested as a signaling path |

In short: in late 2026 no browser API on either platform lets two phones talk without a shared IP network. The only data path is WebRTC over one; everything else on the list can only carry signaling or a link.

## 1. WebRTC on one LAN: the rules for host candidates

### Safari (WebKit), traced to source

1. **Default route only.** `LibWebRTCNetworkManager::networksChanged` keeps a network interface only if one of its addresses equals the default IPv4 or IPv6 address ([LibWebRTCNetworkManager.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/Network/webrtc/LibWebRTCNetworkManager.cpp)).
   The exception is the internal preference `EnumeratingAllNetworkInterfacesEnabled`, and its default is `false` ([UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)).
   The default address is whatever local address the kernel picks for a UDP socket connected to `8.8.8.8` or `2001:4860:4860::8888` ([NetworkRTCMonitor.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkRTCMonitor.cpp)).
   The same filter was already in place before June 2023; commit [15833c2](https://github.com/WebKit/WebKit/commit/15833c2f7cc627678879ff0ef206e481a0d2a605) only moved it from the network process to the web process.
2. **mDNS names until capture is granted.** The `ICECandidateFilteringEnabled` preference defaults to `true` ([yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)).
   While filtering is on, `m_useMDNSCandidates` is set and the host candidate goes out as `<uuid>.local` ([LibWebRTCNetworkManager.h](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/Network/webrtc/LibWebRTCNetworkManager.h)).
   WebKit registers that name with the system as an A record on interface index 0, meaning every interface, pointing at the gathered address ([NetworkMDNSRegister.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkMDNSRegister.cpp)).
   Background: in 2017 WebKit said that without capture access it exposes only server-reflexive and relay candidates, and host candidates once capture is granted ([WebKit blog, 2017](https://webkit.org/blog/7763/a-closer-look-into-webrtc/)). mDNS host candidates came later; since 2021 they are produced inside libwebrtc ([commit 0770fea](https://github.com/WebKit/WebKit/commit/0770fea7235273ade6b034186403e2c7bc4c8a94)).
3. **What a granted `getUserMedia` changes.** When a capture request succeeds, `UserMediaRequest` calls `disableICECandidateFilteringForDocument` ([UserMediaRequest.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/UserMediaRequest.cpp)).
   That turns mDNS off for the document and for every `RTCPeerConnection` of the same top origin and frame origin ([RTCController.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/RTCController.cpp)).
   From then on host candidates carry raw IPs.
   The set of interfaces grows by one heuristic only: the interface the system would use for a TCP connection to the page's own host (`getInterfaceName` via `nw_connection`, [NetworkRTCTCPSocketCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkRTCTCPSocketCocoa.mm); preference `EnumeratingVisibleNetworkInterfacesEnabled`, default `true`).
   WebKit's own statement in that commit (2024-07-01, bug 275986): "WebRTC UDP traffic will only go through the default interface as we do not enumerate all interfaces even post getUserMedia" ([commit b5877b2](https://github.com/WebKit/WebKit/commit/b5877b229ffa2ae13da637a0fd8910e30ffafc29)).
4. **How long the effect lasts: the page, not the capture.** `Page::didChangeMainDocument` calls `RTCController::reset`, which drops the exemption ([Page.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Page.cpp)).
   WebKit's layout test grants capture, stops every track, checks that candidates are still unfiltered, then reloads and checks that filtering is back ([filtering-ice-candidate-after-reload.html](https://github.com/WebKit/WebKit/blob/main/LayoutTests/webrtc/filtering-ice-candidate-after-reload.html)).
   So the effect outlives the capture but ends with a reload or a navigation.
   `[INFERENCE]` A connection that finished gathering before the grant keeps its old candidates, so create the connection after the grant, as `?mic` does.
5. **Remote `.local` candidates** are resolved by libwebrtc inside WebKit ([changeset 244724, 2019](https://trac.webkit.org/changeset/244724/webkit)).
   A peer-reflexive candidate is learned when a check arrives from an address that was never signaled.
6. **Home Screen apps** run the same code; I found no branch for standalone mode `[INFERENCE]`.
   `getUserMedia` has worked in Home Screen apps since [WebKit bug 185448](https://bugs.webkit.org/show_bug.cgi?id=185448) was fixed (2020).
   The open [WebKit bug 327237](https://bugs.webkit.org/show_bug.cgi?id=327237) (2026-10-12) reports that a Home Screen app asks for camera or microphone again on every launch.
7. **iOS Local Network permission does not apply.** Apple: "Traffic originating from WKWebView, SFSafariViewController, and Safari doesn't require local network access" ([TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)).
   `[INFERENCE]` Home Screen apps fall under the same exemption, since they are WebKit views.
   Unconfirmed: the QWBP README says iOS Safari needs a Local Network prompt ([qwbp](https://github.com/magarcia/qwbp)); that conflicts with TN3179, and TN3179 is the primary source.

In RFC 8828 terms ([§5.2](https://www.rfc-editor.org/rfc/rfc8828)), Safari before a grant is Mode 3 plus one mDNS-named host candidate for the default route.
After a grant it is Mode 2 (the default route and its private addresses), plus the interface used to load the page.

**What this means for the Session:**
- An iPhone on a router, or joined to someone else's hotspot, has Wi-Fi as its default route. Its host candidate is its LAN address, so a direct pair forms.
- The iPhone that *is* the hotspot has cellular as its default route.
  Its host candidate is the cellular address: mDNS-named before a grant, raw after.
  With or without a grant, it is never the hotspot address, so every LAN pair to that phone is peer-reflexive.
  This is what the logs show: the Host's local side is `prflx`, and the Peer's `host ↔ host` checks toward the Host's signaled candidate are never answered ([findings §1f](../../.scratch/live-test-1/findings.md)).
- **Prediction for `?mic`.** The comment at [`apps/pwa/src/main.ts:67-68`](../../apps/pwa/src/main.ts) expects Safari to offer "every interface" once the page may capture.
  WebKit's source and commit message say it will not.
  Expected result: the Host's signaled host candidate changes from `.local` to the raw cellular IP, and the working pair stays `local: prflx`.
  Holding the microphone stream open is also unnecessary: per rule 4 the effect stays after the tracks stop, and stopping them removes the microphone indicator.
- Offline LAN (a travel router, no internet): an iPhone gathers its router-side address only if Wi-Fi is its default route.
  Unconfirmed: what iOS chooses when the Wi-Fi has no internet and cellular is on, and what Safari gathers when there is no default route at all.

### Chrome on Android, traced to source

1. **Before camera or microphone permission: default route only.** `FilteringNetworkManager` starts in `ENUMERATION_BLOCKED` ([filtering_network_manager.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/p2p/filtering_network_manager.cc)). libwebrtc then binds the "any" address and emits one host candidate for the default local address ([basic_port_allocator.cc](https://webrtc.googlesource.com/src/+/refs/heads/main/p2p/client/basic_port_allocator.cc); `enable_default_local_candidate = true` in [port_allocator.h](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/p2p/port_allocator.h)).
2. **Raw IPs, not mDNS.** `kWebRtcHideLocalIpsWithMdns` is on by default ([features.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/common/features.cc)), but the responder is compiled only under `ENABLE_MDNS` ([peer_connection_dependency_factory.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/peerconnection/peer_connection_dependency_factory.cc)).
   `enable_mdns` covers Windows, Linux, ChromeOS, Fuchsia, Apple platforms and desktop-Android builds, not phone Android ([net/features.gni](https://github.com/chromium/chromium/blob/main/net/features.gni)).
   Google, 2019: "The mDNS stack is currently not built into Chrome on Android.
   As a result it will also send out candidates with plain IPs" ([discuss-webrtc](https://groups.google.com/g/discuss-webrtc/c/6stQXi72BEU/m/2FwZd24UAQAJ)).
3. **After permission: every interface, raw IPs.** If the stored site permission for audio or video capture is granted, Chrome switches to `ENUMERATION_ALLOWED` and gathers on every interface ([filtering_network_manager.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/p2p/filtering_network_manager.cc)).
   Chrome checks the stored permission when the `RTCPeerConnection` is created; no capture has to run.
   The effect therefore lasts as long as the site permission does.
   Unconfirmed: how Android's one-time permissions interact with this.
   `[INFERENCE]` On an Android phone that is both hotspot and Host, a granted permission should add the tethering interface.
   Unconfirmed: whether Chrome's Android network list actually includes that interface.
4. **Resolving an iPhone's `.local` candidate.** Chrome passes `.local` names to the system resolver ([host_resolver_manager.cc](https://github.com/chromium/chromium/blob/main/net/dns/host_resolver_manager.cc)).
   Android's resolver has answered `.local` names by one-shot mDNS since November 2021, "if a device supports" it ([source.android.com](https://source.android.com/docs/core/ota/modular-system/dns-resolver)).
   `[INFERENCE]` On such devices Chrome can resolve them; on others the pair forms only as peer-reflexive.
5. **Local Network Access (LNA).** The permission prompt shipped in Chrome 142 for fetches, subresources and subframes.
   Chrome's own blog says WebSockets, WebTransport and WebRTC "are not yet gated" ([Chrome blog](https://developer.chrome.com/blog/local-network-access)).
   For WebRTC there is an Intent to Prototype dated 2025-05-28 ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/CDy8LAs-DoA)), and the flag `kLocalNetworkAccessChecksWebRTC` is still `DISABLED_BY_DEFAULT` on `main` ([features.cc](https://github.com/chromium/chromium/blob/main/services/network/public/cpp/features.cc)).
   The design: a candidate with a local address needs the permission; if the user denies it, the candidate is dropped ([explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md#integration-with-webrtc)).
   Effect today: none.
   If it ships, a page served from a public origin would get a "local network" prompt in Chrome before LAN pairs could be used.

Firefox for Android was not researched beyond the log of an Android Firefox Host and an iPhone Peer that connected over a server-reflexive pair.

## 2. Signaling without internet

**QR code.** Measured size: in headless desktop Chrome 156, with no STUN server, a data-channel-only offer is 587 bytes after gathering and the answer 585.
Of that, 458 bytes are not candidates; each candidate line adds about 130 bytes.
With STUN and several interfaces an offer reaches about 2.5 KB: QWBP measured 2,487 bytes with about 20 candidate lines ([magarcia, 2026-01-19](https://magarcia.io/air-gapped-webrtc-breaking-the-qr-limit)).
A connection needs only `ice-ufrag`, `ice-pwd`, the DTLS fingerprint, the setup role, and candidate IPs and ports ([sdp-minimizer](https://github.com/fippo/sdp-minimizer), [webrtcHacks](https://webrtchacks.com/the-minimum-viable-sdp/)).
Packed as binary (a 32-byte fingerprint, 7 bytes per IPv4 candidate, 19 per mDNS UUID candidate), QWBP fits 55–100 bytes into a version 4–5 QR code that scanned in under a second in the author's tests ([QWBP blog](https://magarcia.io/air-gapped-webrtc-breaking-the-qr-limit), [spec](https://github.com/magarcia/qwbp/blob/main/SPECIFICATION.md); the library is marked beta).
- **Both directions need a scan.** Each side's DTLS fingerprint and browser-generated ICE password must reach the other side.
  The QWBP author: "You cannot establish a WebRTC connection with a single unidirectional scan" ([blog](https://magarcia.io/air-gapped-webrtc-breaking-the-qr-limit)).
- **Credential munging risk.** QWBP derives the ICE credentials from the fingerprint, which means writing them into the local description.
  Chrome's field trial `WebRTC-NoSdpMangleUfrag` blocks exactly that, and its owner wrote in April 2026 that "we don't want to wait forever" ([libp2p/specs#672](https://github.com/libp2p/specs/issues/672), [webrtc issue 411871813](https://issues.webrtc.org/issues/411871813)).
  `[INFERENCE]` Carrying the browser's own ufrag and password costs about 21–28 more bytes and needs no munging.
  A one-way scheme would have to munge the Peer's credentials, so it is not viable either.
- **A star of six** `[INFERENCE]`.
  The Host pre-creates five connections and can share one certificate across them ([`RTCConfiguration.certificates`; `RTCCertificate` is serializable](https://w3c.github.io/webrtc-pc/)).
  It shows one QR with five credential and candidate sets, about 200–250 bytes.
  Each Peer scans it and shows its own QR, which the Host scans: 5 Host scans and 5 Peer scans in total.
- **Decoding.** `BarcodeDetector` exists in Chrome Android 83+ but only behind a flag in Safari ([MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)), so iOS needs a JS decoder.
  Scanning uses `getUserMedia`, which also unlocks raw host candidates under the rules above.
- **Prior art:** animated QR codes ([Franklin Ta, 2014](https://franklinta.com/2014/10/19/serverless-webrtc-using-qr-codes)) and the QWBP library ([repo](https://github.com/magarcia/qwbp), MIT).

**Sound.** ggwave sends 8–16 bytes/s by FSK ([README](https://github.com/ggerganov/ggwave)). wave-share does WebRTC signaling by sound in a browser: its 112-byte packet takes 5–10 s, and its README notes that "Ultrasonic sound transmission does not work on most devices" ([wave-share](https://github.com/ggerganov/wave-share)).
It needs the microphone, which also unlocks host candidates.
`[INFERENCE]` The Host's offer can go to all Peers at once, but the five answers have to take turns.

**NFC.** Web NFC is in Chrome Android 89+ ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/NDEFReader.json)).
It covers NDEF only: "As currently spec'ed, peer-to-peer is not supported", and card emulation is out of scope ([Web NFC](https://w3c-cg.github.io/web-nfc/)). iPhones have no Web NFC ([WebKit](https://webkit.org/tracking-prevention/#anti-fingerprinting)).
However, iOS itself reads a URL tag in the background on iPhone XS and later and opens the link ([Apple](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading)).
Usable this way: an Android Host writes each Session's link to a sticker, and iPhones tap it to join.
No return channel.

**Discovery run by the page.** A page cannot send or receive UDP or multicast.
The only web socket API, Direct Sockets, is limited to Isolated Web Apps (section 4).
WebRTC's mDNS is internal to ICE and uses random per-document names.
Not usable.

## 3. Web Bluetooth, Web NFC, WebUSB, Web Serial

- **iOS Safari:** none of them.
  WebKit lists Web Bluetooth, Web Bluetooth Scanning, Web NFC, Serial API and Web USB among the features it has "decided to not yet implement" ([WebKit tracking prevention](https://webkit.org/tracking-prevention/#anti-fingerprinting); [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json)).
- **Android Chrome:** Web Bluetooth 56+, WebUSB 61+, Web NFC 89+ ([BCD](https://github.com/mdn/browser-compat-data)).
  Web Serial on Android shipped in Chrome 148 ([release notes](https://developer.chrome.com/release-notes/148)); Bluetooth RFCOMM support is listed in the [Chrome 138 notes](https://developer.chrome.com/release-notes/138).
- **Phone-to-phone: no.** The Web Bluetooth spec covers "web pages, running on a UA in the Central role" connecting to remote GATT servers ([spec](https://bluetooth.spec.whatwg.org/)).
  It has no API to advertise or to host a GATT server, and scanning and `watchAdvertisements()` are behind a flag ([implementation status](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md)).
  Confirmed: a page cannot be a BLE peripheral, so two pages are two centrals and cannot connect.
  Web NFC has no peer-to-peer mode or card emulation.
  `[INFERENCE]` With WebUSB and Web Serial the page is always the side that opens the connection; the other phone would need native code exposing a USB interface or an RFCOMM service.
  Not usable.

## 4. WebSocket, WebTransport, Direct Sockets, Isolated Web Apps

- **No page can accept a connection.** WebSocket and WebTransport only connect out.
  Safari 26.4 (2026-03-24) adds WebTransport "between clients and servers" ([WebKit](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)); Chrome has had it since 97 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json)).
  `[INFERENCE]` Its only use for this project is as an internet Relay in place of TURN, with unreliable datagrams instead of a reliable ordered channel; the path would still be hotspot → cellular → server and back.
- **Direct Sockets** has `TCPServerSocket`, bound `UDPSocket` and multicast, but only inside Isolated Web Apps ([Chrome docs](https://developer.chrome.com/docs/iwa/direct-sockets)).
  IWAs install only on Chrome Enterprise-managed ChromeOS devices ([IWA intro](https://developer.chrome.com/docs/iwa/introduction)), and the Intent to Ship (2024-08-13) says: "Feature not compiled in Android" ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/5R0P_aYBWQI)).
  Not usable.

## 5. Standards work on local peer-to-peer

- **Local Peer-to-Peer API (WICG; Intel, Twintag).** Still a work in progress: commits as recent as October 2026, and its data channels are "not fully specified yet" ([repo](https://github.com/WICG/local-peer-to-peer)).
  It still needs an IP link (a Wi-Fi access point, Wi-Fi Direct or Ethernet) and binds to the Open Screen Network Protocol ([explainer](https://github.com/WICG/local-peer-to-peer/blob/main/EXPLAINER.md)).
  The TAG review was closed and put on hold on 2025-02-10 ([TAG #932](https://github.com/w3ctag/design-reviews/issues/932)).
  I found no implementation in any browser.
- **Open Screen Protocol.** The single spec was discontinued on 2024-12-10 ([W3C](https://www.w3.org/TR/openscreenprotocol)) and split into an Application Protocol (Working Draft, October 2026, [W3C](https://www.w3.org/TR/openscreen-application/)) and a [Network Protocol](https://www.w3.org/TR/openscreen-network/).
  Both target the Presentation and Remote Playback APIs.
  I found no browser that ships it.
- **Presentation API.** In Chrome, not in Safari ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/PresentationRequest.json)).
  `[INFERENCE]` It presents to Cast-type receivers; a phone's page cannot be a receiver.
  Not usable.

## 6. Anything else a browser exposes

- **Web Share** (AirDrop, Quick Share): Safari 12.1+ and Chrome Android 61+ ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)).
  It can hand the Session link to a neighbouring phone.
  `[INFERENCE, untested]` It could also send an answer back as a URL, but an AirDropped URL opens in Safari, not in the Home Screen app.
- **Offline page load comes first.** `[INFERENCE]` No browser can serve the page to another phone, so for offline play every phone must already have the PWA cached.
  Safari's ITP deletes service-worker registrations and caches after 7 days without user interaction; Home Screen web apps are exempt ([WebKit](https://webkit.org/tracking-prevention/)).
- **Motion sensors and touches across bezels** can trigger or confirm pairing, but they carry no data between phones `[INFERENCE]`.

## Recommendation

1. **Treat the hotspot iPhone as a dead end for direct paths.** WebKit never gathers its hotspot interface, with or without a capture grant, so do not expect `?mic` to fix the iPhone-hotspot Host.
   Run it once to confirm the prediction in section 1.
   If the grant is kept for other reasons, stop the tracks right after it.
2. **Change the topology instead.** Make the Host a phone joined to the network, not the phone providing it: a router, a travel router, or another phone's hotspot.
   Or, to test whether the Android rules help, make an Android phone the hotspot and Host with `?mic`.
   Whether the hotspot phone's own outgoing packets still stall when it is only a Peer is for the hotspot research.
3. **For offline play, build M5 as two-way QR signaling.** Use about 100-byte binary payloads that carry the browser's own credentials (no munging), and keep the camera grant, which also yields raw host candidates on both platforms.
   Sound is the fallback where no camera can be used.
   No other web API can carry the return leg.
4. **Watch Chrome's LNA for WebRTC.** If it ships, expect a "local network" prompt on Android before LAN pairs work.

## What I could not find out

- The first Safari release that contains the 2024-07-01 heuristic that adds the page-load interface.
- What iOS uses as the default route when joined Wi-Fi has no internet and cellular is on, and what Safari gathers with no default route at all.
- Whether Chrome on Android lists the tethering interface once permission is granted, and how Android's one-time permissions interact with that.
- Whether Chrome on Android resolves an iPhone's `.local` candidates in practice; it depends on the device's DnsResolver.
- Whether mDNS queries cross an iPhone Personal Hotspot LAN.
- Whether WebKit will also restrict ICE-credential munging; I found no WebKit statement.
- Whether Safari can store an `RTCCertificate` in IndexedDB.
- Positive confirmation that no browser ships the Local Peer-to-Peer API or the Open Screen Protocol; I only found no evidence of any.
- The QWBP README's iOS Local Network prompt claim, which conflicts with Apple's TN3179.
- Web Share as a signaling return path; untested.
