import { defineGame, Surface, type MatchInfo, type MatchResult, type Player, type Tile, type Vec2 } from '@mgc/sdk';

/** Sizes in world mm, speeds in mm/s, angles in radians, times in seconds. */
export const SNAKE = {
  /** How fast every snake's head runs; it never stops. */
  speed: 60,
  /** How fast a head turns at most: with `speed`, a turning circle of 15 mm radius. */
  turnRate: 4,
  /** A snake's stroke. A head that comes closer than this to a body's centre line (its own too) has hit it. */
  width: 4,
  /** A snake's length at the start, and how much each food adds. */
  start: 50,
  growth: 20,
  /** Food dots on the surface at once, and their radius. A head within `foodRadius + width / 2` eats one. */
  food: 3,
  foodRadius: 2.5,
  /**
   * Food lies at least this far inside its Tile's edges: never under a bezel,
   * and never so close to the surface's edge that a head that eats it cannot
   * turn away (turning circle 15 mm, plus half the stroke).
   */
  foodMargin: 20,
  /**
   * A head runs straight on, unseen, while it is off every Tile (a bezel gap);
   * once it has run this far off them it has fallen off the surface. A 4 mm
   * gap is crossable down to about 9° from its length; the empty corner of a
   * three-Tile grid, or the band beside a short phone in a row, is not.
   */
  maxGap: 25,
  /**
   * The polyline gets a new point only once the heading has turned this far
   * since the last one, so a straight run is one segment and a full-rate turn
   * a point every 6 mm (within 0.3 mm of the true arc): the state stays small.
   */
  bend: 0.4,
  /** Seconds the snakes wait before they move, and the time limit after that: then the longest wins. */
  ready: 3,
  timeLimit: 120,
  /**
   * A bot steers for the nearest food it can reach, aiming off its bearing by
   * up to `wobble` either way, drawn anew every `think` × (0.5…1.5) s. Every
   * step it runs its way ahead for `lookahead` mm (only as far as the food and
   * one turning radius past it, when it goes for food) and takes another way
   * if that one kills it: straight on, a hard turn, a U-turn. It sees bodies
   * where they are, not where they go, and goes for food whatever its length:
   * a snake that cuts across it closer than it can turn beats it, and it can
   * coil itself in.
   */
  bot: { think: 0.4, wobble: 0.35, lookahead: 45 },
} as const;

/** A view extrapolates a state at most this far ahead, ms. */
const MAX_AHEAD_MS = 100;
const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.35)';
const FOOD = '#ff6188';
/** Per snake, in `match.players` order. */
const COLOURS = ['#a9dc76', '#78dce8'] as const;
/** A head never hits the first this-many mm of its own body, which it always touches. */
const NECK = 2 * SNAKE.width;
/** The radius a head turns at full rate, mm. */
const RADIUS = SNAKE.speed / SNAKE.turnRate;

/** One Player's snake. */
export type SnakeBody = {
  /**
   * The polyline, head first, flat `[x0, y0, x1, y1, …]` in world mm to 0.1 mm,
   * trimmed to `length`. Flat pairs instead of `{ x, y }` objects, and a point
   * only at a bend (`SNAKE.bend`): this is most of every frame on the wire.
   */
  points: number[];
  /** Radians clockwise from world +x (y runs down). */
  heading: number;
  /** Mm; the polyline grows to it while the tail waits. */
  length: number;
  /** Food eaten. */
  score: number;
  alive: boolean;
};

export type SnakeState = {
  /** `ready`: nobody moves yet; `run`: the snakes run. */
  phase: 'ready' | 'run';
  /** Seconds until the snakes move (`ready`) or until the time limit (`run`). */
  clock: number;
  /** One per Player, in `match.players` order. */
  snakes: SnakeBody[];
  /** Food dots' centres, flat `[x0, y0, …]`, world mm to 0.1 mm. */
  food: number[];
};

