# META: metadata completeness, schema and validator (META-0, phase B), migration (META-1) and towns layer (META-2), phase E

> **Revised 21 Oct (start sheet).** Order, worktrees and preconditions come from [PHASE-B-START.md](../PHASE-B-START.md): META-0 runs in slot 1, beside CONS-1 and before API-1a, because the API's detail point carries the `pointRole` and `approx` META-0 defines. Changes in this brief: META-0 is **Opus** by the 21 Oct model rubric (it changes the capture contract); paths follow the research home (`research/method/capture-contract.md`, generated `research/types/`); the town id is `<cc>-<admin1>-<slug>` (owner Q76) and META-0 rewrites nearby spec 3.1 to match; `POINT_ROLE` is appended to `core/src/schema/enums.ts` as the one definition API-1a imports; the point output shape follows SRV-D subsection 13.1 item 3; the gap budget step and its check-all anchor; macOS paths, the venv for pytest and the Metal GPU flag; GeoNames admin1 codes need a mapping to ISO codes.

- **Agents and models:** META-0 `travel-builder` on **Opus** (a shared contract: properties, the point schema, validator codes, tiers). META-1 and META-2 `travel-builder` on **Sonnet** (they implement the rules META-0 writes); escalate to Opus if the Whitby exemption or the migration needs judgement. `travel-verifier` (Sonnet) after each. Record the model in each hand-back.
- **Effort:** META-0 10 h plus 1 h verify, META-1 6 h, META-2 6 h.
- **Rows:** 8.3 (placement rule), 8.7 (locations store tiers, validate warnings: in DATA D2), 8.7b (point join), 8.4, 8.9, 8.10 (towns, credit, Whitby exemption), 13.5 (metadata completeness for every kind), 3.37 (point schema, decided here), Q76 (town id format).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) section 6 (tiers, the measured audit, acceptance numbers, mechanics), tasks B6, E1, E2. [PHASE-B-START.md](../PHASE-B-START.md) sections 3 (collisions C1, C10, C11, C13, C16, C20) and 7 (check-all step 2). The research batches that fill the data are [DATA.md](DATA.md).
- **Specs:** [nearby-and-regions.md](../../../features/nearby-and-regions.md) section 3 (the placement block, validator codes, migration) and 5.6 (towns); [capture-contract.md](../../../../../research/method/capture-contract.md); [schema-diff-2026-10.md](../../../../../research/reports/schema-diff-2026-10.md) sections 6.3, 6.5 and 6.6.
- **Principles:** P1, P8, P9, T3, T5. A gap is never a yes.
- **Starts:** META-0 in slot 1 (after the 25 Oct usage reset; CLN-R is merged, `a1ceff8`). META-1 and META-2 after gate G-B (the API and CONS-2 are in).
- **Review:** no design review; travel-verifier. Stage 5 check 5.3 samples the data in run 2.

## Goal

Every record of every kind (place, trail, other route, activity, event, stay) has one checkable rule for what it must carry, a gap report that shows what is missing per kind, and a placement block (area chain, sourced point with its role, nearest town) that Nearby, the Where filter, related places and activities all read.

## Read first

- EXECUTION-PLAN section 6 in full; schema diff sections 6.3 (points), 6.5 (towns), 6.6 (area chain) and 13 (risk 7).
- `data/vocab/types.json` (`layers` and `profiles` R/A/N marks), `core/src/schema/capture/properties.ts`, `core/src/schema/enums.ts` (`CAP_LINK_KIND`, `CAP_LINK_ONLY_KIND`, `SUIT_STATE`), `core/src/validate/capture.ts`, `codes.ts`, `core/src/capture/gapsCli.ts`, `core/bin/capture.ts`.
- `data/capture/README.md`, `data/capture/points.json` (`capture-points/1`; keys are refs, some of them path-like such as `legacy/canadian-rockies-sept-2029/adventures/banff-gondola`), `data/relevance/inputs/points.json` (`points`, `towns`), `data/capture/migration-ledger.json`. Do not confuse `data/capture/placement.json` (`capture-placement/1`, where facts sit between layers) with the placement block.
- `web/lib/public/places.ts` (how a page gets its point), `web/lib/public/origin.ts` (the Whitby scrub; in `core/src/privacy/` after API-2).
- `research/method/capture-contract.md` (the section numbers before you add 3.7).

## Files you own

