/** What "Join a different table" on the Host does with a typed code: open that Session, or say why not. */
export type OtherSession = { code: string } | { refusal: string };

/**
 * How many letters or digits a Session code has: the Host makes its code this long (`main.ts`), the code fields take no
 * more (`maxlength`), and the site's join field refuses a code of another length.
 */
export const CODE_LENGTH = 4;

/**
 * A typed Session code as an address carries it: in capitals, letters and digits only. The one reader of a code: the
 * page's own address (`main.ts`), the Host's "Join a different table", the help card's code field, the site's join field.
 */
export function sessionCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The address that joins the Session `code` (as `sessionCode` reads it): `href`, a whole address or a path, with its
 * `room` replaced and its other flags (`maker`, `noturn`) as they were written. The one way an address to a Session is
 * built from a typed code: the Host's "Join a different table", the help card's code field, the site's join field.
 */
export function joinAddress(href: string, code: string): string {
  const [, path, query = '', hash] = /^([^?#]*)(?:\?([^#]*))?(.*)$/.exec(href)!;
  const flags = query.split('&').filter((p) => p !== '' && !/^room(=|$)/.test(p));
  return `${path}?${[`room=${code}`, ...flags].join('&')}${hash}`;
}

/**
 * The Session a code typed on the Host opens (`sessionCode`). The Host's own code, in any letter case, is refused
 * with a sentence, so following the QR's hint cannot end the Session (spec D4). Undefined when nothing is left of
 * `typed`.
 */
export function otherSession(typed: string, own: string): OtherSession | undefined {
  const code = sessionCode(typed);
  if (code === '') return undefined;
  if (code === own.toUpperCase()) return { refusal: `${own} is this table’s code: scan the QR above with the other phones.` };
  return { code };
}
