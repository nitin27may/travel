# L3b: trip tags, trip filters and type-aware filters

Wave 3, stage 3. It runs in parallel with L3c (timeline), L4b (trail tracks), L2b (globe) and CS7 (research), and merges after L3c and L4b.
- **Agent:** `travel-builder` (Sonnet).
- **Effort:** about 18 hours, in four parts:
  - core derivations and the facet engine, 5 h
  - trip tags and the Trips filter bar, 6 h
  - type-aware facets on Places, 5 h
  - short-trip length classes, the drive pill and the 2.41 filter items, 2 h
- **Backlog:** 3.2, 3.11, capture-contract step 6 (3a.12), the trips half of 3a.5, and the 2.41 items "a Done button on filter pills" and "trips map clusters at empty centroids".
- **Specs:**
  - [research/capture-contract.md](../../../../research/method/capture-contract.md) section 7 (type-aware filters: rules, facets by scope, the bands in list rows) and section 8 (a new type is data).
  - [research/suitability.md](../../../../research/method/suitability.md) 6.3 (trip tags and filters), with [suitability-applicability.md](../../../../research/method/suitability-applicability.md) 5.3 (the derived values) and [design/suitability-display.md](../../design/suitability-display.md) section 5 (the Kids, Effort and Stroller labels and count lines).
  - [research/relevance.md](../../../../research/method/relevance.md) 6.3 (highlights and activity tags from anchors only).
  - [features/short-trips.md](../../features/short-trips.md) 2.1 (`lengthClass`) and 3.3 (the Length pill, drive pill, card chip, group by Length).
  - [design/foundation/principles.md](../../design/foundation/principles.md): P1, P3, P4, P8, P9 and T1, T4.
- **Starts:** now, in its own worktree. Steps 5 and 6 (the two tags that need the scheduler) are done after L3c merges and this lane rebases onto it.

## Goal

Trips get the same filter model as Places, and both lists get facets that come from the capture contract, so a new type or a new facet is a data change.

1. **Trip tags, all derived**, none typed by hand: where (continent, every country), length class, season, kids from N, hike effort, stroller days, activities from the trip's anchors and highlights, getting around, driving per day, one base or a road trip, and highlights (up to 2 anchors). Each tag chip on a trip card links to the filtered list.
2. **The Trips filter bar** with four primary pills (Where, When, Length, Kids), the rest under "More filters", live counts, one Clear all, and an empty state that suggests the nearest match (P4 decision).
3. **Type-aware facets on Places and Trips.** Narrowing Kind to a domain or category adds that scope's facets from `data/schema/capture/contract.json`, promotes up to two into the bar, and hides any facet that cannot split the results (contract 7.1).
4. **Bands in list rows** (contract 7.3): `effort`, `kids_from`, `time_band`, `price_band`, `booking`, `flags`. Labels and bands only, never facts with sources (P8). The pinned-keys tests add them by name.
5. **Short trips on the list:** the length classes Day trip, Overnight, Weekend and Long weekend before the 4-8, 9-14 and 15+ bands; the "From Toronto" drive pill; the card chip "Day trip · from Toronto 1 h 25"; group by Length.
6. **The Kids, Effort and Stroller facets** on Places with the labels, options and count lines of suitability-display section 5. They move here from S1 (3a.5), because this lane owns every list facet.

## Read first

