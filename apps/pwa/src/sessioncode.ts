/** What "Join a different table" on the Host does with a typed code: open that Session, or say why not. */
export type OtherSession = { code: string } | { refusal: string };

/** How many letters or digits a Session code has: the Host makes its code this long (`main.ts`). */
export const CODE_LENGTH = 4;

/** A typed Session code as an address carries it: in capitals, letters and digits only. */
export function sessionCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
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
