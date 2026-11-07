# Seats and bots — the Host decides who sits where, and a Player may be a bot

Status: ready-for-agent
Created: 2026-11-07

## Problem Statement

M2 ships Pong, but the lobby decides the table for you: Tiles are ordered by join order, the two outer phones are the Players, and there is no way to say "this phone is Player 1, that one is just a middle Tile" short of re-joining in the right order. Nor can one person play: Pong needs two humans on two outer phones.

## Solution

1. **Tile order is the Host's choice.** The lobby keeps an explicit Tile order; the HUD moves a Device left/right in the row (or earlier/later in a column/grid). The preview numbers and the placement hints follow. Whoever is on the first and last Tile is a Player (Pong's existing convention), so ordering is how the Host decides which phones play and which are "tiles between".
2. **Seats are in the Match.** `Player` gains `deviceId?` (the Device that seats the Player). Games stop inferring "Player 1 = west Tile" from index and read the seat instead.
3. **A Player slot may be a bot.** The HUD offers a "Bot" toggle per Player slot when the selected Game's manifest declares `bots: true`. A bot Player has `bot: true`, no `deviceId`, an editable name (default "Bot"), and a stable id. Bots count toward the manifest's Player range. The Game's host drives bot Players itself.
4. **Pong supports bots and seat-based sides.** Side 0 (west paddle) is the Player seated at the first Tile, side 1 (east) the Player at the last Tile; a bot takes whatever side is left. The host moves a bot paddle toward where the ball will cross its face at a bounded speed, with a seeded aim error so it can lose. Pong's manifest allows 1–4 Tiles so one phone can play a bot.
5. **Touch presence in Pong.** Transport leave detection is slow (10–13 s). A human Player's side must keep touching: a pointer down, or a touch less than 5 s old, counts as present. A missing human side holds play (ball frozen, paddles live, overlay "<name>, touch your screen" on every Tile) until they touch; the first serve waits for every human to touch once. Bots are always present. Pong-only game logic over the existing `onInput`; the pwa's device-lost pause is unchanged.

## Implementation Decisions

- `@mgc/sdk` types (additive): `Player { playerId; name; deviceId?: DeviceId; bot?: true }`; `Manifest.bots?: boolean` (default false). `MatchInfo` unchanged otherwise. Docs updated (`docs/sdk-design.md` §1/§2).
- Lobby (`apps/pwa/src/lobby.ts`), Host only, ignored while `match` is set:
  - `setOrder(deviceIds)` / `move(deviceId, delta)`: explicit Tile order. Devices not in the order append in roster order; absent Devices are skipped; Controllers are not in the order. Peers see the order through `layout` only.
  - `setBot(slot, on)`: Player slot `slot` (0-based, one per outer Tile in order; with one Tile, slot 0 is that Tile and slot 1 is bot-only) becomes a bot or returns to the seated human. Bot id is `bot:<slot>`; names via `setPlayers` as today.
  - `players` lists seated humans with `deviceId` and bots with `bot: true`; `seatOf` stays.
  - `start(game)`: refuses when a bot is on and `!game.bots` ("Pong does not support bots" style reason); bots count in the Player range; `MatchInfo.players` carries `deviceId`/`bot`.
- HUD (`apps/pwa/src/hud.ts`): per-Device row shows position and ◀ ▶ (disabled at the ends and for Controllers); per-Player slot row shows name field + Bot toggle (toggle only when the picked Game's manifest has `bots`); roster/preview update live.
- Pong (`games/pong/src/index.ts`): sides from seats, not indexes; bot AI in the host `tick` (`PONG.bot = { speed, aimError }`); `onInput` from a Device that seats no side is ignored; result ranking/scores by Player id as today; manifest `tiles: {1,4}`, `bots: true`.
- Pass (`games/pass`) does not declare `bots`; nothing else changes there.

## Testing Decisions

- Lobby tests over `MemoryHub`: `setOrder`/`move` reorder the Layout and the Peer's mirrored `layout`; a Device that leaves and returns keeps its slot; `setBot(1, true)` yields `players[1].bot === true` with no `deviceId`, `players[0].deviceId` = the first Tile's Device; `start` refuses a bot for a manifest without `bots`; `MatchInfo.players` deep-equals on the Peer.
- Pong tests via `createTestMatch`: with Player 1 seated at the *last* Tile the east paddle follows that Device's input; a bot paddle moves toward the ball at most `PONG.bot.speed` mm/s; a bot returns a centred serve; a one-Tile Match with a bot plays a point.
- Smoke (headless, two then three tabs): move the Host to the east end → preview numbers swap and the Host's paddle is on the east; mark Player 2 as Bot → the bot paddle tracks the ball and the human can score; one Tile + bot plays.

## Out of Scope

Difficulty levels; bots for Pass; drag-and-drop ordering; persisting the order across Sessions.
