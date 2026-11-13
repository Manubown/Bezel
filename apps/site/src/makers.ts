/**
 * The makers' own details, the one place they are written: the imprint shows them, the privacy page names the contact.
 * `null` is a blank the makers still have to fill in: the pages show it marked, and the site's build lists it
 * (`astro.config.ts`) without failing. The site is not linked from anywhere public while one is open (spec D18).
 */
export interface Makers {
  /** The full name of the person (or the names of the people) responsible for the site and the app. */
  name: string | null;
  /** A postal address where they can be reached by letter; lines separated by `\n`. */
  address: string | null;
  country: string | null;
  /** An e-mail address that is read. */
  contact: string | null;
}

export const makers: Makers = {
  name: 'Manuel Gut',
  address: 'Heiligenstädter Straße 92/89/8\n1190 Wien',
  country: 'Austria',
  contact: 'manubown@gmail.com',
};

/** What each detail is called where a blank is shown or listed, in the imprint's order. */
export const BLANK_LABELS: Readonly<Record<keyof Makers, string>> = {
  name: 'name',
  address: 'postal address',
  country: 'country',
  contact: 'contact',
};

/** The details still open, by their labels, in the imprint's order. */
export function openBlanks(details: Makers): string[] {
  return (Object.keys(BLANK_LABELS) as (keyof Makers)[]).filter((key) => details[key] === null).map((key) => BLANK_LABELS[key]);
}
