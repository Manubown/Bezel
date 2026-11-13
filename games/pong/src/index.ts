import { defineGame, playerColour, type DeviceId, type MatchInfo, type MatchResult, type Player, type Rect, type Tile, type Vec2 } from '@mgc/sdk';

/** Sizes in world mm, speeds in mm/s, angles in radians, times in seconds. */
export const PONG = {
  /** Ball radius. */
  ball: 3.5,
  /** A paddle: its width, its height, and the gap between the table's edge and its back. */
  paddle: { w: 4, h: 30, inset: 6 },
  /** Ball speed at a serve; each return speeds it up by `speedUp`, to at most `maxSpeed`. */
  speed: 150,
  speedUp: 1.06,
  maxSpeed: 320,
  /** A serve leaves the centre at most this far off the horizontal. */
  maxServeAngle: (25 * Math.PI) / 180,
  /** A return off a paddle's very end leaves at this angle; off its middle, straight. */
  maxReturnAngle: (50 * Math.PI) / 180,
  /** The ball rests at the centre this long before a serve. */
  serveWait: 0.8,
  /** Points that win. */
  win: 7,
  /**
   * A bot's paddle moves at most `speed` toward where the ball will cross its
   * face, off by up to `aimError` either way (drawn anew for every shot the
   * other side returns), so a steep or fast shot, or a bad guess, beats it.
   */
  bot: { speed: 160, aimError: 20 },
  /**
   * A human side is present while a finger is on its Tile or its last touch is
   * less than `holdMs` old (ms, the host's clock); while one is not, play holds.
   */
  presence: { holdMs: 5000 },
} as const;

/** A view extrapolates a state at most this far ahead, ms: a delivery stall must not hide the ball on a Tile it crosses (a middle one in 0.2 to 0.45 s); a longer one is a visibly weak link. */
const MAX_AHEAD_MS = 1000;
const FG = '#f2f0ea';
/** A score is its Player's colour at this opacity: quieter than play, still 3:1 on the night table's ground (spec outside-view D11). */
const SCORE_ALPHA = 0.8;
/** How far back, ms, the ball's trail reaches. */
const TRAIL_MS = 100;
/** Behind a hold's message, over whatever it covers. */
const SHADE = 'rgba(0, 0, 0, 0.6)';

/**
 * A ball's trail through `points` (world mm, shared time `at`, oldest first), in the ball's ivory: as wide as a ball of
 * radius `r` and faintly lit at the newest point, narrowing and fading to nothing `TRAIL_MS` back.
 */
function drawTrail(g: CanvasRenderingContext2D, points: readonly { x: number; y: number; at: number }[], now: number, r: number): void {
  g.strokeStyle = FG;
  g.lineCap = 'round';
  for (let k = 1; k < points.length; k++) {
    const fresh = 1 - (now - points[k]!.at) / TRAIL_MS;
    g.globalAlpha = 0.4 * fresh;
    g.lineWidth = 2 * r * fresh;
    g.beginPath();
    g.moveTo(points[k - 1]!.x, points[k - 1]!.y);
    g.lineTo(points[k]!.x, points[k]!.y);
    g.stroke();
  }
  g.globalAlpha = 1;
}

type Ball = { x: number; y: number; vx: number; vy: number };

/** Side 0 is the west paddle, side 1 the east one; `seats` says whose. */
export type PongState = {
  ball: Ball;
  /** Paddle centre y per side. */
  pads: [number, number];
  /** Points per side. */
  score: [number, number];
  /** Seconds the ball still rests at the centre before it moves. */
  wait: number;
  /**
   * The human sides play waits for until they touch their Tile, west first:
   * while any is listed the ball stays where it is and its rest does not run.
   * Empty while play runs; a bot's side is never listed.
   */
  hold: (0 | 1)[];
  /** Whether play has run yet: until then, a hold is the first serve's "Touch here to start". */
  started: boolean;
};

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
 * Who plays each side: side 0 the Player seated at the first Tile, side 1 the
 * one seated at the last Tile (another one: with one Tile its human plays
 * west); the other Players, the bots, take the sides still open in order.
 * Never a Player's index in `match.players`.
 */
function seats(match: MatchInfo): [Player, Player] {
  const { players, tiles } = match;
  const west = players.find((p) => !p.bot && p.deviceId === tiles[0]!.deviceId);
  const east = players.find((p) => !p.bot && p !== west && p.deviceId === tiles[tiles.length - 1]!.deviceId);
  const rest = players.filter((p) => p !== west && p !== east);
  const sides = [west ?? rest.shift(), east ?? rest.shift()] as const;
  if (!sides[0] || !sides[1]) throw new Error('Pong needs a Player on each side');
  return [sides[0], sides[1]];
}

