# S1: "Who it suits", place pages from the capture contract, relevance on pages

Wave 3, stage 3. It is the last build lane of the stage. Part 0 (design) and Part A (pure adapter modules in new files) start now, in parallel with L3c, L4b, L3b, L2b and CS7. Part B (wiring and UI) starts only after **L3c, L4b and L3b have merged** and this lane has rebased onto them.
- **Agents:** `travel-design-reviewer` (Opus, never Fable) for Part 0; `travel-builder` (Sonnet) for Parts A and B.
- **Effort:** about 30 hours:
  - Part 0, design of the sections not yet designed, 4 h
  - Part A, adapter modules and the party scrub, 8 h
  - Part B, place page sections, cards, trip entries, 16 h
  - tests and shots, 2 h
- **Backlog:** 3a.5 (S1), capture-contract step 5 (3a.12), the place-page half of RV1 (3a.6 step d: badge, "Similar nearby", the pointer, Plan B), 2.43 (the party scrub), and [CC-adapter-requests.md](CC-adapter-requests.md) items 1 to 10.
- **Specs:**
  - [design/suitability-display.md](../../design/suitability-display.md): the layout, chip vocabulary, wording, colour and acceptance checks for "Who it suits", cards and day rows. Its mock is `design/suitability-display/mock/`.
  - [research/capture-contract.md](../../../../research/method/capture-contract.md) section 6 (the 14 sections, renderers by value type, the glance from the contract, other surfaces) and 2.5, 2.7 (relations, layers, which facts live where).
  - [research/suitability.md](../../../../research/method/suitability.md) 3, 4, 6.4, 6.5 and [suitability-applicability.md](../../../../research/method/suitability-applicability.md) 5.1, 5.2 (slots per profile, the detail order, gaps, N never drawn).
  - [research/relevance.md](../../../../research/method/relevance.md) 3.2, 3.6, 3.7, 6.2, 7.
  - Principles P2 (with its safety exception), P3, P4, P6, P8, P9 and T1, T3, T4.
- **Owner rule in force:** empty sections stay visible as markers of missing data. A section with an R or A property for the type and no value shows its gap markers; only a section whose properties are all N for the type is not drawn (contract 6.1, display D8 and D9).

## Goal

1. **Place, route and offer pages render from the contract**, never from per-type code: the 14 fixed sections of contract 6.1 in order, each property drawn by its value type, the glance strip from the type's `display` order, the Rest! warning line at rest. A new type needs no code.
2. **"Who it suits"** exactly as suitability-display sections 1 to 4: three chips at rest (rule, advice or gap look), one warning line, the research line "n of m family checks done · read <date>", the six groups, provenance one click away, "Not checked yet" for a missing R field, one closing line for missing A fields.
3. **Cards** carry two suitability chips (kids, effort) and at most one relevance chip; **trip timeline entries** carry three suitability chips that may wrap on phone, and the badge on anchors.
4. **Relevance on pages:** the hero badge with its `why` line and provenance; "Similar nearby" (instead of); "Nearby, worth adding" (as well as, hand-picked pairs first, a pair with no point shown without a distance); the far-visitor pointer; Plan B.
5. **The capture model read correctly** (CC-adapter-requests): routes take their draw from the place they reach, lifts read their ticket offer, offers show under "At this place you can also", `part/...#...` records fold into the parent page, "How to get there" lists the `reached_by` routes.
6. **The party scrub (2.43) stops over-matching**, keeps the source's own numbers, fixes sentence case, and logs every sentence it drops at build.

The Places filters (Kids, Effort, Stroller) moved to L3b, which owns every list facet. The vacation-lens ordering and grouping of the lists (relevance 6.1) are not in this lane: they wait for Q18 and get their own brief.

## Read first

