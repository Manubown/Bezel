import brand from '../../../brand.json';

/**
 * Where the page runs, as far as installing it goes: Android (its browser's own install, `beforeinstallprompt`), iOS
 * (Safari and the other browsers built on it: Share, Add to Home Screen), Chrome on iOS (its Share button sits beside
 * the address bar), anything else (a computer: no offer).
 */
export type Platform = 'android' | 'ios' | 'ios-chrome' | 'other';

/** The platform by the user agent; `maxTouchPoints` tells an iPad, whose Safari presents itself as a Mac, from a Mac. */
export function platformOf(ua: string, maxTouchPoints: number): Platform {
  if (/Android/.test(ua)) return 'android';
  if (!/iPhone|iPad|iPod/.test(ua) && !(/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'other';
  return /\bCriOS\//.test(ua) ? 'ios-chrome' : 'ios';
}

/** The display modes an installed app opens in; the manifest asks for fullscreen, a browser may give less. */
const INSTALLED_MODES = ['fullscreen', 'standalone', 'minimal-ui'];

/**
 * Whether the page runs as the installed app: its display mode (`matches`, as `matchMedia` answers), or on an iPhone
 * the older `navigator.standalone`.
 */
export function runsInstalled(matches: (query: string) => boolean, standalone: boolean | undefined): boolean {
  return standalone === true || INSTALLED_MODES.some((mode) => matches(`(display-mode: ${mode})`));
}

/**
 * Other apps' browsers, by what their user agent carries, in the order they are checked: an app's own marker before
 * the Android WebView's, which those apps carry too.
 */
export const IN_APP_BROWSERS: readonly { name: string; marker: RegExp }[] = [
  { name: 'Instagram', marker: /\bInstagram\b/ },
  // FBAN/FBAV on iOS, FB_IAB on Android; Messenger's browser is the same.
  { name: 'Facebook', marker: /\bFBAN\/|\bFBAV\/|\bFB_IAB\// },
  // musical_ly (the global app) or trill (some regions), and ByteDance's WebView.
  { name: 'TikTok', marker: /\bmusical_ly|\btrill_\d|\bBytedanceWebview\// },
  { name: 'Line', marker: /\bLine\/\d/ },
  // Android's WebView marks itself `; wv)` in the platform part: Gmail, chat apps and every other app that shows a page itself.
  { name: 'Android WebView', marker: /; wv\)/ },
];

/** The other app whose browser shows this page, by its user agent; undefined in a browser of its own. */
export function inAppBrowser(ua: string): string | undefined {
  return IN_APP_BROWSERS.find((b) => b.marker.test(ua))?.name;
}

/** The banner inside another app's browser, which cannot put the page on the home screen. */
const IN_APP: Banner = {
  headline: 'Open this page in Safari or Chrome',
  detail: 'This app’s own browser cannot put it on your home screen. In its menu (⋯ or ⋮), choose to open it in your browser.',
};

const HEADLINE = `Add ${brand.name} to your home screen`;
/** Why (spec D13): what an installed app has that a tab has not. */
const REASON = 'It opens full screen, with no browser bars.';
/** Each phone's way home: the button where the browser has an install of its own, else the steps. */
const ADD = 'Tap Add to Home Screen, then Add';
const HOW: Record<Platform, Pick<Pitch, 'button' | 'steps'> | undefined> = {
  android: { button: 'Install', steps: ['Open the browser’s menu ⋮', 'Tap Install app (or Add to Home screen)'] },
  // Safari since iOS 26 keeps Share in its ⋯ menu; before, and on an iPad, Share is in the bar.
  ios: { button: undefined, steps: ['Tap Share (in Safari’s ⋯ menu on a newer iPhone)', ADD] },
  'ios-chrome': { button: undefined, steps: ['Tap Share, right of the address bar', ADD] },
  other: undefined,
};

/** What the offer depends on (spec D13). */
export interface Situation {
  platform: Platform;
  /** The page runs as the installed app (`runsInstalled`). */
  installed: boolean;
  /** The page is inside another app's browser (`inAppBrowser`). */
  inApp: boolean;
  /** Matches this Device has finished: closed by their Game, with a result. */
  finished: number;
  /** The result card's offer was dismissed: the card carried it and has closed. */
  dismissed: boolean;
}

/** The offer: why, and how. */
export interface Pitch {
  headline: string;
  /** Why: full screen, no browser bars. */
  reason: string;
  /** Android: the button that asks for the browser's own install; undefined where the steps are all there is. */
  button: string | undefined;
  /** How, by hand: an iPhone's steps; on Android, what the button falls back to when the browser has offered no install. */
  steps: readonly string[];
}

/** Inside another app's browser: open the page in a browser of its own. */
export interface Banner {
  headline: string;
  detail: string;
}

/** What to offer where; undefined: nothing there. */
export interface InstallOffer {
  /** At once, over the lobby, on every phone. */
  banner: Banner | undefined;
  /** On the result card, below its buttons. */
  card: Pitch | undefined;
  /** On the Host's sheet, as a row of its own. */
  row: Pitch | undefined;
}

/**
 * What to offer for the home screen (spec D13): the installed app, nothing; inside another app's browser, the banner
 * at once; otherwise nothing before the first finished Match, then the offer on the result card until it was dismissed
 * and as a row on the sheet for good.
 */
export function installOffer(s: Situation): InstallOffer {
  const nothing: InstallOffer = { banner: undefined, card: undefined, row: undefined };
  if (s.installed) return nothing;
  if (s.inApp) return { ...nothing, banner: IN_APP };
  const how = HOW[s.platform];
  if (s.finished < 1 || !how) return nothing;
  const pitch: Pitch = { headline: HEADLINE, reason: REASON, ...how };
  return { ...nothing, card: s.dismissed ? undefined : pitch, row: pitch };
}
