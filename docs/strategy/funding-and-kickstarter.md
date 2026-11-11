# Funding: whether, when and how to raise money

Researched 2026-11-11. Every external fact links its source and was checked that day; where a page shows its own date, it is given. Facts about this repo cite the file. `[INFERENCE]` marks a conclusion of ours that no source states. `[DERIVED]` marks a number we calculated from a cited source. **This is not tax or legal advice.** Talk to a tax adviser (Steuerberater/in) before money arrives.

Product words (Session, Device, Host, Peer, Tile, Relay) are used as in [`GLOSSARY.md`](../../GLOSSARY.md).

## Bottom line

- **Kickstarter: not yet.** Today a campaign would have nothing to sell that backers cannot already get for free, no audience to bring, and no data that strangers come back. Kickstarter's own handbook says "most of your support will come from your core networks" (§2.4), and first-time creators succeeded only 34 % of the time in 2025 (§2.3). Launch only after the gates in §5 are met: a reward that is not the free web app, about 800 pre-launch followers for a €10,000 goal, a demo video, and a registered business. The earliest sensible date is the second half of 2027 `[INFERENCE]`.
- **Money is not what is missing now** `[INFERENCE]`. The app runs on free GitHub Pages. A whole test evening used about 6 MB of Relay data (project brief). What is missing is evidence that people outside your circle play it. Spend the next weeks getting that evidence, not money.
- **This week, €0, about one day:**
  - Open **GitHub Sponsors** (0 % fee from personal accounts, available in Germany and Austria).
  - Open **Ko-fi** on the "Ko-fi Free" plan (0 % on tips). The default "Standard" plan takes 5 %, so switch.
  - Link both from the README.
  - Record the demo video. Every application and campaign below needs one.
- **Grants worth an application, €0 and 1–3 days of writing each:**
  - **NLnet Restack**, deadline **3 Jan 2027**. €5,000–50,000; individuals may apply; everything must stay open source.
  - **Your state's games fund.** Concept grants of €20,000–30,000; prototype grants up to €80,000–200,000. Known deadlines fall between 14 Jan and 2 Feb 2027; some states have not published 2027 dates. Which fund depends on where you live (§4.2).
  - **Deutscher Computerspielpreis 2027**, category "Beste Innovation und Technologie" (€40,000 in 2026). Only if at least 80 % of the work happens in Germany. The 2026 entry window was 5–23 January.
  - **Prototype Fund**, deadline **30 Nov 2026**. €47,500 per person, €95,000 per team. Apply only if you live in Germany and can honestly pitch the Session layer as reusable infrastructure. The topic fit is weak.
- **Skip:**
  - The federal games fund (a project of at least €300,000, an existing company and 50 % of your own money).
  - Creative Europe (needs a released narrative game that has earned revenue).
  - Sovereign Tech Agency (funds no user-facing apps and no prototypes).
  - Epic MegaGrants (Unreal or 3D tools only).
  - Steam, Patreon and Open Collective for now.
- **Do not build or crowdfund the pocket hub yet.** A €41 GL.iNet Opal router already does the network job ([`docs/research/table-hub-device.md`](../research/table-hub-device.md)). Selling your own radio device in the EU brings:
  - CE marking under the Radio Equipment Directive, including the EN 18031 cybersecurity standards.
  - Cyber Resilience Act duties.
  - Battery, take-back (WEEE) and packaging registrations.
  - Lab tests that the European Commission estimates at €5,000–15,000.

  Revisit once the travel-router experiment works and an offline hub is shown to work on iPhones.
- **What a Kickstarter would cost later:**
  - Fees: 5 % plus 3 % + €0.30 per pledge, about 8.75 % on €10,000 from 250 pledges `[DERIVED]`.
  - VAT: 19 % (DE) or 20 % (AT), unless the small-business exemption applies.
  - Rewards and shipping on top.
  - Time: 2–4 months of preparation `[INFERENCE]`, then a campaign of at most 30 days.
- **Legal form:**
  - Donations and NLnet work for private persons.
  - The Prototype Fund takes individuals or a GbR, nothing else.
  - Several state funds (Berlin, NRW, Central Germany, Baden-Württemberg) and Startnext need a registered business; Hamburg, nordmedia and the Bavarian concept grant also take private persons.
  - Kickstarter takes individuals, but selling rewards is business activity.
  - A hardware campaign belongs in a limited company (UG/GmbH) `[INFERENCE]`.

## 1. What money would be for

| Fact | Source |
|---|---|
| The repo exists since 2026-11-07; one committer; MIT licence | `git log`; [`LICENSE`](../../LICENSE) |
| Seven Games on one SDK, hosted on GitHub Pages | [`README.md`](../../README.md) |
| A Relay connection costs about 110 MB per hour per Peer. The Metered account's allowance is either 20 GB or a 500 MB trial: check the dashboard | [`docs/research/README.md`](../research/README.md) |
| A native app costs 99 USD a year (Apple) and app review, and ends "scan a QR code, no install" | [`docs/research/README.md`](../research/README.md), option 8 |
| No analytics, no email list, no legal entity, no revenue | project brief |

Running costs today are close to zero. Real costs appear with three things only `[INFERENCE]`:
1. Your own time, if you want to be paid for it.
2. Relay traffic once many strangers play away from a shared Wi-Fi.
3. A native app or hardware.

So the funding question is really "how do we pay for our time, and later for the Relay?"

## 2. Kickstarter reality check

### 2.1 Who can launch, and what it costs

