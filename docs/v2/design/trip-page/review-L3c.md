# Design review: L3c trip timeline (18 Oct 2026)

Reviewer: travel-design-reviewer (Opus). Branch `public/L3c` at 287f1f8, built with `pnpm build` (exit 0, no `.env.local`) and served from `web/out`. Chromium 1248 on the Arc GPU (ANGLE/GL), 1440 and 390, light and dark, 2x. Screens are in `/tmp/l3c-review/`.

**Verdict: not ready to merge. The structure is right, but the times are not yet believable.** Overall the build matches the design: the profile is chosen once, a strip shows the whole trip, every day has a time rail with legs, meals, rest and sun rows, the state lives in the URL, there are no research markers, and there is no green. What blocks the merge is credibility. Every day carries a warning, added places get invented 10-minute drives, a summary trip's flight day has no flight in it, and times like 15:57 claim a precision the page does not have. A family judging whether "Day 5 works with a 6-year-old" would be misled. Fix those eight items before merge.

## Scores

| | Score | Note |
|---|---|---|
| P1 scale | pass | 15 rows; strip and rail hold to 30 days |
| P2 progressive | pass | "Why this time" and Know before you go open in place; safety warnings stay visible at rest |
| P3 glance | **fail** | ⚠1 on 14 of 15 rows, so the mark carries no information; drive text truncated; on a phone the header fills the screen before the first time |
| P4 no manual | partial | no "Show both lanes" button; "Plan as written" in the bar says nothing |
| P5 smooth, linked | **fail** | a profile change swaps every day at once (only the segment thumb animates, 200 ms); the map does not follow the scroll |
| P6 metadata | pass | slot, km, gain and duration are chips and short values |
| P7 the 90% | pass | Copy keeps the profile |
| P8, P9 | pass | the add-to-day candidates are pre-filtered on the server; no bulk load |
| T1 when | pass | sun ranges for the window; slots marked |
| T2 field | partial | no horizontal scroll at 390 (scrollWidth 390), but the phone header is too tall |
| T3 trust | **fail** | fabricated legs and unrounded times (M2 to M4) |
| T4 families | partial | the age wording is wrong (M8) |
| T5 honest maps | partial | "78 stops have no map position" is honest; the route map opens zoomed on one dot |

Contrast pairs used, checked against tokens.md 2.2: `--muted` on `--surface` 6.94 / 7.45, `--warn` on `--surface` 6.92 / 8.31, `--accent-text` on `--surface` 6.33 / 7.99, `--accent-ink` on `--accent` 6.96. All pass AA in light and dark (`rk-1440-dark-top-a.png`, `rk-d5-1440-dark-el.png`).

## Must fix before merge

1. **The day-cap warning fires on 14 of 15 Rockies days at the author's own profile.** Day 5 forced to the Easy day, with a 4 h 35 rest at the base, still reads "runs 11 h 30, over 10 h". (`rk-1440-light-tile0-1.png`, `rk-d5C-1440-el1x.png`) Fix: measure the cap on time away from base. Leave out rest at the base of 45 minutes or more, and dinner at the base. Target: on the default profile, only the genuinely long days warn (Rockies 5 and 8).
2. **Added places get invented legs.** Adding Bow Lake to Day 5 (Jasper) gives "Drive 10 min to Bow Lake" and cuts the day's driving from 2 h 30 to 1 h 50. The list also offers Peyto Lake, the Icefields and Mount Robson, which are not near Jasper. (`rk-add-el-el-p0.png`, `rk-d5-add-open.png`) Fix: when no ORS, plan or matrix figure exists, compute the leg with the straight-line ladder (spec 2.5) from coordinates; never use a fixed default. Limit candidates to 30 km of the day's points and show each one's distance.
3. **Summary trips get a made-up timetable.** Patagonia Day 2 "Fly to Ushuaia" has no flight. The harbour walk in Ushuaia comes before the arrival, the drives are 10 minutes each, and the day ends with a 5 h 40 rest. (`pat-d2-el-p0.png`) Fix: follow design section 9. Summary days show Morning, Afternoon and Evening in the time column and no legs, until the data carries the move.
4. **Times are not rounded.** Examples: "~15:57", "~13:37", "1 h 53", "1 h 12", and screen-reader text "13:14". (`rk-d5-1440-light-el1x.png`) Fix: round to 5 minutes in the close step (spec 2.9 step 9) for every suggested time and generated duration.
5. **Adults Day 5 is out of order and mislabelled.** "Packed lunch on the trail" comes after "Drive 1 h back to Jasper", and the day is still titled "Spirit Island cruise and Mary Schaffer Loop". (`rk-adults-1440-el1x.png`) Fix: draw the on-trail lunch inside the trail entry (`insideOf`), before the next leg. Take the day title and summary from the chosen variant; the strip uses the same title.
6. **The split lanes are not explained.** With `split=1`, two entries float in an unlabelled right column. There is no "One adult: Bald Hills" heading and no "Together again" band across both lanes, and the split row has no "Show both lanes" button, so the only way in is More, then the switch. (`rk-split-1440-el1x.png`) Fix: build design 4.7 as written. The phone toggle ("Together | The longer walk", `rk-split-390-el-p0.png`) is good; keep it.
7. **Research language leaks into public text.** Examples: "no family trail id or distance for Sunshine Meadows in the dataset" and "audience 'both' in the dataset", 5 hits in the Rockies HTML. (`rk-1440-light-tile3200-1.png`) Fix: add `dataset|trail id|audience '` to the prose sweep and its test, and rewrite those notes as "Distance not known yet".
8. **Dolomites at age 4 shows impossible times and odd wording.** Cadini sits at 16:30 while the 8 h 06 loop runs to 19:36. The banner says "Not suited to every setting", and the copy says "the limit here is age 4" when 4 is the child's age, not a limit. One reason repeats itself: "The Drava cycle path: The Drava cycle path includes…". (`dolo-d3-el-p0.png`, `dolo-d4-el-p0.png`) Fix: use spec 3.5's wording, "Not suited to a 4 year old" plus the numbers. Change the age phrase to "your youngest is 4". When a pin is missed, show one conflict line and drop the dependent pin from the timeline, rather than drawing overlapping times.

