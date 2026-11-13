import { playerColour } from '@mgc/sdk';
import type { LastMatch } from '../hud';
import { describeClose, describeResult } from '../result';

/** The last Match in words: its result, or why it closed without one; `player`, the Player its headline names. */
export function describeLast(last: LastMatch): { headline: string; detail: string; player?: number } {
  return last.result ? describeResult(last.players, last.result) : describeClose(last.reason, last.detail);
}

/**
 * A `style` attribute giving an element's text the colour of the Player at `position` in the Match's (or the lobby's)
 * Player list, the colour the Games draw that Player in (spec outside-view D10); nothing without a Player.
 */
export function inColour(position: number | undefined): string {
  return position === undefined || position < 0 ? '' : ` style="color: ${playerColour(position)}"`;
}

function ms(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(1)} ms`;
}

/** `rtt · Δoffset`; the offset is raw host−local time, so watch its stability, not its value. */
export function syncStats(c: { rtt?: number; offset?: number } | undefined): string {
  return c ? `${ms(c.rtt)} · Δ${ms(c.offset)}` : '—';
}

/** A status dot: `ok` in, `wait` on its way (neutral), `warn` a weak or lost connection (the warning colour), `off` not there. */
export function statusDot(state: 'ok' | 'wait' | 'warn' | 'off'): string {
  return `<svg class="dot dot-${state}" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4"/></svg>`;
}

/** Names and ids come off the network: never markup. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
