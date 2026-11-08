# 01: core: liveness on the clock channel, `link` in the roster, `reconnecting`, `Transport.reset()`

**What to build:** `@mgc/core` notices a dead connection itself, in 5 s, not when Trystero gives up 11 s later, and a Peer gets itself a fresh connection. Spec D1–D5 in `../spec.md`.

**Files (owned by this ticket):** `packages/core/src/{clock,session,transport,trystero-transport,memory-transport,index}.ts`, `packages/core/test/*`, the `Session`/`Transport` paragraphs of `docs/platform-design.md` §3 and `docs/architecture.md` §2 step 4.

**Status:** resolved

## Change

1. `clock.ts`: `ClockSync` default `periodicMs` 1000 (burst unchanged: 10 × 100 ms). Export nothing new.
2. `transport.ts`: `Transport.reset(): void` with the TSDoc "Forget every connection and rediscover: the others see a leave, then a join, for this id." `MemoryTransport.reset()`: `hub.disconnect(selfId)` then re-register the *same* node (`MemoryHub` gets a `reconnect(node)`/`connect` path that reuses the instance so listeners survive). `MemoryHub` also gains fault injection: `sever(a: PeerId, b: PeerId)` drops every message between `a` and `b` in both directions, silently, no leave event; `heal(a, b)` undoes it. A sever that is still in place when one side `reset`s does not stop the re-join: the new connection passes (heal is implicit for that pair on reset, document it).
3. `trystero-transport.ts`: `reset()` = `void this.room.leave()`, then `joinRoom(config, roomId)` again, `makeAction('mgc')` again, re-set `onPeerJoin`/`onPeerLeave`/`action.onMessage`. `room`/`action` become mutable privates. `connections()` reads the current room.
4. `session.ts`:
   - `RosterEntry.link: 'ok' | 'weak' | 'lost'`; `present === (link !== 'lost')` everywhere an entry is built. Export `WEAK_MS = 2500`, `LOST_MS = 5000`, `SYNC_TIMEOUT_MS = 4000`, and `SessionStatus` with `'reconnecting'`.
   - Host: record `heard[deviceId] = localNow()` on every `clk` request, `clkrep`, `info` and `msg` from that connection (the Host sees `clk` through `serveClock`; add a transport listener on `CLOCK_CHANNEL` in the Session for the stamp, or have `serveClock` take an `onRequest` callback: pick the smaller change). One `setInterval(check, 500)` per Session: a bound Peer with `now − heard > WEAK_MS` becomes `weak`; `> LOST_MS` becomes `lost`: unbind (as `onPeerLeave` does today: `present: false`, `onDeviceLost`, roster published). A `weak` Peer that speaks again is `ok` again (roster published, `onChange`). The Host never calls `reset()`.
   - Peer: `heardHost = localNow()` on every `clk` reply, `roster`, `hello`, `msg` from the Host. The same 500 ms check: Host silent `> WEAK_MS` → the Host's roster entry `weak` (local flip only; `onChange`); `> LOST_MS` → `detach()` + `transport.reset()`, status `reconnecting`. `status` after `attach` that does not reach `ready` within `SYNC_TIMEOUT_MS` → the same detach + reset + `reconnecting`. A transport leave of the Host → detach; status is `reconnecting` if this Session ever had a Host, else `searching`. The Peer's own entry in the roster is what the Host last sent (no local override).
   - `send` on a Peer is dropped unless `ready` (unchanged). `close()` clears the interval.
5. Tests, fake timers, `MemoryHub`:
   - `session.test.ts`: existing tests green; `present`/`link` consistent in the roster assertions (extend the `presence` helper).
   - `liveness.test.ts` (new): spec Acceptance 1 verbatim, one `it` per clause: sever → weak both sides at `WEAK_MS`; lost at `LOST_MS` with `onDeviceLost` on Host and Peer-status `reconnecting`, exactly one hub leave+join for the Peer's id; heal (sever is undone by the reset) → `syncing → ready`, `onDeviceBack`, roster length unchanged, message to that Device arrives; `hello` without clock replies (sever only the `clk` channel: give `sever` an optional `channel` filter) → `SYNC_TIMEOUT_MS` → reset + `reconnecting`; a Peer that never hears a Host stays `searching`; a silent Peer never makes the Host reset (spy on `transport.reset`). Also a `memory-transport.test.ts` clause: `reset()` emits leave then join on every other node and the node's own listeners still fire.
6. Docs: `docs/platform-design.md` §3 "Invariants a caller must know" gains `link`, `reconnecting`, the thresholds, and `reset()`; `docs/architecture.md` §2 step 4 mentions the 1 Hz heartbeat and the states. `GLOSSARY.md` gets no new term (link/weak/lost are field values).

