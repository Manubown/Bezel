# Getting started

From a fresh clone to Pong on two phones, then to your own Game in the Host's list.

## Prerequisites

| Tool | Version | Where it is pinned |
|---|---|---|
| Node | 22 (what CI runs) | `.github/workflows/pages.yml:35` |
| pnpm | 10.33.0 (`corepack enable` picks it up) | `package.json:6` |
| Phones | any with a current browser, on the same Wi-Fi as your computer, with internet | [Running on phones](running-on-phones.md#network) |

## Clone, install, check

```sh
git clone https://github.com/Manubown/Bezel.git
cd Bezel
pnpm install
pnpm test        # vitest over packages/, games/, apps/ (vitest.config.ts)
pnpm typecheck   # tsc in every workspace package (pnpm -r exec tsc -p .)
```

The workspace is `apps/*`, `packages/*` and `games/*` (`pnpm-workspace.yaml`). TypeScript runs `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (`tsconfig.base.json`).

## Run the dev server

```sh
pnpm dev
```

This is Vite (`pnpm --filter @mgc/pwa dev`) on port 5173, over HTTPS with a self-signed certificate, listening on the LAN (`apps/pwa/vite.config.ts`). Vite prints a `Local` and a `Network` address; phones use the `Network` one (`https://<your-LAN-ip>:5173/`). For another port: `pnpm --filter @mgc/pwa dev --port 5181`.

## Open it on phones

1. On the phone that will be the **Host**, open the `Network` address. The browser warns about the certificate: accept it once. The Host's sheet shows a 4-letter code and a QR code.
2. On every other phone (a **Peer**), either scan the QR code, or open the same address and type the code into the "Code" field of the sheet and press Join. Opening `https://<your-LAN-ip>:5173/?room=CODE` directly does the same. Each phone accepts the certificate once.
3. Open the Host page by its LAN address, not `localhost`: the QR code encodes the Host page's own URL with `?room=CODE` (and `&noturn` when the Host's address has it; `apps/pwa/src/hud.ts:127-129`), and the other phones cannot reach `localhost`.

A Peer's top strip goes "Finding table CODE…" → "Connecting…" → "Phone 2 of 2" (the makers' words, "syncing clocks", and the clock figures beside them in [Maker mode](running-on-phones.md#connectivity-flags), `?maker`); a phone not in after 15 s gets a card that says what to check. Details, every control of the Host's sheet, and what can go wrong: [Running on phones](running-on-phones.md).

## Start Pong

1. Lay the phones side by side in a row, in the order the Host's roster lists them ("1 This phone", "2 …"). Change the order with ◀ ▶ on a roster row.
2. In the sheet's Game cards, tap **Pong** ("2 players · phones in a row"). Players see Pong, then Air Hockey; in [Maker mode](running-on-phones.md#connectivity-flags) every Game, sorted by name (`apps/pwa/src/gamelist.ts`). Pong is picked until the Host picks another; the Host's last pick is picked again, kept with its lobby across a reload of the Host's page (`sessionStorage` `mgc.lobby.<CODE>`), when the list has it.
3. The arrangement follows the Game: Pong's manifest says `templates: ['row']`, so the phones lie in a row and the sheet offers no other.
4. Players: P1 sits at the first phone, P2 at the last. With a single phone, press P2's **Bot** chip.
5. Press **Start Pong**. If the lobby refuses, the reason shows under the button ([the messages](troubleshooting.md#start-is-refused)).
6. Each human touches their own outer phone to start ("<name>, touch to start"), then drags to move their paddle. First to 7 wins; the result card shows on every phone.

No phones at hand: open the dev server in several browser windows on one computer, the Host at `https://localhost:5173/` and each Peer at `https://localhost:5173/?room=CODE`. Each tab gets its own Device id ([several tabs](running-on-phones.md#several-tabs-on-one-computer)).

## Make your own Game

```sh
pnpm new-game <slug> "<Name>"        # e.g. pnpm new-game tap-race "Tap Race"
pnpm install --no-frozen-lockfile    # links @mgc/sdk into the new package
pnpm vitest run games/<slug>         # its test runs over createTestMatch
pnpm exec tsc -p games/<slug>        # typecheck the Game alone
pnpm dev                             # the Host's Game cards show "<Name>" with ?maker
```

- `scripts/new-game.mjs` copies `games/_template` to `games/<slug>` and rewrites the package name (`@mgc/<slug>`), the manifest `id` (`mgc.<slug>`) and `name`, `TemplateState`/`TemplateMessage`/`TEMPLATE` (`<Pascal>State`, `<Pascal>Message`, `<CONSTANT>`), and renames the test to `test/<slug>.test.ts`.
- The slug is lowercase letters, digits and dashes, starting with a letter (`scripts/new-game.mjs:8`). Without a `"<Name>"` the name is the slug's words capitalised (`tap-race` → `Tap Race`, line 13).
- Use `--no-frozen-lockfile`: the new package changes `pnpm-lock.yaml`, and a plain `pnpm install` refuses that when the `CI` environment variable is set ([troubleshooting](troubleshooting.md#pnpm-install-refuses-the-lockfile-after-pnpm-new-game)).
- Nothing to register: in Maker mode (`?maker` on the Host's address) the PWA lists every `games/*/src/index.ts` that default-exports a Game, except `games/_template`, sorted by name (`apps/pwa/src/games.ts:8-15`). Players see only Pong and Air Hockey: that list is the platform's (`apps/pwa/src/gamelist.ts`), not a manifest field. If the dev server was running, reload the page; restart `pnpm dev` if the Game still does not show.

Then edit `games/<slug>/src/index.ts`. The template's comments explain each hook; [Concepts](concepts.md) explains the model and [Testing](testing.md) the test.
