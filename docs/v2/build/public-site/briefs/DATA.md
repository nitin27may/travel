# DATA: the phase E research batches D1 to D5 (points, locations, trail facts, activities, photos)

Extends [CS7d.md](CS7d.md) (stage 4 data lane). The research pause is lifted for this work (owner, 20 Oct 2026).

- **Agent:** `travel-researcher` (Opus), one batch per hand-back.
- **Effort:** D1 points 6 h, D2 locations 4 h, D3 trail facts 10 h, D4 activities 8 h, D5 photos 10 h, D6 basics 6 h (agent time).
- **Rows:** D1: 8.8, 10.5, Q58, 3.47e, 3.61c, 3.61d, ST-1 (Rockies base points against Wikidata). D2: 8.7. D3: 10.2, 3.47b, 3.47c, RB-3. D4: 13.5 activity part, 3.53 part, 3.61a, 3.61f, 3.61g, RB-1, the operator questions. D5: 10.4. D6: 3.9, 3.10, 3.53 (usable basics). Lines in [COVERAGE.md](../COVERAGE.md).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) sections 6 (tiers and acceptance numbers) and 14 (order, counts, request volume); tasks E4 to E8. Schema and gap reports: [META.md](META.md).
- **Principles:** T1, T3, T4, T5, P8. **A gap is never a yes.**
- **Starts:** D3, D4 and D6 after META-0 (during phase B: data only, no API dependency); D1 after META-1; D2 after D1 (the Wikidata runner is free); D5 after D1 (Commons geosearch needs points). The data is served through `JsonStore` and the API without any change to its shape.
- **Review:** travel-verifier; the stage 5 run 2 check 5.3 samples 80 values across D1 to D5.

## Goal

Every public page has a sourced point with its role or a dated search that found none; every trail carries its facts, link set and a photo or an honest gap; every activity says where it happens, who runs it, when, for whom and how to book; the locations store meets its required tier.

## Read first

- EXECUTION-PLAN 6.2 to 6.5 and 14.
- `node core/bin/capture.ts fields --type <id>` for every type you touch; `capture.ts gaps --placement --trip <t>` and `gaps --tier required --trip <t>` (META-0).
- `research/capture-research-backlog.md`, `research/method/operator-questions-2026-10-18.md`, `research/runs/CS7d-notes.md`.
- `tools/gallery/gallery_find.py` and `gallery_pick.py` (cached, one request per query, contact sheets).

## Rules for every batch

- **Sequential external calls**, one runner per service across all agents: `flock /tmp/travel-overpass.lock`, `/tmp/travel-wikidata.lock`, `/tmp/travel-commons.lock`; at least 10 s between Overpass queries; the user agent from the one UA module (`travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`), never an email.
- **Links only:** AllTrails, Google, Tripadvisor, Komoot. Never a value or a coordinate from them. Coordinates never from Google.
- **No household data** in any file. No values from memory: every value has a source row, the date read and a basis.
- **Every record you touch** leaves with its placement block and its required tier answered or `searched_none` with a date; the hand-back includes `gaps --placement` and `gaps --tier required` for each trip.
- **Stable ids:** never rename a `ref`; duplicates are `same_place_as` on the second record.
- Each batch writes its own lane files, so batches can run side by side: D3 `data/capture/<trip>/TF.json` and `data/suitability/<trip>/TF.json`; D4 `data/capture/<trip>/AC.json`, `data/suitability/<trip>/AC.json`, `data/capture/operators.json`; D5 `data/capture/<trip>/PH.json`; D1 `data/capture/points.json`. One run record per API run in `data/capture/runs/`.

## Files you own

`data/capture/points.json`, `data/capture/<trip>/{TF,AC,PH}.json` (new), `data/capture/operators.json`, `data/capture/runs/**`, `data/suitability/<trip>/{TF,AC}.json` (new), `data/locations/locations.json` through `python3 tools/locations.py edit` only, `data/capture/gap-budget.json` (lower only), `research/method/lanes/DATA-notes.md` (new), `research/method/operator-questions-2026-10-18.md`, `research/capture-research-backlog.md`.

## Do not touch

