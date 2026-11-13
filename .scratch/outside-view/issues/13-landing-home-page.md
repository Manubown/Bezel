# 13: The home page: see it, start a table, join one, install it

**What to build:** The site's home page shows phones becoming one table within the first screen and is the shortest way into the app: Start a table, a join-by-code field, the two Games, why and how to install, what it works on and where it does not, and a door for people who want to build a Game (spec D17). Read the `impeccable` skill before designing.

**Blocked by:** 08, 12

**Status:** resolved

- [x] First screen at 390×844: the name, one sentence, a looping drawn illustration of two phones with a ball crossing the gap, and Start a table
- [x] Start a table opens the app for everyone; the join field takes a four-character code and opens the app for everyone joined to that table; a malformed code is refused in words
- [x] Three steps in the words players read ("table", "first phone")
- [x] The two Games are listed from their Manifests (name, Players, arrangement), not typed by hand
- [x] An install section says what installing gives (full screen, no browser bars) and the steps for iPhone and Android
- [x] "Works on" and "known limits" say: iPhone and Android in a current Safari or Chrome; an iPhone hotspot often fails, use the same Wi-Fi or mobile data on every phone; every phone needs internet to join
- [x] One paragraph for developers with a link to the repository's Game guide
- [x] Inside another app's browser the page says to open it in Safari or Chrome
- [x] The page uses the app's tokens and display face (ticket 08); the face is served from the site's own origin
- [x] Preview tags, a description and a sitemap are present; the footer links privacy, imprint and the repository
- [x] With scripts off the page reads completely; only the forwards, the join field and the illustration need script
- [x] The illustration stops for a visitor who prefers reduced motion
- [x] Browser check at 390×844, 360×780 and a laptop width, screenshots in a comment; text contrast meets WCAG 2.2

## Comments

### 2026-11-13, Ticket13LandingHome (implementation)

