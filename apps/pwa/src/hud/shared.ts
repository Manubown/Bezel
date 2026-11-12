import type { LastMatch } from '../hud';
import { describeClose, describeResult } from '../result';

/** The last Match in words: its result, or why it closed without one. */
export function describeLast(last: LastMatch): { headline: string; detail: string } {
  return last.result ? describeResult(last.players, last.result) : describeClose(last.reason, last.detail);
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
