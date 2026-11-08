# 03: pwa: a Peer keeps its Match through a reconnect; `link`/`reconnecting` in the HUD; lobby wake lock; mesh size in the log

**What to build:** A 3 s connection blip no longer ends the Match on a Peer; the roster and the Peer strip say what the connection is doing; phones stay awake in the lobby; the log can answer H2. Spec D6, D7, D11 in `../spec.md`. Builds on the contracts of tickets 01 (`SessionStatus` `'reconnecting'`, `RosterEntry.link`, 1 Hz heartbeat) and 02 (`MatchHandle.hello()`); code against the contract in `../spec.md` if they have not landed yet, and run the suite once they have.

**Blocked by:** 01, 02 (for the final run; coding may start)

**Files (owned by this ticket):** `apps/pwa/src/{main,rejoin,hud,pause,wake,recorder,lobby}.ts` (`lobby.ts`: only `PeerLobby.follow` and the `SessionStatus` handling; ticket 04 owns the Host lobby's persistence), `apps/pwa/index.html` for the strip/notice markup, `apps/pwa/test/rejoin.test.ts` (new), `apps/pwa/test/lobby.test.ts` only if `PeerLobby.follow` changes break it, `docs/guide/troubleshooting.md`, `docs/guide/phones.md`, `docs/platform-design.md` §3 "Pause and rejoin" paragraph.

**Status:** resolved

## Change

1. `apps/pwa/src/rejoin.ts` (new, pure): `export const REJOIN_GRACE_MS = 30000;` and
   ```ts
   type Rejoin = { status: SessionStatus; lobbyMatchId: string | undefined; currentMatchId: string | undefined; graceExpired: boolean };
   export type RejoinAction = 'keep' | 'hello' | 'stop-link-lost' | 'stop-aborted' | 'none';
   export function decideRejoin(r: Rejoin): RejoinAction
   ```
   Table (D7): no `current` → `'none'`. `reconnecting` or `syncing` after `reconnecting`, grace not expired → `'keep'`; grace expired → `'stop-link-lost'`. `ready` and `lobbyMatchId === currentMatchId` → `'hello'` (once per re-attach; the caller dedupes). `ready` and the lobby names no Match or another → `'stop-link-lost'` (detail "The host phone restarted" when the lobby names no Match and the Host's `deviceId` is the one we had; keep the detail text in `result.ts`'s `describeClose` family if that is where close copy lives). `searching` with a `current` → `'stop-link-lost'` as today (cannot happen after a Host was known, since 01 reports `reconnecting`, but keep the row). `ready` with no `current` and a lobby Match that lists this Device and `!== joined` → the existing `begin` path, not this module's concern. `'stop-aborted'`: `ready`, same Session, lobby Match gone while we were `ready` the whole time (today's "the Host closed it" branch).
