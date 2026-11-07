import { defineGame, type DeviceId, type MatchResult, type Vec2 } from '@mgc/sdk';

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
} as const;

/** A view extrapolates a state at most this far ahead, ms. */
const MAX_AHEAD_MS = 100;
const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.35)';

type Ball = { x: number; y: number; vx: number; vy: number };

/** Side 0 is the west paddle (first Tile, first Player), side 1 the east one (last Tile, second Player). */
export type PongState = {
  ball: Ball;
  /** Paddle centre y per side. */
  pads: [number, number];
  /** Points per side. */
  score: [number, number];
  /** Seconds the ball still rests at the centre before it moves. */
  wait: number;
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
 * The table: the Layout bounds. Paddles sit on the two outer Tiles, inside the
 * table's west and east edges; `contact` is the x of the ball's centre when it
 * touches a paddle's face.
 */
function table(b: { x: number; y: number; w: number; h: number }) {
  const { ball: R, paddle: P } = PONG;
  return {
    top: b.y + R,
    bottom: b.y + b.h - R,
    padX: [b.x + P.inset, b.x + b.w - P.inset - P.w] as const,
    contact: [b.x + P.inset + P.w + R, b.x + b.w - P.inset - P.w - R] as const,
    padLo: b.y + P.h / 2,
    padHi: b.y + b.h - P.h / 2,
    mid: { x: b.x + b.w / 2, y: b.y + b.h / 2 } satisfies Vec2,
  };
}

/** Whether a paddle centred at `pad` meets a ball at height `y`. */
const covers = (pad: number, y: number): boolean => Math.abs(y - pad) <= PONG.paddle.h / 2 + PONG.ball;

/**
 * Pong across the table. The outer Tiles' Players move their paddles with a
 * finger; the ball bounces off the table's top and bottom and off paddles; a
 * miss scores for the other Player and the ball is served from the centre
 * toward the one who missed; the first to seven wins.
 */
export default defineGame<PongState, never>({
  manifest: {
    id: 'mgc.pong',
    name: 'Pong',
    version: '1.0.0',
    tiles: { min: 2, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 2, max: 2 },
    templates: ['row'],
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const T = table(match.bounds);
    // Layout order runs west to east in a row; the lobby seats Player 1 west, Player 2 east.
    const sides: readonly DeviceId[] = [match.tiles[0]!.deviceId, match.tiles[match.tiles.length - 1]!.deviceId];
    const players = [match.players[0]!.playerId, match.players[1]!.playerId] as const;
    const rand = random(match.seed);

    const pads: [number, number] = [T.mid.y, T.mid.y];
    const score: [number, number] = [0, 0];
    let ball: Ball = { ...T.mid, vx: 0, vy: 0 };
    let wait = 0;
    const serve = (toward: 0 | 1): void => {
      const angle = (rand() * 2 - 1) * PONG.maxServeAngle;
      const dir = toward === 0 ? -1 : 1;
      ball = { ...T.mid, vx: dir * PONG.speed * Math.cos(angle), vy: PONG.speed * Math.sin(angle) };
      wait = PONG.serveWait;
    };
    /** The ball met side `s`'s paddle: back out, steeper the further off-centre it hit, a little faster. */
    const ret = (s: 0 | 1): void => {
      const offset = clamp((ball.y - pads[s]) / (PONG.paddle.h / 2 + PONG.ball), -1, 1);
      const angle = offset * PONG.maxReturnAngle;
      const speed = Math.min(PONG.maxSpeed, Math.hypot(ball.vx, ball.vy) * PONG.speedUp);
      const dir = s === 0 ? 1 : -1;
      ball = { x: 2 * T.contact[s] - ball.x, y: ball.y, vx: dir * speed * Math.cos(angle), vy: speed * Math.sin(angle) };
    };
    const snapshot = (): PongState => ({ ball: { ...ball }, pads: [pads[0], pads[1]], score: [score[0], score[1]], wait });

    serve(match.seed & 1 ? 1 : 0);
    return {
      onInput(i) {
        const s = sides.indexOf(i.deviceId);
        if (s < 0 || i.phase === 'cancel') return;
        pads[s] = clamp(i.world.y, T.padLo, T.padHi);
      },
      // Nothing moved while paused; the views get the ball where it stopped, stamped now.
      onResume() {
        ctx.publish(snapshot());
      },
      tick(dt) {
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
    const { tiles, bounds } = ctx.match;
    const T = table(bounds);
    /** Each side's score sits mid-width on its own outer Tile, near the top. */
    const scoreX = [tiles[0]!, tiles[tiles.length - 1]!].map((tile) => tile.x + tile.w / 2);
    /** Shared time of the last resume: a state from before it shows the ball where the pause stopped it. */
    let resumedAt = -Infinity;
    return {
      onResume(now) {
        resumedAt = now;
      },
      draw({ ctx: g, state: s, now, t }) {
        if (!s) return;
        // Extrapolate on the shared clock, never past a paddle that will return it.
        const moving = Math.max(0, Math.min(Math.max(now - Math.max(t, resumedAt), 0), MAX_AHEAD_MS) / 1000 - s.wait);
        const y = fold(s.ball.y + s.ball.vy * moving, T.top, T.bottom);
        let x = s.ball.x + s.ball.vx * moving;
        if (s.ball.vx < 0 && s.ball.x >= T.contact[0] && x < T.contact[0] && covers(s.pads[0], y)) x = 2 * T.contact[0] - x;
        if (s.ball.vx > 0 && s.ball.x <= T.contact[1] && x > T.contact[1] && covers(s.pads[1], y)) x = 2 * T.contact[1] - x;

        g.fillStyle = DIM;
        g.font = '600 14px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText(String(s.score[0]), scoreX[0]!, bounds.y + 8);
        g.fillText(String(s.score[1]), scoreX[1]!, bounds.y + 8);

        g.fillStyle = FG;
        for (const side of [0, 1] as const) g.fillRect(T.padX[side], s.pads[side] - PONG.paddle.h / 2, PONG.paddle.w, PONG.paddle.h);
        // Resting before a serve: a ring, so nobody mistakes it for play.
        g.beginPath();
        g.arc(x, y, PONG.ball, 0, Math.PI * 2);
        if (s.wait > 0) {
          g.strokeStyle = FG;
          g.lineWidth = 1;
          g.stroke();
        } else g.fill();
      },
    };
  },
});
