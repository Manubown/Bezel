# Competition, audience and the name

Researched 2026-11-11 for the makers' roadmap decision. Every price, count and availability below was checked on that date unless a row says otherwise. Capitalised project words (Session, Device, Host, Peer, Tile, Controller, Match, Game, Relay) mean what [GLOSSARY.md](../../GLOSSARY.md) says.

**What I could and could not query.** Queried: the web pages and press releases linked inline; Apple's iTunes Search API (US and German stores); Google Play listing and search pages; [TMview](https://www.tmdn.org/tmview/) (the EU's trademark aggregator, which includes EUIPO, DPMA, the Austrian and Swiss offices, WIPO, USPTO and UKIPO); registry RDAP/WHOIS for domains; Porkbun's public domain price API; the GitHub API; public TikTok and YouTube profile pages. Not queried: EUIPO eSearch and DPMAregister directly (TMview instead), Instagram and X handles (login wall), paid market data (Statista, Sensor Tower). Nothing here is legal advice: the trademark and privacy parts say what the registers and the authorities say, not what a court would decide. `[INFERENCE]` marks my own conclusions.

## Bottom line

- **The idea pulls strangers, but you are no longer alone.** [BIGBOARD.GAMES](https://bigboard.games/about) went live on 2026-10-05 with the same pitch: browser, no install, iPhone + Android, 2–4 devices edge to edge become one board, Air Hockey. It has 13 games in 8 languages (German included), and its [Reddit video post](https://www.reddit.com/r/SideProject/comments/1xi2k1m/i_built_free_browser_games_where_phones_pushed/) got 2,358 upvotes and 261 comments. This week: play it on two phones for 30 minutes and write down where you are better and worse. Cost €0.
- **The gap left is yours: open source, an SDK for other people's Games, no server at all, and Tiles plus private Controllers in one Match.** BIGBOARD ships obfuscated closed code; Racer and Swip.js are dead demos; Dual! is a closed native app.
- **First public segment: hobby developers who want to build Tile games. Your friends at a table stay the test bed, not the market yet.** No consumer push (TikTok campaign, Kickstarter, café tour) until a Peer gets in on the first try in at least 9 of 10 joins on the networks your testers actually use. Consumers who compare will find a polished free rival; developers have nowhere else to go `[INFERENCE]`.
- **The mechanic sells, the money comes slowly.** Dual! (two phones, a ball crossing the gap) has 10M+ Google Play downloads and is still updated in 2026. Spaceteam reached 800,000 downloads in its first year by word of mouth, and made about $12,000 from in-app purchases in that year. Plan for no meaningful revenue in 2027 unless you find an institutional buyer: AirConsole's money came from car makers, Kahoot's from schools and companies.
- **Measure before you market: half a day of work, €0.** Add cookieless counting with custom events (Session opened, Device joined direct/Relay, join gave up, Match started/finished) via GoatCounter (free, EU-hosted) or Umami Cloud Hobby (free up to 100,000 events a month); Plausible ($9/month) is the polished paid option. Add a 👍/👎 "Did it work?" tap at the end of a Match: data the player sends on purpose is the cleanest under German law.
- **Ask people too:** a five-question Tally form (free, data stored in the EU) behind a QR code on the table at every test evening. Target: 30 answers in four weeks.
- **Don't make "Bezel" the public name.** It collides with a funded US watch marketplace (US trademark including class 9), a Dutch Mac app that mirrors phone screens, a browser game launched in 2026 at bezelgame.com, and Nintendo's registered "Bezel Engine" for game software; bezel.com/.app/.de/.io/.gg/.games are taken; a search for "bezel" returns watches. Keep it as the repo codename and pick a public name before the landing page: one evening of checks, about $12 a year for a domain, €290 if you later file a German trademark (up to three classes).
- **Today the product has three names:** the page title and the home-screen icon say "MobileGameConnect"/"MGC" ([manifest](../../apps/pwa/public/manifest.webmanifest), [index.html](../../apps/pwa/index.html)), the URL and repo say "Bezel". A stranger who asks "what's it called?" gets three answers. Fix it together with the new name, not before.
- **Skip for now:** paid market reports, a paid trademark search (only after a name survives your own checks), bars/cafés and corporate events as segments (guest Wi-Fi and Relay costs), and any race with BIGBOARD on the number of games.

## 1. Comparable products

### 1.1 Overview

"One playfield" means the screens show parts of one shared world, so an object leaves one screen and enters the next.

| Product (start) | What it is | Platform, how devices connect | One playfield? | Money | Traction (as published) | Alive 2026-11-11? | Lesson for this project |
|---|---|---|---|---|---|---|---|
| [BIGBOARD.GAMES](https://bigboard.games/about) (2026) | 13 free games, 2–4 phones/tablets edge to edge | Web PWA; WebRTC direct, Cloudflare TURN fallback, a Cloudflare Worker for tables and same-Wi-Fi discovery | Yes | Free; no model stated | Reddit post 2,358 upvotes, 261 comments; TikTok @bigboard.games 6 followers, 19 videos | Yes, live since 2026-10-05 | The direct competitor and the benchmark |
| [Dual!](https://seabaa.com/dual/) (Seabaa, 2015) | Two-phone shooter, bullets cross screens | Native iOS + Android; Wi-Fi or Bluetooth, cross-platform | Yes, 2 phones | Free, ads + in-app purchases | [Google Play](https://play.google.com/store/apps/details?id=com.Seabaa.Dual) 10M+ downloads; [App Store](https://apps.apple.com/us/app/dual!/id918902604) 2,419 ratings, 4.1 | Yes, Android update Sep 2026 | The "crossing" mechanic has mass appeal |
| [Racer](https://experiments.withgoogle.com/racer) (Google, 2013) | Slot-car track over up to 5 phones/tablets | Web (Chrome); WebSockets through a Google Compute Engine relay ([case study](https://web.dev/case-studies/racer)) | Yes | Free; marketing for Chrome | Launched at Google I/O 2013 | Page still online; multiplayer not tested | A brilliant demo, no product behind it |
| [Swip.js](https://github.com/paulsonnentag/swip) (2016) | Library: pinch across edges to join screens | Web library | Yes | Open source | 2,091 GitHub stars | Last commit 2017-06-25 | Developers love the idea; a library without Games stalls |
| [Junkyard Jumbotron](https://github.com/mitmedialab/Junkyard-Jumbotron) (MIT, 2011) | One photo of many screens makes one display | Web + server | Yes (images, not games) | Research, open source | 247 GitHub stars | Last commit 2013-08-28 | Camera-based layout is possible |
| [Spaceteam](https://en.wikipedia.org/wiki/Spaceteam) (2012) | Co-op shouting game; each phone a control panel | Native; Wi-Fi (Bluetooth earlier) | No | Free + six $1 in-app "tip jar" items; Patreon; Kickstarter | ["over 10 million downloads"](https://spaceteamadmirals.club/); Google Play 1M+ | Yes, Android update Nov 2026 | Word of mouth works; joining is the chronic complaint |
| [Jackbox Party Pack](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack) (2014) | Party games on a TV; phones join at jackbox.tv | Console/PC/TV app + any browser; Jackbox servers | No | Paid packs; [Pack 12](https://store.steampowered.com/app/4199960/) €30.49 on Steam DE; only the host buys | 200 million players by Oct 2020 | Yes | "Only the host pays, everyone joins in a browser" |
| [AirConsole](https://www.airconsole.com/hero) (N-Dream, 2015) | Phones as controllers for a TV, PC or car screen | Browser screen + phone app or web | No | [Hero](https://www.airconsole.com/hero) $4.99/month or $23.99/year (page defaults); car-maker deals | Google Play 10M+; KPIT took ~90 % in [Oct 2025](https://finance.yahoo.com/news/kpit-acquires-n-dream-company-110000273.html) | Yes, now car-focused | The money was B2B (cars) |
| [Kahoot!](https://kahoot.com/company/) (2013) | Quiz on a shared screen, phones answer | Web + apps; servers | No | Freemium for schools and companies | 14 billion cumulative participants; 10 million teachers in 12 months | Yes; delisted 2024 after a buyout | Classrooms and offices are where "phones in a room" pays |
| [Fingle / Bounden](https://web.archive.org/web/20210826073608/https://www.gamasutra.com/blogs/AdriaanDeJongh/20150527/244437/Closing_Game_Oven_numbers_and_struggles.php) (Game Oven, 2012/2014) | Two people on one iPad / one phone | Native | No | Paid apps | Fingle iOS €104,767; Bounden iOS €26,216 (17,500 downloads) | Studio closed Apr 2015 | Acclaim ≠ income for local-play games |
| [ScreenSpan](https://xdaforums.com/t/closed-app-11-screenspan-a-foldable-phone-made-from-the-phones-you-already-have-multi-phone-screen-wi-fi-direct-no-root.4802781/) (Sep 2026) | Any Android app spread over several Android phones | Native Android; Wi-Fi Direct; one-time wireless-debugging pairing | Yes (any app) | Free 15 min/day, then subscription | Maker tested 3 phones; XDA thread closed (paid app) | New | Generic screen-joining exists, but Android-only and fiddly |
| [Chirp Pong](https://tools.simonwillison.net/chirp-pong) (Oct 2026) | Two-phone Pong, ball sent as an audible chirp | Web; speaker + microphone, no network | Yes, 2 phones | Free hobby tool | AI-built in [one commit](https://tools.simonwillison.net/colophon) on 2026-10-15 | Yes | A two-phone Pong is now a one-evening build |
| [Hitster](https://kulturgutspiel.de/wirtschaft/umsatztreiber-brettspiele-spiele-und-puzzles-wachsen-staerker-als-gesamter-spielwarenmarkt) (Jumbo, 2021) | Music card game; a phone app plays the songs | Physical box + app | No | Retail box | ~3.5 million copies, >1 million in Germany | Yes | Phone + table hybrids sell in German retail |
| [screens.gg](https://screens.gg/) (2026 or earlier) | "One screen for the board, everyone's phones as controllers" | Web | No | Not stated | Not published | Yes | Another browser Jackbox |
| [MotionPhone](https://www.snibbe.com/apps/motionphone-app) (Snibbe, 2012) | Shared animated canvas for up to 5 devices | iOS; Game Center over local networks | No (shared, not tiled) | Not checked | Not published | Not checked | Art apps did "together on many devices" early |
| Samsung Group Play "Multi Vision" ([APKMirror](https://www.apkmirror.com/apk/samsung-electronics-co-ltd/group-play/)) (2013) | Splits a video or photo across Galaxy devices | Samsung only; touch to join (NFC) | Yes (media) | Bundled | Not published | Not found on current devices `[INFERENCE]` | A platform owner tried it and let it fade |

I could not find a Scott Snibbe app called "Pair"; MotionPhone is the closest Snibbe multi-device app.

### 1.2 The eight closest

**BIGBOARD.GAMES (live since 2026-10-05): the direct competitor.** A solo developer in Kraków ([Nikita Savchenko](https://nikitaeverywhere.com/posts/bigboard-games/)) built it from a first commit on 2026-09-26 to production on 2026-10-05; he writes that 337 of 344 commits were co-authored with an AI coding agent and that the project holds about 140,000 lines of TypeScript and 51,000 lines of tests, including a seeded network simulator. Technically it is almost this project's design: a world in millimetres including bezels and cases, NTP-style clock sync "to within about 1 ms" on a local link, WebRTC data channels with a Cloudflare TURN relay "on mobile data", a QR code or a four-letter code, plus things this project does not have: devices on the same Wi-Fi find the table by themselves, a drag-and-rotate layout editor, size calibration by holding a bank card against the screen, remote friends, a TV as "just a screen", bots in nearly every game, and pages written for search ("[2 player games on different phones](https://bigboard.games/games/how-it-works)"). Its server is one Cloudflare Worker with Durable Objects; the maker estimates "$5 a month at 1,000 device sessions a day". The code is closed and obfuscated on purpose. Its [Reddit post](https://www.reddit.com/r/SideProject/comments/1xi2k1m/i_built_free_browser_games_where_phones_pushed/) (2026-10-28, read via the Arctic Shift archive) drew 2,358 upvotes; commenters wrote "Seems so obvious, I can't believe I've never seen it before" and "My kids are going to love it". **Lesson:** the pitch converts strangers, a 20-second video of a puck crossing a seam is the ad, and speed of shipping Games is the competitor's strength. Don't fight it on Games count; differ where it can't follow (open SDK, no server).

**Dual! (Seabaa, 2015).** Two phones become "a single battlefield" where "bullets fly between screens" ([seabaa.com](https://seabaa.com/dual/)); modes Duel, Deflect and Defense; iOS and Android play together over Wi-Fi or Bluetooth. Free with ads and in-app purchases; the store text says only one person needs the full version for two modes ([store listing](https://seabaa-dual.en.aptoide.com/app)). 10M+ downloads on Google Play, 2,419 ratings on the US App Store, last Android update 2026-09-23. **Lesson:** the closest proof that "a ball crosses from my phone to yours" can reach millions; it got there as a native app in both stores, with two phones only.

**Racer (Google Creative Lab and Active Theory, 2013).** "Speed across up to five phones and tablets. No apps. No downloads" ([Experiments with Google](https://experiments.withgoogle.com/racer)). The [developers' case study](https://web.dev/case-studies/racer) describes the same problems this project solved: a common track size from mixed screens, clock offsets measured against a server (median of several polls, "within 10ms"), and correcting for message delay. Unlike this project, everything went through a relay server on Google Compute Engine. **Lesson:** 13 years ago Google proved the wow on the web; it stayed a marketing demo because nobody kept making Games for it.

**Swip.js (2016) and Junkyard Jumbotron (MIT, 2011).** Swip.js joined browser screens with a pinch across the edge and drew 2,091 GitHub stars; Junkyard Jumbotron stitched any screens into one display from a single photo (247 stars). Both stopped (last commits 2017 and 2013, via the GitHub API). **Lesson:** developers are curious about multi-screen toys, but a library with a few demos does not keep them; a platform needs Games people play.

**Spaceteam (Sleeping Beast Games, 2012).** A cooperative shouting game for 2–8 players, each phone a different control panel, iPhone and Android together over Wi-Fi ([store text via AppBrain](https://www.appbrain.com/app/spaceteam/com.sleepingbeastgames.spaceteam)). Its maker's [first-year retrospective](http://spaceteamadmirals.club/blog/spaceteam-retrospective/) reports 800,000+ downloads, "I have never paid for any advertising", about $12,000 from $1 in-app purchases plus prize money, and uses nobody planned: teachers, companies interviewing candidates, a medical school, therapists. By Nov 2015 it had made $49,700 directly ([Wikipedia](https://en.wikipedia.org/wiki/Spaceteam)); a Spaceteam card game raised $181,600 on Kickstarter. Recent Google Play reviews still read "3 android phones on same Wi-Fi none see each other" (Mar 2026). **Lesson:** a joyful local game spreads by itself and finds teachers and companies on its own; even a 13-year-old hit is still punished for joins that fail.

**Jackbox, AirConsole and Kahoot!: one big screen, phones as controllers.** This is the commercially successful inverse model. Jackbox: one person owns the game; everyone else types a room code at jackbox.tv in any browser; 100 million players in 2019, 200 million by Oct 2020 ([Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack)); a pack costs €30.49 on Steam in Germany; an ad-supported subscription ("Partyverse") is in closed beta. AirConsole sells a $4.99/month subscription to consumers but grew into cars (BMW, MINI, VW, Audi, Porsche) from 2022 and was taken over by KPIT in Oct 2025 ([press release](https://finance.yahoo.com/news/kpit-acquires-n-dream-company-110000273.html)). Kahoot! counts 14 billion cumulative participants and 10 million teachers in the past 12 months ([kahoot.com](https://kahoot.com/company/)). **Lesson:** "only the host pays" and institutional buyers are the proven money; this project can do both shapes because a Device can be a Tile or a Controller in the same Match (the Quiz and Pass Games).

**ScreenSpan (2026-09).** An Android app that renders one app on a large virtual display and streams a slice to each phone over Wi-Fi Direct; every phone is touch-enabled; the source phone needs a one-time wireless-debugging pairing; free 15 minutes a day, then a subscription ([XDA thread](https://xdaforums.com/t/closed-app-11-screenspan-a-foldable-phone-made-from-the-phones-you-already-have-multi-phone-screen-wi-fi-direct-no-root.4802781/), closed by moderators because paid apps are not allowed there). **Lesson:** "any app across phones" is possible natively, but only on Android and with setup no party guest will do.

**Chirp Pong (2026-10-15).** Two phones lie top to top; the ball leaves one screen and is "chirped" to the other through speaker and microphone, no Wi-Fi or Bluetooth ([page](https://tools.simonwillison.net/chirp-pong)). It was generated by an AI assistant from one prompt and committed in one go ([colophon](https://tools.simonwillison.net/colophon)). **Lesson:** a single two-phone game is no longer a moat; reliability across 3–5 phones, layouts, a library of Games and an SDK are.

### 1.3 What platform owners offer

- **Apple, native only.** GameKit can find "nearby players through Bluetooth or WiFi on the same subnet" ([developer docs](https://developer.apple.com/documentation/gamekit/gkmatchmaker/startbrowsingfornearbyplayers(handler:))), and SharePlay can start by holding two iPhones close together ([Apple support](https://support.apple.com/guide/iphone/start-shareplay-instantly-ipha845e253a/ios)). Both need an installed iOS app and leave Android out.
- **Nintendo GameShare (Switch 2).** One person owns the game and shares it to nearby consoles ([Nintendo](https://www.nintendo.com/us/gaming-systems/switch-2/features/gameshare)): the same "only one copy needed" idea, inside one vendor's hardware.
- **Samsung Group Play (2013)** split media across Galaxy devices joined by touch; I found no current version `[INFERENCE: discontinued]`.

### 1.4 What the comparables teach about money

| Model | Example | Published result |
|---|---|---|
| Free + small in-app "tip jar" | Spaceteam | ~$12,000 in year one; $49,700 by Nov 2015; then a $181,600 card-game Kickstarter and a [CA$83,235 patronage relaunch](https://www.kickstarter.com/projects/hengineer/spaceteam-admirals-club-relaunch/posts) |
| Paid app | Fingle, Bounden | €155,431 net from all Game Oven apps over 3.5 years; studio cost ~€6,500/month; closed |
| Free + ads + unlock | Dual! | 10M+ downloads; revenue not published |
| Paid by the host only | Jackbox | 200M players; revenue not published by the company |
| Consumer subscription, then B2B | AirConsole | Hero $4.99/month; growth and exit came from car makers |
| Free, no model yet | BIGBOARD.GAMES | Server cost estimated at ~$5/month at 1,000 device sessions a day |

`[INFERENCE]` The star topology of this project (one Host, ADR-0002) fits "only the Host pays" if money is ever needed. Nothing above suggests a crowdfunding campaign works before a fan base exists: Spaceteam's Kickstarter came three years and millions of downloads after launch.

## 2. Where the gap is

### 2.1 Side by side

| | This project | BIGBOARD.GAMES | Dual! | Jackbox |
|---|---|---|---|---|
| Install | None (PWA) | None (PWA) | App on both phones | None for players; host needs console/PC/TV app |
| iPhone + Android in one Session | Yes | Yes | Yes | Yes |
| Screens form one physical playfield | Yes, world in mm ([ADR-0005](../adr/0005-world-millimetres.md)) | Yes, mm incl. bezels and cases | Yes, 2 phones | No |
| Phones on the table and in hand in one Match | Yes: Tiles + private Controllers (Quiz, Pass) | Partly: private fleets in Sea Battle, remote players | No | Hand only |
| Games today | 7 + template ([README](../../README.md)) | 13 | 3 modes | Dozens |
| Outsiders can add Games | Yes: MIT, `@mgc/sdk`, `pnpm new-game`, [developer guide](../guide/README.md) | No (closed, obfuscated) | No | No |
| Own server needed | None: GitHub Pages, public Nostr relays, a TURN Relay | Cloudflare Worker + Durable Objects + TURN | None (local radio) | Yes |
| Same-Wi-Fi auto-join | No: QR or 4-letter code | Yes | Yes | n/a |
| Layout | Templates (row, column, grid); swipe alignment planned (M4) | Drag-and-rotate editor, bank-card calibration | Fixed | n/a |
| Works without internet | Planned (M5) | No `[INFERENCE: tables are set up on its server]` | Yes | No |
| Languages | English `[INFERENCE: README and docs; UI not audited]` | 8, incl. German | Not checked | English + some EU languages |
| Price | Free | Free | Free, ads | ~€30 per pack |

### 2.2 What only this project does

1. **An open Game SDK on a phone-tiling runtime.** Nobody else in the table lets a stranger write a Game for a multi-phone playfield and run it: BIGBOARD and Dual! are closed, Racer is gone, Swip.js stopped in 2017.
2. **No backend at all.** Signaling over public relays and a third-party TURN Relay; nothing to run, nothing to pay at small scale (one test evening used ~6 MB of Relay data). BIGBOARD needs its own Cloudflare server.
3. **Tiles and Controllers in one Match.** A Quiz board lying on the table with private answer phones in hand, or a Controller passed between Players, is a shape none of the comparables offers as a platform feature.

### 2.3 What the others do better

- **Joining.** BIGBOARD's same-Wi-Fi auto-join and Spaceteam's "no host or join" flow beat QR scanning; joining is the complaint that follows every product in this category.
- **Layout and size.** BIGBOARD's editor and bank-card calibration vs this project's templates and a browser-guessed `pxPerMm` ([PLAN.md](../PLAN.md) §7).
- **Content and pace.** BIGBOARD ships a Game every few days; Jackbox has a decade of writing.
- **Distribution.** Dual! and Spaceteam are findable in both app stores; BIGBOARD writes search pages per use case and posts videos.
- **Money.** Jackbox (host pays), AirConsole and Kahoot (institutions).

### 2.4 What follows

- Lead every public text with the three things in 2.2, not with "phones become one screen" (that sentence now belongs to whoever posted the video first).
- Close the join gap first; it decides every segment. The research reports in [docs/research](../research/README.md) already rank the options.
- Make other people's Games your Games count: one external Game is worth more than your eighth.
- `[INFERENCE]` Consider one friendly email to BIGBOARD's maker. Possible outcomes: he points developers who want to build their own to your SDK, or you learn what his telemetry shows about joins. Cost: an hour.

## 3. Audience

### 3.1 What published data says

| Finding | Figure | Source |
|---|---|---|
| People in Germany who play video games | 41.2 million; about 6 in 10 of those aged 6–69; average age 38.3; 79 % aged 18+; 46 % women | [game Jahresreport 2026](https://www.game.de/guides/jahresreport-der-deutschen-games-branche-2026/01-spielerinnen-und-spieler-in-deutschland/) |
| …of them on a smartphone / tablet | 23.7 million (the most used device) / 9.9 million | same |
| Americans who play | 212.3 million (ages 5–90); average age 37 | [ESA Essential Facts 2026](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/) |
| Parents | 75 % of US parents play; 81 % of those have played with their children; 52 % weekly | same |
| Playing with others | 70 % of US players aged 8+ play with others (2026); 55 % play with others weekly, 72 % ever did (2025) | same; [ESA 2025 release](https://www.theesa.com/annual-esa-study-reveals-video-games-universal-appeal-across-generations/) |
| Offline multiplayer as a reason to pick a game | 13 % of US adult players (price: 52 %; online multiplayer: 15 %) | [ESA 2026 booklet](https://www.theesa.com/wp-content/uploads/2026/06/2026-Essential-Facts-Booklet-05-27-26.pdf), "Most important game attributes" |
| German table-game market | Games & puzzles sales +18 % Jan–mid-Sep 2025 (all toys +4 %); party and family games in demand; 45 % single-person households, two-player games gaining | DVSI and Spieleverlage via [kulturgutspiel.de](https://kulturgutspiel.de/wirtschaft/umsatztreiber-brettspiele-spiele-und-puzzles-wachsen-staerker-als-gesamter-spielwarenmarkt) |
| Phone + table hybrid | Hitster ~3.5 million copies, >1 million in Germany | same (citing Brandora) |
| Table-game crowd in one place | SPIEL Essen 2025: 220,000 visitors, 948 exhibitors from 50 nations | [SPIEL Essen press release](https://www.spiel-essen.de/en/press?id=304&view=article) |
| Phones in classrooms and offices | Kahoot!: 14 billion cumulative participants; 10 million teachers in 12 months | [kahoot.com](https://kahoot.com/company/) |
| Phones as party controllers | Jackbox: 200 million players by Oct 2020 | [Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack) |
| Developers' interest in multi-screen web toys | Swip.js 2,091 stars; Trystero (this project's signaling library) 2,835 stars | GitHub API |
| Game jams | Global Game Jam runs in "over 800 locations"; next edition 25–31 Jan 2027 | [globalgamejam.org](https://globalgamejam.org/) |

**What I could not find:** any published survey of people who play one game on several phones lying on a table, or a breakdown of "local party games on phones" by age or setting. The market reports that name such numbers are paywalled or of unclear method, so I did not use them. The only direct evidence is anecdotal: your friends got hooked, strangers asked for the name, and BIGBOARD's Reddit commenters talk about kids, tablets at home and board-game nights.

**Read together** `[INFERENCE]`: the audience is adults and families who already play together; "offline multiplayer" is not what makes people pick a game (13 %), so the hook must be the visible moment (the ball crossing), not the feature list; German table-game culture is growing and two-player games are rising, which fits Pong and Air Hockey.

### 3.2 Candidate first segments

| Segment | Evidence for | Network where they play | How to reach | Cost to try | Fit now |
|---|---|---|---|---|---|
| Friends at a table at home (18–35) | Your own signal; BIGBOARD's Reddit pull; ESA: 70 % play with others | Home Wi-Fi: the case that works today (LAN rtt 5–8 ms, [README](../../README.md)) | Your circle, their circles; short videos | €0 | Best test bed; as a market contested by BIGBOARD |
| Families with kids and tablets | ESA: 81 % of playing parents play with their children; Reddit comments; BIGBOARD's origin ("2 tablets at home") | Home Wi-Fi | Parents in your circle; later parent communities | €0 | Good later; needs kid-proof Games and big Tiles |
| Students (uni, school) | Spaceteam used by teachers; Kahoot's 10 million teachers | Campus Wi-Fi often isolates devices `[INFERENCE]`, so Relay | Student councils' game nights | €0 | Later |
| Bars, cafés, board-game cafés | Strong table culture in Germany (SPIEL, +18 %) | Guest Wi-Fi or mobile data; Relay ~110 MB per Peer-hour ([research](../research/README.md)) | Visit 2–3 cafés with phones | €0 + evenings | Not before reliable Relay joins |
| Events, team building | Spaceteam used by companies; Kahoot in offices | Venue Wi-Fi unknown | Event agencies, HR | Pilot | Not before content + reliability |
| Developers who want to build Tile games | Only open option; swip/Trystero stars; Game Oven: "a huge part of the audience for Fingle and Bounden is game developers" ([post](https://web.archive.org/web/20210826073608/https://www.gamasutra.com/blogs/AdriaanDeJongh/20150527/244437/Closing_Game_Oven_numbers_and_struggles.php)) | Their own Wi-Fi; they debug | GitHub, Show HN, r/gamedev, r/webdev, game jams | €0 | **Best first public segment** |

### 3.3 Recommendation

**Go public first to developers who want to build Tile games; keep friends at a table at home as the private test bed.** Evidence:

1. **No one else serves them.** BIGBOARD is closed; Swip.js stopped in 2017; Racer was never open. Consumers, by contrast, already have a free, polished option with 13 games.
2. **The product fits them today.** The repo has a template, `pnpm new-game`, a tutorial and an API reference; a Game is "~100 lines" ([README](../../README.md)). The consumer product still fails on the iPhone hotspot ([research](../research/README.md)).
3. **They fix your weakest point.** Games are what consumers choose on; every external Game narrows BIGBOARD's lead without your time.
4. **Precedent.** Game Oven believed developers were a large share of its audience; Swip.js got 2,000+ stars as a bare library.
5. **Cheap to reach and to measure:** stars, forks, issues, pull requests to `games/`.

Against: developers rarely pay, and the group is small. That is acceptable for a hobby project whose next question is "does anyone build on this?" `[INFERENCE]`.

**Switch rule:** when (a) ≥9 of 10 joins succeed at test evenings, (b) two groups have started a Session without you, and (c) at least one Game exists that BIGBOARD can't copy quickly (a table-and-hand party Game using Controllers), start the consumer push toward friends at home and families.

### 3.4 How to reach developers (concrete)

1. **This month:** README first screen = a 10-second clip of a ball crossing three phones, then "Build a Game in ~100 lines" and the link to [Your first Game](../guide/your-first-game.md).
2. **When joins are reliable:** one "Show HN" post. Example title: `Show HN: Open-source SDK that turns phones on a table into one game board`. First comment: what it is, what's hard (clock, bezels, iPhone hotspot), what you want (people to write Games).
3. **The same week:** one post each in r/gamedev and r/webdev, following each subreddit's self-promotion rules.
4. **By mid-December 2026:** email 3–5 Global Game Jam sites in Germany/Austria offering a one-page "make a Tile Game at the jam" kit for 25–31 Jan 2027.
5. **Spring 2027:** a small online "Tile Jam" on itch.io (two weekends, theme "across the bezel") `[INFERENCE: itch.io lets anyone host a jam; terms not checked]`.
6. Measure: stars, forks, external Games, questions in issues. Goal for three months: 3 Games not written by you.

### 3.5 How to run the friends test bed

One evening every 1–2 weeks with 3–5 phones, each time a different group if possible. Before: analytics on (3.6). During: every phone exports its log ([Running on phones](../guide/running-on-phones.md)). After: the five survey questions via QR code. Write three lines per evening: joins tried/succeeded, Games played, what people said unprompted.

### 3.6 Getting real audience data cheaply

**What to measure.** The app is static on GitHub Pages, so there are no server logs you can read; counting must come from the page itself. Send these events, with no identifiers:

| Event | Sent by | Properties | Answers |
|---|---|---|---|
| `session_open` | Host, lobby shown | none | How many Sessions start |
| `device_joined` | Host | Devices now in Session (2, 3, 4, 5+); path `direct` or `relay` | Do joins work; Relay share (cost) |
| `join_gave_up` | Peer, after its timeout | reason bucket | The #1 risk, measured |
| `match_start` | Host | Game id; number of Tiles and Controllers | Which Games, which sizes |
| `match_end` | Host | Game id; finished or aborted; duration bucket | Do people play to the end |
| `feedback` | Any Device, when the player taps | 👍 or 👎, optional reason | Satisfaction, sent on purpose |

Rules: strip `?room=CODE` from every URL you send (the code is a join secret and would blow up the page list); never send the app's stored device identifier; let the referrer and UTM tags tell you which video or post brought people.

**Three tools (prices checked 2026-11-11):**

| Tool | Price | Who and where | Cookies / identifiers | Custom events |
|---|---|---|---|---|
| [GoatCounter](https://www.goatcounter.com/) | Free for "reasonable public usage", donations; self-hosting possible | Data on Hetzner servers in Finland and Germany; operated by one person in Ireland ([privacy](https://www.goatcounter.com/help/privacy)) | None; stores only per-day/hour aggregates; you choose which fields are collected | Yes |
| [Umami Cloud](https://umami.is/pricing) | Hobby $0: 100,000 events/month, 1 website, 6-month retention; Pro $20/month | Umami Software, Inc. (US); "servers are located in the US and EU" | None (vendor statement) | Yes |
| [Plausible](https://plausible.io/#pricing) | Starter $9/month for 10,000 pageviews, 30-day free trial; Growth $14; Business $19 | "Made and hosted in the EU", European-owned infrastructure; bootstrapped | None, "no persistent identifiers" | Yes (from Starter) |

Pick GoatCounter if €0 matters most, Plausible if you want the cleanest EU story and dashboard. Expect undercounts: ad and tracker blockers filter these services (on the machine used for this research, the DNS resolver refused umami.is and goatcounter.com).

**A consent-free setup under EU and German law.**

- **The rule.** Storing or reading information on a phone needs consent unless it is strictly necessary for a service the user explicitly asked for: Art. 5(3) ePrivacy Directive, in Germany § 25 TDDDG. It applies even when no personal data is involved ([DSK guidance v1.2, Nov 2024](https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf), Rz. 9 and 18). The EDPB counts "JavaScript code, where the accessing entity instructs the browser of the user to send asynchronous requests with the targeted information" as access ([Guidelines 2/2023 v2.0](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf), para. 33). So "cookieless" removes cookies, not the question.
- **Is simple counting exempt?** Not settled. The German authorities refuse a blanket answer: a pure count (a page counter, log files without personal data, a simple counting pixel of the service itself) is the minimal form, and any judgement holds only "for a precisely defined configuration" (DSK guidance Rz. 87–90). France's CNIL accepts some purely statistical measurement without consent; Germany's federal commissioner is stricter ([lexICT, June 2026](https://lexict.de/aktuelles/digital-omnibus-und-25-tdddg-die-auswirkungen-auf-reichweitenmessung/)).
- **What is coming.** The EU "Digital Omnibus" adds an explicit exemption for aggregated audience measurement for the provider's own use. The Council fixed its position on 2026-10-21; Parliament has not; entry into force "not expected before 2027" ([Heuking, 2026-10-23](https://www.heuking.de/en/news-events/newsletter-articles/detail/cookie-consent-under-the-digital-omnibus-planned-changes-and-technical-implementation.html)).

What that means in practice `[INFERENCE, not legal advice]`:

1. **Lowest risk:** count only what the player sends on purpose (the 👍/👎 tap, the survey). Sending feedback is then the service the player asked for.
2. **Common practice, small residual risk in Germany:** a cookieless tool without a banner, configured to the minimum: no cookies or local storage for analytics, no fingerprinting, only your own events above, no screen or browser details beyond what the tool needs, EU hosting, a data processing agreement, no sharing.
3. **Strictest:** analytics off by default behind a one-tap "Help count Matches" switch in the Host's sheet.
4. Whatever you choose, a privacy notice must list every party the app already talks to: GitHub Pages (hosting), public Nostr relays (signaling; they see IP addresses), the TURN Relay provider, and the analytics tool, with the legal basis (Art. 6(1)(f) GDPR for counting). The app's own stored Device identifier serves reconnects; keep it out of analytics so it stays "strictly necessary".

**Five questions for a short player survey** (use [Tally](https://tally.so/help/gdpr): based in Belgium, form data "stored in Europe", free under fair use; QR card on the table plus a link on the result screen):

1. **Who brought this to the table today?** I did · a friend · I saw it online · other.
2. **Where are you playing?** At home · bar or café · school or university · work or an event · outside · other.
3. **Did every phone get in on the first try?** Yes · one needed a second try · someone gave up.
4. **How likely is it that you start a Session yourself the next time you meet friends?** 0–10.
5. **What almost made you stop, or which Game should come next?** Free text.

Add an optional "email me when there's news" field only as a separate, unticked opt-in.

## 4. The name

### 4.1 Three names in use today

| Where | Shows |
|---|---|
| Page title ([index.html](../../apps/pwa/index.html)), PWA manifest `name`, README and GLOSSARY headings | MobileGameConnect |
| Home-screen icon label (manifest `short_name`) | MGC |
| URL, GitHub repo, the address typed by Peers | Bezel (manubown.github.io/Bezel, github.com/Manubown/Bezel) |
| Code | `@mgc/*` packages (internal; users never see it) |

"MobileGameConnect" is the old working title; it describes a mechanism, not a game night, and nobody will say it at a table `[INFERENCE]`.

### 4.2 Who else is called Bezel

| Who | What | Why it matters | Source |
|---|---|---|---|
| Bezel Inc. (Los Angeles) | Luxury-watch marketplace; $8M seed round 2023; App Store app with 3,096 US ratings | Owns US trademark BEZEL incl. class 9 (registered 2026-05-26); dominates searches | [getbezel.com](https://www.getbezel.com/post/bezel-seed-round), iTunes Search API, TMview |
| Nonstrict B.V. (Netherlands) | "Bezel • Phone Mirror": mirrors iPhones on a Mac; v4.0 in 2026 | Same "phone screens" space, an EU company, getbezel.app | [nonstrict.eu](https://nonstrict.eu/blog/2026/launching-bezel-4.0/) |
| bezelgame.com | "Bezel": a two-player online gem-placing strategy game with ranked leaderboard (domain registered 2026-07-19) | Same category: a browser game called Bezel | Page and script read 2026-11-11 |
| Nintendo | "Nintendo Ware Bezel Engine", registered for video game programs (class 9) since 2017 | Games; a large owner | TMview: WO 1371322, UK00801371322 |
| Bezel (3D design tool, bezel.it) | Collaborative XR design tool, now renamed Bezi | Shows the name is crowded in tech | [hq.bezi.com](https://hq.bezi.com/hq/blog/real-time-collaboration-in-a-3d-design-tool) |
| bezel.com | Coin jewellery shop, domain since 1999 | The .com is gone | RDAP |
| App stores | US App Store: 10 apps with "Bezel" in the name (mockups, frames, finance, jewellery); German store 9; Google Play search for "bezel" returns watch faces and Chrono24 | You would be the 11th; nobody finds you by searching the word | iTunes Search API, Google Play search |

### 4.3 Trademark registers (TMview, 2026-11-11)

Search: name contains "bezel", offices EUIPO, DPMA, Austria, Switzerland, WIPO, USPTO, UKIPO, status filed or registered: 60 marks.

| Mark | Office | Classes | Owner | Status | Relevance |
|---|---|---|---|---|---|
| BEZEL | USPTO 99071112 | 9, 14, 35 | Bezel Inc. | Registered 2026-05-26 | Class 9 covers only "downloadable mobile application software for providing an online marketplace for … watches"; still a strong owner of the word in apps |
| BEZEL | USPTO 50030308 | 42 | Token Designer, Inc. | Filed 2026-08-04 | SaaS for design tokens |
| Nintendo Ware Bezel Engine | WIPO 1371322 / UKIPO | 9 | Nintendo | Registered 2017 | Video game programs |
| Blade Bezel | EUIPO 018327007 | 9 | Samsung Display | Registered 2020 | Displays |
| Bezeltec, Bezelpro | EUIPO 019258986, 019259002 | 9 (+7, 8) | Fodrim Studio | Filed 2025-10-10 | Hardware/tools |
| Other "BEZEL" marks | USPTO | 6, 11, 21, 33, 34, 36, 43 | various | Registered | Unrelated goods |

**No plain "BEZEL" mark was found at EUIPO, DPMA or the Austrian office in any class.** `[INFERENCE]` A German or EU filing for games (classes 9, 28, 41) might therefore get through, but Bezel Inc. and Nintendo could oppose, and the practical problems in 4.2 remain. TMview searches only names; a similarity (phonetic) search was not done.

Fees if you ever file (checked 2026-11-11): DPMA online €290 for up to three classes ([DPMA](https://www.dpma.de/service/gebuehren/marken/index.html)); EUIPO online €850 for one class, €50 for the second, €150 for each further ([EUIPO](https://www.euipo.europa.eu/en/trade-marks/before-applying/fees-payable-direct-to-the-euipo)).

### 4.4 Domains and handles

Domains (registry RDAP/WHOIS; prices from Porkbun's public API in USD, first year / renewal):

| Taken | Free |
|---|---|
| bezel.com (1999), bezel.net, bezel.app (2024), bezel.io, bezel.gg, bezel.games, bezel.de, bezel.eu, getbezel.com (watches), getbezel.app (Nonstrict), bezelgame.com (the 2026 game) | bezel.at (nic.at), bezel.party ($4.61 / $5.64), bezel.fun ($2.57 / $31.41), bezel.game ($309 / $340), playbezel.com ($11.81), playbezel.app ($8.75 / $14.93) |

Handles:

| Platform | bezel | playbezel | bezelgame |
|---|---|---|---|
| GitHub | Taken (user since 2010, 0 public repos) | Free | Free |
| TikTok | Taken (17 followers, 18 videos) | Free | Free |
| YouTube | Profile page returned 404 (appears free) | 404 | 404 |
| Instagram, X | Not checkable without login | Not checked | Not checked |

### 4.5 Verdict

**"Bezel" is weak as the public name; keep it as the repo codename.** It is not blocked in the EU registers, but it is unfindable (watches and phone hardware own the word), crowded in exactly your space (a phone-screen app, a 2026 browser game, Nintendo's engine), and its good domains are gone. If you love the word, keep it inside a compound (direction 1 below). Decide before the landing page, the social handles and any printed QR card; after that, renaming costs links, handles and the little recognition you have `[INFERENCE]`.

### 4.6 Ten alternative directions, lightly checked

Checks on 2026-11-11: registry WHOIS/RDAP, `github.com/<name>`, TikTok profile, iTunes Search API (US), TMview "contains" in the offices listed above. "Free" means not registered or not found, not "available to buy at list price".

| # | Direction | Example | .com | .app | play….com | GitHub | TikTok | App Store hits | TMview hits | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Keep your word, add a qualifier | Bezel Party | free | free | free | free | free | 0 | 0 | Keeps the word; still confusable with watches |
| 2 | Name the wow moment | Crossbezel | free | free | free | free | free | 0 | 0 | Unique; a bit technical |
| 3 | The table is the field | Tablefield | taken | free | free | free | taken (10 followers) | 0 | 0 | Plain, bilingual-friendly |
| 4 | The phones are the field | Phonefield | taken | free | free | free | taken (5) | 0 | 0 | Says what it is |
| 5 | Your own word "Tile" on a tabletop | Tiletop | taken | free | free | free | taken (2) | 0 | 4 ("Tiletopia", a tile game in class 9) | Close to an existing game |
| 6 | Tiles as a field | Tilefield / Tabletiles | taken / taken | free / free | free / free | free / free | not checked | 0 | 0 | Matches GLOSSARY wording |
| 7 | Phones as patchwork | Phonequilt | free | free | free | free | taken (0 followers) | 0 | 0 | Playful; unusual |
| 8 | Spanning the table | Tablespan / Spanfield | taken / taken | free / free | free / free | free / free | not checked | 0 | 0 | Neutral |
| 9 | **Avoid:** anything with "seam" | Seamfield | taken | free | free | free | not checked | 0 | 0 | BIGBOARD's own word ("Seam Hockey", "the seam"); would look like a copy |
| 10 | **Avoid:** card-table words | Laydown | taken | taken | free | taken | not checked | 1 ("Laydown") | 4 (incl. "LAYDOWN RECORDS", class 41) | Already used widely |

Also checked and rejected: Tilewise (domains, GitHub and 3 apps taken), Mosaiq (.com, GitHub and 2 apps taken), Joinfield (.com and GitHub taken).

### 4.7 One-evening name check

1. Shortlist three names; say each aloud in German and English and spell it from hearing.
2. App Store and Google Play search; Steam and itch.io search.
3. [TMview](https://www.tmdn.org/tmview/) search, offices EM, DE, AT, US, WO; look at classes 9, 28, 41.
4. Domain: `.com`, else `.app`; `play<name>.com` as a fallback.
5. Handles: GitHub organisation, TikTok, Instagram, YouTube, X (log in to check the last two).
6. Register the domain and all handles the same evening (~$12/year for the domain).
7. Rename the visible places together: page title, manifest `name`/`short_name`, README heading, Pages URL. The `@mgc/*` package names can stay.

## Open questions for the makers

1. Is the goal a game night your friends love, a platform other people build on, or eventually income? Section 3.3 assumes "platform first"; if it is income, the institutional segments (schools, events) need a different plan.
2. Will you play BIGBOARD.GAMES this week and write down five differences? Would you contact its maker?
3. Which networks do your testers actually use (home Wi-Fi, mobile data, hotspot)? This decides whether 9 of 10 joins is near.
4. Are you willing to show a privacy notice and choose between options 1–3 in 3.6, or do you want zero analytics and only the survey?
5. Do you want to keep the word "Bezel" in some form, or start fresh with one of the directions in 4.6?
6. Who of you would answer developer questions on GitHub within a few days? A developer launch without that person backfires `[INFERENCE]`.
7. Is the team based in Germany, Austria or elsewhere? It changes which privacy authority and trademark office matter first.
