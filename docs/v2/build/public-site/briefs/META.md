# META: metadata completeness, schema and validator (META-0, phase B), migration (META-1) and towns layer (META-2), phase E

- **Agent:** `travel-builder` (Sonnet) for code; the tier definitions in step 2 are checked by `travel-planner` (Opus) before the validator is written.
- **Effort:** META-0 10 h, META-1 6 h, META-2 6 h.
- **Rows:** 8.3 (placement rule), 8.7 (locations store tiers, validate warnings: in DATA D2), 8.7b (point join), 8.4, 8.9, 8.10 (towns, credit, Whitby exemption), 13.5 (metadata completeness for every kind), 3.37 (point schema, decided here).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 6 (tiers, the measured audit, acceptance numbers, mechanics), tasks B4, E2, E3. The research batches that fill the data are [DATA.md](DATA.md).
- **Specs:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) section 3 (the placement block, validator codes, migration) and 5.6 (towns); [capture-contract.md](../../../research/capture-contract.md).
- **Principles:** P1, P8, P9, T3, T5. A gap is never a yes.
- **Starts:** META-0 at R1 entry (phase B, core only); META-1 and META-2 after gate G-B (the API and CONS-2 are in).
- **Review:** no design review; travel-verifier. Stage 5 check 5.3 samples the data in run 2.

## Goal

Every record of every kind (place, trail, other route, activity, event, stay) has one checkable rule for what it must carry, a gap report that shows what is missing per kind, and a placement block (area chain, sourced point with its role, nearest town) that Nearby, the Where filter, related places and activities all read.

## Read first

- EXECUTION-PLAN section 6 in full.
- `data/vocab/types.json` (398 nodes; `layers` and `profiles` R/A/N marks), `core/src/schema/capture/properties.ts` (83 properties), `core/src/schema/enums.ts` (`CAP_LINK_KIND`, `CAP_LINK_ONLY_KIND`), `core/src/validate/capture.ts`, `codes.ts`, `core/src/capture/gapsCli.ts`, `core/bin/capture.ts`.
- `data/capture/README.md`, `data/capture/points.json`, `data/relevance/inputs/points.json` (`points`, `towns`), `data/capture/migration-ledger.json`.
- `web/lib/public/places.ts` (how a page gets its point), `web/lib/public/origin.ts` (the Whitby scrub).

## Files you own

| Sub-lane | Paths |
|---|---|
| META-0 | `core/src/schema/capture/properties.ts`, the `point` value schema and the points sidecar schema under `core/src/schema/capture/**`, `core/src/validate/capture.ts`, `core/src/validate/codes.ts`, `core/src/capture/gapsCli.ts`, `core/bin/capture.ts` (the `gaps` modes), `data/capture/gap-budget.json` (new), generated outputs regenerated with `node core/bin/capture.ts build`, `docs/v2/research/capture-contract.md` (new section 3.7 "Placement and tiers"), `.claude/agents/travel-researcher.md` (one checklist line), `core/test/capture/**` |
| META-1 | `core/src/catalogue/json/points.ts` (the point read order inside `JsonStore`; `web/lib/public/places.ts` only if the dataset builder still decides the page point, one function), `core/bin/capture.ts migrate-placement` (new verb), `core/src/capture/migratePlacement.ts` (new), `data/capture/**` (`area_id` writes, trailheads from held tracks), `data/capture/points.json`, `web/tests/data/places*.test.ts` |
| META-2 | `tools/towns.py` (new), `tools/tests/test_towns.py` (new), `data/reference/towns/**` (new, committed), `core/src/derive/near.ts` (new), `core/src/catalogue/json/towns.ts` (the `towns()` store method), the `near_town` derive step in `capture.ts build`, `core/src/privacy/**` (the exemption only; API-2 moved the scrub there), `web/tests/data/public-privacy.test.ts` (the Whitby rule), `web/components/home/AboutData.tsx` (GeoNames credit line) |

## Do not touch

`web/components/**` other than `AboutData.tsx`, `web/lib/client/**`, `web/lib/entities/**`, `web/lib/search/**` (LST2 builds town parts from your files), `data/vocab/types.json` unless step 2 needs an R mark change (then it is one reviewed commit), `data/schema/**` and `docs/v2/research/capture/**` by hand (regenerate), research data passes (DATA).

## Steps

### META-0 (phase B)

