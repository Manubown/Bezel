---
status: accepted
---

# Web PWA is the only runtime

Phones join a table by scanning a QR code, so install friction kills the party moment and one codebase must cover iOS and Android. We ship a single TypeScript PWA and no native apps. Native would unlock Nearby Connections / Multipeer, but neither gives cross-platform offline P2P anyway (Nearby on iOS is Wi-Fi-LAN only; Multipeer is iOS-only), so "same Wi-Fi or hotspot" is the floor for both options and the browser loses nothing that matters.

## Considered options

- Native apps (Kotlin/Swift) with Nearby/Multipeer: install step, two codebases, no cross-platform offline gain.
- React Native / Capacitor wrapper: still an install, still no transport gain over WebRTC.
