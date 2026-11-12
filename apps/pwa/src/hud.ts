import type { Session } from '@mgc/core';
import type { CloseReason, Manifest, MatchResult, Player } from '@mgc/sdk';
import type { LogLine } from './gamelog';
import { dropoutAdvice } from './hud/advice';
import { lastCard, pauseCard } from './hud/cards';
import { hostSheet } from './hud/sheet';
import { peerStrip } from './hud/strip';
import type { Lobby } from './lobby';
import type { PauseNotice } from './pause';
import type { Recorder } from './recorder';

/** This Device's part in Matches; `main` keeps it current and calls `render`. */
export interface Play {
  /** A Match runs on this Device now: the screen is the Game's. */
  running: boolean;
  /** Set while the running Match is paused: who it waits for. */
  paused: PauseNotice | undefined;
  /** Host: set once its own view of the running Match closed while the Match goes on. */
  stopped: PauseNotice | undefined;
  /** The last Match that ran on this Device. */
  last: LastMatch | undefined;
  /** The running (else the last) Match's faults, logs and close, oldest first. */
  log: readonly LogLine[];
}

export interface LastMatch {
  /** Why it closed, and the runtime's words for it. */
  reason: CloseReason;
  detail: string;
  players: readonly Player[];
  /** Set when the Game ended it. */
  result?: MatchResult;
}

export interface HudOptions {
  session: Session;
  lobby: Lobby;
  /** The room code Peers join with. */
  code: string;
  /** Every discovered Game. The Host's sheet offers players the featured ones and a maker all of them (`gamelist.ts`). */
  games: readonly Manifest[];
  play: Readonly<Play>;
  /** Host: ends the running Match. */
  abort(): void;
  /** The session log this page keeps; the HUD offers its export in Maker mode. */
  log: Pick<Recorder, 'export' | 'clear' | 'count'>;
  /**
   * Maker mode (`maker.ts`): what players never see is shown (every Game, the clock figures and words, the game log,
   * the session log's export and clear), and the Host's join address carries the flag. Off, the HUD speaks to players.
   */
  maker: boolean;
}

export interface Hud {
  render(): void;
}

/**
 * The platform overlay, rendered from the lobby, the Session, and `play`: the
 * Host's bottom sheet (join code, Game, arrangement, Controllers, Player slots
 * with names and bots, Start, game log, and the roster in Tile order with its
 * move buttons) or a Peer's top strip with its help card, plus the last Match's close (its result,
 * or why it stopped) and a paused Match's notice on every Device, and on the Host the advice line
 * when one phone keeps dropping. They step aside while this Device runs a Match. One module per
 * surface: `hud/sheet.ts`, `hud/strip.ts`, `hud/cards.ts`, `hud/advice.ts`; what they share is `hud/shared.ts`.
 */
export async function openHud(root: HTMLElement, o: HudOptions): Promise<Hud> {
  const panel = o.session.role === 'host' ? await hostSheet(root, o) : peerStrip(root, o);
  const closeCard = lastCard(o.play);
  const pause = pauseCard(o.play);
  const advice = o.session.role === 'host' ? dropoutAdvice(root, o) : undefined;
  const hud: Hud = {
    render() {
      panel.render();
      closeCard();
      pause();
      advice?.();
    },
  };
  o.session.onChange(hud.render);
  o.lobby.onChange(hud.render);
  hud.render();
  return hud;
}
