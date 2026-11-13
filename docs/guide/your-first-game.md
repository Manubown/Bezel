# Your first Game: Tap Race

A walk through `games/tap-race/src/index.ts` (148 lines), the Game that `pnpm new-game` is meant to grow into. Targets appear on the phones one at a time; the first finger inside the ring scores; after seven targets the most wins. Bots play too. Read the file beside this page: every section names the lines it explains.

What it exercises beyond the template: a round structure driven by **timers**, an **event-driven host** (no `tick`), **seats** (which Player sits at which Tile), **bots**, a **result with a ranking**, and a view that draws text per Tile.

## 0. Start from the template

```sh
pnpm new-game tap-race "Tap Race"
pnpm install --no-frozen-lockfile
```

You get `games/tap-race/src/index.ts` (the template's "Tap" Game, renamed) and `test/tap-race.test.ts`. The Game already shows up among the Host's Game cards in Maker mode (`?maker` on the Host's address). Everything below replaces the body of that file piece by piece.

## 1. Tunables and the state (`TAP_RACE`, `TapRaceState`)

```ts
export const TAP_RACE = { target: 9, rounds: 7, count: 3, countMs: 1000, spawnMs: { min: 600, max: 2000 }, lifeMs: 2500, … } as const;
export type TapRaceState = {
  phase: 'countdown' | 'play' | 'done';
  count?: number;
  target?: { x: number; y: number; deviceId: DeviceId; since: number };
  scores: Record<PlayerId, number>;
  round: number;
  lastHit?: { playerId: PlayerId; x: number; y: number };
};
export type TapRaceMessage = never;
```

- One exported object holds every number. The test imports it, so the test never hard-codes a radius or a delay.
- The state is what the host publishes and every view draws. It must be plain JSON (`JsonValue`): `type` aliases, no `interface`, no `readonly` arrays, no class instances ([concepts: the state stream](concepts.md#the-state-stream)). Lengths are world millimetres, times are shared-clock milliseconds.
- `TapRaceMessage = never`: views send nothing to the host. A tap is an `Input`, which the platform delivers on its own.

## 2. The manifest (`manifest: { … }`)

```ts
tiles: { min: 1, max: 4 },      // phones lying on the table
controllers: { min: 0, max: 0 }, // phones held in hand
players: { min: 1, max: 4 },
bots: true,                      // the Host may make a Player slot a bot; this host plays it
tickHz: 0,                       // event-driven: no `tick`; inputs and timers wake the host
```

The lobby refuses Start outside these ranges and quotes the reason ([troubleshooting](troubleshooting.md#start-is-refused)). `tickHz: 0` means the host has no fixed-step loop: `onInput` and `onTimer` are the only things that run. `bots: true` puts a Bot chip on each Player slot in the Host's sheet; the host game then has to play those Players itself (§4).

Tap Race leaves `seats` out, so it gets `seats: 'ends'`: the lobby seats at most two Players, at the first and the last Tile (`apps/pwa/src/lobby.ts:10-11`; the other mode, `'controllers'`, is in [Concepts](concepts.md#seats-and-bots)). A Game that allows `players: { max: 4 }` is ready for more; under `'ends'` it never gets more from the lobby yet.

## 3. The host factory (`host(ctx)`)

Runs once, on the Host phone, before any handler. Everything it computes from `ctx.match` is fixed for the Match: no joins mid-Match.

```ts
let seed = match.seed >>> 0;
const rand = (): number => { /* mulberry32 */ };
```

Randomness comes from `match.seed`, so a test can pin a whole Match by its seed. Every Game copies these five lines: a Game may import `@mgc/sdk` only (its test pins that), and the SDK does not ship a PRNG.

```ts
const seated = new Map(match.players.flatMap((p) => (p.deviceId === undefined ? [] : [[p.deviceId, p.playerId] as const])));
const bots = match.players.filter((p) => p.bot).map((p) => p.playerId);
const spots = seated.size > 0 ? match.tiles.filter((t) => seated.has(t.deviceId)) : match.tiles;
```

**Seats.** `Player.deviceId` says which Tile a human sits at; a bot has none. Never go by a Player's index. A tap on a Tile carries the Tile's `deviceId`, not a Player, so `seated` is how a tap finds its Player. Targets therefore appear only on Tiles that seat someone (a middle phone seats nobody), or anywhere when only bots play.

```ts
const s: TapRaceState = { phase: 'countdown', count: TAP_RACE.count, scores: …, round: 0 };
const publish = (): void => ctx.publish({ ...s, scores: { ...s.scores } });
```

**Publish a copy.** `ctx.publish` hands the object to the platform; what crosses the wire is the object as it is when your handler returns (`packages/sdk/src/game-side.ts:66-71`). Mutating `s` after `publish()` in the same handler would change what was sent. Publishing a shallow copy avoids that. One `publish` is one frame to every phone; publish when something changed, not every event.

```ts
ctx.timer('count', TAP_RACE.countMs);
publish();
```

**Timers.** `timer(tag, ms)` calls `onTimer(tag, now)` once, `ms` from now; the same tag again replaces the pending one; `timer(tag, null)` cancels. Paused time does not count. The first state goes out at once: a view draws nothing until it has one.

## 4. The host handlers

### `onTimer(tag, now)`: the round structure

```
count ×3 → spawn → [expire | bot:<id> | a tap] → spawn → … → end
```

- `count`: three digits one second apart, then `next()`.
- `spawn`: pick a Tile from `spots`, a point inside it clear of its edges, set `s.target`, arm `expire` for `lifeMs`, and for every bot that does not miss this one (`rand() >= bot.miss`) arm `bot:<playerId>` for a seeded reaction time.
- `expire`: nobody hit it; `next()` with no hit.
- `bot:<id>`: that bot hits the target; `next({ playerId: id, … })`.
- `end`: `ctx.end(result(...))` closes the Match on every phone; the platform shows the result card.

`next(hit?)` is the one place state moves between targets: score the hit, cancel `expire` and every bot timer (a timer that was due but not yet delivered is cancelled too), choose `play` or `done`, arm `spawn` or `end`, publish. `ctx.log(...)` lines reach the Host's game log in the sheet (in Maker mode, `?maker`) and `t.events()` in tests.

`now` in `onTimer` is the shared time the timer was due, which is the right stamp for `target.since`.

### `onInput(i)`: a tap

```ts
const playerId = seated.get(i.deviceId);
if (i.phase !== 'down' || !t || i.deviceId !== t.deviceId || playerId === undefined) return;
if (Math.hypot(i.world.x - t.x, i.world.y - t.y) <= TAP_RACE.target) next({ playerId, … });
```

Every pointer sample from every phone arrives here: `down → move* → (up | cancel)` per pointer, in world mm, with the Device it came from. Four checks: a finger coming down, a target exists, on the target's own Tile, by a seated Player; then the distance test. A tap from the middle phone or from a Tile that is not the target's does nothing.

## 5. The view (`view: ({ match: { players } }) => ({ draw(f) { … } })`)

Runs once per phone, the Host included. Tap Race has no DOM and no local state: `draw` is pure in the frame it is given.

```ts
draw({ ctx: g, state: s, now, tile }) {
  if (!s || !tile) return;
  …arc at (s.target.x, s.target.y) in world mm…
  g.translate(tile.x, tile.y);   // from here on, Tile-local mm
  …scores along the top, the countdown or the winner in the middle…
}
```

- `g` is a Canvas2D context already cleared and transformed so 1 unit = 1 mm of **world**. Draw the target at its world position and every phone shows the part that lies on it; no per-Tile clipping in the Game.
- For text that belongs to this phone (scores, the countdown), `translate(tile.x, tile.y)` moves the origin to the Tile's top-left corner. (Lobby Tiles are never rotated today; a rotated Tile would also need `rotate(tile.rot)`, see [concepts](concepts.md#world-tiles-and-the-surface).)
- `now` is shared time: the inner ring shrinks by `now - target.since`, so every phone shows the same age without any extra state.
- `state` is `undefined` until the first publish; return early.

Font sizes are in mm too (`'600 5px'` after the transform is 5 mm tall): a 40 mm countdown digit, 10 mm for the winner.

## 6. The result

```ts
function result(players, scores): MatchResult {
  const ranking = players.map((p) => p.playerId).sort((a, b) => scores[b]! - scores[a]!);
  return ranking.length > 1 && scores[ranking[0]!] === scores[ranking[1]!] ? { scores } : { scores, ranking };
}
```

`ctx.end(result)` takes `scores` and an optional `ranking`. The platform's result card names `ranking[0]` as the winner (`apps/pwa/src/result.ts`); leave `ranking` out for a draw. Tap Race shows the winner on every Tile for three seconds before ending, because the platform hides the view the moment the Match ends.

## 7. The test (`test/tap-race.test.ts`)

```ts
const tiles: Tile[] = [0, 1, 2].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
const ANN: Player = { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' };
const BO: Player = { playerId: 'p-bo', name: 'Bo', deviceId: 'd2' };
const t = await createTestMatch<TapRaceState>({ game, match: row([ANN, BO]) });
```

`createTestMatch` runs the real runtime for every Device in one process with a fake shared clock. The `MatchInfo` is hand-built: three Tiles in a row, Ann at the first, Bo at the last, the middle one empty, as the lobby would seat them. Then:

- `await t.tick(ms)` moves time; timers fire; `t.state('d1')` is what the middle phone's view last applied.
- `await t.input('d0', 'down', { x, y })` is a finger on Ann's phone at a world point; it reaches the host before the next tick.
- `t.result()` is what `ctx.end` was given; `t.events('d0')` has the host's `log` lines and any `fault`.

What the suite pins, per the spec: the countdown runs one digit per second on every Tile; targets land on `d0`/`d2`, never `d1`; a tap on the wrong Tile or outside the ring scores nothing; a full Match ends ranked; a bot in slot 1 scores and misses on its seed; a tie ends with no ranking; a pause delays the next target by exactly the paused time. The whole file runs in about a second. [Testing](testing.md) has every helper.

## 8. See it on phones

```sh
pnpm dev
```

Open the Host with `?maker` and pick **Tap Race** among its Game cards, start with one phone and P2 as a Bot, or with two phones. [Running on phones](running-on-phones.md) covers the sheet; [Troubleshooting](troubleshooting.md) covers what goes wrong.

## What to take from it

| Rule | Where Tap Race does it |
|---|---|
| Keep every number in one exported object | `TAP_RACE` |
| State is plain JSON; publish a copy; publish on change | `publish()` |
| Seats from `Player.deviceId`, never from index | `seated`, `spots` |
| Randomness from `match.seed` | `rand` |
| Timers drive an event-driven host; same tag replaces, `null` cancels | `next()`, `onTimer` |
| Draw in world mm; `translate` to the Tile for per-phone text | `draw` |
| `ranking` names the winner; omit it for a draw | `result()` |
| Hand-build a `MatchInfo` and script fingers in tests | `row()`, `tap()` |
