# DATA: the phase E research batches D1 to D6 (points, locations, trail facts, activities, photos, basics)

> **Status check, 25 Oct 2026 (main 467ec00; supersedes the dated notes below where they differ).**
> Verified with `capture.ts gaps --placement`, `gaps --tier required` and `gaps --budget --check` (budget OK, no count rose).
>
> - **No DATA batch has started.** No `v2-DATA-*` worktree and no `public/DATA-D*` branch exist. The old `public/DATA1` branch is the 19 Oct plumbing lane (merged), not D1.
> - **Preconditions are met:** META-1, META-2, API-3, HYG and TRP2b are on `main`. D1 can start now. D5a waits for D1; D2 waits for D1 and is after R2.
> - **Current numbers.** Records with no point: 84 (Rockies 53, Patagonia 8, Chamonix 6, Utah 6, Iceland 5, Algonquin 3, Vermont 2, Dolomites 1). Records with no area: 283 of 394. Offers that say nowhere (D4a): 17, all Rockies. Required tier complete: place 7/196, trail 1/118, other route 0/25, offer 1/46, event 0/1, stay 0/8. Budget now: W_PLACE_POINT 84, E_PLACE_ORPHAN 17, W_TIER_REQUIRED 385, W_PLACE_TOWN 0.
> - **Trip ids in `data/capture/` differ from the research folders:** `canadian-rockies-2029`, `dolomites-2027`, `chamonix-mont-blanc-2028`, `iceland-ring-road-2027`, `patagonia-2027`, `algonquin-muskoka-2026`, `vermont-fall-2026`, `utah-five-parks`. Use these with `--trip`.
> - **New research not yet in the plan** (committed 25 Oct): `research/trips/dolomites-july-2027/` `coverage-audit.md`, `stays.md`, `stays-august.md`, `hut-trek-options.md`, `italy-extension.md`. Prose research only. Turn it into capture records through the `research` skill, and read `coverage-audit.md` first for the Dolomites gaps.
> - **Not related to this brief:** the Neon account work, Vercel setup (R-61) and the data-layer cutover. Data files stay the source of truth until `PostgresStore` exists.
> - **Owner request 25 Oct (basics for every location, wider photo sources, easy adding):** specified in [DATA-LOC.md](DATA-LOC.md) (PLAN R-68, BACKLOG 3.68). It widens D5's photo sources and extends D2 and D3.
> - **Copy-paste prompts per batch:** [DATA-AGENT-PROMPTS.md](DATA-AGENT-PROMPTS.md).
> - **New batches, 25 Oct (owner request: best time to go, trip overview, thumbnails):** D7 best-time windows (D7-R Rockies first, then 13 trips), D8 overview facts (access season per item, booking needed, durations, effort), D5b thumbnails for all 118 trails. Spec and the measured gaps: [trip-overview-and-customisation.md](../../../features/trip-overview-and-customisation.md) sections 2 and 8. BACKLOG 15.56; PLAN R-67.

Extends [CS7d.md](CS7d.md) (stage 4 data lane). The research pause is lifted for this work (owner, 20 Oct 2026).

> **Revised 21 Oct (start sheet).** [PHASE-B-START.md](../PHASE-B-START.md) decision D-B8: D3, D4 and D6 now start **after gate G-B**, not during phase B, because they are Opus research and the weekly usage allowance is nearly spent (owner may override: B-2). Changes in this brief: run notes go to `research/runs/` (the research home, CLN-1); paths `research/method/...` and `research/backlog.md`; the `point_role` values and the town id format are the ones META-0 defines (`POINT_ROLE`, `ca-on-whitby`); every `src` must resolve to a registry id because the API emits registry ids only (D-B4); refs never change and slugs are pinned (D-B1); the Haiku model for mechanical checks; macOS paths and the venv for pytest.

