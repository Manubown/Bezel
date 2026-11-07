# 01: Prefactor: layout package drops its core dependency

**What to build:** The layout package becomes pure millimetre math with no knowledge of the transport, so the Game SDK can depend on it without pulling in networking. Nothing a user sees changes: the M1 arrangement preview still appears on every phone.

The device-size identifier becomes a plain string (it is a Device id, but layout need not know where that type lives). The layout publish/subscribe helpers are deleted and their two one-line calls move into the pwa; the layout validator stays in the layout package as a pure function. The core dependency is removed from the layout package manifest.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The layout package has no dependency on the core package, at the package-manifest level and in imports
- [ ] The device-size and device-rect identifier is a plain string type
- [ ] The layout validator remains exported from the layout package; the publish/subscribe helpers no longer exist anywhere
- [ ] Existing layout tests pass unchanged
- [ ] Typecheck and the full test suite are green
- [ ] Smoke: host tab + one peer tab still show the row/grid preview with the same placement hints as before
