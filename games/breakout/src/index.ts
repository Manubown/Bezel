import { defineGame, type DeviceId, type MatchInfo, type Rect, type Tile } from '@mgc/sdk';

/** Sizes in world mm, speeds in mm/s, angles in radians, times in seconds unless named `…Ms`. */
export const BREAKOUT = {
  /** Ball radius. */
  ball: 2,
  /** A paddle: its width, its height, and the gap between its Tile's bottom edge and its underside, just above `dead`. */
  paddle: { w: 20, h: 3, inset: 24 },
  /**
   * The bottom this-many mm of every Tile is dead: no paddle sits in it, so
   * none is under the Host's HUD bar (about 20 mm of its Tile). A faint line
   * marks it on every Tile with a paddle.
   */
  dead: 22,
  /**
   * The wall fills a grid over the top `wallFraction` of the Layout bounds,
   * `top` below their upper edge (the lives and bricks-left text sits there)
   * and at least `side` in from their left and right, centred across them. A
   * brick is `w × h`, `gap` from its neighbours; one that would not lie wholly
   * on one Tile (it would straddle the gap between two phones) is never placed.
   */
  wallFraction: 0.3,
  brick: { w: 8, h: 4, gap: 1, top: 12, side: 2 },
  /** Ball speed at the start; every `speedEvery` bricks broken multiply it by `speedUp`, to at most `maxSpeed`. */
  speed: 110,
  speedUp: 1.08,
  speedEvery: 10,
  maxSpeed: 240,
  /** A serve heads at most this far off straight down. */
  maxServeAngle: (30 * Math.PI) / 180,
  /** A return off a paddle's very end leaves at this angle off straight up; off its middle, straight up. */
  maxReturnAngle: (60 * Math.PI) / 180,
  /**
   * A served ball rests where it is served this long before it moves. It rests
   * longer while play waits for a touch: the first ball until every Tile with a
   * human's paddle has been touched, a ball served after a loss until the Tile
   * of the paddle it rests on has.
   */
  serveWait: 1.2,
  /** Shared by every Player: each ball lost costs one, and the Match ends when none is left. */
  lives: 3,
  /** Bricks broken that bring a second ball into play (from then on, a lost ball is served again while lives are left). */
  secondBallAt: 20,
  /**
   * A bot's paddle moves at most `speed` toward where the next ball will cross
   * its face, aiming to meet it up to `aimError` off its centre (drawn anew
   * after every return it makes), so its returns spread over the wall.
   */
  bot: { speed: 200, aimError: 7 },
  /**
   * A state carries the wall when bricks broke, and at least this often (ms)
   * besides: the host never hears that a view started late (a phone reloaded
   * quicker than its loss is noticed rejoins without a pause), and the
   * platform hands such a view only states from then on, so it would draw no
   * bricks until the next one broke.
   */
  wallEveryMs: 1000,
  /** The host logs its bytes per frame and its upload this often, ms. */
  statsEveryMs: 1000,
} as const;

/** A view extrapolates a state at most this far ahead, ms. */
const MAX_AHEAD_MS = 100;
const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.55)';
/** The dead strip's edge. */
const FAINT = 'rgba(242, 240, 234, 0.2)';
/** A brick's colour by its row, top down; the rows below repeat the last. */
const ROW_COLOURS = ['#e05d5d', '#e0875d', '#e0b35d', '#c9d35d', '#79c46b', '#5db3c9', '#6b8fe0', '#9a7be0'];

/**
 * A ball, and the seconds it still rests where it was served before it moves at `vx, vy`. A ball served after a
 * loss rests on paddle `on` (riding along with it) until it moves.
 */
type Ball = { x: number; y: number; vx: number; vy: number; wait: number; on?: number };

/**
 * Two streams in one state: `world` in every state, `wall` only in a state
 * published when bricks broke, in the first, on a resume, and as a keyframe
 * every `BREAKOUT.wallEveryMs`. A view keeps the last wall it was sent.
 */
