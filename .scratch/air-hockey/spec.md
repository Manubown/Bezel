# Air Hockey — two Tiles facing each other, 2D paddles, prediction under rotation

Status: ready-for-agent
Created: 2026-11-07
Slug: air-hockey · id `mgc.air-hockey` · package `@mgc/air-hockey` · dir `games/air-hockey`

## Problem Statement

Pong's paddles move on one axis and its Tiles all share `rot: 0`. A game where each Player's phone is turned toward them (`rot: π` on the far Tile) and the paddle follows the finger in two dimensions exercises `Surface` rotation on input and drawing, puck–paddle collision with a moving circle, and view extrapolation when the puck crosses a rotated Tile.

## Solution

Two phones end to end; each Player's goal is on their own far edge; the paddle is a disc that follows the finger (bounded to the Player's half); the puck is a disc with friction and restitution; a goal scores; first to `AIR_HOCKEY.win` wins. A bot moves its paddle toward an intercept with bounded speed and seeded error.

## Implementation Decisions

- Manifest: `tiles {1,2}`, `controllers {0,0}`, `players {2,2}`, `bots: true`, `templates: ['row', 'column']`, `tickHz: 60`.
- The table is the Tiles' common band as Pong's `table()` computes it (copy the idea, not the code: every Game imports `@mgc/sdk` only); goals are centred on the two short edges; a Player's half is the half nearer the Tile they are seated at (`Player.deviceId`), so the game works whether the table runs along x (row) or y (column).
- Rotation: nothing in the game may assume `rot === 0`. Build and test with the far Tile at `rot: Math.PI` and with `rot: 0`; the SDK's `Surface` maps input and the canvas, so the game should not have to care. Record in the friction log whether that held, and that no lobby template produces a rotated Tile (`packages/layout/src/templates.ts`), with the template or HUD control you would want.
- Paddle: the finger's world position, clamped to the Player's half and the table; paddle velocity (from the last two inputs) transfers to the puck on impact. Puck: `AIR_HOCKEY.friction` per second, `restitution` at walls, max speed. A puck slower than `AIR_HOCKEY.stall` for 3 s is re-served.
- Views: extrapolate the puck by `now − t` with wall reflection as Pong does; draw the goals, the centre line, both paddles and the puck in world mm; the score near each Player's own edge, drawn upright for that Player (on a `rot: π` Tile the SDK's transform already turns the drawing: verify, and record).
- Bots: as Pong's, with 2D intercept.

## Testing Decisions

- `createTestMatch`: a row Match with the second Tile `rot: 0`, and the same with `rot: Math.PI` (hand-built `MatchInfo`); the Tile-local finger position must map to the same world point in both (test the view's input through `t.input` at world coordinates, and assert the paddle lands where the finger is); the puck reflects off walls, scores in a goal, re-serves toward the scored-on Player; a paddle hit transfers velocity; a bot returns a straight puck; first to `win` ends with ranking.
- Browser smoke: dev server port 5184; two tabs, row template; drags move the paddle on both views; a goal updates the score on both; the puck crosses the bezel smoothly.

## Out of Scope

Four-Player tables, a third Tile in the middle (the manifest allows 1–2; record if 3 would have been easy).
