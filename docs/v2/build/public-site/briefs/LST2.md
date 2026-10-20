# LST2: the Where filter (part a, phase B), its city level (part b, E) and near mode (part c, E)

Extends [LST.md](LST.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet).
- **Effort:** part a 8 h, part b 12 h, part c 9 h (each including about 1 h of Opus review and 1 h of verification).
- **Rows:** a: 8.1 (phase N0), Q54. b: 8.1 city level, 8.11 (`where-<cc>.json`), 8.12 and Q61 (Trips by province), Q62. c: 8.2 list part, 8.11 bbox, 8.16, Q56, Q57, 3.66 part (parser budget).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) tasks B1, E9, E11.
- **Spec:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) sections 4 and 5 (wireframes, keys, keyboard, empty states, P8 files), phases N0, N1 (WH-C, TR) and N2 (NB list part).
- **Principles:** P1, P2, P4, P8, P9, T5.
- **Starts:** a after CONS-0; b after META-2 (towns) and CONS-2; c after b and after PLC2b's `nearby.ts` merges. Parts are serial: they own the same files.
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
| a | `web/components/entity/WhereMenu.tsx` (new), `web/components/entity/FilterBar.tsx` (pill slot), `web/lib/entities/types.ts`, `web/lib/entities/descriptors/place.tsx`, `web/styles/filters.css`, `web/tests/entities/where.test.ts` (new), `web/tests/e2e/places-where.spec.ts` (new) |
| b | part a's files plus `web/lib/entities/descriptors/trip.tsx`, `web/lib/entities/url.ts`, `web/lib/entities/shards.ts`, `web/components/places/rows.ts` (one key), `web/app/list/places/**`, `web/lib/client/data.ts` (appended `// where (LST2b)` section) and its `contract.ts` entries, `web/lib/public/tags.ts` (trip regions from stops), `web/tests/data/light-data.test.ts`, `web/tests/entities/**` |
| c | part b's files plus `web/components/entity/NearChip.tsx` (new), the towns strip component, `web/lib/client/data.ts` (`// near (LST2c)`: `resolveNear`, `nearPlaces`, `townsNear`, `townParts`), `web/lib/search/parse/**`, `web/lib/search/build.ts` (town parts), `web/components/places/PlacesMap.tsx` (centre ring and circle), `web/tests/search/**`, `web/tests/cons/contract/near.test.ts`, `web/tests/e2e/places-near.spec.ts` (new) |

## Do not touch

`web/lib/public/nearby.ts` (PLC2b; import it), `web/lib/public/places.ts` (META-1), `data/reference/towns/**` and `tools/towns.py` (META-2), `core/src/config/**` and `core/src/geo/**` (CONS), `web/components/places/**` other than `rows.ts` and `PlacesMap.tsx`, everything else.

## Steps

### Part a (N0)

1. The Country pill becomes **Where** in the same slot: one cascading menu (Country, then State or province with the label following the country, then a third column "Parks and areas"). Region and area leave More filters. Keys `country`, `region`, `area` unchanged.
2. Counts under the other filters, ordered by count; "All of Alberta" at the top of each level; zero options behind one muted line; type-to-find over `regionAliases` and area names.
3. Keyboard and screen readers per spec 4.5; phone drill-down per 4.4 (44 px rows, back row names the parent, no scrim, no focus trap).
4. "Counting…" while the country file loads.

### Part b (WH-C, TR)

5. The third column gains "Cities and towns": towns of the region with at least one place within `NEAR_KM`, counts within that radius, from `where-<cc>.json` written at build by the same function the boundary exposes.
6. `city=<town-id>` (Q62) sets country and region; results within the radius, nearest first; removing the region removes the city; `area=banff` links keep working (one row where an area is the municipality).
7. Rows gain one allowlist key `near_town`; update `light-data.test.ts` by that key only.
8. Trips Where gains the province level from each trip's stops; no city level on Trips.

### Part c (NB list part)

9. `near=<place|area>:<id>` and `r` in `ListState` beside `bbox`; `parseState` drops `r` without a centre and `near` when `city` is set.
10. `nearPlaces(centre, r, query, pageSize)` in the boundary: resolves the centre, clamps `r` to `RADIUS_CAP`, refuses an unscoped query with the error shape, loads only shards whose bbox (`b` in the manifest) meets the circle, sorts by distance through `core/src/geo`. The cap lives here, not in the file layout.
11. NearChip leads the chips ("Within 25 km of Moraine Lake"), radius stepper with the presets, the towns strip, distance sort default, distance column in the table, group by band, the map ring and circle; "Search this area" leaves near mode.
12. Parser: "near <place>" writes `near=place:<slug>&r=25` (amends smart-search A6), "near <town>" writes `city=` (closes Q37), "within N km of" sets `r` to the next preset; town parts load only when the manifest's prefixes say a part holds the word. Hold the parser code budget test.
13. Contract cases in `near.test.ts` on the static and stub adapters (CONS-1 kit).

## Acceptance checks

| # | Check |
|---|---|
| 1 | a: spec N0 checks 1 to 9 (Alberta count and URL; Banff National Park chips; removing Canada clears all; "Alberta" typed gives the same state; four pills, six when scoped; keyboard path; 44 px rows and summary line at 390; "Counting…") |
| 2 | b: Canada, Alberta, Canmore gives places nearest first with `city=ca-ab-canmore`; Whitby from the find field gives the honest empty state and the towns strip with Oshawa and Ajax; `area=banff` links work; "Where · Alberta" on Trips gives the Rockies trip |
| 3 | c: `/places/?near=place:moraine-lake&r=25` matches the Around here set; `r=500` clamps to 100 with the chip saying so; an unknown `near` loads 0 shards; a network assertion shows only bbox-meeting shards; "near Whitby" gives Oshawa and Ajax; the 30-query parser fixture passes with query 21 in near mode |
| 4 | No approximate point in any distance |
| 5 | The contract kit is green on both adapters for list, where and near |
| 6 | Screenshots at 1440 and 390, light and dark: the Where menu at each level, a city view, a near view with the map |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

| Function | Contract | Server | Unchanged on switch |
|---|---|---|---|
| `listPlaces(query)`, `countList()` with Where keys | `ListState` in, `ListResult` and facet counts out, page size cap | `GET /api/places?country=&region=&area=&city=&r=` | components, URL keys, types, tests |
| `nearPlaces(centre, r, query, pageSize)` | centre token, `r ≤ 100`, error shape for unknown or unscoped | `GET /api/places?near=&r=` (PostGIS) | same |
| `townsNear(centre, r)`, `townParts(prefix)` | towns within `r`; one region part | `GET /api/towns?near=&r=` | same |

## Verification

Typecheck, lint, unit tests, your specs only (`places-where`, `places-near`, `smart-search`), `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. Screenshots at 1440 and 390, light and dark (site theme control), GPU flags, into `web/test-results/shots/LST2/`, read in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktrees `/home/nitin27may/workspace/travel-wt/v2-LST2a`, `v2-LST2b`, `v2-LST2c` (branches `public/LST2a` and so on, each from `main` after the previous merges), port 3464. Commits per step group `web(public/LST2): ...`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase onto `main`; do not push.

## Hand-back

Commits, counts at each Where level for Canada and Italy, the `where-<cc>.json` sizes, town part sizes, the shard loads per near query, the parser budget figure.
