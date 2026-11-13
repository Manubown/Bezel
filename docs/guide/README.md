# Developer guide

How to build, test, run and debug a Game for MobileGameConnect. The guide is versioned with the code; where it cites a file, that file is the source of truth.

## Reading order

| # | Page | Read it to |
|---|---|---|
| 1 | [Getting started](getting-started.md) | clone, install, run the dev server, play Pong on phones, create your own Game with `pnpm new-game` |
| 2 | [Your first Game](your-first-game.md) | walk through a whole Game, `games/tap-race`, hook by hook |
| 3 | [Concepts](concepts.md) | learn the model: Session, Device, Tile, Controller, Player, Players' colours and the own Tile, Holder, World mm, the state stream, pause, timers, faults |
| 4 | [Testing](testing.md) | test a Game in one process with `createTestMatch`, without phones |
| 5 | [Running on phones](running-on-phones.md) | serve over HTTPS on the LAN, join, arrange Tiles, seat Players and bots, know what `pxPerMm` is |
| 6 | [Troubleshooting](troubleshooting.md) | go from a symptom to its cause and fix |
| 7 | [API reference](api.md) | look up every export of `@mgc/sdk` and `@mgc/sdk/test` |

## Elsewhere in the repo

| File | What it is |
|---|---|
| [`GLOSSARY.md`](../../GLOSSARY.md) | the domain terms; the guide uses them exactly |
| [`docs/adr/`](../adr/) | the five binding decisions (PWA runtime, host-authoritative star, state stream, sandboxed seam, world millimetres) |
| [`docs/sdk-design.md`](../sdk-design.md) | the SDK contract in full, with ordering and error rules |
| [`games/_template/`](../../games/_template/) | the smallest complete Game; `pnpm new-game` copies it |
| [`games/pong/`](../../games/pong/), [`games/pass/`](../../games/pass/) | reference Games: tick-driven Tiles with bots; a Controller with Holders, timers and a DOM view |
| [`games/tap-race/`](../../games/tap-race/), [`games/snake/`](../../games/snake/), [`games/quiz/`](../../games/quiz/), [`games/air-hockey/`](../../games/air-hockey/), [`games/breakout/`](../../games/breakout/) | the five Games built from the template, each for one SDK path (the tutorial Game; rotated Tiles at 30 Hz; one Player per Controller with DOM views; 180° facing Tiles; a grid with large state); each has a `README.md` |
| [`docs/architecture.md`](../architecture.md) | the platform around the SDK: packages, a phone's path from page load to a running Game, where a change goes |
| [`CONTRIBUTING.md`](../../CONTRIBUTING.md) | checks, conventions, friction logs, the issue tracker, the `stable` channel |
