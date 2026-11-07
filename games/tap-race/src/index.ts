import { defineGame, type DeviceId, type MatchResult, type Player, type PlayerId } from '@mgc/sdk';

/** Every number the Game depends on, in one object the test imports. World mm, shared-clock ms. */
export const TAP_RACE = {
  target: 9, // a target's radius: a tap within it scores
  rounds: 7, // targets per Match
  count: 3, // countdown digits before the first target, `countMs` apart
  countMs: 1000,
  spawnMs: { min: 600, max: 2000 }, // a target appears this long after the last one went
  lifeMs: 2500, // and fades unscored after this
  bot: { reactMs: { min: 400, max: 1200 }, miss: 0.3 }, // a bot taps after `reactMs`, or (chance `miss`) not at all
  resultMs: 3000, // every Tile shows the winner this long before the Match ends
  edge: 12, // a target's centre keeps this far from its Tile's sides
  band: 15, // and this much further from its top (the scores) and its bottom (the Host's HUD bar covers ~56 px there)
} as const;

/** What the host publishes, on every change. Plain JSON: it crosses the wire to every Device. */
export type TapRaceState = {
  phase: 'countdown' | 'play' | 'done';
  count?: number; // the countdown's digit
  target?: { x: number; y: number; deviceId: DeviceId; since: number }; // centre in world mm, its Tile, when it appeared
  scores: Record<PlayerId, number>;
  round: number; // targets shown so far
  lastHit?: { playerId: PlayerId; x: number; y: number };
};
export type TapRaceMessage = never; // what a view may `send` the host: nothing, a tap reaches it as an Input

/** Every score, and the ranking by score unless the best is shared: the platform's result card then reads "Draw". */
function result(players: readonly Player[], scores: Record<PlayerId, number>): MatchResult {
  const ranking = players.map((p) => p.playerId).sort((a, b) => scores[b]! - scores[a]!);
  return ranking.length > 1 && scores[ranking[0]!] === scores[ranking[1]!] ? { scores } : { scores, ranking };
}