export type BreakoutState = {
  world: {
    balls: Ball[];
    /** Each paddle (one per Tile with no Tile below it): the x of its centre, in Layout order. */
    paddles: number[];
    lives: number;
    /** The paddles whose Tiles play waits to be touched before a resting ball moves; see `BREAKOUT.serveWait`. */
    hold: number[];
  };
  /** One string per row of the wall's grid, top down, one character per cell: `1` a brick, `0` none (never placed, or broken). */
  wall?: string[];
};

/** The views send nothing. */
export type BreakoutMessage = never;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** `p` reflected into `[lo, hi]`, as a ball bouncing between them would be. */
function fold(p: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (span <= 0) return (lo + hi) / 2;
  const u = (((p - lo) % (2 * span)) + 2 * span) % (2 * span);
  return u <= span ? lo + u : hi - (u - span);
}

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

/**
 * The play field, in world mm: the Layout bounds, a paddle on every Tile with
 * no other Tile below it in its own x-range (each column's bottom Tile, in
 * Layout order), and the wall's grid. Tiles are taken unrotated: no lobby
 * template rotates one.
 */
function field(m: { bounds: Rect; tiles: readonly Tile[] }) {
  const { ball: R, paddle: P, brick: K } = BREAKOUT;
  const b = m.bounds;
  const row = m.tiles.filter((t) => !m.tiles.some((o) => o.x < t.x + t.w && o.x + o.w > t.x && o.y >= t.y + t.h));
  /** Per paddle: its Tile's bottom edge, its column's floor. */
  const bottom = row.map((t) => t.y + t.h);
  const px = K.w + K.gap;
  const py = K.h + K.gap;
  const cols = Math.max(0, Math.floor((b.w - 2 * K.side + K.gap) / px));
  const rows = Math.max(0, Math.floor((b.h * BREAKOUT.wallFraction - K.top + K.gap) / py));
  const x0 = b.x + (b.w - (cols * px - K.gap)) / 2;
  const y0 = b.y + K.top;
  /** Cell `i` (row-major) of the wall's grid: its brick's rectangle, placed or not. */
  const brick = (i: number): Rect => ({ x: x0 + (i % cols) * px, y: y0 + Math.floor(i / cols) * py, w: K.w, h: K.h });
  /**
   * The paddle whose column `x` lies in: the one whose Tile spans `x` (the lower, if two do); between Tiles, the
   * lower of the nearest on either side. A ball wholly below its column's floor (`bottom`) is lost.
   */
  const column = (x: number): number => {
    let on = -1;
    let west = -1;
    let east = -1;
    row.forEach((t, k) => {
      if (x >= t.x && x <= t.x + t.w) {
        if (on < 0 || bottom[k]! > bottom[on]!) on = k;
      } else if (t.x + t.w < x) {
        if (west < 0 || t.x + t.w > row[west]!.x + row[west]!.w) west = k;
      } else if (east < 0 || t.x < row[east]!.x) east = k;
    });
    if (on >= 0) return on;
    if (west < 0 || east < 0) return Math.max(west, east);
    return bottom[west]! >= bottom[east]! ? west : east;
  };
  return {
    /** Where a ball's centre bounces off the bounds' left, right and top edges. */
    left: b.x + R,
    right: b.x + b.w - R,
    top: b.y + R,
    row,
    bottom,
    column,
    /** Per paddle: the y of a ball's centre when it touches the paddle's face, and the range of the paddle's centre on its Tile. */
    contact: row.map((t) => t.y + t.h - P.inset - P.h - R),
    lo: row.map((t) => t.x + P.w / 2),
    hi: row.map((t) => t.x + t.w - P.w / 2),
    rows,
    cols,
    x0,
    y0,
    px,
    py,
    brick,
    /** Every cell's brick at the start: placed (`1`) when it lies wholly on one Tile. */
    placed: Array.from({ length: rows * cols }, (_, i) => {
      const k = brick(i);
      return m.tiles.some((t) => k.x >= t.x && k.y >= t.y && k.x + k.w <= t.x + t.w && k.y + k.h <= t.y + t.h) ? 1 : 0;
    }),
  };
}

