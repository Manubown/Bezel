# 01: Prefactor: layout package drops its core dependency

**What to build:** The layout package becomes pure millimetre math with no knowledge of the transport, so the Game SDK can depend on it without pulling in networking. Nothing a user sees changes: the M1 arrangement preview still appears on every phone.

The device-size identifier becomes a plain string (it is a Device id, but layout need not know where that type lives). The layout publish/subscribe helpers are deleted and their two one-line calls move into the pwa; the layout validator stays in the layout package as a pure function. The core dependency is removed from the layout package manifest.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The layout package has no dependency on the core package, at the package-manifest level and in imports
- [x] The device-size and device-rect identifier is a plain string type
- [x] The layout validator remains exported from the layout package; the publish/subscribe helpers no longer exist anywhere
- [x] Existing layout tests pass unchanged
- [x] Typecheck and the full test suite are green
- [x] Smoke: host tab + one peer tab still show the row/grid preview with the same placement hints as before

## Comments

### 2026-11-07

**Changed**
- `packages/layout/package.json`: removed the `@mgc/core` dependency; `pnpm-lock.yaml` updated (`packages/layout: {}`) via `pnpm install --no-frozen-lockfile` (plain `pnpm install` runs frozen in this environment).
- `packages/layout/src/types.ts`: dropped the `PeerId` import; `DeviceSize.id: string` (`DeviceRect` inherits it). `isLayout` (with its private helpers) moved here unchanged, per `docs/platform-design.md` §4.
- `packages/layout/src/channel.ts`: deleted (`publishLayout`, `subscribeLayout`, `LAYOUT_CHANNEL`).
- `packages/layout/src/index.ts`: exports `isLayout` from `./types`; channel exports removed.
- `apps/pwa/src/main.ts`: local `LAYOUT_CHANNEL = 'layout'`; the host sends with `session.transport.send(LAYOUT_CHANNEL, layout)`; the peer uses `session.transport.onMessage(LAYOUT_CHANNEL, …)` and accepts the message only `from === session.hostId && isLayout(data)`. The wire behaviour is the same as before.

**Verified**
- `pnpm typecheck`: clean (core, layout, pwa).
- `pnpm test`: 2 files, 14 tests passed. `packages/layout/test/layout.test.ts` was not modified (9 tests).
- Smoke, with `pnpm dev` and two headless Chromium tabs (host plus `?room=<code>` peer) over the real Trystero transport: the peer reached "Phone 2 of 2". Switching the host's template gave the same hint in the host roster and on the peer for each one: Row "right of phone 1", Grid "row 1, column 2", Column "below phone 1". Screenshots show the host stage with the "1" grid preview and the peer stage with the "2" grid preview and the moving ball. Neither tab logged a page error.

**Deviations:** None. `isLayout` now lives in `types.ts` instead of a new file, as `docs/platform-design.md` §4 specifies.
