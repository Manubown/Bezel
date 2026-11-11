# Native nearby connectivity: what an installed app could use instead of the hotspot

Research as of 2026-11-11 (iOS 26/27, Android 16/17, Android 17 QPR2 in beta). Question: if MobileGameConnect shipped as an installed app (Capacitor, React Native/Expo, or a small Swift/Kotlin shell around the WebView), which native technologies let 2-6 phones on a table talk directly, with no access point, hotspot or internet? And which of them put iPhones and Android phones into one Session?

Requirement used throughout: 1 Host, up to 5 Peers, about 20 KB/s and 60 messages a second from the Host to each Peer. That is about 160 kbit/s per Peer and 800 kbit/s leaving the Host's radio.

## Verdict

| Option | Works on iOS (native app)? | Works on Android? | Needs internet? | Needs install? | Expected latency | Effort | Main risk |
|---|---|---|---|---|---|---|---|
| A. Apple peer-to-peer Wi-Fi (AWDL) via Network framework; MultipeerConnectivity | Yes, every iPhone (iOS 7+). MultipeerConnectivity is deprecated in Xcode 27 | No | No | Yes (iOS app) | Low; Apple publishes no figure | Low-medium | Apple-only. Mixed Sessions impossible |
| B. Wi-Fi Aware (NAN) | Yes: iOS 26+, iPhone 12 and later, one-time PIN pairing per device pair | Yes: Android 8+; standard pairing needs API 34+ and supporting hardware | No | Yes | "Realtime" mode exists; no published figure | High | **iPhone↔Android data path not shown working by anyone as of Nov 2026** |
| C. Google Nearby Connections | Swift SDK: documented mediums are Wi-Fi LAN, BLE and joining a peer's hotspot. Its Wi-Fi Aware code is left out of the public build | Yes, all mediums, through Google Play services | No (but on iOS, Wi-Fi LAN needs a shared network) | Yes | Not published | Medium | Offline iOS↔Android behaviour is undocumented and unproven |
| D. BLE as the data path (GATT or L2CAP) | Yes (L2CAP channels since iOS 11) | Yes (L2CAP channels since API 29) | No | Yes | ≥ 1 connection interval (≥ 15 ms on iOS) plus stack time; jitter about one interval | High | **800 kbit/s needed vs. Apple's best single-link figure of 670 kbit/s** |
| E. Bluetooth Mesh (SIG profile) | Only as a GATT client of a hardware Proxy node | Same | No | Yes, plus mesh hardware | 20-220 ms, with tails past 250 ms | High | About 0.2-0.6 KB/s, two orders of magnitude short |
| F. BLE side channel (clock, urgent events) next to Wi-Fi | Yes | Yes | No | Yes | Adverts: about 100 ms class. Connections: 15-30 ms | Medium | Clock sync no better than today's Wi-Fi path; adds a second transport |
| G. Android-owned local-only Wi-Fi (LocalOnlyHotspot or a Wi-Fi Direct group). iPhones join via `NEHotspotConfiguration` | iPhones join only (iOS 11+); they cannot create one | Yes: LocalOnlyHotspot API 26+, named Wi-Fi Direct group API 29+ | No | Android Host app; on iPhone a thin app/App Clip, or a manual join | Ordinary Wi-Fi LAN [INFERENCE] | Low-medium | Needs at least one Android phone per Session. iPhone behaviour as a member of an Android access point is not measured yet |
| H. App Clip / Android Instant App as "no install" wrapper | App Clip may configure Wi-Fi; Bonjour and low-level sockets are unavailable | Instant Apps discontinued Dec 2025 | Download needs internet | Lightweight install | Same as the underlying option | Medium | iOS-only; the full app must exist in the App Store |

## 1. Apple peer-to-peer Wi-Fi (AWDL): MultipeerConnectivity and Network framework

