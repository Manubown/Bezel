# 04: First Match on phones: Lobby Start runs a Game on every Device

**What to build:** The Host arranges the phones as in M1, sees the two outer phones listed as Players with editable names, presses **Start**, and every phone switches at once from the arrangement preview to a running Game — a trivial tracer Game (the M1 ball, now as a `defineGame` whose host ticks and publishes the ball and whose views draw it) that crosses the bezels under host authority. A phone joining after Start waits in the lobby. Start is refused with a reason when the manifest cannot be satisfied by the phones present.

The pwa gains a `Lobby` module over a `Session` with one interface for both roles: live `layout` preview, `match` (set once, frozen), `onChange`, and Host-only `setTemplate`, `setRole`, `setPlayers`, `start(manifest)`, `close` (no-ops on a Peer, where `layout`/`match` arrive from the Host). `start` validates the manifest (Tile/Controller/Player ranges, minimum Tile size, supported templates), builds `MatchInfo` (matchId, seed, tickHz, players, devices with roles and Tiles, tiles in Layout order, bounds), freezes it and broadcasts it. Player ids are platform-issued persisted UUIDs; default Players for a two-player manifest are the Devices on the two outer Tiles. The HUD renders from the Lobby and the Session and offers template, Player names, Start. The main entry becomes transport → session → lobby → `runMatch` → lobby again when the Match closes; the M1 grid scene is the lobby's stage preview.

**Blocked by:** 02 (Session with Device identity and rebinding), 03 (SDK runtime, verified end-to-end in memory)

**Status:** ready-for-agent

- [ ] Lobby test over a Session on the in-memory hub: `start` throws with a reason for a manifest needing 3 Tiles when 2 are present, and for a minimum Tile size larger than a present Tile
- [ ] Lobby test: after the Host's `start`, the Peer's lobby `match` deep-equals the Host's; `setTemplate` after `start` is ignored; a Device joining after `start` is absent from `match.devices`
- [ ] The tracer Game imports only the SDK and draws nothing until its first state
- [ ] Smoke (two tabs): preview → Start → ball crossing the bezel on both tabs with no visible jump; the Host's own Tile is driven by the same view path as the Peer
- [ ] Smoke: a third tab opened after Start shows the lobby strip, not the Game
- [ ] Typecheck and suite green; M1 preview behaviour intact before Start
