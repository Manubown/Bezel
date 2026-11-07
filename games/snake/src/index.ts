import { defineGame, type DeviceId, type PlayerId } from '@mgc/sdk';

/**
 * Tunables. Keep them in one exported object: tests import it, and a reader
 * sees every number the game depends on in one place.
 * Lengths are world millimetres, times are shared-clock milliseconds.
 */
export const SNAKE = {
  /** Taps that end the Match. */
  tapsToWin: 10,
  /** Radius of the ring drawn where a finger came down. */
  ring: 6,
} as const;

/** The state the host publishes. Plain JSON only: it crosses the wire to every Device. */
export type SnakeState = {
  /** Taps per Player id. */
  taps: Record<PlayerId, number>;
  /** Where the last tap landed, in world mm, and by whom. */
  last?: { x: number; y: number; playerId: PlayerId };
};

/** What a view may `send` to the host. This game sends nothing: `never`. */
export type SnakeMessage = never;

/**
 * Tap: the smallest complete Game. Every Player taps their own Tile; the host
 * counts, every Tile shows the counts and a ring where the last finger came
 * down; the first to `SNAKE.tapsToWin` wins.
 *
 * The host is event-driven (`tickHz: 0`): it only reacts to `onInput`. A game
 * that moves things on its own adds `tick(dt, now)` and drops `tickHz: 0`.
 */
export default defineGame<SnakeState, SnakeMessage>({
  manifest: {
    id: 'mgc.snake',
    name: 'Snake',
    version: '1.0.0',
    // How many phones lie on the table (Tiles), how many are held (Controllers), how many Players.
    // The lobby refuses to start outside these ranges.
    tiles: { min: 1, max: 4 },
    controllers: { min: 0, max: 0 },
    players: { min: 1, max: 2 },
    tickHz: 0,
    host: './index.js',
    view: './index.js',
  },

  // Runs once, on the Host Device. `ctx.match` is frozen: who plays, which Device is where.
  host(ctx) {
    /** The Player seated at each Tile Device: `Player.deviceId` says who sits where, never a Player's index. */
    const seatOf: Record<DeviceId, PlayerId> = Object.fromEntries(ctx.match.players.flatMap((p) => (p.deviceId ? [[p.deviceId, p.playerId]] : [])));
    const taps: Record<PlayerId, number> = Object.fromEntries(ctx.match.players.map((p) => [p.playerId, 0]));
    let last: SnakeState['last'];

    // Publish the first state at once: a view draws nothing until it has one.
    ctx.publish({ taps });

    return {
      // Every pointer sample from every Device, stamped with who sent it. Coordinates are world mm.
      onInput(i) {
        if (i.phase !== 'down') return;
        const playerId = seatOf[i.deviceId];
        if (playerId === undefined) return; // A Tile that seats nobody (a middle phone) taps for nobody.
        taps[playerId] = (taps[playerId] ?? 0) + 1;
        last = { x: i.world.x, y: i.world.y, playerId };
        ctx.publish({ taps, last }); // One call = one frame on the wire. Publish when something changed.
        if (taps[playerId]! >= SNAKE.tapsToWin) {
          const ranking = Object.keys(taps).sort((a, b) => taps[b]! - taps[a]!);
          ctx.end({ scores: taps, ranking }); // Closes the Match on every Device; the platform shows the result.
        }
      },
    };
  },

  // Runs once per Device, the Host included. `ctx.tile` is this Device's rectangle in world mm.
  view(ctx) {
    return {
      // Called every animation frame with the latest state. `g` is already in world mm:
      // draw at world coordinates and this Tile shows its own part of the surface.
      draw({ ctx: g, state, tile }) {
        if (!state || !tile) return;
        g.fillStyle = '#f2f0ea';
        g.font = '600 6px system-ui, sans-serif';
        g.textBaseline = 'top';
        ctx.match.players.forEach((p, k) => g.fillText(`${p.name} ${state.taps[p.playerId] ?? 0}`, tile.x + 4, tile.y + 4 + k * 8));
        if (state.last) {
          g.strokeStyle = '#f2f0ea';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(state.last.x, state.last.y, SNAKE.ring, 0, Math.PI * 2);
          g.stroke();
        }
      },
    };
  },
});
