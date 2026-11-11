# What to do next: outreach, growth, money

Written 2026-11-11. Seven reports, each researched by its own agent with its sources inline and checked that day; this page is the reading order and what follows from them together. The ranking and the roadmap here are a proposal, not a decision. Nothing in the reports is legal or tax advice. `[INFERENCE]` marks a conclusion no source states.

| Report | Question | Its answer in one line |
|---|---|---|
| [competition-and-audience.md](competition-and-audience.md) | Who else does this, who plays, is the name usable | A direct rival launched five weeks ago; go to developers first; "Bezel" is weak as the public name |
| [app-design-audit.md](app-design-audit.md) | What a stranger sees in the app today | The Match is clean, everything around it is a developer console; seven fixes before strangers play |
| [github-and-landing-site.md](github-and-landing-site.md) | The repo front page and an Astro landing site | One evening fixes the repo; landing page at `/Bezel/`, the app moves to `/Bezel/play/` |
| [social-media-and-launch.md](social-media-and-launch.md) | Where and how to show it | Short video is the main channel and needs patience; one Show HN; a QR card for the strangers who ask; no public push before joining works |
| [funding-and-kickstarter.md](funding-and-kickstarter.md) | Kickstarter, grants, donations | Kickstarter not yet; two grants and two donation links are worth a day each |
| [revenue-and-scalability.md](revenue-and-scalability.md) | Business models, running costs, licence, legal basics | Free core, the Host pays once; costs near zero until the Relay allowance; keep MIT |
| [../research/infrastructure-independence-and-pocket-device.md](../research/infrastructure-independence-and-pocket-device.md) | Not depending on one provider; a native app; the pocket device | A second Relay provider, pinned signaling relays and an own domain first; the app and the device later, behind experiments |

The connectivity research of the day before is in [../research/README.md](../research/README.md).

## Five findings that change the plan

