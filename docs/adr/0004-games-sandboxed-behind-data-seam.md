---
status: accepted
---

# Games are sandboxed iframes behind a data-only seam

A Game is a bundle (`manifest.json`, host entry, view entry) that runs in `sandbox="allow-scripts"` iframes (opaque origin, no network, no shared storage) and talks to the platform only via `postMessage`. The seam therefore carries **data only**: the view receives its role, `deviceId`, Players, Devices, `Surface` (tile rect + px/mm), the shared clock, and published state; it owns its own canvas/DOM and does the world→px transform itself with the `Surface` helper re-exported by `@mgc/sdk`. Pointer input is captured inside the view by the SDK runtime and forwarded to the host as world-coordinate `Input`.

The obvious path, in-process plugins drawing on a platform-owned canvas, is faster to build and is how the M1 demo works. We rejected it because community games must not be able to touch the transport, the roster, other Devices' input, or the host's storage, and because a seam that is already serialisable in M2 (in-process bridge) is what makes the M3 iframe bridge a transport swap rather than a redesign.

## Consequences

- Games see `deviceId`/`playerId` only; `Transport` and `PeerId` never cross the seam.
- The host loop is platform-driven (`tick(dt, now)` at a fixed step) so the platform can pause a Match on Device loss without game cooperation.
- Games are in-repo packages bundled into the PWA through M3; loading bundles from a URL is a later milestone and must not change the seam.
