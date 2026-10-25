# TRP2: the trip route map on Google Maps (TRP2a, first in phase E) and routed legs with Export trip (TRP2b)

> **Revised 23 Oct (phase E start sheet).** [PHASE-E-START.md](../PHASE-E-START.md) puts TRP2 **first** in phase E, because the owner looked at preview 1 on 23 Oct and said the day plan on the trip page still does not show the Google map (BACKLOG 9.5, Q51). Changes in this brief: one lane became two. **TRP2a** ships the Google map with the data that exists today and needs no contract change; the owner sees it on the mid-phase preview M1 (`127.0.0.1:3476`). **TRP2b** adds routed legs with geometry (no legs file holds geometry today, and only the Dolomites has legs) and Export trip, after API-3 lands `tripLegs` and the `json` export format. The trip family defaults to Google when a key exists (D-E1); `NEXT_PUBLIC_TRIP_MAP_FAMILY` is a test override only. `web/components/map/**` and optional `MapSpec` fields are now owned here (collision E11). Start JS on the trip page must not grow (D-E9). Task ID corrected: EXECUTION-PLAN E11, not E12. macOS worktrees and ports 3477 and 3480; the Linux paths are gone. A data-only trip (TD-2, after R2) gets the same map with no change, because the map reads only the route model.

Extends [TRP.md](TRP.md) (stage 4).

- **Agents and models:** `travel-design-reviewer` (**Opus**) writes the note first (TRP2-N, 1.5 h) and reviews each part after. `travel-builder` on **Sonnet** builds both parts (well specified, inside owned files). `travel-verifier` (Sonnet) after each. Record the model in each hand-back.
- **Effort:** TRP2a 8 h build plus 1 h review (and the 1.5 h note); TRP2b 10 h (legs script and run 3.5 h, map reads legs 1.5 h, Export trip 3 h, tests and shots 2 h) plus 1 h review.
- **Rows:** 9.5 and Q51 (Google trip map), 9.6 and Q46 (Export trip, per item and public), 3.67 part (map hover ring, pin-click scroll).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) task E11; [PHASE-E-START.md](../PHASE-E-START.md) sections 2, 4 (E11, E12, E15, E17), 6 (D-E1, D-E5, D-E6, D-E9), 12 (M1).
- **Specs:** [trip-timeline.md](../../../features/trip-timeline.md), [design/trip-page/stage4-map-note.md](../../../design/trip-page/stage4-map-note.md), [map-stack-2026-10-18.md](../../../../../research/reports/map-stack-2026-10-18.md) (amended by Q51: Google on the trip route map; MapLibre kept for the globe and the trips list map).
- **Principles:** P2, P3, P5 (smooth linked open and close: map and timeline follow each other), P7 (copy and export is the 90% action), P8 (legs per trip, exports per item), P9, T2 (works in the field), T5 (an estimate never looks like a route).
- **Starts:** TRP2a on Sun 25 Oct, after the note (it may start before REF1 merges and rebases on it). TRP2b after API-3 merges (Tue 27 Oct).

## What exists today (verified 23 Oct at b4e3d6a)

- `web/components/trips/TripRouteMap.tsx` registers `/trips/[slug]` as `maplibre` (line 9) and holds the map key under the map.
- `web/components/map/MapSurface.tsx` loads `MapLibreMap`, `GoogleJsMap` and `GoogleEmbedMap` as separate dynamic chunks.
- `web/components/map/GoogleJsMap.tsx` already draws pins and `route`, `route-pick` and `straight-estimate` lines (dashed through an icon repeat).
- `web/lib/map/family.ts` has `placePageFamily()` and no trip selector. `MapSpec` lives in `core/src/links/types.ts` (re-exported by `web/lib/map/types.ts`).
- `data/schedules/legs/dolomites-2027.json` (`trip-legs/1`) holds km and minutes per pair, **no geometry**. `web/scripts/legs-ors.mjs` builds Dolomites pairs from `web/data-snapshots/prototype.json`. The Rockies has no legs file.
- Exports: `core/src/export/**` (ics, csv, kml, gpx), `getExport` at `GET /api/v1/export/{type}/{slug}/`, `web/components/actions/ExportMenu.tsx`.

## Goal

The trip route map is Google Maps with our pins and lines: pins numbered in day order, routed legs solid, estimates dashed and labelled, the day fitted as you scroll, the map and the timeline linked both ways; and the whole trip exports in the formats a visitor needs, honest about gaps, with no household data.

## Files you own

