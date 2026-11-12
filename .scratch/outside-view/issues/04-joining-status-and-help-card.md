# 04: A phone that is joining says so in plain words, and gets help after 15 seconds

**What to build:** A joining phone reads "Finding table REZV…", "Connecting…", "Lost the table. Reconnecting…". After 15 seconds without getting in it shows a help card: check the code on the first phone, keep that phone's screen on, an iPhone hotspot often fails so use the same Wi-Fi or mobile data on every phone, with Try again and a field to correct the code. The first phone gets the same advice when one phone keeps dropping (spec D7).

**Blocked by:** 01

**Status:** resolved

- [x] What a joining phone says is one pure function of the Session's status, the time since the page tried to join and whether it has ever been in; unit tests cover each status before and after 15 s, and a phone that was in and lost the table
- [x] A wrong code shows the card after 15 s; the code field on the card joins the corrected table
- [x] Try again reloads the join for the same code
- [x] The card goes away by itself when the phone gets in
- [x] A phone that joins while a Match runs reads that it joins the next one, in plain words
- [x] A phone that was the lost one reads "You're back" while the Match resumes, never the notice about itself
- [x] The first phone shows the advice line once it has seen one phone's connection end three times in a row without lasting
- [x] With Maker mode on, the makers' wording and figures are still available beside the plain words
- [x] Browser smoke: a wrong code; a first phone closed while a second is joined (card on the second after 15 s)
- [x] The troubleshooting guide's entries quote the new words

## Comments

### 2026-11-12, Ticket04JoinHelp (implementation)

**Changed**
- `apps/pwa/src/join.ts` (new, pure): `describeJoin({ code, status, waited, wasIn })` gives the strip's line, the line under it, the makers' words and, once `waited` reaches `HELP_AFTER_MS` (15 s), the help card's headline and advice; `undefined` once `ready`. `joinAddress(href, typed)` is the card's code field. `Dropouts` counts, per phone, connections in a row that ended within 15 s of coming in, fed the Host's roster; `describeDropping` is the first phone's advice line.
- `apps/pwa/src/hud/strip.ts`: the joining states come from `describeJoin`; the help card (Try again, the code field, prefilled) over the lobby; "A match is on · you join the next one"; "You’re in · waiting for the first phone". In Maker mode the second line holds the makers' words and the clock figures.
- `apps/pwa/src/hud/advice.ts` (new): the first phone's advice line, heading its sheet; wired in `hud.ts`.
- `apps/pwa/src/pause.ts`: `describePause(…, self)` reads "You’re back · the match goes on in a moment" when the pause names this Device; `main.ts` passes it. `rejoin.ts` `RECONNECTING` headline: "Lost the table. Reconnecting…".
- `packages/core/src/index.ts` exports `RELAY_STABLE_MS`. `apps/pwa/index.html`: `.help`, `.sheet .advice`.
- Guide: the strip table, the help card, the advice line row of the sheet, the Peer's pause words and Maker mode in `running-on-phones.md`; the joining, reconnecting and hotspot-loop entries of `troubleshooting.md` (the reconnecting heading's anchor is now `#lost-the-table-reconnecting-on-a-peer`, both links follow it); `getting-started.md`; the overlay paragraph of `docs/platform-design.md`.