- suitability-display.md, all of it, and its mock at 1440 and 390 in light and dark.
- Contract sections 2.5, 2.7, 6 and 7.3; CC-adapter-requests.md.
- `data/schema/capture/contract.json` (`sections`, `properties`, `bands`) and the domain files (`nature.json` and others; `inherits` means identical to the parent). Generated: read only.
- `core/src/capture/records.ts` (`loadWorld`, `incomingOf`, `primaryRef`), `core/src/capture/engine.ts` (`completeness`, `readProperty`), `core/src/suitability/project.ts`, `level.ts`, `gates.ts`, `core/src/relevance/derive.ts`, `data/relevance/derived/*.json`.
- `web/lib/public/places.ts`, `completeness.ts`, `party.ts`, `origin.ts`, `dateless.ts` (`DropLog`), `index.ts`, `types.ts`.
- `web/components/places/PlacePage.tsx`, `model.ts` (`glanceFor`, label-matched today), `web/components/entity/PlaceSections.tsx`, `web/lib/entities/descriptors/place.tsx` (`placeBadges`).
- After the merges: L4b's `TrailMap`, `TrailProfile` and `TrailExport`; L3c's `web/components/trips/timeline/Entry.tsx`, `DayTimeline.tsx`, `TripTimeline.tsx` and `web/lib/public/timeline.ts`; L3b's `web/lib/public/world.ts` and `bands.ts`.
- [README.md](README.md) 4.2 and 8; the [L3c brief](L3c-trip-timeline.md) "Files you own".

## Files you own

| Part | Area | Paths |
|---|---|---|
| 0 | Design | `docs/v2/design/place-page-sections.md` (new) and `docs/v2/design/place-page-sections/mock/**` (new), by the design reviewer |
| A | Adapter modules (new files) | `web/lib/public/contract.ts`, `sections.ts`, `suitability.ts`, `relevance.ts` |
| A | Party scrub | `web/lib/public/party.ts`, the call into it in `web/lib/public/origin.ts` (a log argument only) |
| A | Chip and section components (new) | `web/components/suit/**` (`SuitChips`, `WhoItSuits`, `GroupRow`, `ProvenanceRow`, value-type renderers), `web/styles/suitability.css` |
| A | Tests | `web/tests/data/contract*.test.ts`, `sections*.test.ts`, `suitability*.test.ts`, `relevance*.test.ts`, `web/tests/suit/**`, the party blocks of `web/tests/scrub.test.ts` and `web/tests/privacy.test.ts` |
| B | Adapter wiring | the place join in `web/lib/public/places.ts` and `index.ts`; additive fields in `types.ts` (`PublicPlace.sections`, `suitability`, `relevance`; `PublicPlaceCard.badge`; `DayItem.suit`); `web/lib/public/completeness.ts` (the contract engine behind the same `Completeness` shape) |
| B | Place pages | `web/components/places/PlacePage.tsx`, `model.ts` (glance from the contract), `web/components/places/sections/**` (new), `web/components/entity/PlaceSections.tsx`, `web/styles/places.css` |
| B | Cards | `placeBadges` and the card chips in `web/lib/entities/descriptors/place.tsx` (not the `facets` block), the `badge` key in `web/components/places/rows.ts`, `PLACE_LIST_KEYS` and `web/tests/data/allowlist.ts` |
| B | Trip entries | `web/components/trips/timeline/Entry.tsx` (the chip row and the expanded LIMITS group), `TripTimeline.tsx` (anchors marked), and the item join in `web/lib/public/timeline.ts` that attaches `DayItem.suit` |
| B | Tests | `web/tests/places/place-page.test.tsx` (section blocks), `web/tests/e2e/place-sections*.spec.ts`, `web/tests/e2e/who-it-suits*.spec.ts`, the S1 shots |

Part A touches no file another lane owns. Part B edits files that L3c, L4b and L3b own **only after they have merged**: by then they are integration files, and you rebase before every Part B commit.

## Do not touch