- The specs above. Contract section 7 and suitability 6.3 are the contract for this lane.
- `data/schema/capture/contract.json` (`facets`, `bands`, `properties`) and one domain file such as `data/schema/capture/nature.json`. These files are generated: never edit them.
- [CC-adapter-requests.md](CC-adapter-requests.md) items 1, 2 and 8.
- `core/src/capture/records.ts` (`loadWorld`, `incomingOf`), `core/src/suitability/derive.ts`, `core/src/suitability/project.ts`, `core/src/relevance/derive.ts` and `data/relevance/derived/*.json` (role, badge).
- `web/lib/entities/types.ts` (`FacetDef`, `FACET_PARAMS`), `filter.ts` (`filterRows`, `facetCounts`, `gapNotes`), `url.ts`, `descriptors/trip.tsx`, `descriptors/place.tsx`.
- `web/components/entity/FilterBar.tsx`, `MoreFilters.tsx`, `FacetMenu.tsx`, `PhoneFilterSheet.tsx`.
- `web/app/trips/rows.ts`, `web/components/trips/types.ts` (`TRIP_LIST_KEYS`), `web/components/places/rows.ts` (`PLACE_LIST_KEYS`), `web/tests/data/allowlist.ts` and `light-data.test.ts`.
- `web/lib/public/index.ts` (`card`, `tripCard`), `types.ts`, `data/vocab/tags.json`, `data/vocab/types.json`.
- [README.md](README.md) 4.2 (working rules) and 8 (gotchas); the [L3c brief](L3c-trip-timeline.md) "Files you own".

## Files you own

| Area | Paths |
|---|---|
| Core derivations | `core/src/capture/bands.ts` (new), `core/src/derive/length.ts` (new; L3e imports it later), appended exports `kidsFromOf`, `familyEffortOf` and `strollerOkOf` at the end of `core/src/suitability/derive.ts` (append only, as applicability 5.3 names them), `core/test/capture/bands.test.ts`, `core/test/derive/length.test.ts`, `core/test/suitability/flat.test.ts` |
| Adapter, list part | `web/lib/public/tags.ts` (new), `web/lib/public/bands.ts` (new), `web/lib/public/world.ts` (new: one memoised `loadWorld` plus the suitability and relevance derived reads for the whole adapter; S1 reuses it), the calls from `web/lib/public/index.ts` (`card`, `tripCard` and the build), additive fields in `web/lib/public/types.ts` (`PublicTripCard.tags`, `lengthClass`, `fromHubs`; `PublicPlaceCard.bands`) |
| Facet engine | `web/lib/entities/facets/**` (new: contract facets to `FacetDef`, scope promotion, the 60% rule), additive edits to `web/lib/entities/types.ts`, `filter.ts` and `url.ts` (`k` and `f.<facet>` params) |
| Trips list | `web/app/trips/page.tsx`, `web/app/trips/rows.ts`, `web/app/trips/layout.tsx`, `web/components/trips/types.ts`, `TripsMap.tsx`, `TripCover.tsx`, `web/components/trips/tags/**` (new), `web/lib/entities/descriptors/trip.tsx`, `web/styles/trips.css`, `data/vocab/tags.json` (additive) |
| Places list, filter part | the `facets` block of `web/lib/entities/descriptors/place.tsx` (not `placeBadges` or the columns), `web/components/places/rows.ts` (row shape and `PLACE_LIST_KEYS`) |
| Filter UI | `web/components/entity/FilterBar.tsx`, `MoreFilters.tsx`, `MoreFilters.lazy.tsx`, `FacetMenu.tsx`, `PhoneFilterSheet.tsx` (promoted pills, the hidden-facet count line, the Done button) |
| Tests | `web/tests/trips/tags*.test.ts`, `web/tests/entities/facets*.test.ts` (new), `web/tests/filter.test.ts` and `web/tests/url.test.ts` (facet blocks), `web/tests/data/allowlist.ts`, `light-data.test.ts`, `web/tests/places/rows.test.ts`, `web/tests/e2e/trips-filters*.spec.ts`, `web/tests/e2e/places-facets*.spec.ts`, `web/tests/e2e/places-parity.spec.ts`; in `web/tests/e2e/trips.spec.ts`, `trips.shots.spec.ts` and `web/tests/trips/trips.test.ts` only the **list** `describe` blocks |

## Do not touch

