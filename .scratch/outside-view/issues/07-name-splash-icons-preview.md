# 07: One name, on every screen, on the home screen and in a shared link

**What to build:** The public name lives in one place and shows wherever a stranger looks: while the page loads, on the first phone's sheet, on a joined phone's strip, in the tab title, under the home-screen icon, in a link's preview. The value is "Bezel" until the makers decide (spec D1); changing it is one edit.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One data file at the workspace root holds the name, the one-sentence pitch and the public address; the app's build reads it, and nothing a player sees spells the name anywhere else
- [ ] Changing the value and rebuilding changes the title, the manifest's name and short name, the splash, the sheet header, the strip and the preview tags, shown by a build with a different value
- [ ] The package scope, the transport's application id, storage keys and Game ids are unchanged
- [ ] The page shows the name, the pitch and a sign of life before its script runs (no black page)
- [ ] The manifest has a 192 px and a 512 px icon, a maskable 512 px icon and the page an apple-touch icon: two rounded rectangles side by side with a dot halfway across the gap; Chrome's install criteria are met without a service worker
- [ ] The manifest's colours equal the page's ground colour
- [ ] The page carries preview tags (title, description, image, address); the image is a drawn picture of phones in a row with the ball crossing
- [ ] Browser smoke: the loading state, the sheet, the strip; the manifest read back from the built output
