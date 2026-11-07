import { defineGame, Surface, type MatchInfo, type MatchResult, type Player } from '@mgc/sdk';

/** Sizes in world mm, speeds in mm/s, times in seconds (`…Ms`: ms). */
export const AIR_HOCKEY = {
  /** Puck radius. */
  puck: 5,
  /** Paddle radius. */
  paddle: 9,
  /** Width of each goal's mouth, centred on its end of the table (at most the table's width). */
  goal: 50,
  /** The share of its speed the gliding puck loses every second. */
  friction: 0.25,
  /**
   * The share of its speed into a wall the puck keeps as it bounces off. A paddle
   * is a wall that moves: the same share of the puck's speed relative to it.
   */
  restitution: 0.85,
  /** The puck never moves faster than this. */
  maxSpeed: 420,
  /** A serve leaves the centre at this speed, at most `maxServeAngle` off straight toward the Player it goes to. */
  serve: 90,
  maxServeAngle: (25 * Math.PI) / 180,
  /** The puck rests at the centre this long before a serve moves it; a paddle may strike it sooner. */
  serveWait: 1,
  /** A puck slower than `stall` for `stallFor` seconds is served again, toward the Player whose half it lies in. */
  stall: 20,
  stallFor: 3,
  /**
   * A finger moves its paddle at the speed of its last two samples, until no
   * sample has reached the host for `stillMs`: then the paddle stands, and
   * strikes at no speed.
   */
  stillMs: 100,
  /** Goals that win. */
  win: 7,
  /**
   * A bot's paddle moves at most `speed`. It waits `line` in front of its goal.
   * A puck coming at its goal it meets on that line where the puck will cross
   * it, off by up to `aimError` either way (drawn anew at every strike), so a
   * bad guess lets one past; a puck loose in its half, ahead of it, it goes
   * straight through.
   */
  bot: { speed: 150, aimError: 8, line: 22 },
} as const;

/** A view extrapolates a state at most this far ahead, ms. */
const MAX_AHEAD_MS = 100;
/**
 * How far a score sits in from its Player's end: clear of a paddle waiting home (`bot.line` ± its radius).
 * The centre circle's radius; a goal mouth's thickness.
 */
const SCORE_INSET = 45;
const CIRCLE = 15;
const GOAL_BAR = 2;
const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.35)';

type Axis = 'x' | 'y';
type Side = 0 | 1;
type P = { x: number; y: number };
type Puck = { x: number; y: number; vx: number; vy: number };
/** A side's paddle centre stays within `lo`–`hi`. */
type Box = { lo: P; hi: P };

/** Side 0 defends the end nearer the first Tile, side 1 the other; `seats` says whose. World mm throughout. */
export type AirHockeyState = {
  puck: Puck;
  /** Paddle centre per side. */
  pads: [P, P];
  /** Goals per side. */
  score: [number, number];
  /** Seconds the puck still rests at the centre before the serve moves it. */
  wait: number;
  /** The human sides play waits for until they first touch their Tile; nothing but the paddles moves meanwhile. Empty once play runs. */
  hold: Side[];
};

/** Views send nothing. */
export type AirHockeyMessage = never;

const SIZE = { x: 'w', y: 'h' } as const;
const SPEED = { x: 'vx', y: 'vy' } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** `p` reflected into `[lo, hi]`, as a puck bouncing between them would be. */
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
 * Who plays each side: side 0 the human seated at the first Tile, side 1 the
 * one seated at the last Tile (another one: with one Tile its human plays side
 * 0); the bots take the sides still open in order. From `Player.deviceId`,
 * never a Player's index in `match.players`.
 */
