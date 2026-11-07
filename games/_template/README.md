# Template ("Taps")

The smallest complete Game for MobileGameConnect: every Player taps their own phone, the first to ten taps wins. Copy it with `pnpm new-game <slug> "<Name>"` from the repo root; the script renames everything and writes the new Game a README of its own.

```
src/index.ts           manifest + host + view, exported through defineGame
test/template.test.ts  the rules, run in one process over createTestMatch
```

- The Game imports `@mgc/sdk` only; the test pins that.
- The host runs on the Host phone and owns the state; views run on every phone and draw it.
- Everything in the state is JSON; lengths are world millimetres; times are shared-clock milliseconds.

Read `docs/guide/your-first-game.md` for the walk-through and `docs/guide/api.md` for every hook.
