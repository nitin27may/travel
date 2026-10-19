# SQ1b design review: smart search wiring

Reviewer: travel-design-reviewer (Opus), 19 Oct 2026, branch `public/SQ1b` at `71907d2`.
Method: `pnpm build`, `web/out` served locally, GPU Chromium (ANGLE/GL) at 2x, 1440 and 390, light and dark through the site's theme toggle. All 8 mock queries plus 12 of my own were run in the header search and in the Places/Trips box. Shots and logs are in `/tmp/sq1b-review/` (`log.json`, `run.mjs`, `run2.mjs`).

**Verdict: merge after 4 must-fixes.** The parse is honest and the chips explain themselves. The must-fixes are where the search contradicts itself, shows raw codes, or makes the phone bar taller.

## Rulings on the builder's differences from the mock

| Difference | Ruling |
|---|---|
| No count in the header "Show places" except on `/places/` and `/trips/` | **Accept.** A count on `/` would need list data, which P9 forbids. "Show places" without a number is honest. Stage 4: the relax line can't fire without a count, so a 0-result reading on `/` gives no warning before Enter (see S1). |
| After Enter the list box holds only the unused words | **Accept.** It stops the text from filtering twice, and the undo line quotes the full query. |
| The undo line sits under the filter row | **Accept on desktop. Change on phone** (M3). |
| The name-wins annotation is left out | **Accept.** It was mock commentary. P4 says no help text, and "Niagara Falls" shows the name hit with no chips (`h-1440-light-o1.png`). |
| "Not checked yet" shows 5 rows per constraint, not 3 | **Accept.** It is collapsed by default and ends with "and N more" (`p-1440-light-m2-unchecked.png`). |

## Must-fix before merge

**M1. While a reading is shown, the list behind it says "No places match".** (critical; P4, H3) Type "easy hike with kids near Banff in September" into the Places box. The chips appear, but the list is still filtered by the raw sentence as `q`. The count reads "0 of 209", the empty state says "No single change brings places back", and "Clear all" appears (`p-1440-dark-banff-typing.png`, `phone-smart-banff-typing.png`). A first-time visitor reads that as "nothing here" and leaves. **Fix:** while the preview has at least one chip, don't filter the list by the draft text. Keep the list as it was, and show the reading's count in the hint ("Enter shows 11 places", from `countParsed`). Hold back the empty state and "Clear all" until Enter or Esc.

**M2. Parsed values reach the filter bar as raw codes.** (critical; P4, spec 6.1 "a chip and a pill never disagree") "hot springs in utah in winter" applies, and then the active chips read `Kind: water.thermal.hot_spring`, `Season: 12`, `Season: 1`, `Season: 2` (`p-1440-light-empty-applied.png`). The same happens from a direct URL: the bar labels values from row counts, not the facet's label table. The parser now makes these values common. **Fix:** label pill values from the descriptor's static option labels (month names, the `types.json` label) whatever the counts are. Add a test that every value the vocab can write has a non-code label.

**M3. On a phone, the undo row makes the sticky bar taller.** (critical; T2, P3) This is measured on `.filter-sticky` at 390 x 844, after scrolling:

| State | Bar bottom | Share of viewport |
|---|---|---|
| No filters | 171 px | 20% |
| 3 filters set by hand | 350 px | 34% |
| Banff, set by hand | 313 px | 37% |
| Banff, set by search (undo row) | 396 px | 47% |
| "moderate hike with 500 m climb", by search | 415 px | 49% |
| Banff preview while typing | 480 px | 57% |

The undo line wraps to three lines, about 83 px (`phone-smart-climb.png`). **Fix:** under 640 px, take the undo row out of the sticky region and render it just above the results, so it scrolls away. Shorten it to one line: "Read as 3 filters · Undo", with the full query in the button's accessible name. Pre-existing and stage 4: collapse the whole sticky bar on scroll to one summary line ("11 places · 3 filters · Edit") and expand it on tap.