function seats(match: MatchInfo): [Player, Player] {
  const { players, tiles } = match;
  const first = players.find((p) => !p.bot && p.deviceId === tiles[0]!.deviceId);
  const last = players.find((p) => !p.bot && p !== first && p.deviceId === tiles[tiles.length - 1]!.deviceId);
  const rest = players.filter((p) => p !== first && p !== last);
  const sides = [first ?? rest.shift(), last ?? rest.shift()] as const;
  if (!sides[0] || !sides[1]) throw new Error('Air Hockey needs a Player at each end');
  return [sides[0], sides[1]];
}

/**
 * The table. A Tile's `x, y` is its screen's top-left corner and `w, h` its
 * own size, turned by `rot` about that corner, so the Tiles' world boxes come
 * from the SDK's `Surface`, never from those numbers as they are. The Players
 * face each other along `axis`: from the first Tile toward the last (a row: x;
 * a column: y), or along a lone Tile's longer side. Along it the table spans
 * the Layout bounds, with a goal in the middle of each end; across it only the
 * band every Tile covers, so the puck stays on screen when one Tile is
 * narrower than the others. Side 0 defends the end nearer a point three
 * quarters down the first Tile's screen: its centre, nudged toward the edge
 * its Player faces, so that a lone Tile's human defends the end at the bottom
 * of their screen. Side 1 defends the other end; each half runs from its end
 * to the centre line. `lo`–`hi` bound the puck's centre, `half[s]` side `s`'s
 * paddle centre; `into[s]` points from side `s`'s end into the table.
 */
function table(m: MatchInfo) {
  const { puck: R, paddle: r } = AIR_HOCKEY;
  const surfaces = m.tiles.map((t) => new Surface({ id: t.deviceId, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot }, 1));
  const boxes = surfaces.map((s) => s.worldAabb());
  const a = boxes[0]!;
  const z = boxes[boxes.length - 1]!;
  const dx = Math.abs(z.x + z.w / 2 - (a.x + a.w / 2));
  const dy = Math.abs(z.y + z.h / 2 - (a.y + a.h / 2));
  const axis: Axis = boxes.length > 1 ? (dx >= dy ? 'x' : 'y') : a.w >= a.h ? 'x' : 'y';
  const across: Axis = axis === 'x' ? 'y' : 'x';
  /** The world point `along` the axis and `side` across it. */
  const at = (along: number, side: number): P => (axis === 'x' ? { x: along, y: side } : { x: side, y: along });
  const b = m.bounds;
  const start = b[axis];
  const end = b[axis] + b[SIZE[axis]];
  let band: [number, number] = [Math.max(...boxes.map((t) => t[across])), Math.min(...boxes.map((t) => t[across] + t[SIZE[across]]))];
  // Tiles with no common band (neither a row nor a column): the bounds, as the best there is.
  if (band[1] - band[0] < 4 * r) band = [b[across], b[across] + b[SIZE[across]]];
  const mid = at((start + end) / 2, (band[0] + band[1]) / 2);
  const seat = surfaces[0]!.localToWorld({ x: m.tiles[0]!.w / 2, y: (m.tiles[0]!.h * 3) / 4 });
  const ends: [number, number] = seat[axis] - start <= end - seat[axis] ? [start, end] : [end, start];
  const into: [1 | -1, 1 | -1] = ends[0] === start ? [1, -1] : [-1, 1];
  const half = ([0, 1] as const).map((s): Box => {
    const [p, q] = [ends[s] + into[s] * r, mid[axis] - into[s] * r];
    return { lo: at(Math.min(p, q), band[0] + r), hi: at(Math.max(p, q), band[1] - r) };
  });
  return {
    axis,
    across,
    at,
    start,
    end,
    band,
    mid,
    ends,
    into,
    half: [half[0]!, half[1]!] as const,
    lo: at(start + R, band[0] + R),
    hi: at(end - R, band[1] - R),
    /** Half a goal mouth's width. */
    mouth: Math.min(AIR_HOCKEY.goal, band[1] - band[0]) / 2,
  };
}

