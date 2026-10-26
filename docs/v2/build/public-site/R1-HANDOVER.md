# R1 hand-over: review the phase A UI fixes

Written 21 Oct 2026. Gate R1 of [EXECUTION-PLAN.md](EXECUTION-PLAN.md) section 8. Nothing here is live: the public site at nks-travel.pages.dev is still the old site, and nothing was pushed to `origin/main` or deployed.

## What you are reviewing

Preview 1 is the site built from `main` commit `4794989` (all phase A lanes merged, `bash tools/check-all.sh` ends `CHECK-ALL OK` with no env file, full browser suite on this exact commit: 723 passed, 27 skipped, 0 failed, on Chromium and WebKit; Firefox cannot launch on this Mac and is opt-in). It is built with the public Google Maps key; the ORS key is in 0 output files. It is served on this Mac at `http://127.0.0.1:3440/`.

To open it on your phone or another machine, start a tunnel yourself (the assistant's attempt was blocked as an external ingress, correctly, so it needs your go):

```
! cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3440
```

Copy the `https://...trycloudflare.com` URL it prints. Stop it with Ctrl-C when done. The local server's PID is in the session scratchpad; it is killed by PID, never by name.

## What changed in phase A

| Area | Change |
|---|---|
| Search | Panel opens whole inside the viewport from the hero and header buttons; a second press on header Search closes it |
| Header and footer | No Sign in link (flag off); Report a problem is built and switched off until the feedback repo exists (the last step) |
| Globe | Fly here moves the camera and ends inside the feature; rivers, plains, deltas, lakes and ranges draw their own line; Natural features switch (`nf=0` kept in the link); the feature card no longer covers the feature (phone and landscape); count discs do not overlap |
| Places | Where pill: Country, then State or province, then parks and areas, with counts and removable chips; phone drill-down; lone-Kind empty state; phone search box; count tween |
| Trail pages | Key-facts strip (distance, climb, time, effort, dogs and the rest) with "Not checked yet" where unknown; one trail guide link on every trail (122 of 122); cover Directions chooser |
| Place pages | One source for each fact (Otzi hours and price once); Save to a trip is the one primary action where there are no directions |
| Trip pages | Phone Map button moved into the sticky day strip; Patagonia cover and Day 2; Switzerland overview has one notice; Dolomites Day 4 limits chip; one Rockies Canmore stop (scope pinned at 206) |
| Tests | Racy specs fixed, Firefox opt-in on this Mac, screenshots tiled |

## Your script (about 40 minutes)

The step-by-step script is [EXECUTION-PLAN.md section 8.4](EXECUTION-PLAN.md). Two wording changes since it was written: row 5 now reads "the Trail guide tile: Search for this trail" (the platform name stays out of visible page text by the privacy rule), and Moraine Lake has no Directions button on purpose (the road is shuttle-only, and the cover says so).

## Judgement calls only you can make

1. **Mount Robson time zone (R1 row 11).** Rockies Day 6 says Mount Robson is on Pacific time. That is an inference from the data (Valemount and Mount Robson observe Pacific time), and the page states it as fact. Keep, soften to "probably", or remove?
2. **Default list order (row 12).** Countries with a photo first: keep or change?
3. **Home globe mock (row 7).** `docs/v2/design/globe/mock/index.html`: approve or say what to change. The real home globe look is built after you decide.
4. **Metadata baseline (row 8).** What phase E will fill: [EXECUTION-PLAN.md section 6.4](EXECUTION-PLAN.md) (359 pages, 121 with no point, no record has a nearest town).

## Known issues (none blocks R1)

From [verify-R1.md](verify-R1.md) and [audit-R1-output.md](audit-R1-output.md). Both reports found 0 must rows. Fixed since: feedback URL encoding, `noopener` on every new-tab link, the Natural Earth and world-countries licence rows (world-countries is ODbL 1.0, not CC BY-SA), a municipality's email and tax code in one source line (a privacy test now blocks any email), the 844 by 390 globe landscape view.

Still open, all "later": Quebec overview stacks two banners; the Dolomites limits chip can wrap; the landscape home hero covers two cover pins; Patagonia Day 2 shows "no stops on the map" until its base points are researched (phase E data); "EUR 13" against "€13" on Otzi; robots.txt does not yet block AI crawlers and `/specimen` is still built (readiness list); mobile Lighthouse performance is low on a throttled localhost (home 30, globe 27, trips 71), to be judged again on a real host. Lighthouse accessibility, best practices and SEO are 100 on all seven pages.

## Questions for you

| ID | Question | Recommendation |
|---|---|---|
| D18 | Superseded 21 Oct: the trip-planner skill's HTML half is retired, not moved; new trips are data only and any HTML change is a web app change. See `docs/v2/SKILLS-AND-DATA-ONLY.md`. Confirm the six points O-1 to O-6 there (BACKLOG Q79 to Q82). | Yes |
| Q70 follow-up | Create the public feedback repo (last step), and is publishing your GitHub handle in its URL acceptable? | Yes, at the last step |
| Authorship | "by Nitin" appears on all 14 trip pages. Keep? | Confirm at R2 |

## How to report

Reply with one line per finding: the page and what you saw (a screenshot helps). Each becomes a BACKLOG row (`6.2-R1-n`) the same day, and you get the IDs back. R1 closes when no must row is open and you say so. It does not approve go-live.