| Part | Paths |
|---|---|
| TRP2a | `web/components/trips/**` except `TripsMap.tsx`, `TripsMapLazy.tsx`, `TripCover.tsx`, `types.ts` and `tags/**` (LST2); `web/components/map/**` (place-page maps must look the same before and after); `web/lib/map/**` except `links.ts` (PLC2) and `palette.ts` (read only; CONS-3 after TRP2b); optional appended fields in `MapSpec` in `core/src/links/types.ts` (only those the note names); `web/styles/timeline.css` and the trip-page styles; `web/tests/trips/**`, `web/tests/map/**` except `links*`; `web/tests/e2e/trip-*.spec.ts`; one row in the env table of `docs/v2/build/public-site/README.md` (`NEXT_PUBLIC_TRIP_MAP_FAMILY`); the note `docs/v2/design/trip-page/google-map-note.md` (written by the reviewer) |
| TRP2b | TRP2a's files plus `web/scripts/legs-ors.mjs` and the pair builder it imports (`web/lib/public/legs-pairs.ts`), `data/schedules/legs/**`, `core/src/export/**` (the builders only; the export contract is API-3's), `web/lib/export/**`, `web/components/actions/**`, `web/tests/export/**`, `web/tests/e2e/export.spec.ts`, `web/tests/data/legs*.test.ts` |

## Do not touch

`core/src/catalogue/**`, `core/src/schema/api/**`, `web/lib/server/**`, `web/app/api/**` and `web/lib/client/**` (API-3; request a method); `core/src/schedule/**` unless a change is unavoidable (then run the scheduler bundle test and say so; it triggers stage 5 check 5.4); the trips list files (LST2); `web/components/places/**`, `web/components/globe/**`; `web/app/themes.css` (generated); `web/.env.local` (never print it); everything else.

## Steps

### TRP2-N (note, Opus, before TRP2a)

1. The reviewer rules, in `docs/v2/design/trip-page/google-map-note.md`: pin style and numbering (day order; bases distinct; the picked day emphasised), routed against estimated line style and the legend wording, the hover ring, pin-click behaviour (scroll the timeline to the entry and open it, P5), Fit and All days, the phone map sheet, the ODbL credit placement, where "Export trip" sits (plan bar and page top), and any optional `MapSpec` field needed. Colours only through existing tokens; a new token goes through `tools/theme_tokens.py` and is named in the note.

### TRP2a (Sonnet)