> **Revised 23 Oct (phase E start sheet).** [PHASE-E-START.md](../PHASE-E-START.md) runs the batches after the 25 Oct usage reset and only as the allowance allows, and splits them into a **minimum viable data set for R2** (section 9 there, about 20 h of Opus) and the rest, which moves to the readiness checklist (owner decision Q90). Before R2: **D1** in full (Wed 28 to Thu 29 Oct, after META-1), **D6a** seasons for the 6 trips only (Fri 30 Oct), **D3a** trail facts for the Rockies trails on the plan's days and the five R2 trails `fenland-loop`, `johnston-canyon-walk`, `larch-valley`, `tre-cime-di-lavaredo-loop`, `lake-agnes-tea-house` (Sat 31 Oct), **D4a** where every offer happens (the 17 without a place) plus the Rockies offers on the plan's days (Sun 1 Nov, after the second reset), **D5a** photos for the five R2 trails and the Rockies trip-day stops (Mon 2 Nov). After R2: D2, and the rest of D3 to D6. Worktrees and branches are per batch (`v2-DATA-D1`, `public/DATA-D1`; `v2-DATA-D3a`, `public/DATA-D3a` and so on). Rules added: refs are opaque `place/<slug>` for wishlist places once REF1 merges (never write a `loc:` key); a batch that would push the place-size median over +25% commits the over-budget records on its branch unmerged and lists them for the owner's R2 ruling (D-E8, Q88); researchers work through the `research` skill (`.claude/skills/research/SKILL.md`, which points into `research/README.md`), places through the `location` skill (`.claude/skills/location/SKILL.md`), never the retired `trip-planner`; a trip is data, never a legacy page (`legacy/**` is frozen). Paths on this Mac: the method in `research/method/`, the per-type checklists in `research/types/` (generated, never edited), run notes in `research/runs/`, the research backlog in `research/backlog.md`. EXECUTION-PLAN E3 still names `research/method/lanes/DATA-notes.md`; the run notes go to `research/runs/DATA-<batch>-<trip>.md`.

- **Agents and models:** `travel-researcher` on **Opus**, one batch per hand-back (research that needs judgement). Mechanical follow-ups inside a batch (counting gaps, re-running the gap reports, checking that every `src` resolves, run-record overlap checks) go to a **Haiku** `explorer`. `travel-verifier` (Sonnet) per batch. Record the model in each hand-back.
- **Effort:** D1 points 6 h, D2 locations 4 h, D3 trail facts 10 h, D4 activities 8 h, D5 photos 10 h, D6 basics 6 h (agent time). Added 25 Oct: D7 windows 20 h (D7-R 4 h, the other 13 trips about 16 h), D8 overview facts 16 h (D8-R 8 h), D5b thumbnails 12 h (2 h Haiku `gallery_find` runs, 10 h Opus picks).
- **Rows:** D1: 8.8, 10.5, Q58, 3.47e, 3.61c, 3.61d, ST-1 (Rockies base points against Wikidata). D2: 8.7. D3: 10.2, 3.47b, 3.47c, RB-3. D4: 13.5 activity part, 3.53 part, 3.61a, 3.61f, 3.61g, RB-1, the operator questions. D5: 10.4. D6: 3.9, 3.10, 3.53 (usable basics). Lines in [COVERAGE.md](../COVERAGE.md).
- **Plan:** [EXECUTION-PLAN.md](../EXECUTION-PLAN.md) sections 6 (tiers and acceptance numbers) and 14 (order, counts, request volume); tasks E3 to E7b. Schema and gap reports: [META.md](META.md). Phase B order and the reason for the move: [PHASE-B-START.md](../PHASE-B-START.md) sections 2 and 5.
- **Principles:** T1, T3, T4, T5, P8. **A gap is never a yes.**
- **Starts:** D3, D4 and D6 after G-B (META-0 merged by then; data only, no API dependency). D1 after META-1; D2 after D1 (the Wikidata runner is free); D5 after D1 (Commons geosearch needs points). The data is served through `JsonStore` and the API without any change to its shape.
- **Review:** travel-verifier; the stage 5 run 2 check 5.3 samples 80 values across D1 to D5.

## Goal

Every public page has a sourced point with its role or a dated search that found none; every trail carries its facts, link set and a photo or an honest gap; every activity says where it happens, who runs it, when, for whom and how to book; the locations store meets its required tier.

## Read first

- EXECUTION-PLAN 6.2 to 6.5 and 14.
- `node core/bin/capture.ts fields --type <id>` for every type you touch, and the generated checklist `research/types/<domain>.md`; `capture.ts gaps --placement --trip <t>` and `gaps --tier required --trip <t>` (META-0).
- [research/README.md](../../../../../research/README.md) (the map), [research/backlog.md](../../../../../research/backlog.md), [research/method/operator-questions-2026-10-18.md](../../../../../research/method/operator-questions-2026-10-18.md), [research/runs/CS7d-notes.md](../../../../../research/runs/CS7d-notes.md), [research/method/capture-contract.md](../../../../../research/method/capture-contract.md) section 3.7 (META-0).
- `tools/gallery/gallery_find.py` and `gallery_pick.py` (cached, one request per query, contact sheets); [research/tools.md](../../../../../research/tools.md) for every script by its real path.

## Rules for every batch