1. **Properties.** Add `near_town` (identity group, value `ref`, base R, derived, gap text "Nearest town not worked out yet"), `near_town_km`, and `geonames_id` (A; R for `settlement.*`). Add `point_role` (`centre`, `trailhead`, `entrance`, `parking`, `meeting`, `summit`, `route_start`) and `approx` to the point value and the points sidecar schema. **3.37 decided:** the point stays in the sidecar keyed by ref.
2. **Tiers per kind.** Write EXECUTION-PLAN 6.2 into capture-contract section 3.7 and check it against the `types.json` R and A marks. Where a field the owner listed is R in the plan but not marked R in `types.json` (for example `run_by` and `season` on `offer.*`, `starts_at` on routes, which are already R), list it; propose any mark change as one reviewed commit to `types.json`, then `capture.ts build`.
3. **Validator codes:** `E_PLACE_AREA`, `E_PLACE_ORPHAN`, `W_PLACE_POINT`, `W_PLACE_APPROX`, `E_PLACE_FAR` (more than 25 km outside the area bbox), `W_PLACE_TOWN`, `W_TIER_REQUIRED` (per kind, from the R marks). Migrated records (pinned by `migration-ledger.json`) warn; new records error.
4. **Gap reports:** `capture.ts gaps --placement [--trip <t>] [--json]` (format in nearby spec 3.3) and `capture.ts gaps --tier required|enrichment [--layer <l>] [--type <prefix>] [--json]` printing the per-kind matrix (the columns of EXECUTION-PLAN 6.4).
5. **Budget gate:** `data/capture/gap-budget.json` holds today's counts per code; check-all fails if a count rises. DATA lanes lower it.
6. **Researcher checklist:** the one line from EXECUTION-PLAN 6.6 in `.claude/agents/travel-researcher.md`.
7. **Stable ids and versions:** document in section 3.7 that `ref` never changes (a rename is `same_place_as` plus a redirect), every file carries `schema`, every value carries `src`, `on` and a basis or confidence, so the JSON loads into the catalogue tables of `docs/v2/schema.sql` unchanged.

### META-1 (phase E)

8. `E_PLACE_FAR` runs first over every existing point; fix nothing silently: list each hit for DATA D1.
9. **Join fix.** In `JsonStore` (and the dataset builder that feeds pages), a page reads its point from `data/capture/points.json`, then `data/relevance/inputs/points.json`, by ref, before saying "no point". Report the real gained count (19 by slug suffix, 23 by the spec's ref join).
10. **`migrate-placement` (runs once, like `migrate`):** writes `area_id` onto the 346 records without one, from the locations store, then the trip, then the parent through `part_of`, `at` or `starts_at`, then point-in-polygon against the area tree; adds trailheads from the first vertex of a confirmed track (Dolomites only) with `point_role: trailhead`.
11. Rerun both gap reports; lower `gap-budget.json`.

### META-2 (phase E, the towns layer)

12. `tools/towns.py`: download GeoNames `cities1000` and `admin1CodesASCII` once (cached under the globe tools cache, `tools/.cache/`), filter to settlements within 100 km of any public point plus every hub and trip base, write `data/reference/towns/<cc>.json` rows `[id, name, lat, lon, pop, admin1, ascii, qid]` with ids `<cc>-<admin1>-<slug>`. Report the row count and sizes (estimate 1,500 to 3,000 rows).
13. `core/src/derive/near.ts`: `near_town` and `near_town_km` for every record with a non-approximate point: the nearest settlement of at least 1,000 people within 50 km, else the value "none within 50 km". Run it from `capture.ts build`.
14. **Whitby (Q50 decided yes):** exempt the towns rows and the near or city chip from the `origin.ts` scrub, and only those; the privacy test pins where "Whitby" may appear. Trip text, origin points and the 2 km rule stay.
15. GeoNames credit (CC BY 4.0) on `/about/data/`.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `node core/bin/capture.ts fields --type nature.trail.hike` prints the placement block first |
| 2 | `gaps --placement --trip canadian-rockies-2029` prints the 3.3 table; `gaps --tier required --json` prints the per-kind matrix and matches EXECUTION-PLAN 6.4 within the changes since 20 Oct |
| 3 | A new record with no `area_id` fails check-all; a migrated one warns |
| 4 | After META-1: every place and route has `area_id`; `E_PLACE_FAR` 0 or each hit listed; the no-point page count drops by the joined count |
| 5 | After META-2: Whitby, Oshawa, Ajax, Canmore, Cortina d'Ampezzo resolve; `near_town` on every record with a non-approximate point; the privacy test passes under Q50 |
| 6 | `capture.ts build --check`, `locations.py build --check` and check-all pass |
| 7 | `git diff --name-only` shows only owned paths |

## Server switch

The placement block, tiers and validator are Zod schemas and pure checks in `core/`; SRV-0's loader and the API validate the same shapes. `towns()` and the point join are `CatalogueStore` concerns, served by `GET /api/v1/towns` and inside every place response, with contract cases. `near_town` is derived by a pure function a server can run on insert. The point join is one adapter function; a server reads the joined column. No component changes on the switch.

## Verification

`pnpm --dir core test && pnpm --dir core typecheck`, `python3 -m pytest tools/tests -q`, `node core/bin/capture.ts build --check`, then `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. No UI; for META-2 a screenshot of `/about/data/` at 1440 and 390, light and dark, into `web/test-results/shots/META/`. GeoNames is one download, cached; no other external calls.

## Commit rules

Worktrees `/home/nitin27may/workspace/travel-wt/v2-META0`, `v2-META1`, `v2-META2` (branches `public/META0` and so on, from `main`), port 3468 if a server is needed. Commits: `core(META): ...`, `data(META): ...`, `tools(META): ...`, `docs(v2): capture contract 3.7 placement and tiers`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits; the gap reports before and after (JSON attached); the tier list with any `types.json` mark change proposed; the join count; the migration counts; the towns row count and part sizes; the privacy test result.
