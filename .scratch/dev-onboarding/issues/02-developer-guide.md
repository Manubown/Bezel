# 02: `docs/guide/`: the developer wiki, and `docs/sdk-design.md` brought back in line with the code

**What to build:** The pages a developer reads to build, test, run and debug a Game, and the fixes to the design document where it no longer matches the code.

Per `.scratch/dev-onboarding/spec.md` §2.

**Blocked by:** 01 (Rails)

**Status:** ready-for-agent

- [ ] `docs/guide/README.md` (index + reading order)
- [ ] `docs/guide/getting-started.md`: clone, install, dev server, open on a phone, join, start Pong
- [ ] `docs/guide/your-first-game.md`: tutorial that builds `games/tap-race` from `pnpm new-game`
- [ ] `docs/guide/concepts.md`: Session/Device/Tile/Controller/Player/Holder, world mm, the state stream, pause, timers, faults; links to GLOSSARY and ADRs
- [ ] `docs/guide/testing.md`: `createTestMatch`, scripting fingers, asserting states/events/results, headless screen limits
- [ ] `docs/guide/running-on-phones.md`: HTTPS cert, LAN, QR/code join, templates, Tile order, bots, installing as PWA
- [ ] `docs/guide/troubleshooting.md`: one entry per known symptom with cause and fix
- [ ] `docs/guide/api.md`: every exported type and function of `@mgc/sdk` and `@mgc/sdk/test`, from the code
- [ ] `docs/sdk-design.md`: remove `iframeLink` from §3 or mark it M3; §6 pwa call site matches `apps/pwa/src/main.ts`; Pong sketch constants match `games/pong`; §8 "mount-less" headless row corrected
- [ ] README.md points at `docs/guide/`

## Comments
