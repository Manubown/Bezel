# Tap Race — the tutorial Game: Tiles, an event-driven host, timers, bots

Status: ready-for-agent
Created: 2026-11-07
Slug: tap-race · id `mgc.tap-race` · package `@mgc/tap-race` · dir `games/tap-race`

## Problem Statement

`docs/guide/your-first-game.md` needs a Game small enough to read in one sitting that still touches the hooks a real Game uses beyond the template: a timer-driven round structure, targets that appear anywhere on the surface, a result with a ranking, and a bot. It must be buildable from `pnpm new-game` in under 150 lines of `src/index.ts`.

## Solution

Targets (a ring, `TAP_RACE.target` mm radius) appear one at a time somewhere on the surface; the first Player to tap one scores it; after `TAP_RACE.rounds` targets the most wins. A 3-2-1 countdown (`timer`) precedes the first target; each target appears after a seeded random delay (`timer('spawn', …)`), so a Player cannot anticipate. A bot Player "taps" the target after a seeded reaction time (`timer('bot:<playerId>', …)`) with a seeded miss chance, so it can be beaten.

## Implementation Decisions

- Manifest: `tiles {1,4}`, `controllers {0,0}`, `players {1,4}`, `bots: true`, `tickHz: 0` (event-driven: `onInput`, `onTimer` only; no `tick`).
- A tap counts for the Player seated at the tapped Tile (`Player.deviceId === Input.deviceId`). A target therefore only appears on a Tile that seats a human Player, or on any Tile when only bots remain; a tap on a Tile that seats nobody does nothing. Record in the friction log that the lobby seats Players at the first and last Tile only (`apps/pwa/src/lobby.ts:9-10`), so middle Tiles are dead ground.
- State: `{ phase: 'countdown' | 'play' | 'done', count?: number, target?: { x, y, deviceId, since }, scores: Record<PlayerId, number>, round: number, lastHit?: { playerId, x, y } }`; publish on every change only.
- Randomness from `match.seed` (mulberry32 as Pong does; copy it, every Game imports `@mgc/sdk` only).
- Views: draw the target ring with a shrinking inner ring showing its age, the scores along the Tile's top edge, the countdown digits large on every Tile, and "<name> wins" at the end until the platform closes the view. Canvas only (`draw`), no `mount`.
- `ctx.log` the hits, as Pass does, so the HUD's game log shows them.

## Testing Decisions

- `createTestMatch` over a 3-Tile row with Ann at `d0`, Bo at `d2`: countdown ticks on the timer; the first target appears on `d0` or `d2`, never `d1`; a tap inside the ring on the right Tile scores and spawns the next, a tap outside or on the wrong Tile does not; after `rounds` targets the result ranks by score; a bot in slot 1 scores targets on its own after its reaction time and sometimes misses (seed-pinned); pause freezes the spawn timer.
- Browser smoke: two tabs on the dev server (port 5181), Host + Peer; one target reachable, tapped on the right tab, score visible on both; a bot run on one tab plays to the end and shows the result card.

## Out of Scope

Difficulty, sounds, Controllers.