/**
 * Air Hockey on two phones laid end to end. Each Player's paddle follows their
 * finger on their own Tile, within their half; the host moves a bot's. The
 * puck glides with friction, bounces off the walls and off paddles, taking a
 * striking paddle's speed with it, and a goal at either end scores for the
 * other Player; the puck is then served from the centre toward the one who
 * conceded, as it is when it has crawled for `AIR_HOCKEY.stallFor`. Play
 * starts once every human has touched their Tile. First to seven wins.
 *
 * Nothing here reads a Tile's `rot` but `table`: input arrives in world mm
 * and every view draws in world mm, whichever way its phone is turned.
 */
export default defineGame<AirHockeyState, AirHockeyMessage>({
  manifest: {
    id: 'mgc.air-hockey',
    name: 'Air Hockey',
    version: '1.0.0',
    tiles: { min: 1, max: 2 },
    controllers: { min: 0, max: 0 },
    players: { min: 2, max: 2 },
    templates: ['row', 'column'],
    bots: true,
    tickHz: 60,
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const T = table(match);
    const { axis: A, across: C } = T;
    const seated = seats(match);
    const players = [seated[0].playerId, seated[1].playerId] as const;
    /** The Device whose finger moves each side's paddle: its seated human's; none for a bot. */
    const fingers = seated.map((p) => (p.bot ? undefined : p.deviceId));
    const bots = ([0, 1] as const).filter((s) => seated[s].bot);
    const rand = random(match.seed);
    // The bots' aim draws from its own stream: the serves are the same with or without bots.
    const aimRand = random(match.seed ^ 0x9e3779b9);
    const { puck: R, restitution: e } = AIR_HOCKEY;
    const reach = AIR_HOCKEY.puck + AIR_HOCKEY.paddle;

    /** `p` held to side `s`'s half. */
    const keep = (s: Side, p: P): P => ({ x: clamp(p.x, T.half[s].lo.x, T.half[s].hi.x), y: clamp(p.y, T.half[s].lo.y, T.half[s].hi.y) });
    /** Where side `s`'s paddle starts and a bot waits: on its line, mid-goal. */
    const home = (s: Side): P => keep(s, T.at(T.ends[s] + T.into[s] * AIR_HOCKEY.bot.line, T.mid[C]));
    const pads: [P, P] = [home(0), home(1)];
    /** Each paddle's centre at the last step: since then it swept from there to `pads`. */
    const from: [P, P] = [{ ...pads[0] }, { ...pads[1] }];
    /** Each paddle's velocity: a finger's from its last two samples, a bot's from its last step. */
    const vel: [P, P] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    /** Each finger's last sample: where it put the paddle, its capture time, and when it reached the host (ms). */
    const seen: [{ p: P; t: number; at: number } | undefined, { p: P; t: number; at: number } | undefined] = [undefined, undefined];
    const score: [number, number] = [0, 0];
    let puck: Puck = { ...T.mid, vx: 0, vy: 0 };
    let wait = 0;
    /** Seconds the puck has been slower than `AIR_HOCKEY.stall`. */
    let slow = 0;
    /** How far off a bot aims at the puck in flight: none at a serve, anew at every strike. */
    let aim = 0;
    /** The human sides play waits for: every one until it first touches. */
    const hold = new Set(([0, 1] as const).filter((s) => fingers[s] !== undefined));

    const serve = (toward: Side): void => {
      const angle = (rand() * 2 - 1) * AIR_HOCKEY.maxServeAngle;
      const v = T.at(-T.into[toward] * AIR_HOCKEY.serve * Math.cos(angle), AIR_HOCKEY.serve * Math.sin(angle));
      puck = { ...T.mid, vx: v.x, vy: v.y };
      wait = AIR_HOCKEY.serveWait;
      slow = 0;
      aim = 0;
    };
    /**
     * Side `s`'s paddle against the puck over this step: both moved in a
     * straight line (the paddle from `from[s]`, the puck from `was`), and they
     * touch at the first moment they are `reach` apart. If the puck was coming
     * at the paddle (relative to it) it bounces off it as off a moving wall,
     * keeping `restitution` of that relative speed, and the paddle's own
     * velocity carries over; a puck still resting counts as standing. Either
     * way it ends the step against the paddle, never inside it.
     */
    const strike = (s: Side, was: P, resting: boolean): void => {
      const q = pads[s];
      const d0 = { x: was.x - from[s].x, y: was.y - from[s].y };
      const dd = { x: puck.x - q.x - d0.x, y: puck.y - q.y - d0.y };
      const a = dd.x ** 2 + dd.y ** 2;
      const b = 2 * (d0.x * dd.x + d0.y * dd.y);
      const c = d0.x ** 2 + d0.y ** 2 - reach ** 2;
      let tau = 0;
      if (c > 0) {
        const disc = b * b - 4 * a * c;
        if (a === 0 || disc < 0) return;
        tau = (-b - Math.sqrt(disc)) / (2 * a);
        if (tau < 0 || tau > 1) return;
      }
      const n0 = { x: d0.x + dd.x * tau, y: d0.y + dd.y * tau };
      const len = Math.hypot(n0.x, n0.y);
      // One right on top of the other: out toward the far end.
      const n = len > 0 ? { x: n0.x / len, y: n0.y / len } : T.at(T.into[s], 0);
      const v = vel[s];
      const u = { x: (resting ? 0 : puck.vx) - v.x, y: (resting ? 0 : puck.vy) - v.y };
      const un = u.x * n.x + u.y * n.y;
      if (un < 0) {
        const vx = v.x + u.x - (1 + e) * un * n.x;
        const vy = v.y + u.y - (1 + e) * un * n.y;
        const k = Math.min(1, AIR_HOCKEY.maxSpeed / Math.hypot(vx, vy));
        puck.vx = vx * k;
        puck.vy = vy * k;
        wait = 0;
        aim = (aimRand() * 2 - 1) * AIR_HOCKEY.bot.aimError;
      } else if (Math.hypot(puck.x - q.x, puck.y - q.y) >= reach) return;
      puck.x = q.x + n.x * reach;
      puck.y = q.y + n.y * reach;
    };
    /**
     * Where side `s`'s bot heads: a puck coming at its goal, where it will
     * cross the bot's line (walls folded in), off by `aim`; a puck loose in its
     * half ahead of it, the puck itself; else home.
     */
    const target = (s: Side): P => {
      const line = T.ends[s] + T.into[s] * AIR_HOCKEY.bot.line;
      const va = puck[SPEED[A]];
      if (wait > 0) return home(s);
      if (va * T.into[s] < 0 && (puck[A] - line) * T.into[s] > 0) {
        const time = (line - puck[A]) / va;
        return T.at(line, fold(puck[C] + puck[SPEED[C]] * time, T.lo[C], T.hi[C]) + aim);
      }
      if ((puck[A] - T.mid[A]) * T.into[s] < 0 && (puck[A] - pads[s][A]) * T.into[s] > 0) return { x: puck.x, y: puck.y };
      return home(s);
    };
    const snapshot = (): AirHockeyState => ({ puck: { ...puck }, pads: [{ ...pads[0] }, { ...pads[1] }], score: [score[0], score[1]], wait, hold: [...hold] });

    serve(match.seed & 1 ? 1 : 0);
    return {
      onInput(i) {
        const s = fingers.indexOf(i.deviceId);
        if ((s !== 0 && s !== 1) || i.phase === 'cancel') return;
        hold.delete(s);
        const p = keep(s, i.world);
        const last = seen[s];
        // A finger that lands puts its paddle there at once: no sweep, no speed.
        if (i.phase === 'down') {
          from[s] = p;
          vel[s] = { x: 0, y: 0 };
        } else if (last && i.t > last.t) {
          vel[s] = { x: ((p.x - last.p.x) * 1000) / (i.t - last.t), y: ((p.y - last.p.y) * 1000) / (i.t - last.t) };
        }
        pads[s] = p;
        seen[s] = { p, t: i.t, at: ctx.now() };
      },
      // Nothing moved while paused; the views get the puck where it stopped, stamped now.
      onResume() {
        ctx.publish(snapshot());
      },
      tick(dt, now) {
        // A bot's paddle first: at most its speed, toward where it means to meet the puck.
        for (const s of bots) {
          const p = pads[s];
          const g = target(s);
          const d = Math.hypot(g.x - p.x, g.y - p.y);
          const k = d > AIR_HOCKEY.bot.speed * dt ? (AIR_HOCKEY.bot.speed * dt) / d : 1;
          pads[s] = keep(s, { x: p.x + (g.x - p.x) * k, y: p.y + (g.y - p.y) * k });
          vel[s] = { x: (pads[s].x - p.x) / dt, y: (pads[s].y - p.y) / dt };
        }
        for (const s of [0, 1] as const) {
          const last = seen[s];
          if (fingers[s] !== undefined && (!last || now - last.at > AIR_HOCKEY.stillMs)) vel[s] = { x: 0, y: 0 };
        }
        if (hold.size > 0) {
          from[0] = { ...pads[0] };
          from[1] = { ...pads[1] };
          ctx.publish(snapshot());
          return;
        }

        const was = { x: puck.x, y: puck.y };
        const resting = wait > 0;
        if (resting) wait = Math.max(0, wait - dt);
        else {
          const k = (1 - AIR_HOCKEY.friction) ** dt;
          puck.vx *= k;
          puck.vy *= k;
          puck.x += puck.vx * dt;
          puck.y += puck.vy * dt;
        }
        strike(0, was, resting);
        strike(1, was, resting);
        from[0] = { ...pads[0] };
        from[1] = { ...pads[1] };
        // The walls: every side but a goal's mouth. A puck already past an end's line is in its goal and goes on.
        for (const d of ['x', 'y'] as const) {
          if (d === A && (Math.abs(puck[C] - T.mid[C]) < T.mouth || was[d] < T.lo[d] || was[d] > T.hi[d])) continue;
          const v = SPEED[d];
          if (puck[d] < T.lo[d]) {
            puck[d] = 2 * T.lo[d] - puck[d];
            puck[v] = Math.abs(puck[v]) * e;
          } else if (puck[d] > T.hi[d]) {
            puck[d] = 2 * T.hi[d] - puck[d];
            puck[v] = -Math.abs(puck[v]) * e;
          }
        }

        // Wholly past an end: a goal for the other side, served toward the side that conceded.
        const lost = ([0, 1] as const).find((s) => (puck[A] - T.ends[s]) * T.into[s] < -R);
        if (lost !== undefined) {
          const scorer = lost === 0 ? 1 : 0;
          score[scorer]++;
          if (score[scorer] >= AIR_HOCKEY.win) {
            puck = { ...T.mid, vx: 0, vy: 0 };
            wait = 0;
            ctx.publish(snapshot());
            const result: MatchResult = { scores: { [players[0]]: score[0], [players[1]]: score[1] }, ranking: [players[scorer], players[lost]] };
            ctx.end(result);
            return;
          }
          serve(lost);
        } else if (wait === 0 && Math.hypot(puck.vx, puck.vy) < AIR_HOCKEY.stall) {
          slow += dt;
          if (slow >= AIR_HOCKEY.stallFor) serve((puck[A] - T.mid[A]) * T.into[0] < 0 ? 0 : 1);
        } else slow = 0;
        ctx.publish(snapshot());
      },
    };
  },
  view(ctx) {
    const T = table(ctx.match);
    const { axis: A, across: C } = T;
    const sides = seats(ctx.match);
    /**
     * Each side's "up": from its end toward the other, as its Player reads the
     * table, as the canvas rotation that turns upright text that way. World
     * directions only: the SDK's transform turns a whole Tile, `rot` and all.
     */
    const upright = T.into.map((dir) => {
      const u = T.at(dir, 0);
      return Math.atan2(u.x, -u.y);
    });
    /** `text` centred `inset` in from side `s`'s end, mid-table, upright for its Player. */
    const say = (g: CanvasRenderingContext2D, s: Side, text: string, inset: number): void => {
      const p = T.at(T.ends[s] + T.into[s] * inset, T.mid[C]);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(upright[s]!);
      g.fillText(text, 0, 0);
      g.restore();
    };
    /** Shared time of the last resume: a state from before it shows the puck where the pause stopped it. */
    let resumedAt = -Infinity;
    return {
      onResume(now) {
        resumedAt = now;
      },
      draw({ ctx: g, state: s, now, t }) {
        if (!s) return;
        // The table's edge, the centre line and circle, and the goals.
        const corner = T.at(T.start, T.band[0]);
        const far = T.at(T.end, T.band[1]);
        const line = [T.at(T.mid[A], T.band[0]), T.at(T.mid[A], T.band[1])] as const;
        g.strokeStyle = DIM;
        g.lineWidth = 1;
        g.strokeRect(corner.x, corner.y, far.x - corner.x, far.y - corner.y);
        g.beginPath();
        g.moveTo(line[0].x, line[0].y);
        g.lineTo(line[1].x, line[1].y);
        g.stroke();
        g.beginPath();
        g.arc(T.mid.x, T.mid.y, CIRCLE, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = FG;
        for (const side of [0, 1] as const) {
          const a = T.at(T.ends[side], T.mid[C] - T.mouth);
          const b = T.at(T.ends[side] + T.into[side] * GOAL_BAR, T.mid[C] + T.mouth);
          g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        }

        // Each score in front of its Player's goal, upright for them; a bot's labelled, a held Player asked to touch.
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const side of [0, 1] as const) {
          g.fillStyle = DIM;
          g.font = '600 14px system-ui, sans-serif';
          say(g, side, String(s.score[side]), SCORE_INSET);
          g.font = '600 4.5px system-ui, sans-serif';
          if (sides[side].bot) say(g, side, 'BOT', SCORE_INSET - 12);
          if (s.hold.includes(side)) {
            g.fillStyle = FG;
            g.font = '600 5px system-ui, sans-serif';
            say(g, side, `${sides[side].name}, touch to start`, Math.abs(T.mid[A] - T.ends[side]) / 2 + 10);
          }
        }

        g.fillStyle = FG;
        for (const p of s.pads) {
          g.beginPath();
          g.arc(p.x, p.y, AIR_HOCKEY.paddle, 0, Math.PI * 2);
          g.fill();
        }
        // Extrapolate on the shared clock, off the walls as the host bounces it (friction aside, over at most
        // MAX_AHEAD_MS) but on into a goal's mouth; paddles aside: the next state has any strike.
        const moving = s.hold.length > 0 ? 0 : Math.max(0, Math.min(Math.max(now - Math.max(t, resumedAt), 0), MAX_AHEAD_MS) / 1000 - s.wait);
        const p = { x: s.puck.x + s.puck.vx * moving, y: s.puck.y + s.puck.vy * moving };
        p[C] = fold(p[C], T.lo[C], T.hi[C]);
        if (Math.abs(p[C] - T.mid[C]) >= T.mouth && s.puck[A] >= T.lo[A] && s.puck[A] <= T.hi[A]) p[A] = fold(p[A], T.lo[A], T.hi[A]);
        // Resting before a serve, or held: a ring, so nobody mistakes it for play.
        g.beginPath();
        g.arc(p.x, p.y, AIR_HOCKEY.puck, 0, Math.PI * 2);
        if (s.wait > 0 || s.hold.length > 0) {
          g.strokeStyle = FG;
          g.stroke();
        } else g.fill();
      },
    };
  },
});
