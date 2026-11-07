import type { MatchEvent } from '@mgc/sdk';

/** One line of the game log the Host's HUD shows. */
export interface LogLine {
  kind: 'fault' | 'log' | 'closed';
  text: string;
}

/** The HUD keeps the newest this many. */
export const LOG_LINES = 50;

/** The line a `runMatch` event adds to the game log: a game's fault, its `ctx.log`, or a close. */
export function logLineOf(e: MatchEvent): LogLine | undefined {
  switch (e.t) {
    case 'fault':
      return { kind: 'fault', text: `${e.where}: ${e.message}` };
    case 'log':
      return { kind: 'log', text: `${e.side}: ${e.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}` };
    case 'view-closed':
      return { kind: 'closed', text: `this phone’s view closed (${e.reason}): ${e.detail}` };
    case 'closed':
      return { kind: 'closed', text: `match closed (${e.reason}): ${e.detail}` };
    default:
      return undefined;
  }
}