- **L3c** (building now in `v2-L3c`; everything it owns):
  - `core/src/schedule/**`, `core/test/schedule/**`, `core/test/fixtures/schedule/**`, `core/bin/schedule.ts`
  - `data/schedules/**`, `web/scripts/legs-ors.mjs`
  - `web/lib/public/timeline.ts`, `prose.ts`, and the `days`, `bases` and `categories` code in `web/lib/public/trips.ts` (do not edit `trips.ts` at all); L3c's additive blocks in `types.ts` and `honesty.ts`
  - `web/app/trips/[slug]/page.tsx`, `web/components/trips/timeline/**`, `TripPlan.tsx`, `DayRow.tsx`, `CategoryView.tsx`, `CategoryStrip.tsx`, `StopStats.tsx`, `TripRouteMap.tsx`, `useTripUrl.ts`, `model.ts`, `web/styles/timeline.css`
  - `web/lib/export/draft.ts`, `ics.ts`, `build.server.ts`, `types.ts`, `web/components/actions/CopySheet.tsx`
  - `web/tests/trips/timeline*.test.ts`, `web/tests/data/prose*.test.ts`, `web/tests/e2e/trip-timeline*.spec.ts`, and the trip page `describe` blocks
- **L4b:** `data/tracks/**`, `web/scripts/tracks-osm.mjs`, `web/lib/public/tracks.ts`, `places.ts`, `slugs.ts`, `honesty-overrides.ts`, `web/components/places/**` except `rows.ts`, `web/lib/export/gpx.ts`, `kml.ts`, `licence.ts`.
- **L2b:** `web/app/globe/**`, `web/app/globe-data/**`, `web/lib/globe/**`, `web/components/globe/**`, `web/styles/globe.css`, `web/public/globe/**`, `tools/globe_data.py`, the globe section of `web/lib/client/data.ts`.
- **S1:** `web/lib/public/contract.ts`, `suitability.ts`, `relevance.ts`, `sections.ts`, `party.ts`, `web/components/suit/**`. In `descriptors/place.tsx`, `placeBadges` and the card chips are S1's after this lane merges.
- **CS7:** `data/capture/**`, `data/suitability/**`, `data/relevance/**` (except reading `derived/`), `data/sources/**`.
- `data/schema/capture/**`, `research/types/**` and `data/schema/suitability-applicability.json` are generated: read only. A new facet is a registry change in `core/src/schema/capture/properties.ts`, which is not yours; ask in the hand-back.
- `web/components/ui/**`: ask in the hand-back. New icons go in `web/components/trips/tags/icons.tsx`.

## Steps

### Part 1. Core derivations and the facet engine

1. **`core/src/derive/length.ts`:** `lengthClass(nights)` and `isShort(nights)` exactly as short-trips 2.1. Test the five classes and the 3/4 boundary.
2. **Flat suitability values** (applicability 5.3), appended to `core/src/suitability/derive.ts`:
   - `kidsFromOf(record)`: the larger of the rule `min_age` (from the record or its most permissive offer) and `age_band.from`; the passenger age for `solo` kinds; `null` when both are gaps.
   - `familyEffortOf(record)`: `effort.family_effort`; from `water_safety.class` for paddle profiles; from the easiest lift-served trail for `mtb_lift`; `null` where effort is N.
   - `strollerOkOf(record)`: `stroller` for surfaces, `stroller_on_board` for conveyances; `yes`, `partly` or `no`; `null` when N.

   Each returns the value and whether it is a rule or advice, so the Kids facet can hide on a rule and fade on advice.
