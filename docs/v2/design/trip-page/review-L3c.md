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

## Round 2 (19 Oct 2026)

Re-review of `public/L3c` at e1babd4, built with `pnpm build` (exit 0, no `.env.local`), served from `web/out`, Chromium 1248 on the Arc GPU (ANGLE/GL), 1440 and 390, light and dark through the site's own theme toggle, 2x. Screens are in `/tmp/l3c-review/r2/` (element shots per scene, `texts.json` holds the rendered text of every Rockies day).

**Verdict: not yet. Seven of the eight must-fixes are fixed and the eighth is mostly fixed, but the add-to-day flow and one Rockies day still show times a family would not believe.** Three blockers are left, all in the scheduler and all small.

### Status of the round-1 must-fixes

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Day cap on 14 of 15 days | **Fixed, one wrong day left** | Warns on Days 4, 7 and 13. Day 7 is a false warning, see R2-2 |
| 2 | Invented 10-minute legs; far candidates | **Fixed for the leg in, not the leg out** | Bow Lake is no longer offered to Jasper ("Nothing else is offered for this day that matches 'Bow'"); the one nearby place shows "16.7 mi away". Leg in is ladder-computed. Leg out is wrong, see R2-3 |
| 3 | Patagonia Day 2 timetable | **Fixed** | Morning: Flight to Ushuaia 3 h; Afternoon: Harbour walk. No legs, no clock times (`pat-d2-*.png`) |
| 4 | Unrounded times | **Mostly fixed** | Rockies suggested times and durations are on 5 minutes. Left: routed sums and legs on Dolomites Day 3, "1 h 37 driving", "Drive 48 min", "39 min", "10 h 42 of active time" |
| 5 | Adults Day 5 order and title | **Fixed** | Titled "Bald Hills"; packed lunch at ~13:05 sits before "Drive 1 h back to Jasper" (`rk-adults-d5-*.png`) |
| 6 | Split lanes unexplained | **Fixed** | Lane heads "Whole family" and "The stronger walkers: Bald Hills", a full-width "Together again at the Maligne Lake boathouse car park" band at 14:00, "Show both lanes" on the split row, "Show one lane" to go back; the phone toggle is kept (`rk-split-d5-*.png`) |
| 7 | Research wording | **Fixed** | No `dataset`, `trail id` or `audience '` on Rockies, Dolomites or Patagonia. One new awkward note, see I-2 |
| 8 | Dolomites age 4 | **Fixed** | "Not suited to age 4. Tre Cime di Lavaredo loop is 6.2 mi; we plan walks up to 2.5 mi at age 4." Cadini no longer overlaps: one line, "moves from 16:30 to about 19:45: what comes before it takes longer." "the limit here" and the doubled reason are gone. I accept the moved pin with its conflict line in place of dropping it, because the line says why |

Round-1 rulings: "we offer it from age 13" no longer appears as "limit"; "Whole family on 15 days" is gone at the default ("Showing the plan as written. Written for families with a child from about 6.").

### Remaining must-fixes (merge blockers)

- **R2-1. Wrong "moved" notes after an addition (critical, T3).** On Rockies Day 5, add Athabasca Falls Walk, A rest, Coffee and a snack, Lunch (`?add=5.athabasca-falls-walk,5.rest-stop,5.coffee-break,5.lunch-stop#day-5`). "Dinner in Jasper" still at 17:45 says "moved 375 min later". "Rest at the base" says "moved 25 min later" although it went from 15:50 to 17:05. The note must be the difference between the entry's old and new start, in the house duration format ("moved 1 h 15 later"), and absent when the start did not change. Add a unit test that compares the note to the two starts.
- **R2-2. Rockies Day 7 is a false day-cap warning, and it schedules dark-sky watching in daylight (critical, T1/T3).** "Day 7 is 10 h 15 away from base" counts "Laundry, groceries and rest in Jasper, 2 h" (08:00 to 10:00, at the base) and "Dark-sky watching, 1 h 30" at 16:35, more than three hours before a sunset of about 20:11. Time away from base is about 8 h 15 with the optional and 6 h 45 without it. Fix: leave out any block at the base of 45 minutes or more, not only blocks of kind rest. Anchor a dark-sky stop after astronomical dusk from `core/src/sun`; if that falls past the day's end, show it as "after dark, if clear" without a clock time, and keep it out of the cap.
- **R2-3. The leg out of an added place copies the leg in (important, but blocking because it feeds the slot conflict).** After adding Athabasca Falls Walk, both legs read "≈Drive 55 min · 24.9 mi", Jasper to Athabasca and Athabasca to Spirit Island cruise. On the map those are different: the second goes back through Jasper, about 80 km by road. The page then reports "Drive to Spirit Island cruise runs 20 min into Check in" from the copied figure. The conflict line itself is honest and good. Fix: compute each leg from its own two endpoints (spec 2.5 ladder), and add a test with an added place between two points that are not on one line.

