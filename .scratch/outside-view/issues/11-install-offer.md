# 11: The app offers itself for the home screen, once, after the first Match

**What to build:** After a Device's first finished Match the result card offers the app for the home screen: an Install button on Android, the steps on an iPhone (Share, Add to Home Screen), each with the reason (full screen, no browser bars). The sheet keeps a row for it. Inside another app's browser a banner says to open the page in Safari or Chrome. An installed app shows none of it (spec D13, D14).

**Blocked by:** 06, 07

**Status:** ready-for-agent

- [ ] What to offer is one pure function of the platform, whether the app runs installed, whether the page is inside another app's browser, the Device's count of finished Matches and whether the offer was dismissed; unit tests cover every branch
- [ ] Nothing is offered before the first finished Match, except the in-app-browser banner, which shows at once
- [ ] The offer appears on the result card once; dismissed, it does not return there; the sheet's row stays
- [ ] Android: the button triggers the browser's own install prompt when the browser has offered one, and falls back to the menu steps when it has not
- [ ] iPhone and iPad: the steps name Share and Add to Home Screen; Chrome on iOS gets its own wording
- [ ] Running installed: no offer, no row, no banner
- [ ] No service worker is added
- [ ] The phone guide's install section says what a phone gets and corrects the claim that an iPhone locks orientation when installed
- [ ] Browser smoke with the platform emulated, screenshots in a comment: Android offer, iPhone steps, in-app-browser banner
- [ ] Left for phones, as boxes on ticket 17: the real install on Safari and on Chrome, and the installed app opening full-screen