**M4. "with kids" on Trips falls into a dead text search when no age is picked.** (important; Q40, H3) Type "trip with kids" in the Trips box, then press Enter. The reading has only the age question and so 0 filters, so Enter writes `q=trip with kids` and shows "0 of 14 trips" (`t-1440-light-kids-applied.png`). The age is never asked. Picking the age in the preview first works (`?kid=6&season=10&length=weekend`), and so does a query with other filters ("Needs an answer" row, `t-1440-light-ask-applied.png`). **Fix:** when the only chip is a question, Enter opens the age choices and focuses the first age. It must not fall back to a text search.

## Stage-4 fixes

- **S1** Relaxing a reading drops the type: "waterfall I can reach with a stroller" offers "Without Waterfalls and rapids: 9 places" (`p-1440-light-m2-unchecked.png`). The visitor asked for waterfalls. Never offer to drop the `k` chip while another chip can go; offer "Without Any stroller: 9 waterfalls" first.
- **S2** Back after an Esc undo restores the filters but not the undo line. Keep the `applied` record in `history.state` so Back brings the line back too.
- **S3** A typo on the list box ("waterfal in iceland") applies Iceland and leaves `q=waterfal`, giving 0 rows. The header offers "Did you mean waterfall"; the list empty state should offer the same.
- **S4** The Kids chip says "With kids" but its pill says "Kids: Easy with kids"; "Easy or a stroll" becomes two pills. Use one label source.
- **S5** The header search is a modal Dialog with a scrim. That was there before this lane, but it goes against the owner's rule that overlays are non-modal. Put it on the foundation list. The chip popover itself is inline and non-modal, and Esc returns focus to the chip (checked).
- **S6** "Niagara Falls" in the Places box gives 0 rows, because it is an area. The list empty state should link the name hit.

## Fine

- Contrast. Light: chip text 16.1:1, chip border 3.4:1, "Read as" label 6.4:1, "not used" word 11.2:1, "not used yet" word 5.9:1 on info-soft, remove x 6.9:1. Dark: 13.8, 3.8, 8.2, 11.9, 7.6 and 7.5:1. All pass AA, and borders pass 3:1. No green anywhere: the ask chip is amber and "not used yet" is slate blue.
- Motion: chips fade and rise, removal collapses the width, and the row and "Not checked yet" fold through `grid-template-rows`. Reduced motion turns them off. No layout jump in the listbox.
- Chip removal (mouse and Backspace) sticks while typing; Esc undo, URL round trips, Back and Forward work. No third-party requests.
- P8: `vocab.json` holds type words, facet words, months and the 273 ISO country names. A grep for Banff, Zion, Havasu, Chamonix and Algonquin found 0 hits. Labels only.

## Size: +1.41 KB on `/`, +1.25 KB on lists, against a 1 KB budget

**Rule: accept it as a one-time waiver of 0.5 KB, and record it in spec section 8. The 1 KB limit stays for later lanes.** `GlobalSearch`, `SmartRow` and `UncheckedRows` are already `dynamic()`; the rest is eager glue in `FilterBar`, `EntityPage` and `EmptyState`, not worth squeezing. If M1 to M4 add more eager code, move it into the `SmartRow` chunk.

## Scores

| Principle | Score | Note |
|---|---|---|
| P1 scale | Pass | parts load by prefix; "Not checked yet" collapses with counts |
| P2 progressive | Pass | unchecked group collapsed |
| P3 glance | Partial | M1, M3 |
| P4 no manual | Partial | M1, M2, M4; chips themselves are self-explaining |
| P5 smooth | Pass | S2, S5 |
| P6 metadata | Pass | bands are named ("400 to 800 m (band for 500 m)") |
| P7 90% | Pass | Enter goes to the list |
| P8 catalogue | Pass | vocab is labels only |
| P9 boundary | Pass | counts through `data.ts`; no count on `/` by design |
| T1 when | Pass | months and hemisphere seasons are named ("Winter, Dec to Feb") |
| T2 field | Fail until M3 | |
| T3 trust age | n/a | |
| T4 families | Pass after M4 | "Not checked yet" never counts a gap as a yes |
| T5 maps | n/a | |
