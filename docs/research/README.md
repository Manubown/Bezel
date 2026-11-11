# Connecting the phones: what else there is besides an iPhone hotspot

Researched 2026-11-11, after live run 5 (`.scratch/live-test-1/findings.md` §1f). Five reports, each with its sources inline; this page is the reading order and what follows from them together. Nothing here was tried on phones except where a live run is cited.

| Report | Question |
|---|---|
| [iphone-hotspot-webrtc.md](iphone-hotspot-webrtc.md) | Why the hotspot iPhone's packets stop reaching an iPhone on its hotspot, and what helps without a Relay |
| [internet-carried-sessions.md](internet-carried-sessions.md) | Every phone on its own connection, no shared network at all |
| [table-hub-device.md](table-hub-device.md) | A small device on the table: Raspberry Pi, travel router, ESP32 |
| [web-platform-local-connectivity.md](web-platform-local-connectivity.md) | What a web page can use to connect phones side by side |
| [native-nearby-connectivity.md](native-nearby-connectivity.md) | What an installed app could use: peer-to-peer Wi-Fi, Wi-Fi Aware, Bluetooth |

The reports were written while an experiment flag `?mic` existed in the PWA; two of them show from WebKit's source that it could not help, and it was removed the same day. Where a report says the flag "exists", read "existed".

## What the reports agree on

1. **The iPhone hotspot fails for a reason in Safari, not in the radio.** The hotspot phone's Safari offers WebRTC only the address of its default route, the cellular one, never its hotspot-side address; a granted microphone does not change that (WebKit source and commit message, bug 275986). The connection that forms anyway is a peer-reflexive accident, and it dies when the other iPhone starts checking the cellular address the Host signaled: by the reading of WebKit's socket code, those checks move the Host's sending onto the cellular address, which never reaches hotspot members. That fits what the logs show: the Peer's unanswered `host ↔ host` pair, the 0.2 s, and Android Peers surviving (Chrome on Android has no mDNS stack of its own, so it may never resolve the `.local` name that candidate carries; unconfirmed). Inferred from source, a third-party report and our logs; nobody has watched it happen.
2. **A web page has exactly one way to move data between two phones: WebRTC over an IP network they share**, or the internet. No shipped browser API lets a page on one phone accept a connection from another (no Web Bluetooth on iOS at all; on Android a page can be a Bluetooth central only; no sockets, no local discovery).
3. **Bluetooth cannot carry the game.** The Host needs about 800 kbit/s for five Peers; Apple's own best figure for one Bluetooth LE link is 670 kbit/s, with a 15 ms minimum interval. Bluetooth Mesh carries 11 bytes a message at 20–220 ms and a few kbit/s, and phones can only take part through a hardware proxy and a native app. As a side channel for the clock it would be no better than the path the clock already uses (4–14 ms round trips on a LAN).
4. **The Relay's stalls come from the reliable, ordered channel.** Run 5 had gaps above 150 ms in 18 % of Match seconds on the Relay with both links `ok`. Every report that touches transport ends at the same change: states on a second channel that does not retransmit.
5. **Offline is two separate problems**: finding each other without the internet (signaling), and a network on which the direct path works. Today both need the internet or luck.

## The options, ranked for this project

| # | Option | Internet | Install | Code | What it would give | Main doubt |
|---|---|---|---|---|---|---|
| 1 | **No hotspot: every phone on its own mobile data or Wi-Fi** | every phone | no | none | Works with today's build: direct where the carriers allow (53–73 ms seen), else the Relay in the same attempt, no 19 s loop | Relay share on mobile networks is high; which Metered allowance the account has (20 GB or a 500 MB trial: check the dashboard); about 110 MB an hour per Peer |
| 2 | **An Android phone as the hotspot** (any phone the Host) | signaling | no | none | Every iPhone is an ordinary Wi-Fi member and offers its real address: LAN latency | One third-party report says it works; not run by us |
| 3 | **A travel router on the table** (GL.iNet class, 5 GHz, about 40 USD) | signaling | no | none | The network WebRTC was made for; can re-share a home Wi-Fi or a phone's hotspot as uplink | iOS drops a Wi-Fi without internet unless joined by hand; if cellular stays the default route an iPhone may again not offer its Wi-Fi address |
| 4 | **The iPhone Host stops signaling its own host candidates** | signaling | no | small | Might make the iPhone hotspot's direct path live: the Peers never learn the cellular address, so never check it | Rests on finding 1's inference; needs a phone run. **Built 2026-11-12** as a fail-safe any Host applies after its first failed connection (`.scratch/connectivity-2/issues/07-host-withholds-own-addresses.md`) |
| 5 | **States on an unreliable channel** | n/a | no | medium | Removes the 0.15–1 s stalls on Relay and internet paths; needed by 1 above all | Games that publish changes, not snapshots, need a reliable tail |
| 6 | **Offline signaling by QR code, both ways** (roadmap M5) | none | no | medium | Play without internet on a network where the direct path works (2, 3, a home router; not the iPhone hotspot unless 4 works) | Two scans per Peer; the PWA must be cached on every phone beforehand |
| 7 | A hub that also does the signaling (WebRTC straight to the hub, no signaling server) | none | no | large | Offline with one scan or none | Whether iOS Safari accepts that connection is unconfirmed; a second codebase on a device |
| 8 | A native app: Apple peer-to-peer Wi-Fi (iPhones only), or an Android-made local network iPhones join with one tap | none | yes | large | No access point at all | Ends "scan a QR code, no install"; 99 USD a year, review; mixed tables need an Android phone |

**Dead ends:** Bluetooth as the data path or as a mesh (finding 3); a Raspberry Pi Zero as the access point (2.4 GHz only, a firmware limit of 7–10 phones, cannot re-share an uplink on its one radio, and sold out: a travel router does the same job better for the same money); a hub serving the app over `http://` (no service worker, wake lock or `crypto.subtle`: the app does not start); `ws://` signaling to a hub from the https page (iOS Safari blocks it as mixed content); Wi-Fi Aware between iPhone and Android (allowed on paper since iOS 26, not shown working by anyone as of this month); the microphone permission.

## Experiments that need no code, in this order

Each: at least ten joins, three phones if possible, every phone's log exported. The session log already holds what decides them: the `ice join` pair types, `relay` lines, clock rtt, the `tick` line's `state.gap`.

1. **Everyone off the hotspot, on their own mobile data.** Decides option 1: how many pairs are direct, the rtt, the gaps.
2. **An Android phone's hotspot, iPhones joined, an iPhone as Host.** Decides whether the trouble is the iPhone *as hotspot* (first-try direct pairs, `host ↔ host`) or iPhone to iPhone anywhere.
3. **A travel router** if one is at hand: once with an uplink, once without (phones on mobile data for signaling).

What would justify building further: 1 good enough → options 5 and a no-hotspot default in the guide; 2 or 3 clean → option 6 (offline) has a network to stand on; 2 failing like the hotspot → the cause is not what finding 1 says, and option 4 is moot.

## The maintainer's two ideas

- **A Raspberry Pi Zero as a bridge:** the role that helps is "be the Wi-Fi network", and a travel router is the better device for it (option 3). A Pi earns its place only later, as a hub that also does the signaling for offline play (option 7).
- **A Bluetooth mesh for timing and small packets:** not reachable from a web page on an iPhone, two orders of magnitude too slow as a mesh, and no better for the clock than the main path. The idea behind it, small urgent packets that do not wait behind lost ones, is what option 5 does on the connection the phones already have.
