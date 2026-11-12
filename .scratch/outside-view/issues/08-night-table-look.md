# 08: The night-table look in the app

**What to build:** The app's platform screens (sheet, strip, cards, lobby preview) take the audit's "night table": near-black ground, ivory text, coral and teal for the two Players, one self-hosted display face for the name, Game titles and scores. The tokens live once, so the site can use the same ones (spec D15). Read the `impeccable` skill before designing.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Colour and type tokens are defined once and are what the sheet, the strip, the cards and the lobby preview use; no screen keeps a private copy of a colour
- [ ] The display face is served from the app's own origin (no request to a font host), with a system fallback that does not shift the layout
- [ ] Every text and control on the platform screens meets WCAG 2.2 contrast (4.5:1 text, 3:1 large text and control borders); the audit's failing rows (placement number, pill, borders) pass
- [ ] Text fields are 16 px: an iPhone does not zoom on focus
- [ ] Every control on the sheet is at least 44 px high; Start is taller than the rest
- [ ] The sheet respects the top safe area
- [ ] The corner control fades during play and returns on a touch near it
- [ ] The warning colour is used for warnings only
- [ ] Browser smoke at 390×844 and 360×780, screenshots in a comment: first phone sheet, joined phone, pause card, result card