/** Each paddle's finger: the Device of the human seated at its Tile; none for a Tile that seats nobody (a bot plays it). */
const fingersOf = (match: MatchInfo, row: readonly Tile[]): (DeviceId | undefined)[] =>
  row.map((t) => (match.players.some((p) => !p.bot && p.deviceId === t.deviceId) ? t.deviceId : undefined));

/** Whether a paddle centred at `pad` meets a ball whose centre is at `x`. */
const covers = (pad: number, x: number): boolean => Math.abs(x - pad) <= BREAKOUT.paddle.w / 2 + BREAKOUT.ball;

/**
 * Co-operative Breakout over the whole Layout. Bricks fill the top of the
 * bounds; every Tile with no Tile below it has a paddle at its own bottom
 * (above the dead strip), moved along x by the finger of the human seated at
 * that Tile, else by a bot. A ball bounces off the bounds' left, right and top,
 * off bricks (breaking them) and off paddles (by where it hit, as in Pong).
 * One ball, two once `secondBallAt` bricks are broken; each ball that falls
 * below its column's floor (the bottom of the Tile under it) costs a shared
 * life. Play starts once every human paddle's Tile has been touched; a ball
 * served after a loss rests on the paddle that missed it until that Tile is
 * touched. Clearing the wall wins; losing the last life ends the Match.
 *
 * The wall goes out only when it changed, and as a keyframe every
 * `wallEveryMs`: every state has `world`, and one in which bricks broke (or
 * the keyframe falls due, or play resumes) also has `wall`; a view keeps the
 * last wall it was sent.
 */