| Sub-lane | Paths |
|---|---|
| META-0 | `core/src/schema/capture/properties.ts`, the `point` value schema and the points sidecar schema under `core/src/schema/capture/**`, `POINT_ROLE` appended to `core/src/schema/enums.ts`, `core/src/validate/capture.ts`, `core/src/validate/codes.ts` (append only), `core/src/capture/gapsCli.ts`, `core/bin/capture.ts` (the `gaps` modes and `--budget`), `data/capture/gap-budget.json` (new), generated outputs regenerated with `node core/bin/capture.ts build` and `node core/bin/schema.ts generate` (`data/schema/**`, `research/types/**`), `research/method/capture-contract.md` (new section 3.7 "Placement and tiers"), `docs/v2/features/nearby-and-regions.md` (section 3.1: the town id format, Q76), `.claude/agents/travel-researcher.md` (one checklist line), `core/test/capture/**`, one step line in `tools/check-all.sh` (after "capture contract", PHASE-B-START section 7 step 2) |
| META-1 | `core/src/catalogue/json/points.ts` (the point read order inside `JsonStore`; `web/lib/public/places.ts` only if the dataset builder still decides the page point, one function), `core/bin/capture.ts migrate-placement` (new verb), `core/src/capture/migratePlacement.ts` (new), `data/capture/**` (`area_id` writes, trailheads from held tracks), `data/capture/points.json`, `web/tests/data/places*.test.ts` |
| META-2 | `tools/towns.py` (new), `tools/tests/test_towns.py` (new), `data/reference/towns/**` (new, committed), `core/src/derive/near.ts` (new), `core/src/catalogue/json/towns.ts` (the `towns()` store method), the `near_town` derive step in `capture.ts build`, `core/src/privacy/**` (the exemption only; API-2 moved the scrub there), `web/tests/data/public-privacy.test.ts` (the Whitby rule), `web/components/home/AboutData.tsx` (GeoNames credit line) |

## Do not touch

