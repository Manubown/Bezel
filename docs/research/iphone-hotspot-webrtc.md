# iPhone Personal Hotspot and WebRTC: why the Host's direction dies, and what to do without a Relay

As of 2026-11-11. WebKit facts are from WebKit `main` read on that date; Safari ships a branch of it, so a shipped Safari can lag. The
phones in our logs report `iPhone OS 18_7 … Version/27.2` (`docs/liveLogs/mgc-XHZE-host-2026-11-10T23-27-05.txt`, line 4). Apple's iPhone
User Guide already has a "What's new in iOS 27" chapter (https://support.apple.com/guide/iphone/scan-a-qr-code-iphe8bda8762/ios), so "18.7"
is probably a frozen user-agent token on iOS 27.x. **Unconfirmed:** I found no Apple statement that the token is frozen.

## Verdict

The hotspot iPhone's Safari never offers its hotspot-side address to WebRTC. It offers only the address of its default route, the cellular
one. That holds with or without microphone permission. The direct Host↔Peer path therefore exists only as a peer-reflexive accident. It
breaks as soon as the Host's sending moves back onto its cellular address, and the most likely trigger is the Peer starting checks toward
the cellular host candidate the Host signaled. Without a Relay, the cheapest reliable setup is a hotspot or access point that is **not** an
iPhone running the Host page. The cheapest code fix to try is a Host that does not signal its own host candidates.

| Option | Works on iOS Safari? | Works on Android? | Needs internet? | Needs install? | Expected latency | Effort | Main risk |
|---|---|---|---|---|---|---|---|
| A. Today: iPhone hotspot, the hotspot iPhone is Host, direct path | ~20 % of joins (our logs) | Android Peers connected first try (one run) | Yes (Nostr signaling) | No | 4–14 ms when it holds | 0 | The failure we are trying to fix |
| B. Same table, the Host withholds its own `typ host` candidates from signaling | Unknown, not tested | Unknown | Yes | No | 4–14 ms if it works | Small (filter in the transport) | Only right if cause 1 below is right. Peers' mDNS names must resolve on the Host |
| C. Same table, `?mic` on the hotspot Host | Predicted no (WebKit source) | — | Yes | No | — | 0 (flag exists in `apps/pwa/src/main.ts`) | A mic prompt and indicator for a game. An experiment, not a fix |
| D. An Android phone is the hotspot, iPhones join it | Yes (third-party report, below) | Yes | Yes (signaling) | No | LAN, single-digit ms expected `[INFERENCE]` | 0 (instructions) | Client isolation on some Android builds (Unconfirmed). Someone needs an Android phone |
| E. Travel router, home router or a Mac's Internet Sharing as access point | Yes `[INFERENCE]` (every phone is an ordinary Wi-Fi client) | Yes `[INFERENCE]` | Yes for signaling today; a router can uplink via a phone's tethering | No | LAN `[INFERENCE]` | Hardware, or a Mac | AP or "guest" isolation. Extra device to carry |
| F. TURN Relay (today's fallback, for comparison) | Yes (our logs) | Yes | Yes | No | rtt 84–98 ms; stalls in 18 % of seconds | Done | Cost, quota, stalls |
| G. Join helper: page shows a `WIFI:` QR for the hotspot | Camera joins since iOS 11 | Settings scanner parses `WIFI:` | No (QR is text) | No | — | Small | User must type the hotspot name and password once. Hidden SSIDs unsupported on iOS |
| H. Join helper: Instant Hotspot / Family Sharing auto-join | Apple devices only | No | — | No | — | 0 | Same Apple Account or same family only |
| I. Join helper: Shortcuts "Set Personal Hotspot" | Toggles the hotspot (iOS 16.5+) | — | — | Shortcuts app (built in) | — | 0 | A web page cannot run it without the user `[INFERENCE]` |

## Why the Host's direction dies: candidate causes, ranked

### What the logs add to the shared evidence

- The Peer's side of every dying attempt in the last run shows a second pair, `host ↔ host`, toward the Host's signaled host candidate, with
  `reqSent` 4–10 and `respRecv` 0. In two of three attempts that pair is absent at `join` and present by `weak`. So the Host's host
  candidate reached the Peer *after* the channel opened. That matches Trystero forwarding late candidates in-band when a peer becomes active
  (`.scratch/live-test-1/findings.md` §1e) (`docs/liveLogs/mgc-XHZE-peer-2026-11-10T23-26-14.txt`, `ice` lines at w=…34808 to …47857).
- In one attempt (join at t=22578) the Peer got clock replies at +7 ms (q=1) and +107 ms (q=2), then nothing (same file, t=22585 and 22685). The cut falls
  between +0.1 s and +0.2 s.
- On the Host, the selected pair's `reqRecv` climbs from 2 to 35 while `respRecv` stays at 3 and `reqSent` grows from 3 to 7. The Peer's
  checks keep arriving and the Host's own checks go unanswered. The selected pair is the same `prflx ↔ host` at `join` and at `weak`, so ICE
  did not switch pairs (`docs/liveLogs/mgc-XHZE-host-2026-11-10T23-27-05.txt`, `ice` lines).
- Android Peers on the same iPhone hotspot had clock rtt median 8–9 ms, so they used the hotspot's own LAN path, and they lived 61–111 s.
  iPhone Peers: median 6–7 ms when alive. (Computed from the `roster` lines of all files in `docs/liveLogs/`.)

### 1. Most likely: the Peer's checks toward the Host's cellular host candidate pull the Host's replies onto the cellular address

The chain, one fact per step:

1. **Safari offers only the default route.** WebKit's network process takes the "default" IPv4/IPv6 address from a UDP socket `connect()`ed
   to `8.8.8.8` / `2001:4860:4860::8888` (`NetworkRTCMonitor::getDefaultIPAddress`,
   https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkRTCMonitor.cpp). The page's network manager keeps
   only interfaces holding one of those addresses. With capture granted it also keeps "the interface used for the page", which needs
   `EnumeratingVisibleNetworkInterfacesEnabled` (`LibWebRTCNetworkManager::networksChanged`,
   https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/Network/webrtc/LibWebRTCNetworkManager.cpp). On the hotspot phone the
   default route is cellular, so the hotspot bridge is never a candidate. The phone's ICE address on the hotspot side can only be learned as
   `prflx`, which is exactly what the logs show.
2. **The page's own interface is the cellular one too.** WebKit finds "the interface used for the page" by opening an `nw_connection` to the
   document URL's host and reading `nw_path_copy_interface` (`NetworkRTCTCPSocketCocoa::getInterfaceName`,
   https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkRTCTCPSocketCocoa.mm). Our page comes from GitHub
   Pages, reached over cellular.
3. **Sockets from the cellular address do not reach hotspot clients.** OmniCam reproduced this with Safari 26.3 as the hotspot and camera
   plus microphone granted. The offer's only candidate was the mobile-data address `10.224.251.4`, never `172.20.10.1`. The phone received
   83 checks and replied to all 83, and none of the replies reached the desktop. The phone's own 98 checks never arrived either, while
   `fetch` from the same page did (https://github.com/Orest-Z/OmniCam/pull/49, https://github.com/Orest-Z/OmniCam/blob/main/ARCHITECTURE.md
   "Media link"). Their issue reporter (iPhone 11, iOS 18.3.2) found an Android phone as hotspot worked
   (https://github.com/Orest-Z/OmniCam/issues/48).
4. **WebKit keeps one UDP flow per remote address, and an inbound flow overwrites an outbound one.** On Cocoa, each WebRTC UDP socket is an
   `nw_listener` bound to the candidate's address. Each remote address gets its own `nw_connection` in `m_nwConnections`. `sendTo` *reuses*
   the entry (`ensure`), but the listener's new-connection handler *replaces* it (`m_nwConnections.set(remoteAddress, …)`)
   (https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/webrtc/NetworkRTCUDPSocketCocoa.mm). This design dates from the
   July 2021 move to Network.framework (https://bugs.webkit.org/show_bug.cgi?id=227210).

`[INFERENCE]` Put together: the Host's first contact with a Peer is outbound and does leave with the bridge address, since the Peer sees
`prflx`. When the Peer's checks to the Host's *cellular* address arrive from the same Peer address, they form a second, inbound flow tied to
the cellular address. That flow takes over the Peer's entry, and from then on every Host packet to that Peer, STUN included, goes out the
way OmniCam saw fail. Peer→Host keeps working because the old flow still receives. The same trigger could instead act in the hotspot's
packet filter (iOS installs pf NAT rules for Personal Hotspot, https://github.com/AnAgTeam/VPNShare/blob/main/README.md). Both readings
predict the same fix.

- **For:** one-way failure in exactly the Host→Peer direction. The Peer's checks to the Host's host candidate are never answered (OmniCam:
  "replied" but never arrived). The cut follows the late arrival of that candidate. OmniCam's total failure fits the same model if the
  desktop's checks to the cellular address arrived before any outbound flow existed. A Relay path works because it legitimately uses the
  cellular interface.
- **Against / unknown:** our logs record candidate types, not addresses. In the first attempt the Peer had already sent 4 checks to the
  cellular candidate at `join` while the path still worked. Nothing explains why about 20 % of joins survive. Why Android Peers survive is
  untested: perhaps they never resolve or check the Host's mDNS name. **Unconfirmed:** that the listener ever sees those checks as a new
  flow. Also unconfirmed: the WebKit socket's address on our carrier. Wildcard binding happens only for NAT64 interfaces
  (`computeHostAddress`, WebKit commit https://commits.webkit.org/241962@main).

### 2. Possible: the hotspot phone's WebRTC socket can never send to hotspot clients, and the first 0.1–0.2 s are luck

E.g. Network.framework re-evaluates the flow's path and scopes it to the interface that owns the socket's (cellular) address. **For:**
OmniCam saw zero packets arrive. **Against:** a fixed ~0.1–0.2 s delay, sessions that survive for minutes (findings §1 and §1b), and Android
Peers on the same Host for 61–111 s.

### 3. Relevant, not the main cause: iOS 18 changed Personal Hotspot

Since iOS 18.0, iPhones joined to an iPhone hotspot show IPv4 `192.0.0.2` with no subnet mask. Apple's Feedback Assistant reply, quoted by
the reporter, says: "you can't use IPv4 to communicate between client devices, you have to use IPv6. IPv6 link-local is perfect for this."
(https://developer.apple.com/forums/thread/773086, Jan–Feb 2025). On IPv6-only carriers (T-Mobile US and others), an iOS 18+ hotspot hands
out no IPv4 lease at all. Clients fall back to a CLAT address `192.0.0.2` with gateway `192.0.0.1` and cannot reach `172.20.10.1`
(https://github.com/viktor-svirsky/tether/issues/58, https://github.com/devxoul/nothering/pull/23, both 2026). **Against as our cause:** the
Host *is* the hotspot, not a client, and our 4–14 ms IPv4 path shows this hotspot does lease IPv4. **Relevance:** Peer↔Peer IPv4 on an
iPhone hotspot is gone (Trystero's mesh, not the Session's star). On an IPv6-only carrier any direct Host↔Peer path would have to be IPv6.

### 4. Unlikely: a Safari data-channel (SCTP) stall

STUN consent checks sit below SCTP and stop in the same direction. Safari as Peer with a Firefox Host worked first try (findings §1d).

### 5. Unlikely: the Wi-Fi radio (power save, band, Maximize Compatibility)

The same radio carries Peer→Host throughout, and Android Peers were fine. Toggling Maximize Compatibility is free, but no source links it to
WebRTC.

**Ruled out by earlier work:** an ICE pair switch (same selected pair at `join` and `weak`) and Trystero dropping messages (findings §1e).

## The two cheapest experiments that split the causes

Neither needs code. Run each with 3 phones and at least 10 joins, and export every log.

**Experiment 1: the same table, `?mic` on the hotspot Host.** The flag already exists (`apps/pwa/src/main.ts`, "Experiment (`?mic`, …)") and
the QR carries it to every phone. It calls `getUserMedia({audio: true})`, which disables candidate filtering for the document
(`RTCController::disableICECandidateFilteringForDocument`,
https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/RTCController.cpp). That only switches host candidates from
mDNS names to raw addresses (`setICECandidateFiltering` sets `m_useMDNSCandidates`,
https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/Network/webrtc/LibWebRTCNetworkManager.h). Enumerating every interface
needs `EnumeratingAllNetworkInterfacesEnabled`, an internal setting with `defaultValue: false`
(https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml). The comment in `main.ts` ("then it
offers every interface's") does not match this source.

- Host `local` stays `prflx` and the loop is as bad or worse (the Peer reaches the raw cellular candidate sooner): cause 1 is strengthened,
  and capture is no fix.
- Host `local` becomes `host` with LAN rtt and the table holds: the shipped Safari enumerates more than WebKit `main` says, and cause 1's
  step 1 is wrong. Then `?mic` is a (heavy) fix.
- Nothing changes and the Peer never shows the `host ↔ host` pair: cause 2 is more likely.

**Experiment 2: the same table on an Android phone's hotspot.** The Android phone only shares its connection. The iPhone Host and iPhone
Peers all join it as clients, with the same build and flags.

- First-try connections, Host `local: host`, no `weak`: the failure belongs to the iPhone *as hotspot* (causes 1–2), and option D is a valid
  instruction today. OmniCam's reporter saw exactly this (https://github.com/Orest-Z/OmniCam/issues/48).
- The same 0.1–0.2 s death: the problem is iPhone↔iPhone Safari on any LAN (cause 4 or something new), and the hotspot is not to blame.

**Then, to separate causes 1 and 2 (small code change):** let the Host drop its own `a=candidate … typ host` lines and trickled host
candidates before they are signaled, on the iPhone-hotspot table. Cause 1 predicts the table holds, and the Peer's `others` no longer shows
`host ↔ host`. Cause 2 predicts no change. If a Mac is at hand, Console.app on the tethered Host iPhone, filtered on
`NetworkRTCUDPSocketCocoaConnections`, would show the network process's own `sendTo failed with error` / `connection failed with error`
lines. These log strings exist in `NetworkRTCUDPSocketCocoa.mm`; I have not seen them on a device.

## Options in detail

### A. Today's setup

Its premise is how an iPhone hotspot is built. The clients get `172.20.10.0/28` with the phone at `172.20.10.1`, NAT'd out the cellular
interface. None of this is documented by Apple. It is observed in OmniCam's log (`session: iPhone from 172.20.10.1`,
https://github.com/Orest-Z/OmniCam/issues/48), Tether ("finds 172.20.10.1 on the phone's bridge",
https://github.com/viktor-svirsky/tether/issues/58) and nothering's gateway check for `172.20.10.0/28`
(https://github.com/devxoul/nothering/pull/23). macOS marks the hotspot link as expensive Wi-Fi (same PR). Apple's networking DTS advises:
"avoid trying to create features based on Personal Hotspot. It's a user-level feature, not a developer API."
(https://developer.apple.com/forums/thread/702058). How many devices may join "depends on your carrier and iPhone or iPad model"
(https://support.apple.com/en-us/109321). Maximize Compatibility is offered for iPhone 12 and later; "internet performance and Wi-Fi
security might be reduced" (https://support.apple.com/en-us/119837, https://support.apple.com/guide/iphone/iph45447ca6/26/ios/26).
**Unconfirmed:** that it switches the hotspot to 2.4 GHz; Apple's pages do not say.

### B. Host withholds its own host candidates

On a normal router this still works, `[INFERENCE]` by ICE's peer-reflexive learning: the Host checks the Peers' host candidates, and the
Peers learn the Host as `prflx`. It relies on the Host resolving the Peers' mDNS names, which needs multicast on the LAN. On the iPhone
hotspot it removes the only trigger cause 1 names, while the bridge path keeps forming. Untested. Where to cut is a transport question
(Trystero's SDP and the in-band candidate forwarding of findings §1e).

### C. Microphone permission on the Host

See Experiment 1. Even if it helped, it puts a recording indicator on a party game, and Safari lets only one tab capture at a time
(https://webkit.org/blog/7763/a-closer-look-into-webrtc/).

### D. Android phone as hotspot

The iPhones become ordinary Wi-Fi clients whose default route is the Wi-Fi. WebKit then offers that interface (step 1 above), and the Host
is reachable as `host`. Evidence: OmniCam #48 (iPhone Safari plus a desktop on an Android hotspot worked). Android's Settings shows a QR for
its hotspot (`WifiDppUtils.getHotspotConfiguratorIntentOrNull`,
https://android.googlesource.com/platform/packages/apps/Settings/+/refs/heads/main/src/com/android/settings/wifi/dpp/WifiDppUtils.java).
**Unconfirmed:** whether some Android builds isolate hotspot clients from each other. That would not matter to the star while the Android
phone itself is not the Host. Also unconfirmed: what Chrome on an Android *hotspot phone* gathers if it hosts.

### E. Travel router, home router, Mac Internet Sharing

`[INFERENCE]` Every phone is a plain client, so this is the case WebRTC was built for. The only known blocker is AP/client isolation, common
on guest and hotel networks: OmniCam's README lists it, and gives a phone hotspot as its workaround
(https://github.com/Orest-Z/OmniCam/blob/main/README.md "Troubleshooting"). No measured latency in our logs. A Mac's Internet Sharing uses
the same pf NAT and bridge scheme as iOS (a pf dump at https://github.com/clash-verge-rev/clash-verge-rev/discussions/6654). Safari is not
running on the Mac, so the problem in cause 1 does not arise.

### F. TURN Relay

Given in the shared context; it stays the fallback for options A–C.

### G–I. Making the join easier

- **Wi-Fi QR format.** `WIFI:T:WPA;S:<ssid>;P:<password>;;`. Fields can come in any order. Escape `\`, `;`, `,`, `"` and `:` with a
  backslash (https://github.com/zxing/zxing/wiki/Barcode-Contents#wi-fi-network-config-android-ios-11). iOS's Camera handles it since iOS 11
  and prompts to join; "Hidden SSIDs are not supported" (https://developer.apple.com/videos/play/tech-talks/206). Android's Settings parses
  the same `WIFI:` scheme
  (https://android.googlesource.com/platform/packages/apps/Settings/+/refs/heads/main/src/com/android/settings/wifi/dpp/WifiQrCode.java).
  Its Wi-Fi "Share" shows one (https://support.google.com/android/answer/9075847). **Unconfirmed:** which Android camera apps (vs Settings
  or Lens) join from it.
- **An iPhone hotspot in a QR.** The hotspot's name is the device's name, and its password is shown in Settings > Personal Hotspot. A
  password must be at least 8 ASCII characters (https://support.apple.com/guide/iphone/iph45447ca6/26/ios/26,
  https://support.apple.com/en-us/111785). So `WIFI:T:WPA;S:Manu’s iPhone;P:…;;` is valid; note the curly apostrophe iOS puts in default
  names, which must be kept as is. iOS has no QR button on the hotspot screen. A phone that has already joined can show one from the
  Passwords app ("Show Network QR Code"). Password *sharing* by proximity does not work for Personal Hotspot
  (https://support.apple.com/guide/iphone/find-and-share-your-wi-fi-password-iph96e6aa9bb/ios). **Unconfirmed:** that the hotspot appears in
  Passwords like any saved network.
- **What a page can and cannot do.** It can render that text as a QR, e.g. next to the room QR (the user types name and password once;
  `localStorage` can keep them) `[INFERENCE]`. It cannot read the device name or the hotspot password, turn the hotspot on, or join a
  network. No web API exists for these `[INFERENCE]`, and Apple calls the hotspot "not a developer API" (thread 702058 above).
- **Instant Hotspot and Family Sharing.** Devices on the same Apple Account join without a password, and "Allow Others to Join" can stay
  off. Family members can be set to Automatic or Ask for Approval, and the joiner's Auto-Join Hotspot setting can join automatically when no
  Wi-Fi is available (https://support.apple.com/en-us/109321, published 2026-05-08). Apple devices only.
- **Shortcuts.** iOS 16.5 added "Set Personal Hotspot", which "toggles the status of Personal Hotspot"
  (https://support.apple.com/en-us/101583). A Host could keep a one-tap shortcut that turns the hotspot on. **Unconfirmed:** that a page
  link can launch a named shortcut without the user confirming.

## What I could not find out

- Our carrier's address family and the Host socket's actual addresses. The `ice` lines log types only, so cause 1's step "the second flow is
  tied to the cellular address" is inferred, not seen. Logging `address`/`port` of the local and remote candidates of every pair at `join`
  and `weak` would settle it in one run.
- Any WebKit bug, Apple forum thread or discuss-webrtc post describing *this* one-way, 0.2 s pattern on an iPhone hotspot. The closest is
  OmniCam (total failure, a Safari 26.3 hotspot). bugs.webkit.org searches for "personal hotspot" found nothing relevant.
- Whether Network.framework scopes a flow bound to a cellular address to the cellular interface, as Darwin's scoped routing would. No Apple
  document found.
- Whether iOS 26/27 changed Personal Hotspot beyond the iOS 18 IPv4/CLAT change, and whether the visible-interface rule (step 2) is in the
  Safari that ships with iOS 27.2.
- Measured WebRTC latency and loss on a travel router or an Android hotspot with iPhones as clients. Nothing primary was found; Experiment 2
  produces it.
- Android hotspot client isolation per vendor, and what Chrome or Firefox on an Android hotspot phone gathers for its own hotspot interface.
