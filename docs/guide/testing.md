# Testing without phones

`createTestMatch` from `@mgc/sdk/test` runs a whole Match in one process: `runMatch` for every Device of a `MatchInfo` you build, over the in-process link (every frame `structuredClone`d, as an iframe will), a headless screen per Device, JSON delivery between Devices, and a fake shared clock that starts at 0. It touches no global timers, so a test is deterministic if the Game is (`packages/sdk/src/testing.ts`).

```sh
pnpm vitest run games/<slug>     # once
pnpm vitest games/<slug>         # watch
pnpm exec tsc -p games/<slug>    # the test is typechecked with the Game
```

## A worked example

From `games/_template/test/template.test.ts`: two Tiles in a row, Ann seated at the first, Bo at the second; each tap counts for the Player seated at the tapped Tile.

```ts
import { describe, expect, it } from 'vitest';
import type { MatchInfo, Tile } from '@mgc/sdk';
import { createTestMatch } from '@mgc/sdk/test';
import game, { TEMPLATE, type TemplateState } from '../src';

/** Two phones in a row, 70 × 150 mm each with a 4 mm gap; Ann sits at the first, Bo at the second. */
const tiles: Tile[] = [0, 1].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 0,
  players: [
    { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'd1' },
  ],
  devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles,
  bounds: { x: 0, y: 0, w: 144, h: 150 },
};

it('counts each tap for the Player seated at that Tile and ends when one reaches the goal', async () => {
  const t = await createTestMatch<TemplateState>({ game, match: MATCH });
  expect(t.state('d1')).toEqual({ taps: { 'p-ann': 0, 'p-bo': 0 } });   // the host published in its factory

  await t.input('d0', 'down', { x: 10, y: 20 });                         // world mm on Tile d0
  await t.input('d0', 'up', { x: 10, y: 20 });
  expect(t.state('d1')).toEqual({ taps: { 'p-ann': 1, 'p-bo': 0 }, last: { x: 10, y: 20, playerId: 'p-ann' } });

  for (let k = 0; k < TEMPLATE.tapsToWin; k++) {
    await t.input('d1', 'down', { x: 100, y: 50 }, k);                  // a new pointerId per tap
    await t.input('d1', 'up', { x: 100, y: 50 }, k);
  }
  expect(t.result()).toEqual({ scores: { 'p-ann': 1, 'p-bo': TEMPLATE.tapsToWin }, ranking: ['p-bo', 'p-ann'] });
  await t.stop();
});
```

## `createTestMatch(options)`

| Option | Default | Meaning |
|---|---|---|
| `game` | (required) | the Game's default export |
| `match` | (required) | the frozen `MatchInfo` every Device runs |
| `host` | `match.devices[0].deviceId` | the Device that hosts (the lobby puts the Host first) |
| `pxPerMm` | `6` | CSS px per mm on every Device; each screen is `screenMm × pxPerMm` px at dpr 1 |
| `sound` | `true` | every Device's sound setting as the Match starts: what each view reads as `ctx.sound` |

It resolves once every Device's part has started, and throws `createTestMatch: host … is not a Device of the Match` or `createTestMatch: not started on …` otherwise.

