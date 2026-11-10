# 03: A Peer's log says how the Host's states arrived, second by second

**What to build:** During a Match, each `tick` line of a Peer's session log carries the count of state frames that arrived in that second, the longest gap between two consecutive ones, and how old they were on arrival. A delivery stall, which until now hid inside a per-second frame count, is then one number in the log. Spec D4.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Several arrivals in one second: `n`, `ageMin`, `ageAvg`, `ageMax`, rounded to 0.1 ms
- [x] A silence that spans tick lines is reported once, as `gap`, on the line of the second in which the next state arrives
- [x] The first state of a Match contributes no gap; a second whose only arrival is that one has `gap: 0`
- [x] A second without arrivals has no `state` key; the sums start afresh after every line
- [x] The PWA reports a Peer's state frames to the recorder; the Host's own view (in-process) is not measured

## Comments

### 2026-11-10, RecorderStateStats (recorder) and Main (wiring)

**Changed**
- `apps/pwa/src/recorder.ts`: `Recorder.state(matchId, at)`; the `tick` line gains `state: { n, gap, ageMin, ageAvg, ageMax }`. The recorder keeps the last arrival only (its Match and time), so a different Match starts a new sequence.
- `apps/pwa/src/main.ts`: the Match channel's handler calls `rec.state(current.matchId, frame.at)` for each state frame a Peer takes from its Host.
- `docs/guide/running-on-phones.md`: the `tick` row and how to read `state`.

**Verified**
- `pnpm vitest run apps/pwa/test/recorder.test.ts`: 5 tests passed (3 existing, 2 new: figures within and between seconds; a 2.3 s gap on the later line, a new Match without a gap).
- Browser smoke, two Chromium tabs on the dev server, Pong, 2026-11-10: the Peer's `tick` lines read `state: { n: 60, gap: 33.8–59.2, ageMin: 9.4–9.8, ageAvg: 18.3–19.4, ageMax: 27.4–52.8 }` beside `rx.msg.n: 60`; no `error`, `console` or `match:fault` line on either tab; `device.turn: false` (no setting on this machine).

**Seen in the smoke:** the Host tab drew at 30 fps, so its fixed step ran two ticks per animation frame and the 60 states left in pairs: `gap` about 34 ms, not 17. A Host that draws slowly (the iPhone of run 4 at 22–27 fps) sends bursts of two or three states of which only the last is news. The runtime must not drop the others (`publish` is one frame per call, and a Game may publish changes, not snapshots); a Game that publishes snapshots could publish once per animation frame instead. Not built; the phone run's `gap` figures say whether it matters.

**Reading it:** at 60 states a second an even stream has `gap` near 17 ms and `ageMin` near half the round trip. A pause shows as one large `gap` at the resume (no states are sent while paused).
