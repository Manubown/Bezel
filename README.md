# MobileGameConnect

Open-source platform that turns a group of phones lying together on a table into one shared play surface. Phones join by scanning a QR code; one phone is the host and owns the clock and game state; games plug in as web bundles.

Status: **M0** — two or more phones join a room over WebRTC and share a synchronized clock (visible as a metronome). See `docs/PLAN.md` for the roadmap.

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

## Layout

```
apps/pwa/        host + peer PWA (Canvas2D)
packages/core/   transport (WebRTC via Trystero, in-memory for tests), clock sync, sessions
docs/PLAN.md     research, decisions, milestones
```

## License

MIT
