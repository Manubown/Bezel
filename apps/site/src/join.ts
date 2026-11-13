import { CODE_LENGTH, sessionCode } from '@mgc/pwa/sessioncode';

/** What the home page's join field does with a typed code: open the Session, or say why not. */
export type Joining = { href: string } | { refusal: string };

/**
 * The app for everyone (`play`, its address from the page) joined to the Session whose code was typed, read as the app
 * reads a typed code (`sessionCode`). A code that is not `CODE_LENGTH` letters or digits is refused with a sentence.
 */
export function joinByCode(typed: string, play: string): Joining {
  const code = sessionCode(typed);
  if (code === '') return { refusal: 'Type the table’s code: the four letters or digits the first phone shows.' };
  if (code.length !== CODE_LENGTH) return { refusal: `${code} is not a table code: a code has four letters or digits. Check it on the first phone.` };
  return { href: `${play}?room=${code}` };
}
