# 06: A phone is measured after Safari has applied its Page Zoom

**What to build:** A phone whose Safari keeps a Page Zoom for the site (the Aa menu) gets a Tile of the right size on every load. In run 5 one load of three measured the phone 33 ms before Safari applied the zoom: the Tile was sized for a 390 px page on one 520 px across, everything drew at three quarters of its size, and the row did not line up until the player reloaded (`.scratch/live-test-1/findings.md` §1f).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Device's size is taken once the viewport has been still for 120 ms, at most 600 ms after the page starts
- [x] A resize that lands shortly after the start (the zoom) is waited for; a viewport that never rests does not hold the page up beyond the limit
- [x] Nothing changes for a phone without a zoom except 120 ms more before it joins

## Comments

### 2026-11-11, Main (implementation)

**Changed**
- `apps/pwa/src/device.ts`: `viewportSettled(win, quietMs = 120, maxMs = 600)`.
- `apps/pwa/src/main.ts`: `start()` awaits it beside `claimDeviceId()` before `deviceInfo()`; the `device` log line therefore shows the settled size and zoom.
- `docs/guide/running-on-phones.md`: the Page Zoom note.

**Verified**
- `pnpm vitest run apps/pwa/test/device.test.ts`: 5 tests passed (3 new: quiet from the start, a resize 33 ms in, a viewport that never rests). Whole workspace: `pnpm typecheck` clean, `pnpm test` 28 files, 212 tests passed.
- Not verified on the iPhone 12 that showed it: the next export's `device` line must read `zoom: 1.333` with viewport 520×932 on every load.
