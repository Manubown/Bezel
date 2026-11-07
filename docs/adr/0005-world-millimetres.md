---
status: accepted
---

# Games work in world millimetres

The shared play surface is a physical coordinate space measured in millimetres; every Tile is a rectangle in it and every `Input` and published position is in it. A 20 mm ball is 20 mm on every phone, and an object crossing a bezel keeps its physical size and speed. The `Surface` owns the only mm→px conversion, using each Device's `pxPerMm`.

The alternative, letting a game declare abstract units that the platform scales to the Layout's bounding box, gives a uniform look but breaks physical continuity across phones of different density and makes mixed-size tables look wrong at exactly the bezel crossings the product is about. Games that want abstract units scale themselves on top of millimetres.

## Consequences

- `pxPerMm` accuracy is a platform concern (UA heuristic today, calibration later); games never see CSS px.
- Layout templates and swipe alignment both produce millimetre rects, so games are unaffected by how a Layout was obtained.
