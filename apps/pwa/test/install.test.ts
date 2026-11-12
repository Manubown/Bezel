import { describe, expect, it } from 'vitest';
import brand from '../../../brand.json';
import { inAppBrowser, installOffer, platformOf, runsInstalled, type Situation } from '../src/install';

/** User agents as the browsers and apps send them (versions vary; the markers do not). */
const UA = {
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  desktopLinux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; en_US; en; scale=3.00; 1290x2796; 661588612)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.86 Mobile Safari/537.36 Instagram 355.1.0.44.103 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_US; 659206720)',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0.0.53.105;FBBV/670420548;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/487.0.0.55.109;]',
  tiktokIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.2.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US WKWebView/1 BytedanceWebview/d8a21c6',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.86 Mobile Safari/537.36 trill_370203 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/trill app_version/37.2.3 ByteLocale/en Region/DE BytedanceWebview/d8a21c6',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.18.0',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 Line/14.15.1/IAB',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36',
};

describe('inAppBrowser', () => {
  it('recognises Instagram', () => {
    expect(inAppBrowser(UA.instagramIos)).toBe('Instagram');
    expect(inAppBrowser(UA.instagramAndroid)).toBe('Instagram');
  });

  it('recognises Facebook and its Messenger', () => {
    expect(inAppBrowser(UA.facebookIos)).toBe('Facebook');
    expect(inAppBrowser(UA.facebookAndroid)).toBe('Facebook');
  });

  it('recognises TikTok', () => {
    expect(inAppBrowser(UA.tiktokIos)).toBe('TikTok');
    expect(inAppBrowser(UA.tiktokAndroid)).toBe('TikTok');
  });

  it('recognises Line', () => {
    expect(inAppBrowser(UA.lineIos)).toBe('Line');
    expect(inAppBrowser(UA.lineAndroid)).toBe('Line');
  });

  it('recognises any other app’s Android WebView by its marker', () => {
    expect(inAppBrowser(UA.androidWebView)).toBe('Android WebView');
  });

  it('leaves the browsers alone', () => {
    for (const ua of [UA.safari, UA.chromeIos, UA.ipadSafari, UA.chromeAndroid, UA.samsung, UA.firefoxAndroid, UA.desktopLinux]) expect(inAppBrowser(ua)).toBeUndefined();
  });
});

describe('platformOf', () => {
  it('is Android for every Android browser', () => {
    for (const ua of [UA.chromeAndroid, UA.samsung, UA.firefoxAndroid]) expect(platformOf(ua, 5)).toBe('android');
  });

  it('is iOS for an iPhone, and an iPad that presents itself as a Mac', () => {
    expect(platformOf(UA.safari, 5)).toBe('ios');
    expect(platformOf(UA.ipadSafari, 5)).toBe('ios');
  });

  it('tells Chrome on iOS apart: its Share button is elsewhere', () => {
    expect(platformOf(UA.chromeIos, 5)).toBe('ios-chrome');
  });

  it('is other for a computer, a Mac included', () => {
    expect(platformOf(UA.desktopLinux, 0)).toBe('other');
    expect(platformOf(UA.ipadSafari, 0)).toBe('other');
  });
});

describe('runsInstalled', () => {
  /** A page whose display mode is `mode`, as `matchMedia` answers. */
  const shownAs = (mode: string) => (query: string) => query === `(display-mode: ${mode})`;

  it('is true in the display modes of an installed app: fullscreen (what the manifest asks for), standalone, minimal-ui', () => {
    expect(runsInstalled(shownAs('fullscreen'), undefined)).toBe(true);
    expect(runsInstalled(shownAs('standalone'), undefined)).toBe(true);
    expect(runsInstalled(shownAs('minimal-ui'), undefined)).toBe(true);
  });

  it('is true on an iPhone that says so the old way, `navigator.standalone`', () => {
    expect(runsInstalled(shownAs('browser'), true)).toBe(true);
  });

  it('is false in a browser tab', () => {
    expect(runsInstalled(shownAs('browser'), undefined)).toBe(false);
    expect(runsInstalled(shownAs('browser'), false)).toBe(false);
  });
});

