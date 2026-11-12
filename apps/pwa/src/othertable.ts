/** What "Join a different table" on the first phone does with a typed code: open that table, or say why not. */
export type OtherTable = { code: string } | { refusal: string };

/**
 * The table a code typed on the first phone opens: in capitals, letters and digits only. The first phone's own code,
 * in any letter case, is refused with a sentence, so following the QR's hint cannot end the table (spec D4).
 * Undefined when nothing is left of `typed`.
 */
export function otherTable(typed: string, own: string): OtherTable | undefined {
  const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code === '') return undefined;
  if (code === own.toUpperCase()) return { refusal: `${own} is this table’s code: scan the QR above with the other phones.` };
  return { code };
}