## Fix in stage 4

- **Linked motion (P5).** On a Who or Pace change, cross-fade each day card: out 120 ms, in 200 ms, 20 ms stagger up to 5 cards, and animate the bar widths in the strip (design 7). Right now the cards swap instantly. Day jumps are good: a native smooth scroll over about 600 ms, and the `#day-N` hash is written. Know before you go opens with a 200 ms animation, which is good.
- **The trip strip** (`rk-1440-light-tile0-1.png`, phone `rk-390-light-tile900-0.png`). Drive text is truncated ("2 h 30 dri…"): show "2 h 30" after a car glyph. Hide the variant column when all rows have the same value. Add 06, 12 and 18 tick labels to the span scale. Keep the drive figure on phone.
- **Variant menu.** Add the consequence line and a fit note for each option (design 4.6). (`rk-d5-variant-menu.png`)
- **Phone day header.** It runs about 520 px before the first time (`rk-390-sticky.png`). Fold the sun line into the meta row, put the chip inline, and clamp the summary to 2 lines.
- **Selector position.** At 1440 x 900, "Plan it for" starts at about y 1260, below the season band and below the fold. Move it above the band (design 3, owner question 3).
- **Polish.**
  - An empty grey thumb appears when there is no photo; show the kind glyph instead.
  - "Bear spray and groceries" uses the bed glyph.
  - Put a space in "≈Drive".
  - The screen-reader label reads "to Back to Jasper".
  - "4h15" should be formatted.
  - The segmented controls leave an empty band to their right (`rk-390-edit-open.png`).
  - "Longest walk" shows km under miles.
- **Route map.** At rest it opens zoomed on a single dot near Maligne Lake (`rk-map-wait-el.png`). `TripRouteMap` is unchanged in this lane, so check it against v2 before blaming L3c. Either way, fit to all days at rest.

## Deviation rulings

| Deviation | Ruling | Why |
|---|---|---|
| `~` on suggested times | **Keep** | It matches spec 1.3, survives print, screen readers and grayscale, and in practice it is quiet beside the bold fixed times and the "about" on sun times. Record it as the answer to the owner's question 2 unless he overrules. |
| Phone profile bar collapses to a line plus Edit | **Keep** | The line says what the plan is for, Edit is one tap and opens inline (not modal), and it saves about 700 px before the strip. |
| Per-day overrides kept on a Who or Pace change | **Keep** | Spec 3.6 says an override wins. The summary line counts the change and Reset is visible (`?pace=relaxed&d=5C` kept Day 5 Easy). Drop the design's toast. |
| Anchored times at the middle of the sun window | **Keep** | "about 19:35" plus the range on the sun row and in the expanded entry is honest. Dated copies recompute it. |
| Lighter sticky bar; map above the days | **Change, stage 4** | The bar must name the profile ("Family, 6 · Standard · Edit"), not "Plan as written". The map should become a sticky column at 1024 px and up and a "Map · Day N" pill on phone, because P5 says the map follows the timeline. Not a merge blocker. |
| `adult_only` trails labelled "planned for age 13 and up" | **Change wording, keep the 13** | 13 is our rule, not the plan's limit or an operator's. Write it as "An adults' hike in this plan; we offer it from age 13", and never use "the limit here is". |
| Default line "Showing the plan as written … Written for families with a child from about 6", with the stepper at 6 | **Keep** | It says who the plan suits, not who travelled, and the stepper matches the line. Drop the redundant "Whole family on 15 days" when every day uses the same version. |
