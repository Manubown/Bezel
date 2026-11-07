# MobileGameConnect — Research & Plan (draft v0)

Open-source platform that syncs a group of phones placed together on a table into one shared play surface, and lets anyone plug in their own games.

## 1. Decisions taken (2026-11-06)

| Axis | Decision | Why |
|---|---|---|
| Runtime | Web PWA (TypeScript) | No install, QR-to-join, one codebase for iOS+Android. Prior art (Junkyard Jumbotron, Phone as a Pixel) proves browser-only tiling works. |
| Topology | Host phone = authoritative server, star over WebRTC data channels | Simplest consistent game state, zero infra. Host leaving ends the session — acceptable for a party game. |
| Alignment v1 | Shape template | Zero sensing; host picks a layout, peers show "place me here". |
| Alignment v2 | Cross-bezel swipe (Pinch, 2012) | Touch coords on both screens + synced clock → exact offset + rotation. The "wow" moment. |
| Games | Core games in-repo + community games as sandboxed web bundles | Same SDK for both; a contributor ships a game as `index.html + manifest.json`. |
| First game | Air-hockey / pong across 2–4 phones | Ball crossing bezels exercises clock sync, alignment, and input routing at once. |

## 2. Prior art (all dead, closed, or research-only)

- Junkyard Jumbotron (MIT, 2011): fiducial markers + one photo → arbitrary layout. Browser-only.
- Phone as a Pixel (CMU/MSR, CHI 2012): color-transition IDs decoded by camera; clock sync by averaging 10 server round-trips.
- Pinch (Tokyo Univ. of Tech, 2012): pinch gesture across bezels gives relative geometry; no camera.
- Mosaic (MIT students, 2013): drag-and-drop layout, had an SDK, dead.
- ScreenWall (2025): closed, static widgets, not games.
- Jackbox / AirConsole: phones as controllers, TV as screen — inverse model.

Nobody has shipped "tiled phones as the game surface + open plugin platform".

## 3. Transport facts that shape the design

- Google Nearby Connections on iOS supports only the Wi-Fi LAN medium; Android↔iOS requires same Wi-Fi regardless. Apple Multipeer is iOS-only. → "truly offline cross-platform P2P" does not exist; same Wi-Fi or a phone hotspot is the floor. Web loses nothing here.
- WebRTC data channels work on iOS Safari and Android Chrome. Signaling needed once per peer:
  - Default: Trystero (serverless matchmaking over Nostr/MQTT/BitTorrent relays) — needs internet.
  - Offline fallback: SDP exchange via QR code (host shows QR, peer scans, peer shows answer QR). Works on a hotspot with no internet. Clunky for >3 phones; keep as fallback only.
- Latency target on LAN: < 20 ms RTT; clock-offset error < 5 ms after NTP-style sampling (min-RTT filter over ~10 pings).

## 4. Core abstractions (the SDK contract)

Decided 2026-11-07 via `/grill-with-docs`; terms in `GLOSSARY.md`, rationale in `docs/adr/0001`–`0005`. **The authoritative interface is `docs/sdk-design.md`** (design-it-twice result); the sketch below is the summary.

```
Session        host + peers, lifecycle; ends when the host leaves (ADR-0002)
Device         stable persisted deviceId (not the transport PeerId); role per Match: tile | controller
Player         match participant {playerId, name}; may hold a Controller (handover is game-driven) or no device
Clock          host monotonic time; peers hold offset; `now()` is shared time
Layout         frozen per Match: Tiles {x, y, w, h, rot} in world mm (ADR-0005)
Surface        world→device px for one Tile; re-exported by @mgc/sdk, applied by the view itself
Input          pointer events captured by the SDK inside the view, mapped to world mm, stamped {deviceId, playerId?, t}
GameHost API   init(ctx) · tick(dt, now) [platform-driven, fixed step] · onInput · onMessage(msg, from)
               · onPause/onResume · ctx.publish(state, to?) · ctx.setHolder(controllerId, playerId) · ctx.end(result)
GameView API   init({role, deviceId, players, devices, layout?, surface?, clock}) · onState(state, t)
               · onMessage · onPause/onResume · ctx.send(msg) ; owns its own canvas/DOM (ADR-0004)
Manifest       {id, name, version, tiles{min,max}, controllers{min,max}, players{min,max}, templates?, minTileMm?, host, view}
```

State is JSON, host-authoritative, no determinism required (ADR-0003). Lobby, Match start/abort, and role assignment are platform UI; games have no lobby. No mid-Match joins in v1; a dropped Device pauses the Match.

A game bundle runs in sandboxed iframes (`host.html` on the Host, `view.html` on every Device) talking to the platform over `postMessage`. In M2 the same seam is crossed in-process.

## 5. Repo layout (pnpm monorepo)