`web/components/**` other than `AboutData.tsx`, `web/lib/client/**`, `web/lib/entities/**`, `web/lib/search/**` (LST2 builds town parts from your files), `core/src/schema/api/**` and `core/src/catalogue/**` in phase B (API-1's; API-1a imports `POINT_ROLE` from you), `data/vocab/types.json` unless step 2 needs an R mark change (then it is one reviewed commit), `data/schema/**` and `research/types/**` by hand (regenerate), `data/capture/placement.json`, research data passes (DATA), `core/test/research/**` (TD-0 and TD-1).

## Steps

### META-0 (phase B, slot 1)

1. **Properties.** Add `near_town` (identity group, value: a town id matching `^[a-z]{2}-[a-z0-9]+-[a-z0-9-]+$`, base R, derived, gap text "Nearest town not worked out yet"), `near_town_km`, and `geonames_id` (A; R for `settlement.*`). Append `POINT_ROLE = ["centre", "trailhead", "entrance", "parking", "meeting", "summit", "route_start"]` to `core/src/schema/enums.ts`; add `point_role` and `approx` (boolean, default false) to the point value and the points sidecar schema. **3.37 decided:** the point stays in the sidecar keyed by ref. Existing sidecar rows stay valid (both fields optional on read).
2. **Tiers per kind.** Write EXECUTION-PLAN 6.2 into capture-contract section 3.7 and check it against the `types.json` R and A marks. Where a field the owner listed is R in the plan but not marked R in `types.json` (for example `run_by` and `season` on `offer.*`; `starts_at` on routes is already R), list it; propose any mark change as one reviewed commit to `types.json`, then `capture.ts build`.
3. **Validator codes:** `E_PLACE_AREA`, `E_PLACE_ORPHAN`, `W_PLACE_POINT`, `W_PLACE_APPROX`, `E_PLACE_FAR` (more than 25 km outside the area bbox), `W_PLACE_TOWN`, `W_TIER_REQUIRED` (per kind, from the R marks). Migrated records (pinned by `migration-ledger.json`) warn; new records error.
4. **Gap reports:** `capture.ts gaps --placement [--trip <t>] [--json]` (format in nearby spec 3.3) and `capture.ts gaps --tier required|enrichment [--layer <l>] [--type <prefix>] [--json]` printing the per-kind matrix (the columns of EXECUTION-PLAN 6.4).
5. **Budget gate:** `data/capture/gap-budget.json` holds today's counts per code; `capture.ts gaps --budget --check` fails if a count rises; add it to check-all at step 2 of PHASE-B-START section 7. DATA lanes lower it.
6. **Researcher checklist:** the one line from EXECUTION-PLAN 6.6 in `.claude/agents/travel-researcher.md`.
7. **Stable ids and versions:** document in section 3.7 that `ref` never changes (a rename is `same_place_as` plus a redirect; the public slug follows the slug registry API-1a adds, PHASE-B-START D-B1), every file carries `schema`, every value carries `src`, `on` and a basis or confidence, so the JSON loads into the two-tier catalogue of the schema diff (owner Q73) unchanged.
8. **Town id (Q76).** Rewrite nearby spec 3.1's `near_town` row from `town/<cc>/<admin1>/<slug>` to `<cc>-<admin1>-<slug>` (`ca-on-whitby`), and write the admin1 rule into section 3.7: `<admin1>` is the lower-case ISO 3166-2 subdivision suffix (`on`, `ab`), not the GeoNames admin1 code (Ontario is `08` in `admin1CodesASCII`), so META-2 maps one to the other; a country with no ISO subdivision uses `00`.

### META-1 (phase E)

9. `E_PLACE_FAR` runs first over every existing point; fix nothing silently: list each hit for DATA D1.
10. **Join fix.** In `JsonStore` (and the dataset builder that feeds pages), a page reads its point from `data/capture/points.json`, then `data/relevance/inputs/points.json`, by ref, before saying "no point". Report the real gained count (19 by slug suffix, 23 by the spec's ref join). The API's detail point carries `pointRole` and `approx` from the joined row (contract case K16).
11. **`migrate-placement` (runs once, like `migrate`):** writes `area_id` onto the 346 records without one, from the locations store, then the trip, then the parent through `part_of`, `at` or `starts_at`, then point-in-polygon against the area tree; adds trailheads from the first vertex of a confirmed track (Dolomites only) with `point_role: trailhead`.
12. Rerun both gap reports; lower `gap-budget.json`.

### META-2 (phase E, the towns layer)

13. `tools/towns.py`: download GeoNames `cities1000` and `admin1CodesASCII` once (cached under `tools/.cache/`, one request each, the project user agent), filter to settlements within 100 km of any public point plus every hub and trip base, write `data/reference/towns/<cc>.json` rows `[id, name, lat, lon, pop, admin1, ascii, qid]` with ids `<cc>-<admin1>-<slug>` per step 8. Report the row count and sizes (estimate 1,500 to 3,000 rows).
14. `core/src/derive/near.ts`: `near_town` and `near_town_km` for every record with a non-approximate point: the nearest settlement of at least 1,000 people within 50 km, else the value "none within 50 km". Run it from `capture.ts build`. Distances come from `core/src/geo/` (CONS-2).
15. **Whitby (Q50 decided yes):** exempt the towns rows and the near or city chip from the scrub in `core/src/privacy/`, and only those; the privacy test pins where "Whitby" may appear. Trip text, origin points and the 2 km rule stay.
16. GeoNames credit (CC BY 4.0) on `/about/data/`.

## Acceptance checks

| # | Check |
|---|---|
| 1 | `node core/bin/capture.ts fields --type nature.trail.hike` prints the placement block first |
| 2 | `gaps --placement --trip canadian-rockies-2029` prints the 3.3 table; `gaps --tier required --json` prints the per-kind matrix and matches EXECUTION-PLAN 6.4 within the changes since 20 Oct |
| 3 | A new record with no `area_id` fails check-all; a migrated one warns |
| 4 | `capture.ts gaps --budget --check` is in check-all and fails on a raised count (a test commit proves it) |
| 5 | `POINT_ROLE` is defined once (`enums.ts`); nearby spec 3.1 shows the `ca-on-whitby` format |
| 6 | After META-1: every place and route has `area_id`; `E_PLACE_FAR` 0 or each hit listed; the no-point page count drops by the joined count |
| 7 | After META-2: Whitby, Oshawa, Ajax, Canmore, Cortina d'Ampezzo resolve; `near_town` on every record with a non-approximate point; the privacy test passes under Q50 |
| 8 | `capture.ts build --check`, `locations.py build --check` and check-all pass |
| 9 | `git diff --name-only` shows only owned paths |

## Server switch

The placement block, tiers and validator are Zod schemas and pure checks in `core/`; SRV-0's loader and the API validate the same shapes. `towns()` and the point join are `CatalogueStore` concerns, served by `GET /api/v1/towns` and inside every place response, with contract cases (K15 to K17). `near_town` is derived by a pure function a server can run on insert. The point join is one adapter function; a server reads the joined column (`point_role`, `point_approx` in the schema diff's M5). No component changes on the switch.

## Verification

`pnpm --dir core test && pnpm --dir core typecheck`, `python -m pytest tools/tests -q` from the venv (PHASE-B-START section 1; system `python3` has no pytest), `node core/bin/capture.ts build --check`, `node core/bin/schema.ts generate --check`, then `PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside and restored. No UI in META-0 or META-1; for META-2 a screenshot of `/about/data/` at 1440 and 390, light and dark, on the project's `GPU_ARGS` (on macOS `--use-angle=metal`), into `web/test-results/shots/META/`. GeoNames is one download, cached; no other external calls.

## Commit rules

Worktrees `/Users/nks/workspace/travel-wt/v2-META0`, `v2-META1`, `v2-META2` (branches `public/META0` and so on, from `main`: `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-META0 -b public/META0 main`, then `pnpm install --frozen-lockfile` at the worktree root), port 3468 if a server is needed. Commits: `core(META): ...`, `data(META): ...`, `tools(META): ...`, `docs(v2): capture contract 3.7 placement and tiers`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; after a rebase, rerun `capture.ts build` and `schema.ts generate` instead of merging generated files; do not push.

## Hand-back

Commits; the model used; the gap reports before and after (JSON attached); the tier list with any `types.json` mark change proposed; the budget counts; the join count; the migration counts; the towns row count and part sizes; the admin1 mapping table; the privacy test result.
