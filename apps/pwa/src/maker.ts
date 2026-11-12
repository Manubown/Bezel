/** The address flag of Maker mode (`GLOSSARY.md`): `?maker` switches it on, `?maker=no` off. */
export const MAKER_FLAG = 'maker';
/** localStorage: Maker mode as this Device last had it from the address (`'on'` or `'off'`). */
const MAKER_KEY = 'mgc.maker';
/** The flag's values that switch Maker mode off; any other value, or none, switches it on. */
const OFF: readonly string[] = ['no', 'off', '0', 'false'];

/** Whether Maker mode is on: the address's flag when it has one, else what this Device remembered, else off. */
export function makerMode(params: URLSearchParams, remembered: boolean | undefined): boolean {
  const flag = params.get(MAKER_FLAG);
  if (flag === null) return remembered ?? false;
  return !OFF.includes(flag.trim().toLowerCase());
}

/** Maker mode for this page; a flag in its address is remembered on this Device for the visits without one. */
export function claimMakerMode(params: URLSearchParams): boolean {
  const stored = localStorage.getItem(MAKER_KEY);
  const on = makerMode(params, stored === null ? undefined : stored === 'on');
  if (params.has(MAKER_FLAG)) localStorage.setItem(MAKER_KEY, on ? 'on' : 'off');
  return on;
}
