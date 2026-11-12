# 04: A phone that is joining says so in plain words, and gets help after 15 seconds

**What to build:** A joining phone reads "Finding table REZV…", "Connecting…", "Lost the table. Reconnecting…". After 15 seconds without getting in it shows a help card: check the code on the first phone, keep that phone's screen on, an iPhone hotspot often fails so use the same Wi-Fi or mobile data on every phone, with Try again and a field to correct the code. The first phone gets the same advice when one phone keeps dropping (spec D7).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] What a joining phone says is one pure function of the Session's status, the time since the page tried to join and whether it has ever been in; unit tests cover each status before and after 15 s, and a phone that was in and lost the table
- [ ] A wrong code shows the card after 15 s; the code field on the card joins the corrected table
- [ ] Try again reloads the join for the same code
- [ ] The card goes away by itself when the phone gets in
- [ ] A phone that joins while a Match runs reads that it joins the next one, in plain words
- [ ] A phone that was the lost one reads "You're back" while the Match resumes, never the notice about itself
- [ ] The first phone shows the advice line once it has seen one phone's connection end three times in a row without lasting
- [ ] With Maker mode on, the makers' wording and figures are still available beside the plain words
- [ ] Browser smoke: a wrong code; a first phone closed while a second is joined (card on the second after 15 s)
- [ ] The troubleshooting guide's entries quote the new words
