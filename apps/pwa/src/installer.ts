import { inAppBrowser, installOffer, platformOf, runsInstalled, type InstallOffer } from './install';
import { keptSwitch, switchValue } from './switches';

/** localStorage: how many Matches this Device has finished (closed by their Game, with a result). */
const FINISHED_KEY = 'mgc.matchesFinished';
/** localStorage: a switch (`switches.ts`), on once a result card that carried the install offer closed; the offer does not return there. */
const DISMISSED_KEY = 'mgc.installDismissed';

/** Chrome's `beforeinstallprompt` event (Android, and Chromium browsers built on it); the DOM typings lack it. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** This Device's side of the install offer: what `install.ts` decides from it, and the browser's own install. */
export interface Installer {
  /** What to offer now (`installOffer`). */
  offer(): InstallOffer;
  /** A Match this Device ran was finished by its Game: one more on the Device's count (`Situation.finished`). */
  matchFinished(): void;
  /** The result card that carried the offer closed: it does not return to a card. */
  dismiss(): void;
  /** Shows the browser's own install, if the browser has offered one and it was not used yet; resolves whether it did. */
  prompt(): Promise<boolean>;
  /** The app was installed from this page: the offer is gone. */
  onChange(fn: () => void): void;
}

/**
 * Holds what the offer needs from the browser, read once (the HUD asks on every render): the platform and another
 * app's browser by the user agent, whether the app runs installed (display mode, `navigator.standalone`), and the
 * install Chrome offers as an event early in the page's life, kept until the offer's button asks for it. Call it before
 * the page's first `await`, so the event is never missed. The count of finished Matches and the dismissal are kept on
 * the Device.
 */
export function watchInstall(): Installer {
  const ua = navigator.userAgent;
  const platform = platformOf(ua, navigator.maxTouchPoints);
  const inApp = inAppBrowser(ua) !== undefined;
  let installed = runsInstalled((query) => matchMedia(query).matches, (navigator as Navigator & { standalone?: boolean }).standalone);
  let finished = Number(localStorage.getItem(FINISHED_KEY)) || 0;
  let dismissed = keptSwitch(localStorage.getItem(DISMISSED_KEY)) ?? false;
  let offered: InstallPromptEvent | undefined;
  const listeners: (() => void)[] = [];
  window.addEventListener('beforeinstallprompt', (e) => {
    // Kept for the offer's button: left alone, Chrome would show its own install bar before the first finished Match.
    e.preventDefault();
    offered = e as InstallPromptEvent;
  });
  // Installed from this page: the tab offers it no more.
  window.addEventListener('appinstalled', () => {
    installed = true;
    offered = undefined;
    listeners.forEach((fn) => fn());
  });
  return {
    offer: () => installOffer({ platform, installed, inApp, finished, dismissed }),
    matchFinished: () => localStorage.setItem(FINISHED_KEY, String(++finished)),
    dismiss: () => {
      dismissed = true;
      localStorage.setItem(DISMISSED_KEY, switchValue(true));
    },
    async prompt() {
      const event = offered;
      if (!event) return false;
      // An offered install can be shown once; Chrome offers another later if it was turned down.
      offered = undefined;
      await event.prompt();
      return true;
    },
    onChange: (fn) => listeners.push(fn),
  };
}
