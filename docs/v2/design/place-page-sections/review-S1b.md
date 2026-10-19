# S1b design review: place pages and "Who it suits"

Reviewer: travel-design-reviewer, 19 Oct 2026. Branch `public/S1b` at c314a7e, `web/out` served on :4471. Chromium 1248 on the
Arc GPU, 1440 and 390 at 2x, light and dark (set with the site's theme toggle). Shots and tiles: `/tmp/s1b-review/`.

**Verdict: not ready to merge.** The frame, the section order and the three chip looks work. Nine must-fixes remain. Most are
small guards or wording changes, but four of them tell a family something false: a booking is not needed, drive to a
stop on a closed road, a stop fits a 3-year-old, the basics are done.

## Rulings on the builder's differences from the mock

| Difference | Ruling |
|---|---|
| The rail holds only the map, Directions and Used in | **Accept.** This is PS2 itself. But the rail now starts beside section 3, so at 1440 the first view has no Directions at all (M5). |
| Hazards and Links in the main column | **Accept.** This is X11 as decided. The older pages still have them in the rail; see the seam. |
| A no-photo cover is a dark band with the title on it | **Accept** instead of PS6's well band with the title below it. White on `--header` is above 13:1 in both themes. Keep the band at 260 px or less (Larch is about 255). Record it as a PS6 amendment. |
| Native `<details>` for the groups and provenance | **Accept.** They animate with `interpolate-size` in Chromium and open at once elsewhere, which P5 allows. Esc returns focus. |

## Must-fix before merge

| # | Screen | What is wrong | Fix |
|---|---|---|---|
| M1 | 89 pages; `otzi-1440-light-1`, `larch-1440-light-1` | "No booking or permit needed · our judgement" is drawn from an **empty** relevance `access_cost` (`html.ts` 238). Ötzi's own summary says "Reservations recommended". Larch has an official Group Access rule and a shuttle seat. A gap is read as a yes. | Draw the none line only for a searched-none or a no_limit value with an official or operator basis. Otherwise draw the closing line "Not checked yet: bookings and permits". |
| M2 | `larch-1440-light-1`, `morainels-1440-light-1` | Directions go to the Moraine Lake shuttle stop, "where you start". Private cars cannot use Moraine Lake Road (T5, PS4). | When access is shuttle only, target the access place that `parks_for` it (the Lake Louise Park and Ride). With none stored, keep no driving button and say "No private cars on this road: take the Parks Canada shuttle". |
| M3 | 11 Dolomites pages; `lagazuoi-1440-light-1` | The pointer reads "Nearby, Dolomites is the one people travel for", which names the region the place sits in. Mirador de las Aguilas points to "Village and cafes". The name prints twice, and the glyph sits on its own line. | Extend the PS9 guard to every container ancestor and to non-place kinds. Print the name once, as the link. Put the glyph inline. |
| M4 | `louise-1440-light-1` and `-2` | Plan B has no risk to answer: "Emerald Lake is the same kind of draw: no booking". It sits directly above "No booking or permit needed" (PS8). | In section 3, draw Plan B only under a Book or Access line. Otherwise keep only the Similar nearby tag. Say "the same kind of view", not "draw". |
| M5 | `louise-1440-light-1`, `larch-390-light-1` | There is no Directions action in the first view at 1440. On phone the cover's amber button is "Save to a trip" (PS3, P7, Part B check 3). | Add Directions to the cover actions: secondary at 1024 and wider, amber on phone. Make Save secondary. |
| M6 | `larch-1440-light-1` | Larch reads "Basics only" while the page says "No point is stored for this place yet". A basic check (D4) has failed. | See the research levels below. |
| M7 | `capri-1440-light-1`, `old-finger-1440-light-1` and `-2` | On older pages the glance says "Not checked yet: season" while When to go shows May to Sep. "No other places are recorded here yet" uses a word PS14 bans. | The glance reads the same season value. Use "Not checked yet: places in Capri" or "None found · searched <date>". |
| M8 | `rockies-day5-fam3-1440-light` | With `?p=family-3` the day head says "Whole family: fits age 3", but Mary Schaffer Loop says "Not suited to age 3". The Spirit Island cruise and Pyramid Lake have no fit chip, so they read as fine. | The head counts the stops: "1 stop not suited to age 3 · 2 not checked". A stop with no data shows the dashed "Kids: not checked yet". |
| M9 | `louise-1440-light-1` and `-3` | The glance and section 7 show "Walk 200" with no unit. | Use the unit renderer: "200 m from the lot". |

## Research levels

"Partly checked" on a page that has failed a required check is not honest. "Basics only" on a draft is worse, because a
draft is by definition missing a basic. Change the rule to this:
- `draft` reads "Early research · n of m".
- `usable` reads "Partly checked · n of m".
- `complete` reads "Checked".

Drop the half rule. The count already carries the progress. Remove the repeated "14 of 18 place checks done" beside the level chip.

## Who it suits

Three chips at rest, one warning line and a research line read well at first sight. The filled chip with a lock against
the outlined chip with a person separates a rule from advice without a legend (P4). The dashed chip reads as unsettled.
The lock renders in dark mode both as SVG (`otzi-chips-390-dark`) and as the card's CSS mask
(`list-cards-390-dark`). The mask test was injected, because no list row carries a rule chip today.

Approved pairs, light / dark: `--ink` on `--surface-2` 13.66 / 12.24; `--ink-2` on `--surface` 12.09 / 10.76; the
`--muted` dashed chip on `--surface` 6.94 / 7.45; `--ok` on `--ok-soft` 5.53 / 7.87. That last one is the D6 fit chip,
the only green, and it shows only under a profile, as D6 approved.

## Stage-4 fixes

| # | Screen | Fix |
|---|---|---|
| S1 | `larch-1440-light-2` | "13 of 13 family checks done" sits above about 9 "Not checked yet" items. Say "13 of 13 key checks · 9 more not checked yet". |
| S2 | `larch-390-light-2` | Chips break inside the pill on phone ("4 h 30–5 / h 30"; `.su-chip-in` gets `white-space: normal` at narrow widths). Keep the text on one line and wrap whole chips. The dashed summary chip's text touches its border and ends in a comma ("fixed aids,"). |
| S3 | `larch-1440-light-2` | The "When you can go" echo is a dump of raw keys ("access:", "hazards:") with cuts mid-word, and it repeats the hazard. Use the short renderers ("Shuttle 1 Jun – 12 Oct") and drop the hazards. |
| S4 | `larch-1440-light-2` | One trail shows two adult times: 4 h 30–5 h 30 on the chip and 5–6 h on the stat line. One home (PS1). |
| S5 | `larch-1440-light-1` | Glance slots repeat each other ("Trailhead and parking" and "Starts at" are the same stop). Lagazuoi's "Starts at: Not checked yet" contradicts its Directions note. |
| S6 | `list-table-1440-light`, `rockies-day5-*` | The units toggle says "mi, ft". The table and the timeline use it; place sections stay in km. Section values should follow the toggle. |
| S7 | `louise-1440-light-4` | Links shows three markers for one gap. "Official 0" should be the dashed "Official · not checked yet" (PS14). Raw keys leak into closing lines ("openstreetmap", "part of"). |
| S8 | `lagazuoi-1440-light-2` | The rule chip says "adult under 18". Use "Under 18 with an adult". |
| S9 | `list-cards-1440-dark` | The card rule chip draws the lock and the person glyph together. The lock should replace the person glyph. |
| S10 | `bolzano-1440-light-1` | The section has no chip row at rest. Show the stroller and wheelchair chips. |
| S11 | `list-list-1440-light` | A lone "Not checked yet" in a chip row does not say what is missing. Use "Kids: not checked yet". The kind chip and the effort chip share the hiker glyph. |
| S12 | `lagazuoi-390-*` | Phone pages run 6,000 to 8,700 px. Add a one-line section index after the glance. |
| S13 | `louise-1440-light-2` | A "Who it suits" group sits inside the "Who it suits" section. Title the group "For a family". |

## Fine as built

- The 14-section order, the section cards, the gap and closing-line forms, and the 200 ms group opens.
- Collapsed group summaries on phone read as one line of values, then the dashed chip.
- The relevance chip is outlined in `--ink` and never filled. Cards carry kids, effort and at most one relevance chip.
- Day-row chips wrap cleanly to a second line at 390.
- **Page weight:** the heaviest page (+24%) is still scannable on desktop. On phone it relies on S12.

## The seam with the 81 older pages

It is acceptable for a visitor. Both layouts use the same cover, glance and gap words, and a visitor moves between them
through links, not side by side. The differences are no section cards and Hazards and Links in the rail. M7 must land
first, because a contradiction on every older page would make the seam read as broken.

## Known data gaps

The Ötzi price and hours mismatch is data, not design. But M1 is design: the booking line came from an empty field.

Moraine Lake and the Banff Gondola have no pages:
- `/places/moraine-lake/` returns 404, and search does not find Moraine Lake.
- Moraine Lake appears as plain text in Lake Louise's Similar nearby ("shuttle or bus only · 10 km") and as the pointer target on 4 pages.
- The Gondola top station is the pointer target on Fenland, Troll Falls and Wedge Pond, 4 to 42 km away. None of these mentions is a link.

This is acceptable until the page seeds land, because nothing links to a 404. For stage 4, drop the pointer when its target
has no page, since "the one people travel for" with nothing to open is a dead end. Also cap "Nearby" at about 25 km.

## Principle scores

- **Pass:** P1, P5, P6, P8 (list rows carry only the chip keys), P9 (every block reads `place.sections`), T1.
- **Pass once the stage-4 items land:** P3 (S5), P4 (S8, S11), T2 (S2, S12).
- **Fail until the must-fixes land:** P2 (M1, M8), P7 (M5), T3 (M6, M7), T4 (M8), T5 (M2).

## Change log

| Date | Change |
|---|---|
| 2026-10-19 | First review of S1b: 9 must-fixes, 13 stage-4 items, rulings on the four mock differences and the research levels. |
