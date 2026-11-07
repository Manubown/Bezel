# 06: Pause and resume across Device loss

**What to build:** When any phone in the Match drops, every phone pauses with an overlay naming the missing Device; when it reconnects as the same Device, the Match resumes exactly where it stopped, after the host has re-sent the current state. Nobody plays into a frozen opponent and nothing restarts.

The pwa calls `setPaused({ kind: 'device-lost', deviceId })` on the Session's `onDeviceLost` and `setPaused(null)` on `onDeviceBack`. The host runtime broadcasts `pause` (with `now`) to its host game, every view, and over the net; stops the accumulator and clears it; drops inbound input; emits synthetic `cancel`s for every open pointer; suppresses `draw` on paused views; freezes pending timers with their remaining delay. On resume it sends `resume` with a fresh clock frame, re-posts the retained broadcast and per-Device states to every view before the first tick, then resumes ticking. Hosts and views receive `onPause(reason)` / `onResume(now)`; a game that ignores both is still correct. The pwa overlay shows the pause reason and clears on resume.

**Blocked by:** 05 (Playable Pong: input, scoring, end)

**Status:** ready-for-agent

- [ ] E2E: disconnecting a Peer from the in-memory hub pauses the host game and all four views (each sees `onPause` with that Device's id); no `tick` and no `state` arrives while paused, even as fake time advances
- [ ] E2E: a touch held down at the moment of pause produces a synthetic `cancel` at the host; input sent while paused is dropped
- [ ] E2E: reconnecting with the same `deviceId` under a new peer id → `onResume` everywhere, every view receives the retained state *before* the next tick's state, the Peer's inputs after resume arrive on the new connection
- [ ] E2E: a `publish` made while paused is retained and is what views receive on resume
- [ ] Pong: `onResume` re-publishes; the ball continues from its paused position, not from a serve
- [ ] Smoke (two tabs): close the Peer tab mid-rally → Host overlay "waiting for <name>", ball frozen; reopen the join URL → both resume mid-rally
- [ ] Typecheck and suite green
