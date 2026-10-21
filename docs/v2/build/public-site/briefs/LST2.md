# LST2: the Where filter (part a, phase A), its city level (part b, E) and near mode (part c, E)

> **Corrected 21 Oct 2026:** part a is phase A (EXECUTION-PLAN tasks A7, A7b), not phase B; the plan tasks are A7, A7b, E8 and E10. Entry point: [docs/v2/PLAN.md](../../../PLAN.md). Worktree paths below are from the first (Linux) machine; use `<repo parent>/travel-wt/` here.

Extends [LST.md](LST.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** part a 16 h (8 h Where pill plus 8 h of list polish from the coverage sweep), part b 12 h, part c 9 h (each including about 1 h of Opus review and 1 h of verification).
- **Rows:** a: 8.1 (phase N0), Q54, and the list polish lines R4-P2, R4-P3, 3.62c, 3.62d, 3.66c to 3.66h, VI-2 in [COVERAGE.md](../COVERAGE.md). b: 8.1 city level, 8.11 (`where-<cc>.json`), 8.12 and Q61 (Trips by province), Q62. c: 8.2 list part, 8.11 bbox, 8.16, Q56, Q57, 3.66 part (parser budget).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks A7, A7b, E8, E10 (corrected 21 Oct; was "B1, E9, E11").
- **Spec:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) sections 4 and 5 (wireframes, keys, keyboard, empty states, P8 files), phases N0, N1 (WH-C, TR) and N2 (NB list part).
- **Principles:** P1, P2, P4, P8, P9, T5.
- **Starts:** a on day 1 (no API dependency: use the existing `listPlaces`, `countList` and facets; no new boundary signature); b after gate G-B (the API is in) and META-2 (towns); c after b and after PLC2b's `core/src/nearby/` merges. Parts are serial: they own the same files. Parts b and c build on `CatalogueStore`: the city facet and counts in `core/src/query/`, near in `core/src/catalogue/json/near.ts`, the handlers under `web/app/api/v1/`.
- **Opus review:** after each part.

## Goal

A visitor narrows Places by country, province, then city or park, with counts at each step, and can ask what is within a radius of any place, town or city, nearest first, without any request pulling more than the shards the circle meets.

## Read first

- The spec sections above, all of them.
- `web/components/entity/FilterBar.tsx`, `PhoneSummary.tsx`, `MoreFilters.tsx`; `web/lib/entities/descriptors/place.tsx` (region and area facets, `tier: 'more'`), `trip.tsx`, `url.ts`, `types.ts`, `shards.ts`, `filter.ts`; `web/lib/client/data.ts` and `contract.ts`; `web/components/places/rows.ts`; `web/lib/search/parse/**`; `web/tests/data/light-data.test.ts` (the allowlist).
- `core/src/config/nearby.ts` and `core/src/geo/**` (CONS-2) before part b.

## Files you own

| Part | Paths |
|---|---|
| a | `web/components/entity/**`, `web/lib/entities/types.ts`, `web/lib/entities/descriptors/place.tsx`, `web/styles/filters.css`, `web/components/places/rows.ts`, `PlacesMap.tsx`, `PlaceCardFooter.tsx`, `cluster.ts`, `web/components/trips/TripsMap.tsx`, `TripCover.tsx`, `web/lib/search/aliases.ts`, `web/tests/entities/where.test.ts` (new), `web/tests/e2e/places-where.spec.ts` (new), `places.spec.ts`, `lists-lst.spec.ts`, `trips-filters.spec.ts` (not `smart-search.spec.ts` or `places-parity.spec.ts`, which TST owns in phase A) |
| b | part a's files plus `web/lib/entities/descriptors/trip.tsx`, `core/src/query/**` (the city facet and counts, moved there by API-2), `core/src/schema/api/places.ts` (city fields), `core/src/catalogue/json/places.ts` (city counts), `web/app/list/places/**` (the static fallback's `where-<cc>.json`), `web/lib/public/tags.ts` (trip regions from stops), `web/tests/data/light-data.test.ts`, `web/tests/entities/**`, the matching contract cases |
| c | part b's files plus `web/components/entity/NearChip.tsx` (new), the towns strip component, `core/src/catalogue/json/near.ts` and `towns.ts`, `core/src/schema/api/near.ts`, `web/app/api/v1/near/**`, `web/app/api/v1/towns/**`, `core/src/parse/**` (the near rule), `web/lib/search/build.ts` (town parts for the static fallback), `web/components/places/PlacesMap.tsx` (centre ring and circle), `web/tests/search/**`, `web/tests/cons/contract/near.test.ts`, `web/tests/e2e/places-near.spec.ts` (new) |

## Do not touch

`core/src/nearby/**` (PLC2b; import it), `core/src/catalogue/json/points.ts` (META-1), `data/reference/towns/**` and `tools/towns.py` (META-2), `core/src/config/**` and `core/src/geo/**` (CONS), `web/components/places/**` other than `rows.ts` and `PlacesMap.tsx`, everything else.

## Steps

### Part a (N0)