**Decisions**
- The time since the page tried to join starts again when a phone that was in loses the table; otherwise a phone that played for an hour would get the card the moment it dropped.
- Whether it was ever in picks the line: never in, "Connecting…" stays through the `syncing` ↔ `reconnecting` cycles of a dying direct path (one line for the hotspot loop, not two that alternate); was in, "Lost the table. Reconnecting…" whatever the attempts in between. The card's headline follows the case ("Table CODE not found yet", "Still connecting to table CODE", "Still reconnecting to table CODE"); its advice is the same in every case.
- Try again reloads the page: a fresh transport and a fresh 15 s. The code field keeps the address's other flags as written (`maker`, `noturn`); the sheet's own join form still drops them (ticket 03's).
- No card over a running Match: the reconnect notice speaks there, and when its 30 s grace ends the phone is in the lobby, where the card shows.
- The first phone's count: what the Host already knows is the transport's measure, a connection that ended within `RELAY_STABLE_MS` (15 s) of coming up, used for the own-address fail-safe and the relay escalation. Its count cannot serve: it counts every connection together, keyed by the transport's ids that the Session keeps to itself, and stops at the first (`WITHHOLD_AFTER = 1`, sticky; `onWithhold` fires once). So `Dropouts` counts per Device from the Host's roster with the same measure, `RELAY_STABLE_MS` now exported from `@mgc/core`. The line goes once that phone's connection has lasted 15 s.
- The line names the phone as the roster does (its platform name, "A phone" when there is none). It heads the sheet (`hud/advice.ts` puts it first in the HUD root) so it shows folded or open and never covers the bar; `hud/sheet.ts` is untouched. Hidden while a Match runs: the pause card says who it waits for.
- A Match is "match" for players here as on the pause cards and "End match".
- The strip's placed line keeps ticket 05's `placementHint` as it is.

**Verified**
- `pnpm vitest run apps/pwa/test/join.test.ts`: 12 tests passed. `pnpm vitest run apps/pwa/test/pause.test.ts`: 3 passed.
- After merging `outside-view` (02, 05, 07): `pnpm typecheck` printed no errors; `pnpm test`: 34 files, 263 tests passed.
- Browser, two or three headless Chrome tabs at 390×844 on the dev server (port 5204), each with its own profile:
  - Wrong code (`?room=ZZZZ`): "Finding table ZZZZ… · keep the first phone’s screen on"; at 16.0 s of page time the card "Table ZZZZ not found yet", both advice lines, Try again, the field holding ZZZZ. Typed the first phone's code in lower case and pressed Join: the address became `?room=PT2K`, the strip went "Finding table PT2K…" → "Connecting…" → "Phone 2 of 2" within 6 s, no card.
  - Try again (`?room=ZZZZ&maker`, card up): same address, navigation type `reload`, card hidden, "Finding table ZZZZ…" again.
  - First phone's page closed (navigated away) while the second was in: "Lost the table. Reconnecting…" at once, the card "Still reconnecting to table PT2K" 15.2 s later by the page's clock. The first phone reopened under its code: the second was `ready` 2 s later and the card went by itself.
  - Advice: the second phone's `__mgc.transport.reset()` three times, about 4.5 s apart. The first phone's line stayed hidden after the first and second loss and showed at the third, heading the sheet above its bar: "A phone keeps losing its connection. An iPhone hotspot often fails: use the same Wi-Fi on every phone, or mobile data on every phone." (headless Chrome reports no platform name, hence "A phone"); with `?maker` it ends "· 3 connections in a row ended within 15 s". It went 15 s after the phone's connection came back and held (shown 11.1 s, back 11.8 s, gone 26.8 s).
  - A Pong Match on two phones, a third phone joining: "A match is on · you join the next one".
  - The second phone's connection reset during that Match: its pause card read "Lost the table. Reconnecting… · the match goes on when the connection is back", then "You’re back · the match goes on in a moment" from 0.75 s until the resume at 1.44 s; the first phone meanwhile "Waiting for Player 2 · Phone 2 lost its connection · the match goes on when it is back". Between the two, for 1 ms, the Peer's card was empty (its `hello`, before the Host's pause arrived).
  - Maker mode on a joining phone: "Finding table ZZZZ…" over "looking for the host · —" and the Log button.

**Not verified**
- Anything on phones: the card on an iPhone (a 16 px field should not zoom), the safe areas, the advice line's name on real phones ("iPhone", "Android" from the platform; two phones of one platform read alike).
- A real hotspot loop: the advice line rests on the Host's roster seeing each dying attempt bind and drop, as the live runs' Host logs show (a `peer-join` and a `peer-leave` about 4 s apart).

**For the next tickets**
- 08 (night table): `.help .help-retry` fills with `var(--ok)`, `.sheet .advice` underlines with `var(--wait)`, the strip's joining dot is `wait`/`off`; the mapping to 08's tokens is agreed with that ticket.
- 03 (first screen): `join.ts` `joinAddress` builds a join address that keeps the flags, if the folded join form wants it.