2. **Family.** `tripPageFamily()` in `web/lib/map/family.ts`: `google-js` when `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set (Q51), else `maplibre`; `NEXT_PUBLIC_TRIP_MAP_FAMILY` overrides for tests. Change the registration in `TripRouteMap.tsx` to the resolved family so the one-family test and the runtime agree. Add the env table row.
3. **Route layer on Google.** In `GoogleJsMap` (inside its dynamic chunk): numbered pins in day order; our points only, never Google's coordinates; the legend true to what is drawn; `straight-estimate` lines dashed with the label "Straight line, not a route"; solid `route` lines drawn only where a leg carries geometry (none yet; test with a fixture). The day fits on settle; Fit and All days work; hover on an entry rings its pin and hover on a pin highlights its entry; a pin click scrolls the timeline to the entry. The `MapHandle` methods `MapLibreMap` offers today work the same on Google.
4. **Map ID.** Use `NEXT_PUBLIC_GOOGLE_MAP_ID` (the shared Map ID, POIs off by the owner's console setting, Q89). Never wire `NEXT_PUBLIC_GOOGLE_MAPS_MAPID`.
5. **Start JS net zero (D-E9).** All new map code lives in the map's dynamic chunk. `TripRouteMap.tsx` and `TripPlan.tsx` may not grow the trip page's start JS; measure before and after with `web/tests/budget.test.ts`.
6. **Tests.** One family on the trip page; Google family chosen with a key and MapLibre without; pins numbered in day order; the legend matches the drawn lines; a day change fits the day; hover ring and pin-click scroll (e2e with `web/lib/map/fake-google.ts`); place-page map screenshots unchanged.

### TRP2b (Sonnet, after API-3)

7. **Legs with geometry (D-E5).** Generalise `legs-ors.mjs` to any trip with a schedule: pairs from the trip route model, not the prototype snapshot (Rockies and Dolomites today). Store `trip-legs/2` per trip (`data/schedules/legs/<trip>.json`): `from`, `to`, `profile`, `mode`, `km`, `minutes`, and `geometry` as an encoded polyline (precision 5, simplified to about 30 m), with the ORS and OSM attribution. Sequential, at most 28 requests a minute, only missing pairs, `--check` exits 1 on a missing pair, the key read from the environment or the env file and never printed. Report the leg count and file size per trip (target under 200 KB a trip).
8. **The map reads legs** through API-3's `tripLegs(slug)` client method when it mounts, not through `getTrip`. A leg with geometry draws solid; one without stays dashed with the label. The ODbL credit "Route geometry © OpenStreetMap contributors" shows on the map when a routed leg is drawn.
9. **Export trip** (Q46, P7) in the plan bar and at the page top: print (the browser's print and PDF from the page's print view, rendered from the `json` model), the calendar file for a dated copy (existing), CSV, KML or GPX of the route. The export carries every day, times, places with links, booking windows, sources and "Not checked yet" where a value is missing; the profile and overrides chosen on the page are what is exported; no household data. The export menu code loads on open (start JS net zero).
10. **Tests.** Each format parses (ICS with VTIMEZONE, KML and GPX valid XML with the routed geometry, CSV with a header, `print` is text); the privacy scan over each export; legs `--check` in the unit tests (no network).

## Acceptance checks

| # | Part | Check |
|---|---|---|
| 1 | a | Rockies day 8 on Google with the env file in place: roads and names, numbered pins in day order, estimates dashed with the label |
| 2 | a | Scrolling to day 9 fits day 9; Fit and All days work; hover ring and pin-click scroll work |
| 3 | a | Without a key the page builds and shows MapLibre (check-all runs without the env file) |
| 4 | a | One family per page (`families.test.ts`); place-page maps unchanged (screenshot pair) |
| 5 | a, b | The trip page's start JS is not larger than on `main` before the lane |
| 6 | b | Rockies and Dolomites legs fetched with geometry; `legs-ors.mjs --check` green; routed legs solid, estimates dashed; the ODbL credit visible |
| 7 | b | Each export opens; gaps shown as "Not checked yet"; no household data; contract cases K20, K21 and K27 still green |
| 8 | a, b | The hard-coding scan finds no new literal (colours, hosts) |
| 9 | a, b | Screenshots at 1440 and 390, light and dark: Rockies day 8, Rockies day 9, Dolomites day 3, the map key, a place page map (a), the export menu and the print view (b) |
| 10 | a, b | `git diff --name-only` shows only owned paths |

## Server switch

The map reads trip stops from the route model `getTrip` serves and legs from `tripLegs(slug)` (`GET /api/v1/trips/{slug}/legs/`); routed legs later come from the server's `leg_cache` (laundry list item 34) in the same leg shape. `loadExport(type, slug, format, profile)` calls `GET /api/v1/export/trip/{slug}?format=&p=`, which calls `CatalogueStore.getExport()` with the pure builders in `core/src/export/`. A proposed `PostgresStore` (SRV-0, not implemented) passes the same cases, including the privacy scrub. URLs (`p`, `split`, `#day-N`) and components do not change on the switch.

## Verification

`pnpm --dir web typecheck`, lint, unit tests, your trip and export specs only, `PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside (mode 600) and restored; then one build with the env file in place to check the Google family (never print the key). Playwright screenshots at 1440 x 900 and 390 x 844, light and dark, set through the site's theme control, on the project's `GPU_ARGS` (on macOS `--use-angle=metal`), into `web/test-results/shots/TRP2a/` and `TRP2b/`, read in tiles. Never touch ports 3440 (preview 1) or 3476 (M1). Then `travel-design-reviewer`, then `travel-verifier`.

## Commit rules

- TRP2a: `git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-TRP2a -b public/TRP2a main`, then `pnpm install --frozen-lockfile` at the worktree root; port 3477. TRP2b: worktree `v2-TRP2b`, branch `public/TRP2b`, port 3480.
- Commits: `docs(v2): Google trip map note (TRP2-N)`, `web(public/TRP2a): Google trip route map (9.5)`, `data(TRP2b): routed legs with geometry`, `web(public/TRP2b): routed legs and Export trip (9.5, 9.6)`.
- Owned paths only with `git -C <worktree> add <paths>`, never `-A`; end each message with the Co-Authored-By trailer; rebase onto `main` (and onto REF1 for TRP2a if it merged meanwhile); do not push.

## Hand-back

Commits; the model per part; the Google map load count per page view (for the quota); routed against estimated leg counts per trip; legs file sizes; the trip page start JS before and after; export sizes per format.
