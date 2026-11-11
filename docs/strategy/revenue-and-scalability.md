# Revenue, running costs and scalability

Researched 2026-11-11 for the makers of Bezel (this repo, `MobileGameConnect`). Every price, fee and rule below was read on that date from the linked page. `[INFERENCE]` marks my own reasoning or arithmetic. "Secondary" marks a source that reports on someone else's numbers. Repo facts are cited by path. **This is not legal or tax advice.** Before you take money, one hour with a Steuerberater (DE) or Steuerberater/Wirtschaftstreuhänder (AT) is worth it.

Words as in `GLOSSARY.md`: a **Session** is one table of phones, the **Host** is the phone that runs the Game, a **Peer** is any other phone, a **Tile** is a phone lying in the Layout, the **Relay** is the TURN server that carries a connection when no direct path works.

## Bottom line

- **Do not build a paywall, a subscription, a marketplace, hardware or ads now.** Nothing in the repo measures whether strangers come back. Each of those models needs that number first.
- **The model to test first: free core, and the Host pays once.** That is Jackbox's model ("Only one person in your group needs to own a Jackbox product", [Jackbox](https://www.jackboxgames.com/how-to-play)). AirConsole's is close: "one Hero in a session removes ad-breaks for everyone" ([AirConsole](https://www.airconsole.com/hero)). It needs no accounts, because only the Host phone has to be unlocked.
- **The cheapest test: a pay-what-you-want "Support Bezel" checkout link** (from €3) on the result card and on the landing page, for 4–6 weeks, with no unlock code at all. Cost: €0 fixed; fees of about 10–16 % on a €5 payment; about 2 working days including the legal pages (§2.5).
- **Sell through a merchant of record (MoR)**, so the provider owes the EU VAT, not you. Lemon Squeezy: 5 % + 50¢, plus 1.5 % outside the US, licence keys included. Stripe Managed Payments: the normal Stripe fee plus 3.5 %, with Germany and Austria eligible (§2.2).
- **Before the first euro:** an Impressum and a privacy page, a decision on who the seller is, a trade registration, and a check of the small-business VAT rule (DE: €25,000/€100,000; AT: €55,000). See §6.
- **Running costs are close to zero today. The first thing to break is the Metered TURN allowance.** At the measured ~6 MB an evening, a 500 MB trial lasts about 80 evenings a month. One worst-case Session (four phones on mobile data, one hour, every Peer relayed) bills about 0.66 GB, more than the whole trial. Check the Metered dashboard this week (§3.5).
- **At scale, Cloudflare Realtime TURN is the cheapest Relay you do not run yourself.** It costs $0 up to about 3,700 worst-case Sessions a month and about $85 at 10,000. At those 10,000 worst-case Sessions, Metered would be about $959 and Twilio about $1,320 (§3.3). Your own coturn server costs €5.49–6.49 a month at Hetzner, plus your time.
- **The second weak point is signaling.** Every Device uses the same five volunteer Nostr relays, picked from the app id. One of them rate-limited the app in two logged runs. Your own relay is a configuration change plus a small server; do it once Sessions reach the hundreds a month `[INFERENCE]`.
- **GitHub Pages is not a bandwidth problem**: one cold load is ~87 KB, and the soft limit is 100 GB a month. But its terms rule out "your online business, e-commerce site". Move the hosting before a paid unlock lives in the app.
- **Licence: keep MIT for the platform and the SDK, keep future paid Game packs outside it, and protect the name, not the code.** The trade-off: published MIT versions can never be taken back, so anyone may host a copy. Note that the name "Bezel" is already used by a US watch-marketplace app in the App Store ([App Store](https://apps.apple.com/us/app/bezel-authenticated-watches/id1586195658)).

## 1. Inputs taken from the repo

| Input | Value | Source |
|---|---|---|
| State stream (Pong, 60 states a second) | 18.4–19.5 KB/s of JSON per Peer, about 320 B a state | `.scratch/live-test-1/findings.md` |
| On the wire through a Relay | ~25 KB/s Host → Peer and ~5 KB/s back, so **~110 MB per relayed Peer-hour** | `docs/research/internet-carried-sessions.md` §2 (arithmetic from the measured stream) |
| Host upload measured on phones | 31–38 KB/s with three phones in a Session | `.scratch/live-test-1/findings.md` |
| Envelope overhead | about 235 B per frame, on top of the Game's state | `.scratch/snake/friction.md` |
| One test evening, Pong + Air Hockey | ~6 MB of TURN usage | the makers' own report (not in the repo) |
| Relay | Metered; the credential is baked into the build (`VITE_MGC_TURN_SERVERS`) | `apps/pwa/src/turn.ts`, `.github/workflows/pages.yml` |
| When a Peer uses the Relay | after 3 failed direct attempts it joins relay-only | `RELAY_AFTER` in `apps/pwa/src/main.ts` |
| Signaling | Trystero over Nostr. It uses 5 of 29 default relays, chosen deterministically from the app id `mobilegameconnect`. For this app that is `relay.nostr.blockhenge.com`, `relay.flashapp.me`, `relay.nostrmap.net`, `relay.bullishbounty.com` and `relay.novospes.com` | `@trystero-p2p/nostr` 0.26 `dist/index.mjs` lines 5 and 258–288, `@trystero-p2p/core` `utils.mjs` line 45; list computed with Node on 2026-11-11 |
| Signaling rate limit seen | `relay.nostrmap.net`: "rate-limited: max 30 events/60s" | `docs/liveLogs/mgc-XHZE-host-…txt` line 88, `…-peer-…txt` line 5421 |
| Hosted app | 86.6 KB transferred per cold load (82.5 KB of gzipped JS), `Cache-Control: max-age=600`, no service worker | my HTTP GET of `https://manubown.github.io/Bezel/` on 2026-11-11; `docs/guide/running-on-phones.md` |
| Room codes | 4 characters from a 31-letter alphabet: 923,521 codes, no password | `apps/pwa/src/main.ts` (`CODE_ALPHABET`), `TrysteroTransport` is created without `password` |
| Size of a Session | the Games accept at most 4 Tiles (Pong, Pass, Tap Race, Snake, Breakout), 2 Tiles (Air Hockey), or 1 board plus 4 Controllers (Quiz) | `games/*/src/index.ts` manifests |
| Licence and authorship | MIT; all 40 commits by one author; the repo is public and was created on 2026-11-07 | `LICENSE`, `git shortlog`, GitHub API |

## 2. Revenue models

### 2.1 The options at a glance

| Model | Who pays | Reference, with published numbers | Effort | Main risk | Verdict |
|---|---|---|---|---|---|
| **One-time supporter / Host unlock** | the Host, or a fan | AirConsole sells "Hero for lifetime" at 34,99 € and monthly at 7,99 € ([App Store DE](https://apps.apple.com/de/app/airconsole/id1017688554), in-app purchase list) | low | small amounts | **test first** (§2.5) |
| **Free core + paid Game packs** | the Host (one buyer per table) | Jackbox Party Packs cost $24.99–29.99, Pack 12 $29.99 ([weekend.com](https://www.weekend.com/post/jackbox-price), secondary; [Xbox store](https://www.xbox.com/en-US/games/store/the-jackbox-party-pack-12/9nsl3hh3h023)); only the host owns it ([Jackbox](https://www.jackboxgames.com/how-to-play)) | medium: packs must exist, plus a key check | needs Games worth paying for; MIT lets anyone strip the check | step 2, only if the test passes |
| **Subscription** | the Host | AirConsole Hero 7,99 € a month; the free tier allows "a maximum of 2 players, with ads" ([App Store US](https://apps.apple.com/us/app/airconsole/id1017688554)) | high: recurring billing, restore, a content treadmill | party games are played now and then, so people cancel `[INFERENCE]`; AirConsole also sells a lifetime option | skip |
| **Platform/SDK with a revenue share** | players pay the platform; the platform pays Game developers | AirConsole: 30 % goes to the app stores, and 70 % of the rest goes to Games pro rata by minutes played, so a developer gets 49 % of gross ([AirConsole developers](https://developers.airconsole.com/developer-revenue-share)). itch.io lets each seller choose the platform's cut ([itch.io FAQ](https://itch.io/docs/creators/faq)) | very high | no outside developers yet; sandboxing (M3) not built | not before M3 and loading Games from a URL (§4) |
| **B2B: bars, cafés** | the venue | Kahoot's business model is the same "host pays" shape: it charges per host, participants join free; 360 Pro starts at $19 per user a month, billed yearly ([PanQuiz](https://www.panquiz.com/en/blog/kahoot-pricing/), secondary, a competitor) | medium (selling) | guests bring their own phones, so the venue gains little `[INFERENCE]` | ask 5 owners, build nothing |
| **B2B: events, team building, trade-fair stands** | the organiser or agency | Jackbox runs a page for events and offers "bulk purchasing, discounts" ([Jackbox for events](https://hello.jackboxgames.com/jackbox-for-events/)) | high per deal (custom work) | the star topology suits 4–6 Devices (ADR-0002); Stripe Managed Payments excludes "live in-person events" and "professional services" ([Stripe](https://docs.stripe.com/payments/managed-payments/eligibility)) | only on an inbound request; invoice directly |
| **Schools** | the school | Kahoot sells separate school and district plans per teacher (same secondary page; I found no primary price list) | high | minors' data, school procurement, phone rules in schools `[INFERENCE]` | skip |
| **Licensing / white-label for brands** | a brand or agency | AirConsole is built into BMW, VW, Audi, Porsche, Škoda and Tata cars, "more than 5 million" vehicles ([TNW](https://thenextweb.com/news/airconsole-zeekr-geely-paris), secondary). VW US launched it with 20 games ([VW media](https://media.vw.com/releases/1937)) | high | needs a proven platform and audience; MIT lets a brand build it without you | later |
| **Hardware: a pocket hub** | the buyer | a GL.iNet Opal travel router at $39.99 already does the "be the Wi-Fi" job (`docs/research/table-hub-device.md`) | very high | CE/RED conformity ([Directive 2014/53/EU](https://eur-lex.europa.eu/eli/dir/2014/53/oj)), WEEE registration at [stiftung ear](https://www.stiftung-ear.de/), packaging registration in [LUCID](https://lucid.verpackungsregister.org/), stock, returns | skip; recommend a router instead |
| **Donations / sponsorship** | fans | GitHub Sponsors takes 0 % from personal sponsors and up to 6 % from organisations ([GitHub Docs](https://docs.github.com/en/enterprise-cloud@latest/sponsors/sponsoring-open-source-contributors/about-sponsorships-fees-and-taxes)). Ko-fi takes 0 % on donations ([knowyourcut](https://knowyourcut.com/blog/kofi-fees-2026), secondary). Lichess runs on "volunteers and donations" ([Lichess](https://lichess.org/about)) | very low | small and unpredictable | add the link; do not plan on it |
| **Ads** | advertisers | AirConsole has "no ad revenue"; its ad breaks only advertise its own subscription ([AirConsole FAQ](https://developers.airconsole.com/faq-help)) | medium | an ad covers the shared playfield on every Tile; personalised ads need consent (TDDDG §25, below); revenue needs volume you do not have | skip |

Notes on the models that need more than a cell:

- **Why "the Host pays once" fits.** The Host runs every Game. Peers only draw state and send input (ADR-0002). So only one phone at the table needs to know about a purchase, and nobody needs an account. The Games are already compiled into the PWA (`apps/pwa/src/games.ts`), so a lock is a check on the Host's Game row, not a download `[INFERENCE]`.
- **What a buyer would get.** Seven Games exist, but players only know Pong and Air Hockey. A first pack could be three of the existing Games polished, plus themes. That is cheaper than inventing new Games `[INFERENCE]`.
- **B2B is time, not code.** Each event or venue deal is a conversation, a custom set-up and an invoice. With a very small team that time competes with the product. The strangers who asked for the name are a consumer signal, not a B2B one `[INFERENCE]`.
- **Brands.** The striking demo, a ball crossing a table of phones, is exactly what agencies buy for stands. But MIT lets an agency take the code and do it alone. What you can sell is your time, your Games and your name `[INFERENCE]`.
- **Hardware.** On top of the duties above, the research found that the hub's useful job (a 5 GHz access point) costs $40 off the shelf. A Kickstarter for a box that a router already replaces is hard to justify `[INFERENCE]`.

### 2.2 How to take a payment from a web app without accounts

Fees for a card payment made by a consumer in the EU (checked 2026-11-11). The "€5 sale" column is my arithmetic. Dollar-based fees are converted at roughly €0.43–0.47 per 50¢ `[INFERENCE: I did not check the exchange rate]`.

| Provider | Who is the seller | Fee | Fee on a €5 sale | EU VAT | Pay what you want | Licence keys |
|---|---|---|---|---|---|---|
| Stripe Payment Links / Checkout ([pricing](https://stripe.com/de/pricing)) | you | 1.5 % + €0.25 for standard EEA cards; 2.8 % + €0.25 for premium EEA cards; 3.15 % + €0.25 for non-EEA cards; €20 per dispute | €0.33 (6.5 %) | you: registration, OSS returns | yes ([Stripe](https://docs.stripe.com/payments/checkout/pay-what-you-want)) | build them yourself |
| Stripe Managed Payments ([page](https://stripe.com/en-de/managed-payments)) | Stripe (MoR) | the Stripe fee + 3.5 % | €0.50 (10 %) | Stripe, in 80+ countries | not checked | no |
| Paddle ([pricing](https://www.paddle.com/pricing)) | Paddle (MoR) | 5 % + 50¢; below $10 "contact us for bespoke pricing" | ~€0.70 (~14 %) | Paddle | not checked | not checked |
| Lemon Squeezy ([pricing](https://www.lemonsqueezy.com/pricing), [fees](https://docs.lemonsqueezy.com/help/getting-started/fees)) | Lemon Squeezy (MoR) | 5 % + 50¢, +1.5 % outside the US, +1.5 % for PayPal; 1 % on payouts to non-US banks | ~€0.80 (~16 %) | Lemon Squeezy | yes ("Pay what you want" donations) | yes, with a License API ([docs](https://docs.lemonsqueezy.com/api/license-api)) |
| GitHub Sponsors / Ko-fi | — (donations) | 0 % (personal sponsors / Ko-fi tips) plus processing | ~€0.33 | n/a | yes | n/a |

- **Stripe Managed Payments eligibility:** businesses in DE and AT qualify, and "video games" is a supported category. But Stripe runs an eligibility review, and products must be "fully automated digital" ones ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)). It works with Payment Links ([docs](https://docs.stripe.com/payments/managed-payments)).
- **Lemon Squeezy** calculates its fee on the total including VAT; in its own example a $20 product sold to France costs $2.06 in fees ([fees](https://docs.lemonsqueezy.com/help/getting-started/fees)).
- **Why an MoR at this stage:** cross-border sales of electronic services to EU consumers are taxed in the buyer's country once you exceed €10,000 a year across the EU ([EU OSS](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en)). An MoR is the seller to the consumer, so that work is theirs `[INFERENCE: you still declare the payouts as your income; ask a Steuerberater]`.

### 2.3 How an unlock works without accounts

1. **Honour system (for the test).** A thank-you page and a "Supporter" badge the Host can switch on. No check. Zero code risk.
2. **Licence key typed on the Host.** Lemon Squeezy emails a key after the purchase. The Host pastes it once, and the app calls the License API's `activate`/`validate` endpoints. The API's request rules list no API key, and it allows 60 requests a minute ([docs](https://docs.lemonsqueezy.com/api/license-api)). Unconfirmed: whether a browser may call it directly (CORS). Test it in an hour before relying on it. The result is kept in `localStorage`. The buyer's email address is the "account": a lost key is resent by the MoR.
3. **Signed token from a Worker.** After a Stripe payment, a Cloudflare Worker checks the Checkout Session with the secret key and returns a token signed with a private key. The PWA checks the signature with a public key, and it works offline afterwards. That is about a day of work `[INFERENCE]`.

Two cautions. First, under MIT anyone may delete the check in a fork. That is acceptable, because buyers are people who use the official site `[INFERENCE]`. Second, storing the key on the phone for a function the user bought counts as "unbedingt erforderlich", so it needs no consent banner (TDDDG §25(2) no. 2, [gesetze-im-internet.de](https://www.gesetze-im-internet.de/ttdsg/__25.html)) `[INFERENCE]`.

### 2.4 Apple and Google: selling from a web app vs a store app (EU, 2026)

| Where the purchase happens | Rule | Commission |
|---|---|---|
| **The PWA in Safari or Chrome (today)** | store rules govern apps sent to the stores, not websites `[INFERENCE from the scope of both rule sets]` | only the payment provider's fee |
| App Store app with Apple In-App Purchase, EU, from 1 Oct 2026 | the new unified EU terms ([Apple Newsroom, 2026-08-18](https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/)) | 26 %; 15 % in the Small Business Program |
| App Store app with its own payment processing, EU | same | 20 %; 10 % in the programs |
| App Store app that links out to a web shop, EU | same, plus a parental gate for users under 18, no link-outs for users under 13, and the payment choice locked for 12 months | 15 %; 10 % in the programs |
| App distributed via the web or an alternative marketplace, EU | eligibility bars (Dun & Bradstreet score, venture funding, an audit, …) and Notarization | 5 % "Core Technology Commission" |
| Google Play, EEA, Play Billing | [Play EEA conditions](https://support.google.com/googleplay/android-developer/answer/14659200?hl=en) | new installs: 20 % + 5 % billing fee (existing installs 25 % + 5 %); the table's "first $1M of annual earnings" row reads 10 % + 5 % |
| Google Play, EEA, external offers (link out) | same page | 20 % (10 % on the first $1M) and €1.20 per external install |

Three App Review guidelines matter if you ever ship a store app ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/), last updated 2026-10-16):

- **3.1.1:** an app "may not use their own mechanisms to unlock content or functionality, such as license keys … QR codes".
- **3.1.3(b):** content bought on the web may be used in the app only if those items "are also available as in-app purchases within the app".
- **4.2:** the app must be more than "a repackaged website".

**Consequence:** keep selling on the web. A store app would charge 10–26 % on every pack sold inside it, and it could not honour web licence keys unless it also sold the same items through in-app purchase.

### 2.5 The recommended first test

**What it tests:** whether people outside your friends pay anything at all for Bezel. "The Host pays once" is the model; this is its smallest version.

**Steps (about 2 days):**
1. Day 1, morning: put up an Impressum and a privacy page (§6). Without them, do not take money.
2. Day 1, afternoon: open a Lemon Squeezy store, the fastest route because it has an MoR, pay-what-you-want pricing and licence keys. Stripe Managed Payments is cheaper per sale but needs an eligibility review. Create one product, "Bezel Supporter", priced pay-what-you-want with a €3 minimum and €5 suggested.
3. Day 2: add one line to the result card the Host sees after a Match, and a button on the landing page and the README:
   - EN: "Liked it? Bezel is free and made by a small team. Chip in from €3 → Support Bezel"
   - DE: "Hat's Spaß gemacht? Bezel ist kostenlos und wird von einem kleinen Team gebaut. Unterstütze uns ab 3 € → Bezel unterstützen"
   - Thank-you page: "Thank you. Supporters get the first Game pack free when it ships." Promise only what you will deliver.
4. Count Matches started, or the conversion means nothing. The cheapest count is a Worker on the Cloudflare free plan that only adds 1 per Match and stores no IP address. Mention it in the privacy page. If you skip it, count the tables you watched yourself `[INFERENCE]`.

**Decision after 4–6 weeks** `[INFERENCE: thresholds are a judgement, not a benchmark]`:
- At least 10 payments from people you do not know, or at least 1 payment per 100 Matches: build the Host unlock with a licence key (§2.3), for a first pack of 2–3 polished Games.
- Fewer: keep the link as a donation button, and spend the time on getting more tables to play.

**Do not, during the test:** add accounts, add ads, launch a subscription, or put the app in a store to sell through it.

## 3. Costs and limits as usage grows

### 3.1 Assumptions (state them when you repeat the numbers)

- **A Session** is one table: the Host plus up to 3 Peers, which is the Games' Tile limit.
- **"Low" = the measured case:** 6 MB of Metered usage per Session, the makers' test evening. Metered counts ingress plus egress, so about 3 MB actually crossed the Relay `[INFERENCE]`.
- **"High" = the worst case:** four phones, each on its own mobile data, one hour of Matches, all three Peers relayed. That is 3 relayed Peer-hours per Session.
- **What each provider bills per relayed Peer-hour** (110 MB on the wire):

| Provider | What is billed | GB per relayed Peer-hour |
|---|---|---|
| Metered | "both ingress and egress" ([pricing](https://www.metered.ca/pricing)) | 0.22 |
| Twilio | "the sum of bytes that the TURN Client sent and received" ([FAQ](https://www.twilio.com/docs/stun-turn/faq)) | 0.11 |
| Cloudflare | only egress to the client holding the allocation; ingress is free ([FAQ](https://developers.cloudflare.com/realtime/turn/faq/)) | 0.09 (the Host → Peer stream) |
| Xirsys | not stated, so I assume it counts like Metered | 0.22 |
| Own coturn at Hetzner | only outgoing traffic over the included amount ([Hetzner](https://www.hetzner.com/cloud/regular-performance/)) | 0.11 |

- **Hosting:** 4 Devices × 2 cold loads × 87 KB ≈ 0.7 MB per Session `[INFERENCE]`.

### 3.2 Relay prices (checked 2026-11-11)

| Provider | Free | Paid |
|---|---|---|
| Metered ([pricing](https://www.metered.ca/pricing), [Open Relay](https://www.metered.ca/tools/openrelay/)) | the pricing page says "500 MB trial" a month; the Open Relay page says "20 GB of free TURN Usage every month". Which one your account has is unconfirmed | Growth $99/month for 150 GB, then $0.40/GB; Business $199 for 500 GB, then $0.20/GB; Enterprise $499 for 2 TB, then $0.10/GB |
| Cloudflare Realtime TURN ([pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)) | the first 1,000 GB each month, shared with the SFU | $0.05/GB of egress |
| Twilio ([pricing](https://www.twilio.com/en-us/stun-turn/pricing)) | — | $0.40/GB in Europe (Germany) |
| Xirsys ([pricing](https://xirsys.com/pricing)) | 500 MB/month after a 30-day trial, as "a hard cap; relay stops until the monthly reset" | Basic $39 for 50 GB ($0.50/GB over); Standard $99 for 150 GB ($0.40); Pro $199 for 500 GB ($0.20); Elite $499 for 2 TB ($0.09) |
| Own coturn on Hetzner ([Regular Performance](https://www.hetzner.com/cloud/regular-performance/)) | — | CPX02 (1 vCPU, 1 GB) €5.49/month in Helsinki, €6.49 in Falkenstein/Nuremberg, excl. VAT, with 20 TB of traffic and €1.00 per extra TB. Some sizes and locations showed "currently unavailable" |

### 3.3 Monthly cost per scale step

Each cell gives **Low · High**. Plan choice = the cheapest listed plan for that volume (my arithmetic).

| Item | 100 Sessions/month | 1,000 Sessions/month | 10,000 Sessions/month |
|---|---|---|---|
| Relay volume at Metered (in + out) | 0.6 GB · 66 GB | 6 GB · 660 GB | 60 GB · 6,600 GB |
| Metered, if the account has the 500 MB trial | **over the cap** → $99 · $99 | $99 · $231 | $99 · $959 |
| Metered, if the 20 GB Open Relay allowance applies | $0 · $99 | $0 · $231 | $99 · $959 |
| **Cloudflare Realtime TURN** (+ a Worker on the free plan) | **$0 · $0** | **$0 · $0** | **$0 · $85** |
| Twilio | $0.12 · $13 | $1.20 · $132 | $12 · $1,320 |
| Xirsys | over the free cap → $39 · $47 | $39 · $231 | $44 · $913 |
| Own coturn at Hetzner (+ your time) | €5.49–6.49 · €5.49–6.49 | €5.49–6.49 · €5.49–6.49 | €5.49–6.49 · ~€10–17 (a bigger server for the evening peak `[INFERENCE]`) |
| Signaling, public Nostr relays | $0 (no SLA) | $0 (no SLA) | $0 (no SLA), with rising rate-limit risk |
| Signaling, own relay | €0 extra on the coturn server | same | same |
| Hosting on GitHub Pages | 0.07 GB of 100 GB: $0 | 0.7 GB: $0 | 7 GB: $0, but see the terms (§3.4) |
| **Cheapest money total** | **$0 · $0** | **$0 · $0** | **$0 · ~$85** |

How the High numbers come about: 1,000 Sessions × 3 Peer-hours × 0.22 GB = 660 GB at Metered. That is the Business plan, $199 + 160 GB × $0.20 = $231. Cloudflare bills 0.27 GB per Session: 2,700 GB at 10,000 Sessions, of which 1,700 GB cost $0.05 each = $85.

**Each free allowance lasts this many Sessions a month:**

| Allowance | Low (6 MB) | High (3 relayed Peer-hours) |
|---|---|---|
| Metered 500 MB | ~83 | less than 1 |
| Metered 20 GB | ~3,300 | ~30 |
| Xirsys 500 MB (hard cap) | ~83 | less than 1 |
| Cloudflare 1,000 GB | ~400,000 | ~3,700 |
| Hetzner 20 TB of traffic | effectively unlimited | ~60,000 (the CPU runs out first `[INFERENCE]`) |

Two levers cut every Relay bill without changing provider `[INFERENCE]`:
- The ~235 B envelope per frame roughly doubles a 200–300 B state; `.scratch/snake/friction.md` lists fixes.
- The unreliable state lane that `docs/research/internet-carried-sessions.md` recommends lets Games send fewer bytes at 30 Hz without visible loss, as Snake already does.

### 3.4 Hosting and signaling

**GitHub Pages** ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)):
- Limits: sites up to 1 GB, a *soft* bandwidth limit of 100 GB a month, and 429 responses under rate limiting. At ~87 KB per cold load, 100 GB is roughly 1.1 million cold loads `[INFERENCE]`.
- The binding limit is the wording: Pages "is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service (SaaS)".
- A free app with a support link is arguably fine. An app that sells unlocks is a grey zone `[INFERENCE]`.
- Move before step 2 of §2.5, for example to Cloudflare Pages (Free plan: 500 builds a month, [limits](https://developers.cloudflare.com/pages/platform/limits/)). The Relay Worker would live there too.

**Nostr signaling:**
- Who runs the relays: unknown volunteer operators. The five above come from Trystero's built-in list, and nobody promises they will stay up.
- What was seen: two logged runs got `rate-limited: max 30 events/60s` from `relay.nostrmap.net`, and the joins went through the other four. A Peer that loops every 4 s for a minute sends about as many announces (`.scratch/connectivity-2/issues/02-relay-only-after-failed-attempts.md`).
- Trystero backs off a rate-limited relay for up to 15 minutes (`maxRelayBackoffMs = 9e5` in `@trystero-p2p/nostr`).
- What it costs to run your own:
  - Trystero takes your own relay list (`relayConfig.urls`).
  - It also ships a "self-hosted WebSocket relay" strategy (`@trystero-p2p/ws-relay`; `node_modules/.pnpm/trystero@0.26.0/node_modules/trystero/README.md`, "Self-hosted WebSocket relay").
  - Either runs on the same €5.49–6.49 server as coturn. It needs `wss://` with a real certificate.
  - The Supabase and Firebase strategies are a middle way that Trystero itself suggests (same README, "Which strategy should I choose?").
- Privacy side effect: without a `password`, Trystero encrypts the session descriptions (which contain addresses) "using a key derived from your app ID and room ID", and "a relay strategy operator can reverse engineer the key" (same README, "Encryption"). Your own relay removes the unknown operators from that path.

### 3.5 What breaks first, in order

1. **The Metered allowance, if it is the 500 MB trial.** About 83 evenings like the test one, or less than one worst-case Session. Metered offers quota actions: "notify only, disable credentials, or none" (`docs/research/internet-carried-sessions.md` §2). Find out which plan you have this week.
2. **The leaked credential.** The TURN credential sits in the public JavaScript. Metered says a stolen one "cannot do anything other than use up your TURN Server quota", and that is enough to switch the Relay off for everybody (same section). Fix: short-lived credentials from a Worker (Cloudflare, `docs/research/internet-carried-sessions.md` "Handing credentials to a static site").
3. **Signaling on public relays:** rate limits during reconnect loops, relays that vanish, no way to complain.
4. **GitHub Pages terms**, once money flows through the app.
5. **The Host's upload with 4–5 Peers on mobile data** (§4). This is a product limit, not a bill.
6. **The 20 GB Metered allowance**, at about 30 worst-case Sessions or about 3,300 low ones.
7. **Cloudflare's free 1,000 GB**, at about 3,700 worst-case Sessions a month. After that it costs about half a cent per relayed Peer-hour.

## 4. Technical scalability of the product

| Area | Today (from the code) | Where it stops | What would be needed |
|---|---|---|---|
| Devices per Session | a star: Peers talk only to the Host (ADR-0002). Host upload = (Peers) × state rate × bytes (`docs/architecture.md` §3). The lobby enforces each Game's manifest; no Game takes more than 4 Tiles, Quiz takes 4 Controllers | the Host's upload on mobile data: 1 Peer ≈ 0.2 Mbit/s, 3 ≈ 0.6, 5 ≈ 1.0, 7 ≈ 1.4 `[INFERENCE: 25 KB/s per Peer]`. The 10th-percentile mobile upload in Germany is 1.23–1.40 Mbit/s on Vodafone, O2 and 1&1 (Ookla, via `docs/research/internet-carried-sessions.md` §6). ADR-0002 calls ≤ 6 Devices acceptable on a LAN | smaller states (envelope, rounding, 30 Hz), the unreliable lane, and only then an SFU for fan-out (Cloudflare SFU DataChannels: $0.05/GB after the shared 1,000 GB) |
| Connections | `peers` above 1 on a Peer means Trystero's Peer↔Peer mesh still forms next to the star (`docs/guide/running-on-phones.md`, `tick` line) | n·(n−1)/2 connections for n Devices `[INFERENCE]`; extra Relay allocations when relay-only | the star-only transport planned in M5 (`docs/PLAN.md`) |
| Tick rate | Pong, Air Hockey and Breakout publish 60 states a second; Snake 30; Tap Race, Pass and Quiz are event-driven (`tickHz: 0`) | the bytes scale with the rate | 30 Hz plus extrapolation where it looks the same (Snake measured a 0.05 mm error) |
| Room codes | 923,521 codes, no password | a code collision becomes likely only with thousands of tables open at once `[INFERENCE]`; anyone who guesses a code can join | optional: a Trystero `password` carried in the QR, which also hides the addresses from relay operators |
| More Games | a Game is a package that imports `@mgc/sdk` only; `apps/pwa/src/games.ts` picks up `games/*` at build time; documented in `docs/guide/api.md` | every Game ships inside the PWA bundle (82.5 KB gzipped today) | fine for dozens of first-party Games `[INFERENCE]` |
| Third-party Games | a public, documented API, but no sandbox yet. ADR-0004: sandboxed iframes in M3, "loading bundles from a URL is a later milestone" | outside code would run with full page rights today | M3 sandbox → loading from a URL with a hash or signature → review and an age-rating answer per Game → payouts. Only then a revenue share |
| Versions | `WIRE_VERSION = 1` (`packages/sdk/src/wire.ts`); a mismatch closes a Match with `version`. Two channels: `/Bezel/` (master) and `/Bezel/stable/` (the `stable` tag, `scripts/stable.mjs`). The QR carries the Host's own URL. No service worker | a push to master during an evening can put the Host and a late Peer on different builds of the same address `[INFERENCE]` | send players to `/stable/` and testers to `/`. Later: immutable versioned paths, or a build id in the Session handshake |
| Error reporting | none leaves the phone. Each phone keeps a log of 20,000 lines in IndexedDB; **Export log** is manual (`apps/pwa/src/recorder.ts`) | you learn only about failures that friends report | first an opt-in "Send log" button to a Worker. Or Sentry's free Developer plan: 1 user, 5k errors a month ([Sentry](https://sentry.io/pricing/)), with IP storage off and a line in the privacy page |
| Uptime without a server | four outside dependencies: GitHub Pages, five Nostr relays, the Google/Cloudflare STUN servers, the Metered Relay. No monitoring | a silent outage of any one of them | a scheduled GitHub Actions job that joins two headless browser tabs on the hosted build every few hours. Standard runners are free for public repos ([GitHub Docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)); the project already ran such smokes by hand (`.scratch/connectivity-1/issues/03-pwa-rejoin-through-reconnect.md`) |

## 5. Open source and licence

**Now:**
- The repo is MIT (`LICENSE`, `package.json` `"license": "MIT"`, the README badge).
- MIT lets anyone "use, copy, modify, merge, publish, distribute, sublicense, and/or sell" the code, as long as the notice is kept, with no warranty.
- The copyright line reads "MobileGameConnect contributors". All 40 commits come from one author (`git shortlog`, 2026-11-11), so that person holds the copyright and can relicense future versions.
- What is already published stays MIT for good: anyone may fork today's code and keep using it under MIT `[INFERENCE: standard reading of a granted licence]`.
- There is no CLA or DCO in `CONTRIBUTING.md`.

**The options:**

| Licence | What others may do | Good for | Bad for | Who uses it (licence per GitHub, 2026-11-11) |
|---|---|---|---|---|
| **MIT** ([text](https://choosealicense.com/licenses/mit/)) | anything; keep the notice | easiest for Game developers, brands and contributors | anyone can host a copy, even commercially | Trystero, boardgame.io, Colyseus (sells hosting "starting at $15/mo", [Colyseus](https://colyseus.io/pricing/)), Excalidraw (sells Excalidraw+, ~$7 per user a month, [drawdy](https://drawdy.io/pricing/excalidraw), secondary), Phaser, Godot |
| **Apache-2.0** ([text](https://www.apache.org/licenses/LICENSE-2.0)) | like MIT, plus an explicit patent licence and a NOTICE file | the same, with patent clarity | a little more paperwork | Sentry's FSL turns into it after two years |
| **AGPL-3.0** ([summary](https://choosealicense.com/licenses/agpl-3.0/)) | anything, but whoever runs a modified version for users over a network must offer its source | stops closed, hosted clones; pairs with dual licensing | brands and companies avoid it; an AGPL SDK would also bind third-party Games `[INFERENCE]` | Lichess (donation-funded) |
| **BSL 1.1** ([text](https://mariadb.com/bsl11/)) | read and use within an "Additional Use Grant"; becomes open source after at most 4 years | protects a business now | not open source; backlash: HashiCorp moved Terraform from MPL to BSL in Aug 2023, and the community forked it as OpenTofu under the Linux Foundation ([TechCrunch](https://techcrunch.com/2023/09/20/terraform-fork-gets-a-new-name-opentofu-and-joins-linux-foundation/)) | Terraform (licensor now IBM, per its LICENSE) |
| **FSL 1.1** ([fsl.software](https://fsl.software/)) | anything except competing with you; becomes MIT or Apache-2.0 after 2 years | a simpler BSL | not open source | Sentry |
| **PolyForm Noncommercial / Shield** ([NC](https://polyformproject.org/licenses/noncommercial/1.0.0), [Shield](https://polyformproject.org/licenses/shield/1.0.0)) | no commercial use / no competing product | keeps every commercial right | not open source; fewer contributors | — |
| **Own source-available licence** | free in development; production needs a paid key | direct licence revenue | needs sales and enforcement | tldraw ("Not to use the Software in Production Environments" without a key, [LICENSE](https://raw.githubusercontent.com/tldraw/tldraw/main/LICENSE.md)) |
| **Dual licensing** (AGPL + commercial) | copyleft for everyone, or paid proprietary terms | revenue from companies that embed it | you must own all copyright, so every outside contribution needs a CLA | — |

**Recommendation:**
- Keep **MIT** for `packages/*`, `games/_template` and the Games that are free.
- Put any paid Game pack (code and art) in a **separate private repo** under "all rights reserved". Build it only into the official site. This is open core `[INFERENCE]`.
- Add a **DCO** ("Signed-off-by" in each commit) to `CONTRIBUTING.md` before outside code arrives. Use a **CLA** instead only if dual licensing is ever on the table.
- Protect the **name**, not the code: a German word mark costs €290 online for up to three classes at the DPMA; an EU mark costs €850 for one class at the EUIPO ([amtsdeutschland](https://amtsdeutschland.de/dpma/markenanmeldung/), [raiseyoursales](https://raiseyoursales.de/blog/e-commerce/euipo-unionsmarke-anmelden/), both secondary). Check "Bezel" against existing marks first: a US company already sells "Bezel - Authenticated Watches" in the App Store.

**The trade-off in one sentence:** MIT maximises adoption of the SDK and goodwill, and costs you the ability to stop anyone from hosting or selling a copy; your protection is the brand, the hosted service, the paid content, and being the team that ships.

## 6. Legal basics before taking money or data (Germany, Austria, EU)

**Not legal advice.** Official texts are linked; read them or ask a lawyer.

### 6.1 Impressum

| Country | Rule | What it requires |
|---|---|---|
| DE | [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html), for "geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste" | name and address, fast electronic contact including email, register number and VAT id if any |
| DE | [§ 18 MStV](https://www.gesetze-bayern.de/Content/Document/MStV-18), for Telemedien "die nicht ausschließlich persönlichen oder familiären Zwecken dienen" | name and address, even for a free site |
| AT | [§ 5 ECG](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001703&Paragraf=5) | name, geographic address, contact details, and, where they apply, the register and the chamber membership |
| AT | [§ 25 MedienG](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10000719&Paragraf=25) (Offenlegung) | the media owner's name and place of residence or seat ([USP](https://www.usp.gv.at/themen/brancheninformationen/information-und-kommunikation/offenlegungspflicht-gemaess-para-25-mediengesetz.html)) |

A public app that strangers use is no longer "only personal or family" `[INFERENCE]`. Put the Impressum on the landing page and link it from the Host's sheet. Example for a German sole trader `[INFERENCE: template, adapt it]`:

```
Impressum
Angaben gemäß § 5 DDG
<Vorname Nachname>, <Straße Nr.>, <PLZ Ort>, Deutschland
E-Mail: hello@<domain>
Verantwortlich nach § 18 Abs. 2 MStV: entfällt (kein journalistisch-redaktionelles Angebot)
```

### 6.2 Privacy: what a peer-to-peer app gives away

- IP addresses are personal data when someone can lawfully link them to a person. The CJEU decided that for dynamic IP addresses in *Breyer* (C-582/14, [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62014CJ0582)).
- Who sees an address in Bezel today:

| Recipient | What it gets | Where it sits | Your relationship to it |
|---|---|---|---|
| The other phones in the Session | each other's public address (server-reflexive candidates); hidden behind mDNS on the same LAN | wherever the players are | inherent to WebRTC; say so in the privacy page |
| The 5 Nostr relays | every Device's address (WebSocket), plus session descriptions they could decrypt (no `password`) | unknown operators, unknown countries | no contract possible; the strongest reason for your own relay `[INFERENCE]` |
| Google and Cloudflare STUN | every Device's address | US companies | name them; transfers to the US rest on the EU-US Data Privacy Framework. It survived the General Court on 2025-09-03, and an appeal is pending ([C-703/25 P](https://eur-lex.europa.eu/eli/C/2025/6610/oj/eng)); I did not confirm its status on 2026-11-11 |
| Metered (Relay) | addresses of relayed Devices; the content is end-to-end encrypted ([Metered](https://www.metered.ca/tools/openrelay/)) | Canada (company) `[INFERENCE: check the data processing terms]` | processor: sign a DPA if offered |
| GitHub Pages | every page load's address | US | name it |
| The session log | addresses are not stored; the `net` field logs only the network kind (`docs/guide/running-on-phones.md`) | on the phone, IndexedDB | good as it is; exported logs go where the user sends them |

- **The privacy page must list these** ([GDPR Art. 13](https://gdpr-info.eu/art-13-gdpr/)): who is responsible, purposes, legal basis (providing the requested Game, Art. 6(1)(b), is the natural one `[INFERENCE]`), recipients, third-country transfers, storage periods and rights.
- **No cookie banner is needed** while the app only stores what the game needs (Device id, lobby, licence key): TDDDG §25(2) no. 2 exempts "unbedingt erforderlich" storage ([§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)) `[INFERENCE]`. Analytics with identifiers, or ads, would change that.

### 6.3 Taking money

- **Who sells.** One of you as a sole trader, or several of you together. Selling together for profit may already form a GbR in Germany `[INFERENCE]`. Register the trade (Gewerbeanmeldung) before regular sales `[INFERENCE: ask the Gewerbeamt]`.
- **Small-business VAT.**
  - DE, [§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html): exempt if turnover was ≤ €25,000 last year and stays ≤ €100,000 this year.
  - AT: €55,000 gross a year since 2025 ([facturo](https://facturo.at/blog/kleinunternehmerregelung-oesterreich/), secondary).
  - With an MoR, your customer is the MoR `[INFERENCE]`.
- **Selling directly instead of through an MoR** brings in consumer law:
  - The order button must say "zahlungspflichtig bestellen" or something equally clear ([§ 312j(3) BGB](https://www.gesetze-im-internet.de/bgb/__312j.html)).
  - The 14-day withdrawal right for digital content ends early only with the buyer's express consent and acknowledgement ([§ 356(6) BGB](https://www.gesetze-im-internet.de/bgb/__356.html)).
  - An MoR's checkout handles both. Stripe states that Managed Payments applies "regional cooling off periods where required" ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)).
- **Accessibility (BFSG):** micro-enterprises that offer services are exempt: fewer than 10 people and ≤ €2M turnover ([§ 3(3) BFSG](https://www.gesetze-im-internet.de/bfsg/__3.html), [§ 2 no. 17](https://www.gesetze-im-internet.de/bfsg/__2.html)).

### 6.4 Youth protection and age ratings

- **Web app in Germany.** [§ 14a JuSchG](https://www.gesetze-im-internet.de/juschg/__14a.html) requires age labels on "Film- und Spielplattformen" that bundle games with a profit motive. Providers with "nachweislich weniger als eine Million Nutzerinnen und Nutzer" in Germany are exempt. You are far below that.
- **Google Play.** "All apps must have a content rating from the IARC" ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9898843?hl=en)). It is a free questionnaire, and the USK takes part in IARC ([USK](https://www.usk.de/en/home/age-classification-for-games-and-apps/games-and-apps-in-the-iarc-system/)).
- **App Store.** Answer the age-rating questions honestly (guideline 2.3.6, [Apple](https://developer.apple.com/app-store/review/guidelines/)).
- Pong-style Games with no violence, chat or purchases should land in the lowest age bands `[INFERENCE]`.

### 6.5 Checklist before the first payment

- [ ] Impressum (DE: § 5 DDG / § 18 MStV; AT: § 5 ECG / § 25 MedienG) on the landing page and linked from the app.
- [ ] Privacy page listing the recipients in §6.2.
- [ ] Seller decided; trade registered; Kleinunternehmer status checked with a Steuerberater.
- [ ] MoR account (Lemon Squeezy or Stripe Managed Payments); payout bank account.
- [ ] Relay credential no longer able to burn your quota unnoticed: quota action set, or the Worker from §3.5.
- [ ] Hosting moved off GitHub Pages before the in-app unlock (not needed for a donation link) `[INFERENCE]`.

## Open questions for the makers

1. Which Metered allowance does your dashboard show, 500 MB or 20 GB, and which quota action is set?
2. Who would be the seller: one person, a GbR or a company? Do you live in Germany or Austria?
3. Are you willing to publish a name and a postal address in an Impressum? If not, what is the fallback?
4. Can you count Matches without collecting personal data (a count-only Worker)? Without a denominator, the payment test cannot be judged.
5. What would a paying Host get: which three of the seven existing Games, polished, or new ones?
6. What is the goal: covering the Relay and the hosting, pocket money, or a business? It changes how much the licence and B2B matter.
7. Do you expect outside code contributions in the next months? That decides DCO now vs CLA later.
8. Has any venue, event organiser or agency asked about Bezel? One inbound request is worth more than a cold B2B plan.
9. Which price feels right to you as players: €3–5 once, or €10–15 for a pack?
10. Should the public link point to `/Bezel/stable/` from now on, so a push to master cannot break someone's evening?
