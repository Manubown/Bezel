# Live test 1 (2026-11-07, hosted build) — what the phone logs say

Status: ready-for-human (fixes 1–5 shipped 2026-11-08, `97cbe3b` + `942ef63`; runs 2 and 3 of 2026-11-08 analysed in §1b/§1c; TURN is now on by default (`?noturn` opts out), the `ice` lines carry every candidate pair, STUN counters and data-channel stats and fire on `weak`/`lost`; next live run must be on the new build and confirms the first-try connect)
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

### 1b. Run 2 (2026-11-08 04:11–04:20 UTC, Host `4c5a2d` + Peer `fdd0e4`, no `?turn`): the path is fine, the data stops anyway

Logs: `docs/liveLogs/new-mgc-825T-host-…` and `client-mgc-825T-peer-…`. Rooms 4T6U then 825T. 13 connection attempts; 2 lived (04:13:09 for 158 s with the Peer tab hidden, 04:18:53 onward: rtt 6–11 ms, clock stable), 11 died. The loop is now 4.2 s instead of 11 s: the Peer's `SYNC_TIMEOUT_MS` (4 s, not `ready`) resets its transport before Safari's ICE notices anything.

What every dying attempt looks like, both sides:
- `ice join`: `connection: connected`, `ice: connected`, selected pair `succeeded`, rtt 4–59 ms, UDP, no mDNS, no IPv6. Host side `local: prflx, remote: host`; Peer side `local: host, remote: prflx`. The surviving attempts show **the same pair types** (04:18:53: rtt 365 ms at join, otherwise identical). The Host's own address is only ever known as peer-reflexive: iOS gathers no host candidate on the hotspot's `bridge100`, so none of the Host's trickled candidates are what the Peer uses.
- **No ICE or connection state change for the whole 4 s**: zero `ice connection`/`ice ice` lines during the loop (the listeners work: `closed` was logged at 04:15:46). The selected pair never went `disconnected`.
- Data: Host tick 1: `tx clk 8, rx clk 8` (every Peer ping arrived and was answered); Peer tick 1: `tx clk 8, rx clk 2`. The Peer got replies q=1 (+8 ms) and q=2 (+107 ms) and nothing after. Host→Peer died between +110 and +210 ms after the channel opened. Peer→Host died at ~+1.5 s (Host tick 2 `rx clk 2`, ticks 3–4 nothing while the Peer kept sending `clk` + `clkrep` at 1 Hz). The 04:18:45 attempt got q=1..4, reached `ready`, and died the same way at 5.3 s (`LOST_MS`).
- **The UDP path is alive when the data is not**: each Peer reset (`pc.close()` in `TrysteroTransport.reset`) produced the Host's `peer-leave` **50 ms later** (04:18:30.934 → 30.985, 35.467 → 35.477, 40.003 → 40.011, 45.044 → 45.080). Trystero has no relay-side leave signal (`leaveAction` is a data-channel action, and a re-announce from a peer whose connection is `live` is ignored, `signal-handler.mjs:463-467`), so the DTLS close / SCTP shutdown crossed the very pair that had carried no application message for 3 s.

So H1 (ICE path change, hotspot blocking the pair) is out, and so is H2's "iPhone↔iPhone mesh" (one Peer only): the pair stays selected, STUN-reachable and able to carry a close, while application messages stop within 0.1–1.5 s of the channel opening, on ~80 % of attempts. What is left sits above UDP: the SCTP association / data channel (Safari), or Trystero's layers (room frames by token, action chunking, handshake/active gating, `peerMap[id] === peer` and `activePeerMap` — a replaced or de-activated peer drops both directions silently and only `console.warn`s). The recorded logs cannot split these; the next ones can:
- `ice` lines now carry `sdp` (which side offered), the pair's STUN counters (`reqSent/respRecv/reqRecv`) and the `data-channel` stats (`state`, `msgSent/msgRecv`, bytes), and are written on `join`, every state change, **every `link` turning `weak` or `lost`**, and at the `leave` (the pc is kept for it). Read at `weak`: `dc.msgRecv` growing while our `rx` is empty → Trystero drops delivered messages; `dc.msgSent` growing and `dc.msgRecv` flat on the far side with `respRecv` growing → SCTP/data channel stall over a live pair; `respRecv` flat → the path after all.
- `console` lines capture `console.warn`/`console.error`: Trystero says "no peer with id … found" when a send targets a non-active peer and "peer error: …" when it kicks one.
- The Peer tab's dying attempts began 0.5–0.8 s after the previous leave; the surviving 04:18:53 one 2.7 s after. Worth checking whether a slow rejoin correlates again.

