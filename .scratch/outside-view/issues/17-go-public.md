# 17: Go public: the steps only the makers can take

**What to build:** Nothing; the decisions and checks that stand between the finished work and a stranger being sent to it. Until this ticket is done the site is linked from nowhere and the app for everyone is still the build of 2026-11-07.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16

**Status:** ready-for-human

Before `outside-view` is merged to `master` (the merge publishes the site at the address the repository's About box already names)

- [ ] Whose name and postal address stand in the imprint, and in which country; fill the blanks in `apps/site/src/makers.ts` (the site's build lists the ones still open) and read the privacy and imprint pages
- [ ] The public name. If it is not "Bezel": change `brand.json`, and rename the repository before the site is linked anywhere (a renamed repository's old Pages address is not forwarded)
- [ ] Node 22.23.4 or newer on the machine that builds the site (`pnpm pages`); CI already has it
- [ ] The first run of the changed publish workflow on GitHub is watched: it was linted and its script run locally, never run there

Check on phones, on the latest build (`next/`), with Maker mode on and every phone's log exported

- [ ] A stranger to the project gets from the QR to a Pong Match without being told anything
- [ ] The placement number is readable from a metre away; the sheet folds when the second phone is in
- [ ] The help card appears on a phone that cannot get in (iPhone hotspot) and its advice works
- [ ] Sound on an iPhone with the silent switch off and on; a three-phone row: the hit sounds on the phone the ball is on
- [ ] Vibration on an Android phone
- [ ] Install from Safari and from Chrome on Android; the installed app opens full-screen and opens the app, not the site
- [ ] An old link, an old QR code and an icon installed before the move still reach a table
- [ ] The safe area at the top of the sheet on a phone with a notch

Then

- [ ] Move `stable` to the checked commit (`pnpm stable <ref>`) and open `play/` on a phone
- [ ] Film the 20-second clip (phones pushed together, a ball crossing, the name in frame); replace the drawn illustration on the home page and the README picture with it
- [ ] Upload the social preview image in the repository's settings
- [ ] Tag the first release on the commit `stable` points at, with the changelog's entry as its notes
- [ ] Set the repository's website to the site and update `docs/strategy/README.md`: which of its steps this round closed, and the rival's two announced table-and-hand games