- **Sequential external calls**, one runner per service across all agents: `flock /tmp/travel-overpass.lock`, `/tmp/travel-wikidata.lock`, `/tmp/travel-commons.lock`; at least 10 s between Overpass queries; the user agent from the one UA module (`travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`), never an email. The repo's fetch scripts take the lock themselves (`research/tools.md` names which). `flock` is not installed on this Mac (checked 21 Oct): for any call made outside those scripts, install it first (`brew install flock`) and say so in the run record; never call a service without the lock.
- **Links only:** AllTrails, Google, Tripadvisor, Komoot. Never a value or a coordinate from them. Coordinates never from Google.
- **No household data** in any file. No values from memory: every value has a source row, the date read and a basis.
- **Every `src` resolves to the source registry.** The API emits registry ids only (PHASE-B-START D-B4); a source row whose URL the registry build cannot match fails the contract kit. Use URLs the registry normaliser recognises.
- **Every record you touch** leaves with its placement block and its required tier answered or `searched_none` with a date; the hand-back includes `gaps --placement` and `gaps --tier required` for each trip.
- **Stable ids:** never rename a `ref`, including path-like refs such as `legacy/canadian-rockies-sept-2029/...`; duplicates are `same_place_as` on the second record. Never edit `data/catalogue/slugs.json`; a merged duplicate's slug is carried over by the coordinator with `slugs.ts alias`.
- **Point roles and towns:** `point_role` is one of `POINT_ROLE` (`centre`, `trailhead`, `entrance`, `parking`, `meeting`, `summit`, `route_start`); a town is named by its id `<cc>-<admin1>-<slug>` (`ca-on-whitby`).
- Each batch writes its own lane files, so batches can run side by side: D3 `data/capture/<trip>/TF.json` and `data/suitability/<trip>/TF.json`; D4 `data/capture/<trip>/AC.json`, `data/suitability/<trip>/AC.json`, `data/capture/operators.json`; D5 `data/capture/<trip>/PH.json`; D1 `data/capture/points.json`. One run record per API run in `data/capture/runs/`, with its prose note in `research/runs/<run-id>.md`.

## Files you own