/** Tap Race, the tutorial Game: tap each target on your Tile before it fades, and before the bots do; after `rounds` targets the most wins. */
export default defineGame<TapRaceState, TapRaceMessage>({
  // `defineGame` takes the manifest, host and view; the default export is the Game. The lobby refuses Start outside these ranges.
  manifest: {
    id: 'mgc.tap-race',
    name: 'Tap Race',
    version: '1.0.0',
    tiles: { min: 1, max: 4 }, // phones lying on the table
    controllers: { min: 0, max: 0 }, // phones held in hand
    players: { min: 1, max: 4 },
    bots: true, // the Host may make a Player slot a bot; this host game plays it
    tickHz: 0, // event-driven: no `tick`, only inputs and timers wake the host
    host: './index.js',
    view: './index.js',
  },

  // Runs once, on the Host Device, and returns the handlers. `ctx.match` is frozen: who plays, which Device is where.
  host(ctx) {
    const { match } = ctx;
    // Deterministic randoms in [0, 1) from the Match seed (mulberry32, as Pong), so a test can pin a Match.
    let seed = match.seed >>> 0;
    const rand = (): number => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const between = (r: { min: number; max: number }): number => r.min + rand() * (r.max - r.min);
    // `Player.deviceId` says who sits at which Tile (a bot sits nowhere); never go by a Player's index.
    const seated = new Map(match.players.flatMap((p) => (p.deviceId === undefined ? [] : [[p.deviceId, p.playerId] as const])));
    const bots = match.players.filter((p) => p.bot).map((p) => p.playerId);
    // Targets appear where a human can tap them; with bots alone, on any Tile.
    const spots = seated.size > 0 ? match.tiles.filter((t) => seated.has(t.deviceId)) : match.tiles;
    const s: TapRaceState = { phase: 'countdown', count: TAP_RACE.count, scores: Object.fromEntries(match.players.map((p) => [p.playerId, 0])), round: 0 };
    // `publish` sends the state to every view, as it is when the handler returns: so send a copy.
    const publish = (): void => ctx.publish({ ...s, scores: { ...s.scores } });
    /** No target (it was `hit`, it faded, or the countdown ended): the next one after a random wait, or the winner. */
    const next = (hit?: TapRaceState['lastHit']): void => {
      if (hit) {
        s.lastHit = hit;
        s.scores[hit.playerId]!++;
        ctx.log(`${match.players.find((p) => p.playerId === hit.playerId)?.name} scored (${s.scores[hit.playerId]})`); // to the HUD's game log
      }
      delete s.target;
      ctx.timer('expire', null); // `null` cancels a timer: this target's fading, and the bots' taps at it
      for (const id of bots) ctx.timer(`bot:${id}`, null);
      s.phase = s.round < TAP_RACE.rounds ? 'play' : 'done';
      if (s.phase === 'play') ctx.timer('spawn', between(TAP_RACE.spawnMs));
      else ctx.timer('end', TAP_RACE.resultMs);
      publish();
    };
    // `timer(tag, ms)` calls `onTimer(tag)` once, `ms` from now; the same tag again replaces it. A pause freezes it.
    ctx.timer('count', TAP_RACE.countMs);
    publish(); // a view draws nothing until its first state
    return {
      onTimer(tag, now) {
        // `now` is the shared time the timer was due.
        if (tag === 'count' && s.count! > 1) {
          s.count!--;
          ctx.timer('count', TAP_RACE.countMs);
        } else if (tag === 'count') {
          delete s.count;
          return next();
        } else if (tag === 'spawn') {
          // A random spot on a Tile, clear of its sides and of the bands along its top and bottom (lobby Tiles are never rotated).
          const tile = spots[Math.floor(rand() * spots.length)]!;
          const x = tile.x + TAP_RACE.edge + rand() * (tile.w - 2 * TAP_RACE.edge);
          const y = tile.y + TAP_RACE.edge + TAP_RACE.band + rand() * (tile.h - 2 * (TAP_RACE.edge + TAP_RACE.band));
          s.target = { x, y, deviceId: tile.deviceId, since: now };
          s.round++;
          ctx.timer('expire', TAP_RACE.lifeMs);
          for (const id of bots) if (rand() >= TAP_RACE.bot.miss) ctx.timer(`bot:${id}`, between(TAP_RACE.bot.reactMs));
        } else if (tag === 'expire') return next();
        else if (tag.startsWith('bot:') && s.target) return next({ playerId: tag.slice('bot:'.length), x: s.target.x, y: s.target.y });
        else if (tag === 'end') return ctx.end(result(match.players, s.scores)); // closes the Match on every Device
        publish();
      },
      // Every pointer sample from every Device, in world mm, stamped by the platform with the Device it came from.
      onInput(i) {
        const t = s.target;
        const playerId = seated.get(i.deviceId);
        // A finger coming down in the ring, on the target's own Tile, scores for whoever sits at that Tile.
        if (i.phase !== 'down' || !t || i.deviceId !== t.deviceId || playerId === undefined) return;
        if (Math.hypot(i.world.x - t.x, i.world.y - t.y) <= TAP_RACE.target) next({ playerId, x: i.world.x, y: i.world.y });
      },
    };
  },

  // Runs once per Device, the Host included, and returns its handlers: it draws what the host published.
  view: ({ match: { players } }) => ({
    // Every animation frame. `g` is cleared and scaled to world mm: draw anywhere and this Tile shows its own part.
    draw({ ctx: g, state: s, now, tile }) {
      if (!s || !tile) return;
      Object.assign(g, { strokeStyle: '#f2f0ea', fillStyle: '#f2f0ea', textAlign: 'center', textBaseline: 'middle' });
      if (s.target) {
        const { x, y, since } = s.target;
        const inner = TAP_RACE.target * Math.min(1, Math.max(0, 1 - (now - since) / TAP_RACE.lifeMs)); // shrinks as it fades
        g.beginPath();
        g.arc(x, y, TAP_RACE.target, 0, Math.PI * 2);
        g.moveTo(x + inner, y);
        g.arc(x, y, inner, 0, Math.PI * 2);
        g.stroke();
      } else if (s.lastHit) g.fillRect(s.lastHit.x - 1.5, s.lastHit.y - 1.5, 3, 3);
      // Text from the Tile's top-left corner: the scores along its top, the countdown or the winner in its middle.
      g.translate(tile.x, tile.y);
      g.font = '600 5px system-ui, sans-serif';
      const slot = tile.w / players.length;
      players.forEach((p, k) => g.fillText(`${p.name} ${s.scores[p.playerId]}`, slot * (k + 0.5), TAP_RACE.band / 2, slot - 2));
      const { ranking } = result(players, s.scores);
      g.font = `700 ${s.phase === 'countdown' ? 40 : 10}px system-ui, sans-serif`;
      const big = s.phase === 'countdown' ? String(s.count) : ranking ? `${players.find((p) => p.playerId === ranking[0])?.name} wins` : 'Draw';
      if (s.phase !== 'play') g.fillText(big, tile.w / 2, tile.h / 2, tile.w - 6);
    },
  }),
});