1. **You are no longer alone.** [BIGBOARD.GAMES](https://bigboard.games/about) went live on 2026-10-05 with the same pitch: a browser app, no install, iPhone and Android, two to four phones edge to edge as one board, Air Hockey first. It now lists 13 games. One developer built it in ten days ([his launch post](https://nikitaeverywhere.com/posts/bigboard-games/)), on a design close to this one: a world in millimetres, an NTP-style clock, WebRTC with a relay as fallback. It is ahead in three places: devices on the same Wi-Fi find the table without a QR code, a layout editor every phone can drag, and size calibration with a bank card. It is closed source and obfuscated. `docs/PLAN.md` §2 ("nobody has shipped this") no longer holds.
2. **What is left that only this project has:** it is open source (MIT) with a Game SDK, a template and a tutorial; it needs no server of its own; and one Match can mix Tiles on the table with Controllers in players' hands (Quiz, Pass). The rival has none of the three.
3. **Joining decides everything else.** Every comparable product is criticised for joining; here an iPhone hotspot still fails most first attempts. No public push is worth making before a Peer gets in on the first try in 9 of 10 joins on the networks your testers use. The fail-safe built today (`.scratch/connectivity-2/issues/07-host-withholds-own-addresses.md`) is the next thing to try on phones.
4. **The product has no name a stranger can read.** The screens show none; the title says "MobileGameConnect", the home-screen label "MGC", the URL "Bezel". And "Bezel" is taken where it matters: a funded watch marketplace with a US trademark that covers apps, a Mac app that mirrors phone screens, a 2026 browser game, Nintendo's "Bezel Engine"; the good domains are gone and a search returns watches.
5. **Money is not what is missing; proof that strangers come back is.** Running costs are near zero. A Kickstarter today would have nothing to sell that is not already free, and no audience to bring: Kickstarter's own handbook says most support comes from the creator's own network.

## The position this suggests

Do not race the rival on the number of games or on polish for consumers: one person with a server and a five-week lead wins that. Be **the open one**: the platform other people build table games on, and the only one where a phone in your hand is part of the game. Friends at a table stay the test bed. Consumers come second, once joining works and there is a Game the rival cannot copy quickly (a table-and-hand party Game) `[INFERENCE]`.

This is the makers' call, and it depends on one question the reports cannot answer: is the goal a game night your friends love, a platform others build on, or income? The order below assumes "platform first, income later".

A note on your own second project: GitHub issues #1 and #2 describe **GameTiles**, a Hub with profiles and progression built on this platform, in a repo strangers cannot see. If that is the consumer product, then this repo is the engine and GameTiles the name people would say. A light check on 2026-11-11: `gametiles.com` is registered; `gametiles.app`, `.io`, `.gg` and `.games` returned "not found" from the registries' RDAP; no App Store app carries the exact name; `github.com/gametiles` is free. No trademark register was searched for it.

## What to do, in order

### Now (this week, 0 €)

| # | Step | Size | Why first | Detail in |
|---|---|---|---|---|
| 1 | Phone run of the new build on the iPhone hotspot; export both logs | one evening | Tells whether the hotspot's direct path can live; everything public waits on joining | ticket connectivity-2/07, "What the next hotspot run should show" |
| 2 | Play BIGBOARD.GAMES on your phones for 30 minutes, on the hotspot too; write down five differences | 30 min | You need to know the rival first-hand; and whether it connects on the network where this app fails | competition §1.2 |
| 3 | Check the Metered dashboard: 500 MB or 20 GB, and set a quota action. Add a second Relay provider from another company to the same `MGC_TURN_SERVERS` array (the report names ExpressTURN's free plan); no code | 1–2 h | The first thing that can break; the credential is readable in the published JavaScript | revenue §3.5; infrastructure report §1.2 |
| 4 | Decide the public name (shortlist three, one evening of checks) | one evening | Blocks the README, the landing page, the icons, every handle | competition §4.6–4.7 |
| 5 | Close the own-code trap; hide technical text behind `?debug`; list only Pong and Air Hockey by default | one day | A Host who types the code shown on its own screen leaves its table; the first screen has 26 controls | design audit, work list 1, 2, 4 |
| 6 | Repo front page: About box, topics, community files, labels; deal with issues #1 and #2 | one evening | The repo is the storefront for the developer segment and it is empty | landing §2, §4 |

### Next (2 to 6 weeks)

| # | Step | Size | Gate | Detail in |
|---|---|---|---|---|
| 7 | Name on every screen, icons, link preview; placement help; "Play again"; a help card after 15 s of failed connecting | 3–5 days | name decided | design audit, work list 3, 5, 6, 7 |
| 8 | The 20-second clip: phones pushed together, a ball crossing, the name in frame | one evening | 5 and 7 done (a clean screen) | social §2–3, design audit "What a 20-second video needs" |
| 9 | README first screen with the clip and a QR code; move the `stable` tag after a good phone run and point the public link at it | one evening | 8 | landing §2 |
| 10 | Count what happens: Session opened, Device joined direct or relayed, join gave up, Match started and finished; a thumbs up/down at the end of a Match | half a day | a privacy page exists | competition §3.6 |
| 11 | Landing site with Astro in this repo: `/Bezel/` the page, `/Bezel/play/` the stable app, `/Bezel/next/` master; imprint and privacy pages. Then a QR card that points at it, for the strangers who ask for the name (100 cards from about 12 €) | 3 evenings | name; whose address goes in the imprint | landing §3; social §4 |
| 12 | Pin the signaling relays: the app always uses the same five public Nostr relays, two refused connections on 2026-11-11 and one rate-limited the phones in run 5. Then an own domain (about 11 USD a year) before anything is printed, with a second host behind it | half a day; 1 day | the name, for the domain | infrastructure report §1.1, §1.4, §1.5 |
| 13 | States on a channel that does not retransmit (the stalls on the Relay) | medium | none; it matters most for phones on mobile data | `docs/research/README.md` option 5 |
| 14 | Open GitHub Sponsors and Ko-fi; write the NLnet application (deadline 3 Jan 2027) | 2 days | imprint decided | funding §4 |
| 15 | One "Show HN" post aimed at developers: an open SDK that turns phones on a table into one game board | one evening + a day of answering | 9 of 10 joins work; 9 done | social §4; competition §3.4 |

### Later (when its gate is met)

| Step | Gate |
|---|---|
| M3 sandboxed Game bundles and Games loaded from a URL, the SDK on npm | outside developers ask for it; it is what makes third-party Games safe |
| A table-and-hand party Game the rival cannot copy quickly | the developer push has run |
| Same-Wi-Fi auto-join, a layout editor, card calibration (the rival's three leads) | joining works; pick by what test evenings complain about |
| Consumer push on short video, a German home page | 9 of 10 joins, two groups have started a Session without you, one distinctive Game |
| "The Host pays once" as a pay-what-you-want link | Matches are counted (10), imprint, a merchant of record |
| The state's games fund, Deutscher Computerspielpreis | a demo video, a registered seller for some funds; deadlines mid-January to early February 2027 |
| Offline joining by QR code | a network on which the direct path works (hotspot fail-safe proven, or an Android hotspot, or a travel router) |
| A native app as the connectivity layer | the web path is shown to be the limit, not the first screen |
| The pocket device | the 41 € travel-router experiment works, and offline joining exists; selling a radio device needs CE with EN 18031, Cyber Resilience Act duties and lab tests of 5,000–15,000 € |
| Kickstarter | a reward that is not the free app, about 800 followers for a 10,000 € goal, a registered business; second half of 2027 at the earliest `[INFERENCE]` |

### Not now

Paid ads or analytics, a logo agency, Starlight docs, GitHub Discussions, a newsletter before there is something to announce, bars and corporate events as a segment, the federal games fund, a subscription, a marketplace, hardware.

## Where the reports disagree

- **When to start short video.** The social report says now, three clips a week at 5–7 hours; the competition report says no consumer push before 9 of 10 joins work. What fits both: film now and warm up the accounts now (Hacker News restricts Show HN posts from new users; some subreddits want account age and karma), publish the first clip once the screen is clean and carries a name (steps 5 and 7), and keep the weekly rhythm for after the join gate `[INFERENCE]`.
- **Whom to address first.** The competition report says developers; the social report's channels and the design audit's fixes serve players. Both are needed in that order: the fixes before strangers play are the same either way, and a Show HN to developers is judged by people who try it on their own phones.
- **Two 9-of-10 gates.** The reports use the figure for different networks (the testers' usual networks; strangers on mobile data). Both are thresholds the reports chose, not measured values.

## Your list, item by item

| You had in mind | Verdict | When |
|---|---|---|
| Polish GitHub for easy introduction | Yes; one evening, and it is the storefront for the first segment | now (6), then 9 |
| A hosted Astro landing site | Yes, plain Astro in this repo on the same Pages site; after the name and the clip | next (11) |
| Polish the app design | Yes, in two steps: seven fixes before strangers play, then the "night table" look | now (5), next (7), later |
| A Kickstarter | Not yet; nothing to sell and no audience; grants and donation links first | later |
| Data about audience and competition | Done for competition (one direct rival); audience data must come from your own counting and a five-question form | next (10) |
| Social media content of the development | Film and warm up accounts now; publish one clip once the screen is clean and named; a weekly rhythm once joining works | now, next (8), later |
| Roadmaps | This page; `docs/PLAN.md` §2 and §6 should be updated once you have decided the position | after your decision |
| Scalability, growth, revenue | Costs are near zero until the Relay allowance; first revenue test is a pay-what-you-want link, after counting exists | next (12), later |
| An app for better connectivity | Not yet. A wrapper app (Capacitor, Tauri) runs the same WebKit as Safari and would not fix the iPhone hotspot; only an app with its own WebRTC library might, untested, at 5–8 person-weeks plus store fees `[INFERENCE of the report]`. A two-day throwaway app would show it | later, after the fail-safe's phone run |
| A small device in the pocket | Prototype with a 42 € travel router, a Wi-Fi QR sticker and an NFC sticker first; it helps only if its Wi-Fi gives the phones internet. Selling an own radio device is a company-sized step | later |

## Decisions only you can make

1. The goal: friends' game night, a platform others build on, or income?
2. The public name. Is GameTiles the consumer product and this repo its engine?
3. Whose name and postal address go in the imprint, and in which country (it decides the rules and which state fund is open)?
4. May strangers use your Relay account, and up to which monthly amount?
5. Should the public link be the `stable` build from now on?
6. Will you write to the maker of BIGBOARD.GAMES? An open platform and a closed game collection are not the same thing, and he has solved joining.