/** What a view may `send` to the host: nothing; fingers steer through input alone. */
export type SnakeMessage = never;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** `a` brought within ±π. */
const wrap = (a: number): number => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Deterministic randoms in [0, 1) from the Match seed (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Tile's screen as `@mgc/layout` maps it, for its rotation; the px/mm is unused. */
const surfaceOf = (t: Tile): Surface => new Surface({ id: t.deviceId, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }, 1);

/** Whether world point `p` lies on Tile `s` (rotation included). */
function on(s: Surface, p: Vec2): boolean {
  const l = s.worldToLocal(p);
  return l.x >= 0 && l.x <= s.rect.w && l.y >= 0 && l.y <= s.rect.h;
}

/**
 * Each Player's home Tile, in `match.players` order: a human's is the Tile it
 * sits at; a bot, which sits nowhere, takes the first or else the last Tile
 * while no human sits there, then the first. Snakes start on their home Tile
 * and its screen shows their names and scores.
 */
function homes(match: MatchInfo): Tile[] {
  const { tiles, players } = match;
  const first = tiles[0]!;
  const sits = (p: Player, t: Tile): boolean => !p.bot && p.deviceId === t.deviceId;
  const free = [first, tiles[tiles.length - 1]!].filter((t) => !players.some((p) => sits(p, t)));
  return players.map((p) => tiles.find((t) => sits(p, t)) ?? free.shift() ?? first);
}

/** Cuts the flat polyline `pts` (head first) to `length` mm, the last point moved onto the cut. */
function trim(pts: number[], length: number): void {
  let left = length;
  for (let k = 2; k < pts.length; k += 2) {
    const dx = pts[k]! - pts[k - 2]!;
    const dy = pts[k + 1]! - pts[k - 1]!;
    const d = Math.hypot(dx, dy);
    if (d >= left) {
      const f = d > 0 ? left / d : 0;
      pts[k] = pts[k - 2]! + dx * f;
      pts[k + 1] = pts[k - 1]! + dy * f;
      pts.length = k + 2;
      return;
    }
    left -= d;
  }
}

/** Whether `p` comes within `reach` of the flat polyline `pts`, leaving out its first `skip` mm. */
function touches(pts: readonly number[], p: Vec2, reach: number, skip = 0): boolean {
  let run = 0;
  for (let k = 2; k < pts.length; k += 2) {
    let ax = pts[k - 2]!;
    let ay = pts[k - 1]!;
    const bx = pts[k]!;
    const by = pts[k + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (run + len <= skip) {
      run += len;
      continue;
    }
    if (run < skip) {
      const f = (skip - run) / len;
      ax += (bx - ax) * f;
      ay += (by - ay) * f;
    }
    run += len;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? clamp(((p.x - ax) * dx + (p.y - ay) * dy) / l2, 0, 1) : 0;
    if (Math.hypot(ax + u * dx - p.x, ay + u * dy - p.y) < reach) return true;
  }
  return false;
}

/** The host's record of one snake; `SnakeBody` is what it publishes. */
type Snake = {
  player: Player;
  /** Its home Tile; a human's finger steers only from there. */
  home: Surface;
  /** Full precision, head first; see `SnakeBody.points`. */
  pts: number[];
  heading: number;
  /** The heading when the head's segment began: past `SNAKE.bend` from it, the head leaves a point. */
  bentAt: number;
  length: number;
  score: number;
  /** The step it died at; `Infinity` while alive. */
  diedAt: number;
  /** Mm the head has run since it was last on a Tile. */
  gap: number;
  /** A human's: where its finger is (world mm) while one is down on its home Tile. A bot's: the heading it steers for. */
  aim: Vec2 | number | undefined;
  /** A bot's: how far off the food's bearing it aims, and seconds until it draws that anew. */
  wobble: number;
  think: number;
};

/**
 * Snake over any arrangement of Tiles, rotated ones included. Every Player
 * steers a snake with a finger on their own Tile: the head turns toward the
 * finger's world point. The snakes run across the whole surface and straight
 * through the bezel gaps between Tiles; food lies only on Tiles and makes a
 * snake longer. A head that leaves the Layout bounds, runs too far off every
 * Tile, or hits a body ends its snake; the last snake alive wins, or the
 * longest after `SNAKE.timeLimit`. The host plays bots.
 */
export default defineGame<SnakeState, SnakeMessage>({
  manifest: {
    id: 'mgc.snake',
    name: 'Snake',
    version: '1.0.0',
    tiles: { min: 1, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 1, max: 2 },
    bots: true,
    // 30, not 60: every frame carries both snakes' whole polylines. Two 500 mm snakes turning all the way are
    // 2.1 KB of state, about 2.3 KB on the wire, and the Host sends it to every Peer every step:
    // (N − 1) × tickHz × bytes = 3 × 30 × 2.3 KB ≈ 207 KB/s of Host upload on four Tiles, 414 KB/s at 60 Hz.
    // Views extrapolate the head along its heading, so 30 Hz draws as smoothly as 60.
    tickHz: 30,
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const { bounds } = match;
    const dt = 1 / match.tickHz;
    const step = SNAKE.speed * dt;
    const surfaces = match.tiles.map(surfaceOf);
    const onTile = (p: Vec2): boolean => surfaces.some((s) => on(s, p));
    const rand = random(match.seed);
    // The bots' decisions draw from their own stream: the food is the same with or without bots.
    const botRand = random(match.seed ^ 0x9e3779b9);
    const readySteps = Math.round(SNAKE.ready * match.tickHz);
    const endStep = readySteps + Math.round(SNAKE.timeLimit * match.tickHz);

    // Each snake starts on its home Tile, head at mid-height, heading up its screen; a second one on the same
    // Tile starts beside it heading down, so the two part instead of racing for the same food.
    const home = homes(match);
    const snakes: Snake[] = match.players.map((player, k) => {
      const tile = home[k]!;
      const s = surfaceOf(tile);
      const i = home.slice(0, k).filter((t) => t === tile).length;
      const x = (tile.w * (i + 1)) / (home.filter((t) => t === tile).length + 1);
      const down = i % 2 === 1;
      const head = s.localToWorld({ x, y: tile.h / 2 });
      const tail = s.localToWorld({ x, y: tile.h / 2 + (down ? -SNAKE.start : SNAKE.start) });
      const heading = wrap(tile.rot + (down ? Math.PI / 2 : -Math.PI / 2));
      return { player, home: s, pts: [head.x, head.y, tail.x, tail.y], heading, bentAt: heading, length: SNAKE.start, score: 0, diedAt: Infinity, gap: 0, aim: undefined, wobble: 0, think: 0 };
    });
    const bots = snakes.filter((s) => s.player.bot);

    /** Somewhere on a random Tile, `foodMargin` inside its edges, clear of every body if a few draws find such a place. */
    const spawn = (): Vec2 => {
      let p: Vec2 = { x: 0, y: 0 };
      for (let tries = 0; tries < 8; tries++) {
        const s = surfaces[Math.floor(rand() * surfaces.length)]!;
        const mx = Math.min(SNAKE.foodMargin, s.rect.w / 2);
        const my = Math.min(SNAKE.foodMargin, s.rect.h / 2);
        p = s.localToWorld({ x: mx + rand() * (s.rect.w - 2 * mx), y: my + rand() * (s.rect.h - 2 * my) });
        if (!snakes.some((o) => touches(o.pts, p, SNAKE.width + SNAKE.foodRadius))) break;
      }
      return p;
    };
    const food: Vec2[] = Array.from({ length: SNAKE.food }, spawn);

    /** Whether a head at `p` dies: off the bounds, too far off every Tile, or on a body (its own past the neck). */
    const dies = (self: Snake, p: Vec2, gap: number): boolean =>
      p.x < bounds.x ||
      p.x > bounds.x + bounds.w ||
      p.y < bounds.y ||
      p.y > bounds.y + bounds.h ||
      gap > SNAKE.maxGap ||
      snakes.some((o) => touches(o.pts, p, SNAKE.width, o === self ? NECK : 0));
    /** The turn toward heading `want` this step: at most the turn rate, none while the head is off every Tile (`gap` > 0). */
    const turn = (heading: number, want: number | undefined, gap: number): number =>
      want === undefined || gap > 0 ? 0 : clamp(wrap(want - heading), -SNAKE.turnRate * dt, SNAKE.turnRate * dt);
    /** How far (mm, up to the lookahead) snake `s` would run steering for `want` before it died. */
    const room = (s: Snake, want: number): number => {
      let x = s.pts[0]!;
      let y = s.pts[1]!;
      let { heading, gap } = s;
      for (let run = step; run <= SNAKE.bot.lookahead; run += step) {
        heading += turn(heading, want, gap);
        x += step * Math.cos(heading);
        y += step * Math.sin(heading);
        gap = onTile({ x, y }) ? 0 : gap + step;
        if (dies(s, { x, y }, gap)) return run - step;
      }
      return SNAKE.bot.lookahead;
    };
    /**
     * Where a bot steers this step: for the nearest food it can reach, off by its wobble, while that way leaves it
     * room to get there and turn; else the first way that leaves it the whole lookahead (straight on, a hard turn,
     * a U-turn, its food's side first), else whichever lives longest. Food inside either of its turning circles it
     * could only circle round: it runs on until that food is out of them.
     */
    const steer = (s: Snake): number => {
      const x = s.pts[0]!;
      const y = s.pts[1]!;
      const circles = [-1, 1].map((side) => ({ x: x + RADIUS * Math.cos(s.heading + (side * Math.PI) / 2), y: y + RADIUS * Math.sin(s.heading + (side * Math.PI) / 2) }));
      const near = food
        .filter((f) => circles.every((c) => Math.hypot(f.x - c.x, f.y - c.y) >= RADIUS))
        .reduce<Vec2 | undefined>((a, b) => (!a || Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a), undefined);
      const want = near ? Math.atan2(near.y - y, near.x - x) + s.wobble : s.heading;
      const need = near ? Math.min(SNAKE.bot.lookahead, Math.hypot(near.x - x, near.y - y) + RADIUS) : SNAKE.bot.lookahead;
      const side = wrap(want - s.heading) < 0 ? -1 : 1;
      const ways = [want, s.heading, ...[side, -side].flatMap((d) => [s.heading + (d * Math.PI) / 2, s.heading + d * 0.99 * Math.PI])];
      let best = want;
      let most = -1;
      for (const [k, w] of ways.entries()) {
        const r = room(s, w);
        if (r >= (k === 0 ? need : SNAKE.bot.lookahead)) return w;
        if (r > most) [best, most] = [w, r];
      }
      return best;
    };

    let steps = 0;
    let over = false;
    const snapshot = (): SnakeState => ({
      phase: steps < readySteps ? 'ready' : 'run',
      clock: r1((steps < readySteps ? readySteps - steps : endStep - steps) / match.tickHz),
      snakes: snakes.map((s) => ({ points: s.pts.map(r1), heading: Math.round(s.heading * 1000) / 1000, length: s.length, score: s.score, alive: s.diedAt === Infinity })),
      food: food.flatMap((f) => [r1(f.x), r1(f.y)]),
    });
    /** The last snake alive first, then the others by when they died, latest first; then the longest, then `match.players` order. */
    const finish = (): void => {
      over = true;
      ctx.publish(snapshot());
      const ranked = [...snakes].sort((a, b) => (a.diedAt === b.diedAt ? 0 : b.diedAt - a.diedAt) || b.length - a.length);
      const result: MatchResult = { scores: Object.fromEntries(snakes.map((s) => [s.player.playerId, s.score])), ranking: ranked.map((s) => s.player.playerId) };
      ctx.end(result);
    };

    ctx.publish(snapshot());
    return {
      onInput(i) {
        // Only a human's own home Tile steers its snake; a Tile that seats nobody, and a sample off the Tile, steer nothing.
        const s = snakes.find((x) => !x.player.bot && x.player.deviceId === i.deviceId);
        if (!s) return;
        if (i.phase === 'up' || i.phase === 'cancel') s.aim = undefined;
        else if (on(s.home, i.world)) s.aim = { ...i.world };
      },
      // Nothing moved while paused; the views get the snakes where they stopped, stamped now.
      onResume() {
        ctx.publish(snapshot());
      },
      tick() {
        if (over) return;
        steps++;
        if (steps <= readySteps) {
          ctx.publish(snapshot());
          return;
        }
        for (const s of bots) {
          if (s.diedAt !== Infinity) continue;
          s.think -= dt;
          if (s.think <= 0) {
            s.wobble = (botRand() * 2 - 1) * SNAKE.bot.wobble;
            s.think = SNAKE.bot.think * (0.5 + botRand());
          }
          s.aim = steer(s);
        }
        // Every head moves first, then every death is judged on where all of them are: a head-on hit kills both.
        const live = snakes.filter((s) => s.diedAt === Infinity);
        for (const s of live) {
          const x = s.pts[0]!;
          const y = s.pts[1]!;
          const want = typeof s.aim === 'object' ? Math.atan2(s.aim.y - y, s.aim.x - x) : s.aim;
          s.heading = wrap(s.heading + turn(s.heading, want, s.gap));
          if (Math.abs(wrap(s.heading - s.bentAt)) > SNAKE.bend) {
            s.pts.unshift(x, y);
            s.bentAt = s.heading;
          }
          s.pts[0] = x + step * Math.cos(s.heading);
          s.pts[1] = y + step * Math.sin(s.heading);
          trim(s.pts, s.length);
          s.gap = onTile({ x: s.pts[0], y: s.pts[1] }) ? 0 : s.gap + step;
        }
        const dead = live.filter((s) => dies(s, { x: s.pts[0]!, y: s.pts[1]! }, s.gap));
        for (const s of dead) s.diedAt = steps;
        for (const s of live) {
          if (s.diedAt !== Infinity) continue;
          food.forEach((f, k) => {
            if (Math.hypot(f.x - s.pts[0]!, f.y - s.pts[1]!) >= SNAKE.foodRadius + SNAKE.width / 2) return;
            s.length += SNAKE.growth;
            s.score++;
            food[k] = spawn();
          });
        }
        const alive = snakes.filter((s) => s.diedAt === Infinity).length;
        if (alive === 0 || (alive === 1 && snakes.length > 1) || steps >= endStep) finish();
        else ctx.publish(snapshot());
      },
    };
  },
  view(ctx) {
    const { players } = ctx.match;
    const home = homes(ctx.match);
    /** Shared time of the last resume: a state from before it shows the snakes where the pause stopped them. */
    let resumedAt = -Infinity;
    return {
      onResume(now) {
        resumedAt = now;
      },
      draw({ ctx: g, state: s, now, t, tile }) {
        if (!s || !tile) return;
        // Extrapolate each head along its heading on the shared clock, the tail trimmed after it, as Pong does the ball.
        const ahead = s.phase === 'run' ? Math.min(Math.max(now - Math.max(t, resumedAt), 0), MAX_AHEAD_MS) / 1000 : 0;

        g.fillStyle = FOOD;
        for (let k = 0; k < s.food.length; k += 2) {
          g.beginPath();
          g.arc(s.food[k]!, s.food[k + 1]!, SNAKE.foodRadius, 0, Math.PI * 2);
          g.fill();
        }
        g.lineWidth = SNAKE.width;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        s.snakes.forEach((snake, k) => {
          const pts = snake.points.slice();
          if (snake.alive && ahead > 0) {
            pts[0] = pts[0]! + SNAKE.speed * ahead * Math.cos(snake.heading);
            pts[1] = pts[1]! + SNAKE.speed * ahead * Math.sin(snake.heading);
            trim(pts, snake.length);
          }
          const colour = snake.alive ? COLOURS[k % COLOURS.length]! : DIM;
          g.strokeStyle = colour;
          g.beginPath();
          g.moveTo(pts[0]!, pts[1]!);
          // Through the middle of every segment, each bend a control point: drawn round, not as facets.
          for (let p = 2; p < pts.length - 2; p += 2) g.quadraticCurveTo(pts[p]!, pts[p + 1]!, (pts[p]! + pts[p + 2]!) / 2, (pts[p + 1]! + pts[p + 3]!) / 2);
          g.lineTo(pts[pts.length - 2]!, pts[pts.length - 1]!);
          g.stroke();
          g.fillStyle = colour;
          g.beginPath();
          g.arc(pts[0]!, pts[1]!, SNAKE.width * 0.75, 0, Math.PI * 2);
          g.fill();
        });

        // Words in this Tile's own frame, so they read upright on a rotated Tile: origin its top-left, x along its width.
        g.save();
        g.translate(tile.x, tile.y);
        g.rotate(tile.rot);
        g.textBaseline = 'top';
        g.font = '600 5px system-ui, sans-serif';
        g.textAlign = 'right';
        g.fillStyle = DIM;
        if (s.phase === 'run') g.fillText(`${Math.floor(s.clock / 60)}:${String(Math.floor(s.clock % 60)).padStart(2, '0')}`, tile.w - 4, 4);
        g.textAlign = 'left';
        let line = 0;
        s.snakes.forEach((snake, k) => {
          if (home[k]!.deviceId !== tile.deviceId) return;
          g.fillStyle = COLOURS[k % COLOURS.length]!;
          // "Bot: 3", not "Bot 3": the lobby names every bot "Bot", and "Bot 3" reads as a third bot.
          g.fillText(`${players[k]!.name}: ${snake.score}${snake.alive ? '' : ' ✕'}`, 4, 4 + 7 * line++);
        });
        if (s.phase === 'ready') {
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = FG;
          g.font = '600 24px system-ui, sans-serif';
          g.fillText(String(Math.ceil(s.clock)), tile.w / 2, tile.h * 0.3);
          if (players.some((p) => !p.bot && p.deviceId === tile.deviceId)) {
            g.font = '500 5px system-ui, sans-serif';
            g.fillText('touch where your snake should go', tile.w / 2, tile.h * 0.3 + 18, tile.w - 8);
          }
        }
        g.restore();
      },
    };
  },
});