export default defineGame<BreakoutState, BreakoutMessage>({
  manifest: {
    id: 'mgc.breakout',
    name: 'Breakout',
    version: '1.0.0',
    tiles: { min: 1, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 1, max: 4 },
    templates: ['row', 'grid'],
    bots: true,
    tickHz: 60,
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const F = field(match);
    const { ball: R, paddle: P } = BREAKOUT;
    const fingers = fingersOf(match, F.row);
    const rand = random(match.seed);
    // The bots' aim draws from its own stream: the serves are the same with or without bots.
    const aimRand = random(match.seed ^ 0x9e3779b9);

    const bricks = Uint8Array.from(F.placed);
    let left = bricks.reduce((n, v) => n + v, 0);
    let broken = 0;
    let lives: number = BREAKOUT.lives;
    const paddles = F.row.map((t) => t.x + t.w / 2);
    /** Per bot paddle: how far off its centre it means to meet the next ball. */
    const aim = F.row.map(() => 0);
    /** Whether the next state must carry the wall: the first, after any brick broke, and on a resume. */
    let wallChanged = true;
    /** Per paddle: the pointers down on its Tile. */
    const down = F.row.map(() => new Set<number>());
    /** The human paddles play waits for: each until its Tile is first touched, and one that missed a ball until it is touched again (a finger down on it counts). */
    const hold = new Set(F.row.flatMap((_, k) => (fingers[k] === undefined ? [] : [k])));

    const speed = (): number => Math.min(BREAKOUT.maxSpeed, BREAKOUT.speed * BREAKOUT.speedUp ** Math.floor(broken / BREAKOUT.speedEvery));
    /** A ball resting mid-way down a random paddle's Tile, to head down toward that paddle when its rest is over. */
    const serve = (): Ball => {
      const t = F.row[Math.floor(rand() * F.row.length)]!;
      const angle = (rand() * 2 - 1) * BREAKOUT.maxServeAngle;
      const v = speed();
      return { x: t.x + t.w / 2, y: t.y + t.h / 2, vx: v * Math.sin(angle), vy: v * Math.cos(angle), wait: BREAKOUT.serveWait };
    };
    /** A ball resting on paddle `k`, to head up off it when its rest is over; a human's waits for a touch on its Tile. */
    const serveOff = (k: number): Ball => {
      const angle = (rand() * 2 - 1) * BREAKOUT.maxServeAngle;
      const v = speed();
      if (fingers[k] !== undefined) hold.add(k);
      return { x: paddles[k]!, y: F.contact[k]!, vx: v * Math.sin(angle), vy: -v * Math.cos(angle), wait: BREAKOUT.serveWait, on: k };
    };
    const balls: Ball[] = [serve()];

    /** The brick ball `b` overlaps nearest its centre, if any: broken, and the ball sent back along the axis it overlaps least. */
    const hitBrick = (b: Ball): void => {
      const c0 = Math.max(0, Math.floor((b.x - R - F.x0) / F.px));
      const c1 = Math.min(F.cols - 1, Math.floor((b.x + R - F.x0) / F.px));
      const r0 = Math.max(0, Math.floor((b.y - R - F.y0) / F.py));
      const r1 = Math.min(F.rows - 1, Math.floor((b.y + R - F.y0) / F.py));
      let hit = -1;
      let nearest = R * R;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * F.cols + c;
          if (!bricks[i]) continue;
          const k = F.brick(i);
          const d = (b.x - clamp(b.x, k.x, k.x + k.w)) ** 2 + (b.y - clamp(b.y, k.y, k.y + k.h)) ** 2;
          if (d < nearest) [hit, nearest] = [i, d];
        }
      }
      if (hit < 0) return;
      bricks[hit] = 0;
      left--;
      broken++;
      wallChanged = true;
      const k = F.brick(hit);
      const overX = Math.min(b.x + R, k.x + k.w) - Math.max(b.x - R, k.x);
      const overY = Math.min(b.y + R, k.y + k.h) - Math.max(b.y - R, k.y);
      if (overX < overY) {
        const west = b.x < k.x + k.w / 2;
        b.vx = west ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x = west ? k.x - R : k.x + k.w + R;
      } else {
        const above = b.y < k.y + k.h / 2;
        b.vy = above ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y = above ? k.y - R : k.y + k.h + R;
      }
      // Every `speedEvery` bricks every ball speeds up, resting ones too; at `secondBallAt` a second one is served.
      if (broken % BREAKOUT.speedEvery === 0) {
        const v = speed();
        for (const o of balls) {
          const was = Math.hypot(o.vx, o.vy);
          if (was > 0) [o.vx, o.vy] = [(o.vx * v) / was, (o.vy * v) / was];
        }
      }
      if (broken === BREAKOUT.secondBallAt) balls.push(serve());
    };
    /** Ball `b` met paddle `k`'s face: back up, further off straight the further off-centre it hit. */
    const ret = (b: Ball, k: number): void => {
      const angle = clamp((b.x - paddles[k]!) / (P.w / 2 + R), -1, 1) * BREAKOUT.maxReturnAngle;
      const v = speed();
      b.vx = v * Math.sin(angle);
      b.vy = -v * Math.cos(angle);
      b.y = 2 * F.contact[k]! - b.y;
      if (fingers[k] === undefined) aim[k] = (aimRand() * 2 - 1) * BREAKOUT.bot.aimError;
    };
    /** Where bot paddle `k` heads: where the ball due soonest over its Tile will cross its face, off by its aim; its Tile's middle while none is. */
    const goal = (k: number): number => {
      const t = F.row[k]!;
      const contact = F.contact[k]!;
      let best = t.x + t.w / 2 - aim[k]!;
      let soonest = Infinity;
      for (const b of balls) {
        if (b.vy <= 0 || b.y > contact) continue;
        const time = (contact - b.y) / b.vy;
        const x = fold(b.x + b.vx * time, F.left, F.right);
        if (x >= t.x - R && x <= t.x + t.w + R && b.wait + time < soonest) [best, soonest] = [x, b.wait + time];
      }
      return clamp(best + aim[k]!, F.lo[k]!, F.hi[k]!);
    };

    // The wire budget, logged every `statsEveryMs`: every state goes to every Peer.
    const peers = match.devices.length - 1;
    const stats = { since: ctx.now(), frames: 0, wallFrames: 0, bytes: 0, frame: 0, wallFrame: 0 };
    /** Shared time of the last state that carried the wall. */
    let wallAt = -Infinity;
    const publish = (now: number): void => {
      const world: BreakoutState['world'] = { balls: balls.map((b) => ({ ...b })), paddles: [...paddles], lives, hold: [...hold].sort((a, b) => a - b) };
      let state: BreakoutState = { world };
      if (wallChanged || now - wallAt >= BREAKOUT.wallEveryMs) {
        state = { world, wall: Array.from({ length: F.rows }, (_, r) => bricks.subarray(r * F.cols, (r + 1) * F.cols).join('')) };
        [wallAt, wallChanged] = [now, false];
      }
      ctx.publish(state);
      const size = JSON.stringify(state).length;
      stats.frames++;
      stats.bytes += size * peers;
      if (state.wall) [stats.wallFrames, stats.wallFrame] = [stats.wallFrames + 1, size];
      else stats.frame = size;
    };
    const logStats = (now: number): void => {
      const s = (now - stats.since) / 1000;
      if (s * 1000 < BREAKOUT.statsEveryMs) return;
      ctx.log(
        `wire: ${stats.frame} B/frame, ${stats.wallFrame} B with the wall; ${stats.frames} frames (${stats.wallFrames} with the wall) in ${s.toFixed(2)} s; host upload ${Math.round(stats.bytes / s)} B/s to ${peers} Peers`,
      );
      Object.assign(stats, { since: now, frames: 0, wallFrames: 0, bytes: 0 });
    };

    publish(ctx.now());
    return {
      onInput(i) {
        const k = fingers.indexOf(i.deviceId);
        if (k < 0) return;
        // Every sample is a touch; a pointer is down from its `down` to its `up` or `cancel`.
        if (i.phase === 'down') down[k]!.add(i.pointerId);
        else if (i.phase === 'up' || i.phase === 'cancel') down[k]!.delete(i.pointerId);
        if (i.phase === 'cancel') return;
        hold.delete(k);
        paddles[k] = clamp(i.world.x, F.lo[k]!, F.hi[k]!);
      },
      // Nothing moved while paused; the views get the balls where they stopped, stamped now, and the wall
      // (a phone reloaded during the pause has none).
      onResume(now) {
        wallChanged = true;
        publish(now);
      },
      tick(dt, now) {
        // A finger already down on a held paddle's Tile is the touch it waits for.
        for (const k of hold) if (down[k]!.size > 0) hold.delete(k);
        const reach = BREAKOUT.bot.speed * dt;
        fingers.forEach((finger, k) => {
          if (finger === undefined) paddles[k]! += clamp(goal(k) - paddles[k]!, -reach, reach);
        });
        for (const b of [...balls]) {
          if (b.wait > 0) {
            // A ball served off a paddle rides on it, and waits for a touch on that paddle's Tile; any other for every held one.
            if (b.on !== undefined) [b.x, b.y] = [paddles[b.on]!, F.contact[b.on]!];
            if (b.on !== undefined ? !hold.has(b.on) : hold.size === 0) b.wait = Math.max(0, b.wait - dt);
            if (b.wait === 0) delete b.on;
            continue;
          }
          const was = b.y;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < F.left) [b.x, b.vx] = [2 * F.left - b.x, Math.abs(b.vx)];
          else if (b.x > F.right) [b.x, b.vx] = [2 * F.right - b.x, -Math.abs(b.vx)];
          if (b.y < F.top) [b.y, b.vy] = [2 * F.top - b.y, Math.abs(b.vy)];
          hitBrick(b);
          // A paddle returns the ball when its face is crossed this step where the paddle is.
          const k = paddles.findIndex((pad, k) => b.vy > 0 && was <= F.contact[k]! && b.y > F.contact[k]! && covers(pad, b.x));
          if (k >= 0) ret(b, k);
          // Wholly below its column's floor: lost, a life gone; served again off that column's paddle while lives are left.
          const c = F.column(b.x);
          if (b.y - R > F.bottom[c]!) {
            lives--;
            balls.splice(balls.indexOf(b), 1, ...(lives > 0 ? [serveOff(c)] : []));
          }
        }
        logStats(now);
        if (left === 0 || lives === 0) {
          publish(now);
          // Co-operative: everyone shares the outcome. A cleared wall ranks every Player; a lost Match ranks nobody.
          ctx.end(left === 0 ? { ranking: match.players.map((p) => p.playerId) } : {});
          return;
        }
        publish(now);
      },
    };
  },
  view(ctx) {
    const F = field(ctx.match);
    const { ball: R, paddle: P, brick: K } = BREAKOUT;
    const bots = fingersOf(ctx.match, F.row).map((finger) => finger === undefined);
    /** Per paddle: the name of the human seated at its Tile, for the "touch to start" line. */
    const names = F.row.map((t) => ctx.match.players.find((p) => !p.bot && p.deviceId === t.deviceId)?.name ?? '');
    /** The last wall sent: a state without one leaves the bricks as they were. */
    let wall: readonly string[] = [];
    let left = 0;
    /** Shared time of the last resume: a state from before it shows the balls where the pause stopped them. */
    let resumedAt = -Infinity;
    return {
      onState(s) {
        if (!s.wall) return;
        wall = s.wall;
        left = wall.reduce((n, row) => n + row.split('1').length - 1, 0);
      },
      onResume(now) {
        resumedAt = now;
      },
      draw({ ctx: g, state: s, now, t, tile }) {
        if (!s) return;
        wall.forEach((row, r) => {
          g.fillStyle = ROW_COLOURS[Math.min(r, ROW_COLOURS.length - 1)]!;
          for (let c = 0; c < row.length; c++) if (row[c] === '1') g.fillRect(F.x0 + c * F.px, F.y0 + r * F.py, K.w, K.h);
        });

        // Every paddle above its Tile's dead strip, the strip's edge a faint line; a bot's labelled inside the strip.
        g.font = '600 3.5px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.lineWidth = 0.4;
        g.strokeStyle = FAINT;
        F.row.forEach((tile, k) => {
          const dead = F.bottom[k]! - BREAKOUT.dead;
          g.beginPath();
          g.moveTo(tile.x, dead);
          g.lineTo(tile.x + tile.w, dead);
          g.stroke();
          const x = s.world.paddles[k] ?? tile.x + tile.w / 2;
          g.fillStyle = FG;
          g.fillRect(x - P.w / 2, F.contact[k]! + R, P.w, P.h);
          if (bots[k]) {
            g.fillStyle = DIM;
            g.fillText('BOT', x, dead + 1.5);
          }
        });
        g.fillStyle = FG;

        // Extrapolate on the shared clock off the bounds' edges and back up off a paddle in the way; a resting ball stays put.
        const ahead = Math.min(Math.max(now - Math.max(t, resumedAt), 0), MAX_AHEAD_MS) / 1000;
        for (const b of s.world.balls) {
          const moving = Math.max(0, ahead - b.wait);
          const x = fold(b.x + b.vx * moving, F.left, F.right);
          let y = b.y + b.vy * moving;
          if (y < F.top) y = 2 * F.top - y;
          const k = s.world.paddles.findIndex((pad, k) => b.vy > 0 && b.y <= F.contact[k]! && y > F.contact[k]! && covers(pad, x));
          if (k >= 0) y = 2 * F.contact[k]! - y;
          g.beginPath();
          g.arc(x, y, R, 0, Math.PI * 2);
          if (b.wait > ahead) {
            g.strokeStyle = FG;
            g.lineWidth = 0.6;
            g.stroke();
          } else g.fill();
        }

        if (!tile) return;
        g.fillStyle = DIM;
        g.font = '600 4px system-ui, sans-serif';
        g.textAlign = 'left';
        g.fillText(`Lives ${s.world.lives} · Bricks ${left}`, tile.x + 3, tile.y + 3);
        // Play waits for a touch: every Tile names each Player it waits for, below the middle (a first serve rests there).
        g.fillStyle = FG;
        g.font = '600 5px system-ui, sans-serif';
        g.textAlign = 'center';
        s.world.hold.forEach((k, j) => g.fillText(`${names[k]}, touch to start`, tile.x + tile.w / 2, tile.y + tile.h * 0.6 + 7 * j, tile.w - 6));
      },
    };
  },
});
