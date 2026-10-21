# TRP2: the trip route map on Google Maps, and Export trip (phase E)

Extends [TRP.md](TRP.md) (stage 4). This brief is self-contained for round 2.

- **Agent:** `travel-builder` (Sonnet). `travel-design-reviewer` (Opus) writes a short note first.
- **Effort:** about 18 h (note 2 h, map 9 h, export 5 h, tests and shots 2 h).
- **Rows:** 9.5 and Q51 (Google trip map), 9.6 and Q46 (Export trip, per item and public), 3.67 part (map hover ring, pin-click scroll).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task E12.
- **Specs:** [trip-timeline.md](../../../features/trip-timeline.md), [design/trip-page/stage4-map-note.md](../../../design/trip-page/stage4-map-note.md), [research/map-stack-2026-10-18.md](../../../../../research/reports/map-stack-2026-10-18.md) (amended by Q51: Google on the trip route map, MapLibre kept for the globe and the trips list map).
- **Principles:** P2, P5, P7 (copy and export is the 90% action), T2 (works in the field, exports), T5.
- **Starts:** the note at R1 entry; the build after gate G-B (the API, `core/src/export` and CONS-2 are in) and after TRP1 (phase A) has merged, since it owns the same files.
- **Opus review:** before (the note) and after.

## Goal

The trip route map is Google Maps with our pins and lines: routed legs solid, estimates dashed and labelled, pins numbered in day order, the day fitted as you scroll; and the whole trip exports in the formats a visitor needs, honest about gaps and with no household data.

## Read first

- BACKLOG 9.5, 9.6 word for word.
- `web/components/trips/TripRouteMap.tsx`, `TripPlan.tsx`, `TripActions.tsx`, `timeline/*`; `web/lib/map/**` (`family.ts`, `google-js/**`, `primary.ts`, `palette.ts`); `web/lib/export/**`; `web/components/actions/ExportMenu.tsx`, `ExportData.tsx`, `CopySheet.tsx`.
- `data/schedules/legs/dolomites-2027.json` (ORS legs held), `web/scripts/legs-ors.mjs`.

## Files you own

`web/components/trips/**` except `TripsMap.tsx`, `TripCover.tsx`, `types.ts` and `tags/**`; `web/lib/map/**` except the link-builder shim and `palette.ts` (CONS-3 after you merge); `core/src/export/**` (moved there by API-2), `core/src/schema/api/export.ts`, `web/app/api/v1/export/**`, the export contract cases; `web/lib/export/**` (the shims and client download code); `web/components/actions/**`; `web/styles/timeline.css` and the trip-page styles; `web/tests/trips/**`, `web/tests/export/**`, `web/tests/map/**` except `links*`; `web/tests/e2e/trip-*.spec.ts`, `export.spec.ts`; the note `docs/v2/design/trip-page/google-map-note.md` (written by the reviewer).

## Do not touch

`core/src/schedule/**` unless a change is unavoidable (then run the scheduler bundle test and say so; it triggers stage 5 check 5.4), the trips list files (LST2), `components/places/**`, `components/globe/**`, `web/lib/client/**` (CONS; request a method), everything else.

## Steps

1. **Note first.** The reviewer rules on: pin style and numbering, routed versus estimated line style, the legend, Fit and All days controls, the phone map sheet, and where "Export trip" sits (plan bar and page top).
2. **Map family per page.** A new `NEXT_PUBLIC_TRIP_MAP_FAMILY` (documented in the env table, names only) selects `google-js` for the trip route map; without a key it falls back to MapLibre, so check-all (run without the env file) still builds. One family per page holds: the trip page has one map.
3. **Google route layer** in `web/lib/map/google-js/`: our points only (never Google's coordinates), ORS geometry as solid polylines where a leg is routed, straight dashed lines labelled "straight line, estimate" otherwise; pins numbered in day order; the day fits on settle; hover ring and pin-click scroll to the entry. The Map ID is the shared one (POIs off at go-live). Colours from theme tokens through the palette reader, nothing typed.
4. **ODbL credit** on the map for ORS and OSM geometry: "Route geometry © OpenStreetMap contributors".
5. **Export trip** in the plan bar and at the top: print-friendly page (and the browser's PDF), ICS for a dated copy (existing), CSV, KML or GPX of the route. The export carries every day, times, places with links, booking windows, sources, and "Not checked yet" where a value is missing; the profile and overrides chosen on the page are what is exported; no household data. Per item, public (Q46).
6. Tests: one family on the page; day change fits the day; the legend matches the drawn lines; each export parses (ICS with VTIMEZONE, KML and GPX valid XML, CSV with a header); the privacy scan over an export.

## Acceptance checks

| # | Check |
|---|---|
| 1 | Rockies day 8 on Google: roads and names, numbered pins in order, routed legs solid, estimates dashed with the label |
| 2 | Scrolling to day 9 fits day 9; Fit and All days work; hover ring and pin-click scroll work |
| 3 | Without a key the page builds and shows MapLibre (check-all) |
| 4 | Each export opens; gaps shown as "Not checked yet"; no household data |
| 5 | The ODbL credit is visible on the map |
| 6 | The scan finds no new literal (colours, hosts) |
| 7 | Screenshots at 1440 and 390, light and dark: Rockies day 8, Dolomites day 3, the export menu, the print view |
| 8 | `git diff --name-only` shows only owned paths |

## Server switch

`loadExport(type, slug, format, profile)` calls `GET /api/v1/export/trip/{slug}?format=&p=`, which calls `CatalogueStore.getExport()` with the Zod `ExportQuery` and the pure builders in `core/src/export/`. Rate limits come with hosting (laundry list item 14); a `SupabaseStore` passes the same export contract cases. The map reads trip stops and legs from the trip model built by the adapter; routed legs later come from the server's `leg_cache` (item 34) with the same leg shape. URLs (`p`, `split`, `#day-N`) and components are unchanged on the switch.

## Verification

Typecheck, lint, unit tests, your trip and export specs only, `bash tools/check-all.sh` with `web/.env.local` moved aside and restored; then one build with the env file in place to check the Google family (never print the key). Screenshots on the GPU flags into `web/test-results/shots/TRP2/`, read in tiles. Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

Worktree `/home/nitin27may/workspace/travel-wt/v2-TRP2`, branch `public/TRP2` from `main`, port 3466. Commits: `web(public/TRP2): Google trip route map with honest legs (9.5)`, `web(public/TRP2): Export trip (9.6)`. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; rebase; do not push.

## Hand-back

Commits, test counts, the Google map load count per page view (for the quota), the routed versus estimated leg counts per trip, the export sizes.
