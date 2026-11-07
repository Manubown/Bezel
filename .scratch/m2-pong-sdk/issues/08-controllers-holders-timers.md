# 08: Controllers, Holders, timers, and event-driven hosts

**What to build:** The SDK supports the game shapes beyond Pong that the design committed to, so a second game can be written without touching the platform: a Device in hand as a Controller with a private DOM or canvas view; a Game passing a Controller from Player to Player and seeing every input and message from it stamped with the current Holder; pause-aware timers; and a host with no tick loop at all. Pong is unchanged; the Lobby lets the Host mark a Device as a Controller.

View side: `role: 'controller'` views get no Surface or Tile, `screenMm` for their own screen, a `Frame` whose context is in screen millimetres, `mount(root)` for DOM UIs, `holder()` for the current Holder, `onHolder` on change; their `Input.world` is screen mm. Host side: `setHolder(controller, playerId | null)` validated against the frozen roster (reject on a non-Controller or unknown Player), `holderOf`, `onHolder`; the runtime broadcasts `holders` to the host game and every view, and `holders` precedes the first input or message stamped with the new Holder, including an input in flight during the handover. `send(msg)` from a view arrives at `onMessage(msg, from)` with `from` stamped the same way. `timer(tag, delayMs | null)` with same-tag replacement and cancel, firing `onTimer(tag, now)`, frozen across pause. A manifest `tickHz: 0` or a host without `tick` runs event-driven: inbound frames are drained as they arrive, never a `tick` frame. Lobby: `setRole(deviceId, 'controller')` removes that Device from the Layout and the manifest validation counts it as a Controller.

**Blocked by:** 05 (Playable Pong: input, scoring, end), 06 (Pause and resume across Device loss)

**Status:** ready-for-agent

- [ ] E2E (three Tiles + one Controller): before `setHolder` a Controller touch arrives with no `playerId`; after `setHolder(c, 'alice')` it arrives with `playerId: 'alice'` and `role: 'controller'` and `world` in the Controller's screen mm; `holderOf(c)` is `'alice'`; every view's `onHolder` fired before that input was delivered
- [ ] E2E: `setHolder` on a Tile Device or an unknown Player → `reject`, `holderOf` unchanged
- [ ] E2E: a view `send(msg)` reaches `onMessage` with `from.playerId` = the current Holder; a message sent just before a handover is stamped with the previous Holder, one sent after with the new one
- [ ] E2E: `timer('turn', 1000)` fires `onTimer` after 1 s of fake time; re-arming replaces; `null` cancels; a pause at 600 ms and resume later fires it 400 ms after resume
- [ ] E2E: a probe game with `tickHz: 0` receives inputs and messages promptly with no `tick` frames ever
- [ ] Lobby test: a Device marked `controller` is absent from `match.tiles`, present in `match.devices` with that role, and counts toward the manifest's Controller range
- [ ] Smoke (three tabs): mark one as Controller in the lobby, start a probe game whose Controller view is a DOM button that `send`s; the Host HUD log shows the message with the Holder's name after the Host assigns it
- [ ] Typecheck and suite green; Pong source unchanged
