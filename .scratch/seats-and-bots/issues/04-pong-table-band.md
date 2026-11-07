# 04: Pong: the ball leaves short Tiles when a taller Tile sits in the row

**What to fix:** With a Windows browser window as the middle Tile and two phones at the ends, the ball is sometimes invisible: the bot paddle tracks it but no ball is drawn. The `row` layout centres Tiles vertically on the tallest and `bounds` is their union; Pong's `table()` takes `top`/`bottom`/`padLo`/`padHi`/`mid.y` from `bounds`, so the ball bounces across the tallest Tile's full height and crosses the band above and below the phones' screens. The scores (`bounds.y + 8`) and the BOT label sit in that band too, and a paddle can be clamped into it.

Fix: `table()` takes its vertical band from the intersection of the Tiles' y-ranges (x from `bounds` as today); the score and BOT text hang from the band's top. Layout and SDK unchanged.

**Blocked by:** 03 (same file; applied after it lands)

**Status:** resolved

- [x] Pong test (`games/pong/test/table.test.ts`): two 70 × 150 phones around a 340 × 300 Tile; across a 20 s tracked rally the ball's edge and both paddles stay within the phones' band
- [x] Existing Pong tests pass; typecheck and suite green
- [x] Smoke (three tabs, wide Host in the middle): the ball never leaves the phones' vertical range

## Comments

### 2026-11-07

**Changed**
- `games/pong/src/index.ts`: `table()` takes the Match (`bounds` + `tiles`). Across, the table is still the Layout bounds. Up and down it is the band every Tile covers: `y = max(tile.y)`, `yEnd = min(tile.y + tile.h)`; `top`/`bottom`/`padLo`/`padHi`/`mid.y` come from that band, and the new `T.y` is where the scores and the BOT label hang (was `bounds.y`). Tiles with no common band at least a paddle high (a grid) fall back to the bounds. `host` and `view` call `table(match)`; nothing else changed.
- `games/pong/test/table.test.ts` (new): a row as the layout builds it (vertically centred on the tallest, 4 mm gaps, union bounds): two 70 × 150 phones around a 340 × 300 Tile. Both humans hit 13 mm off their paddle's edge for 20 s so the rally steepens; asserts the ball's edge and both paddles never leave the phones' band. Red before the fix (ball 75 mm past the phone's edge, i.e. at the tall Tile's wall), green after.
- `docs/sdk-design.md` §6: the Pong sketch takes its vertical band from the Tiles' common range.

**Verified**
- `pnpm typecheck`: clean. `pnpm test`: 14 files, 85 tests passed (Pong 15 + table 1).
- Smoke: `pnpm dev` on :5177, headless Chromium, real Trystero transport, Host moved to the middle with ▶, slot 1 a bot, the first phone tracking the ball with a held pointer for 30 s; the ball's device-pixel y recorded on every tab by wrapping `CanvasRenderingContext2D.prototype.arc` in the page's main world.
  - Host 1280 × 1000 between two 420 × 640 phones (the reported shape): on the Host the ball ranged 242–1008 of 1250 px, i.e. exactly the phones' band centred in it; on both phones 17–783 of 800 px; 0 of 835 / 1699 / 849 ball draws off-screen. The phone drew its score "1" at the band's top.
  - Host 1280 × 720 between two 420 × 860 phones (the Host the shorter Tile): Host 18–881 of 900 px, phones 105–970 of 1075 px, 0 off-screen.
  - No page errors.

**Deviations / notes**
- Not observed: the bug itself in the browser before the fix (the unit test is the before/after); real phones.
- Headless note for future smokes: `tab.evaluate` runs in the page's main world, `page.evaluate` inside `tab.run` in an isolated one; canvas hooks must go through `tab.evaluate`.
