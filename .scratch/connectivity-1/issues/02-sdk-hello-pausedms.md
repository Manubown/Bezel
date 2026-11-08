# 02: sdk: `hello` replay for a Peer runtime (B4) and `pausedMs` on resume (B7)

**What to build:** A Peer runtime that starts or re-attaches mid-Match asks the Host for the current picture instead of waiting for a resume or the next publish; Games learn how long a pause lasted. Spec D8–D9 in `../spec.md`.

**Files (owned by this ticket):** `packages/sdk/src/{wire,match,game,game-side,types,testing,headless}.ts` as needed, `packages/sdk/test/*`, `docs/sdk-design.md` (the wire grammar and the pause section), `docs/guide/api.md` (`onResume`, `MatchHandle.hello`), `docs/guide/concepts.md` if it describes the resume replay. Games are not touched: `onResume(now)` keeps compiling.

**Status:** resolved

## Change

1. `wire.ts`: `ViewUp` (and so `NetUp`) gains `{ v: 1; t: 'hello' }`; `isNetUp` accepts it. `Shared` `resume` gains `pausedMs: number`; `isNetDown` requires it as a finite number ≥ 0 on a `resume`.
2. `match.ts`:
   - Host runtime, in `take(f, from)`: `hello` from a Device in the Match (`roleOf.has(from)`, `from !== me`) → `o.send(holdersFrame(), from)` if any Holder is non-null, then `o.send(f, from)` for each of `retainedFor(from)`, then `o.send(pausedBy, from)` if paused. Not an inbox item; works while paused (it is not input). `hello` from an unknown Device or from the Host's own view link is ignored (the local view's `open()` already replays locally).
   - Peer runtime: in the view link's `open()`, after posting `init` and the local retained states, `o.send({ v: 1, t: 'hello' })`. `MatchHandle.hello()`: Peer only (`!o.authority`), `over` → no-op, else sends the same frame. The Host's `MatchHandle.hello()` is a no-op.
   - `resume`: `pausedMs = clock.sentAt − pausedBy.now` (≥ 0) in the frame and in the game-side `resume` the view/host receives. A Peer runtime forwards the Host's `pausedMs` as received.
3. `game-side.ts` / `game.ts` / `types.ts`: `onResume?(now: number, pausedMs: number): void` on `HostHandlers` and `ViewHandlers`, TSDoc: "`pausedMs`: how long the Match stood still on the shared clock; shift your deadlines by it, or use a timer (timers are pause-aware already)".
4. `testing.ts`: `TestMatch` exposes what it needs for the tests below (`t.hello(deviceId)` if a direct trigger is simpler than restarting a view; prefer testing through the public `createTestMatch` surface: start a view late if the harness supports it, else add the smallest helper and document it in `docs/guide/testing.md`).
5. Tests (`packages/sdk/test`): spec Acceptance 2: (a) a Host publishes a broadcast state and a targeted state for `d2` before `d2`'s runtime starts; after `d2`'s `hello` both are drawn by `d2` and no other Device receives anything new; (b) `hello` from a `deviceId` not in the Match sends nothing; (c) pause for 1500 ms of fake shared time, resume: host and view `onResume` get `pausedMs === 1500`, a `pause` + `resume` pair with the reason changed mid-pause still reports the time since the first pause; (d) a view that opens during the pause (after the pause frame) receives `pausedMs === 1500` as well; (e) `isNetDown` rejects a `resume` without `pausedMs`.
6. Docs: `docs/sdk-design.md` wire grammar lists `hello` (Peer → Host) and `resume.pausedMs`, and the pause section says a Peer runtime replays on `hello`, not only on resume (B4 closed); `docs/guide/api.md` mirrors the TSDoc. Mark B4 and B7 ✅ in `.scratch/sdk-friction-1/spec.md` Part B with the pointer to this ticket.

## Acceptance

