# PLC: place pages, map adapter and page seeds (stage 4)

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 16 h, in four parts:
  - place page items, 7 h
  - seeds and duplicates, 4 h
  - maps, 3 h
  - tests and shots, 2 h
- **Rows:**
  - 4.9 and 4.12 (S1b review stage-4 items)
  - 3.31 (trail map line style)
  - 3.49 (the checks count)
  - 3.55 (code part)
  - 3.57 (place-page wording)
  - 3.58 (seed rules)
  - 2.41 (gallery credits)
  - 4.2 (label overlap on place maps, the mobile trail hero, dark map water lighter than land)
  - 4.6 (one item: dense admin labels on the dark map, conflict C6)
- **Plan:** [STAGE4-plan.md](../STAGE4-plan.md).
- **Review:** [design/place-page-sections/review-S1b.md](../../../design/place-page-sections/review-S1b.md) is the spec for each fix.
- **Principles:** P2, P3, P4, P6, P8, T3, T4, T5.
- **Starts:** when D2 has merged.
- **Merges:** second, after SHL. TRP and LST rebase onto your final page set.
- **Opus review:** none before (the S1b review already rules on each item); `travel-design-reviewer` after.

## Goal

Place, trail and lift pages read as true and complete at a glance, and the map adapter draws only honest lines and readable labels. The page set is final: no lodging pages, no duplicate pairs, and no empty shells presented as places.

## Read first

- review-S1b.md: the stage-4 table S1-S13, "Known data gaps", and the research levels section.
- BACKLOG rows 4.9, 4.12, 3.31, 3.49, 3.55, 3.57 and 3.58, word for word.
- `web/lib/public/seeds.ts`, `places.ts`, `sections.ts`, `suitability.ts`, `relevance.ts`, `completeness.ts`, `photos.ts`.
- `web/components/places/PlacePage.tsx`, `sections/*`, `TrailMap.tsx`, `PlaceMap.tsx`.
- `web/components/suit/*`.
- `web/lib/map/**`, `web/components/map/**`.
- `web/redirects.json` and `tools/publish.py` `write_redirects`.
- [README.md](../README.md) 2.5 (photos and credits), 2.6 (completeness), 4.2 and 8.

## Files you own

| Area | Paths |
|---|---|
| Place UI | `web/components/places/**` except `rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx` and `cluster.ts`; `web/components/suit/**`; `web/app/places/[slug]/**`; `web/styles/suitability.css` and the place-page styles |
| Adapter, places part | `web/lib/public/places.ts`, `sections.ts`, `suitability.ts`, `relevance.ts`, `contract.ts`, `completeness.ts`, `seeds.ts`, `trail-places.ts`, `photos.ts`, `honesty-overrides.ts`, `slugs.ts`, `tracks.ts`; an additive block `// PLC (stage 4)` in `types.ts` |
| Maps | `web/lib/map/**`, `web/components/map/**` |
| Redirects | `web/redirects.json` (your duplicate-slug rules only) |
| Tests | `web/tests/places/**`; `web/tests/data/sections*`, `suitability*`, `relevance*`, `place-*`, `seeds*`; `web/tests/e2e/place*.spec.ts`, `places-trail.spec.ts`, `places-google.spec.ts` |

## Do not touch

- **LST:** `lib/client/data.ts`, `lib/public/index.ts`, `pages.ts`, `components/entity/**`, `components/places/rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx`, `cluster.ts`.
- **TRP:** `lib/public/trips.ts`, `timeline.ts`, `components/trips/**`. Timeline entry chips belong to TRP; if a chip needs a new field, add it to the adapter and say so in the hand-back.
- **GLB:** `lib/public/globe.ts`, `components/globe/**`.
- **SHL:** `components/ui/**`. Request a change there; if `Gallery.tsx` or `Credits.tsx` must change for 2.41, SHL makes the change.
- `data/**` is read only. CS7d writes the data (`same_place_as`, the horseback record).

## Steps

### Part 1. The place page (4.9, 4.12, 3.49, 3.57)

For each item, first check whether S1b rounds 3-4 or S1c already fixed it. Report the ones already done; do not redo them.

1. **The checks count (4.9 S1, 3.49).**
   - Write "13 of 13 key checks · 9 more not checked yet": count what the visitor sees.
   - A row mapped by step 9 counts as done.
2. **Chips (S2, S8, S9, S11).**
   - Keep the text of a chip on one line, and wrap whole chips.
   - No trailing comma in the dashed summary chip.
   - The rule chip reads "Under 18 with an adult".
   - On a card, the lock replaces the person glyph.
   - A lone dashed chip names what is missing ("Kids: not checked yet").
   - The kind glyph and the effort glyph differ.
3. **"When you can go" (S3):** use the short renderers ("Shuttle 1 Jun – 12 Oct"), with no raw keys, no cut words and no repeated hazard.
4. **One home for each value.**
   - S4: one adult time per trail; show the conflict line if the sources disagree.
   - S5: no duplicate glance slots, and "Starts at" agrees with the Directions note.
5. **Units (S6):** section values follow the mi and ft toggle, like the table and the timeline.
6. **Links (S7):** one marker per gap ("Official · not checked yet"), and no raw keys in the closing lines.
7. **Section 3 chip row and titles (S10, S13).**
   - Section 3 shows the stroller and wheelchair chips at rest.
   - The inner group is titled "For a family".
