# 07: One name, on every screen, on the home screen and in a shared link

**What to build:** The public name lives in one place and shows wherever a stranger looks: while the page loads, on the first phone's sheet, on a joined phone's strip, in the tab title, under the home-screen icon, in a link's preview. The value is "Bezel" until the makers decide (spec D1); changing it is one edit.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] One data file at the workspace root holds the name, the one-sentence pitch and the public address; the app's build reads it, and nothing a player sees spells the name anywhere else
- [x] Changing the value and rebuilding changes the title, the manifest's name and short name, the splash, the sheet header, the strip and the preview tags, shown by a build with a different value
- [x] The package scope, the transport's application id, storage keys and Game ids are unchanged
- [x] The page shows the name, the pitch and a sign of life before its script runs (no black page)
- [x] The manifest has a 192 px and a 512 px icon, a maskable 512 px icon and the page an apple-touch icon: two rounded rectangles side by side with a dot halfway across the gap; Chrome's install criteria are met without a service worker
- [x] The manifest's colours equal the page's ground colour
- [x] The page carries preview tags (title, description, image, address); the image is a drawn picture of phones in a row with the ball crossing
- [x] Browser smoke: the loading state, the sheet, the strip; the manifest read back from the built output

## Comments

### 2026-11-12, agent (implementation)

**Changed**
- `brand.json` (new, workspace root): `name` "Bezel", `pitch` "Put your phones side by side and they become one game board.", `address` "https://manubown.github.io/Bezel/".
- `apps/pwa/brand.ts` (new): `brandPlugin`, the Vite plugin that fills in `index.html` and serves (dev) or writes (build) `manifest.webmanifest`; the two pure functions under it, `brandPage` (the page for a brand and a base) and `webManifest` (the manifest for a brand and the page). Wired in `apps/pwa/vite.config.ts`; `apps/pwa/tsconfig.json` includes it.
- `apps/pwa/index.html`: `<title>`, `description` and the preview tags (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` with size and alt, `twitter:card`) as `%BRAND_NAME%` / `%BRAND_PITCH%` / `%BRAND_URL%`; `theme-color` as `%GROUND%`; links to the manifest, the tab icon `icon.svg` and `apple-touch-icon.png`; a static splash inside `#hud` (name, pitch, a pulsing dot; still under reduced motion) that the HUD replaces; `.brand` on the bar and the strip.
- `apps/pwa/src/hud.ts`: the `brand.json` import and one `<span class="brand">` in the bar and one in the strip (three lines).
- `apps/pwa/public/manifest.webmanifest` removed: the build writes it. Added in `apps/pwa/public/`: `icon.svg` (the mark), `icon-maskable.svg`, `preview.svg`, and the PNGs drawn from them: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180 px), `preview.png` (1200×630).
- `apps/pwa/test/brand.test.ts` (new, 7 tests): title and splash, preview tags with this build's address, no other name in the template, manifest name/short name/description, manifest and theme colours from the page's ground, the three manifest icons and the apple-touch icon exist as PNGs of the stated size.
- Docs: `docs/architecture.md` §5 gets a row for the public name; `docs/guide/running-on-phones.md` no longer names the deleted manifest file.

**Decisions**
- The build reads `brand.json` through a Vite plugin (page and manifest) and the HUD through a JSON import; the site of ticket 12 imports the same file. Values are escaped as text; a `%BRAND_…%` the plugin does not know fails the build.
- `og:url` and `og:image` are the address's origin plus the build's base, so each build previews itself with its own picture: `/Bezel/` today, `play/` and `next/` after ticket 12, without depending on the site serving a file. A local build without `BASE_PATH` points at the origin's root; it is never published.
- The manifest's colours and the `theme-color` meta are read from the page's `--bg` token, so the ground colour is set in one place.
- The manifest link is relative (`manifest.webmanifest`): the file is generated, not in `public/`, so Vite would not prefix the base; relative works under every base.
- `short_name` is the name (five letters fit under an icon). A long name would need a short form; none added.
- The mark: two phone outlines and the ball in the gap, the ball cutting both inner edges so it reads as crossing; ivory `#f2f0ea` on `#121212`. The `any` icons have rounded corners; the maskable and apple-touch icons are the full square with the mark at 80 % (it reaches 155 px from the centre of 512; the safe circle is 205 px). Rasterised once with headless Chrome (each SVG drawn at the target size, screenshotted with a transparent background); the SVG comments say so. No build-time image dependency.
- The preview picture has no words, so a new name needs no redraw: three phones in a row on a dark table, a coral paddle on the first, a teal one on the last, the net on the middle phone, the ball with a short trail halfway across the first gap.
- On the bar the name comes before the code and hides in the playing pill; on the strip the name is on the first line and the code under it, small and grey. Plain weight-700 system type: ticket 08 brings the display face.
- Unchanged: the `@mgc` scope, `APP_ID = 'mobilegameconnect'`, the storage keys (`mgc.*`, `mgc-log-*`), the Game ids, the session log's file name `mgc-<code>-<role>-<time>.txt` (Maker mode's).