2. `main.ts follow()`: replace the two `if`s with `decideRejoin`. `keep`: set `play.paused = { headline: 'Reconnecting to the host…', detail: 'the match goes on when the connection is back' }` (a `reconnecting` notice distinct from the Host's pause notice, which the Peer cannot receive while cut off), start the grace timer once per `reconnecting` entry, `hud.render()`. `hello`: `current.handle.hello()`, clear the notice (the Host's real `pause`/`resume` frames will set `play.paused` from here on). Stops as today with the chosen reason/detail. Clear the grace timer on `ready` and on close.
3. `pause.ts`: `pauseOnDeviceLoss` unchanged in policy (lost → pause, back+synced → resume). `describePause` unchanged. On the *Host*, a `weak` Match Device is not a pause; it is shown in the HUD only (step 4).
4. `hud.ts` / `index.html`: roster rows show the link: `weak` → a "weak connection" marker (text or a dot, no new colours needed), `lost` → today's absent styling. The Peer strip's status text: `searching` "Looking for the host…", `syncing` "Syncing clocks", `ready` as today, `reconnecting` "Reconnecting to the host…". The Host sheet's roster rows read the same `link` field. Keep the "Phone N lost its connection" copy for the pause overlay.
5. `wake.ts`: `keepAwake(): () => void` requests `navigator.wakeLock.request('screen')` on the first `pointerdown`/`keydown` on `document` (the request must be in a user gesture), re-requests on `visibilitychange` → visible, returns the release. `main.ts` calls it once at start (D11); `keepAwakeOnTouch` (Match) stays, but when a Match closes its release falls back to the lobby lock being re-requested on the next gesture, not to no lock. Guard for browsers without `wakeLock` (no throw). The recorder's `tick` line already carries `hidden`; add `wake: boolean` (lock held) to it.
6. `recorder.ts`: the `tick` line gains `peers: number` (transport `peers().length`: how many WebRTC connections this page holds, Host and Peer alike; on a Peer > 1 means the Trystero mesh) and the `roster` line keeps the roster size, so H2 is readable: D6. Log `link` changes as `link` lines `{ deviceId, link }` from `session.onChange` (dedupe on the per-Device value).
7. `lobby.ts PeerLobby.follow`: on `reconnecting` keep the shown state (do not blank the layout; the Host's roster will arrive again); on `searching` blank as today. Re-send the `seat` message on every `ready` (already does, via the status transition).
8. Docs: `docs/guide/troubleshooting.md` gains "Reconnecting to the host…" (what it means, the 30 s grace, what the Host shows meanwhile) and "weak connection"; `docs/guide/phones.md` the wake-lock note (lobby too, needs one tap); `docs/platform-design.md` §3 "Pause and rejoin" rewritten for D7/D8.

## Acceptance

- [x] `apps/pwa/test/rejoin.test.ts`: the full table above, one `it` per row, including "hello only once per re-attach" if the dedupe lives in the module (else in `main.ts`, documented)
- [x] `pnpm typecheck`, `pnpm test` green
- [x] Browser smoke (`pnpm dev`, three Chromium tabs, real Trystero): start Pong (Host + Peer Tiles + a bot or two humans); in the Peer tab run `transport.reset()`-equivalent (expose `window.__mgc = { transport, session }` behind `import.meta.env.DEV` so the console can do it) or toggle DevTools offline for ~3 s. Expected within ~5 s: Host overlay "Waiting for phone 2 · lost its connection", Peer overlay "Reconnecting to the host…", then both resume the same Match with the ball drawn on the Peer (the replay), no lobby flash, no result card. Then let the Peer stay offline > 30 s: it drops to the lobby with the "Connection lost" card; the Host keeps waiting until End. Record the observed timings in the comment.
- [x] Phones: not required here (next live run); say so

## Comments

### 2026-11-08, PwaRejoin (implementation)

**Changed**
- `apps/pwa/src/rejoin.ts` (new, pure): `REJOIN_GRACE_MS = 30000`, the `RECONNECTING` notice, `RejoinAction`, `Rejoin { status, lobbyMatchId, currentMatchId, rejoining, graceExpired, hostId, matchHostId }`. `decideRejoin(r)`: no Match running → `none`; `searching` → `stop-link-lost`; `reconnecting` or `syncing` → `keep`, `stop-link-lost` once the grace ran out; `ready` while `rejoining` → `hello` (lobby names the same Match) or `stop-link-lost` (no Match or another); `ready` otherwise → `none` (same Match) or `stop-aborted`. `linkLostDetail(r)` → `HOST_RESTARTED` when the lobby names no Match and `hostId === matchHostId`, else undefined.
- `apps/pwa/src/result.ts`: `HOST_RESTARTED = 'The host phone restarted'`, appended at the end so the `result.ts:3-17`/`20-27` refs in concepts.md hold.
- `apps/pwa/src/main.ts`: `follow()` (218-252) replaces the two `if`s with a `switch` over `decideRejoin`. `keep` sets `rejoining`, starts one `window.setTimeout(…, REJOIN_GRACE_MS)` per reconnect (`grace ??=`) and shows `RECONNECTING`. `hello` calls `endRejoin()`, `current.handle.hello()` and sets `play.paused = matchPause`. `stop-link-lost` calls `current.stop('link-lost', linkLostDetail(r))` and sets `joined = undefined`. `stop-aborted` calls `current.stop('aborted')`. `current` gains `host` (the Session's Host at `begin`) and `stop(reason, detail?)`. That `detail` replaces the runtime's on the card (`said ?? e.detail`), because `MatchHandle.stop` takes none. `matchPause` keeps the runtime's last pause notice. A `paused`/`resumed` event does not overwrite `RECONNECTING` while `rejoining`. The `closed` handler calls `endRejoin()`, which clears the grace on close. On `ready` the decision is always `hello` or a stop, and both clear it. Also: `keepAwake()` once at start (81), `awake` handed to the recorder, `rec.links(session)` (103), and `window.__mgc = { transport, session }` behind `import.meta.env.DEV` (89). `keepAwakeOnTouch` and its `sleep()` are gone (Deviations).
- `apps/pwa/src/hud.ts`: the roster rows' sync column reads `link` (382-388): `weak` shows the wait dot and "weak connection" in place of the clock numbers. The "disconnected" rows test `link === 'lost'` (418). Peer strip (443-481): "Looking for the host…", plus a new `reconnecting` branch "Reconnecting to the host… · the connection dropped · trying again" with the wait dot. The rest is unchanged. `index.html` is untouched: text and the existing dot colours suffice.
- `apps/pwa/src/wake.ts`: rewritten. `keepAwake(): () => void` requests the lock on `pointerdown`/`keydown` (document, capture) while none is held, and on `visibilitychange` when the page is visible. A refused request is retried on the next gesture. It is a no-op without `'wakeLock' in navigator`. `awake()` (any sentinel held) feeds the recorder.
- `apps/pwa/src/recorder.ts`: `RecorderOptions.awake?()`. The `tick` line gains `wake` and `peers` (`peers().length` of the transport `transport()` wrapped). New `Recorder.links(session)`: one `link { deviceId, link }` line per Device's first entry and per change of its value. It returns the unsubscribe.
- `apps/pwa/src/lobby.ts`: `PeerLobby.follow` behaviour is unchanged: it already blanked on `searching` only (so `reconnecting` keeps the shown state) and sent `seat` on every transition to `ready`. Its comment and the class doc now say so. The line count is unchanged, so `lobby.ts:528-531` in concepts.md holds.
- Tests: `apps/pwa/test/rejoin.test.ts` (new, 11 `it`s, one per row, hello-once included). `apps/pwa/test/recorder.test.ts`: the tick expectation gains `wake: false, peers: 1`, plus a new test for `link` lines (first entry, each change, no line for an unchanged value, none after the stop).
- Docs:
  - `docs/guide/troubleshooting.md`:
    - new "\"Reconnecting to the host…\" on a Peer": what it means, the 30 s grace, the `hello`, what the Host shows meanwhile, the give-up card, the restarted-or-ended ambiguity, the log lines;
    - new "The Host's roster says \"weak connection\" for a phone";
    - "The Match pauses … when a phone sleeps": wake lock from the first tap, 5 s `LOST_MS`, back within 30 s it plays on;
    - "The host phone reloaded": the observed Peer sequence;
    - the live-test "Syncing clocks forever" entry notes the 4 s `SYNC_TIMEOUT_MS` cycle;
    - refs re-anchored: `main.ts:169-170`, `143-147`, `21-22`.
  - `docs/guide/running-on-phones.md`:
    - Network: a gone Host means "Reconnecting…";
    - the strip table: `searching` copy, a new `reconnecting` row;
    - the sheet's roster row: weak/lost;
    - "Screen wake lock" rewritten: page-wide, needs one tap, `wake` in the log;
    - "Losing a phone": 2.5 s weak, 5 s lost, 30 s grace on the Peer;
    - "What a Peer sees": the reconnect card and the restarted card;
    - the log table: `tick` `wake`/`peers`, a new `link` row, the clock at 1 Hz, the `device-lost` wording; reading hints for `peers` and `link`;
    - refs re-anchored: `main.ts:19-20`, `21-22`, `42-47`, `57`, `59`, `80-81`; `hud.ts:443-481`; `wake.ts:9-56`.
  - `docs/platform-design.md` §5:
    - "Pause and rejoin" rewritten for D7/D8: weak is no pause, `RECONNECTING`, the table and how `main.ts` acts on it, the lobby-state-before-`ready` order, cold rejoin with the D8 `hello`;
    - the "Wake lock" bullet now describes D11;
    - the tests paragraph gains `rejoin.test.ts` and `recorder.test.ts`.

**Verified**
- `pnpm typecheck`: green (46.3 s).
- `pnpm vitest run` (= `pnpm test`): 26 files, 182 tests passed (45.4 s). `rejoin.test.ts` ran 11, `recorder.test.ts` 3; `lobby.test.ts` ran its 13 unchanged.
- Browser smoke setup: `pnpm dev` (Vite 7.3.7, `https://localhost:5173`), three headless Chromium tabs (390×844), real Trystero over the public Nostr relays. Host code `GT85`; both Peers were `ready` and synced 3.7 s after opening. Pong on Row with both slots bots and three Tiles: Host phone 1, Peer A phone 2, Peer B phone 3. Before the test, a canvas probe found the ball on A in 13 of 37 samples over 4 s.
- `__mgc.transport.reset()` on A. Times are from the logs, with 0 = A's `peer-leave`:
  - 0.00 s: Host log `peer-leave`, `device-lost`, `match:paused`, `link lost`. Host and B show "Waiting for phone 2 · It lost its connection · the match goes on when it is back"; A shows "Reconnecting to the host… · the match goes on when the connection is back".
  - 0.46 s: Host `peer-join`, `device-back`, `link ok`; A is `syncing`.
  - 0.76 s: A is `ready` and says `hello`. Its card turns to the Host's pause, "Waiting for phone 2 …", from the answer's pause frame.
  - 1.47 s: `match:resumed` on the Host and A; every notice is gone by the next poll (1.65 s).
  - A's log has one `match:started`, then `match:paused` and `match:resumed`: no `match:closed`, no `lobby` line, so no lobby flash and no result card.
  - After the resume the probe found the ball on A in 12 of 36 samples. A's `tick` reads `peers: 2` (Host plus B: the Trystero mesh, D6); the Host's reads `peers: 2`.
- DevTools offline (`emulate({ offline: true })`) on A for 3 s did nothing: no weak link, no pause. Chromium's offline emulation leaves WebRTC data channels alone.
- The long outage therefore used a silent cut: `RTCDataChannel.prototype.send` patched in A's page to drop every send. A goes silent; the Host gives it up and stops answering. Times from the cut:
  - 2.41 s: the Host's roster row reads "weak connection"; no pause.
  - 5.08 s: the Host pauses: "Waiting for phone 2".
  - 10.11 s: A shows "Reconnecting to the host…", 5 s after the Host went quiet.
  - 40.07 s: A drops to the lobby with the card "Connection lost · the platform lost the connection · Tap to close". The Host still reads "Waiting for phone 2", with a "disconnected" row.
  - After healing: A re-attached 6.9 s later (its next reset cycle) and was `ready` at 7.6 s. It cold-rejoined the same Match, and the Host resumed at 8.2 s.
- A 3.5 s cut: the Host's row read "weak connection" with no pause; after healing the clock numbers came back.
- The Host tab reloaded during the Match, the check left over from ticket 04's smoke:
  - B went `reconnecting` at once and A at 1.17 s. Both were `syncing` at 1.75 s.
  - At 2.03 s both were back in the lobby with "Connection lost · The host phone restarted". A's strip read "Phone 2 of 3", ticket 04's restored lobby.
- A cut in the lobby, no Match running: A's strip read "Reconnecting to the host… · the connection dropped · trying again" at 9.6 s, with the layout kept. It was back to "Phone 2 of 3" 0.55 s after healing.
- Wake lock: B's `tick` read `wake: false` until a tap on its lobby, then `wake: true`. The Host's read `wake: true`; it had been clicked.
- Phones: not run here (not required); the next live run covers them.

**Deviations**
- `keepAwakeOnTouch` is deleted, not kept. `keepAwake()` asks on every gesture while it holds no lock, and when the page becomes visible: a strict superset of the Match lock, which was a second sentinel doing nothing. With one page-wide lock, a Match's close cannot leave the page lockless (D11's "releases to the lobby's lock"). `docs/sdk-design.md:357` ("As shipped (M2 07) … from its first touch in a Match until the Match closes") still describes the old lock; it is not in this ticket's files.
- `Rejoin` has three inputs beyond the ticket's sketch:
  - `rejoining`: a reconnect is under way. It tells a re-attach `ready` from a steady one, so the module can tell `stop-link-lost` from `stop-aborted`, and it makes `hello` come once per re-attach. So the dedupe lives in the module; `main.ts` only clears the flag after acting.
  - `hostId` and `matchHostId`, for `linkLostDetail`. That is a second pure export, because `RejoinAction` has only one `stop-link-lost`.
  - `syncing` with a Match running needs no flag: a Match begins only at `ready`, and a Peer leaves `ready` only for `reconnecting` (or for `searching` on `close()`).
- "The host restarted" and "the host ended the Match while this Peer was away" look the same to the Peer: `ready`, the same Host id, no Match in the lobby. Both read "The host phone restarted" (the ticket's rule). Telling them apart needs a Host page epoch on the wire, which is out of this ticket's files. Troubleshooting and platform-design say so.
- After `hello` the notice goes back to the runtime's last pause (`matchPause`), not to `undefined`. The runtime re-announces a pause only when its reason changed (`match.ts:546`), so a Peer already paused for another phone would otherwise lose that notice. A re-attached phone therefore shows the Host's "Waiting for phone N", naming itself, until the resume: 0.7 s in the smoke. That is the Host's true pause, from the D8 answer.
- The grace runs once per reconnect, from the first `keep` to `hello` or the close, not once per `reconnecting` entry. A Peer cycling `reconnecting → syncing → reconnecting` on sync timeouts would otherwise never expire. In the silent-cut smoke the grace fired 29.96 s after A's first `keep` (10.11 s → 40.07 s), with A read as `reconnecting` at every 250 ms poll in between.
- `pause.ts` is untouched: step 3 changes nothing, since `pauseOnDeviceLoss` already pauses on `lost` only.
- `recorder.test.ts` is extended to cover the new `tick` fields and `link` lines; it is not in the ticket's file list.
- Docs outside step 8's three files:
  - `docs/guide/api.md:303` re-anchored (`main.ts:160-204`); `docs/guide/getting-started.md:39` now reads "Looking for the host…".
  - Main's three stale lines in running-on-phones and troubleshooting are fixed: 10–13 s → 5 s `LOST_MS`, clock replies every 5 s → 1 s heartbeat, and the wake-lock sentence.
  - Every `main.ts`, `hud.ts` and `wake.ts` ref in those two guides is re-anchored.
  - `concepts.md` is not touched: Main owns its line 138, and none of its refs moved (`result.ts` was appended to; `lobby.ts` and `pause.ts` kept their line counts).