- **L3c** (building now in `v2-L3c`). Until it merges, nothing it owns:
  - `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts`
  - `data/schedules/**`, `web/scripts/legs-ors.mjs`
  - `web/lib/public/timeline.ts`, `prose.ts`, and the `days`, `bases` and `categories` code in `web/lib/public/trips.ts`; L3c's additive blocks in `types.ts` and `honesty.ts`
  - `web/app/trips/[slug]/page.tsx`, `web/components/trips/timeline/**`, `TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `StopStats.tsx`, `TripRouteMap.tsx`, `useTripUrl.ts`, `model.ts`, `web/styles/timeline.css`
  - `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts`, `types.ts`, `web/components/actions/CopySheet.tsx`
  - `web/tests/trips/timeline*.test.ts`, `web/tests/data/prose*.test.ts`, `web/tests/e2e/trip-timeline*.spec.ts`, and the trip page `describe` blocks

  After it merges, only the three timeline paths in your Part B row; never the scheduler, `selectVariant` or the ICS.
- **L4b:** until it merges, `web/components/places/**`, `web/lib/public/places.ts`, `tracks.ts`, `slugs.ts`, `honesty-overrides.ts`, `data/tracks/**`. After it merges, keep `TrailMap`, `TrailProfile` and `TrailExport` as they are and place them inside section 5.
- **L3b:** until it merges, `web/lib/public/world.ts`, `bands.ts`, `tags.ts`, `index.ts`, `web/components/places/rows.ts`, `web/lib/entities/**`, `web/components/entity/FilterBar.tsx` and the other filter UI. After it merges, never the `facets` block, the facet engine or the filter UI: a filter change goes to the coordinator.
- **L2b:** `web/app/globe/**`, `web/app/globe-data/**`, `web/lib/globe/**`, `web/components/globe/**`, `web/lib/public/globe.ts`, `web/lib/client/data.ts`. Keep `Completeness.label` and `level` unchanged in shape: the globe card reads them.
- **CS7:** `data/**`. You read the data; a wrong value goes in the hand-back for CS7.
- `core/**`: read only. If the join needs a core change (a missing export), ask in the hand-back.
- `data/schema/capture/**`, `docs/v2/research/capture/**`, `data/schema/suitability-applicability.json`: generated.
- `web/components/ui/**`: the new chip kinds (rule, advice, gap, fits, advice fail, rule fail) live in `web/components/suit/` for now; folding them into `components.md` 2.8 and `ui/` is a coordinator foundation edit (display C9).
- `data/locations/locations.json`: suitability.md 9.1 asked S1 to write the projected flat columns back through `locations.py edit`. Do not: the adapter reads the sidecars (Q28).

## Steps

### Part 0. Design (travel-design-reviewer, Opus)

1. Design the sections that have no design yet, in `docs/v2/design/place-page-sections.md` with a mock at 1440 and 390 in light and dark: Cover with the relevance badge and `why`; the At a glance strip from the contract; the Warnings line; "The route or the activity" with L4b's map and profile inside it; "Options and prices"; "How to get there" ("2 ways": routes, lifts, roads; access points; parking fee and fill time); "When to go"; "Facilities"; "At this place you can also"; "Nearby, worth adding"; "Similar nearby", the pointer and Plan B; the empty and gap states of each. "Who it suits" is designed already: reuse suitability-display unchanged.
2. Score the design against P1-P9 and T1-T5, list conflicts with suitability-display or the contract and how each is resolved, and show the owner's empty-section rule on a page with almost no data (Lake Louise today). Part B builds from this page; Part A does not wait for it.

### Part A. Adapter modules and the party scrub (now, new files only)

3. **`contract.ts`:** reads `contract.json` and the domain files at build time (P9). `sectionsFor(typeId)` returns the 14 sections with each property's mark (R, A or N) resolved for the type; `glanceFor(typeId)` returns the six glance slots (`display.glance`, else the first six R properties with a short renderer); `slot3For(typeId)`. Pure over the loaded files; tested with the jet-ski, hut-stage and kids'-zip examples of contract 8.2 added to a copy of `types.json`, each needing no code.
4. **`sections.ts`:** `buildSections(world, ref, contract)` returns the page model: for each section, its rows with value, value type, basis, read date, quote, sources and conflicts; a gap row for each missing R property; one closing line for missing A properties; nothing for N properties. A section is omitted only when all its properties are N for the type. It follows CC-adapter-requests:
   - a route with no relevance record takes draw, standing, class, photo and badge from its first `reaches` place, and says so ("To Sentinel Pass");
   - a lift line reads its chips, last up, last down, limits and stroller on board from `offer/<ref>#ticket` (via `incoming.on`); the top station is a place;
   - "At this place you can also" is `incoming.at` and `incoming.on`, grouped by domain, excluding the ways to the place (contract 2.7.4); "Part of" is `part_of`; `part/...#...` records fold into the parent page;
   - "How to get there" is the `reached_by` routes for a place, and `starts_at`, `reaches` and `passes` for a route;
   - offers keep their refs; an offer with no `at` place shows "Not checked yet" (the minitrekking).
5. **`suitability.ts`:** `publicSuitability(record, profile)` returns the three chip slots per the applicability 5.1 table and the display 3.2 wording (rule chip with at most three values and "+n" counting every operator ban, including pregnancy and medical; advice chip "From about 6"; the gap chip), the warning line from `hazards` or `weather_cancel`, the research line, and the six groups in the 5.2 order with their rows. `searched_none` reads "Not stated by the operator · searched <date> · ask before booking"; `no_limit` reads "No minimum age" and earns the lock. Pregnancy `not_recommended` is a value (CC-adapter 10). `usable_partial` reads "Usable, partly unverified" (display 9). "FE1" to "FE5" never appear in any output string.
6. **`relevance.ts`:** from `data/relevance/derived`: the one badge by precedence (journey, detour, local favourite) and the lens rules of relevance 3.6; `why`; the provenance text (judgement, designations with scope, mentions, signals with read dates); "Similar nearby" (up to 3 substitutes with badge, family effort and access load); "Nearby, worth adding" (hand-picked first with their reason, then derived, at most 3; a pair with `km` null shows no distance); the pointer for `local` and `regional` places; Plan B for anchors with a fallible access cost. No rating, review count or rank from any platform, ever.
7. **`party.ts` (2.43):**
   - restrict the leak patterns to party context: "A 300-year-old church" and "Bring the child carrier" survive;
   - the fare rewrite keeps the source's number ("A 7-year-old pays the child fare" becomes "The child fare applies from age 7");
   - a rewrite at the start of a sentence is capitalised ("A small group");
   - `publicParty(text, where, log)` reports every dropped sentence to the build's `DropLog`, so losses show in the build report; `origin.ts` passes the log through.

   Tests: each case above, plus the existing scrub and privacy suites unchanged in what they block.
8. **`web/components/suit/`:** the chip kinds of display 3.1, the group row with its provenance stub, the provenance row as a button opening the components 5.2 popover, and one renderer per value type (range, enum, bool, duration, season rows, hours, price list, window, limit, grade, relation list, link list). Tokens only (no hex). Unit tests render each chip kind and each renderer.

### Part B. Wiring and UI (after L3c, L4b and L3b merge)

9. **Rebase**, then wire through L3b's `world.ts`: `places.ts` attaches `sections`, `suitability` and `relevance` to each `PublicPlace`; `index.ts` adds `badge` to the card (the only new list key). The legacy label-matched facts are mapped to typed properties once in the adapter (contract 6.2, M3: `Fee` to price, `Lot` to access point, `Best time of day` to `best_time`) with basis `community` or the fact's own source, so no visible fact is lost.
10. **Completeness:** `completeness.ts` uses the core engine for records with a capture record and keeps the old checks for the rest, behind the same `Completeness` shape. The badge and the research line read "Usable, partly unverified" for `usable_partial`.
11. **Place page:** `PlacePage.tsx` renders the 14 sections in order from `place.sections`, using `components/places/sections/**` per the Part 0 design; "Who it suits" is section 4 per suitability-display; L4b's trail components sit in section 5. `glanceFor` in `model.ts` reads the contract, not labels. The stub line "Kid fit has not been assessed yet." is gone (display C8).
12. **Cards:** `placeBadges` shows the kids chip (rule, advice or gap look) and the effort name, at most two, wrapping to two lines rather than truncating (display rendering check), and at most one relevance chip after the name, apart from the suitability chips.
13. **Trip entries:** `timeline.ts` attaches `DayItem.suit` (the three slots, from `projectForSchedule` and `publicSuitability`); `Entry.tsx` shows the three chips after the title, before the honesty, idea and To book chips, wrapping on phone with the limits chip first; the entry's meta drops "child rule" (display C4); with a party profile, slot 1 is the fit chip (fits, advice fail, rule fail; D6). On trips of 4 or more nights anchors carry "Worth the journey"; on short trips the top stop carries "Local favourite"; `TripTimeline.tsx` marks the anchors in the at-a-glance strip (relevance 6.2).
14. **CS7 data:** take CS7's first batch (placement review, payoff places, lake parking and kids data) before the final shots, so the pages are judged on filled data where it exists and on honest gaps elsewhere.

## Acceptance checks

suitability-display section 6, checks 1 to 9 and 11 to 13, all pass on the built pages (check 10, the filters, is L3b's). Plus:

| # | Check | Against |
|---|---|---|
| S1 | Every place, route and offer page draws the contract's sections in order; a section with R or A properties and no values shows its gap markers; only an all-N section is absent (a bungee page has no Facilities and no Effort group, Lake Louise shows every R gap) | contract 6.1, owner rule |
| S2 | A type added to a copy of `types.json` (the three contract 8.2 examples) renders its page with no code change | contract 8 |
| S3 | No per-type branch: `rg "type ===|typeId ===|kind ===" web/components/places web/components/suit web/lib/public/sections.ts` finds no rendering decision by type id | contract 6.1 |
| S4 | The glance strip reads the contract on every page; no glance slot is filled by matching a fact label | contract 6.2 |
| S5 | Every visible legacy fact before the lane is still visible after it, as a typed property (a test diffs the fact values per page against the pre-lane build) | contract 6.2 |
| S6 | Larch Valley names and links Sentinel Pass as its payoff and takes its badge from it; the Banff Gondola's chips come from its ticket offer; Moraine Lake lists its canoe rental under "At this place you can also" | CC-adapter 3-5 |
| S7 | A hand-picked pair with no point shows with its reason and no distance; at most 3 pairs and 3 similar places; the pointer and Plan B show where relevance derives them | relevance 3.2, 6.2 |
| S8 | No relevance chip on a trip card; at most one on a place card, apart from the suitability chips | relevance 6.2, 6.7 |
| S9 | Timeline entries carry three suitability chips that wrap on phone with the limits chip first; with `?p=family-3` slot 1 shows the advice-fail or rule-fail chip with the basis | display 3.3, D6 |
| S10 | No public string contains "FE1" to "FE5", a rating, a review count, or a value sourced from a link-only platform | display 6.4, relevance 5.2 |
| S11 | "A 300-year-old church" and "Bring the child carrier" survive the scrub; the fare sentence keeps its own age; every dropped sentence is in the build report; the privacy test passes over `web/out` | 2.43 |
| S12 | The list rows gain only `badge`; the pinned-keys test lists it | P8 |
| S13 | Place page JS grows by under 15 kB gzip and stays under the 150 KB start budget; the largest place page HTML grows by under 25% | README 6, INT-C |
| S14 | axe clean on a place page with every group open and closed, on a card list and on a trip page; no horizontal scroll at 390 | WCAG AA |
| S15 | `git diff --name-only` shows only owned paths; Part B edits to merged lanes' files are listed | README 4.1 |

## Verification

```
pnpm --dir core test && pnpm --dir core typecheck
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
python3 tools/theme_tokens.py --check
bash tools/check-all.sh   # with web/.env.local moved aside
```

Screenshots: the L0 harness at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/S1/`, maps on the Arc GPU. Read tall pages in 1600 px tiles; zoom in on chip rows, the provenance popover and the gap chips.

| Page | Shots |
|---|---|
| Johnston Canyon Lower Falls (hike), Kicking Horse family section (raft), Golden Skybridge zip, Maligne Lake cruise (boat), Mt Norquay via ferrata, Myvatn Nature Baths | "Who it suits" at rest and with each group open; one provenance popover |
| Lake Louise | the whole page (the near-empty case with its markers) |
| Larch Valley, Banff Gondola, Moraine Lake | payoff, lift ticket, "At this place you can also" |
| a place with a pointer, an anchor with Plan B | the relevance blocks |
| `/places/` | cards with kids, effort and badge chips |
| `/trips/canadian-rockies-2029` | `#day-5` default and `?p=family-3#day-5` entries |

Then `travel-design-reviewer` (Opus) reviews the built pages against suitability-display, the Part 0 design and P1-P9, T1-T5; `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-S1`, branch `public/S1`, dev port 3425.
- **Commits, in this order:**
  1. `docs(v2): place page sections design and mock` (Part 0; the reviewer stages only its two paths)
  2. `web(public/S1): contract, sections, suitability and relevance modules`
  3. `web(public/S1): party scrub keeps legitimate text and logs drops (2.43)`
  4. `web(public/S1): chip kinds and value-type renderers`
  5. `web(public/S1): place pages from the contract, "Who it suits"` (after the rebase)
  6. `web(public/S1): card chips and relevance blocks`
  7. `web(public/S1): suitability chips and badges on timeline entries`
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back, and before each Part B commit. Do not push.
- **Merge order:** last of the stage 3 builds: after L3c (timeline entries), L4b (place page and trail components), L3b (`world.ts`, `rows.ts`, the descriptor) and, by default, L2b.

## Hand-back report

Keep it short. Include:
- the commits and the test counts;
- the pages per family with the section counts drawn, gap rows and closing lines (the research to-do for CS7);
- every legacy fact that could not be mapped to a property (step 9);
- every sentence the party scrub now drops, from the build report;
- the size deltas (S13);
- requests: the chip kinds into `components.md` 2.8 and `ui/` (display C9), the timeline-design 4.2 and 10 edits (display C4), any core export the join needed.
