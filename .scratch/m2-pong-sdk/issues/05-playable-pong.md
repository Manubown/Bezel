# 05: Playable Pong: input, scoring, end

**What to build:** Pong is playable on two to four phones in a row. The two outer phones' Players move their paddles by touch; the ball bounces off the top and bottom of the whole table and off paddles, a miss scores for the other Player and serves toward the loser, the first to seven wins, a result overlay names the winner, and every phone returns to the lobby. Pong replaces the tracer Game and imports only the SDK.

SDK input: the view runtime captures pointer down/move/up/cancel on its canvas or root (`touch-action: none`, pointer capture), maps px→mm via the Surface, stamps `t` from the shared clock, coalesces moves to one per pointer per animation frame (down/up/cancel never coalesced), sends one input frame per view per frame, echoes the Device's own inputs to the local view's `onInput`, and honours `input: 'off'`. The host runtime overwrites `deviceId`/`role` from the arriving channel at ingest, enforces down → move* → up|cancel per Device and pointer, drops orphans, and delivers `onInput` in arrival order before `tick`. `Input.world` is world mm on a Tile. `end(result)` closes the Match: `close` frames reach every view, `onEnd` fires, the pwa gets `ended` with the result; later `publish` is dropped. The SDK exports a `createTestMatch({ game, match })` harness over the in-process link with a fake clock and scripted input, exposing tick, input, per-Device state, and result.

**Blocked by:** 04 (First Match on phones: Lobby Start runs a Game on every Device)

**Status:** ready-for-agent

- [ ] E2E: a scripted touch on a Peer Tile reaches the host's `onInput` with that Device's id, `role: 'tile'`, world-mm coordinates equal to the Tile's rect offset plus the local point, and a `t` from the shared clock
- [ ] E2E: 10 moves within one frame on one pointer yield one `move` at the host; a `move` without a prior `down` is dropped; the local view's `onInput` sees its own touch before the host echoes state
- [ ] E2E: `end({ scores })` → every view's `onEnd` and the Host pwa's `ended` event with those scores; a `publish` after `end` reaches no view
- [ ] Pong tests via `createTestMatch`: paddle follows input y and clamps to the Layout bounds; ball reverses at top/bottom; ball reverses on a paddle hit and scores on a miss with a serve toward the loser; the seventh point ends the Match with the winner first in `ranking`
- [ ] Pong's manifest: tiles 2–4, controllers 0, players 2, template row; Pong imports nothing but the SDK
- [ ] Result overlay names the winner by Player name and returns all phones to the lobby
- [ ] Smoke (two tabs, then four): paddles follow the pointer on the outer tabs, the ball crosses every bezel without a visible jump, a game is played to seven
- [ ] Typecheck and suite green
