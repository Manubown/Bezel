import { playerColour } from '@mgc/sdk';
import type { LastMatch } from '../hud';
import { describeClose, describeResult } from '../result';
import type { SoundSetting } from '../sound';

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

/**
 * The sound switch, one on the Host's sheet and one on a Peer's strip (spec outside-view D12): a chip,
 * pressed while this phone plays sound, a speaker with its waves or crossed out. A tap switches this Device's setting.
 */
export function soundSwitch(sound: SoundSetting): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip sound';
  const show = (on: boolean): void => {
    button.setAttribute('aria-pressed', String(on));
    button.innerHTML =
      `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>` +
      `<path d="${on ? 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' : 'M16 9.5l5 5M21 9.5l-5 5'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Sound`;
  };
  show(sound.on);
  button.addEventListener('click', () => sound.set(!sound.on));
  sound.onChange(show);
  return button;
}

/** Names and ids come off the network: never markup. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
