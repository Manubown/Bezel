import { keptSwitch, switchValue } from './switches';

/** localStorage: this Device's sound setting, a switch (`switches.ts`), once its person switched it. */
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

/** The page's audio session (`navigator.audioSession`, Safari): what kind of audio the page plays. */
export interface AudioSessionLike {
  type: string;
}

/**
 * This Device's setting, read from the Device. While it is on, the page's audio session (`audio`) says the page plays
 * media (`'playback'`): an iPhone's silent switch mutes Web Audio otherwise (developers' reports; a phone decides).
 * While it is off, the session is the browser's own (`'auto'`). The platform sets it, page-wide; a Game never does.
 */
export function soundSetting(audio?: AudioSessionLike): SoundSetting {
  let on = keptSwitch(localStorage.getItem(SOUND_KEY)) ?? true;
  const listeners: ((on: boolean) => void)[] = [];
  const follow = (): void => {
    if (!audio) return;
    if (on) audio.type = 'playback';
    else if (audio.type === 'playback') audio.type = 'auto';
  };
  follow();
  return {
    get on() {
      return on;
    },
    set(next) {
      if (next === on) return;
      on = next;
      localStorage.setItem(SOUND_KEY, switchValue(on));
      follow();
      for (const fn of listeners) fn(on);
    },
    onChange: (fn) => void listeners.push(fn),
  };
}