`web/**`, `core/**`, `tools/**` (D2's validate warnings are part of this brief only as a request: the `tools/locations.py` change is one function, listed in the hand-back for a builder), `data/vocab/**`, `data/schedules/**`, `data/trips/**`, generated files, `legacy/**` (read only).

## Steps

### D1: points (after META-1)

1. From `gaps --placement`: the pages still without a point (about 95 to 100 after the join fix). For each: Wikidata P625 by QID if linked, else a Wikidata name search within the area; then OSM through Overpass by name inside the area bbox (trailheads: `highway=trailhead`, route relation start; lakes and falls: the feature node or way centroid). Record `point_role`, the source row and `point_checked`.
2. Anything still not found: `searched_none` with the date and what was tried. Mark a centroid or guess `approx: true` with a note.
3. Fix the `E_PLACE_FAR` hits META-1 listed. Also: destination points for Fanes, Pordoi, Cinque Torri, Fiscalina, Vallunga and Federa (3.47e); the Waterton marina point (3.61c); mark the elk rut point `approx` at area level (3.61d); check the Rockies base points that differ from Wikidata (Kananaskis about 2 km, Lake Louise about 4 km) and record which source wins and why (ST-1).

### D2: locations store (after D1)

4. The required tier for all 74: area chain (present), point with role (1 missing), nearest town (derived by META-2), kind, source, Wikidata QID where one exists (8 missing), elevation from Wikidata P2044 where it exists (42 missing) as enrichment. Through `locations.py edit`. Report the enrichment tier per place.

### D3: trail facts (after META-0)

5. For the 122 trail pages (gaps: distance 44, gain 45, time 48): first the 12 confirmed OSM tracks (computed, no request), then the official park or operator page (Parks Canada, NPS, the Dolomites park pages), then a marked estimate. Fill shape, surface, dogs, stroller, wheelchair and season where the page states them; `none_stated` where it is silent.
6. Link set per trail: official state, OSM state, AllTrails direct URL only where an official page or a person links it (otherwise the page builds the search link).
6b. Track and draw fixes: show the Seekofel gain as a conflict with both sources (3.47b); take the Tre Cime stale second line (path 104, empty geometry) out of the export set (3.47c); move the Tre Cime and Larch Valley draw to the payoff place through the Q41 supersede override (RB-3).

### D4: activities (after META-0)

7. Also the Waterton shuttle fare one-way or return (3.61a), the Jasper bike prices read in a browser (3.61f), and CS7d batch B (activity ages and weights, the 2 meeting points, the 2 two-operator records, the 7 river and non-Rockies parts; 3.61g); Kicking Horse put-ins as an operator question (RB-1). For the 49 offers: where it happens (`at`, `on` or `starts_at`; 17 have none), operator (`run_by`; 37 missing), season, duration, price, minimum age, height and weight as stated or `none_stated`, booking window and URL, meeting point, accessibility. One page read per operator where possible. New operator questions go into the operator questions file.

### D6: trip and stop basics (after META-0)

10. Seasons for the 6 trips that show "season not set yet", from the plan's own months or the main sights' access seasons, saying which (3.9).
11. The 34 texts the dateless rule drops, rewritten as relative wording in the data that feeds the adapter (3.10); any that live in a legacy plan file are listed for the coordinator, not edited.
12. Summaries and seasons for the anchors and trip stops of the public trips, so `usable` means something (3.53); report the new level distribution.

### D5: photos (after D1)

8. Trails first (118 without a photo), then activities, then every stop on a public trip day, then the rest. Commons geosearch around the point (1 km), then imageinfo in batches of 50; contact sheets; pick one or two with width at least 1600, licence and author recorded. None suitable: "No licensed photo yet" with the search date.
9. After each photo batch, tell the coordinator so the image cache is warmed in one sequential run before any build.

## Acceptance checks

| # | Check |
|---|---|
| 1 | EXECUTION-PLAN 6.5 rows 2, 3, 5, 6 to 10 and 12 met, or each miss listed with a reason |
| 2 | `bash tools/check-all.sh` passes; `gap-budget.json` only went down |
| 3 | Every new value has a source row, a date and a basis; 0 values from link-only platforms |
| 4 | Run records show no overlapping calls to one service |
| 5 | No household data in any file you wrote |

## Server switch

Data only. Every record keeps its stable `ref`, its file schema version and per-value provenance, so the same JSON loads into the catalogue tables of `docs/v2/schema.sql` without reshaping (laundry list item 17), and a crawler job later writes the same lane-file shape through the API (item 18).

## Verification

`node core/bin/capture.ts build --check`, `node core/bin/sources.ts check`, `python3 tools/locations.py validate` and `build --check`, `node core/bin/capture.ts gaps --placement --json` and `--tier required --json` before and after, then `bash tools/check-all.sh` with `web/.env.local` moved aside and restored. No screenshots (no UI); the verifier checks five pages per batch on the preview.

## Commit rules

Worktree per batch: `/home/nitin27may/workspace/travel-wt/v2-DATA-D1` (branch `public/DATA-D1`) and so on, from `main`. One commit per step: `data(DATA-D1): ... (<row>)`; notes in a `docs(v2):` commit. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; do not push. The coordinator regenerates `data/sources/registry.json` at merge.

## Hand-back (per batch)

Commits; counts before and after for the batch's rows of 6.5; the gap reports (JSON); the run records; new operator questions; any adapter request for PLC2, LST2 or TRP2.