- [x] `pnpm typecheck` clean; every Game compiles untouched (`onResume(now)` callers are fine with an extra argument)
- [x] `pnpm test --filter @mgc/sdk` green with the five new clauses; whole `pnpm test` green (Games' tests use the harness)
- [x] `docs/guide/api.md` and `docs/sdk-design.md` updated; `.scratch/sdk-friction-1/spec.md` B4/B7 marked

## Comments

### 2026-11-08, SdkHelloPause (implementation)

**Changed**
- `packages/sdk/src/wire.ts`: `ViewUp`/`NetUp` gain `{ v: 1, t: 'hello' }` (`isNetUp` takes it); `resume` gains `pausedMs`, and `isNetDown` requires a finite number ≥ 0.
- `packages/sdk/src/match.ts`: `MatchHandle.hello()` (it sends `hello` on a Peer while not over, and does nothing on the Host). A Peer's view-link `open()` sends `hello` after `init`, its own retained states and the pause. In the Host's `take`, `hello` goes to `answerHello(from)`, which sends to that Device alone: `holders` if any Holder is set, then `retainedFor(from)`, then `pausedBy` while paused. It is not input, so it is answered while paused too. It is ignored when `over`, when it comes from the Host's own Device, or when the Device is not in `roleOf`. `resume` computes `pausedMs = max(0, clock.sentAt − pausedBy.now)` (`pausedBy.now` is the first pause's time, also after a reason change) and puts it in the frame. A Peer passes the Host's `pausedMs` on to its view as received.
- `packages/sdk/src/game-side.ts`: host and view call `onResume(f.now, f.pausedMs)`. `packages/sdk/src/game.ts`: `onResume?(now: number, pausedMs: number)` on `HostHandlers` and `ViewHandlers`, with the ticket's TSDoc. `onPause`'s note now points at `pausedMs` instead of `pausedAt ??= now()`.
- `packages/sdk/src/testing.ts`: `TestMatch.reload(deviceId)`. A Peer's page reloads: the old `runMatch` stops with `link-lost`, and a new one starts on a fresh screen with a fresh events list and nothing retained. Its view starts from the Host's answer to its `hello`. The Host does not pause. It throws for the Host. Device start is factored into `start(d)`, which the initial loop and `reload` share.
- Tests: new `packages/sdk/test/hello.e2e.test.ts`. Clauses (a), (c), (d) run through `createTestMatch` with a small event-driven recording game; (b) runs over the MemoryHub rig; (e) checks the wire. Existing expectations updated in `pause.e2e.test.ts` (2 tests) and `controllers.e2e.test.ts` (1 test), see Deviations.
- Docs: `docs/sdk-design.md` covers handler signatures, the §2 pause rule (`pausedMs`, a view started during the pause), §3 `MatchHandle.hello()` plus a `hello()` paragraph, the Holders note, §4 grammar (`resume.pausedMs`, `ViewUp`/`NetUp` `hello`) and its flows table (new `hello` row, `holders`/resume rows), §5 "Retention and replay" (replay on `hello`, B4 closed, duplicates harmless), and §8 test lists (`hello.e2e.test.ts`, `t.reload`). `docs/guide/api.md` covers handler signatures and tables, `MatchHandle.hello()`, the wire table and `TestMatch.reload`. `docs/guide/concepts.md` gets the pause table, a `pausedMs` bullet and a reload-replay bullet, and its shifted `match.ts` line refs fixed. `docs/guide/testing.md` gets a `reload` row and a "reloaded phone" bullet. `.scratch/sdk-friction-1/spec.md` B4 and B7 are marked ✅ with a pointer here. With Main's OK, `docs/guide/troubleshooting.md` (owned by 03/04) got only its stale `match.ts` line refs fixed and the "A phone that reloaded mid-Match shows nothing" section rewritten to say B4 is closed.

**Verified**
- `pnpm vitest run packages/sdk`: 6 files, 43 tests passed (was 38; +5 in `hello.e2e.test.ts`), 2.7 s.
  - (a) Before the reload: d0 `[all 1]`, d1 `[all 1, mine 3]`, d2 `[all 1, mine 2]`. After `t.reload('d2')` the new page heard `[all 1, mine 2]`, and after one 20 ms frame `t.drawn('d2')` contains `fillText 'all 1 mine 2'`. The other pages heard nothing new, and the new page's events are `[started]`.
  - (b) Three hellos sent nothing to any Peer and changed neither the Host's own view nor its events and messages: one delivered from `d9`, one injected on the Host's own view link, and the Host's `hello()`. A Controller's `hello()` got `['holders d3=p-ann', 'state 1', 'state 2→d3']`, and d1/d2 got nothing.
  - (c) Pause at t=100 for `d2` lost, reason changed to `platform` at 600, resume at 1600. The host and the d0/d1/d2 views each heard `pause device-lost`, `pause platform`, `resume at 1600 after 1500`.
  - (d) d2 reloaded at 800 during the pause. The new page heard `all 1`, `pause device-lost`, `all 1`, `resume at 1600 after 1500`. Its events: started, paused, resumed.
  - (e) `isNetDown` rejects a resume without `pausedMs` and with -1, NaN, Infinity, `'1500'` or `null`. It accepts 0 and 1500, and `isNetUp` accepts `hello`.
- `pnpm typecheck` (whole workspace) clean, 42.7 s. Games untouched.
- `pnpm test` (whole workspace): 23 files, 162 tests passed, 28.8 s.

**Deviations**
- Harness helper: the harness could not start a view late, so I added `t.reload(deviceId)` rather than `t.hello(deviceId)` or a late-start option. It restarts the page, which is B4's own case (a phone that reloads), and it gives clause (d) a view that opens after the pause frame. It is documented in `docs/guide/testing.md`, `docs/guide/api.md` and `docs/sdk-design.md` §8.
- Clause (b) runs on the MemoryHub rig, not on `createTestMatch`, because `createTestMatch` cannot address a Device outside the Match. The same test also covers the Host's own-view `hello` and the Host's `hello()` no-op, plus a positive control.
- Existing tests now reflect D8. A Peer that rejoins during a pause hears the pause from its hello's answer: events `started, paused, resumed`, view `[5, pause, 5, resume, …]`. It also gets the retained state twice, once from the answer and once from the resume's re-post: `[99, 99, 4]`, and for the Controller `['holder p-ann', 'state', 'pause', 'state', 'resume']`. Before, it "never paused". The old docs line "a view started during the pause gets `onResume` without `onPause`" now holds only if the resume beats the hello's answer, and the docs say so.
- `pausedMs` is clamped to ≥ 0. If the shared clock is re-estimated backwards, the frame still passes the Peer's `isNetDown`.
- `hello` belongs to `ViewUp`, as the ticket specifies. A view game that posts it gets a harmless replay on a Peer; the Host ignores it from its own view; the host link still closes on it with `protocol`. A Peer also says hello at Match start, so a state its runtime already held when its view opened arrives twice. That is documented in sdk-design §5.
- Not done here (ticket 03): the pwa calling `handle.hello()` on re-attach.