1. The Country pill becomes **Where** in the same slot: one cascading menu (Country, then State or province with the label following the country, then a third column "Parks and areas"). Region and area leave More filters. Keys `country`, `region`, `area` unchanged.
2. Counts under the other filters, ordered by count; "All of Alberta" at the top of each level; zero options behind one muted line; type-to-find over `regionAliases` and area names.
3. Keyboard and screen readers per spec 4.5; phone drill-down per 4.4 (44 px rows, back row names the parent, no scrim, no focus trap).
4. "Counting…" while the country file loads.
5. **List polish (coverage lines; check each first and report it if already fixed):** the Kids pill reads as the age control after 4.24 ("with kids" maps to the ask chip, R4-P2); 6 sort options or fewer, the rest through table columns (R4-P3); a search box in the phone filter panel (3.66c); "No waterfalls here yet" for a lone Kind chip (3.66d); the map view loads only the files its viewport meets (3.66e); the trips-map ring above a cluster at 390 (3.66f); the count tween (3.66g); a merged duplicate is findable by its real names (3.62c, 3.66h); the card kids chip and effort glyph (3.62d); trips map cluster centroids and first framing (VI-2).

### Part b (WH-C, TR)

6. The third column gains "Cities and towns": towns of the region with at least one place within `NEAR_KM`, counts within that radius, from `where-<cc>.json` written at build by the same function the boundary exposes.
7. `city=<town-id>` (Q62) sets country and region; results within the radius, nearest first; removing the region removes the city; `area=banff` links keep working (one row where an area is the municipality).
8. Rows gain one allowlist key `near_town`; update `light-data.test.ts` by that key only.
9. Trips Where gains the province level from each trip's stops; no city level on Trips.

### Part c (NB list part)

10. `near=<place|area>:<id>` and `r` in `ListState` beside `bbox`; `parseState` drops `r` without a centre and `near` when `city` is set.
11. `near()` on `CatalogueStore` (and `nearPlaces()` in the boundary, which calls `GET /api/v1/near`): resolves the centre, clamps `r` to `RADIUS_CAP`, refuses an unscoped query with `invalid_scope`, sorts by distance through `core/src/geo`. The cap lives in the store method. The `StaticAdapter` fallback loads only the shards whose bbox (`b` in the manifest) meets the circle.
12. NearChip leads the chips ("Within 25 km of Moraine Lake"), radius stepper with the presets, the towns strip, distance sort default, distance column in the table, group by band, the map ring and circle; "Search this area" leaves near mode.
13. Parser: "near <place>" writes `near=place:<slug>&r=25` (amends smart-search A6), "near <town>" writes `city=` (closes Q37), "within N km of" sets `r` to the next preset; town parts load only when the manifest's prefixes say a part holds the word. Hold the parser code budget test.
14. Contract cases in `core/test/catalogue/contract/near.cases.ts`, run on `JsonStore`, `StubStore` and through the handler (API-1 kit).

## Acceptance checks

| # | Check |
|---|---|
| 1 | a: each list polish line fixed at 1440 and 390, light and dark, or shown already fixed |
| 1b | a: spec N0 checks 1 to 9 (Alberta count and URL; Banff National Park chips; removing Canada clears all; "Alberta" typed gives the same state; four pills, six when scoped; keyboard path; 44 px rows and summary line at 390; "Counting…") |
| 2 | b: Canada, Alberta, Canmore gives places nearest first with `city=ca-ab-canmore`; Whitby from the find field gives the honest empty state and the towns strip with Oshawa and Ajax; `area=banff` links work; "Where · Alberta" on Trips gives the Rockies trip |
| 3 | c: `/places/?near=place:moraine-lake&r=25` matches the Around here set; `r=500` clamps to 100 with the chip saying so; an unknown `near` loads 0 shards; a network assertion shows only bbox-meeting shards; "near Whitby" gives Oshawa and Ajax; the 30-query parser fixture passes with query 21 in near mode |
| 4 | No approximate point in any distance |
| 5 | The contract kit is green on `JsonStore`, `StubStore` and the handlers for list, where and near |
| 6 | Screenshots at 1440 and 390, light and dark: the Where menu at each level, a city view, a near view with the map |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

| Function | Contract | Server | Unchanged on switch |
|---|---|---|---|
| `listPlaces(query)`, `countList()` with Where keys | `ListState` in, `ListResult` and facet counts out, page size cap | `GET /api/v1/places?country=&region=&area=&city=&r=` | components, URL keys, types, tests |
| `nearPlaces(centre, r, query, pageSize)` | centre token, `r ≤ 100`, error shape for unknown or unscoped | `GET /api/v1/places?near=&r=` (PostGIS) | same |
| `townsNear(centre, r)`, `townParts(prefix)` | towns within `r`; one region part | `GET /api/v1/towns?near=&r=` | same |

## Verification

Typecheck, lint, unit tests, your specs only (`places-where`, `places-near`, `smart-search`), `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. Screenshots at 1440 and 390, light and dark (site theme control), GPU flags, into `web/test-results/shots/LST2/`, read in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktrees `/home/nitin27may/workspace/travel-wt/v2-LST2a`, `v2-LST2b`, `v2-LST2c` (branches `public/LST2a` and so on, each from `main` after the previous merges), port 3464. Commits per step group `web(public/LST2): ...`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase onto `main`; do not push.

## Hand-back

Commits, counts at each Where level for Canada and Italy, the `where-<cc>.json` sizes, town part sizes, the shard loads per near query, the parser budget figure.