```
apps/pwa/            host+peer PWA (Vite, TS, Canvas2D/Pixi)
packages/core/       session, clock sync, transport (WebRTC + signaling adapters)
packages/layout/     shape templates, swipe-alignment solver, world transforms
packages/sdk/        game API types, GameHost/GameView contexts, in-process bridge (M2) + postMessage bridge (M3), input capture, Surface re-export; depends on layout only
games/pong/          reference game
games/pass/          reference game for a Controller passed between Players (Holders, timers, event-driven host)
games/_template/     starter for community games; `pnpm new-game <slug> "<Name>"` copies it
games/tap-race/      tutorial game (docs/guide/your-first-game.md): timers, seats, bots, event-driven host
games/snake/         tick-driven world over any template, rotated Tiles, state-size measurements
games/quiz/          one board Tile + Controllers with DOM views, targeted publish, Holders
games/air-hockey/    2D paddles, prediction, rotation verified headless
games/breakout/      grid template, large change-only state, fan-out measurements
docs/                this plan, ADRs (docs/adr), agent config (docs/agents)
```

## 6. Milestones

| # | Milestone | Proves | Done when |
|---|---|---|---|
| M0 ✅ | Two phones, QR join, shared clock | Transport + clock sync | **Done 2026-11-07** (two Chromium tabs, same machine): rtt 1.6 ms, offset error ≤ 2 ms, both on the same beat. **Real phones 2026-11-07** (iPhone host, iPhone + Windows Chromium peers, home Wi-Fi, Vite dev server over self-signed HTTPS): rtt 5–8 ms, beats in sync; raw Δoffset 284577.7 ms (Windows) / 288643.5 ms (iPhone), stable. Android still unmeasured. |
| M1 ✅ | Shape-template layout + Surface | Alignment v1 | **Done 2026-11-07** (host + 2 peers, row/grid): grid lines continue across bezels at the expected sub-mm offsets; the shared-time ball is on exactly one tile per sample and crosses tiles continuously. `pxPerMm` is a UA heuristic (Android 6.3, iPhone 6.1, iPad 5.2, desktop 3.78) until calibration. **Two iPhones 2026-11-07**: lines meet across the bezel at the expected ratio. Defect: Safari's bottom toolbar covered the tile's bottom edge (iOS lays out `position: fixed` against the large viewport) → canvas and `DeviceInfo` now sized from `visualViewport`; the peer strip's gradient still hides the top border a little; a standalone (installed) PWA removes both, see M5. |
| M2 | Pong across bezels, built against `@mgc/sdk` in-process | Input routing, host-authoritative loop, the SDK seam, persisted `deviceId` | Ball crosses screens without visible stutter; paddles on outer phones; `games/pong` imports only `@mgc/sdk`; pause on peer drop. |
| M3 | iframe sandbox + `postMessage` bridge; pong unchanged | Plugin model survives serialisation | Pong runs in sandboxed iframes with no source change; a second trivial game built only from `games/_template` with no core/sdk changes. |
| M4 | Cross-bezel swipe alignment | Alignment v2 | Arbitrary 2-phone placement aligned by one swipe, rotation included. |
| M5 | Offline fallback (QR SDP), PWA install, reconnect | Party robustness | Works on a hotspot with airplane-mode internet. |

## 7. Open risks

- Mixed devices: physical DPI must be known to draw at consistent world scale. Browser gives CSS px only; need a device DB or a one-time "measure with a credit card" calibration.
- Screen timeout / browser throttling of background tabs: PWA must request wake lock; game loop in `requestAnimationFrame` on the foreground page only.
- iOS Safari: audio needs a user gesture; WebRTC occasionally drops on network switch. Test early on a real iPhone.
- Bezels and cases: template layouts should include bezel gap parameter; swipe alignment measures it implicitly.
- Four-phone star via host: host upload = 3× state rate. JSON in v1 (ADR-0003); measure on real phones before adding binary/delta encoding.
- Controller handover: a passed phone must make the new holder obvious; the platform stamps `playerId` from the game's `setHolder`, but the UX of "pass to Alice" is game-owned.

## 8. Next steps

1. Done 2026-11-07 on two iPhones (see M0/M1 rows). Still open: an Android phone, and re-check the bottom edge after the `visualViewport` fix.
2. Done 2026-11-07: `/setup-matt-pocock-skills`, `/grill-with-docs` on the SDK seam → `GLOSSARY.md` + ADR-0001…0005, §4 rewritten; `git init` + initial commit; `/codebase-design` design-it-twice on `packages/sdk` → `docs/sdk-design.md` (prerequisites in §8 there: decouple `layout` from `core`, `deviceId` in `core`). Still to do before M2: `/setup-ts-deep-modules`, then `/to-spec` → `/to-tickets` for M2–M5. UI/UX: `/impeccable init` (PRODUCT.md) then new-work for the committed visual world; the current look is M0/M1 scaffolding, not a design decision.
3. Done 2026-11-07 (`.scratch/dev-onboarding`): `games/_template` + `pnpm new-game`, automatic Game discovery (`apps/pwa/src/games.ts`), whole-workspace `typecheck`, `docs/guide/` (getting started, tutorial, concepts, testing, phones, troubleshooting, API). Five Games built in parallel on the SDK with a friction log each (`.scratch/<slug>/friction.md`); the clear-cut findings are fixed (`.scratch/sdk-friction-1/issues/01`), the ones needing a decision are ranked in `.scratch/sdk-friction-1/spec.md` Part B: who is a Player (B1), rotated Tiles in the lobby (B2), the Host's HUD bar over its Tile (B3), rejoin replay (B4). Then M3.
