# DATA batches: prompts for another agent or editor

Status 25 Oct 2026 at main 467ec00. The brief is [DATA.md](DATA.md); this file is what to hand to a second agent. Give one batch per agent. Run D1 first; D5a waits for D1. Batches write different files, so D3a, D4a and D6a can run beside D1.

## Common prompt (paste first)

You work in /Users/nks/workspace/travel (git repo, branch from `main`). Read, in order: CLAUDE.md, HANDOVER.md (top section), docs/v2/build/public-site/briefs/DATA.md (status block, rules, your batch), research/README.md, .claude/skills/research/SKILL.md. Use a worktree: `git worktree add /Users/nks/workspace/travel-wt/v2-DATA-<batch> -b public/DATA-<batch> main`, then `pnpm install --frozen-lockfile`.

Rules: data only (no web/, core/, tools/, legacy/). Every value has a source row, the date read and a basis; no values from memory. A gap is never a yes: write `searched_none` with the date and what was tried. AllTrails, Google, Tripadvisor and Komoot are links only, never data or coordinates. One external call at a time per service (Overpass, Wikidata, Commons locks; at least 10 s between Overpass queries; never search Commons from parallel agents). User agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`, never an email. No household data (party, ages, home town, booking state, stay ideas) in any file. Never rename a ref or edit data/catalogue/slugs.json. Never hand-edit generated files (data/schema/**, research/types/**, data/sources/registry.json). Every `src` must resolve to a registry id (`node core/bin/sources.ts check`). Use the trip ids from `data/capture/` (see the DATA.md status block). Commit owned paths only (`git add <paths>`, never -A), one commit per step, `data(DATA-<batch>): ... (<row>)`, Co-Authored-By trailer, do not push. Write a run note to research/runs/DATA-<batch>-<trip>.md.

Before and after, run and save: `node core/bin/capture.ts gaps --placement --json`, `gaps --tier required --json`, `gaps --budget --check`, `node core/bin/capture.ts build --check`, `python3 tools/locations.py validate`. The gap budget may only fall (`gaps --budget --write`). Finish with `bash tools/check-all.sh` (venv on PATH, web/.env.local moved aside and restored).

Hand-back: commits, model used, counts before and after, the JSON gap reports, run notes, new operator questions, anything you could not verify.

## D1: points (Opus researcher; do first)

Goal: every record with no point (84) gets a sourced point with `point_role` (centre, trailhead, entrance, parking, meeting, summit, route_start), or `searched_none` with date. Order: Wikidata P625 by QID, else Wikidata name search within the area, then OSM via Overpass by name in the area bbox (trailheads `highway=trailhead` or route relation start), then the land manager's page. Guesses and centroids are `approx: true`. Counts: Rockies 53, Patagonia 8, Chamonix 6, Utah 6, Iceland 5, Algonquin 3, Vermont 2, Dolomites 1. Also: destination points for Fanes, Pordoi, Cinque Torri, Fiscalina, Vallunga, Federa; the Waterton marina point; the elk rut point approx at area level; decide which source wins for the Kananaskis (about 2 km) and Lake Louise (about 4 km) base points, and say why. Files: data/capture/points.json, data/capture/runs/**. Then run `python3 tools/towns.py build` and `node core/bin/capture.ts derive-near --write` if points land in a new area.

## D6a: seasons and basics (Opus)

Goal: seasons for the 6 trips showing "season not set yet" (COVERAGE row 3.9), taken from the plan's own months or the main sights' access seasons, saying which. Then rewrite the 34 dated texts in the data feeding the adapter as relative wording (3.10); list any that sit in legacy files for the coordinator instead of editing them. Report the new usable-level distribution.

## D3a: trail facts (Opus)

Goal: distance, gain, time, shape, surface, dogs, stroller, wheelchair and season for the Rockies trails on the plan's days and five trails: fenland-loop, johnston-canyon-walk, larch-valley, tre-cime-di-lavaredo-loop, lake-agnes-tea-house. Source order: computed OSM tracks (no request), the official park or operator page, then a marked estimate. `none_stated` where the page is silent. Link set per trail: official, OSM; an AllTrails URL only where an official page or a person links it. Also: Seekofel gain as a conflict with both sources; take the stale Tre Cime second line out of the export set; move the Tre Cime and Larch Valley draw to the payoff place via the Q41 supersede override. Files: data/capture/<trip>/TF.json, data/suitability/<trip>/TF.json.

## D4a: activities (Opus)

Goal: for the 17 Rockies offers that say nowhere, set where it happens (`at`, `on` or `starts_at`) with a meeting point; then the Rockies offers on the plan's days: operator (`run_by`), season, duration, price, minimum age, height and weight as stated or `none_stated`, booking window and URL, accessibility. One page read per operator. Also the Waterton shuttle fare (one-way or return), Jasper bike prices, Kicking Horse put-ins as an operator question. Files: data/capture/<trip>/AC.json, data/suitability/<trip>/AC.json, data/capture/operators.json, research/method/operator-questions-2026-10-18.md.

## D5a: photos (Opus; after D1 is merged)

Goal: a photo for the five R2 trails and the Rockies trip-day stops. Use `tools/gallery/gallery_find.py` and `gallery_pick.py`: Commons geosearch around the point (1 km), imageinfo in batches of 50, contact sheets, pick one or two with width at least 1600, licence and author recorded. None suitable: "No licensed photo yet" with the search date. Commons calls run sequentially with no other agent on Commons. Tell the coordinator when done so renditions are warmed in one run. Files: data/capture/<trip>/PH.json.

## Dolomites prose to records (Opus, optional)

Source: research/trips/dolomites-july-2027/coverage-audit.md, stays.md, stays-august.md, hut-trek-options.md, italy-extension.md (all prose, committed 25 Oct). Turn confirmed facts into capture records through the research skill; keep unconfirmed items as gaps. Do not add stay ideas or booking state to any public field.

## D7-R: Rockies best-time windows (Opus; added 25 Oct, the pattern for every trip)

Read also: docs/v2/features/trip-overview-and-customisation.md sections 2 and 8, research/trips/canadian-rockies-sept-2029/timing-hazards.md and bookings.md, legacy/canadian-rockies-sept-2029/PLAN.md (read only). Goal: 2 to 4 windows for the 15-day Rockies trip, each a start week of a month (never a date), with at most 4 plus and 4 minus points, a crowd level, events written as rules (Labour Day weekend, Canada Day weekend, school-year end), the plan items that may be closed in the window (`affects`), and what you searched and did not find (`unknown`). Candidates: second week of September (the plan's own; sun [9, 8] to [9, 22], equal to data/schedules/canadian-rockies-2029.json), first week of September, last week of June, second or third week of June. Sources: Parks Canada, Alberta Parks, operators' season pages, Environment Canada climate normals, official visitation figures; sun times only from `node core/bin/sun.ts` (longitude positive east, so Banff is about -115.57). No crowd claim without a source or an inference note. Files: data/seasons/canadian-rockies-2029.json (new folder, the spec 2.2 shape), research/trips/canadian-rockies-sept-2029/timing-windows.md, research/runs/DATA-D7-canadian-rockies-2029.md, data/capture/runs/DATA-D7-*.json. The validator does not exist yet: check the file by hand against the spec's rule table and say so.

## D7: windows for the other 13 trips (Opus; after OVR-Ca lands the validator)

Same method and shape, one trip per hand-back or two small ones. Trip ids from the DATA.md status block; the six overview trips only if the owner answers Q99 yes. Run `node core/bin/validate.ts` (or the windows stage OVR-Ca adds) on each file.

## D8-R: Rockies overview facts (Opus; beside D3a and D4a)

Goal: for every Rockies plan item and every also-researched item, an access season, a booking state (book first, book ahead, on the day, none with a source, or not checked), a duration (sights `on_site_min`, activities `duration_min`) and, for trails, the family effort grade where a source grade exists. Normalise the mixed legacy `booking_needed` values by reading the operator or park page, never by mapping text. Keep existing refs. Files: data/capture/canadian-rockies-2029/OV.json, data/suitability/canadian-rockies-2029/OV.json, research/runs/DATA-D8-canadian-rockies-2029.md. Report counts per field before and after.

## D5b: thumbnails for all 118 trails (Haiku runs, Opus picks; after D1 is merged)

Goal: a photo or `searched_none` for every trail record (Rockies 67, Dolomites 20, Utah 13, Patagonia 7, Iceland 5, Chamonix 3, Algonquin 2, Vermont 1), then every plan-day stop. The Haiku agent runs `tools/gallery/gallery_find.py` per record under the Commons lock and nothing else; the Opus agent reads the contact sheets and picks with `gallery_pick.py`. Licences: CC BY, CC BY-SA, CC0, public domain (NPS US government photos allowed, labelled); never NC, ND or all rights reserved. Width at least 1200 for a hero, at least 640 for thumbnail-only (mark it). Never write data/capture/photo-overrides.json. No Flickr. Files: data/capture/<trip>/PH.json, research/runs/DATA-D5b-<trip>.md. Tell the coordinator when done so renditions are warmed in one run.

## Not in scope for these agents

R-61 Vercel setup, Neon child-branch tests, the PostgresStore cutover, anything in web/ or core/. Owner decisions are listed in HANDOVER.md.
