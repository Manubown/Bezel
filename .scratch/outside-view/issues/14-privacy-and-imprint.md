# 14: Privacy and imprint pages

**What to build:** The site has a privacy page that says, in plain words, what a phone gives away and to whom, and an imprint page. Both are complete except for the makers' own details, which are marked blanks; the app links to the privacy page (spec D18). Not legal advice: the makers read both before the site is linked anywhere.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] The privacy page names every party a phone talks to and what each sees: the host of the pages; the public signaling relays (which see an IP address and the table's hashed name); the Relay provider (which carries encrypted traffic when no direct path works); the other phones of the table (which see each other's IP address, as any direct connection does)
- [ ] It says what the app keeps on the phone (a Device id, a Player id, settings, the session log), that none of it is sent anywhere unless the person exports a log, and how to delete it
- [ ] It says there are no accounts, no cookies, no analytics and no ads, and each of these is true of the build it ships with (checked against the app's outgoing requests in a browser)
- [ ] The parties' names are read from the build's actual configuration, not assumed: the signaling relays the transport uses and the Relay provider of the hosted build
- [ ] The imprint page has marked blanks for name, postal address, contact and country, and a build of the site lists the blanks still open
- [ ] Both pages are linked from the site's footer; the app's sheet links the privacy page
- [ ] The README's privacy paragraph (ticket 15) and this page say the same thing
