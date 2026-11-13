import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundSetting } from '../src/sound';

describe('the Device’s sound setting (spec outside-view D12)', () => {
  /** The phone's storage for the app: what one visit keeps, the next finds. */
  let kept: Map<string, string>;
  beforeEach(() => {
    kept = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is on for a Device that never switched it, and keeps nothing until it is switched', () => {
    expect(soundSetting().on).toBe(true);
    expect(kept.size).toBe(0);
  });

  it('stays as it was last switched, across visits', () => {
    const visit = soundSetting();
    visit.set(false);
    expect(visit.on).toBe(false);
    expect(soundSetting().on).toBe(false);
    soundSetting().set(true);
    expect(soundSetting().on).toBe(true);
  });

  it('lets the page play as media, through an iPhone’s silent switch, only while it is on: the audio session is playback then, the browser’s own auto while off', () => {
    const session = { type: 'auto' };
    const sound = soundSetting(session);
    expect(session.type).toBe('playback');
    sound.set(false);
    expect(session.type).toBe('auto');
    sound.set(true);
    expect(session.type).toBe('playback');
  });

  it('leaves the audio session alone on a Device whose sound is off from the start, and does without one where the browser has none', () => {
    kept.set('mgc.sound', 'off');
    const session = { type: 'auto' };
    soundSetting(session);
    expect(session.type).toBe('auto');
    expect(() => soundSetting(undefined).set(true)).not.toThrow();
  });

  it('tells each listener of a change, and of nothing else', () => {
    const sound = soundSetting();
    const heard: boolean[] = [];
    sound.onChange((on) => heard.push(on));
    sound.set(true);
    sound.set(false);
    sound.set(false);
    sound.set(true);
    expect(heard).toEqual([false, true]);
  });
});