| Item | Rule | Source |
|---|---|---|
| Countries | 25 countries, including **Germany, Austria and Switzerland**. "The physical address on your verification documents *must* be in one of the above countries" | [Kickstarter Help, page dated 2026-08-06](https://help.kickstarter.com/en-us/articles/16236650-who-can-use-kickstarter) |
| Person | 18 or older; resident in the launch country; a government ID (within the EU, IDs from other EU countries are accepted) | same |
| Business | Launches in the country where it is registered. "All beneficial owners… must also be disclosed and verified" | same |
| Bank and card | A current account in the launch country, in the name of the person or entity raising funds; a credit or debit card in the creator's own name | same |
| Fees (DE, AT) | 5 % platform fee, plus processing of **3 % + €0.30 per pledge** (5 % + €0.08 under €10). No fees if the project fails | [kickstarter.com/help/fees?country=DE](https://www.kickstarter.com/help/fees?country=DE) |
| Fees (CH) | 5 % plus 3 % + CHF 0.30 | [kickstarter.com/help/fees?country=CH](https://www.kickstarter.com/help/fees?country=CH) |
| All-or-nothing | If the goal is not met, "no money changes hands". Goal and deadline are locked at launch | [Help, dated 2026-09-02](https://help.kickstarter.com/en-us/articles/16236582-why-is-funding-all-or-nothing) |
| Length | 1–60 days. "Projects lasting 30 days or fewer have our highest success rates" | [Handbook, Wayback 2026-10-20](http://web.archive.org/web/20261020001538/https://www.kickstarter.com/help/handbook/funding) |
| Payout | Starts 14 days after the deadline, then takes another 3–14 business days to arrive | [Help, dated 2026-08-06](https://help.kickstarter.com/en-us/articles/16236545-if-my-project-is-successfully-funded-how-do-i-receive-my-funds) |
| Late pledges | Same fees; the first payout comes 21 days after the deadline | [Help](https://help.kickstarter.com/en-us/articles/16236668-how-will-i-be-paid-out-for-late-pledges) |
| Pledge Over Time | Backers pay in 3 monthly charges; minimum pledge €125 | [Help](https://help.kickstarter.com/en-us/articles/16236386-pledge-over-time-faq) |
| Pledge manager | No access fee. The 5 % applies only to add-ons sold there, shipping and upgrades | [Program terms, effective 2025-05-08](https://legal.kickstarter.com/policies/en/?name=pledge-manager-program-terms) |

**Worked example** `[DERIVED]`: €10,000 raised from 250 pledges of €40. Fees are €500 + €300 + 250 × €0.30 = **€875 (8.75 %)**. If you charge VAT, 19/119 of the gross, **€1,597**, goes to the tax office. That leaves €7,528 before you have made, packed and shipped a single reward. Under the small-business exemption (§2.6) it would be €9,125.

### 2.2 The rules that matter for this project

Kickstarter rewrote "Our Rules" in May 2026 (current text: [Wayback 2026-11-01](http://web.archive.org/web/20261101074116/https://www.kickstarter.com/rules)).

- **"All rewards must be new and unique"** and "must have been produced or designed by the project or one of its collaborators". So reselling a GL.iNet router as a reward is out.
- **Apps and software** "must be based on original, creative thinking… a prototype must be demonstrated".
- **Hardware demos** must show the current state, with no "CGI or special effects to demonstrate functionality that does not yet exist". Where software and hardware depend on each other, show them working together "or disclose that it has not yet been developed".
- **Creators "must not use Kickstarter as a method to funnel engagement to external websites or platforms".** A campaign whose real message is "play free on our website" risks this rule `[INFERENCE]`.
- **Equity, contests and raffles are prohibited.** Up to 10 % of funds may now go to charity, if disclosed.
- **No explicit rule covers a free app or a "supporter" tier as a reward.** A thank-you tier fits the rewards guidance: a reward "doesn't necessarily need to be a physical item" ([Help, dated 2026-08-06](https://help.kickstarter.com/en-us/articles/16236477-what-can-be-offered-as-a-reward)). Offering the MIT web app that is already public *as the reward* may clash with "new and unique". Ask Kickstarter support before you plan around it `[INFERENCE]`.
- **What you owe backers if it goes wrong** ([Terms of Use §4, effective 2025-02-11](https://legal.kickstarter.com/policies/en/?name=terms-of-use)):
  - "A high standard of effort, honest communication".
  - An update explaining the work done and how the funds were used.
  - An offer to "return any remaining funds".
  - "If they're unable to satisfy these terms, they may be subject to legal action by backers."

  Kickstarter itself "doesn't offer refunds"; the creator pays chargebacks. Kickstarter can bar a creator from future campaigns ([Help](https://help.kickstarter.com/en-us/articles/16236533-what-can-kickstarter-do-when-a-creator-does-not-fulfill-their-project-rewards)).

### 2.3 Success rates and sizes

Kickstarter retired its public stats page in January 2026; `/help/stats` now redirects to a blog post. The last snapshot is [Wayback, "Last updated Jan 21 2026"](http://web.archive.org/web/20260121215252/https://www.kickstarter.com/help/stats). All-time numbers:

| Category | Projects launched | Success rate | Mean raised per successful project `[DERIVED]` |
|---|---|---|---|
| All | 687,200 | 42.74 % | about $29,800 |
| Games | 103,347 | 52.32 % | about $50,400 |
| Design | 60,554 | 44.63 % | about $67,600 |
| Technology | 59,615 | 24.94 % | about $124,000 |

Subcategories (Tabletop, Video Games, Mobile Games, Apps, Hardware) were not on the page. Means are pulled up by a few huge projects.

How big successful projects are, as a share of successful projects `[DERIVED from the same page]`:

| Category | Under $10k | $10k–20k | $20k–100k | Over $100k |
|---|---|---|---|---|
| All | 65.5 % | 14.4 % | 15.4 % | 4.8 % |
| Games | 56.4 % | 15.2 % | 19.9 % | 8.5 % |
| Technology | 31.0 % | 15.1 % | 31.9 % | 22.0 % |

What the same page and Kickstarter's [2025 Annual Benefit Statement](https://d3mlfyygrfdi2i.cloudfront.net/Annual_PBC_Report_2025_V2Final-6104f68.pdf) add:
- "9 % of projects finished having never received a single pledge".
- "79 % of projects that raised more than 20 % of their goal were successfully funded".
- 2025 overall success rate: 58.2 %. **First-time creators launched 66 % of projects and succeeded 34 % of the time.**
- 2025 Games pledges fell 19 % from 2024; Design & Tech grew 64 %.
- Video games in 2025: 443 successful projects raising just under $26M in total, about $59k on average `[DERIVED]`. Most top campaigns had large pre-launch follower counts ([ICO Partners, dated 2026-02-05](https://medium.com/icopartners/kickstarter-and-video-games-in-2025-90f15c2fd7bd); a consultancy, but a long-running data series).

### 2.4 Where backers come from

No current official figure exists for the share of backers who come from Kickstarter itself. The best available evidence:

| Source | Finding | Quality |
|---|---|---|
| [Kickstarter Handbook (Wayback 2026-10-20)](http://web.archive.org/web/20261020001538/https://www.kickstarter.com/help/handbook/funding) | "most of your support will come from your core networks, and the people most familiar with your work" | Official, no number |
| [Kickstarter 2025 Benefit Statement](https://d3mlfyygrfdi2i.cloudfront.net/Annual_PBC_Report_2025_V2Final-6104f68.pdf) | Repeat backers made 29 % of pledges | Official, but repeat ≠ "found you on Kickstarter" |
| [Mollick 2014, J. Business Venturing](https://leeds-faculty.colorado.edu/bhagat/Dynamics-of-Crowdfunding.pdf) | Success rises with the founder's social network: for a film project, 10, 100 and 1,000 Facebook friends gave 9 %, 20 % and 40 % chances. No video: −26 %. Over 75 % of projects delivered late | Peer-reviewed; 2009–12 US data |
| [Kuppuswamy & Bayus (Springer 2018)](https://link.springer.com/chapter/10.1007/978-3-319-66119-3_8) | Support is U-shaped: most comes in the first and last weeks | Peer-reviewed; abstract only read |
| [LaunchBoom case](https://www.launchboom.com/crowdfunding-guides/the-7-step-launchboom-framework-how-to-get-funded-on-day-one-of-your-kickstarter-campaign) | One client: 19 % of $555k "came directly from Kickstarter's own traffic" | Agency, self-interested, n = 1 |

**What this means for you** `[INFERENCE]`: plan for at least half, and more likely 80 %, of the money to come from people who knew Bezel before launch day. Kickstarter's discovery helps campaigns that are already moving. It does not start them.

### 2.5 Pre-launch: how big an audience a goal needs

| Source | Number | Quality |
|---|---|---|
| [Kickstarter blog, dated 2025-10-29](https://updates.kickstarter.com/the-anatomy-of-a-great-kickstarter-prelaunch-page/) | "On average, 32 % of pre-launch followers pledge once the campaign goes live" | Official; no sample size |
| A Kickstarter staff member, [quoted by ComixTribe, 2025-09-05](https://comixtribe.substack.com/p/going-all-in-on-pre-launch) | "29 % of total funding typically comes in on day one" | Second-hand quote |
| [Business Insider, 2018-03-07](https://www.businessinsider.com/best-kickstarter-tips-2018-3) (agency owner) | Reach 30 % of goal in 48 hours; "industry average 5 % conversion" from an email list | Rule of thumb, no data shown |
| [LaunchBoom](https://www.launchboom.com/game-tips/why-the-1-dollar-reservation-helps) | People who pay a refundable $1 deposit are "30 times more likely to back" than email-only sign-ups | Agency selling this method |

Party-game campaigns averaged $37–43 per backer (§3.2). Applied to a **€10,000 goal at €40 per backer** `[DERIVED]`:

| Need | Number |
|---|---|
| Backers | 250 |
| Pre-launch followers, if all backers came from them at 32 % | about 780 |
| Email subscribers, at the 5 % rule of thumb | about 5,000 |
| Backers needed in the first 48 hours (30 % of the goal) | about 75 |

Set the goal at what your followers alone would fund. You can always overfund. An all-or-nothing miss costs weeks of work and your public credibility `[INFERENCE]`.

### 2.6 Taxes on crowdfunding income (Germany, Austria)

**Not tax advice.** These sources set out the general rules. Your own case depends on facts only an adviser can check.

| Topic | Germany | Austria |
|---|---|---|
| Reward pledges | VAT applies, because backers get something in return. Usually 19 % ([BMWK founders' portal, a Steuerberater's answer from 2015](https://www.existenzgruendungsportal.de/Redaktion/DE/BMWK-Infopool/Antworten/Steuern/Crowdfunding/Finanzierung-ueber-Crowdfunding-Steuern); its small-business threshold is outdated, see the next row) | VAT applies, usually 20 % ([CMS law firm](https://cms.law/de/aut/publication/welche-steuern-sind-beim-crowdfunding-zu-zahlen), an older article) |
| When VAT is due | When the money is received, even before the reward ships: [§ 13 (1) Nr. 1 a sentence 4 UStG](https://www.gesetze-im-internet.de/ustg_1980/__13.html) | [INFERENCE] The same principle applies (advance payments); not checked in the Austrian law |
| Small-business exemption | No VAT if total turnover was at most **€25,000 last year and stays at most €100,000 this year**. The exemption ends at the payment that crosses €100,000 ([§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html)) | No VAT up to **€55,000 gross** a year, this year and last. Up to 10 % over is tolerated until year end ([USP, BMF, updated 2026-01-01](https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/weitere-informationen-zur-umsatzsteuer/weitere-steuertatbestaende-und-befreiungen/kleinunternehmen.html)) |
| Sales to other EU countries | Above **€10,000 a year** of cross-border sales to consumers (goods plus electronic services), VAT is due in the buyer's country, filed through the One-Stop Shop ([European Commission](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en)). [INFERENCE] The domestic small-business exemption does not cover sales whose place of supply is abroad | same EU rule |
| Income tax | Profit (receipts minus costs) is taxable if you aim to make a profit (BMWK portal, above). Small businesses use cash accounting (EÜR): income counts in the year it arrives ([IHK München](https://www.ihk-muenchen.de/ratgeber/steuern/einkommensteuer-koerperschaftsteuer/einnahmen-ueberschuss-rechnung/)) | Pledges are business income (CMS, above) |
| Donations without a reward | No VAT if nothing is given in return. Gifts above €20,000 per person can trigger gift tax (BMWK portal, above) | No VAT (CMS, above) |

**Kickstarter and VAT:**
- If you use **Kickstarter's own pledge manager**, Kickstarter collects VAT on rewards shipped to EU and UK backers. Sometimes it remits the VAT itself as "deemed supplier"; in other cases it passes the collected VAT on to you to remit. You can opt out ([Pledge Manager Tax FAQ, dated 2026-08-06](https://help.kickstarter.com/en-us/articles/16236732-pledge-manager-tax-faq)).
- Without its pledge manager, VAT is "the responsibility of each individual project creator".
- Customs duties are never collected by Kickstarter.

**The year-end trap.** Funds arrive in the year the campaign ends, but production costs often fall in the next year. With cash accounting you then pay income tax on the whole sum in year one. A German creator reported exactly this ([t3n](https://t3n.de/news/kickstarter-projekt-verdient-596325/), a first-hand account). Do not let a campaign end in November or December unless most costs are paid before 31 December `[INFERENCE from the Zufluss rule]`.

**Before launch:** register the activity with the tax office, and decide on the small-business exemption with an adviser. A €10,000 campaign in your first year stays under the German €25,000 and €100,000 limits. A €150,000 surprise would not.

## 3. What could a campaign sell?

The web app is free, needs no install, and is MIT-licensed. Whatever a campaign sells must be something backers cannot already have.

| Candidate reward | Fits Kickstarter's rules? | Cost and risk | Verdict |
|---|---|---|---|
| **The web app itself** ("back us, play free") | Doubtful: "new and unique"; no funnelling to outside sites (§2.2) | None to make, but there is no reason to pledge beyond goodwill | Not as the main reward. Use GitHub Sponsors or Ko-fi for goodwill money |
| **Supporter edition**: name in the credits, a supporter badge or colour in the lobby, early builds | Yes, if part of a real project | Near zero. Small amounts | Good as a *tier*, not as the whole campaign |
| **Game packs** (new Games, possibly closed-source, on the open SDK) | Yes, if a prototype is shown | Your time. Needs a licence decision: open platform, paid Games. Digital delivery exists on Kickstarter since 2026 ([Q1 update](https://updates.kickstarter.com/kickstarter-q1-product-updates-reach-your-followers-streamline-fulfillment-and-more/)) | Possible later. Needs Games strangers want to pay for |
| **Native app** (better offline connectivity) | Yes, if a prototype is shown | 99 USD a year; app review. Apple requires in-app purchase to unlock features; a Kickstarter unlock code may be refused ([guideline 3.1.1, as quoted by The Verge, 2020](https://www.theverge.com/2020/6/17/21293813/apple-app-store-policies-hey-30-percent-developers-the-trial-by-franz-kafka); check the current text) | Not before the no-code connectivity experiments in [`docs/research/README.md`](../research/README.md) say it is needed |
| **Physical table kit**: a printed play mat with marked Tile positions, phone stands, a QR card | Yes: a new physical product | No electronics, so no CE radio rules `[INFERENCE]`. Printing, packing and shipping, plus German packaging registration (§3.1) | The most "Kickstarter-shaped" low-risk reward `[INFERENCE]`. Test demand with a pre-order page first |
| **Merch** (stickers, shirts) | Yes, as add-ons | Low margin, shipping effort | Add-on only |
| **Developer kit** (docs, workshop, priority support) | Borderline: a service | Your time | Better sold as GitHub Sponsors tiers |
| **Pocket hub device** | Only with a working prototype, no CGI; reselling a router is banned | High: see §3.1 | **Not now** |

### 3.1 The pocket hub: what selling one in the EU takes

| Requirement | What it means | Source |
|---|---|---|
| CE marking under the Radio Equipment Directive 2014/53/EU | Your own Declaration of Conformity for the whole device. A pre-certified radio module reduces testing but does not remove the assessment | [RED text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014L0053); module vendor guidance, e.g. [Microchip](https://www.microchip.com/en-us/solutions/technologies/embedded-security/radio-equipment-directive/faqs) |
| Cybersecurity rules (Delegated Regulation 2022/30, applying since August 2025) | Harmonised standards EN 18031-1/-2/-3, with restrictions. A device that lets users skip setting a password gets no presumption of conformity | [Commission RED page](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en); [Decision 2025/138](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025D0138) |
| Cyber Resilience Act | Vulnerability reporting since **11 Sep 2026**; full obligations from **11 Dec 2027**. A sold hub is in scope. The free, unmonetised app is likely not `[INFERENCE]` | [Commission, CRA reporting](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting); [CRA and open source](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source) |
| Test cost | EC impact assessment: "Minimum: circa EUR 5,000. More common testing costs: EUR 7,000 – 15,000". A German lab's price list: EMC chamber €1,760 a day, RED radio tests €1,000 flat per band | [Spilma, quoting SWD(2021) 302](https://www.spilma.com/en/guides/certification-costs); [Baudisch price list 02/2026](https://www.baudisch-electronic.de/wp-content/uploads/2025/02/Preisliste-EMV-Baudisch-Electronic-GmbH.pdf) |
| Take-back registration (ElektroG) | stiftung ear: €9.50 once per device type plus about €135 a year, plus a paid take-back scheme `[DERIVED]` | [stiftung ear fees](https://www.stiftung-ear.de/anleitungen/kosten-und-gebuehren/) |
| Packaging | LUCID registration is free, but you also need a paid contract with a packaging scheme | [LUCID](https://lucid.verpackungsregister.org/) |
| Battery | BattDG in force since 2025-10-07. A battery in the device means registration (€16.40 plus fees). From 2027 portable batteries must be user-replaceable (per compliance blogs; EU text not checked) | [stiftung ear](https://www.stiftung-ear.de/service/presse-aktuelles/battdg-in-kraft/) |
| Product safety (GPSR) | A responsible economic operator in the EU; name and address on every online offer | [Regulation 2023/988](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0988) |
| Reselling a router instead | GL.iNet Opal costs €41.33 in its EU store. Rebranding or reflashing it makes you the "manufacturer" under RED Article 14. Whether its declaration cites EN 18031 was not found | [GL.iNet EU store](https://www.gl-inet.com/en-eu/products/gl-sft1200); RED Art. 14 (above) |

And the technical case is not made yet. The repo's own research says a travel router on 5 GHz should fix the network today with no code. An offline hub additionally needs a "WebRTC-direct" listener that has not been shown to work in iOS Safari ([`docs/research/table-hub-device.md`](../research/table-hub-device.md)). The first step is a €41 router on the table, not a campaign.

If a hub ever gets made, **Crowd Supply** fits better than Kickstarter. It wants open-source hardware ("at least the firmware and the schematics") and a "late-stage, fully functional prototype". It handles fulfilment through Mouser and EU VAT. The costs:
- Crowdfunding fee: about 12 % for US delivery, **22 % + $7 per item for a product made in Germany**.
- Card processing: 3.75 %.

Sources: [funds guide](https://www.crowdsupply.com/guide/how-are-funds-received), [tariff table, dated 2026-04-30](https://www.crowdsupply.com/tariffs), [rejection reasons](https://www.crowdsupply.com/guide/why-projects-get-rejected), all read via archive.org because the site blocks bots.

### 3.2 Comparable campaigns

Numbers for Kickstarter projects are from Kicktraq's archived project pages (Kickstarter itself blocks automated reads).

| Campaign (platform, year) | What | Goal → raised | Backers (mean pledge) | What happened after |
|---|---|---|---|---|
| [Sportsfriends](https://www.kicktraq.com/projects/gutefabrik/sportsfriends-featuring-johann-sebastian-joust/) (KS, 2012) | Four local-multiplayer party games; Die Gute Fabrik, Copenhagen | $150,000 → $152,451 (101 %) | 4,146 ($37) | Funded with 101 % of goal. Early builds went out to some backers in December 2013; the release slipped past January 2014 (Polygon, linked from Kicktraq) |
| [Spaceteam card game](https://www.kicktraq.com/projects/mathewsisson/spaceteam-0/) (KS, 2015) | Card version of a free phone party game (3M+ app downloads per [Wikipedia](https://en.wikipedia.org/wiki/Spaceteam)) | $7,500 → $181,625 | 4,222 ($43) | Goal reached in under 12 hours. Published and later sold by Stellar Factory ([Forbes 2019](https://www.forbes.com/sites/johnhenryperera/2019/07/01/stellar-factory-takes-interesting-next-step-from-board-games-to-jigsaw-puzzles/)). The money came from a *physical* product built on a free app's audience |
| [Exploding Kittens](https://www.kicktraq.com/projects/elanlee/exploding-kittens/) (KS, 2015) | Party card game by The Oatmeal's creator | $10,000 → $8,782,571 | 219,382 ($40) | Delivered from late July to September 2015 ([Wikipedia](https://en.wikipedia.org/wiki/Exploding_Kittens)). A huge existing audience did the work |
| [Arduboy](https://www.kickstarter.com/projects/bateske/arduboy-card-sized-gaming) (KS, 2015) | Credit-card-sized game device | $25,000 → $433,038 | 7,221 | The prototype went viral a year before the campaign. Goal reached in 2 hours. Shipped in August 2016 ([Arduboy history](https://www.arduboy.com/blog/the-arduboy-history)) |
| [Flipper Zero](https://www.kicktraq.com/projects/flipper-devices/flipper-zero-tamagochi-for-hackers/) (KS, 2020) | Pocket radio gadget | $60,000 → $4,882,665 | 37,987 ($129) | Delayed by chip shortages. They bought parts at 3–5× and 20–30× normal prices. 90 % of Kickstarter orders shipped by mid-2022 ([Flipper blog](https://blog.flipper.net/quick-start-guide-and-shipping-update/)) |
| [OUYA](https://www.kicktraq.com/projects/ouya/ouya-a-new-kind-of-video-game-console/) (KS, 2012) | Android game console | $950,000 → $8,587,035 | 63,331 ($136) | Shipped in 2013, sold to Razer, store shut on 2019-06-25 ([Game Developer](https://www.gamedeveloper.com/game-platforms/the-ouya-s-game-store-will-close-for-good-in-june)). Funding is not a business |
| [Zano](https://www.kicktraq.com/projects/torquing/zano-autonomous-intelligent-swarming-nano-drone/) (KS, 2014–15) | Pocket Wi-Fi drone | £125,000 → £2,334,946 | 12,074 (£193) | Collapsed in November 2015. Few backers got a drone. Kickstarter commissioned a report that blamed poor management of complex hardware ([Mark Harris, Medium](https://medium.com/kickstarter/how-zano-raised-millions-on-kickstarter-and-left-backers-with-nearly-nothing-85c0abe4a6cb)) |
| [MNT Reform](https://web.archive.org/web/20251219104145/https://www.crowdsupply.com/mnt/reform) (Crowd Supply, 2020) | Open-hardware laptop; MNT Research GmbH, Berlin | $115,000 → $537,797 | 446 | Funded on 2020-06-18. Shipping updates from March 2021, so delivered about a year later. The company has run three more Crowd Supply campaigns |

Small open hardware on Crowd Supply, for scale:
- **ESP32 Rainbow** (UK) closed at 150 % of goal. That meant 118 orders plus a matching 118-unit Mouser order, with £12,840 in revenue. A CE EMC test cost 1,800 RMB. It shipped seven months after the end ([creator's retrospective](https://www.atomic14.com/2025/07/21/crowd-funding-retro)).
- **BusKill** (Estonia) raised $18,507 ([retrospective](https://tech.michaelaltfield.net/2022/10/20/crowd-supply-review/)).

**Lessons** `[INFERENCE]`:
1. The money came either from an audience that already existed (Exploding Kittens, Spaceteam) or from a prototype video that had gone viral first (Arduboy, Flipper Zero).
2. Party video games fund at modest sizes, and Sportsfriends barely made it.
3. Hardware gets delayed, and it can kill the company.
4. The one phone party game here (Spaceteam) made its money with cardboard, not with the app.

## 4. Alternatives and complements

All rows verified on the funder's or platform's own page on 2026-11-11 unless marked. "Fit" is for 1–3 private people with a free MIT web party game.

### 4.1 Platforms and donations

| Route | Who can use it | Fees / amount | What it funds | Lead time | Strings attached | Fit |
|---|---|---|---|---|---|---|
| [GitHub Sponsors](https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors) | Individuals in DE and AT | 0 % from personal accounts; up to 6 % from organisations | Anything | A few days' review; needs 2FA, a W-8BEN form and Stripe | Paid in USD; GitHub withholds no tax ([tax info](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/tax-information-for-github-sponsors)) | **Good, now** |
| [Ko-fi](https://ko-fi.com/pricing) | Anyone with PayPal or Stripe | "Ko-fi Free": 0 % on tips, 5 % on shop and memberships. The default "Standard" plan takes 5 % on everything | Anything | Same day | Not the merchant of record: VAT on sales is yours ([Ko-fi tax](https://help.ko-fi.com/hc/en-us/articles/10792069957661-How-tax-works-on-Ko-fi)) | **Good, now** (choose Free) |
| [itch.io](https://itch.io/docs/creators/html5) | Anyone | Revenue share you choose, default 10 % | Discovery; donations | Same day | HTML5 games "only take payments as donations", so no sales | Good for discovery |
| [Patreon](https://support.patreon.com/hc/en-us/articles/36426991446797-A-standard-platform-fee-for-new-creators-effective-after-August-4-2025) | Anyone | 10 % for pages published after 2025-08-04, plus 3.4 % + €0.35 per payment | Ongoing membership | Days | Patreon handles VAT. Needs a regular content rhythm | Later, once there is an audience |
| [Open Collective](https://opencollective.com/europe) via Open Source Europe | Collectives (a group, not a legal entity) | 8 % + Stripe; 10 % on grants | Transparent shared budget; can receive grants | Weeks | The US host OSC charges 10 % and wants an organisation-owned repo ([criteria](https://docs.oscollective.org/interested-in-joining-osc/acceptance-criteria.md)) | Later, if you take grants as a group |
| [Kickstarter](https://www.kickstarter.com/help/fees?country=DE) | Residents or registered businesses in DE/AT/CH | 5 % + 3 % + €0.30 | A defined project with rewards | 2–4 months of preparation `[INFERENCE]`, 30-day campaign | All-or-nothing; delivery duties (§2.2) | **Not yet** (§5) |
| [Startnext](https://www.startnext.com/help/fees.html) | 18+, living in DE/AT/CH and some other countries, **acting as a business** ([terms](https://www.startnext.com/info/agb/startende.html)) | Basic 5 % + about 3.5 % transaction fees + VAT | Same | Similar | All-or-nothing on Basic since 2026-04-01. Median all-or-nothing project: €5,500 from 69 supporters ([Startnext blog, 2026-03-26](https://www.startnext.com/blog/warum-alles-oder-nichts-ein-crowdfunding-gamechanger-ist~ba1412.html)) | A cheaper, German-speaking test of a small goal |
| [Indiegogo](https://help.indiegogo.com/article/596-fees) (owned by Gamefound since 2025-07-22) | Individuals and businesses after an identity check | 5 % + 3 % + €0.20 | Same; "Express" mode with no goal for near-ready products ([Help](https://help.indiegogo.com/article/641-express-crowdfunding)) | Similar | Flexible funding was discontinued on 2025-10-16 ([Help](https://help.indiegogo.com/article/645-what-changed-with-the-platform-upgrade)) | No better than Kickstarter here |
| [Crowd Supply](https://www.crowdsupply.com/guide/why-projects-get-rejected) (archived copy) | Open hardware with a late-stage prototype | About 12 % (22 % + $7 per item if made in Germany) + 3.75 % | Hardware runs | Months | Open firmware and schematics required; ships through Mouser | Only for a future hub (§3.1) |
| [Steam](https://partner.steamgames.com/steamdirect) | Developers after bank, tax and ID checks | $100 per product (recouped after $1,000); 30 % revenue share | Desktop games | At least 30 days | Needs a packaged desktop build of a phone-first web app | **No** |

### 4.2 Grants and prizes

| Route | Who can apply | Typical amount | What it funds | Next deadline / lead time | Strings attached | Fit |
|---|---|---|---|---|---|---|
| [NLnet Restack](https://nlnet.nl/restack/guideforapplicants/) (successor to NGI Zero) | "No categorical exclusions of persons"; 60 % of the money must go to people in Horizon Europe countries ([eligibility](https://nlnet.nl/restack/eligibility/)) | €5,000–50,000 for a first proposal | Open technology: "alternatives to closed online technologies… including the end user applications" | **3 Jan 2027, 12:00 CET**. The budget is expected to run out in early 2027 | Everything under a FOSS licence; proposals written "by humans, not AI" ([propose](https://nlnet.nl/propose/)) | **Possible.** Pitch it as a serverless, account-free local multi-device stack with offline signaling, not as a party game |
| [NGI Zero Commons Fund](https://nlnet.nl/commonsfund/) | — | was €5k–50k | — | Final call closed 2026-06-01 | — | **Closed** |
| [Prototype Fund](https://www.prototypefund.de/en/application) | Individuals living and taxed in Germany, or a **GbR** of up to 4 people; no companies | €47,500 per person, €95,000 per team, for June–Nov 2027 | Open-source software: security, infrastructure, "free alternatives to proprietary… software" | **30 Nov 2026, 15:00 CET**; selection Dec 2026–Mar 2027 | Open-source licence; at least 5 % own share; full-day kick-off and Demo Day in Berlin ([OSB Alliance, 2026-10-05](https://osb-alliance.de/news/prototype-fund-bewerbung-fuer-drei-open-source-foerderlinien-gestartet)) | Weak topic fit; tight deadline |
| [Sovereign Tech Agency](https://www.sovereign.tech/programs/fund) | Maintainers of critical open-source infrastructure | Costs above €50,000 | Existing infrastructure | About 6 months | "We do not finance the development of prototypes"; "not looking for user-facing applications" | **No** |
| [Epic MegaGrants](https://www.unrealengine.com/megagrants) | Unreal projects and open-source 3D tools | $5,000–250,000 | Unreal or 3D | 2026 cycles closed; 2027 dates not published | — | **No** |
| [Games-Förderung des Bundes](https://www.bmftr.bund.de/DE/Technologie/Games/Games_node.html) (BMFTR, via DLR) | Legal persons with a seat in Germany, not founded for the project, with a reference title ([guideline](https://www.bmftr.bund.de/SharedDocs/Downloads/DE/2025/games-f%C3%B6rderrichtlinie.pdf?__blob=publicationFile&v=2)) | 25–50 % of a project of **at least €300,000** | Prototype and production | Open first come, first served until 31 Dec 2026; a 2027 call was not found ([2nd call](https://www.bmftr.bund.de/SharedDocs/Downloads/DE/2025/games-zweiter-f%C3%B6rderaufruf.pdf?__blob=publicationFile&v=1)) | At least 50 % own funds; a USK rating; no stacking with state funds | **No** |
| [Medienboard Berlin-Brandenburg](https://www.medienboard.de/en/games/deadlines) | Companies and trade-registered persons in Berlin/BB | Prototype: interest-free loan of up to 50 %, up to €300,000 | Prototype and production | **2 Feb 2027**; a meeting with the fund about 2 weeks before is mandatory | Repaid only from the game's revenue | Possible, if in Berlin/BB |
| [FFF Bayern](https://www.fff-bayern.de/en/funded-areas/games/) | Concept: natural persons, teams of 2+ covering tech, design and art. Prototype: companies or partnerships | Concept grant up to €30,000; prototype grant up to €200,000 (80 %) | Concept (4 months), prototype | **2 Feb 2027** (committee 16 Mar) | Normally full-time and commercial; a design document and a playable proof needed; seat in Bavaria | Good, if in Bavaria |
| [MFG Baden-Württemberg](https://games-bw.mfg.de/foerderung/) | Studios and companies in BW | Concept up to €20,000; prototype up to €120,000 (80 %) | Concept, prototype | **28 Jan 2027**, online; consultation mandatory | Effect in BW required | Possible, if in BW |
| [Film- und Medienstiftung NRW](https://www.filmstiftung.de/foerderung/games/digitale-spiele-und-interaktive-inhalte-konzept-fr%C3%BChphase) | Companies and trade-registered persons in NRW | Early-phase grant up to €50,000 (50 %, 80 % in exceptions) | Concept to first prototype; web and mobile in scope | 2027 dates not found; consultation mandatory | At least 10 % own funds | Good, if in NRW |
| [Gamecity Hamburg](https://gamecity-hamburg.de/de/foerderung/) | Natural and legal persons, developer groups in Hamburg | Grant up to €80,000 (80 %) | Prototype | 2027 round to be announced | Prior game-dev experience "unabdingbar"; work must not have started | Good, if in Hamburg |
| [nordmedia](https://www.nordmedia.de/pages/foerderung/subpages/einreichtermine_fuer_alle_foerderbereiche/index.html) (NI/HB) | Developers, groups, companies; NI/HB preferred | Concept up to €20,000; prototype grant up to €100,000 (80 %) | Concept, prototype | **14 Jan 2027**; consultation window 12 Nov–11 Dec 2026 ([sheet](https://www.nordmedia.de/meta_downloads/153519/01102026_merkblatt_games_foerderung.pdf)) | 20 % own share, which may be own work | Good, if in NI/HB |
| [MDM](https://www.mdm-online.de/foerderung/downloads/merkblaetter-richtlinien/richtlinie-games-xr) (SN, ST, TH) | Companies and persons with a trade licence; not students | Concept up to €30,000; prototype up to €100,000 | Concept, prototype | 2027 dates not found | Economic effect in the region | Possible, if there |
| [WIBank Hessen serious GAME](https://www.wibank.de/wibank/gruender-unternehmen/kreativ-und-gamesfoerderung) | Companies, founders, graduates in Hessen | Up to €50,000 (60 %), minimum costs €20,000 | Games; serious games preferred | 2026 closed; 2027 call not found | All other financing must be secured | Weak |
| [FFG Basisprogramm Kleinprojekt](https://www.ffg.at/ausschreibung/basisprogramm-kleinprojekt-2026) (AT) | Small and medium companies, or companies being founded | 45 % of up to €150,000, maximum €88,500 | Technically challenging development toward a product | Rolling until 31 Dec 2026, continues in 2027 | You must finance the own share | Possible, with an R&D framing and a company |
| [Wirtschaftsagentur Wien, Kreativwirtschaft Projekt](https://wirtschaftsagentur.at/aktuelle-foerderungen-der-wirtschaftsagentur-wien/foerderung-projekt-kreativwirtschaft/) | SMEs and founders with a (planned) site in Vienna | 50 %, up to €200,000, minimum project €10,000 | Explicitly "Multimedia und Games" | **31 Dec 2026**; decision in about 2 months | De-minimis aid; 50 % co-funding | Possible, if in Vienna |
| [Content Vienna](https://wirtschaftsagentur.at/aktuelle-foerderungen-der-wirtschaftsagentur-wien/content-vienna/) | Private persons, companies, associations in Vienna | €10,000 prizes (5 + 1) | Content including games | Next window in 2027 (2026: 20 May–8 Sep) | Development mainly in Vienna | Good, if in Vienna |
| [aws First Incubator](https://www.aws.at/en/aws-first-incubator/) / [aws Preseed Innovative Solutions](https://www.aws.at/en/aws-preseed-innovative-solutions/) | Founders; First Incubator only with an AplusB incubator; Preseed needs social or ecological impact | Up to €49,000 / up to €89,000 | Pre-founding work | First Incubator: 2 Dec 2026, via AplusB; Preseed: rolling, about 10 % success | Growth orientation | Weak |
| [Creative Europe MEDIA](https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/crea/wp-call/2027/call-fiche_crea-media-2027-devvgim_en.pdf) | Production companies with a game "commercially distributed" since 2024 that "generated revenues"; not natural persons | Up to €200,000 at 60 % | Pre-production of **narrative** games | 2 Feb 2027 | Track record | **No** |
| [Deutscher Computerspielpreis](https://deutscher-computerspielpreis.de/einreichphase-fuer-den-deutschen-computerspielpreis-2026-startet-am-5-januar/) (prize) | Games at least 80 % developed in Germany | 2026: "Beste Innovation und Technologie" €40,000, open to "alle innovativen Projekte mit Games-Bezug"; "Bestes Mobiles Spiel" €40,000 | Recognition plus money | 2026 entries were 5–23 Jan. The 2027 window is not announced; expect January `[INFERENCE]` | The "Bester Prototyp" category is for students and unpublished games only, and Bezel is already public | **Worth an entry**, if German |

Aid rules: several regional grants count as "de-minimis" aid, which is capped at €300,000 per company over three years (nordmedia sheet, above). The federal fund cannot be combined with state money. NLnet treats its grants as "charitable gifts" ([guide](https://nlnet.nl/restack/guideforapplicants/)). How German or Austrian tax law treats a grant you receive privately was not checked: ask your adviser.

## 5. Recommended sequence, with gates

The thresholds below are our judgement where no source gives a number `[INFERENCE]`. Change them, but write them down before you look at the data.

| # | Step | When | Gate: what must be true first | Cost | Legal form (DE / AT) |
|---|---|---|---|---|---|
| 0 | Decide who is "we", where each of you lives (state), and whether anyone is a student | This week | — | 1 conversation | — |
| 1 | GitHub Sponsors + Ko-fi Free; "Support" link in the README and the Host's sheet | This week | 2FA on GitHub; a bank account | €0, half a day | Private person. Income is still taxable: keep a list |
| 2 | Demo video (60–90 s, real phones, no effects); itch.io page with donations | Within 2 weeks | — | €0, 1–2 days | — |
| 3 | Start measuring: weekly Sessions and how many come from strangers; email sign-up on the landing site | Within 2 weeks | Privacy notice and imprint live | €0 | — |
| 4 | Prototype Fund (optional) | By **30 Nov 2026** | At least one maker lives in Germany; you can work about 950 h per person in Jun–Nov 2027; a pitch framed as infrastructure | €0, 2 days | Individual, or a GbR for a team |
| 5 | NLnet Restack | By **3 Jan 2027** | Step 2 done; a 1-page plan for what €5–50k pays for (e.g. offline signaling, the hub listener, documentation) | €0, 1–2 days | Private persons are fine |
| 6 | State games fund, concept lane | Jan–Feb 2027 (see §4.2) | Consultation booked; usually a registered trade (Gewerbe) or GbR; a design document and the playable demo | €0 to apply; the trade registration fee varies by town (not checked) | Gewerbe or GbR (DE); depends on the fund (AT) |
| 7 | DCP 2027, "Beste Innovation und Technologie" | January 2027 window `[INFERENCE]` | At least 80 % developed in Germany; release inside the eligibility window | Entry fee not checked | — |
| 8 | Audience build-up | Spring–summer 2027 | — | Your time | — |
| 9 | Small paid test: a pre-order page or a Startnext campaign for a physical table kit or a supporter edition, goal ≤ €5,000 | Summer 2027 at the earliest | Gate A (below) | 8–10 % fees | Registered business (Startnext requires it) |
| 10 | Kickstarter | Second half of 2027 at the earliest | Gates A and B (below) | 8.75 % + VAT + rewards | Individual with a registered trade, or a GbR; a UG for anything with hardware |
| 11 | Hub on Crowd Supply | 2028 or later | Gate C (below) | €5–15k testing + 22 % + $7 per item | UG/GmbH (DE), GmbH (AT) `[INFERENCE]` |

**Gate A, before any paid product:**
- 8 weeks in a row with Sessions started by people you do not know. Count them; no benchmark exists, so pick a number now (for example 50 a week).
- At least 300 email subscribers.
- A reward that exists as a working prototype.

**Gate B, before Kickstarter:**
- At least 800 Kickstarter pre-launch followers for a €10,000 goal (§2.5), or proportionally more for a bigger goal.
- At least 2,000 email subscribers.
- The demo video, plus a second video of strangers playing.
- The tax set-up from §2.6 done with an adviser.
- A campaign end date before November.
- An answer from Kickstarter support on whether your main reward is allowed (§2.2).

**Gate C, before hardware:**
- The travel-router experiment passed: zero `device-lost` events and host/host pairs on iPhones ([`docs/research/table-hub-device.md`](../research/table-hub-device.md)).
- WebRTC-direct works in iOS Safari.
- A late-stage prototype.
- A quote from a test lab.
- A limited company.

## 6. Legal forms

| Form | Founders | Capital | Liability | Set-up | Source |
|---|---|---|---|---|---|
| DE: private person, freelance or sole trader (Einzelunternehmen) | 1 | none | personal, unlimited | Freelance: report to the tax office. Trade: register at the Gewerbeamt. Selling products counts as trade | [IHK Berlin](https://www.ihk.de/berlin/service-und-beratung/recht-und-steuern/gewerberecht/abgrenzung-gewerbe-und-freier-beruf-4333398); [founders' portal](https://www.existenzgruendungsportal.de/Navigation/DE/Gruendungswissen/Rechtsformen/rechtsformen) |
| DE: GbR | 2+ | none | personal, joint | No notary. Optional register entry as "eGbR" (about €300; cannot be undone) under the 2024 MoPeG reform | [IHK Berlin, MoPeG](https://www.ihk.de/berlin/service-und-beratung/recht-und-steuern/firma-und-rechtsformen/rechtsformen-fuer-unternehmen/modernisierung-der-gesellschaft-buergerlichen-rechts-mopeg--6009132) |
| DE: UG (haftungsbeschränkt) | 1+ | from €1 | limited to the company | Notary and commercial register; about €280 with the standard template (2022 notary figures) | [founders' portal](https://www.existenzgruendungsportal.de/Redaktion/DE/BMWK-Infopool/Antworten/Recht/Rechtsformen/UG-haftungsbeschraenkt/UG-Gruendung-Ablauf-Kosten) |
| DE: GmbH | 1+ | €25,000 (€12,500 paid in at founding) | limited | Notary and register | founders' portal (above) |
| AT: Einzelunternehmen | 1 | none | unlimited | Exists with the trade registration. Company register entry only from €700,000 turnover; a voluntary "e.U." entry is possible | [WKO, dated 2026-04-16](https://www.wko.at/gruendung/einzelunternehmen-eu) |
| AT: OG | 2+ | none | unlimited, joint | Exists only once entered in the company register | [WKO, dated 2026-07-21](https://www.wko.at/wirtschaftsrecht/gesellschaftsformen-oesterreich) |
| AT: GmbH / FlexCo | 1+ | GmbH €10,000 (€5,000 in cash); FlexCo shares from €1 | limited | Notarial act | [WKO GmbH](https://www.wko.at/wirtschaftsrecht/gesellschaft-mit-beschraenkter-haftung-gmbh) |

Which form each route accepts:

| Route | Private person | GbR / OG | Company (UG, GmbH) |
|---|---|---|---|
| GitHub Sponsors, Ko-fi, itch.io, Patreon | yes | — | yes |
| NLnet Restack | yes | yes | yes |
| Prototype Fund | yes (living in Germany, freelance or self-employed) | **GbR only** for teams | no |
| Kickstarter | yes (resident) | as a registered business | yes |
| Startnext | only as a business (§ 14 BGB) | yes | yes |
| FFF Bayern concept; Hamburg; nordmedia; Content Vienna | yes | yes | yes |
| Medienboard, NRW, MDM | with a registered trade | yes | yes |
| FFF Bayern prototype | no (unless you have 2 published games) | yes ("rechtsfähige Personengesellschaft") | yes |
| MFG BW | not stated ("Entwicklungsstudios und Unternehmen") | not stated | yes |
| FFG Kleinprojekt; Wien Kreativwirtschaft Projekt | only as founders of a company being set up | not stated | yes (small and medium companies) |
| Federal games fund | no | no | only an existing company with a reference title |
| Creative Europe | only as a sole trader with a game that earned revenue | not stated | yes, with that track record |

`[INFERENCE]`:
- The "GbR / OG" column is our reading of each funder's wording ("Unternehmen", "Entwicklergemeinschaften", "rechtsfähige Personengesellschaften"). Confirm it in the funder's consultation before relying on it.
- Two or more people who run a project together with a shared aim may already be a GbR without signing anything. Write a one-page partnership agreement (who owns the code and the name, how money is split, what happens if someone leaves) before the first euro arrives.
- A GbR's partners are personally liable for all of its debts. That is fine for donations and grants. It is not fine for a hardware campaign with refund duties (§2.2).

## 7. What not to do yet, and why

- **No Kickstarter in the next months.** There is no audience to bring, no reward that is not free already, and the success rate for first-time creators is 34 % (§2.3). A public failure costs more than waiting.
- **No hardware campaign.** It means €5–15k of tests before the first sale, CRA duties from December 2027, and personal liability for refunds. Zano and Flipper Zero show what happens to schedules (§3.2). The €41 router has not even been tried yet.
- **No company "for the funding".** Only the federal fund and Creative Europe strictly need one, and both are out of reach anyway. The federal fund even excludes companies founded for the project. Found a UG when there is a product to sell or liability to cap.
- **No Patreon yet.** 10 % for new pages, and it needs regular content you do not yet produce.
- **No paid agency, ads or crowdfunding consultant.** The agency figures in §2.5 come from firms that sell exactly this service.
- **Do not promise a native app or a hub in any application.** The repo's own research has not shown either is needed (`docs/research/README.md`). Promise what the money will verifiably build.

## Open questions for the makers

1. Where does each of you live: which country, and in Germany which state? That alone decides which regional fund and which national programme (Prototype Fund, DCP, FFG, Vienna) is open to you.
2. How many of you are there, and are you willing to sign a GbR agreement? Is anyone a student or under 26 (Prototype Fund "Up and Coming", the DCP prototype category, aws)?
3. Do you want to be paid for your time (then grants), or only to cover costs (then donations)? How many hours a week can each of you give through 2027?
4. Are you ready to keep everything open source? NLnet and the Prototype Fund require it. Paid closed-source Game packs would be a separate decision.
5. Which Metered plan does the account have (20 GB or a 500 MB trial)? At what number of Relay hours does it start to cost money?
6. Who makes the demo video and keeps the email list? Both are gates for every route above.
7. Would you rather sell something physical (a table kit), something digital (Game packs), or nothing at all, and live on grants and donations?
8. Has anyone asked Kickstarter support whether a supporter campaign for a free open-source web app is allowed? Ask before planning a campaign around it.