### 1c. Run 3 (2026-11-08 04:58–05:02 UTC, `docs/liveLogs/withoutandwithturn/`): the old build, but a direction split and a TURN sample

The phones still ran the previous build (no `sdp`/`dc`/`weak` snapshots in these lines), so the new counters are not in; two things are:

- **Without TURN**, Host ↔ Peer `cd877e`: 13 attempts in 70 s (04:59:04–05:00:15), the 13th stuck (`ready`, rtt 7 ms). Same pair types as run 2 on every one. Then the Host reloaded with `?turn` while that Peer had no relay: its old `ready` connection went ICE **`disconnected` on the Host at +6.2 s** (05:00:28.7 join → 05:00:34.9; the Peer was in the share sheet and did not reset) and Trystero closed it at 11.2 s: the 11 s cycle of run 1, now with the ICE line that run 1 lacked. The ICE path does fail its consent checks after ~6 s: the direction split is real. Peer→Host keeps working (the Peer's pings arrive, its `pc.close()` reaches the Host in 50 ms, run 2); **Host→Peer dies** within 0.1–1.5 s of the channel opening (the clock replies stop at q=2, the Host's STUN responses stop, ICE on the Host goes `disconnected` at +6 s). The Host is the hotspot phone, and its only working address is a peer-reflexive one on `bridge100` that WebKit never gathered as a candidate (`local: prflx` on every join): a socket iOS has no interface candidate for, whose outbound packets to the hotspot clients stop after the first few hundred ms while inbound keeps arriving. Mechanism beyond that (iOS flow pinning to the default cellular route, WebKit pruning the port) is not in the logs.
- Host with `?turn` ↔ Peer `fdd0e4` **without** the flag (its old tab): 3 more 4–6 s loops. Host with `?turn` ↔ Peer `cd877e` **with** `&turn` (05:01:29): **connected first time**, `ready` in 0.3 s, rtt 6–8 ms, Air Hockey ran until the export 45 s later. The selected pair was still the direct `host ↔ prflx` one, so the relay was not carrying the data; one sample, mechanism unknown (the extra relay candidates change the Host's gathering, the timing of the checks, and give the Peer a signaled candidate for the Host at all).

**Decision (2026-11-08):** TURN on by default on every phone (`apps/pwa/src/main.ts`; `?noturn` opts out and travels in the QR). ICE prefers the direct pair, so a working hotspot costs nothing; where the direct pair dies, the relay is what ICE can fall back to. Not done: raising `LOST_MS`/`SYNC_TIMEOUT_MS` (5 s / 4 s) to let ICE fail over to a relay pair (~6 s) instead of resetting at 4 s — that is a guess until the `others` list in a `weak` snapshot shows a relay pair alive (`respRecv` growing) while the selected one is silent. Next run on the new build: if the first attempt still stalls, the `ice weak` line's `others` decides whether to widen the window; if `dc.msgRecv` grows while `rx` is empty, the problem is Trystero's layer after all.

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

1. ✅ `index.html`: `overscroll-behavior: none; touch-action: none` on `html, body`; the sheet body scrolls (it was taller than an iPhone 12 and cut the QR off, the Game row out of reach); the Host's bar is a small "Setup" pill in the bottom-right corner while a Match runs (was a full-width bar over the bottom 15–21 mm); portrait only (`manifest` + `screen.orientation.lock` when installed, a "Turn your phone upright" overlay in a browser tab).
2. ✅ `recorder.ts`: no `title` on share; `ice` lines (connection/ICE state + selected candidate pair with types/mDNS/rtt) on join, every state change and leave.
3. ✅ `device.ts`: `pageZoom()` corrects `pxPerMm` for Safari Page Zoom; `device` line logs `zoom`.
4. ✅ `TrysteroTransport` takes `rtcConfig`/`turnConfig`; `?turn` on the Host adds Open Relay TURN and the QR carries the flag.
5. ✅ `942ef63`: Breakout per-Tile floors + touch-to-start, Snake survival on rows: `.scratch/{breakout,snake}/issues/02-live-test-fixes.md`. B1 (Quiz seating): `Manifest.seats: 'ends' | 'controllers'`, the lobby seats one Player per Controller for Quiz; unit tests green, browser smoke pending.

**Next live run** (new build, TURN on): both phones export; the first attempt should hold. If it stalls, §1c says which `ice weak` fields decide the next step.