| Member | What it does |
|---|---|
| `now()` | the shared time, ms; starts at 0 |
| `await tick(ms)` | moves the clock on by `ms` in steps of `1000 / tickHz` (`1000 / 60` when `tickHz` is 0): each step fires the timers due, then one animation frame on every Device (the host's `tick`, every `draw`), and lets the frames it sent land |
| `await input(deviceId, phase, at, pointerId = 1)` | one pointer event on that Device's screen at `at` (a Tile: world mm; a Controller: its screen mm), then one animation frame at the current time. An event-driven host has it at once; a ticking host gets it before its next `tick`, so `await t.tick(1000 / tickHz)` before reading the state |
| `await send(deviceId, msg)` | that Device's view sends `msg` to the host's `onMessage`, stamped as that Device (and its Holder on a Controller), then everything it set off lands |
| `drawn(deviceId)` | the canvas calls of that view's last frame, `[name, ...args]` each (a property write as `['fillStyle=', v]`), after the SDK's own clear and transform. Views draw in the same frame batch as the host step, possibly before its publish lands: tick one more frame before reading |
| `await setPaused(reason \| null)` | the Host platform's pause (`{ kind: 'device-lost', deviceId }` or `{ kind: 'platform', note? }`) or resume (`null`); the clock does not move. The host's and every view's `onResume(now, pausedMs)` get the paused time |
| `await reload(deviceId)` | that Peer's page reloads mid-Match: its `runMatch` stops (its view gets `onEnd({ reason: 'link-lost' })`) and a new one starts on a fresh screen with nothing kept; the new view gets the current picture (Holders, its kept states, the pause while paused) from the Host's answer to its `hello`, then everything that set off lands. The Host does not pause. `drawn`, `state`, `latest` and `events` then read the new page. Throws for the Host |
| `await setSound(deviceId, on)` | that Device's person switches its sound on or off: its running view reads `on` as `ctx.sound` at once, and so does the view a `reload` starts there; the clock does not move |
| `state(deviceId)` | the latest state that Device's view applied, `undefined` before the first |
| `latest(deviceId)` | the same with its host time: the view's `ctx.latest()` |
| `result()` | the `MatchResult` once the host game called `end` |
| `events(deviceId)` | every `MatchEvent` `runMatch` reported on that Device, in order: `started`, `paused`, `resumed`, `holders`, `ended`, `closed`, `view-closed`, `fault`, `log` |
| `await stop()` | aborts the Match if it still runs |

`state`, `latest`, `events`, `reload` and `setSound` throw for a Device that is not in the Match.

## Scripting fingers

- Phases must make sense per `(deviceId, pointerId)`: `down`, any `move`s, then `up` or `cancel`. The view's capture follows only pointers that went down on it, and the host drops orphans, so a `move` without a `down` never arrives.
- Use a different `pointerId` per finger (and per tap, if you never send `up`).
- A Tile's `at` is world mm, also on a rotated Tile: the harness maps it through that Device's Surface. An `at` outside the Tile still arrives (the headless screen has no edges); a real finger cannot do that.
- A helper that puts a finger down on first use and moves it after, from `games/pong/test/pong.test.ts`:

```ts
/** One finger on a Tile's screen, put down on first use. */
function finger(t: TestMatch<PongState>, match: MatchInfo, deviceId: DeviceId) {
  const tile = match.tiles.find((x) => x.deviceId === deviceId)!;
  let down = false;
  return async (y: number): Promise<void> => {
    await t.input(deviceId, down ? 'move' : 'down', { x: tile.x + tile.w / 2, y });
    down = true;
  };
}
```

## Asserting

- States: `t.state(id)` on any Device; every view of a broadcast gets the same state.
- The result: `t.result()`, and the last event of every Device is `{ t: 'closed', reason: 'ended', detail: 'the game ended the Match' }`.
- No faults: a throwing handler or `draw` does not fail the test by itself; it becomes a `fault` event. Assert none:

```ts
for (const id of ['d0', 'd1']) expect(t.events(id).filter((e) => e.t === 'fault'), id).toEqual([]);
```

- Host logs, including the platform's refusals (`set-holder rejected: …`, `publish rejected: the Match has ended`): `t.events(hostId).flatMap((e) => (e.t === 'log' ? [e.args.join(' ')] : []))` (as `games/pass/test/pass.test.ts:42` does).
- Pause: `await t.setPaused({ kind: 'platform' })`, act, `await t.tick(…)`, `await t.setPaused(null)`; `games/pass/test/pass.test.ts:60-72` checks that a turn's timer froze and a tap meanwhile counted for nobody.
- A reloaded phone: `await t.reload('d1')`, then `await t.tick(1000 / tickHz)` and read `t.drawn('d1')`: a change-only state must be drawn without another publish (`packages/sdk/test/hello.e2e.test.ts`). Reload during a pause to check what a phone that comes back sees.

## Hand-building a `MatchInfo`

Build it the way the lobby does (`apps/pwa/src/lobby.ts:348-376`), or the test proves something the app never runs:

| Field | The lobby's rule |
|---|---|
| `matchId` | any string |
| `seed` | a 32-bit unsigned integer; fix it in a test |
| `tickHz` | the manifest's `tickHz`, or 60 when it has none (`apps/pwa/src/lobby.ts:8-9`). Keep the two equal |
| `players` | `seats: 'ends'` (the default): at most two, slot 0 the human at the first Tile (`deviceId` set) or the bot `{ playerId: 'bot:0', name: 'Bot', bot: true }`; slot 1 the same for the last Tile (`bot:1`). `seats: 'controllers'`: one human per Controller, `deviceId` that Controller's, in roster order, no bots ([seats](concepts.md#seats-and-bots)) |
| `devices` | every Device, the Host first. A Tile: `{ deviceId, role: 'tile', name, tile, screenMm: { x: tile.w, y: tile.h } }`. A Controller: `{ deviceId, role: 'controller', name, screenMm }`, no `tile` |
| `tiles` | the Tile Devices' `tile`s, in Tile order |
| `bounds` | the axis-aligned box around every Tile |

A test may go beyond what the lobby produces today (Players seated nowhere, more than two Players under `seats: 'ends'`, rotated Tiles). Say so in the test's name, so a reader knows it covers a Game rule and not a lobby case.

### Controllers

From `games/pass/test/pass.test.ts:9-25`: two Tiles and one Controller, Players seated nowhere.

```ts
const tiles: Tile[] = [0, 1].map((i) => ({ deviceId: `d${i}`, x: i * 74, y: 0, w: 70, h: 150, rot: 0 }));
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 0,
  players: [
    { playerId: 'p-ann', name: 'Ann' },
    { playerId: 'p-bo', name: 'Bo' },
  ],
  devices: [
    ...tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile' as const, name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
    { deviceId: 'c', role: 'controller', name: 'c', screenMm: { x: 65, y: 140 } },
  ],
  tiles,
  bounds: { x: 0, y: 0, w: 144, h: 150 },
};
// A tap on the Controller at (30, 70) mm from its top-left corner:
await t.input('c', 'down', { x: 30, y: 70 });
```

### Rotated Tiles

No lobby template rotates a Tile (`packages/layout/src/templates.ts`), so a rotated Tile is tested only through a hand-built `MatchInfo`. `rot` turns the screen clockwise about its top-left corner `(x, y)` ([the table](concepts.md#world-tiles-and-the-surface)):

```ts
/** Two phones end to end, facing each other: d0 upright below, d1 turned 180° above it, 4 mm apart. */
const W = 70, H = 150, GAP = 4;
const tiles: Tile[] = [
  { deviceId: 'd0', x: 0, y: H + GAP, w: W, h: H, rot: 0 },
  // Turned 180°, the screen's top-left corner is the bottom-right of the box it covers, [0, W] × [0, H].
  { deviceId: 'd1', x: W, y: H, w: W, h: H, rot: Math.PI },
];
const MATCH: MatchInfo = {
  matchId: 'match-1',
  seed: 1,
  tickHz: 60,
  players: [
    { playerId: 'p-ann', name: 'Ann', deviceId: 'd0' },
    { playerId: 'p-bo', name: 'Bo', deviceId: 'd1' },
  ],
  // screenMm is the phone's own screen, not its box in the World.
  devices: tiles.map((tile) => ({ deviceId: tile.deviceId, role: 'tile', name: tile.deviceId, tile, screenMm: { x: tile.w, y: tile.h } })),
  tiles,
  bounds: { x: 0, y: 0, w: W, h: 2 * H + GAP },
};
```

- To check a box, `Surface` (exported by `@mgc/sdk`) computes it: `new Surface({ id: t.deviceId, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }, 1).worldAabb()`.
- `Math.sin(Math.PI)` is not exactly 0, so positions that pass through a rotated Surface come back off by about 1e-14 mm: compare them with `toBeCloseTo`.

## The "imports only `@mgc/sdk`" test

Every Game pins that its source imports nothing but the SDK, because M3 will load it in a sandboxed iframe where nothing else exists (ADR-0004). From `games/_template/test/template.test.ts:25-30`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

it('imports nothing but the SDK', () => {
  const dir = fileURLToPath(new URL('../src/', import.meta.url));
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[cm]?[jt]sx?$/.test(f));
  const specifiers = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  expect(new Set(specifiers)).toEqual(new Set(['@mgc/sdk']));
});
```

It needs `@types/node` (the template's `devDependencies`). Pong's version also pins `package.json`'s `dependencies` to `['@mgc/sdk']` (`games/pong/test/pong.test.ts:160-171`).

## What the headless screen can and cannot do

Every view runs on a stand-in for the little DOM the SDK touches (`packages/sdk/src/headless.ts`), sized `screenMm × pxPerMm`, dpr 1. Tests run in Node: there is no global `document` or `window`.

| It can | It cannot |
|---|---|
| step animation frames, all Devices together, on `tick` and `input` | keep Game code that uses its own clock deterministic: `setTimeout`, `Date.now()` and `performance.now()` run on Node's real time, and there is no global `requestAnimationFrame` |
| run `draw` every frame on a recording 2D context that accepts every call (`measureText` returns width 0) | show you what was drawn: `createTestMatch` does not expose the canvases |
| create elements through `root.ownerDocument.createElement(tag)`, with `style`, `append`, `prepend`, `remove`, `addEventListener`, `removeEventListener`, `clientWidth`/`clientHeight`, `getBoundingClientRect()` (the whole screen) | `document.createElement` (no global `document`), `appendChild`, `innerHTML` parsing, `querySelector`, `classList`, `setAttribute`: a missing method throws, and the throw is a `fault` in that handler |
| keep any other property you assign (`textContent`, `disabled`, `type`) as a plain field | render text, lay out, or let a test read the DOM back: `createTestMatch` does not expose the screens |
| dispatch a pointer event to the topmost element (the last one appended, descending into its last child), bubbling to its ancestors | hit-test by position: with several buttons, `t.input` always presses the last one appended, whatever `at` says |
| give the event `type`, `pointerId`, `clientX`, `clientY`, `target` | `preventDefault()`, `stopPropagation()` or any other event member: calling one throws out of `t.input` |
| go to the background (`HeadlessScreen.setHidden`, used by the SDK's own tests) | do so through `createTestMatch`, which does not expose it |

Game code that works in both: create DOM through `root.ownerDocument`, append with `append`, keep timing in `ctx.timer` (host) and `ctx.now()` (view), and randomness in `ctx.match.seed`.