8. **Phone section index (S12):** a one-line index after the glance, using in-page anchors with a sticky offset, and smooth scroll that is instant under reduced motion. The S1b review asked for it but did not draw it; keep it to one line of text links, not a menu.
9. **Pointers.**
   - Drop a "Coming from far?" pointer whose target has no page.
   - Cap "Nearby" at about 25 km.
10. **No operator (3.57).** Where no operator exists (a free waterfall), use "Not checked yet" wording, never "Not stated by the operator".
11. **Bracketed hero note (3.57).** Clean the Banff Gondola hero note "(… top station)" at its source string.
12. **Auronzo links (3.57).** Confirm that the three "Strada per il Rifugio Auronzo" links to the Tre Cime loop are intended, and report what you found.
13. **Gallery credits (2.41).** Credits show the author and the licence only, never the raw Commons description. Fix it in `photos.ts` so trip galleries get the fix too.

### Part 2. Seeds and duplicates (3.58, 3.55)

14. **Exclude lodging from the seeds.** Use the `types.json` lodging subtree, not a name list. Prince of Wales Hotel loses its page; a stay is household-adjacent.
15. **A sight override list for base towns.** Add `web/lib/public/seeds.ts` `SIGHT_OVERRIDES` (Reykjavik old harbour, San Telmo market), each with a reason.
16. **No empty shells.**
    - A seeded page with nothing but its name and kind (the Banff horseback page) is not built.
    - It is listed in a build log line, and as a CS7d target in the hand-back.
    - Its slug is not in the sitemap.
17. **Duplicates (3.55).** When a capture record carries `same_place_as`:
    - build one page;
    - write a 301 in `web/redirects.json` from the second slug to the first;
    - make search and list rows point to the first.

    Test this with a fixture. The real marks arrive with CS7d batch A.

### Part 3. Maps (3.31, 4.2, C6)

18. **The unconfirmed trail line gets its own style** in `components/map` (dashed, `--muted`, at least 3:1 against both map lands); `straight-estimate` stays for legs. The legend must not cover the trailhead pin: fit with padding for the legend.
19. **Dark map water.** On the dark trips and place maps the water reads lighter than the land. Read the tokens (`--map-water`, `--map-land`), and fix it in `lib/map/palette.ts`, not per map.
20. **Label overlap on place maps:** collision padding for our pins, and no basemap POI labels under our pins.
21. **Dense admin labels (4.6, C6).** `hideBasemapLabels` also drops state and province labels below zoom 5 in both styles.
22. **Mobile trail hero.** Look at it at 390, light and dark, and fix what breaks: crop, title over the image, and the elevation strip.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | Larch Valley: the count matches the visible gaps; no chip breaks mid-value at 390; "When you can go" has no raw key | S1-S3 |
| 2 | Each trail shows one adult time, or a conflict line with both sources | S4, T3 |
| 3 | With miles chosen, the place sections, the table and the timeline agree | S6 |
| 4 | Godafoss reads "Not checked yet" for walk, stroller and wheelchair | 3.57 |
| 5 | No lodging page in `web/out/places/`; the sitemap has no shell slug; the build log lists the skipped shells | 3.58, P8 |
| 6 | The duplicate fixture builds one page and one 301; search finds one entry | 3.55 |
| 7 | No gallery credit contains a Commons description sentence (test over `web/out`) | 2.41 |
| 8 | The Tre Cime trail map shows the trailhead pin uncovered at 1440 and 390; the unconfirmed line is 3:1 or better in light and dark | 3.31, T5 |
| 9 | Dark trips and place maps: water darker than land, measured | 4.2 |
| 10 | No green pixels on any map style (the hue scan from the L2b review), except the documented `--ok` chip | standing rule |
| 11 | axe clean on Lake Louise, Larch Valley, Moraine Lake, Tre Cime and Capri at 1440 and 390, light and dark; the section index works by keyboard | WCAG AA |
| 12 | Place page JS and HTML stay inside the budgets INT-C set (start JS under 150 KB) | README 6 |
| 13 | `git diff --name-only` shows only owned paths; the `types.ts` block is additive | 2.1 |

## Verification

```
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
python3 tools/theme_tokens.py --check
```

Screenshots at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/PLC/`, read in 1600 px tiles:
- Larch Valley, Lake Louise, Moraine Lake, Ötzi, Godafoss, Capri (older layout), Banff Gondola, the Tre Cime and Fanes trails;
- the dark trips map at the Europe view.

Then `travel-design-reviewer` (Opus) reviews against review-S1b.md, and `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-PLC`, branch `public/PLC`, dev port 3452.
- **Commits:**
  1. `web(public/PLC): place page counts, chips, units, links, section index (4.9, 4.12)`
  2. `web(public/PLC): seeds drop lodging and shells, duplicates collapse with a redirect (3.58, 3.55)`
  3. `web(public/PLC): map adapter: unconfirmed line, dark water, labels (3.31, 4.2)`
  4. `web(public/PLC): gallery credits, no-operator wording, hero note (2.41, 3.57)`
- Stage owned paths with `git -C <worktree> add <paths>`, never `-A`. Co-Authored-By trailer from your harness.
- Rebase onto the latest v2 branch (after CS7d batch A has merged) before the final shots. Do not push.

## Hand-back

- the commits and the test counts;
- the items that were already fixed before this lane;
- the empty shells skipped, as a CS7d list;
- the Auronzo finding;
- any `components/ui` request sent to SHL;
- any field added for TRP's timeline chips.
