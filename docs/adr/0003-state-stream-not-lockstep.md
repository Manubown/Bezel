---
status: accepted
---

# Games publish authoritative state; the platform never requires determinism

The `GameHost` runs the simulation once on the Host and publishes state (any JSON value, game-chosen snapshot or delta, stamped with shared-clock time) whenever it chooses; `GameView`s render the latest state and may extrapolate on their own. The platform does not offer deterministic input lockstep or event-sourcing as a primitive.

Lockstep looks attractive (inputs only, perfect consistency, free replays) but would force every community game author to write a bit-exact simulation across engines: `Math.sin/cos/atan2/pow` differ in the last bits between V8 (Android Chrome) and JavaScriptCore (iOS Safari), so a float sim diverges within seconds on a mixed table unless it uses fixed-point math. It also stalls everyone on the slowest phone and still needs full snapshots for reconnect. Consistency across phones comes from a single authority, not from determinism.

## Consequences

- Turn-based games can still be event-sourced *inside* the game: publish the ordered event log as the state and reduce it in the view. That is a game pattern, not a platform contract.
- Local prediction in a view is optional and entirely game-owned.
- State is JSON in v1; binary payloads are added only if real-phone measurement shows a need.