## Acceptance

- [x] `pnpm typecheck` clean (the pwa compiles against the new `RosterEntry` without changes: `present` kept)
- [x] `pnpm test --filter @mgc/core` green, including the six liveness clauses
- [x] `pnpm test` (whole workspace) green: no consumer broke on the union widening of `SessionStatus` (grep `apps/pwa/src` for exhaustive switches on `status`; the lobby's `PeerLobby.follow` compares to `'searching'`/`'ready'` only — leave its behaviour to ticket 03, but it must still compile)
- [x] Browser smoke not required here (ticket 03 does the three-tab run); say so in the comment

## Comments

### 2026-11-08, CoreLiveness (implementation; finished by Main after the session was interrupted)

**Changed**
- `packages/core/src/clock.ts`: `ClockSync.periodicMs` default 1000 (burst unchanged). `serveClock(transport, localNow, onRequest)`: `onRequest(from)` sees each request's sender first and may refuse it (`false` = unanswered). The Session uses it for the heartbeat stamp *and* to leave a dropped Peer's requests unanswered, so a Peer the Host gave up on starves and resets itself.
- `packages/core/src/transport.ts`: `Transport.reset()` with the TSDoc; a no-op after `close()`.
- `packages/core/src/memory-transport.ts`: `MemoryHub.reconnect(node)` (reuses the instance: listeners survive), `sever(a, b, channel?)` / `heal(a, b)`; a reset undoes the sever for that node. `MemoryTransport.reset()` emits leave then join on every other node.
- `packages/core/src/trystero-transport.ts`: `room`/`action` mutable; `reset()` = leave, `joinRoom` again with the same config, `makeAction('mgc')` again, handlers re-wired; `peers()` reads the current room.
- `packages/core/src/session.ts`: `RosterEntry.link` (`present === link !== 'lost'` in `entry()`), `SessionStatus` `'reconnecting'`, exported `WEAK_MS`/`LOST_MS`/`SYNC_TIMEOUT_MS` (also from `index.ts`), one `setInterval(check, 500)` per Session (cleared in `close()`). Host: `hear(peer)` stamps on every clock request, `clkrep`, `msg`; `check()` flips `weak` at `WEAK_MS`, `unbind`s at `LOST_MS` (`present: false`, `onDeviceLost`, roster published); `relink` back to `ok` when a weak Peer speaks. Peer: `hear()` on `hello`, `roster`, `msg`, every clock reply; `check()` flips the Host's entry `weak`, and on `LOST_MS` of silence or `SYNC_TIMEOUT_MS` without `ready` does `detach('reconnecting')` + `transport.reset()`. A transport leave of the Host → `detach('reconnecting')`; `close()` → `'searching'`. The roster the Peer holds is the Host's word except the Host's own entry.
- Tests: `session.test.ts` (5, the Host-leave clause now expects `reconnecting`; `presence` helper reports `link`), new `liveness.test.ts` (6 clauses: spec Acceptance 1 verbatim) and `memory-transport.test.ts` (2: `reset()` leave-then-join with surviving listeners and a no-op after `close()`; `sever`/`heal` incl. the channel filter).
- Docs: `docs/platform-design.md` §3 contract (`link`, `reconnecting`, the constants), invariants (Host leave → `reconnecting`), a new "Liveness" paragraph (D1–D5 as built) and the test list; `docs/architecture.md` §2 step 4 (1 Hz heartbeat, `weak`/`lost`, `reconnecting`, `reset()`). `GLOSSARY.md` unchanged.

**Verified**
- `pnpm vitest run packages/core`: 4 files, 16 tests passed (clock 3, memory-transport 2, session 5, liveness 6), 2.0 s.
- `pnpm typecheck` (whole workspace): clean, 43 s. The pwa compiled against the widened `SessionStatus` and the new `RosterEntry` without changes (`PeerLobby.follow` compares to `'searching'`/`'ready'` only; ticket 03 gives `reconnecting` its behaviour).
- `pnpm test` (whole workspace): 25 files, 170 tests passed, 34.6 s (tickets 02 and 04 included).
- Browser smoke: not run here; ticket 03's three-tab run covers it.

**Deviations**
- `serveClock` grew an `onRequest` callback (the ticket offered this or a second listener); it doubles as the refusal for unbound connections, which the ticket did not ask for but Acceptance 1's "a Host whose Peer is silent never resets" relies on for the inverse: the dropped Peer must be the one to notice.
- `MemoryHub.sever` takes an optional channel filter (the ticket's parenthetical) so the `SYNC_TIMEOUT_MS` clause can starve the clock channel alone.
