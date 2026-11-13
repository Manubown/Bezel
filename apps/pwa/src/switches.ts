/**
 * How a switch is kept on the Device (`localStorage`): `'on'` or `'off'`. Maker mode (`maker.ts`), the sound
 * (`sound.ts`) and the install offer's dismissal (`installer.ts`) are kept this way; each module writes its own key.
 */
export function switchValue(on: boolean): 'on' | 'off' {
  return on ? 'on' : 'off';
}

/**
 * A kept switch as it reads back; undefined when nothing (or anything else) is kept. `'yes'` is how builds before this
 * one kept the install offer's dismissal, and reads as on.
 */
export function keptSwitch(kept: string | null): boolean | undefined {
  if (kept === 'on' || kept === 'yes') return true;
  if (kept === 'off') return false;
  return undefined;
}
