# Snake — a tick-driven continuous world over any arrangement, rotated Tiles included

Status: ready-for-agent
Created: 2026-11-07
Slug: snake · id `mgc.snake` · package `@mgc/snake` · dir `games/snake`

## Problem Statement

Pong proves a tick-driven world on a row of Tiles. Nothing has run on a column or grid, nothing has crossed a Tile whose `rot ≠ 0`, nothing has had to keep its objects away from the bezel gaps inside `match.bounds`, and nothing has published a state whose size grows during play. Snake does all four.

## Solution

Each Player steers a snake across the whole surface; food appears only where a Tile is; eating grows the snake; hitting the surface edge, a gap that is not crossable, or any snake body ends that snake; last snake alive (or the longest after `SNAKE.timeLimit`) wins. Bots steer toward food and away from bodies.

## Implementation Decisions

- Manifest: `tiles {1,4}`, `controllers {0,0}`, `players {1,2}`, `bots: true`, `templates` omitted (row, column and grid all allowed), `tickHz: 30` (document why 30 and not 60: state size × fan-out).
- World: continuous mm, heading in radians, `SNAKE.speed` mm/s, `SNAKE.turnRate` rad/s; the snake is a polyline of segment points trimmed to its length. Gaps between Tiles are crossable in a straight line (the snake is briefly invisible); leaving `bounds` kills. Food spawns inside a random Tile's rectangle with a margin, using `Tile.rot` correctly (rotate the point about `(x, y)` as `packages/layout` does; verify with a rotated Tile in a test).
- Steering: a finger anywhere on the Player's own Tile steers that Player's snake toward the finger's world point (continuous); off-Tile input is ignored. Record in the friction log that steering from a Tile that does not seat the Player is impossible, and how it felt in the two-tab smoke.
- Bots: seeded heading changes toward the nearest food, with a lookahead that avoids bodies and bounds; must be beatable.
- State: snakes' points, food, scores, phase; `publish` once per tick. Measure the state's JSON size at a long length and record it in the friction log with the fan-out arithmetic (`(N−1) × tickHz × bytes`).
- Views: the snake as a stroked polyline in world mm, food as dots, score and name on each Player's own Tile; extrapolate the head by `now − t` along its heading, as Pong extrapolates the ball. Canvas only.

## Testing Decisions

- `createTestMatch`: a 2×2 grid Match (hand-built `MatchInfo`, `rot: 0`) and a 2-Tile Match where the second Tile has `rot: Math.PI / 2` (hand-built; the lobby cannot make one, record that). Food never lies in a gap or outside a Tile; a snake dies at the bounds; eating grows by `SNAKE.growth`; a finger on `d0` turns Ann's snake and not Bo's; a bot reaches food; the time limit ends the Match with the longest first.
- Browser smoke: dev server port 5182; two tabs in a column template and three in a grid; the snake crosses from one tab to the next with no visible jump; the Peer's extrapolation looks smooth (screenshots at 2 consecutive frames).

## Out of Scope

Power-ups, wrap-around, more than two snakes.