**Changed**
- `apps/site/src/layouts/Page.astro` (new): the layout every page of the site can share. It takes `title?` and `description`, a `first` slot right after `<meta charset>` (the home page's forwards go there), a `head` slot, then the page and, below it, the footer of ticket 14 (`components/Footer.astro`) in the page's column. The head carries the look's `tokens.css`, the site's base sheet (`src/styles/site.css`), a preload of the display face, `theme-color` read from the `--bg` token (`groundOf`), canonical, description, the app's icons and its 1200×630 preview picture as `og:image`, `og:*` and `twitter:card`, and `<link rel="sitemap">`. The face, icons and picture are imported from `@mgc/look` and `@mgc/pwa`, so the build serves them from the site's origin under hashed names: the preload and the `@font-face` name the same `_astro/unbounded-600.*.woff2`. The legal pages still use ticket 14's `layouts/Legal.astro`, which keeps its styles inside `.legal` so it can be wrapped in this layout.
- `apps/site/src/pages/index.astro`: the home page. The forwards' inline script is unchanged and first in the head. First screen: the name, `brand.json`'s pitch, the drawing, Start a table (`play/`), and "Or join a table with its code" (a GET form to `play/` with a `room` field). Then three steps ("One phone starts a table", "The other phones join", "Lay them down", in the words of `GLOSSARY.md`), the Games, "Add Bezel to your home screen", Works on, Known limits, Build a game, the footer. Inside another app's browser a banner at the top says "Open this page in Safari or Chrome" and why.
- `apps/site/src/components/Crossing.astro` (new): the drawing, inline SVG in token colours. Two phones lie side by side, with a coral paddle and score 3 on the left one and a teal paddle and score 2 on the right; the scores are in the display face at 80 %, as Pong draws them (ticket 09). The ball and a short trail run a 3.6 s Pong rally: they cross the gap on one straight line and bounce off the bottom wall, each paddle is where the ball arrives when it arrives, and the speed across the phones is constant. As written in the HTML it is a still: the ball halfway across the gap, as in the icon, with its trail on the coral side. The script sets it moving unless the visitor prefers reduced motion, follows a change of that setting, offers Pause / Play ("Pause the drawing"), and stops it while it is off screen. `components/Phones.astro` (new): the small drawings beside the steps and the Games, all at one scale.
- `apps/site/src/games.ts` (new, pure): `homeGames(manifests)` is the list the first phone shows players (`gameList`), in its order. For each Game: name, the app's card line (`cardLine`: "2 players · phones in a row"), how many phones with the other arrangements the Manifest names ("Up to 2 phones; they can also lie in a row"), whether a bot can stand in, and what the drawing shows (first arrangement, at most three phones). The page reads the Manifests from the app's `GAMES` at build time.
- `apps/site/src/join.ts` (new, pure): `joinTable(typed, play)` reads the code with the app's `tableCode` and opens `play/?room=CODE`. A code that is not `CODE_LENGTH` letters or digits is refused: "REZ is not a table code: a code has four letters or digits. Check it on the first phone.", and an empty field gets "Type the table’s code: the four letters or digits the first phone shows." `apps/pwa/src/othertable.ts` now exports `CODE_LENGTH = 4`, which `main.ts` uses to make the code.
- Shared with the app, not copied: `@mgc/pwa` has an `exports` map (`games`, `gamelist`, `install`, `join`, `lobby`, `othertable`, `public/*`), and the site depends on `@mgc/pwa` and `@mgc/look` (`workspace:*`). The install section's headline, reason and steps for iPhone or iPad in Safari, iPhone or iPad in Chrome, and Android are what `installOffer` gives each platform after a first Match. The banner is its in-app `banner`, shown when `inAppBrowser(navigator.userAgent)` names an app. The first known limit is `HOTSPOT` from `join.ts` (now exported), the help card's own sentence.
- `apps/site/sitemap.ts` (new): an Astro integration in `astro.config.ts` writes `sitemap.xml` after the build. It lists every page the build wrote except those marked `noindex` (the old `stable/` forward), so it holds the home page, the imprint and the privacy page.
- `apps/site/test/`: `games.test.ts` (4 tests), `join.test.ts` (4), `look.test.ts` (3): no colour is spelled in the site's pages, layouts, components or style sheets, no `var(--…)` is used that neither the look nor the site's sheet defines, and the layout takes the tokens and preloads the face from `@mgc/look`.
- `docs/architecture.md`: a "Where a change goes" row for the home page and what it takes from the app.

**Decisions**
- The site imports the app's own modules through `@mgc/pwa`'s `exports` instead of moving them into a package. They are pure, and the site imports them at build time (`games`, `gamelist`, `lobby`, `join`) or bundles two small ones into its page script (`othertable`, `install`: 1.3 kB inline). If a module behind one of these exports starts touching the DOM at import, the site's build breaks, and that is the signal to move it.
- The illustration is SVG and CSS animation, not canvas. It reads as a still with scripts off. The script only switches the motion on, so a visitor who prefers reduced motion never sees it move, and Pause covers WCAG 2.2.2 for a loop longer than 5 s. The ball is drawn over the gap, as in the icon and the preview picture: the brand's own picture of "crossing the gap".
- Works on: the box's sentence, "iPhone and Android phones, in a current Safari or Chrome", followed by what the records show was run (`.scratch/live-test-1/findings.md` line 4 and §1d, user agents in `docs/liveLogs/`): "iPhone 12, iPhone 14 and iPhone 15 Pro Max in Safari, and Android phones, one of them in Firefox". The records name no Chrome on a phone, so the page does not claim one was tested.
- Known limits (`docs/research/README.md`): the hotspot sentence, the internet to join (no offline play yet), and the screen size estimated by the browser (`device.ts`; findings §3).
- The in-app banner needs script (a static page reads no user agent). With scripts off, the install section carries the same words as a sentence.
- The Games block shows name, card line, phones, arrangements and bots, all from the Manifests. No hand-written blurb per Game.
- The join field is a plain GET form, so with scripts off it still opens `play/?room=…` and the app upper-cases the code. The script adds the app's code rule and the refusal in words. It has no `maxlength`, so a pasted "re-zv" still reads REZV and a five-character code is refused in words instead of being cut.
- No design files written: the repository has no PRODUCT.md or DESIGN.md, and the direction is pinned by the brief (D15, D17, the audit's §3 A). The impeccable detector found nothing on the changed files.
- A finish review (impeccable's reviewer, on screenshots at the three widths) returned eight fixes; all are in. The rally bent at the gap; the pitch broke "side by / side"; step 3 assumed a game was picked; the hover used a `color-mix` and nothing showed a press (now `:active` states in tokens, and no tap flash); the small drawings came at three scales; each Game named its arrangement twice; Pause had no name saying what it pauses; the copy needed wording. Of its two "ceiling" notes the scores are in; a court drawn through both screens is not.

**Verified**
- `pnpm vitest run apps/site/test`: 5 files, 15 tests passed (with ticket 14's two).
- `pnpm typecheck && pnpm test`: typecheck clean; 44 files, 344 tests passed. Again after merging `outside-view` (ticket 09 landed): typecheck clean, 44 files, 357 tests passed, and `pnpm pages --here` passed as below.
- `pnpm pages --here` (Node 22.23.5): `astro check` 0 errors over 22 files; "pages: apps/site/dist holds the site, play/ (this checkout) and next/; every link resolves, every forward keeps its query". `dist/sitemap.xml` lists `/Bezel/`, `/Bezel/imprint/`, `/Bezel/privacy/`.
- Built `index.html`: the forwards' inline script comes right after `<meta charset>`, as before. Only two other scripts follow, both `type="module"`: the drawing's and the page's (banner, join field).
- Headless Chrome against `pnpm --filter @mgc/site preview` (the output of `pnpm pages --here`):
  - 390×844 first screen: name in Unbounded (`document.fonts.check` true), the sentence, the two phones with the ball moving, Pause, Start a table, the join field.
  - 360×780 first screen: the same, with the join field ending at 694 px. No horizontal overflow at 360, 390 and 1280.
  - 1280×800: name, sentence and both actions on the left, the drawing on the right. Steps in three columns, Games in two, the install steps in three, Works on beside Known limits.
  - Start a table opened `/Bezel/play/` (the app, titled Bezel). "rez" and Enter gave the refusal in amber, `aria-invalid`, and the URL unchanged. An empty field gave the empty-field sentence. Typing cleared the refusal. " re-zv " and Enter opened `/Bezel/play/?room=REZV`.
  - Pause stopped the animations (`playState` paused, transform unchanged over 800 ms), Play resumed them, and scrolled off screen they paused.
  - With `prefers-reduced-motion: reduce` there were no animations at all (`document.getAnimations()` empty), Pause was hidden, and the still showed the ball in the gap.
  - With an Instagram iPhone user agent the banner showed at the top.
  - With JavaScript disabled `main` read completely: every section, the install steps, the in-app sentence, Works on, Known limits, the developer paragraph. The banner and Pause stayed hidden, and the drawing stood still.
  - The footer links Privacy (`/Bezel/privacy/`, which opened), Imprint and Source code (the repository).
  - Screenshots looked at, not committed.
- Contrast, by `contrast()` of `@mgc/look` on the tokens: text `--fg` on `--bg` 17.26:1, `--fg-2` on `--bg` 7.99:1 (secondary text, labels, placeholder, Pause), `--bg` on `--fg` 17.26:1 (Start a table), `--fg` on `--raise` 15.70:1 and `--fg-2` on `--raise` 7.26:1 (Join, the banner), `--warn` on `--bg` 10.50:1 (the refusal). Borders `--line` on `--bg` 3.88:1, the paddles 6.98:1 and 9.08:1.

**Not verified**
- On phones: the page in Safari and Chrome, an in-app browser's real user agent, the safe areas, the display face arriving within `font-display: optional`'s window on a slow network.
- The link preview as a chat app renders it, and a search engine reading the sitemap.
- The legal pages still wear ticket 14's own shell (light or dark by the system). Wrapping `layouts/Legal.astro` in `layouts/Page.astro` gives them the look, the face and the preview tags; that is left to whoever owns those pages next.