/**
 * The table: the Layout bounds across, and up and down only the band every
 * Tile covers, so the ball and the paddles stay on screen when one Tile is
 * taller than its neighbours (a row centres Tiles on the tallest). Paddles sit
 * inside the table's west and east edges, on the outer Tiles (both on a lone
 * Tile); `contact` is the x of the ball's centre when it touches a paddle's face.
 */
function table(m: { bounds: Rect; tiles: readonly Tile[] }) {
  const { ball: R, paddle: P } = PONG;
  const b = m.bounds;
  let y = Math.max(b.y, ...m.tiles.map((t) => t.y));
  let yEnd = Math.min(b.y + b.h, ...m.tiles.map((t) => t.y + t.h));
  // Tiles with no common band (a grid): the bounds, as the best there is.
  if (yEnd - y < P.h) [y, yEnd] = [b.y, b.y + b.h];
  return {
    /** The band's upper edge, where the scores hang. */
    y,
    top: y + R,
    bottom: yEnd - R,
    padX: [b.x + P.inset, b.x + b.w - P.inset - P.w] as const,
    contact: [b.x + P.inset + P.w + R, b.x + b.w - P.inset - P.w - R] as const,
    padLo: y + P.h / 2,
    padHi: yEnd - P.h / 2,
    mid: { x: b.x + b.w / 2, y: (y + yEnd) / 2 } satisfies Vec2,
  };
}

/** Whether a paddle centred at `pad` meets a ball at height `y`. */
const covers = (pad: number, y: number): boolean => Math.abs(y - pad) <= PONG.paddle.h / 2 + PONG.ball;

/**
 * Pong across the table. The Players seated at the outer Tiles move their
 * paddles with a finger, and the host moves a bot's; the ball bounces off the
 * table's top and bottom and off paddles; a miss scores for the other Player
 * and the ball is served from the centre toward the one who missed; the first
 * to seven wins. A human Player must keep touching: while one is not (they
 * have not touched yet, or their finger has been off their Tile for
 * `PONG.presence.holdMs`) play holds where it is, their own Tile asks them to
 * touch it and every other Tile says play waits for them. Each side is drawn
 * in its Player's colour (`playerColour`); the ball is ivory, with a trail.
 */
