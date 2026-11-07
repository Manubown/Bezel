# 07: Fault isolation and the close ladder

**What to build:** A bug in a game never crashes the platform. A thrown handler is logged and play continues; a game that keeps throwing, fails to start, or speaks the wrong protocol version closes the Match with a named reason and the phones return to the lobby. Game authors get a `log` that reaches the Host's console and HUD so they can debug on a phone. The screen stays awake during a Match and the draw loop stops when the tab is hidden.

Game-side, every handler call is wrapped: a throw becomes a `fault` frame (`where`, `message`, `stack`) and the pwa receives a `fault` event. Close ladder: `ready.v` ≠ wire version → `close{'version'}`; unknown or out-of-order frame → `close{'protocol'}`; a throw in a factory, or more than three faults in five seconds → `close{'fault'}`; no `ready` within five seconds of opening the link → `close{'link-lost'}`. A throw in `draw` skips the frame; ten consecutive close that view. Bad `setHolder`/`timer` arguments and `publish` after `end` produce a `reject` frame and a log line, state unchanged. `ctx.log(...)` on either side becomes a `log` frame and a `log` event. Every close reaches the pwa as a `closed` event with reason and detail; no exception crosses `runMatch`'s interface. The pwa shows the reason in the overlay and returns to the lobby; it requests a wake lock on the first touch of a Match and the SDK stops `draw` while `document.hidden`.

**Blocked by:** 04 (First Match on phones: Lobby Start runs a Game on every Device)

**Status:** ready-for-agent

- [ ] E2E: a probe host whose `tick` throws once produces exactly one `fault` event and the next tick still runs; four throws within five fake seconds produce `closed{ reason: 'fault' }` on the Host and `onEnd` on every view
- [ ] E2E: a view factory that throws closes only that view with `closed{'fault'}`; the Host and other views continue
- [ ] E2E: a game whose `ready` carries a different wire version is closed with `'version'` before `init`; an out-of-order frame injected into the link closes with `'protocol'`
- [ ] E2E: a link whose game never sends `ready` closes with `'link-lost'` after five fake seconds
- [ ] E2E: `publish` after `end` yields a `reject`/log and no state; `ctx.log('x')` from a view arrives as a `log` event on that Device's pwa
- [ ] Unit: ten consecutive `draw` throws stop the loop for that view; nine do not
- [ ] Smoke: a deliberately throwing tracer handler shows the fault in the Host HUD while Pong keeps running; hiding the tab stops the draw loop (no animation-frame callbacks while hidden)
- [ ] Typecheck and suite green
