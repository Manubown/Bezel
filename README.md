# MobileGameConnect

Open-source platform that turns a group of phones lying together on a table into one shared play surface. Phones join by scanning a QR code; one phone is the host and owns the clock and game state; games plug in as web bundles.

Status: **M2 done, seven Games** — phones join over WebRTC, share a clock and a millimetre Layout, and run Games built on `@mgc/sdk` in-process: Pong, Pass, Tap Race, Snake, Quiz, Air Hockey, Breakout. Next: M3 (sandboxed Game bundles). See `docs/PLAN.md` for the roadmap and `.scratch/sdk-friction-1/spec.md` for what building the Games taught us.

**Developers:** to build a Game, start at [`docs/guide/README.md`](docs/guide/README.md).

## Run

```sh
pnpm install
pnpm dev          # Vite dev server on https://<your-LAN-ip>:5173
pnpm test         # vitest
pnpm typecheck
```

1. Open the printed `https://<LAN-ip>:5173/` on the host phone. The dev cert is self-signed; accept the warning once.
2. Scan the QR on the host with the other phones, or open the same address on them and type the host's code into the "Code" field of the setup sheet (or open `/?room=CODE`). A reloaded host keeps its code.
3. All phones need internet for signaling (public Nostr relays via Trystero); the game data itself flows phone-to-phone over WebRTC on the local network.

## Play without a laptop (hosted build)

Every push to `master` builds the PWA and publishes it to GitHub Pages (`.github/workflows/pages.yml`): open **https://manubown.github.io/Bezel/** on the host phone, and the others scan its QR or type the code. For a table away from Wi-Fi, turn on a phone's hotspot and put every phone on it: the hotspot's mobile data carries the signaling, the game itself runs phone-to-phone on the hotspot. On iOS, Share → "Add to Home Screen" installs it full-screen.

Two builds are live at once: **/Bezel/** is `master`, **/Bezel/stable/** is the commit the git tag `stable` points at, a known-good build to test against when the latest misbehaves. `pnpm stable <ref>` moves the tag. Every phone keeps a session log (connectivity, clock samples, Match events, faults, wire bytes, frame rate); **Export log** on the Host's sheet or **Log** on a Peer's strip shares it as a `.txt` (NDJSON). Details: `docs/guide/running-on-phones.md`.

To build the same thing yourself: `BASE_PATH=/Bezel/ pnpm build` (the sub-path the static host serves it from; default `/`), output in `apps/pwa/dist`.

## Layout

```
apps/pwa/        host + peer PWA: lobby, HUD, runs the picked Game on every phone; finds Games in games/* by itself
packages/core/   transport (WebRTC via Trystero, in-memory for tests), clock sync, sessions
packages/layout/ shape templates, Surface (world mm ↔ screen px)
packages/sdk/    the Game API (defineGame, runMatch), in-process link, test harness (@mgc/sdk/test)
games/           one package per Game; games/_template is the starter (pnpm new-game <slug> "<Name>")
docs/guide/      developer guide; docs/sdk-design.md the SDK contract; docs/PLAN.md research, decisions, milestones
```

## License

MIT