describe('installOffer', () => {
  /** An Android phone in Chrome that has finished one Match and seen no offer yet. */
  const after = (s: Partial<Situation> = {}): Situation => ({ platform: 'android', installed: false, inApp: false, finished: 1, dismissed: false, ...s });
  const nothing = { banner: undefined, card: undefined, row: undefined };

  it('offers nothing to the installed app: no card, no row, no banner', () => {
    expect(installOffer(after({ installed: true }))).toEqual(nothing);
    expect(installOffer(after({ installed: true, platform: 'ios', finished: 5 }))).toEqual(nothing);
    expect(installOffer(after({ installed: true, inApp: true, finished: 0 }))).toEqual(nothing);
  });

  it('inside another app’s browser shows the banner at once, before any Match, and offers no install it could not do', () => {
    for (const finished of [0, 1, 4]) {
      const offer = installOffer(after({ inApp: true, finished }));
      expect(offer.banner?.headline).toBe('Open this page in Safari or Chrome');
      expect(offer.card).toBeUndefined();
      expect(offer.row).toBeUndefined();
    }
    expect(installOffer(after({ inApp: true, platform: 'ios', finished: 0 })).banner?.headline).toBe('Open this page in Safari or Chrome');
  });

  it('offers nothing before the first finished Match', () => {
    for (const platform of ['android', 'ios', 'ios-chrome'] as const) expect(installOffer(after({ platform, finished: 0 }))).toEqual(nothing);
  });

  it('after the first finished Match offers Android the browser’s own install, with the reason, on the card and as the sheet’s row', () => {
    const { banner, card, row } = installOffer(after());
    expect(banner).toBeUndefined();
    expect(card).toEqual(row);
    expect(card?.headline).toBe(`Add ${brand.name} to your home screen`);
    expect(card?.reason).toBe('It opens full screen, with no browser bars.');
    expect(card?.button).toBe('Install');
    // What the button falls back to when the browser has offered no install: its menu.
    expect(card?.steps).toEqual(['Open the browser’s menu ⋮', 'Tap Install app (or Add to Home screen)']);
    expect(installOffer(after({ finished: 7 })).card).toEqual(card);
  });

  it('after the first finished Match gives an iPhone or iPad the steps, Share then Add to Home Screen, and no button', () => {
    const { card, row } = installOffer(after({ platform: 'ios' }));
    expect(card).toEqual(row);
    expect(card?.reason).toBe('It opens full screen, with no browser bars.');
    expect(card?.button).toBeUndefined();
    // Safari since iOS 26 keeps Share in its ⋯ menu; before, Share is in the bar.
    expect(card?.steps).toEqual(['Tap Share (in Safari’s ⋯ menu on a newer iPhone)', 'Tap Add to Home Screen, then Add']);
  });

  it('gives Chrome on iOS its own wording: Share sits beside the address bar', () => {
    const { card } = installOffer(after({ platform: 'ios-chrome' }));
    expect(card?.button).toBeUndefined();
    expect(card?.steps).toEqual(['Tap Share, right of the address bar', 'Tap Add to Home Screen, then Add']);
  });

  it('offers a computer nothing: the app is for phones', () => {
    expect(installOffer(after({ platform: 'other', finished: 3 }))).toEqual(nothing);
  });

  it('once dismissed, leaves the result card and keeps the sheet’s row', () => {
    for (const platform of ['android', 'ios', 'ios-chrome'] as const) {
      const { banner, card, row } = installOffer(after({ platform, finished: 2, dismissed: true }));
      expect(banner).toBeUndefined();
      expect(card).toBeUndefined();
      expect(row).toEqual(installOffer(after({ platform })).row);
    }
  });
});
