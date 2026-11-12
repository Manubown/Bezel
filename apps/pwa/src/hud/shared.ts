import type { Layout } from '@mgc/layout';
import type { LastMatch } from '../hud';
import { describeClose, describeResult } from '../result';

/** The last Match in words: its result, or why it closed without one. */
export function describeLast(last: LastMatch): { headline: string; detail: string } {
  return last.result ? describeResult(last.players, last.result) : describeClose(last.reason, last.detail);
}

/** Where phone `index` (0-based) goes relative to the one before it. */
export function placementHint(layout: Layout, index: number): string {
  if (index === 0) return 'first phone';
  const n = index + 1;
  switch (layout.template) {
    case 'row':
      return `right of phone ${n - 1}`;
    case 'column':
      return `below phone ${n - 1}`;
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(layout.devices.length));
      return `row ${Math.floor(index / cols) + 1}, column ${(index % cols) + 1}`;
    }
  }
}

function ms(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(1)} ms`;
}

/** `rtt · Δoffset`; the offset is raw host−local time, so watch its stability, not its value. */
export function syncStats(c: { rtt?: number; offset?: number } | undefined): string {
  return c ? `${ms(c.rtt)} · Δ${ms(c.offset)}` : '—';
}

export function statusDot(state: 'ok' | 'wait' | 'off'): string {
  return `<svg class="dot dot-${state}" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4"/></svg>`;
}

/** Names and ids come off the network: never markup. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
