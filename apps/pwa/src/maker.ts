import { keptSwitch, switchValue } from './switches';

/** The address flag of Maker mode (`GLOSSARY.md`): `?maker` switches it on, `?maker=no` off (spec D3). */
export const MAKER_FLAG = 'maker';
/** localStorage: Maker mode as this Device last had it from the address, a switch (`switches.ts`). */
const MAKER_KEY = 'mgc.maker';

/**
 * Whether Maker mode is on: the address's flag when it has one (on, unless its value is `no` in any letter case), else
 * what this Device remembered, else off.
 */
export function makerMode(params: URLSearchParams, remembered: boolean | undefined): boolean {
  const flag = params.get(MAKER_FLAG);
  if (flag === null) return remembered ?? false;
  return flag.trim().toLowerCase() !== 'no';
}

/** Maker mode for this page; a flag in its address is remembered on this Device for the visits without one. */
export function claimMakerMode(params: URLSearchParams): boolean {
  const on = makerMode(params, keptSwitch(localStorage.getItem(MAKER_KEY)));
  if (params.has(MAKER_FLAG)) localStorage.setItem(MAKER_KEY, switchValue(on));
  return on;
}