Fix in the same pass (important, small): round routed sums and legs to 5 minutes when they are shown as totals ("1 h 35 driving", "about 10 h 40 of active time"); a single routed leg may stay exact only if the spec says so, otherwise round it too.

### Rulings on the builder's caveats

| Caveat | Ruling | Why |
|---|---|---|
| (a) Cap warns on Days 4, 7, 13, not 5 and 8 | **Day 4 right, Day 13 right, Day 7 wrong; change the golden to Days 4 and 13** | Day 4 is the Jasper move day over the Icefields Parkway, 07:30 to 19:00, 10 h 15 away: genuinely long. Day 13 runs to 21:55 only because optional Rawson Lake (4.8 mi, 5 h 35) starts at 14:25, and the warning names it ("Optional: Rawson Lake"), which is the right advice. Day 5 is about 9 h 40 away (07:30 to 15:50, then 19:00 to 20:30) and Day 8 about 7 h 45 (08:00 to the 15:45 check-in), so neither should warn; my round-1 target of 5 and 8 was wrong. Day 7 is R2-2. Update spec 1.4's golden to 4 and 13 when R2-2 lands |
| (b) Scheduler size limit 12 to 13 kB | **Accept, once** | 1 kB for lanes, the sun anchor and the ladder is reasonable on a public page (P9). Record the new limit and the reason in the spec; the next raise needs a trim first |
| (c) Stepper shows "age 6" at the default | **Keep** | It matches "Written for families with a child from about 6", the same ruling as round 1 |
| (d) Added coffee, lunch or rest near its own time of day | **Accept** | Coffee landed at 08:45, lunch at 11:35 (replacing the picnic lunch, no double lunch), a rest at 15:20. That is what a family expects. The notes around it are R2-1 |

### New findings (not blockers)

- **I-1. Showing both lanes changes the day (important, P4).** Rockies Day 5 at rest has no warning, Moose Lake at ~13:45 and "Rest at the base 1 h 55". With `split=1` the same day warns "10 h 15 away", Moose Lake moves to ~14:10 and the rest drops to 1 h 30, because the family lane now waits for the 14:00 rejoin. A view switch should not change the plan. Schedule the rejoin wait in both views, so the times and the warning match whichever lane view is shown.
- **I-2. "rated Poor in 2026 (not known yet)" (important, wording).** The Adults Day 5 note contradicts itself. Say what is known: either "Trail condition: poor in 2026" or "Trail condition not known yet".
- **I-3. Rockies Day 13 runs to 21:55 with dinner at 20:40 at the default (important, T4).** The cause is the optional Rawson Lake. When an optional pushes dinner past 19:30 for a family, place it after the evening meal rather than before, or show it as a stretch goal without moving dinner.
- **I-4. Interlakes "2.5 mi, 4 h" on flat ground (polish).** That is about 0.6 mph. Check the family pace for flat trails.
- Stage-4 items from round 1 are unchanged as expected: truncated "2 h 30 dri…" in the strip, the variant column still shows "Whole family" on every row.

Contrast: dark-mode warning text on the warning panel and `--muted` on `--surface` render as in round 1 (`dolo-f4-d3-390-dark.png`, `rk-strip-1440-dark.png`); no new colour pairs.
