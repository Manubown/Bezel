/** One thing the app keeps in the phone's browser, as the privacy page says it (spec D18). */
export interface Kept {
  /** What it is, in a player's words. */
  what: string;
  /** What it is for and how long it stays; one or two sentences. */
  detail: string;
  /**
   * The app's modules (paths below `apps/pwa/src`) that keep it. `test/privacy.test.ts` holds this list to the code:
   * a module that starts keeping something fails it until the item is here.
   */
  sources: string[];
}

/** Read off the code: `device.ts`, `maker.ts`, `sound.ts`, `installer.ts`, `lastgame.ts`, `main.ts`, `lobby.ts`, `recorder.ts`. */
export const KEPT: Kept[] = [
  {
    what: 'A Device id',
    detail:
      'A random code made on your phone the first time it opens the app (one more for each tab that has the app open at the same time), so that a phone that drops out of a table is known again when it comes back. It stays until you delete it.',
    sources: ['device.ts'],
  },
  {
    what: 'A Player id',
    detail: 'Another random code, one for each Device id, so that you keep your place in a game when the page reloads. It stays until you delete it.',
    sources: ['device.ts'],
  },
  {
    what: 'Maker mode, on or off',
    detail: 'Only if the app was ever opened with ?maker in its address, as the makers do when they test. It stays until you delete it.',
    sources: ['maker.ts'],
  },
  {
    what: 'Sound, on or off',
    detail: 'Only once you switched the sound on the first phone’s sheet or on another phone’s top strip, so that the phone stays as you left it. It stays until you delete it.',
    sources: ['sound.ts'],
  },
  {
    what: 'The offer to add the app to your home screen',
    detail:
      'How many games this phone has finished, and whether you closed a result card that carried the offer or used it there, so that the offer comes after your first finished game and does not keep coming back on the cards. It stays until you delete it.',
    sources: ['installer.ts'],
  },
  {
    what: 'The last game you picked',
    detail: 'On the first phone, once you picked a game on its sheet: which one, so that the next table you open starts with it. It stays until you delete it.',
    sources: ['lastgame.ts'],
  },
  {
    what: 'The table you opened',
    detail:
      'On the first phone only: the table’s code and what was picked on its sheet (the Game, how the phones lie, the Players and their names), so that reloading the page keeps the table. It goes when you close the tab.',
    sources: ['main.ts', 'lobby.ts'],
  },
  {
    what: 'The session log',
    detail:
      'A record of what the app did on this phone, so that a problem at a table can be looked into: when phones joined and left, what kind of connection each one used (never its address), timings, errors, your screen’s size, your browser’s name and version, the page’s address with the table code, and the games played with the Players’ names. It keeps the newest 20,000 lines, about 3 MB, and drops older ones.',
    sources: ['recorder.ts'],
  },
];