export default defineGame<PongState, never>({
  manifest: {
    id: 'mgc.pong',
    name: 'Pong',
    version: '1.0.0',
    tiles: { min: 1, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 2, max: 2 },
    templates: ['row'],
    bots: true,
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const T = table(match);
    const seated = seats(match);
    const players = [seated[0].playerId, seated[1].playerId] as const;
    /** The Device whose finger moves each side's paddle: its seated human's; none for a bot. */
    const fingers: readonly (DeviceId | undefined)[] = seated.map((p) => (p.bot ? undefined : p.deviceId));
    const bots = ([0, 1] as const).filter((s) => seated[s].bot);
    /** The sides a finger plays: each must keep touching its Tile (`PONG.presence`); a bot's side never holds play. */
    const humans = ([0, 1] as const).filter((s) => fingers[s] !== undefined);
    const rand = random(match.seed);
    // The bots' aim draws from its own stream: the serves are the same with or without bots.
    const aimRand = random(match.seed ^ 0x9e3779b9);

    const pads: [number, number] = [T.mid.y, T.mid.y];
    const score: [number, number] = [0, 0];
    let ball: Ball = { ...T.mid, vx: 0, vy: 0 };
    let wait = 0;
    /** How far off a bot aims at the shot in flight: none at a serve, anew at every return. */
    let aim = 0;
    /** Per side: the pointers down on its Device's screen, and when its last touch reached the host (ms, its clock). */
    const down = [new Set<number>(), new Set<number>()] as const;
    const touched: [number, number] = [-Infinity, -Infinity];
    /** The human sides play waits for, as of the last step; every one until it touches. */
    let hold: (0 | 1)[] = [...humans];
    /** Whether play has run yet: the first serve waits for every human side to touch. */
    let started = false;
    const serve = (toward: 0 | 1): void => {
      const angle = (rand() * 2 - 1) * PONG.maxServeAngle;
      const dir = toward === 0 ? -1 : 1;
      ball = { ...T.mid, vx: dir * PONG.speed * Math.cos(angle), vy: PONG.speed * Math.sin(angle) };
      wait = PONG.serveWait;
      aim = 0;
    };
    /** The ball met side `s`'s paddle: back out, steeper the further off-centre it hit, a little faster. */
    const ret = (s: 0 | 1): void => {
      const offset = clamp((ball.y - pads[s]) / (PONG.paddle.h / 2 + PONG.ball), -1, 1);
      const angle = offset * PONG.maxReturnAngle;
      const speed = Math.min(PONG.maxSpeed, Math.hypot(ball.vx, ball.vy) * PONG.speedUp);
      const dir = s === 0 ? 1 : -1;
      ball = { x: 2 * T.contact[s] - ball.x, y: ball.y, vx: dir * speed * Math.cos(angle), vy: speed * Math.sin(angle) };
      aim = (aimRand() * 2 - 1) * PONG.bot.aimError;
    };
    /** Where side `s`'s bot heads: where the ball will cross its face, off by `aim`; the centre while the ball rests or goes away. */
    const goal = (s: 0 | 1): number => {
      if (wait > 0 || (s === 0 ? ball.vx >= 0 : ball.vx <= 0)) return T.mid.y;
      const time = Math.max(0, (T.contact[s] - ball.x) / ball.vx);
      return clamp(fold(ball.y + ball.vy * time, T.top, T.bottom) + aim, T.padLo, T.padHi);
    };
    const snapshot = (): PongState => ({ ball: { ...ball }, pads: [pads[0], pads[1]], score: [score[0], score[1]], wait, hold: [...hold], started });

    serve(match.seed & 1 ? 1 : 0);
    return {
      onInput(i) {
        const s = fingers.indexOf(i.deviceId);
        if (s !== 0 && s !== 1) return;
        // Every sample is a touch, the pointer on the screen until it ends; a pointer is down from its `down` to its `up` or `cancel`.
        touched[s] = ctx.now();
        if (i.phase === 'down') down[s].add(i.pointerId);
        else if (i.phase === 'up' || i.phase === 'cancel') down[s].delete(i.pointerId);
        if (i.phase !== 'cancel') pads[s] = clamp(i.world.y, T.padLo, T.padHi);
      },
      // Nothing moved while paused; the views get the ball where it stopped, stamped now.
      onResume() {
        ctx.publish(snapshot());
      },
      tick(dt, now) {
        // A bot's paddle first: at most its speed, toward where it means to meet the ball.
        const reach = PONG.bot.speed * dt;
        for (const s of bots) pads[s] += clamp(goal(s) - pads[s], -reach, reach);
        // A human side with no finger down and no touch in `holdMs` holds play: the ball stays where it is and
        // its rest does not run, so nothing scores; the paddles still move. Its next touch lets play on, here.
        hold = humans.filter((s) => down[s].size === 0 && now - touched[s] >= PONG.presence.holdMs);
        if (hold.length > 0) {
          ctx.publish(snapshot());
          return;
        }
        started = true;
        if (wait > 0) {
          wait = Math.max(0, wait - dt);
          ctx.publish(snapshot());
          return;
        }
        const was = ball.x;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.y < T.top) {
          ball.y = 2 * T.top - ball.y;
          ball.vy = Math.abs(ball.vy);
        } else if (ball.y > T.bottom) {
          ball.y = 2 * T.bottom - ball.y;
          ball.vy = -Math.abs(ball.vy);
        }
        // A paddle returns the ball when its face is crossed this step where the paddle is.
        if (ball.vx < 0 && was >= T.contact[0] && ball.x < T.contact[0] && covers(pads[0], ball.y)) ret(0);
        else if (ball.vx > 0 && was <= T.contact[1] && ball.x > T.contact[1] && covers(pads[1], ball.y)) ret(1);
        // Wholly off the table: a point for the other side, served toward the side that missed.
        const { x: left, w } = match.bounds;
        const missed = ball.x + PONG.ball < left ? 0 : ball.x - PONG.ball > left + w ? 1 : undefined;
        if (missed !== undefined) {
          const scorer = missed === 0 ? 1 : 0;
          score[scorer]++;
          if (score[scorer] >= PONG.win) {
            ball = { ...T.mid, vx: 0, vy: 0 };
            ctx.publish(snapshot());
            const result: MatchResult = { scores: { [players[0]]: score[0], [players[1]]: score[1] }, ranking: [players[scorer], players[missed]] };
            ctx.end(result);
            return;
          }
          serve(missed);
        }
        ctx.publish(snapshot());
      },
    };
  },
  view(ctx) {
    const { tiles } = ctx.match;
    const T = table(ctx.match);
    /** Each side's score sits near the top, mid-width on its own outer Tile, or of its own half of a lone Tile. */
    const scoreX = [tiles[0]!, tiles[tiles.length - 1]!].map((tile, s) => tile.x + (tiles.length > 1 ? tile.w / 2 : (tile.w * (1 + 2 * s)) / 4));
    const sides = seats(ctx.match);
    /** Each side's colour: its Player's, by their place in the Match's Player list, as on every phone and in the platform's screens. */
    const colour = sides.map((p) => playerColour(ctx.match.players.indexOf(p)));
    /** The sides a bot plays: labelled under their scores. */
    const bots = sides.flatMap((p, s) => (p.bot ? [s] : []));
    /** Shared time of the last resume: a state from before it shows the ball where the pause stopped it. */
    let resumedAt = -Infinity;
    /** Where this view drew the moving ball over the last `TRAIL_MS` (world mm, at shared time `at`), oldest first. */
    const trail: { x: number; y: number; at: number }[] = [];
    return {
      onResume(now) {
        resumedAt = now;
      },
      draw({ ctx: g, state: s, now, t }) {
        if (!s) return;
        // Extrapolate on the shared clock; a held ball stays where it is. The paddle it heads for returns it if it covers it at its `face` (`hit` s on), but no further back than the other face.
        const moving = s.hold.length > 0 ? 0 : Math.max(0, Math.min(Math.max(now - Math.max(t, resumedAt), 0), MAX_AHEAD_MS) / 1000 - s.wait);
        const y = fold(s.ball.y + s.ball.vy * moving, T.top, T.bottom);
        const [face, pad] = s.ball.vx < 0 ? [T.contact[0], s.pads[0]] : [T.contact[1], s.pads[1]];
        const hit = (face - s.ball.x) / s.ball.vx;
        const x = hit >= 0 && hit < moving && covers(pad, fold(s.ball.y + s.ball.vy * hit, T.top, T.bottom)) ? clamp(2 * face - s.ball.x - s.ball.vx * moving, T.contact[0], T.contact[1]) : s.ball.x + s.ball.vx * moving;

        g.font = '600 14px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.globalAlpha = SCORE_ALPHA;
        for (const side of [0, 1] as const) {
          g.fillStyle = colour[side]!;
          g.fillText(String(s.score[side]), scoreX[side]!, T.y + 8);
        }
        g.globalAlpha = 1;
        g.font = '600 4.5px system-ui, sans-serif';
        for (const side of bots) {
          g.fillStyle = colour[side]!;
          g.fillText('BOT', scoreX[side]!, T.y + 24);
        }

        for (const side of [0, 1] as const) {
          g.fillStyle = colour[side]!;
          g.fillRect(T.padX[side], s.pads[side] - PONG.paddle.h / 2, PONG.paddle.w, PONG.paddle.h);
        }
        // Behind a moving ball, where every view drew it lately: in world mm, so it runs on across the gap between Tiles.
        if (s.wait > 0 || s.hold.length > 0) trail.length = 0;
        else {
          trail.push({ x, y, at: now });
          while (now - trail[0]!.at > TRAIL_MS) trail.shift();
          drawTrail(g, trail, now, PONG.ball);
        }
        // Resting before a serve: a ring, so nobody mistakes it for play.
        g.fillStyle = FG;
        g.beginPath();
        g.arc(x, y, PONG.ball, 0, Math.PI * 2);
        if (s.wait > 0) {
          g.strokeStyle = FG;
          g.lineWidth = 1;
          g.stroke();
        } else g.fill();

        // A hold, on a shaded band above the ball's rest: this Tile asks a waited-for Player seated at it to touch it;
        // any other names each Player play waits for.
        const { tile } = ctx;
        if (s.hold.length > 0 && tile) {
          const here = s.hold.filter((side) => sides[side].deviceId === ctx.deviceId);
          const ask = s.started ? 'Touch here to play on' : 'Touch here to start';
          const lines = here.length > 0 ? here.map((side) => [ask, side] as const) : s.hold.map((side) => [`Waiting for ${sides[side].name}`, side] as const);
          const top = T.mid.y - 30;
          g.font = '600 5px system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = SHADE;
          g.fillRect(tile.x, top - 5, tile.w, 7 * lines.length + 3);
          lines.forEach(([text, side], k) => {
            g.fillStyle = colour[side]!;
            g.fillText(text, tile.x + tile.w / 2, top + 7 * k, tile.w - 6);
          });
        }
      },
    };
  },
});