`data/capture/points.json`, `data/capture/<trip>/{TF,AC,PH}.json` (new), `data/capture/operators.json`, `data/capture/runs/**`, `data/suitability/<trip>/{TF,AC}.json` (new), `data/locations/locations.json` through `python3 tools/locations.py edit` only, `data/capture/gap-budget.json` (lower only), `research/runs/DATA-<batch>-<trip>.md` (new, one per run), `research/method/operator-questions-2026-10-18.md`, `research/backlog.md`. Added 25 Oct: D7 `data/seasons/<trip>.json` (new folder, `trip-windows/1`) and `research/trips/<folder>/timing-windows.md`; D8 `data/capture/<trip>/OV.json` and `data/suitability/<trip>/OV.json`; D5b the same `PH.json` as D5 (never `data/capture/photo-overrides.json`, which is the owner's).

## Do not touch

`web/**`, `core/**`, `tools/**` (D2's validate warnings are part of this brief only as a request: the `tools/locations.py` change is one function, listed in the hand-back for a builder), `data/vocab/**`, `data/schedules/**`, `data/trips/**`, `data/catalogue/**`, `data/capture/placement.json`, generated files (`research/types/**`, `data/schema/**`, `data/sources/registry.json`), `legacy/**` (read only; frozen), the Obsidian notes vault.

## Steps

### D1: points (after META-1)

1. From `gaps --placement`: the pages still without a point (about 95 to 100 after the join fix). For each: Wikidata P625 by QID if linked, else a Wikidata name search within the area; then OSM through Overpass by name inside the area bbox (trailheads: `highway=trailhead`, route relation start; lakes and falls: the feature node or way centroid). Record `point_role`, the source row and `point_checked`.
2. Anything still not found: `searched_none` with the date and what was tried. Mark a centroid or guess `approx: true` with a note.
3. Fix the `E_PLACE_FAR` hits META-1 listed. Also: destination points for Fanes, Pordoi, Cinque Torri, Fiscalina, Vallunga and Federa (3.47e); the Waterton marina point (3.61c); mark the elk rut point `approx` at area level (3.61d); check the Rockies base points that differ from Wikidata (Kananaskis about 2 km, Lake Louise about 4 km) and record which source wins and why (ST-1).

### D2: locations store (after D1)

4. The required tier for all 74: area chain (present), point with role (1 missing), nearest town (derived by META-2), kind, source, Wikidata QID where one exists (8 missing), elevation from Wikidata P2044 where it exists (42 missing) as enrichment. Through `locations.py edit`. Report the enrichment tier per place. Collections and Instagram saves stay private (owner Q75): do not add public fields to them.

### D3: trail facts (after G-B)

5. For the 122 trail pages (gaps: distance 44, gain 45, time 48): first the 12 confirmed OSM tracks (computed, no request), then the official park or operator page (Parks Canada, NPS, the Dolomites park pages), then a marked estimate. Fill shape, surface, dogs, stroller, wheelchair and season where the page states them; `none_stated` where it is silent.
6. Link set per trail: official state, OSM state, AllTrails direct URL only where an official page or a person links it (otherwise the page builds the search link).
6b. Track and draw fixes: show the Seekofel gain as a conflict with both sources (3.47b); take the Tre Cime stale second line (path 104, empty geometry) out of the export set (3.47c); move the Tre Cime and Larch Valley draw to the payoff place through the Q41 supersede override (RB-3).

### D4: activities (after G-B)

7. Also the Waterton shuttle fare one-way or return (3.61a), the Jasper bike prices read in a browser (3.61f), and CS7d batch B (activity ages and weights, the 2 meeting points, the 2 two-operator records, the 7 river and non-Rockies parts; 3.61g); Kicking Horse put-ins as an operator question (RB-1). For the 49 offers: where it happens (`at`, `on` or `starts_at`; 17 have none), operator (`run_by`; 37 missing), season, duration, price, minimum age, height and weight as stated or `none_stated`, booking window and URL, meeting point (`point_role: meeting`), accessibility. One page read per operator where possible. New operator questions go into the operator questions file.

### D6: trip and stop basics (after G-B)

10. Seasons for the 6 trips that show "season not set yet", from the plan's own months or the main sights' access seasons, saying which (3.9).
11. The 34 texts the dateless rule drops, rewritten as relative wording in the data that feeds the adapter (3.10); any that live in a legacy plan file are listed for the coordinator, not edited (`legacy/**` is frozen).
12. Summaries and seasons for the anchors and trip stops of the public trips, so `usable` means something (3.53); report the new level distribution.

### D5: photos (after D1)

8. Trails first (118 without a photo), then activities, then every stop on a public trip day, then the rest. Commons geosearch around the point (1 km), then imageinfo in batches of 50; contact sheets; pick one or two with width at least 1600, licence and author recorded. None suitable: "No licensed photo yet" with the search date.
9. After each photo batch, tell the coordinator so the image renditions are warmed in one sequential run (the `prebuild` step since API-0) before any build.

### D7: best-time windows (added 25 Oct; D7-R on the owner's go, the rest after OVR-Ca)

Spec: [trip-overview-and-customisation.md](../../../features/trip-overview-and-customisation.md) section 2 (the shape is 2.2, the method 2.3, the honesty rules 2.4, the Rockies questions 2.5).

13. **D7-R, the Rockies first** (`canadian-rockies-2029`, research folder `canadian-rockies-sept-2029`). Read `research/trips/canadian-rockies-sept-2029/timing-hazards.md`, `bookings.md` and the legacy `PLAN.md` (read only). Candidates: the plan's own window (second week of September, sun `[9, 8]` to `[9, 22]`, equal to `data/schedules/canadian-rockies-2029.json`), the first week of September, the last week of June, and the second or third week of June. Answer the questions of spec 2.5 from official, operator and climate sources (Parks Canada, Alberta Parks, the operators' season pages, Environment Canada normals, provincial school-year rules, holiday rules); sun times only from `node core/bin/sun.ts`. Keep 2 to 4 windows. Write `data/seasons/canadian-rockies-2029.json` to the spec 2.2 shape, prose findings to `research/trips/canadian-rockies-sept-2029/timing-windows.md`, the run record and `research/runs/DATA-D7-canadian-rockies-2029.md`. Until OVR-Ca lands the validator, check the file by hand against the 2.2 rule table and say so.
14. **D7, the other 13 trips** after OVR-Ca: the 7 trips with days (1.5 h each) and the 6 overview trips (1 h each, if Q99 is yes). Same method; a trip whose season is not set (D6a) gets its season months from the same research and says which.

### D8: overview facts (added 25 Oct; D8-R beside D3a and D4a, disjoint lane files)

15. **D8-R, the Rockies.** For every plan item and every Also-researched item (trails 62, sights 48, activities 43, bookings 33 in the legacy datasets): `access_season` (34 trails missing), the booking state normalised to book first / book ahead / on the day / none (`none_stated` with a source) / not checked, from the operator or park page, never by mapping the legacy free text in code (the legacy `booking_needed` values are mixed); `on_site_min` for sights (34 missing) and `duration_min` for activities (23 missing); the family effort grade for trails where a source grade exists (27 missing). Records go to `data/capture/canadian-rockies-2029/OV.json` and `data/suitability/canadian-rockies-2029/OV.json` keyed by the existing refs (never a new ref for an existing thing). Also fill each D7 window's `affects` list from the access seasons you find, as a request to the D7 owner if D7 is running.
16. **D8, the other 7 trips with days**, the same fields, after D8-R.

### D5b: thumbnails for every trail (added 25 Oct; after D1 merges, D5a's five R2 trails first)

17. All 118 trail records (Rockies 67, Dolomites 20, Utah 13, Patagonia 7, Iceland 5, Chamonix 3, Algonquin 2, Vermont 1), then every stop on a plan day, then the Also-researched items. A Haiku `explorer` runs `tools/gallery/gallery_find.py` per record under the Commons lock (mechanical; one runner for the whole machine, never beside another Commons agent); the Opus researcher reads the contact sheets and picks with `gallery_pick.py`. One photo is enough for a thumbnail; width at least 1200 for a hero, at least 640 for thumbnail-only (mark it). Licences: CC BY, CC BY-SA, CC0, public domain (NPS photos on US park trails are allowed as US government public domain, labelled). Never NC, ND or all rights reserved. None suitable: `searched_none` with the date and the search radius. Never write `data/capture/photo-overrides.json` (the owner's file). Flickr stays out unless the owner answers Q93 yes (then a separate batch D5f).

## Acceptance checks

| # | Check |
|---|---|
| 1 | Before R2 (revised 23 Oct): the rows of PHASE-E-START section 9 met (6.5 rows 2, 3, 5, 6, 11, 12; the five R2 trails; seasons for the 6 trips). After R2, for readiness: 6.5 rows 7 to 10 in full. Each miss listed with a reason |
| 2 | `bash tools/check-all.sh` passes (venv on `PATH`); `gap-budget.json` only went down |
| 3 | Every new value has a source row, a date and a basis; every `src` resolves to a registry id; 0 values from link-only platforms |
| 4 | Run records show no overlapping calls to one service |
| 5 | No household data in any file you wrote |
| 6 | No `ref` renamed; `node core/bin/slugs.ts --check` still green |
| 7 | The place-size test is green, or the over-budget records sit unmerged on the branch and are listed (D-E8) |
| 8 | D7: every trip file has 2 to 4 windows, every plus, minus, crowd and event entry has a registry `src` or an inference note, no calendar date (DATE_TEXT), the default window's `sun` equals the schedule's season; after OVR-Ca, the windows validator passes |
| 9 | D8: for the Rockies, every plan item has a booking state, an access season and a duration, or `searched_none` with a date; counts before and after per field in the hand-back |
| 10 | D5b: each of the 118 trail records has a photo or `searched_none` with a date; every photo's licence is on the allowlist; the Commons run records show no overlapping calls |

## Server switch

Data only. Every record keeps its stable `ref`, its file schema version and per-value provenance, so the same JSON loads into the source tier of the two-tier catalogue (owner Q73; schema diff section 11) without reshaping, and the serving tier is rebuilt by the same core code as `JsonStore`. A crawler job later writes the same lane-file shape through the API (laundry list item 18).

## Verification

`node core/bin/capture.ts build --check`, `node core/bin/sources.ts check`, `python3 tools/locations.py validate` and `build --check`, `node core/bin/capture.ts gaps --placement --json` and `--tier required --json` before and after, then `PATH=<venv>/bin:$PATH bash tools/check-all.sh` with `web/.env.local` moved aside and restored (PHASE-B-START section 1 names the venv; system `python3` has no pytest). No screenshots (no UI); the verifier checks five pages per batch on the preview.

## Commit rules

Worktree per batch: `/Users/nks/workspace/travel-wt/v2-DATA-D1` (branch `public/DATA-D1`; not `public/DATA1`, which the R1 fix round used) and so on, from `main`, then `pnpm install --frozen-lockfile` at the worktree root. One commit per step: `data(DATA-D1): ... (<row>)`; notes in a `docs(v2):` or `research(DATA-D1):` commit. Owned paths only with `git -C <worktree> add <paths>`, never `-A`; Co-Authored-By trailer; do not push. The coordinator regenerates `data/sources/registry.json` at merge.

## Hand-back (per batch)

Commits; the model used; counts before and after for the batch's rows of 6.5; the gap reports (JSON); the run records and their `research/runs/` notes; new operator questions; any adapter request for PLC2, LST2 or TRP2.
