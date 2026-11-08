# Live test 1 (2026-11-07, hosted build) — what the phone logs say

Status: ready-for-human (fixes 1–4 shipped 2026-11-08; 5 in progress; B1 open)
Logs: `docs/liveLogs/` (9 distinct files; the Host's were copied into two folders). Devices by log: Host `4c5a2d` iPhone 15 Pro Max (iOS 18.7, Safari 27.2); Peers `cd877e`/`fdd0e4` = the iPhone 12 (two tabs, 390×699 CSS px), `c49301` iPhone 14 (Safari 26.6.1), `291836` + `9d1921` iPhones (no log exported), `725754` + `68c03d` Android.

## 1. The connection dies 0.2 s after it opens; Trystero reports it 11 s later; repeat (the "trying but isn't" state)

Peer side (`cd877e`, Y2RF; `fdd0e4`, VUU5): `peer-join` → the Host's `hello`/roster arrive → clock reply **q=1, sometimes q=2 or 3** → nothing more → `peer-leave` after **10.1–11.3 s** (36 of 49 Host-side leaves; cd877e: 10.9, 11.2, 10.1, 11.0, 10.8, 10.9, 10.8, 10.9, 11.1 s) → re-join 0.5 s later → same again. The phone shows "Syncing clocks" the whole time (status never reaches `ready` because the 4-sample clock burst never completes).

- 11 s = Safari's ICE `disconnected` (~5–6 s without consent) + Trystero's `disconnectedCloseDelayMs = 5000` (`@trystero-p2p/core/dist/peer.mjs:6,258-262`). So the data channel really stops passing packets within ~200 ms of opening.
- Not a background tab: both phones logged `tick fps 60, hidden false` throughout the loop.
- Not the path's latency: first-sample rtt 6–82 ms on the dying connections, 6–19 ms on the ones that lived.
- When a connection did survive, it was fine: rtt 5–10 ms, clock offset stable, Pong 7:5 over 70 s at 60 fps on every phone, 37.7 KB/s Host upload with 3 phones (matches the predicted 36 KB/s).
- It took the iPhone 12 **3 min 6 s** of looping (21:05:33→21:08:39) to get one connection that stuck (then 270 s stable: Pong, Quiz, Snake ×3, Breakout ×2 all ran on it).
- Android (`725754`, `68c03d`): connected first try, synced, lived 61–111 s (one dropped mid-Pong at 20:52:28 and never came back: the match stayed paused).
- The iPhone 14 (`c49301`) saw **no peer at all for 36 s** after loading (its export at 20:47:42 has only ticks); the Host saw it join 54 s later. Signaling (Nostr relays over the hotspot's cellular) was slow, then the same 11 s loop (11.0 s, 4.2 s).

**Hypotheses, ranked** (the logs cannot split them; ICE stats will):
- H1 ICE pair re-nomination onto a path the Personal Hotspot blocks (host/mDNS `.local` candidates between hotspot clients, or hairpin through the carrier NAT). Prediction: `getStats()` shows the selected candidate pair changing right before data stops, or an mDNS local candidate; iPhones on a normal Wi-Fi router do not loop; a TURN relay (`turnConfig`) stops the loop at the cost of latency.
- H2 iOS Safari drops the data channel when the *other* iPhone-to-iPhone peer connection (Trystero builds a full mesh: every Peer also connects to every other Peer; the Session only uses the Host star) fails its handshake. Prediction: with exactly two phones (Host + one iPhone) the loop is rarer; the 291836↔fdd0e4 connection lifetimes (29.9, 32.4, 33.4 s) line up with 291836's drops on the Host (gaps 32.2, 33.3 s).
- H3 Trystero glare (both sides offer): the losing connection is the one our Session bound to. Prediction: reproducible on two iPhones on any Wi-Fi.

**Next step that settles it**: log `RTCPeerConnection` state transitions and the selected candidate pair (`local/remote candidateType`, `protocol`, mDNS) on connect and on each state change into the recorder; one more live run gives the answer. Independently: expose `turnConfig`/`rtcConfig` through `TrysteroTransport` so a TURN fallback can be switched on per build.

## 2. Pages reloaded under the players' fingers (iOS Safari pull-to-refresh)

- The Host page loaded **14 times in 30 min**, always while visible at 60 fps (so not iOS evicting the tab): 20:49:25 is 26 s into the first Pong match. Each Host reload is a new transport id → every Peer's connection drops, the Match dies, the lobby resets.
- `291836` (a Controller in the Quiz) reappeared under a new transport id every **32 s** (21:10:30, 21:11:02, 21:11:35): a page reload each time. Each one paused the Match and the rejoin resumed it within ~1 s (that part works).
- `index.html:22` has `overflow: hidden` but no `overscroll-behavior: none` and no `touch-action: none` on `body`; DOM Controller views run with `input: 'off'`, so a downward swipe on a Quiz/Pass button page is a Safari pull-to-refresh.
- Fix: `overscroll-behavior: none; touch-action: none` on `html, body`; recommend "Add to Home Screen" (standalone has no pull-to-refresh); the Host's `device` line shows `standalone: false` on every load.

## 3. Safari Page Zoom broke the Tile size on the iPhone 12

`fdd0e4` reported `viewport 520×932` with `screen 390×844`, `dpr 3` from 21:05 on (earlier tabs: 390×699). 520/390 = 4/3: Safari's Page Zoom (Aa menu) at 75 %. `pxPerMm` is a per-UA constant (6.1), so the Layout took the phone for 85 mm wide instead of 64 — a third too large; every world-mm drawing on it was 33 % small and the row did not line up. Fix: scale `pxPerMm` by `screen.width / innerWidth` (portrait; `screen.height` in landscape) in `deviceInfo`, and log the zoom.

## 4. The export's share sheet also produced "Text.txt" stubs

Eleven 37-byte files containing only the log's filename: iOS passes `title` as a separate text item to some share targets (Notes/Files), which saved it as `Text.txt`. The real logs arrived too. Fix: drop `title` from `navigator.share`.

## 5. Games on real phones

- Pong: the two full matches were the good moments (7:5 in 70 s, 7:6 in 80 s). Host upload 31–38 KB/s, 60 fps on every phone.
- Quiz: `players: ["Player 1"]` with two Controllers — the known B1 seating gap, live. Three pauses from the Controller's reloads (§2).
- Snake ×3 on a row of three phones: ended after 4 s (0:0), 13 s (3:1), 5 s (0:2). Both snakes die within seconds on a 3-phone row: spawn heading/speed vs the real bounds needs tuning (and the "25 mm off every Tile" rule against real bezels).
- Breakout ×2: `result {}` (three lives lost) after 13 s and 19 s; no touch-to-start gate, so the balls fell while nobody held a paddle.
- No `match:fault` on any phone; one `Script error.` (cross-origin, no detail) on the iPhone 12 from the 16:56 session.

## Fixes

1. ✅ `index.html`: `overscroll-behavior: none; touch-action: none` on `html, body`; the sheet body scrolls (it was taller than an iPhone 12 and cut the QR off, the Game row out of reach); the Host's bar is a small "Setup" pill in the top-right corner while a Match runs (was a full-width bar over the bottom 15–21 mm); portrait only (`manifest` + `screen.orientation.lock` when installed, a "Turn your phone upright" overlay in a browser tab).
2. ✅ `recorder.ts`: no `title` on share; `ice` lines (connection/ICE state + selected candidate pair with types/mDNS/rtt) on join, every state change and leave.
3. ✅ `device.ts`: `pageZoom()` corrects `pxPerMm` for Safari Page Zoom; `device` line logs `zoom`.
4. ✅ `TrysteroTransport` takes `rtcConfig`/`turnConfig`; `?turn` on the Host adds Open Relay TURN and the QR carries the flag.
5. Breakout per-Tile floors + touch-to-start, Snake survival on rows: `.scratch/{breakout,snake}/issues/02-live-test-fixes.md`. B1 (Quiz seating) still needs the decision.

**Next live run** answers §1: compare `ice` lines of connections that die at 11 s with ones that live (pair types, mDNS, whether the pair changed before `disconnected`), once with and once without `?turn`.
