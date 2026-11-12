# 12: A site at the public address; the app moves one level down

**What to build:** The public address serves a site (one placeholder home page in this ticket); the app for everyone is below it, built from the `stable` tag; the app as on `master` is beside it for the makers. Old links, old QR codes and installed icons keep working. One workflow publishes all of it (spec D16).

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] A second app in the workspace builds the site with Astro; it reads the name, pitch and address from the one data file (ticket 07)
- [ ] The published site has: the site at the root; the app for everyone at `play/`, built from the `stable` tag (from `master` when there is no tag); the app as on `master` at `next/`
- [ ] The old `stable/` address forwards to `play/` and keeps its query
- [ ] The root with a join code in its query forwards to `next/` with the query (a first phone still on an old build)
- [ ] The root opened from an installed icon forwards to `play/`
- [ ] A first phone at `play/` shows a QR that leads to `play/`; one at `next/`, to `next/`
- [ ] One workflow run builds the site and both app builds, with the Relay setting in both, and publishes them together; type check and tests still gate it
- [ ] The workspace's type check passes with the site present; the site is checked by Astro's own check
- [ ] The stable script's printed addresses, the README's links, the contributing guide's release section, the phone guide's hosted-builds section and the workflow's own comment name the new addresses
- [ ] The built output is checked locally: every internal link resolves, and each forward keeps a query
- [ ] Versions the landing report named on 2026-11-11 (Astro, Node, the Pages actions) are checked against what is current before they are pinned