3. **`core/src/capture/bands.ts`:** `bandsOf(world, ref)` returns `{ effort, kids_from, time_band, price_band, booking, flags }` from the record's type (time property), its offers (price), its windows and access cost (booking), and its facilities and suitability (flags, at most 6 ids). A gap gives `null`, never a guessed band. Pure, no I/O. Tests: a trail, a lift (read through `offer/<ref>#ticket`), a raft offer, a lake, a sight with no hours.
4. **`web/lib/entities/facets/`:**
   - `fromContract.ts`: turns each `contract.json` facet (`property`, `scopes`, `control`, `label`, `band`) into a `FacetDef` with `tier: 'more'` and a `scope`.
   - `scope.ts`: given the active Kind (a type id or a domain), returns the facets in scope by walking the type tree, so a new type joins its parent's scope with no code.
   - `promote.ts`: the two promoted facets per scope from contract 7.2 (the table is data, read from the contract's facet order, not hard-coded per type).
   - `coverage.ts`: the 60% rule (contract 7.1 rule 3). It returns the facets to hide and the count-line text ("Duration hidden: not known for most results").

   URL state: `?k=<type id>&f.<facet>=<value>`, with the existing list-state key order. `FACET_PARAMS` grows by the `k` key and a `f.` prefix rule, not by one entry per facet.

### Part 2. Trip tags and the Trips filter bar

5. **`web/lib/public/tags.ts`** (called from `index.ts`; it never edits `trips.ts`). One function per tag, each pure and tested:

| Tag | Rule | Source |
|---|---|---|
| Where | continent and every country visited (multi) | the trip's bases and places, `CONTINENT_OF` |
| Length | `lengthClass(nights)`; 4+ nights fall into 4-8, 9-14, 15+ | the card's `nights` |
| When | season months | the card's season |
| Kids from N | the lowest youngest-age for which `selectVariant` finds a fitting variant on every day, run at ages 0 to 17 (after the rebase onto L3c). Until then, and for overview trips, the hand-typed `ageFit`. When the two differ, keep the computed value and log the old one as a conflict in the build report | suitability 6.3 |
| Hike effort | the maximum `familyEffortOf` over the trails in the default variant: Stroll and Easy are "easy", Moderate is "moderate", Hard and Technical are "strenuous" (after the rebase onto L3c) | suitability 6.3 |
| Stroller days | "Stroller-friendly" when every day's easiest variant has no walking item with stroller `no` (folded access excepted), else "Some stroller days (n of N)"; a gap never passes | suitability 6.3 |
| Activities | rolled up from the trip's anchors and highlights only (role from `data/relevance/derived`), mapped to `tags.json` ids (lakes, glaciers, canyons, wildlife, hiking and the rest) | relevance 6.3 |
| Highlights | up to 2 anchors, by effective draw then by day ("Moraine Lake · Icefields Parkway") | relevance 6.3 |
| Getting around | rental car, camper van, train, tours, from the trip's logistics rows | adapter |
| Driving per day | a band from the days' `driveMin`: under 1 h, 1-2 h, 2-3 h, 3 h+ (≈ when estimated) | adapter |
| Shape | one base, or a road trip (3 or more bases) | `bases` |

   Overview trips get Where, Length and When only, and no chips for what they cannot know (no fake zeros). Every tag value is in `tags.json`, so a tag means the same on Trips and on Places.
6. **The two scheduler tags** (Kids from N, Hike effort): do them after L3c merges and you rebase. Use `core/src/schedule/select.ts` from the merged branch; do not copy it.
7. **`descriptors/trip.tsx`:** primary pills Where, When, Length and Kids; under More filters Activities, Hike effort, Stroller days, Getting around, Driving per day, Shape and Source. Live counts, one Clear all, an empty state that names the nearest match. Sort keys gain Length; group by gains Length (Day trips first).
8. **`TripCover.tsx` and `components/trips/tags/`:**
   - the card's mono line shows the length chip ("Day trip · from Toronto 1 h 25", "2 nights · a weekend", or nights for 4+);
   - "Kids from 6" and "Hike effort: moderate" chips (suitability-display 3.3), at most two;
   - the Highlights line (relevance 6.2: no relevance chip on trip cards);
   - each tag chip is a link to `/trips/?<facet>=<value>`.
9. **`rows.ts` and `TRIP_LIST_KEYS`:** add the tag ids, `lengthClass` and `fromHubMin` (light fields only). Update the pinned-keys test by name.
10. **Drive pill** (short-trips 3.3, 4.2): "From Toronto: under 1 h · 1-2 h · 2-3 h · 3 h+", URL `drive=toronto-2`, reading `fromHubs` from the adapter. The hub matrix (backlog 3.12, `data/outings/from-hubs.json`) is not built yet: while no trip has a `fromHubs` value, the pill is hidden by the coverage rule and the count line says so. A trip with only an estimate shows ≈ in its band chip. The hub switch inside the pill shows Toronto only until Q9 is answered.
11. **`TripsMap.tsx`:** the clusters sit at the mean of their members, never at an empty centroid (2.41).

### Part 3. Type-aware facets on Places

12. **`web/lib/public/bands.ts`:** joins `bandsOf` onto each `PublicPlaceCard` through `world.ts`. Only the band keys reach the card (P8).
13. **`components/places/rows.ts`:** the row carries the bands. `PLACE_LIST_KEYS` and `allowlist.ts` add `effort`, `kids_from`, `time_band`, `price_band`, `booking` and `flags` by name.
14. **`descriptors/place.tsx`, facets block:**
    - The four primary pills stay: Country, Kind, Season, Kids. Kind shows domains first with counts, then categories (contract 7.1 rule 1).
    - **Kids** reads `kids_from` with the suitability-display section 5 menu ("Youngest child", a stepper and quick chips). A rule above the age hides the place; advice above it fades the card to 60% (pending Q21); a gap never passes, and the count line adds "n not checked yet".
    - **Effort** and **Stroller** go under More filters with the section 5 labels, options and count lines. Effort lists the five names, never "FE".
    - Narrowing Kind adds the scope's facets from `facets/scope.ts` and promotes two into the bar (six pills at most; Q27).
15. **Filter UI** (`FilterBar`, `MoreFilters`, `FacetMenu`, `PhoneFilterSheet`): promoted pills, the hidden-facet count line, chips for every active facet, and a **Done** button in each pill menu on phone (2.41). Clearing Kind removes the scope's facets and keeps the four primary pills.

### Part 4. Tests

16. Unit tests (vitest):
    - `lengthClass` boundaries; the three flat values on one fixture per profile family (hike, lake, lift, raft, bungee, boat);
    - `bandsOf` for each band, and `null` for every gap;
    - each trip tag on the Rockies, Dolomites, Patagonia and one overview trip;
    - the facet engine: a type added to a copy of `types.json` under `water.motor` joins the Activities scope with no code change (the contract 8.2 jet-ski example as a fixture);
    - coverage: a facet answered by 59% of the scope is hidden with its count-line text; at 60% it shows;
    - a gap never passes a positive filter on any facet;
    - URL round trip of `k` and `f.<facet>` with the list-state key order;
    - P8: the pinned keys of both list rows; no band value carries a source or a note.
17. E2E (`trips-filters.spec.ts`, `places-facets.spec.ts`), with axe on every state below.

## Acceptance checks

| # | Check | Against |
|---|---|---|
| 1 | `/trips/` shows four primary pills (Where, When, Length, Kids) and More filters; each pill shows live counts; one Clear all; an impossible combination shows the nearest-match suggestion | P4 |
| 2 | Every trip card carries its length chip, at most two suitability chips, and the Highlights line on trips with anchors; no relevance chip on trip cards | suitability-display 3.3, relevance 6.2 |
| 3 | Each tag chip on a card opens `/trips/` filtered by it, and the list shows that chip active | backlog 3.2 |
| 4 | The Rockies' "Kids from N" equals the lowest age at which every day has a fitting variant (computed after the rebase), and its hike effort comes from the default variant's trails | suitability 6.3 |
| 5 | Activity tags on the Rockies come from its anchors and highlights only: a filler's class adds no tag | relevance 6.3 |
| 6 | Overview trips show Where, Length and When only, with no empty chips | P2, no fake zeros |
| 7 | `/places/?kind=nature.trail` adds Effort and Length to the bar and Time, Climb, Shape, Stroller, Dogs and Multi-day under More filters; a facet answered by fewer than 60% of the results is hidden and the count line says why | contract 7.1, 7.2 |
| 8 | Adding a type to `types.json` under an existing category puts it under that scope's facets with no code change (fixture test) | contract 8 |
| 9 | Kids on Places hides a place with a rule above the age and fades one with advice above it; a gap never passes; the count line names those left out | suitability-display 5 |
| 10 | No list row carries a key outside the pinned list; band values are labels, not facts | P8 |
| 11 | Every list state is in the URL (`k`, `f.<facet>`, `drive`, `sort`, `group`, `page`), survives reload and Back, and matches a query a server could answer | P9 |
| 12 | The drive pill is hidden while no trip has a hub value, and the count line says so; with a fixture `from-hubs.json` it filters by band and shows ≈ for estimates | short-trips 3.3, 4.2 |
| 13 | Day trips sort and group first under group by Length | short-trips 3.3 |
| 14 | On phone each pill menu has a Done button; no horizontal scroll at 390; every target is at least 44 px | 2.41, P4 |
| 15 | No cluster on the trips map sits where no member trip is | 2.41 |
| 16 | `git diff --name-only` shows only owned paths; the additive edits to `types.ts`, `index.ts`, `entities/types.ts`, `filter.ts`, `url.ts` and `derive.ts` are listed | README 4.1 |
| 17 | `/trips/` and `/places/` JS each grow by under 8 kB gzip; the list HTML grows by under 10% | README 6, P8 |

## Verification

```
pnpm --dir core test && pnpm --dir core typecheck
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test
pnpm --dir web build && pnpm --dir web e2e
python3 tools/theme_tokens.py --check
bash tools/check-all.sh   # with web/.env.local moved aside (README, STATUS)
```

Screenshots: the L0 harness at 1440 x 900 and 390 x 844, light and dark, 2x, into `web/test-results/shots/L3b/`. Read tall pages in 1600 px tiles. Maps render on the Arc GPU (`--use-gl=angle --use-angle=gl --ignore-gpu-blocklist --enable-gpu-rasterization`), never SwiftShader.

| Page | Shots |
|---|---|
| `/trips/` | default; Kids menu open; More filters open; `?length=day`; group by Length; an empty result |
| `/trips/` phone | a pill menu with Done; the phone filter sheet |
| `/places/` | default; `?kind=nature.trail`; `?kind=water` with Swimming promoted; Kids 6 with a faded card; the hidden-facet count line |
| trip card | Rockies, Dolomites, an overview trip |

Then `travel-design-reviewer` (Opus, never Fable) reviews the filter bar, the menus and the card chips against P1-P9 and T1-T5 before the verifier. `travel-verifier` re-runs the checks on the Arc GPU.

## Commit rules

- **Worktree:** `/home/nitin27may/workspace/travel-wt/v2-L3b`, branch `public/L3b`, dev port 3421.
- **Commits, in this order:**
  1. `core(L3b): length class, flat suitability values, list bands`
  2. `web(public/L3b): facet engine from the capture contract`
  3. `web(public/L3b): trip tags in the adapter`
  4. `web(public/L3b): trips filter bar, tag chips, length and drive pills`
  5. `web(public/L3b): type-aware facets and suitability filters on Places`
  6. `web(public/L3b): scheduler tags after the L3c rebase`
- Stage with `git -C <worktree> add <owned paths>`, never `-A`.
- End each message with the Co-Authored-By trailer your harness gives.
- Rebase onto the latest v2 branch before hand-back. Do not push.
- **Merge order:** after L3c (shared trips tests in different `describe` blocks, and `selectVariant`) and preferably after L4b (L4b adds about 80 trail places; this lane owns `rows.ts` and `places-parity.spec.ts`, so it rebases onto the final place set). Do not pin a count of today's places in any test.

## Hand-back report

Keep it short. Include:
- the commits and the test counts;
- every trip whose computed "Kids from N" differs from its hand-typed `ageFit`, with both values;
- every facet hidden by the coverage rule on the real data, by scope, with its coverage (this is CS7's to-do list);
- the JS and HTML size deltas (check 17);
- the additive edits to shared files;
- requests: any registry change in `properties.ts` a facet needs, any `ui/` component change, and the foundation edit for six pills when scoped (Q27).
