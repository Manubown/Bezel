# Breakout on a grid — shared bricks over many Tiles: state size and fan-out

Status: ready-for-agent
Created: 2026-11-07
Slug: breakout · id `mgc.breakout` · package `@mgc/breakout` · dir `games/breakout`

## Problem Statement

No Game has run on the grid template with four Tiles, published a state with hundreds of objects, or had every Tile show a different part of a large shared playfield. Breakout's brick wall is the natural large state, and a ball that crosses every Tile exercises the four-way fan-out at 60 Hz.

## Solution

Co-operative Breakout: bricks fill the top of the whole surface; each Player's paddle sits at the bottom of their own Tile and follows their finger along x; one ball (two after the first 20 bricks); a ball lost below any Tile costs a shared life; clearing the wall wins, three lost balls ends the Match. Bots play the paddles nobody holds.

## Implementation Decisions

- Manifest: `tiles {1,4}`, `controllers {0,0}`, `players {1,4}`, `bots: true`, `templates: ['row', 'grid']`, `tickHz: 60`.
- Paddles: one per Tile along the bottom row of Tiles (the Tiles whose bottom edge is `bounds.y + bounds.h` within a tolerance); a bottom Tile that seats a human follows that human's finger, any other bottom-row paddle is a bot. Non-bottom Tiles are field only. Record in the friction log which Tiles seat nobody with the lobby's two slots and how that felt in a 2×2 grid.
- Bricks: a grid over the top `BREAKOUT.wallFraction` of `bounds`, laid out to skip the gaps between Tiles (a brick that would straddle a gap is not placed); the wall is `Uint8`-like but must be JSON: publish bricks as a string of `0`/`1` per row (or a number array), and record the measured bytes per frame and the resulting Host upload at 60 Hz × 3 Peers. Publish bricks only when they change: keep two streams in one state object (`{ world: {balls, paddles, lives}, wall?: ... }`) with `wall` present only on change, and have views keep the last wall; record whether the SDK made that awkward (`latest()` returns only the last state).
- Ball: reflect on walls and bricks (axis chosen by overlap), on paddles by hit offset as Pong does; speed up every 10 bricks.
- Views: bricks, balls, paddles in world mm; lives and bricks-left on every Tile's top-left; extrapolate the balls by `now − t`.

## Testing Decisions

- `createTestMatch` over a hand-built 2×2 grid (four 70 × 150 Tiles, 4 mm gaps): no brick straddles a gap; the bottom Tiles' paddles follow `d2`'s and `d3`'s fingers along x only; a ball lost under `d2` costs a life on every Device's state; hitting a brick removes it and the next published state carries `wall`, the one after does not; clearing every brick ends the Match with every Player ranked; three losses end it.
- Browser smoke: dev server port 5185; three tabs in a grid; the ball crosses tabs; a brick hit is visible on all three; report the measured frame bytes from the console (`ctx.log` the JSON length once a second on the host).

## Out of Scope

Power-ups, levels, per-Player scoring.