**Verified**
- `pnpm vitest run apps/pwa/test/brand.test.ts`: 7 passed (each slice red first).
- `pnpm typecheck && pnpm test`: typecheck clean; 30 files, 230 tests passed.
- `BASE_PATH=/Bezel/ pnpm build`, output read back: `dist/manifest.webmanifest` has name and short_name "Bezel", the pitch as description, `background_color` and `theme_color` `#121212`, icons `icon-192.png` 192x192, `icon-512.png` 512x512, `icon-maskable-512.png` 512x512 maskable; `dist/index.html` has `<title>Bezel</title>`, `og:url` `https://manubown.github.io/Bezel/`, `og:image` `https://manubown.github.io/Bezel/preview.png`, `twitter:card` `summary_large_image`, `apple-touch-icon` `/Bezel/apple-touch-icon.png`, and the name and pitch in `#hud`.
- Chrome's install check on that build (`vite preview --base /Bezel/`, HTTPS, headless Chrome over CDP): `Page.getInstallabilityErrors` returned `[]`, `Page.getAppManifest` no errors, 0 service workers, every icon and `preview.png` served 200 `image/png`. Control on the same page with a manifest of `icons: []`: `manifest-missing-suitable-icon` and `no-acceptable-icon` (minimum 144 px).
- A build with a different value: `brand.json` set to "Tablo", "A test build: two phones, one table.", `https://tablo.example/`, then `BASE_PATH=/play/ pnpm build`. The manifest's name and short_name were "Tablo"; the title, `description`, `og:title`, `og:description` and the splash showed the new values; `og:url` was `https://tablo.example/play/` and `og:image` `https://tablo.example/play/preview.png`; `grep -r -E 'Bezel|MobileGameConnect' apps/pwa/dist` found nothing. Served at `/play/` in two tabs: the bar read "Tablo PCUE 2 phones · Row Hide", the strip "Tablo" over "PCUE", "Phone 2 of 2". Then `brand.json` was restored and the app rebuilt; no "Tablo" left.
- Browser smoke, headless Chrome at 390×844:
  - Loading state on the build, with the script bundle held back: `#hud` was the splash, fixed over the whole screen on the ground colour (rgb 18, 18, 18): "Bezel" large and bold, the pitch in grey under it, a pulsing dot (animation `alive`, `none` under prefers-reduced-motion). After the bundle was released `#hud` became the sheet and the splash was gone. With scripts off (dev server) the page shows the same splash and the title "Bezel".
  - First phone (dev server): the bar read "Bezel VHGN 1 phone · Row Hide", then "2 phones" once a second tab joined; tab title "Bezel".
  - Second tab with `?room=VHGN`: the strip read "Bezel" over "VHGN", "● Phone 2 of 2", "right of phone 1 · Player 2 …"; tab title "Bezel".
- `grep -rn -E 'Bezel|MobileGameConnect|\bMGC\b' apps/pwa/src apps/pwa/index.html apps/pwa/public`: only a doc comment in `hud.ts` (the example address `manubown.github.io/Bezel`), which no player sees.

**Not verified**
- On phones: Android's install offer, label and maskable icon under a real launcher's mask; the iPhone's Add to Home Screen icon and label.
- How chat apps render the preview: `og:image` is fetched from the public address, so it shows only once a build with this change is published.
- iOS still ignores `display: fullscreen` (audit F16, F17); not in this ticket.

**For the next tickets**
- 08: the manifest's colours and `theme-color` follow `--bg` through `groundOf` in `apps/pwa/brand.ts`, which reads `index.html`; if the tokens move to a CSS file, `groundOf` must follow. If the ground changes from `#121212`, redraw the PNGs from the SVGs (same method). The name is `.brand` (bar, strip) and `.splash-name`; the display face goes there.
- 12: the site imports `brand.json` from the workspace root. Each app build's preview tags already point at its own base (`play/`, `next/`).
- 15: the README title still says "MobileGameConnect".
