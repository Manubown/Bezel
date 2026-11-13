/** localStorage: this Device's sound setting (`'on'` or `'off'`), once its person switched it. */
const SOUND_KEY = 'mgc.sound';

/**
 * Whether this Device plays sound (spec outside-view D12): on until its person switches it off on the Host's sheet or a
 * Peer's strip, then as last switched, across visits. A running Match hears of a change
 * (`MatchHandle.setSound`), and a Game's view reads it as `ctx.sound`.
 */
export interface SoundSetting {
  readonly on: boolean;
  set(on: boolean): void;
  /** `fn` hears every change, in order. */
  onChange(fn: (on: boolean) => void): void;
}

export function soundSetting(): SoundSetting {
  let on = localStorage.getItem(SOUND_KEY) !== 'off';
  const listeners: ((on: boolean) => void)[] = [];
  return {
    get on() {
      return on;
    },
    set(next) {
      if (next === on) return;
      on = next;
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
      for (const fn of listeners) fn(on);
    },
    onChange: (fn) => void listeners.push(fn),
  };
}
