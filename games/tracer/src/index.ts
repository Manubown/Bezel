import { defineGame, type Rect, type Vec2 } from '@mgc/sdk';

/** Ball radius, mm. */
const R = 6;
/** mm/s along x; y runs at 0.618 of it so the path does not visibly repeat. */
const SPEED = 120;
/** A view extrapolates a state at most this far ahead, ms. */
const MAX_AHEAD_MS = 100;
const TRAIL = 8;
const TRAIL_STEP_S = 0.028;

/** World mm and mm/s. */
type Ball = { x: number; y: number; vx: number; vy: number };

/**
 * Position and velocity along one axis `dt` seconds later (earlier when
 * negative), reflecting off `lo` and `hi`: the bounces unfold into a straight
 * line of period `2 · (hi − lo)`.
 */
function axis(p: number, v: number, dt: number, lo: number, hi: number): [number, number] {
  const span = hi - lo;
  if (span <= 0) return [(lo + hi) / 2, v];
  const period = 2 * span;
  const u = (((p - lo + v * dt) % period) + period) % period;
  return u <= span ? [lo + u, v] : [hi - (u - span), -v];
}

/** The ball `dt` seconds on, bouncing inside `bounds`. */
function move(b: Ball, bounds: Rect, dt: number): Ball {
  const [x, vx] = axis(b.x, b.vx, dt, bounds.x + R, bounds.x + bounds.w - R);
  const [y, vy] = axis(b.y, b.vy, dt, bounds.y + R, bounds.y + bounds.h - R);
  return { x, y, vx, vy };
}

function disc(g: CanvasRenderingContext2D, p: Vec2, r: number): void {
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.fill();
}

/**
 * The M1 ball as a Game: the host moves it in world millimetres on every
 * fixed step and publishes it; every view, the Host's own included, draws it
 * from the latest state, extrapolated on the shared clock. The Layout bounds
 * are the walls, so it crosses every bezel.
 */
export default defineGame<Ball, never>({
  manifest: {
    id: 'mgc.tracer',
    name: 'Tracer',
    version: '1.0.0',
    tiles: { min: 2, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 2, max: 2 },
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const b = ctx.match.bounds;
    const { seed } = ctx.match;
    let ball: Ball = {
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
      vx: seed & 1 ? SPEED : -SPEED,
      vy: (seed & 2 ? SPEED : -SPEED) * 0.618,
    };
    return {
      tick(dt) {
        ball = move(ball, b, dt);
        ctx.publish(ball);
      },
    };
  },
  view() {
    return {
      draw({ ctx: g, state, now, t, bounds }) {
        if (!state) return;
        const ball = move(state, bounds, Math.min(Math.max(now - t, 0), MAX_AHEAD_MS) / 1000);
        for (let k = TRAIL; k >= 1; k--) {
          g.fillStyle = `rgba(242, 240, 234, ${0.35 * (1 - k / (TRAIL + 1))})`;
          disc(g, move(ball, bounds, -k * TRAIL_STEP_S), R * (1 - k / (TRAIL + 2)));
        }
        g.fillStyle = '#f2f0ea';
        disc(g, ball, R);
      },
    };
  },
});
