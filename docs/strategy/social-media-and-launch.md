# Getting seen: short video, communities and a launch order

Researched 2026-11-11. Every external fact links its source; view counts, points and member numbers were read that day unless another date is given. Facts about this repo cite the file. `[INFERENCE]` marks a conclusion of ours that no source states. This is not legal advice. Project words as in [`GLOSSARY.md`](../../GLOSSARY.md): Session, Device, Host, Peer, Tile.

Related reports in this folder: [`github-and-landing-site.md`](github-and-landing-site.md) (name, landing page, imprint, analytics, newsletter tools), [`funding-and-kickstarter.md`](funding-and-kickstarter.md) (audience gates before any crowdfunding). This report does not repeat them; it links them.

## Bottom line

- **Do not launch publicly yet. First pass one gate:** a stranger on mobile data opens the link and plays on the first try. Test it with 10 joins by people outside the team, iPhones and Androids mixed, every phone on its own mobile data (experiment 1 in [`docs/research/README.md`](../research/README.md)). Suggested bar: 9 of 10 reach a Match within a minute `[INFERENCE: our threshold]`. Cost €0, one or two evenings. A Show HN can be reposted only after a "significantly different" version ([dang's tips](https://news.ycombinator.com/item?id=22336638)); you get one first impression per channel.
- **This week, about €12: print 100 QR cards** for the strangers who ask for the name (100 business cards cost €11.54 at the cheapest German printer in January 2026, [druckvergleich.org](https://www.druckvergleich.org/kosten-visitenkarten-preise-2026/)). Point the QR code at a page you control, not at the bare app (§5.6). Decide the public name before printing: "Bezel" is also a watch marketplace app and a phone-mirror app ([`github-and-landing-site.md`](github-and-landing-site.md) §1, [getbezel.com](https://shop.getbezel.com/app)).
- **Start short video now, at about 5–7 hours a week.** One filming session gives 3 clips a week; post the same file to TikTok, Instagram Reels (as a "trial reel", shown to non-followers first) and YouTube Shorts. The trick goes in the first second: a ball crossing from one real phone to the next, hands and table in frame, the address on screen. Setup cost €0–25 (§4.3).
- **Warm up accounts now, post later.** Hacker News is "temporarily restricting Show HNs" from users new to the site ([HN](https://news.ycombinator.com/showlim)); some subreddits need account age and karma (r/IndieGaming: 1 week and a posting history; r/AndroidGaming: 1 month and 50 karma). Comment on other people's work for three weeks first.
- **Reddit: post where the rules allow a phone-only web game.** Yes: r/LocalMultiplayerGames, r/playmygame, r/webdev (Saturdays only), r/IndieDev, r/indiegames, r/IndieGaming, r/SideProject, r/javascript (with code). No: r/WebGames (bans games that need smartphones), r/InternetIsBeautiful (bans web games), r/boardgames (digital games are off-topic), r/de, r/germany, r/Austria (no self-promotion). Details in §2.2.
- **One Show HN, in launch week (week 4).** The median Show HN gets 2 points and 50+ puts you in the top 6 % ([Dan King, 2026](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)). If it reaches the front page, plan for about 35–50 visitors a minute, half of them on a laptop ([Marco Maier](https://marcotm.com/articles/stats-of-being-on-the-hacker-news-front-page/)). The landing page needs a path for someone with one laptop and no second phone.
- **Skip for now:** Product Hunt (homepage placement is an editorial choice, launches go live at 09:01 German time, and it is a maker/startup crowd, §2.4); Poki and CrazyGames (their requirements assume one device per player, §2.5); Chrome Experiments (an archive now); Awwwards (€65 per submission); your own Discord server (open it when you can answer daily); long YouTube devlogs.
- **Before the first public push:** landing page with a 10-second loop and "Start a table", one way to keep in touch (email or RSS), counts per channel, and caps on the free relays (§5.1, §5.3). Money: €0 required; optional Plausible $9 a month, optional own Nostr relay on a server from €5.49 a month excl. VAT ([Hetzner](https://www.hetzner.com/cloud/)).
- **Film strangers only with consent.** In Germany a recognisable person's picture may be published only with their consent, with narrow exceptions ([KUG § 22](https://www.gesetze-im-internet.de/kunsturhg/__22.html), [§ 23](https://www.gesetze-im-internet.de/kunsturhg/__23.html)); Austria protects "berechtigte Interessen" of the person shown ([UrhG § 78](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001848&Paragraf=78)). Default shot: hands and phones only.
- **Expect copycats within a day of going viral.** Bjørn Staal's "Entangled" clip (10.2 M views) had a public copy on GitHub about 20 hours later, and the copy got 403 points on Hacker News (§3.1). The defence is a name people can find and a steady stream of new clips, not secrecy.

## 1. What we start from

| Fact | Source |
|---|---|
| A PWA; one phone is the Host; phones join by QR code or a 4-letter code; the Peer types `manubown.github.io/Bezel` and the code | [`README.md`](../../README.md), [`apps/pwa/src/hud.ts`](../../apps/pwa/src/hud.ts) lines 127–131 |
| A phone that opens the address without `?room=` becomes a Host at once | [`docs/guide/running-on-phones.md`](../guide/running-on-phones.md) §Join |
| Every phone needs internet for signaling over public Nostr relays; Trystero opens 5 of a built-in list of 29 relays run by third parties (`defaultRedundancy = 5`); the app passes no relay list of its own | `node_modules/.pnpm/@trystero-p2p+nostr@0.26.0/node_modules/@trystero-p2p/nostr/dist/index.mjs` lines 5 and 258–288; [`packages/core/src/trystero-transport.ts`](../../packages/core/src/trystero-transport.ts) lines 72–76 |
| TURN relay from Metered's free plan; credentials are readable in the published JavaScript | [`docs/guide/running-on-phones.md`](../guide/running-on-phones.md) §Connectivity flags |
| About 110 MB per relayed Peer-hour; the free allowance is either 500 MB or 20 GB a month (unclear) | [`docs/research/internet-carried-sessions.md`](../research/internet-carried-sessions.md) |
| iPhone Personal Hotspot is unreliable; every phone on its own mobile data is the no-code alternative | [`docs/research/README.md`](../research/README.md) |
| Good moments in live test 1: Pong 7:5 in 70 s and 7:6 in 80 s; the Host page reloaded 14 times in 30 min from pull-to-refresh (fixed); Safari Page Zoom made one phone a third too large (fixed) | [`.scratch/live-test-1/findings.md`](../../.scratch/live-test-1/findings.md) §2, §3, §5 |
| Clock: rtt 5–8 ms on phones, offset error ≤ 2 ms | [`README.md`](../../README.md) §Status |
| Seven Games in the repo (Pong, Pass, Tap Race, Snake, Quiz, Air Hockey, Breakout) | [`README.md`](../../README.md) §Games |
| The repo has 1 star and no description | [GitHub API](https://api.github.com/repos/Manubown/Bezel) |
| Signal: friends hooked on the first game; strangers asked for the app's name; a whole test evening used about 6 MB of TURN data | project brief |

## 2. Channels

### 2.1 Overview

| Channel | Fit | Rules and facts (checked 2026-11-11) | Evidence | What to do, when |
|---|---|---|---|---|
| **TikTok** | High: the trick is visual | Music from the general "Sounds" library is for "personal entertainment and non-commercial purposes" only; promoting a product needs the Commercial Music Library or your own audio ([TikTok Music Terms, EEA, July 2025](https://www.tiktok.com/legal/page/global/music-terms-eea/en)) | A 21-s TikTok by a tech creator about AirConsole (phones as controllers) got 293,900 plays ([@heyrubem, 2024-01-26](https://www.tiktok.com/@heyrubem/video/7328411301867179269)); AirConsole's own account has 4,085 followers over 37 videos ([@airconsoleoriginal](https://www.tiktok.com/@airconsoleoriginal)). In these two data points a creator's "look what I found" clip carried further than the brand's own account `[INFERENCE]`. | From week 1, 3 clips a week |
| **Instagram Reels** | High | Reels up to 3 minutes since January 2025 ([The Verge](https://www.theverge.com/2025/1/18/24346567/instagram-announces-reels-3-minute-video-posts)); **trial reels** go to non-followers first, metrics after about 24 h, optional auto-share to followers if it performs within 72 h ([Instagram, 2024-12-10](https://creators.instagram.com/blog/instagram-trial-reels)) | DREADMOOR (an indie game, 2026): after months of regular posting "several videos went off simultaneously on TikTok and Reels" for about 1 M impressions, "no news hook behind this" ([Game World Observer, 2026-05-21](https://gameworldobserver.com/2026/05/21/case-study-how-dreadmoor-reached-200000-wishlists-and-where-they-came-from)) | Same file as TikTok, posted as trial reel |
| **YouTube Shorts** | High | Shorts up to 3 minutes since 2024-10-15 ([YouTube Help](https://support.google.com/youtube/answer/15424877?hl=en)); Audio Library music is "copyright-safe" on YouTube ([YouTube Help](https://support.google.com/youtube/answer/3376882?hl=en)) | A 17-s Short about AirConsole: 2,709,797 views ([Tech By Meet, 2025-06-10](https://www.youtube.com/watch?v=-LQPDZ9M0dQ)); a 40-s one: 809,108 ([Beebom, 2024-11-08](https://www.youtube.com/watch?v=I0UIsX4vQ4I)) | Same file; Shorts are also searchable later |
| **Reddit** | Medium, sub by sub | Sitewide: "Participate authentically in communities where you have a personal interest, and do not spam" ([Reddit Rules, rule 2](https://redditinc.com/policies/reddit-rules)). Per-sub rules in §2.2 | A zero-budget team got about 250 wishlists from its first trailer plus one post in a fitting national sub ([Dark Queen, itch.io, 2025-02-21](https://itch.io/blog/907433/from-0-to-5700-steam-wishlists-with-0-budget)) | Comment from now; first posts in week 3, after the gate |
| **Hacker News, Show HN** | Medium-high: a technical trick, no signup, open source | "Something you've made that other people can play with"; "ideally without barriers such as signups"; "Don't post landing pages or fundraisers"; "Please don't ask friends to upvote or comment" ([Show HN guidelines](https://news.ycombinator.com/showhn.html)). Show HNs from newcomers temporarily restricted ([HN](https://news.ycombinator.com/showlim)). Moderator tips (edited 2026-03-28): add the backstory, a clear statement of what it is, no marketing language, username not the project's name, and "Write your text by hand. Don't use an LLM to generate any of it" ([dang](https://news.ycombinator.com/item?id=22336638)) | Gaming Couch (phones as controllers, browser, WebRTC with TURN fallback): 437 points, 121 comments ([2025-12-21](https://news.ycombinator.com/item?id=46344573)). Swip.js (phones joined into one screen): 152 points ([2016](https://news.ycombinator.com/item?id=12735665)). Median Show HN: 2 points; 28,302 Show HNs in 2025, about 200 a day ([Dan King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)); in 2025 a Show HN had an 11 % chance of more than 10 points ([Sturdy Statistics](https://blog.sturdystatistics.com/posts/show_hn/)) | Once, week 4 (§5.2) |
| **Product Hunt** | Low for a game, now | Launches go live 12:01 AM Pacific; the team "hand-picks which ones to feature"; personal accounts only; "Never ask for upvotes"; schedule up to 30 days ahead; weekends "quieter… can suit smaller teams and side projects"; relaunch of the same link within two months needs a request ([PH Launch Guide 1](http://help.producthunt.com/en/articles/17734306-1-how-product-hunt-works), [3](http://help.producthunt.com/en/articles/17734355-3-set-your-goals-and-pick-your-launch-date), [4](https://help.producthunt.com/en/articles/17834537-4-build-your-product-page), [5](http://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid)) | An April 2026 critique found 4 of 5 top spots taken by Anthropic, Google, Cloudflare and Vercel ([Molodtsov](https://molodtsov.me/2026/04/we-need-a-new-product-hunt/)) | Not before week 6; decide on numbers then |
| **itch.io** | Low-medium | HTML5 games run in an `iframe`; ZIP ≤ 1,000 files, ≤ 500 MB; a "Mobile Friendly" switch opens fullscreen on phones ([itch.io docs](https://itch.io/docs/creators/html5)) | The Host's QR code encodes the page's own URL ([`hud.ts`](../../apps/pwa/src/hud.ts) line 127), which inside itch's iframe would be itch's file server `[INFERENCE: test before uploading]` | Later: a page with devlog posts that links out to the app; or test the upload first |
| **Mastodon / Bluesky / X** | Medium for dev-logs | Bluesky has game-dev feeds (GameDev New/Hot/Screens, Trezy's "Game Dev", "Screenshot Saturday") that pick up posts by keyword or `#gamedev` ([Chequered Ink, 2025-10-14](https://chequered.ink/bluesky-feeds-for-game-devs/)); Mastodon has a game-dev server, [mastodon.gamedev.place](https://mastodon.gamedev.place/about), and `#screenshotsaturday` | "Entangled" (10.2 M views) and Infinite Craft (21.2 M) broke out on X (§3.1); I found no reach numbers for small game-dev accounts on Bluesky or Mastodon | 10 minutes a day; dev-log threads; cross-post clips |
| **Own Discord server** | Later | Discord's developer advocate (2026-11-04): "if you can't commit to being present yet, it's better to wait than to open a server that sits quiet"; "Dozens of empty channels make a new community feel abandoned" ([PocketGamer.biz](https://www.pocketgamer.biz/how-to-build-a-discord-server-players-actually-stay-in/)) | — | Open when people ask for it and someone can answer daily; start with 3 channels |
| **YouTube long devlogs** | Low now | — | No numbers found for devlog channels of web games | One 5–8 min "how it works" after Show HN, if the Shorts get traction |
| **Poki / CrazyGames** | No | §2.5 | — | Skip |
| **Showcases and newsletters** | Medium after a write-up | §2.6 | — | Week 4, after the technical post |
| **Press** | Medium for tech/maker press | §2.7 | — | Week 5 |
| **Events, jams, playtest nights** | High for footage and feedback | §2.8 | — | From week 2 |

### 2.2 Reddit: which subreddits allow this game

"Weekly" is the weekly visitor count Reddit shows on each subreddit (read 2026-11-11 from the subreddit pages; rules read from each sidebar).

| Subreddit | Weekly | The rule that decides | Fit |
|---|---|---|---|
| r/LocalMultiplayerGames | 22,060 | "Must relate to local multiplayer games with players gaming in the same room"; "self-promotion is actually encouraged… limit posting… to every other week at the most" | **Yes, best fit** |
| r/playmygame | 69 K | Playable for free now; a description including your role; "a direct link to your game"; "1 post per month" | **Yes** |
| r/webdev | 339 K | Sharing a project "is limited to Showoff Saturday"; correct flair; "Think project, not product. Focus on the technical details" | **Yes, Saturdays** |
| r/javascript | 29 K | "Demos can be fun, but they really don't provide for much discussion unless code is provided as well"; self-promotion not the majority of your activity | **Yes, with code and a write-up** |
| r/IndieDev | 465 K | Only rule shown: capsule-comparison posts on Wednesdays only | **Yes** (dev progress) |
| r/indiegames | 75 K | Promotion "MUST contain" gameplay footage; no dev-focused content; no questions in the title; 2 posts a week max; no generative AI | **Yes, with a clip** |
| r/IndieGaming | 205 K | Account at least 1 week old with a posting history; one submission every two weeks; English | **Yes** |
| r/SideProject | 346 K | "A subreddit for sharing and receiving constructive feedback on side projects" (no rules widget shown) | **Yes** |
| r/de_EDV | 253 K | "Werbung für Open Source Projekte darf nur im vorgesehenen Megathread erfolgen" | **Megathread only** |
| r/zocken | 184 K | No links to Discord or channels; no direct financial benefit; "Ausnahmen sind möglich, dies bitte mit den Mods absprechen" | **Ask the mods first** |
| r/gamedev | 422 K | "No Showcasing Projects"; links only with a post-mortem, analytics or learning value | **Later, a post-mortem with numbers** |
| r/WebGames | 32 K | P7: "Games that require non-standard… devices (smartphones, VR headsets) are not allowed" | **No** |
| r/InternetIsBeautiful | 60 K | "No Webgames"; 90/10 self-promotion rule | **No** |
| r/boardgames | 498 K | "computer games/apps which borrow popular mechanics from board games are considered off topic" ([off-topic wiki](https://www.reddit.com/r/boardgames/wiki/off-topic)); promotion needs a 10:1 activity ratio ([wiki](https://www.reddit.com/r/boardgames/wiki/contribution-guides)) | **No** |
| r/partygames | — | Private | **No** |
| r/iosgaming | 127 K | Dev self-promotion only in the Saturday megathread, only for iOS game apps; "standalone websites" not allowed | **No** |
| r/AndroidGaming | 297 K | Google Play Store link required; account 1 month old with 50 karma | **No** |
| r/de | 706 K | "Keine Selbstwerbung" | **No** |
| r/germany | 551 K | "We absolutely don't allow any self-promotion" | **No** |
| r/Austria | 268 K | "Keine externen Umfragen, Werbung…" | **No** |
| r/couchcoop | 199 | — | Too small |

Do not post the same day in several subs; space them over two weeks and answer every comment `[INFERENCE]`.

### 2.3 Hacker News in practice

- **Timing.** Best slots by share of posts reaching 50+ points (2021 on): Monday 00:00 UTC 10.8 %, Sunday 02:00 UTC 9.8 %, Saturday 19:00 UTC 9.2 %; worst Thursday 06:00 UTC 2.6 % ([Dan King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)). For a team in Germany, **Saturday 20:00 CET** is the humane choice.
- **What a hit brings.** One front-page hour gave 35–40 unique visitors a minute, about 4,000 that hour and about 8,000 over four days; devices were about 50:50 desktop and mobile ([Marco Maier](https://marcotm.com/articles/stats-of-being-on-the-hacker-news-front-page/)). A Show HN is "a pulse": about 92 % of the GitHub star gain is over after 48 hours, roughly 1.4 stars per point ([Dan King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)).
- **What does well.** In 2025 "DIY Hardware IoT Projects" had the best odds of 100+ points; AI topics did worst once past 10 points ([Sturdy Statistics](https://blog.sturdystatistics.com/posts/show_hn/)). A physical trick with phones on a table is closer to the first group `[INFERENCE]`.
- **A flop is not final.** Gametje scored 5 points in September 2024 and 112 in November 2025 ([first](https://news.ycombinator.com/item?id=41519878), [second](https://news.ycombinator.com/item?id=45887709)). The rule for a second Show HN is a "significantly different" version, "once or twice a year" at most ([dang](https://news.ycombinator.com/item?id=22336638)).

### 2.4 Product Hunt: why not now

Featuring is "an editorial decision", judged on originality, "a clear edge", plain language and "It actually works" ([PH Launch Guide 2](http://help.producthunt.com/en/articles/17734341-2-what-kind-of-products-get-featured)). A launch that is not featured "still goes live", reachable through "See all of today's products". PH's own guide recommends being active on PH "weeks earlier". Its audience is "early adopters, makers, product people, founders, investors" ([Guide 1](http://help.producthunt.com/en/articles/17734306-1-how-product-hunt-works)), not people at a party table `[INFERENCE]`. Secondary sources claim featured rates fell to about 10 % ([shno.co](https://www.shno.co/marketing-statistics/product-hunt-launch-statistics), unverified). If you do it: a Saturday or Sunday, live at 09:01 CET in winter, a personal account, the 20-second clip as launch media, and nobody asked to upvote.

### 2.5 Web-game portals do not fit

- **CrazyGames:** text must be readable at desktop iframe sizes such as 907 × 510 px; "Games should land new users in gameplay immediately", at most 1 click; English required; no cross-promotion ([gameplay requirements](https://docs.crazygames.com/requirements/gameplay/)). Online multiplayer on its multiplayer page needs a CrazyGames account, SDK room data and CrazyGames usernames shown in game ([multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/)).
- **Poki:** "Every game on Poki is hand-picked", and Poki asks for **web exclusivity**: "you can't publish the same game on other web portals" ([Working with Poki](https://developers.poki.com/guide/working-with-poki)).
- A portal visitor arrives alone on one device. A Game that needs two phones on a table cannot "land in gameplay" in one click `[INFERENCE]`. Exclusivity would also clash with an open-source web app.

### 2.6 Showcases and newsletters

| Outlet | How to submit | Note |
|---|---|---|
| JavaScript Weekly, Frontend Focus (Cooperpress) | Form at [cooperpress.com/submit](https://cooperpress.com/submit); "we make no guarantee of inclusion" | Send a technical article, not the app. "How four phones agree on the time within 2 ms" fits |
| Web Weekly (Stefan Judis, German freelancer, 6,443 readers) | No submission form found on [webweekly.email](https://webweekly.email/); contact through his site | Covers web-platform details; WebRTC data channels and the Wake Lock API fit `[INFERENCE]` |
| Codrops | Free form with a "Demo or experiment for the Creative Hub" topic; GitHub repo link required; 500 characters ([Codrops](https://tympanus.net/codrops/contact/)) | After the landing page looks good |
| Awwwards | €65 per website ([Awwwards](https://www.awwwards.com/submit/)) | Judges site design. Skip until the landing page is polished |
| Experiments with Google / Chrome Experiments | The site "will continue as a rich archival gallery"; "the action will live on at labs.google" ([experiments.withgoogle.com](https://experiments.withgoogle.com/)); the old submit page returns 404 | Skip. Note that "Racer" (2013), the closest prior art, was a Chrome Experiment |

### 2.7 Press

- **heise Make (German maker magazine):** "Sie haben ein spannendes Projekt gebaut? Dann schicken Sie uns eine E-Mail mit einer kurzen Beschreibung und Fotos, Videos oder weiterführenden Links an mail@make-magazin.de" ([heise](https://www.heise.de/make/projekt-eingabe)). The best fit among German outlets `[INFERENCE]`.
- **t3n:** "Themenvorschläge, Artikelideen oder ähnliches könnt ihr uns gerne an redaktion@t3n.de übermitteln" ([t3n](https://t3n.de/presse/presseinformationen/)). t3n writes for "Digital Pioneers" and business readers; pitch the no-install, phone-to-phone angle.
- **GameStar:** I found no submission address. Its team page lists writers with an indie focus (for example Elena Schulz, "unbekannte Indies", [GameStar](https://www.gamestar.de/videos/elena-schulz,144786_58)). Pitch one person, short and personal.
- **How journalists want it** ([GamesIndustry.biz, 2022](https://www.gamesindustry.biz/getting-your-game-covered-as-told-by-journalists)): a subject line with a hook; who you are, platform, release state; one sentence on the game; a GIF or image in the mail; one paragraph; a playable link ("'Thing exists... and you can try it right now!'"); say what you want; follow up once. Avoid form letters, sympathy pleas ("your coverage could really save my game") and unsolicited attachments. Horizontal images: "Mobile devs: get me some horizontal images."

### 2.8 Events, jams and playtest nights

| Event | Date | Use |
|---|---|---|
| Local playtest night in a bar or board-game café | From week 2 | Footage, real join rates, quotes. Ask the owner first; bring 6 charged phones, a sign "phones together, one game", the QR cards and a consent sheet |
| Local hackspaces (the CCC site lists events at several of them in November 2026) | Ongoing | Technical crowd, honest feedback ([ccc.de](https://www.ccc.de/en/updates/2026/40c3-model-citizens)) |
| 40C3, Chaos Communication Congress, Hamburg | 27–30 Dec 2026 ([CCC](https://events.ccc.de/congress/2026/infos/startpage.html)) | Thousands of people with phones at tables; cards in your pocket `[INFERENCE]` |
| Global Game Jam | 25–31 Jan 2027 ([GGJ](https://globalgamejam.org/)) | Invite jammers to make a Game on the SDK; it shows the platform idea |
| A MAZE. / Berlin, games and playful media festival | 5–8 May 2027 ([a-maze.net](https://a-maze.net/)) | Award submission; a Facebook post names a 10 Feb deadline ([A MAZE.](https://m.facebook.com/amaze.festival/photos/a-maze-awards-submission-deadline-extendedwere-getting-so-many-submssions-that-w/1029833099172085)) `[confirm on the site]` |

## 3. What content works for this product

### 3.1 Ten examples, with numbers

| # | Clip or launch | Where, date | Result (read 2026-11-11) | Length | The hook |
|---|---|---|---|---|---|
| 1 | "Entangled", Bjørn Staal | [X, 2023-11-22](https://x.com/_nonfigurativ_/status/1727322594570027343) | 10,203,837 views, 62,686 likes (via api.fxtwitter.com); the template repo has 18,895 stars ([GitHub](https://github.com/bgstaal/multipleWindow3dScene)) | screen recording | Two browser windows; drag one and the particles flow toward the other ([fxhash](https://www.fxhash.xyz/article/entangled:-the-story)). No words, only the effect |
| 2 | A copy of #1 | [Show HN, 2023-11-25](https://news.ycombinator.com/item?id=38413660) | 403 points; repo created 2023-11-23 10:03 UTC, about 20 h after the original ([GitHub](https://github.com/Momciloo/fun-with-sockets)) | — | "I saw this mind-blowing experiment, so I made a simple version of it" |
| 3 | Infinite Craft launch post, Neal Agarwal | [X, 2024-01-31](https://x.com/nealagarwal/status/1752716375255101440) | 21,202,695 views, 38,318 likes | one line + link | Playable at once in the browser, nothing to install |
| 4 | "Racer: A Chrome Experiment" | [YouTube, 2013-05-15](https://www.youtube.com/watch?v=KOCM9_qGccY) | 288,590 views; its soundtrack video 2,137,660 ([YouTube](https://www.youtube.com/watch?v=YT0k99hCY5I)) | 60 s | A slot-car track across up to five phones and tablets; "No apps. No downloads." |
| 5 | Pinch, Tokyo University of Technology | [YouTube, 2012-10-31](https://www.youtube.com/watch?v=jRGLkj-PsCc) | 133,203 views | 142 s | A pinch across two screens joins them |
| 6 | Galaxy S4 "Group Play" demo | [YouTube, 2013-05-01](https://www.youtube.com/watch?v=Vb7DpMaqM-g) | 182,449 views | 313 s | Several phones on a table become one surround speaker system and play multiplayer games together |
| 7 | Swip.js golf demo | [YouTube, 2016-10-18](https://www.youtube.com/watch?v=ZE0gxa-p8HY) | 27,704 views; Show HN 152 points; repo 2,091 stars ([GitHub](https://github.com/paulsonnentag/swip)) | 82 s | A golf ball rolls from phone to tablet |
| 8 | "Turn Your Phone Into a Game Controller!" (AirConsole), Tech By Meet | [YouTube Shorts, 2025-06-10](https://www.youtube.com/watch?v=-LQPDZ9M0dQ) | 2,709,797 views | 17 s | "an amazing website called AirConsole.com": the site is the reveal. A similar 16-s Short with "airconsole com" in its title got 255,901 views ([StyledByAva, 2026-03-06](https://www.youtube.com/watch?v=KO7Lq5NpnAI)) |
| 9 | "Ball Bounce on iPhones", SimRush3D | [YouTube Shorts, 2026-09-23](https://www.youtube.com/watch?v=JP3MD_R71ZI) | 40,021 views | 5 s | A **3D animation** of exactly this project's trick: a ball hopping along a row of iPhones, looped |
| 10 | Gaming Couch | [Show HN, 2025-12-21](https://news.ycombinator.com/item?id=46344573) | 437 points, 121 comments | text post | Clear "TL;DR", "no apps, no accounts", backstory, honest comparison with Jackbox and AirConsole |

What did **not** travel, for contrast:

- "Air hockey. Two phones. No table." from a new channel: 17 views ([RoadPlay, 2026-11-01](https://www.youtube.com/watch?v=Oo3szvlPeJM)). Same idea as this project's Air Hockey, no audience behind it.
- "iPhone Duo Alternative: Two Android Phones Become One Big Screen for $0": 364 and 449 views ([long](https://www.youtube.com/watch?v=KXF2IFmliGU), [short](https://www.youtube.com/watch?v=S_XVIL5fqP8), September 2026), an app called ScreenSpan.
- "Multi-Phone Ball Game": 205 views since 2017 ([YouTube](https://www.youtube.com/watch?v=QxAj1Xbzvdo)).
- "Bounces through phones": 7,442 views in 8 seconds of footage ([YouTube, 2024-05-31](https://www.youtube.com/watch?v=mISRrQ8ysok)).

Two lessons `[INFERENCE from the table]`. First, the concept itself draws views: a fake 3D render of it got 40 K in seven weeks. Second, a single post from a fresh account rarely does. The big numbers came from accounts with an audience (Google, tech-tip creators) or from regular posting until one clip caught on. DREADMOOR's case says the same: algorithms "rarely reward you immediately… if you post consistently, the chances of catching a wave increase", and one free post by a large curator brought 2.5 M views in 24 hours ([Game World Observer](https://gameworldobserver.com/2026/05/21/case-study-how-dreadmoor-reached-200000-wishlists-and-where-they-came-from)).

### 3.2 Format rules derived from the examples

1. **The trick in the first 1–2 seconds.** #1 and #9 consist of nothing but the effect; Racer's description leads with it ("Speed across multiple screens"). I did not frame-check the openings of the others. Start mid-rally with the ball already crossing a bezel. No logo intro, no "hi, we made…" `[INFERENCE]`.
2. **Show, then explain.** Explanation comes after the viewer has seen it work, or in the caption.
3. **Real hands, real table, one continuous take** while the ball crosses. Since a 3D fake of this trick exists (#9), viewers must be able to see it is real `[INFERENCE]`: no cut during the crossing; a hand in frame; slightly imperfect alignment is fine.
4. **Top-down, vertical 9:16**, phones filling the frame; screens at full brightness, room light low enough that screens do not wash out `[INFERENCE]`.
5. **Sound:** the game's own sounds and the table (laughs, taps) as original audio. It doubles as proof that it is live. Licensed music only from TikTok's Commercial Music Library or YouTube's Audio Library (§4.5).
6. **Captions burned in.** One line on top, for example "6 phones, 1 ball". Keep text out of the bottom fifth, where the apps put their buttons `[INFERENCE]`.
7. **Length:** 5–20 s for trick clips (#8: 17 s, #9: 5 s, the TikTok above: 21 s); 30–60 s for dev-log clips.
8. **The name and the address on screen in the last 2 seconds, and said out loud.** The 255,901-view Short in #8 put the address in its title. A QR code inside a phone video cannot be scanned by the phone playing it `[INFERENCE]`; use a short typed address and "link in bio". Keep QR codes for paper.
9. **Loop it:** end on a frame that leads back into the first one (#9 loops).
10. **One question in the caption** that is easy to answer ("How many phones does your group have?"). Answer every comment in the first hour `[INFERENCE]`.

## 4. Content plan

### 4.1 Twenty post ideas

S = the same short clip on TikTok, Reels (trial) and Shorts. D = dev audience: a Mastodon/Bluesky thread, r/javascript or r/webdev, and later the devlog. R = Reddit (sub named). Ideas 6 and 7 need consent forms (§6).

| # | Hook (on screen, first 2 s) | Shot list | Where |
|---|---|---|---|
| 1 | "6 phones. 1 ball." | Overhead, 6 phones in a row, a Pong rally crosses all six in one take; end card with the address | S; R r/LocalMultiplayerGames |
| 2 | "What if someone steals a phone mid-game?" | Rally; a hand pulls phone 3 away; the others show "Waiting for phone 3"; it goes back; play resumes | S |
| 3 | "Same ball size on every phone" | A small iPhone next to a big Android; the lobby grid lines continue across the bezels; then the ball crosses at the same size | S; D (world millimetres) |
| 4 | "The iPhone Duo costs $1,999. These two phones cost nothing extra." | Two old phones side by side, Air Hockey. Apple announced its foldable in September 2026 at $1,999, on sale since 23 October ([PopSci](https://www.popsci.com/gear/apple-event-announcements-fall-2026-iphone-duo-apple-watch-12-iphone-18/)); factual comparison only | S |
| 5 | "From zero to playing in 10 seconds" | Stopwatch overlay: open the address, scan the QR code with two phones, lay them down, Start | S; landing page loop |
| 6 | "Grandma vs. the 14-year-old" | Family Air Hockey at a holiday table; faces only with consent (a parent's for minors) | S, week 6 |
| 7 | "Strangers in a bar try it for the first time" | Hands and voices by default; faces only with written consent; first reaction when the ball crosses | S |
| 8 | "Why it breaks on an iPhone hotspot (and what works)" | 40 s talking over a hand-drawn sketch; link to `docs/research/` | S (Shorts); D |
| 9 | "Our phones agree on the time within 2 ms" | Four phones flash white at one shared-clock instant, filmed in slow motion; then the number | S; D; newsletter pitch |
| 10 | "A whole game in about 100 lines" | Screen capture: `pnpm new-game`, edit three lines, the new Game appears on two phones | D; R r/javascript |
| 11 | "Swiping down killed our game 14 times in 30 minutes" | The pull-to-refresh bug from live test 1, then the fix | S; D |
| 12 | "Safari zoom made one phone think it was a third bigger" | Misaligned grid at 75 % zoom vs. the fixed alignment | S; D |
| 13 | "Snake on a square of four phones" | 2 × 2 grid Layout, snake crosses all four | S |
| 14 | "Breakout, four phones, one wall" | Grid Layout, balls cross between rows | S; R r/indiegames |
| 15 | "Quiz night: the table phone is the board, yours is the buzzer" | One phone flat, three held as Controllers; a quick round | S |
| 16 | "How many phones can we chain? Beat our record" | 8–10 phones from friends, one rally; ask viewers to send theirs | S |
| 17 | "Strangers kept asking the name, so we printed cards" | The card, the QR code, someone scanning it | S; Bluesky |
| 18 | "Two phones, head to head" | Air Hockey with the phones facing each other across the table, two players | S; R r/LocalMultiplayerGames |
| 19 | "No Wi-Fi: every phone on its own mobile data" | A park bench or train; show it joining; honest about what fails | S; D |
| 20 | "Playtest night: N people, N bugs, 1 fix" | Montage from the night with the numbers on screen | S; R r/IndieDev |

### 4.2 Six-week calendar

Today is Wednesday 2026-11-11. Week 0 is the rest of this week. Posts: Tuesday, Thursday, Saturday `[INFERENCE: any fixed rhythm works; keep it]`.

| Week | Dates | Build and launch tasks | Posts (idea #) | Hours |
|---|---|---|---|---|
| 0 | 11–15 Nov | Decide the public name; reserve the same handle on TikTok, Instagram, YouTube, Bluesky, Reddit; order 100 cards; start commenting on HN and in the "Yes" subreddits; Metered quota alert (§5.3) | — | 4 |
| 1 | 16–22 Nov | Gate test 1: 10 joins by outsiders on mobile data, logs exported; filming session 1 | 1, 2, 3 | 6 |
| 2 | 23–29 Nov | Playtest night 1; landing page and contact option live ([`github-and-landing-site.md`](github-and-landing-site.md)); dev thread on the clock | 5, 17, 11 | 7 |
| 3 | 30 Nov–6 Dec | Gate test 2. If passed: r/playmygame (Tue), r/LocalMultiplayerGames (Thu), r/webdev Showoff Saturday (5 Dec) | 4, 18, 12 | 7 |
| 4 | 7–13 Dec | Launch week: technical devlog post (clock and hotspot); **Show HN Saturday 12 Dec, 20:00 CET**; then Cooperpress form; r/javascript | 9, 8, 10 | 10–12 |
| 5 | 14–20 Dec | Fix the top complaint and post "you asked, we fixed"; mail heise Make and t3n; r/IndieDev, r/indiegames, r/IndieGaming; Codrops | 13, 14, 19 | 7 |
| 6 | 21–27 Dec | Holiday tables: family clips; 40C3 starts 27 Dec; review the numbers; decide on Product Hunt, Discord and the next six weeks | 6, 16, 20 | 5 |

A normal week: filming 2 h (one session gives three clips), editing 2 h, posting and replies 1.5 h, a 30-minute review. If a week slips, drop a post, not the review `[INFERENCE]`. If gate test 2 fails, move weeks 3–5 back and keep posting clips: small accounts reach few strangers anyway, and their CTA can be "tell us if it connects" `[INFERENCE]`.

### 4.3 Filming setup under €50

| Item | Cost | Note |
|---|---|---|
| Camera | €0 | A spare phone, 4K/30 or 1080/60; slow-motion mode for idea 9 |
| Overhead mount | €0, or ≤ €25 | Free: a ruler or board across two chairs, or a stack of books at the table edge. Paid: an overhead phone arm; phone stands on a German price-comparison site ranged from €12 to €130 in November 2026 ([netzshopping.de](https://www.netzshopping.de/handy-stativ)) |
| Light | €0 | Daylight from the side; no lamp right above the phones (glare) `[INFERENCE]` |
| Background | €0 | A plain dark table or a dark cloth |
| Phones on the table | €0 | Friends' phones; auto-lock off, Do Not Disturb on, brightness up; tap each one once so it keeps its wake lock ([`running-on-phones.md`](../guide/running-on-phones.md) §Screen wake lock) |
| QR cards | €11.54 / 100 | [druckvergleich.org](https://www.druckvergleich.org/kosten-visitenkarten-preise-2026/), price from January 2026; 500 cost €17.71 |
| **Total** | **€12–37** | |

### 4.4 Free editing tools

| Tool | Platform | Note |
|---|---|---|
| Edits by Instagram | iOS, Android | Free video app from Meta, launched 2025-04-22 ([Instagram](https://creators.instagram.com/blog/edits-video-creation-app)) |
| DaVinci Resolve (free version) | Windows, Mac, Linux | "Free and paid versions" ([Blackmagic](https://www.blackmagicdesign.com/products/davinciresolve)); more than you need, good for the dev-log videos |
| The phones' own editors (Photos, iMovie, Google Photos) | — | Enough for trimming and a caption `[INFERENCE]` |
| CapCut | iOS, Android, desktop | Its June 2025 terms drew criticism over licence rights to user content; CapCut published a clarification ([CapCut, 2025-06-24](https://www.capcut.com/resource/about-capcut-terms-of-service), [DPReview](https://www.dpreview.com/news/1239418455/capcut-video-editing-app-s-new-terms-spark-rights-concerns-we-asked-a-lawyer-for-guidance)). Read the terms before you use it |

### 4.5 Music licensing

- **Default: no added music.** Game sounds and room sound are your own work; nobody can claim them.
- **TikTok:** the general "Sounds" library is for "personal entertainment and non-commercial purposes"; using it to promote "a brand or business" needs Commercial Sounds from the Commercial Music Library ([TikTok Music Terms, EEA](https://www.tiktok.com/legal/page/global/music-terms-eea/en)). A clip that points people to your app is promotion `[INFERENCE]`. Commercial Sounds are cleared on TikTok only ("Shared only within the Platform").
- **YouTube:** Audio Library tracks are "copyright-safe" on YouTube; Creative Commons tracks need the credit in the description ([YouTube Help](https://support.google.com/youtube/answer/3376882?hl=en)). The page does not say you may reuse them on TikTok or Instagram. Do not assume it.
- **Instagram:** I did not find a primary source on music rights for promotional Reels. Use original audio there.

## 5. Launch sequence

### 5.1 The gate: what must exist before the first public push

- [ ] **Stranger test passed:** 10 joins by people outside the team, every phone on its own mobile data, iPhone and Android mixed, logs exported; ≥ 9 reach a Match within a minute `[INFERENCE: our bar]`. Repeat after every connectivity change.
- [ ] **Strangers get a known-good build.** The `stable` tag points at a build that passed the test; the public button goes there ([`github-and-landing-site.md`](github-and-landing-site.md), Bottom line).
- [ ] **One public name**, the same handle everywhere, and the README, page title and home-screen label using it (same report, §1.2).
- [ ] **Landing page:** one sentence, the 10-second loop (idea 5), "Start a table", three steps, "every phone needs internet", the iPhone-hotspot limit, a press kit link, imprint and privacy (same report, §3.8).
- [ ] **Path for a laptop visitor:** the loop video, "open this on two phones" with a QR code, and the existing desktop route of two browser windows ([`README.md`](../../README.md) §Quick start). About half of HN traffic is desktop (§2.3).
- [ ] **Path for a visitor with one phone:** the Host screen says plainly that a second phone is needed and offers to share the link `[INFERENCE: check today's text]`.
- [ ] **A way to keep in touch:** an email form (Buttondown: free for the first 100 subscribers, [pricing](https://buttondown.com/pricing)) or RSS and GitHub "Watch → Releases" (same report, §3.10). The funding report's gate A asks for 300 subscribers ([`funding-and-kickstarter.md`](funding-and-kickstarter.md)).
- [ ] **Counts per channel** (§5.4).
- [ ] **Caps on the free relays** (§5.3).
- [ ] **Feedback route:** an issue form for "something went wrong at the table" (same report, §2) plus "Export log" on the Host's sheet.
- [ ] **Press kit:** the 20-second clip, 5 horizontal photos, a 50- and a 150-word description, contact.
- [ ] **Warmed accounts:** HN with three weeks of comments; Reddit accounts with real participation.
- [ ] **Consent sheet** printed for filming nights (§6).

### 5.2 Order

1. **Soft launch, weeks 1–3:** friends, playtest nights, the cards, three clips a week. Goal: real join rates and the first strangers' quotes, not reach.
2. **Communities, week 3:** r/playmygame, r/LocalMultiplayerGames, r/webdev Showoff Saturday. Small and on-topic; mistakes cost little.
3. **Show HN, week 4,** with the technical write-up linked in the first comment. Then the newsletter form and r/javascript the following days, with the same write-up.
4. **Press and design showcases, week 5:** heise Make, t3n, one GameStar writer, Codrops. Now you can cite numbers ("N tables in the first week").
5. **Product Hunt, week 6 or later, or never:** only with landing page, contact option and a working day-one experience, and only if weeks 3–5 show that people outside the team play.

Why this order `[INFERENCE]`: each step is bigger than the one before and harder to repeat (HN allows a repost "once or twice a year"; r/playmygame one post a month; PH asks for a relaunch request within two months). Small rooms find the bugs before the big rooms see them.

### 5.3 Preparing for a traffic spike

| Dependency | What happens in a spike | Before launch |
|---|---|---|
| **Public Nostr relays** (signaling) | Every visitor who opens the app becomes a Host and opens connections to 5 of 29 third-party relays (§1). A front-page hour brought about 2,100–4,000 visitors in the one case measured (§2.3). I found no published rate limits for these relays. | Put the static landing page in front, so the app starts only on "Start a table". Pin a short list of relays that worked in your tests: Trystero accepts `relayConfig.urls` ([`docs/research/table-hub-device.md`](../research/table-hub-device.md)). Optional: your own relay on a small server from €5.49 a month excl. VAT ([Hetzner](https://www.hetzner.com/cloud/)) `[INFERENCE: not tried]` |
| **Metered TURN relay** | Used only when a direct path fails; about 110 MB per relayed Peer-hour; the free allowance may be 500 MB (about 2 Peer-hours) or 20 GB ([`internet-carried-sessions.md`](../research/internet-carried-sessions.md)). The credentials are public in the JavaScript, so anyone can use them. | Check the plan in the dashboard. Set a project quota: Metered offers "notify only, disable credentials, or none" ([Metered](https://www.metered.ca/stun-turn)). Choose "notify" during launch week and watch it; a disabled relay breaks joins for exactly the phones that need it `[INFERENCE]` |
| **GitHub Pages** | Soft limit 100 GB bandwidth a month; rate limits can answer HTTP 429 ([GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). The app is 82 KB gzipped JavaScript ([`github-and-landing-site.md`](github-and-landing-site.md) §1.1). | Keep the landing loop video small; host it on YouTube or a CDN if it grows `[INFERENCE]` |
| **You** | Comments arrive faster than you can answer | Two people on shift for the first 6 hours; a short FAQ ready: hotspot, needs internet, privacy, why open source |

### 5.4 Measuring results

- **Tag every link with its channel** on the landing page address: `…/?src=hn`, `?src=card`, `?src=tt`. The app reads only `room` from the query ([`apps/pwa/src/main.ts`](../../apps/pwa/src/main.ts) line 66–67) and rebuilds the join QR with `?room=` only ([`hud.ts`](../../apps/pwa/src/hud.ts) line 129), so an extra `src` does no harm. Counting it needs analytics on the page.
- **Analytics:** Cloudflare Web Analytics is free and needs no DNS change ([Cloudflare](https://developers.cloudflare.com/web-analytics/)); GoatCounter is the other report's pick ([`github-and-landing-site.md`](github-and-landing-site.md) §3.11); Plausible costs from $9 a month and has custom events ([Plausible](https://plausible.io/#pricing)).
- **The one number that matters:** Sessions where a Match started with two or more Devices, per week, by people outside the team. This needs one event in the app ("Match started, N phones", no ids). It is also the funding report's gate A metric ([`funding-and-kickstarter.md`](funding-and-kickstarter.md)).
- **Weekly sheet, 30 minutes:**

| Week | Channel | Post (link) | Views | Clicks (`src`) | Matches started | Email sign-ups | Notes |
|---|---|---|---|---|---|---|---|

- Judge clips after 72 hours (trial reels report after 24 h and auto-share within 72 h, [Instagram](https://creators.instagram.com/blog/instagram-trial-reels)). After six weeks, keep the two formats with the most clicks per view and drop the rest `[INFERENCE]`.

### 5.5 Responding to feedback

- **Be in the thread for the first two hours** of every post. On HN "Ask questions out of curiosity" applies to you too ([Show HN guidelines](https://news.ycombinator.com/showhn.html)).
- **Thank, ask, log.** "Which phone and browser? Could you tap Export log and send it?" Every report goes into `.scratch/` as the repo's tracker ([`docs/agents/issue-tracker.md`](../agents/issue-tracker.md)).
- **Do not argue about taste.** Answer facts once; let readers judge.
- **Close the loop in public:** fix the top complaint within a week and post "you asked, we fixed" (week 5). It is also good content `[INFERENCE]`.
- **Known limits up front:** state the iPhone-hotspot limit and "every phone needs internet" in the post, before someone finds them.

### 5.6 The existing signal: strangers asking for the name

Act on it this week. Card, 85 × 55 mm:

> **Front:** *[Name]*. Phones side by side. One game.
> [QR code] *short address*
>
> **Back:** 1. Open the address on one phone. 2. Scan its code with the others. 3. Lay them side by side, press Start.
> Free, no app, no account. Every phone needs internet.
> *@handle* · *email*

- The QR code goes to the landing page with `?src=card`, not to the app: a stranger reading the card alone in the bus has no second phone yet `[INFERENCE]`.
- Print the address in letters under the QR code. "Bezel" alone leads to a watch app in the stores.
- Hand out cards only when asked; note date and place on a list, and count `src=card` visits a week later.
- Wait for the name decision and, if you buy one, the domain before you print ([`github-and-landing-site.md`](github-and-landing-site.md) §3.5).

### 5.7 Text skeletons (rewrite in your own words)

HN asks for text written by hand, with no LLM involved ([dang](https://news.ycombinator.com/item?id=22336638)). Treat these as checklists, not copy.

**Show HN title** (≤ 80 characters): `Show HN: Phones laid side by side become one game board, in the browser`

**First comment, in this order:** what it is in one sentence · the link · how to try it (two phones, or two browser windows on a laptop) · why you built it (the evening with friends) · how it works (one Host, WebRTC star, Trystero over Nostr, NTP-style clock within ~2 ms, Layout in millimetres) · what breaks (iPhone hotspot, every phone needs internet) and the research link · that it is open source and has an SDK · what feedback you want.

**r/LocalMultiplayerGames post:** title "[Name]: put your phones side by side and play Pong across all of them (free, browser)" · the clip · two sentences on how it plays · "I'm one of the two people making it" · the link · one question ("How many phones do you usually have at a table?").

**Press email (games or tech press):**
Subject: *Six phones on a table become one Pong court, no app needed*
Body: who we are (two/three hobby developers, city) · one sentence · the GIF inline · one paragraph: how it plays, what is new (phones as one surface, not controllers), state (free, open source, playable now) · what we offer (a quick video call, a playtest, the press kit) · links: play, press kit, repo.

**heise Make (German, short):**
Betreff: *Projekt: Mehrere Handys nebeneinander werden ein Spielfeld – im Browser, ohne App*
Ein Satz, was es ist · 2–3 Fotos oder ein kurzes Video im Anhang oder als Link · wie es technisch funktioniert (WebRTC, eine Uhr auf ±2 ms) · Link zum Spiel und zum Code · wer wir sind.

## 6. Risks

| Risk | Evidence | What to do |
|---|---|---|
| **Copycats** | "Entangled": a public copy about 20 h later, 403 points on HN (§3.1). Similar products appeared this autumn: ScreenSpan (two Android phones as one screen over Wi-Fi Direct, [YouTube](https://www.youtube.com/watch?v=S_XVIL5fqP8)), RoadPlay (air hockey on two phones, [YouTube](https://www.youtube.com/watch?v=Oo3szvlPeJM)), "Ping Pong for Duo" for the foldable iPhone ([YouTube](https://www.youtube.com/watch?v=Eypx9oXMmlE)). The code is MIT-licensed ([`LICENSE`](../../LICENSE)). | Cannot be prevented. Answer with speed, a findable name, regular clips and Games others build on your SDK. A trademark question belongs to the name decision `[INFERENCE]` |
| **Burning a launch before strangers can connect** | HN reposts only for a "significantly different" version; r/WebGames and r/playmygame limit reposts; PH relaunch within two months needs a request (§2) | The gate in §5.1. Small rooms first (§5.2) |
| **Self-promotion rules** | §2.2: several large subs ban it outright; HN and PH ban vote requests; r/InternetIsBeautiful runs a 90/10 rule | Participate before posting; one post per sub per window; never ask friends to upvote |
| **Filming recognisable people** | Germany: pictures of people "dürfen nur mit Einwilligung des Abgebildeten verbreitet oder öffentlich zur Schau gestellt werden" ([KUG § 22](https://www.gesetze-im-internet.de/kunsturhg/__22.html)). Exceptions include people as mere "Beiwerk" next to a place and crowds at gatherings, but never against the person's "berechtigtes Interesse" ([KUG § 23](https://www.gesetze-im-internet.de/kunsturhg/__23.html)). Austria: no publication that harms the "berechtigte Interessen" of the person shown ([UrhG § 78](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001848&Paragraf=78)). Data-protection law may apply as well `[not researched]` | Hands and phones by default. A one-line consent on paper or said on camera before filming faces ("I agree that [name] may post this video on social media"). Parents' consent for minors. Delete on request. A bar's guests in the background are not "Beiwerk" if they are the subject of the clip `[INFERENCE]` |
| **Music claims and muted videos** | TikTok may "remove or mute your video" for unlicensed music ([TikTok Music Terms](https://www.tiktok.com/legal/page/global/music-terms-eea/en)) | Original audio (§4.5) |
| **Name confusion** | "Bezel" collides with a watch marketplace and a phone-mirror app ([`github-and-landing-site.md`](github-and-landing-site.md) §1) | Decide before printing or posting the first clip with a name in it |
| **Free relays fail under load or abuse** | §5.3 | Landing page in front; pinned or own Nostr relays; TURN quota alert |
| **The content treadmill** | DREADMOOR needed months of regular posts before one hit (§3.1) | Fix the hours (§4.2); batch filming; drop posts, not the review |
| **Promising more than exists** | Journalists: "I can sniff when something is off about your game" ([GamesIndustry.biz](https://www.gamesindustry.biz/getting-your-game-covered-as-told-by-journalists)) | Show only Games that work for strangers; label the others "experiments" |

## 7. Open questions for the makers

1. What is the public name, and will you buy a domain before the cards are printed?
2. Who is willing to appear on camera, with face and voice? Who films and edits?
3. How many hours a week can you keep up for six weeks: 5, 7 or more?
4. Which Metered plan does the account have (500 MB or 20 GB), and what should happen at the limit?
5. Who is the first audience: people at party tables (short video, local events) or developers who might build Games (HN, r/javascript, newsletters)? The plan does both; if you must pick one, which?
6. English only, or German clips for the local playtest nights and heise/t3n?
7. Which bar, board-game café or hackspace near you would host a first playtest night?
8. Do you want an email list now, or RSS and GitHub Releases until there is something to announce?
9. Are you going to 40C3 (27–30 Dec)?
