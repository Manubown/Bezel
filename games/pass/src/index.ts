import { defineGame, type MatchInfo, type MatchResult, type PlayerId } from '@mgc/sdk';

export const PASS = {
  /** How long each Player holds the Controller, ms. */
  turnMs: 5000,
  /** Every Player gets this many turns. */
  rounds: 3,
} as const;

/** Who holds the Controller, until when (shared time, ms), every Player's taps, and how many turns have passed. */
export type PassState = { holder: PlayerId | null; turnEndsAt: number; taps: Record<PlayerId, number>; turn: number };

/** What the Controller sends: one tap. */
export type PassMessage = 'tap';

const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.55)';
const BG = '#121212';

const nameOf = (match: MatchInfo, playerId: PlayerId): string => match.players.find((p) => p.playerId === playerId)?.name ?? playerId;

/**
 * Pass the phone: the reference Game for a Controller and its Holders. One
 * Device is a Controller, a big DOM button; the host game hands it to each
 * Player in turn for `PASS.turnMs` on a pause-aware timer, and every tap
 * counts for whoever held it when the tap reached the Host. The Tiles draw
 * whose turn it is and the taps. The host has no `tick`: it runs on its
 * timer and the Controller's messages alone. Most taps after `PASS.rounds`
 * rounds wins.
 */
export default defineGame<PassState, PassMessage>({
  manifest: {
    id: 'mgc.pass',
    name: 'Pass',
    version: '1.0.0',
    tiles: { min: 1, max: 4 },
    controllers: { min: 1, max: 1 },
    players: { min: 1, max: 4 },
    tickHz: 0,
    host: './index.js',
    view: './index.js',
  },
  host(ctx) {
    const { match } = ctx;
    const controller = match.devices.find((d) => d.role === 'controller')!.deviceId;
    const players = match.players.map((p) => p.playerId);
    const taps: Record<PlayerId, number> = Object.fromEntries(players.map((p) => [p, 0]));
    let turn = 0;
    let turnEndsAt = 0;
    let pausedAt = 0;
    const snapshot = (): PassState => ({ holder: ctx.holderOf(controller), turnEndsAt, taps: { ...taps }, turn });
    /** The next turn: the Controller to the next Player, or the end once every Player had every round. */
    const pass = (): void => {
      if (turn >= players.length * PASS.rounds) {
        ctx.setHolder(controller, null);
        const result: MatchResult = { scores: { ...taps }, ranking: [...players].sort((a, b) => taps[b]! - taps[a]!) };
        ctx.publish(snapshot());
        ctx.end(result);
        return;
      }
      ctx.setHolder(controller, players[turn % players.length]!);
      turnEndsAt = ctx.now() + PASS.turnMs;
      ctx.timer('turn', PASS.turnMs);
      ctx.publish(snapshot());
    };

    pass();
    return {
      onTimer(tag) {
        if (tag !== 'turn') return;
        turn++;
        pass();
      },
      // The platform stamped who held the Controller when this tap reached the Host.
      onMessage(msg, from) {
        if (msg !== 'tap' || from.playerId === undefined || !(from.playerId in taps)) return;
        taps[from.playerId]!++;
        ctx.log(`${nameOf(match, from.playerId)} tapped (${taps[from.playerId]})`);
        ctx.publish(snapshot());
      },
      onHolder(_controller, playerId) {
        ctx.log(playerId === null ? 'nobody holds the Controller' : `${nameOf(match, playerId)} holds the Controller`);
      },
      // The turn's timer froze with the pause; its end moves on by the paused time.
      onPause() {
        pausedAt = ctx.now();
      },
      onResume(now) {
        turnEndsAt += now - pausedAt;
        ctx.publish(snapshot());
      },
    };
  },
  view(ctx) {
    const { match } = ctx;
    if (ctx.role === 'controller') {
      let button: HTMLButtonElement | undefined;
      const label = (): void => {
        if (!button) return;
        const holder = ctx.holder();
        button.textContent = holder === null ? 'Wait for your turn' : `${nameOf(match, holder)}: tap! (${ctx.latest()?.state.taps[holder] ?? 0})`;
      };
      return {
        // The button handles its own events.
        input: 'off',
        mount(root) {
          button = root.ownerDocument.createElement('button');
          button.type = 'button';
          button.style.cssText = `position:absolute;inset:0;width:100%;height:100%;margin:0;border:0;background:${FG};color:${BG};font:600 28px system-ui,sans-serif;touch-action:manipulation`;
          button.addEventListener('pointerdown', () => ctx.send('tap'));
          root.append(button);
          label();
        },
        onHolder: label,
        onState: label,
      };
    }
    return {
      // Each Tile shows the turn on its own screen, in world mm.
      draw({ ctx: g, state: s, now, tile }) {
        if (!s || !tile) return;
        const x = tile.x + tile.w / 2;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = FG;
        g.font = '600 9px system-ui, sans-serif';
        g.fillText(s.holder === null ? 'Game over' : `${nameOf(match, s.holder)}’s turn`, x, tile.y + tile.h * 0.3);
        if (s.holder !== null) {
          g.font = '600 24px system-ui, sans-serif';
          g.fillText(String(Math.max(0, Math.ceil((s.turnEndsAt - now) / 1000))), x, tile.y + tile.h * 0.48);
        }
        g.fillStyle = DIM;
        g.font = '500 6px system-ui, sans-serif';
        match.players.forEach((p, i) => g.fillText(`${p.name} ${s.taps[p.playerId] ?? 0}`, x, tile.y + tile.h * 0.66 + i * 9));
      },
    };
  },
});