- Apple-only by design. TN3111 says Apple peer-to-peer Wi-Fi "dates all the way back to iOS 7", works on all iOS devices, "is not documented for third-party use, so this mechanism only works between Apple devices" ([TN3111](https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview)).
- MultipeerConnectivity is on its way out. "Xcode 27 deprecates the entire Multipeer Connectivity framework" ([TN3213](https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework)). Its peer limit `kMCSessionMaximumNumberOfPeers` is marked available iOS 7.0-27.0 ([doc](https://developer.apple.com/documentation/multipeerconnectivity/kmcsessionmaximumnumberofpeers)). Sessions support "up to 8 peers, including the local peer" ([MCSession](https://developer.apple.com/documentation/multipeerconnectivity/mcsession)), which is enough for 6 phones.
- Apple DTS describes MultipeerConnectivity as having "good latency but poor throughput", no flow control and "some gnarly bugs" ([forum post 776069](https://developer.apple.com/forums/thread/776069)). It disconnects sessions when the app goes to the background ([framework doc](https://developer.apple.com/documentation/multipeerconnectivity)).
- The replacement is Network framework with opt-in `peerToPeerIncluded(true)` and Bonjour discovery. A Host-centred design is the recommended shape: one `NetworkListener`, Peers connect with `NetworkConnection`. QUIC carries reliable streams plus one unreliable datagram channel ([TN3213](https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework)). Apple warns that peer-to-peer Wi-Fi "can reduce network performance" and recommends stopping browsing once connected.
- What the user does: grant the Local Network prompt. The app needs `NSLocalNetworkUsageDescription` and `NSBonjourServices` ([framework doc](https://developer.apple.com/documentation/multipeerconnectivity)). There is no pairing and no Wi-Fi settings change.
- Range and latency: Apple publishes no figures. Unconfirmed.
- WebView wrappers: [`expo-nearby-connections`](https://github.com/puguhsudarma/expo-nearby-connections) uses MultipeerConnectivity on iOS and Nearby on Android. It states "Cross-platform P2P between Android and iOS is not supported". [`capacitor-nearby-multipeer`](https://github.com/squareetlabs/capacitor-nearby-multipeer) does the same; its last push was July 2025. For Network framework peer-to-peer, no maintained plugin found; it would be a small custom Swift plugin.

## 2. Wi-Fi Aware (the most important point)

**Apple side (iOS 26, Sept 2025).**
- Framework: "iOS 26.0+ iPadOS 26.0+", device list "iPhone 12 and later" plus listed iPads ([WiFiAware](https://developer.apple.com/documentation/wifiaware)). macOS is not supported, even though the framework exists for Mac Catalyst ([DTS, forum 827887](https://developer.apple.com/forums/thread/827887)).
- Features ([WiFiAware](https://developer.apple.com/documentation/wifiaware)):
  - "Simultaneous connections to multiple Wi-Fi Aware devices".
  - Works concurrently with an infrastructure Wi-Fi network.
  - "Fully peer-to-peer topology, allowing peers to come and go".
- No region restriction is documented, only device limits. The EU's DMA decision required "Wi-Fi Aware 4.0 in iOS 26" ([EU DMA page](https://digital-markets-act.ec.europa.eu/businesses-portal/interoperability/apple-specification-proceedings-interoperability-connected-devices-and-request-based-process_en)). Unconfirmed: whether any country disables it.
- Pairing is mandatory and done through system UI: `DeviceDiscoveryUI` for app-to-app, `AccessorySetupKit` for accessories.
  - The person picks the device from a list.
  - The PIN "is displayed on the publisher side and entered on the subscriber side".
  - Pairing is a one-time step per device pair; later connections need no PIN ([WWDC25 session 228](https://developer.apple.com/videos/play/wwdc2025/228/)).
  - Paired peers show up in Settings and are reset there ([Espressif, Aug 2026](https://developer.espressif.com/blog/2026/08/wifi-aware-esp-to-iphone)).
  - For this project: every Peer pairs once with every phone that will ever be its Host. For 5 Peers that is 5 PIN entries the first time.
- App setup ([Adopting Wi-Fi Aware](https://developer.apple.com/documentation/wifiaware/adopting-wi-fi-aware)):
  - Entitlement `com.apple.developer.wifi-aware` with `Publish`/`Subscribe`.
  - Services declared in `Info.plist` under `WiFiAwareServices` (names ≤ 15 characters, e.g. `_mgc._udp`).
- Unconfirmed: whether the entitlement needs Apple's approval. Espressif writes that it is a managed capability that needs a request form ([Espressif](https://developer.espressif.com/blog/2026/08/wifi-aware-esp-to-iphone)). An Oct 2026 forum thread shows it as an ordinary App ID capability, with no request entry found and DTS generating iOS profiles containing it ([forum 853064](https://developer.apple.com/forums/thread/853064)).
- Performance:
  - `realtime` performance mode plus the `interactiveVideo` service class is Apple's low-latency setting, at a battery cost.
  - Apple's sample streams per-frame positions over UDP from one publisher to subscribers ([Building peer-to-peer apps](https://developer.apple.com/documentation/wifiaware/building-peer-to-peer-apps)). That is the shape of a Host→Peer state stream.
  - "Wi-Fi Aware and QUIC is not supported prior to iOS 27" ([TN3213](https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework)).
  - No latency or throughput numbers are published.

**Android side.**
- Wi-Fi Aware exists since Android 8.0 (API 26), but only on devices with `FEATURE_WIFI_AWARE` ([guide](https://developer.android.com/develop/connectivity/wifi/wifi-aware)).
- It "may not be currently available" when Wi-Fi or Location is off, or, on some hardware, while Wi-Fi Direct, SoftAP or tethering runs.
- Permissions: `NEARBY_WIFI_DEVICES` (Android 13+), fine location (≤ API 32).
- Standard Wi-Fi Aware 4.0 pairing arrived in API 34 ([`AwarePairingConfig`](https://developer.android.com/reference/android/net/wifi/aware/AwarePairingConfig), PIN keypad/display bootstrapping). It is "only valid when `Characteristics#isAwarePairingSupported()` is true", so the hardware gates it.
- Android 17 QPR2 (SDK 37.2, Beta 7.1 on 2026-10-16, [release notes](https://developer.android.com/about/versions/17/qpr2/release-notes)) adds `setFrameworkOffloadedPairingEnabled`. With it, the system performs pairing and shows PIN UI itself ([PublishConfig.Builder](https://developer.android.com/reference/android/net/wifi/aware/PublishConfig.Builder)). [INFERENCE] This looks aimed at iPhone-style pairing.

**Cross-platform, precisely.**
- *Possible on paper.* Apple's Accessory Design Guidelines R32 Update 1 (dated 2026-10-30) define a "peer device" as "any third-party product (such as an accessory, embedded system, or non-Apple phone/tablet)" ([ADG PDF, ch. 55](https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf)).
- *Conditions in the same chapter.* The peer must be Wi-Fi Aware certified and support:
  - Wi-Fi Aware 4.0 pairing with NIK caching;
  - multicast data and management-frame protection, and beacon protection;
  - PIN-only bootstrapping ("currently supports a 6-digit PIN");
  - a data path that skips IPv6 Neighbor Discovery.
- *Shown working:* iPhone↔iPhone (Apple sample) and iPhone↔ESP32-C5 microcontroller, the latter with experimental ESP-IDF 6.1 support ([Espressif](https://developer.espressif.com/blog/2026/08/wifi-aware-esp-to-iphone)).
- *Not shown working: iPhone↔Android.*
  - In 2025 developers reported that iOS and a Galaxy S23 Ultra could not discover each other. Apple DTS answered that "it's rare to find hardware and software combinations that follow all of those guidelines" ([forum 790195](https://developer.apple.com/forums/thread/790195)).
  - Another developer got Android↔iPhone pairing to succeed, but iOS never answered the Android data-path request ([forum 797186](https://developer.apple.com/forums/thread/797186), FB19683706).
  - An enhancement request states that the current iOS API "isn't compatible" with Android's passphrase model ([forum 800453](https://developer.apple.com/forums/thread/800453), FB20384758).
  - The one React Native Wi-Fi Aware library (Sept 2026) says plainly that iPhone↔Android "is **not** a supported feature". It reports `isAwarePairingSupported()` false on Pixel 9 and Xiaomi 14 and true on Galaxy S25 ([README](https://github.com/mahdidavoodi7/react-native-wifi-aware)). Secondary source; device list Unconfirmed.
  - Google's Nearby code gained an iOS Wi-Fi Aware medium in Sept-Oct 2026, with pairing-UI handling and "R4 credentials" ([commits](https://github.com/google/nearby/commit/59ecbc28c44c0dbb3b5e9429de2c2d7d3c196519)). It is compiled only when `!defined(GITHUB_BUILD)`, and `Package.swift` excludes `Mediums/Aware` ([Package.swift](https://github.com/google/nearby/blob/main/Package.swift)). [INFERENCE] Google is working on iPhone↔Android Wi-Fi Aware internally, possibly for Quick Share (logs say `QS_AWARE`); third parties cannot use it.
- Verdict for Nov 2026: Wi-Fi Aware can make an all-iPhone Session or an all-Android Session. A mixed Session over Wi-Fi Aware is not something a hobby project can count on today.

## 3. Google Nearby Connections

- Android mediums (repo table): Bluetooth Classic, BLE (GATT, L2CAP), Wi-Fi LAN, Wi-Fi Hotspot, Wi-Fi Direct, Wi-Fi Aware, WebRTC, NFC, USB ([README](https://github.com/google/nearby/blob/main/connections/README.md)).
- The `STAR` strategy matches one Host and N Peers, about 100 m ([strategies](https://developers.google.com/nearby/connections/strategies)). Byte payloads are limited to 32 KB ([overview](https://developers.google.com/nearby/connections/overview)).
- On Android it ships as the Google Play services Nearby SDK ([overview](https://developers.google.com/nearby/connections/overview)). [INFERENCE] Phones without Play services are excluded.
- Android permissions: Bluetooth scan/advertise/connect, `NEARBY_WIFI_DEVICES`, location ≤ API 32, and `ACCESS_LOCAL_NETWORK` for SDK 37 apps using Wi-Fi LAN ([get started](https://developers.google.com/nearby/connections/android/get-started)).
- iOS, current state: the sources disagree.
  - The repo README still says for iOS "The only medium supported is Wi-Fi LAN", and its iOS table marks BLE, hotspot and AWDL as not implemented ([README](https://github.com/google/nearby/blob/main/connections/README.md)).
  - The Swift get-started page asks for Bluetooth ("discover and advertise nearby devices over Bluetooth Low Energy"), local network, location, and the Hotspot Configuration capability. The last is for "high-speed data transfer via Wi-Fi Hotspot (allowing the iOS device to connect to a nearby peer hosting a Wi-Fi Hotspot)" ([Swift get started](https://developers.google.com/nearby/connections/swift/get-started)).
  - The source tree has iOS BLE, AWDL, hotspot and Wi-Fi Aware implementations ([apple dir](https://github.com/google/nearby/tree/main/internal/platform/implementation/apple)).
  - The only tagged iOS release is `v0.0.1-ios` from 2021; the package is consumed from `main`.
  - [INFERENCE] The README is stale. iOS→Android "upgrade to the Android Peer's hotspot" is the intended offline path, which is mechanically option G with Google's code.
- Unconfirmed: Google does not document whether an iPhone running the Swift SDK and an Android phone connect with no shared network.
- WebView wrappers:
  - `expo-nearby-connections` uses MultipeerConnectivity on iOS, not Nearby.
  - [`@capacitor-trancee/nearby-connections`](https://github.com/trancee/capacitor-nearby-connections) was last pushed 2025-03.
  - No maintained wrapper of the iOS Swift SDK was found.

## 4. Bluetooth Low Energy, Bluetooth Mesh, BLE side channel, BLE with a Raspberry Pi

**BLE as the data path (GATT notifications or L2CAP channels).**
- Apple's own measurements for one iPhone link ([WWDC17 712 slides](https://devstreaming-cdn.apple.com/videos/wwdc/2017/712jqzhsxoww3zn/712/712_whats_new_in_core_bluetooth.pdf), [WWDC19 901 slides](https://devstreaming-cdn.apple.com/videos/wwdc/2019/901myoscpux9y7nry55/901/901_whats_new_in_core_bluetooth.pdf)):

  | Setting | Throughput |
  |---|---|
  | Write without response, default MTU | 37 kbit/s |
  | Larger MTU | 48 kbit/s |
  | Extended data length | 135 kbit/s |
  | L2CAP | 197 kbit/s |
  | L2CAP + 15 ms connection interval | 394 kbit/s |
  | + LE 2M PHY | 670 kbit/s |

- iOS minimum connection interval is 15 ms, central and peripheral (WWDC17 slides).
- Peripheral parameter requests to Apple devices must have Interval Min ≥ 15 ms and a multiple of 15 ms ([ADG ch. 57.6](https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf)).
- Android `CONNECTION_PRIORITY_HIGH` maps to 9-12 units (11.25-15 ms) in AOSP ([config.xml](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/heads/main/android/app/res/values/config.xml)). L2CAP channels: `createL2capChannel`/`listenUsingL2capChannel` (API 29) ([BluetoothGatt ref](https://developer.android.com/reference/android/bluetooth/BluetoothGatt)).
- Feasibility of the star, [INFERENCE] from the numbers above:
  - The Host must push about 800 kbit/s through one radio to 5 links. Apple's best single link is 670 kbit/s under ideal conditions, so the full 20 KB/s × 5 does not fit.
  - At 15 ms intervals, 60 messages/s means roughly one message per connection event per Peer. Delivery delay is 0-15 ms plus stack time, and jitter is about one interval.
  - A cut-down stream (a few KB/s per Peer, deltas only) is plausible.
- Cross-platform pitfalls:
  - Someone must take the peripheral role. iOS peripherals advertise only a local name and service UUIDs (28 bytes, foreground only) ([startAdvertising](https://developer.apple.com/documentation/corebluetooth/cbperipheralmanager/startadvertising(_:))).
  - Unconfirmed: whether an Android peripheral can ask an iPhone central for 15 ms.
  - Android's limit on simultaneous connections is not documented.
  - The Bluetooth permission prompt on both platforms.
- Plugins: [`@capacitor-community/bluetooth-le`](https://github.com/capacitor-community/bluetooth-le) is maintained, but "only supports the central role". No maintained Capacitor peripheral or L2CAP plugin was found, so this means custom native code.

**(a) Bluetooth Mesh (SIG profile).**
- What it is for: managed-flooding networks of many small devices such as lighting and sensors. The advertising bearer carries traffic; a GATT bearer lets "devices not supporting the advertising bearer" participate through a Proxy node ([Silicon Labs](https://docs.silabs.com/btmesh/9.1.0/btmesh-network-optimization/02-bluetooth-mesh-node-principles-and-optimization)).
- Payload: "up to 11 octets for a non-segmented message" (8-10 octets of parameters). Segmented messages carry at most 384 octets in 32 segments ([Mesh Protocol 1.1](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/MshPRT_v1.1/out/en/index-en.html)).
- Latency, from Silicon Labs measurements:
  - below 200 ms round trip up to 6 hops for payloads under 16 bytes ([summary](https://docs.silabs.com/btmesh/10.2.0/btmesh-11-network-performance/05-summary));
  - multicast in a 24-node network with 32-byte payloads spread from 20 to 220 ms;
  - in 192 nodes, about 3 % of packets took over 250 ms ([comparison](https://docs.silabs.com/openthread/2.7.3/mesh-network-performance-comparison/02-comparison-of-results)).
- Throughput, read from the same document's charts: about 4.6 kbit/s at 1 hop for 8-byte unsegmented messages, about 1.5 kbit/s for 96-byte payloads. That is roughly 0.2-0.6 KB/s against 20 KB/s needed per Peer.
- Phones as nodes:
  - "Neither iOS or Android support BLE mesh directly" ([Nordic DevZone](https://devzone.nordicsemi.com/f/nordic-q-a/52369/sending-a-message-to-a-ble-mesh-node-through-advertising)).
  - An iOS app can only advertise a name and UUIDs. Android's `AdvertiseData.Builder` offers only service UUIDs, service data, manufacturer data, solicitation and TDS ([ref](https://developer.android.com/reference/android/bluetooth/le/AdvertiseData.Builder)). Neither can emit the mesh advertising types.
  - So phones join only as GATT clients of a hardware Proxy node. A "mesh of phones" becomes a BLE star around a dongle, with mesh overhead on top.
- Clock: the mesh Time Server model exists for scheduling. Its uncertainty "increases for every hop" ([Nordic](https://nrfconnectdocs.nordicsemi.com/ncs/latest/nrf/libraries/bluetooth/mesh/time_srv.html)).
- Verdict: unsuitable for the state stream and for game-grade clock sync.

**(b) Plain BLE as a side channel for the clock and small urgent events.**
- Advertisements:
  - Android's fastest advertising interval is about 100 ms (`INTERVAL_MIN`/`INTERVAL_LOW` = 160 × 0.625 ms) ([AdvertisingSetParameters](https://developer.android.com/reference/android/bluetooth/le/AdvertisingSetParameters)).
  - Every advertising event adds a random advDelay of 0-10 ms (`T_advEvent = advInterval + advDelay`, [Core 5.4 Link Layer](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/low-energy-controller/link-layer-specification.html)).
  - iOS cannot put custom bytes into adverts.
  - Result: about 100 ms delivery with ≥ 10 ms built-in jitter. Fine for "game starting", useless for 60 Hz or clock sync.
- Connection-based notifications: delivery waits for the next connection event (≥ 15 ms on iOS), so one request/response takes about 1-2 intervals. [INFERENCE] NTP-style offset error is bounded by the path's one-way asymmetry, which is up to one interval here (≈ 15 ms). The real-phone logs show 4-14 ms RTT on the direct Wi-Fi pair, which is already as good or better. **A BLE side channel does not improve the clock.**
- What it could buy: path diversity. The observed failure is a silent loss of Host→Peer UDP on the iPhone hotspot. A BLE link could carry keepalives and small, already-timestamped events ("ball enters Device 3 at T+120 ms"), detect the Wi-Fi stall and keep play alive at reduced fidelity. Scheduling events ahead on the shared clock makes 15-30 ms of BLE latency tolerable. [INFERENCE]
- Costs: a second transport with peripheral code on both platforms, an extra permission prompt, and 2.4 GHz coexistence with Wi-Fi on the same phone (Unconfirmed how much it hurts).

**(c) Raspberry Pi as BLE central or broadcaster.**
- As central with phones as peripherals: the Pi cannot go below the iOS 15 ms floor (WWDC17), and one radio still serves 5 links. Throughput math as above. It removes the "who is central" question across platforms; it adds hardware.
- As broadcaster of time beacons: still subject to the 0-10 ms advDelay. Phones see scans when the OS schedules callbacks. [INFERENCE] No better than (b) for clock sync. Periodic advertising (fixed schedule) is a BT 5 feature, but Unconfirmed whether iOS or Android apps can sync to it.

## 5. Wi-Fi Direct, LocalOnlyHotspot, and joining from iOS without Settings

- iOS has no Wi-Fi Direct API. TN3111 lists only Wi-Fi Aware and Apple peer-to-peer Wi-Fi under peer-to-peer ([TN3111](https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview)).
- An Android Wi-Fi Direct group owner "essentially creates an access point that can accept connections from legacy clients" ([WifiP2pManager.createGroup](https://developer.android.com/reference/android/net/wifi/p2p/WifiP2pManager)). Since API 29 the app can set the group's name ("DIRECT-xy…") and passphrase ([WifiP2pConfig.Builder](https://developer.android.com/reference/android/net/wifi/p2p/WifiP2pConfig.Builder)). An iPhone can therefore join as an ordinary Wi-Fi station.
- `LocalOnlyHotspot` (API 26): "a local only hotspot that an application can use to communicate between co-located devices… will not have Internet access" ([WifiManager](https://developer.android.com/reference/android/net/wifi/WifiManager)). The app receives SSID and credentials, and "communicating this information is up to the application". It may fail while tethering is on, and the user can stop it in Settings.
- iOS side: `NEHotspotConfigurationManager` with `joinOnce` temporarily moves the iPhone to a given network. "The user must explicitly authorize" it, with one system prompt and no Settings app ([Wi-Fi configuration](https://developer.apple.com/documentation/networkextension/wi-fi-configuration), [TN3111](https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview)). It needs the Hotspot Configuration capability.
  - Google notes that location authorization must be granted or iOS "will silently reject Wi-Fi Hotspot join requests" ([Nearby Swift get started](https://developers.google.com/nearby/connections/swift/get-started)).
  - Plugin: [`react-native-wifi-reborn`](https://github.com/JuanSeBestia/react-native-wifi-reborn) (`connectToProtectedSSID`, pushed 2026-10) exists for React Native. For Capacitor none was confirmed maintained.
- Does it remove today's manual steps? Mostly, if an Android phone owns the network:
  - Host app starts the network and shows a QR code with SSID and password; the Peer app scans it and taps one "Join" prompt.
  - No Settings, no cellular plan, no internet; Nostr signaling is replaced by local discovery.
  - The iPhone cannot be the access point: iOS has no API to start Personal Hotspot.
  - Unconfirmed: the iPhone Camera app joins standard `WIFI:` QR codes since iOS 11. Only secondary sources were found ([example](https://www.idownloadblog.com/2018/03/23/how-to-join-wi-fi-network-iphone-camera/)). If true, iPhone Peers could join without any app.

## 6. Cost side

- Apple Developer Program: 99 USD per membership year ([Apple](https://developer.apple.com/programs/whats-included/)), plus App Review for every update.
- Google Play: personal accounts created after 2023-11-13 must run a closed test with at least 12 testers opted in for 14 continuous days before production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)).
- Android sideloading is also gated now. Developer verification is enforced since 2026-09-30 in Brazil, Indonesia, Singapore and Thailand, and globally in 2027. A no-ID "limited distribution" tier covers up to 20 devices ([Android developer verification](https://developer.android.com/developer-verification/guides)).
- The "no install, scan a QR code" pitch breaks for whoever must install. Option G keeps the damage smallest: only the Android Host must install, and iPhones only need a thin joiner.
- App Clips (iOS):
  - May "configure Wi-Fi networks using" the Hotspot Configuration entitlement.
  - "Advanced networking features like Bonjour and low-level networking APIs… aren't available". Network framework is available.
  - NearbyInteraction gives no functionality; Bluetooth connections cannot persist in the background.
  - Physical invocations (QR codes) keep the 15 MB size limit unless using the App Store Connect demo link.
  - A full app must exist ([App Clip functionality](https://developer.apple.com/documentation/appclip/choosing-the-right-functionality-for-your-app-clip)).
  - Unconfirmed: whether Wi-Fi Aware pairing UI or AWDL peer-to-peer work inside an App Clip.
  - [INFERENCE] An App Clip that scans the Host's QR code and calls `NEHotspotConfiguration` fits the documented limits.
- Android Instant Apps: "Starting December 2025, Instant Apps cannot be published through Google Play, and all Google Play services Instant APIs will no longer work" ([Google Play Instant](https://developer.android.com/topic/google-play-instant/getting-started/instant-enabled-app-bundle)). There is no Android counterpart to App Clips.

## What I could not find out

- Any public demonstration, by Apple, Google or a third party, of an iPhone↔Android Wi-Fi Aware data path from ordinary apps. Also whether Android 17 QPR2 framework-offloaded pairing interoperates with iOS.
- Which Android phones return `isAwarePairingSupported() == true`. The only list found is secondary.
- Whether the Wi-Fi Aware entitlement needs Apple approval (Espressif and the Oct 2026 forum thread disagree). Also whether any region disables it.
- Published latency or jitter for Wi-Fi Aware `realtime` mode, AWDL peer-to-peer or Nearby Connections. None found.
- Whether Host→Peer UDP over an Android LocalOnlyHotspot or Wi-Fi Direct group with iPhone members avoids the 80 % stall seen on iPhone Personal Hotspot. Not measured.
- Whether iOS keeps a no-internet `joinOnce` network up for a whole Session. One current forum thread title reports intermittent iPadOS disconnects after `NEHotspotConfigurationManager` joins ([forum 854957](https://developer.apple.com/forums/thread/854957), not read).
- Whether the Nearby Swift SDK talks to Android Nearby offline; Google does not document it.
- Whether LocalOnlyHotspot members can reach each other directly or only the access-point phone. [INFERENCE] Design for the access-point phone being the Host.
- Android's simultaneous-BLE-connection limit; app-level BLE receive timestamps on iOS.

## Ranked recommendation for this project

Assumptions: 2-6 phones, mixed iOS and Android, low latency, hobby-scale maintainer.

1. **Prototype first: an Android-owned local-only network.** Use `LocalOnlyHotspot`, or a named Wi-Fi Direct group for a stable SSID. The Android phone is the Host; Peers join from a QR code. iPhones join via `NEHotspotConfiguration` in a thin native shell or an App Clip; Android Peers join via a QR code or Nearby. Run the existing protocol over plain UDP or WebRTC with local signaling.
   - It uses only stable public APIs (API 26/29, iOS 11+).
   - It needs no pairing and no internet.
   - It replaces today's Settings dance with one "Join" tap.

   What has to be true:
   - (a) Host→Peer UDP to iPhones on an Android access point does not stall the way it does on the iPhone hotspot. **Test this first with zero code:** a manual Android Settings hotspot with today's PWA and an Android Host.
   - (b) iOS keeps the no-internet network joined for a whole Session.
   - (c) At least one Android phone is present in every Session.
   - (d) The maintainer accepts 99 USD/year, App Review and the Play closed-test rules, or the 20-device sideload tier.
2. **All-iPhone Sessions:** Network framework with `peerToPeerIncluded` (AWDL) in the same iOS shell. It works offline and without pairing, on every iPhone, and covers the case option 1 cannot. Avoid MultipeerConnectivity: it is deprecated in Xcode 27.
3. **Wi-Fi Aware: watch, do not build yet.** It becomes the best single cross-platform answer once anyone shows an iPhone↔Android data path, for example through Android 17 QPR2 offloaded pairing or Google opening its iOS Wi-Fi Aware medium. Even then each Peer pays a one-time PIN pairing per Host.
4. **Nearby Connections:** fine for all-Android Sessions; unproven as the bridge to iPhones.
5. **BLE:** use it only for discovery, handing over credentials, or an optional backup for small timestamped events. It is not the data path, and it brings no gain for clock sync. A Raspberry Pi does not change this.
6. **Bluetooth Mesh:** drop it. It delivers about 0.5 KB/s at 20-250 ms, and phones cannot even be mesh nodes without a hardware proxy.
