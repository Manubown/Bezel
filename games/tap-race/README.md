# Tap Race

The tutorial Game for MobileGameConnect. After a 3-2-1 countdown, targets appear one at a time on a Tile where a Player sits; a tap in the ring scores for the Player seated at that Tile, unless a bot was quicker. A target fades unscored after `TAP_RACE.lifeMs`; after `TAP_RACE.rounds` targets the most wins.

```
src/index.ts             manifest + host + view, exported through defineGame (under 150 lines)
test/tap-race.test.ts    the rules, run in one process over createTestMatch
```

- The Game imports `@mgc/sdk` only; the test pins that.
- The host is event-driven (`tickHz: 0`): the countdown, each target's wait, its fading and the bots' taps are `timer`s; taps arrive through `onInput`.
- Randomness comes from `match.seed`, so a test can pin a whole Match.
- Everything in the state is JSON; lengths are world millimetres; times are shared-clock milliseconds.

Read `docs/guide/your-first-game.md` for the walk-through and `docs/guide/api.md` for every hook.
