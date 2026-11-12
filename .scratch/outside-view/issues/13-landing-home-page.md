# 13: The home page: see it, start a table, join one, install it

**What to build:** The site's home page shows phones becoming one table within the first screen and is the shortest way into the app: Start a table, a join-by-code field, the two Games, why and how to install, what it works on and where it does not, and a door for people who want to build a Game (spec D17). Read the `impeccable` skill before designing.

**Blocked by:** 08, 12

**Status:** ready-for-agent

- [ ] First screen at 390×844: the name, one sentence, a looping drawn illustration of two phones with a ball crossing the gap, and Start a table
- [ ] Start a table opens the app for everyone; the join field takes a four-character code and opens the app for everyone joined to that table; a malformed code is refused in words
- [ ] Three steps in the words players read ("table", "first phone")
- [ ] The two Games are listed from their Manifests (name, Players, arrangement), not typed by hand
- [ ] An install section says what installing gives (full screen, no browser bars) and the steps for iPhone and Android
- [ ] "Works on" and "known limits" say: iPhone and Android in a current Safari or Chrome; an iPhone hotspot often fails, use the same Wi-Fi or mobile data on every phone; every phone needs internet to join
- [ ] One paragraph for developers with a link to the repository's Game guide
- [ ] Inside another app's browser the page says to open it in Safari or Chrome
- [ ] The page uses the app's tokens and display face (ticket 08); the face is served from the site's own origin
- [ ] Preview tags, a description and a sitemap are present; the footer links privacy, imprint and the repository
- [ ] With scripts off the page reads completely; only the forwards, the join field and the illustration need script
- [ ] The illustration stops for a visitor who prefers reduced motion
- [ ] Browser check at 390×844, 360×780 and a laptop width, screenshots in a comment; text contrast meets WCAG 2.2
