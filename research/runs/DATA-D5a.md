# DATA-D5a: licensed photos for the five R2 trails and the Rockies plan-day stops (25 Oct 2026)

Branch `public/DATA-D5a` (worktree `v2-DATA-D5a`, from `main` 21d32c8). Model: Claude Sonnet 5.5 (`claude-sonnet-5-5`); the coordinator's Opus pass
samples the picks. Run record: `data/capture/runs/api-2026-10-25-data-d5a-photos.json` (`capture.ts run --check` OK).
Rows: DATA.md steps 8 and 9, PHASE-E-START 6.5 row 8 (R2 script step 6, photos).

## Result

| | Count |
|---|---|
| R2 trails with photos | **5 of 5**, two each: Fenland Loop, Johnston Canyon walk, Larch Valley, Tre Cime di Lavaredo loop, Lake Agnes Tea House |
| Plan-day stop records with a photo | 68 records (58 picks; Bourgeau Lake reused its payoff record's two files), 110 photo entries, 107 distinct files |
| Plan-day stop records with no licensed photo | 4: Troll Falls, Canmore Nordic Centre, Rockwall Lookout, Miette Mine trail (dated, with what was tried, in `DATA-D5a/photo-picks.json` `gaps` and as `searched_none` in the run record) |
| Stops with no capture record (not a target) | 6: bear spray and groceries, Sunshine gondola, Saskatchewan Crossing, Jasper errands, icefield lunch, Canmore groceries |
| Licences | CC BY 2.0, 3.0, 4.0; CC BY-SA 2.0, 3.0, 4.0; CC0 (3); public domain (2). No NC, ND, Unsplash, Pexels or Flickr-direct file. Files whose title or description says Unsplash or Pexels were filtered out (Commons re-hosts some as CC0) |
| Width | every pick is at least 1,612 px (the smallest, the Banff Gondola cable car, is 1,612) |
| `gaps --tier required` photos cell | place 21 to 43, trail routes 0 to 38 (33 of them trail types), offers 0 to 8 (`research/runs/DATA-D5a/after-tier-required.json`) |

Gap reports. `gaps --placement` is unchanged by this batch (D5a writes no point), so before and after are both
`research/runs/DATA-D1b-points/after-placement.json` (checked byte-identical with `cmp`, both before and after the run). `gaps --tier required`
before is `research/runs/DATA-D1b-points/after-tier.json` (byte-identical to the one I took at the start); after is `DATA-D5a/after-tier-required.json`;
the only differences are the four `photos` cells above. `gaps --budget --check`: no count rose (`W_TIER_REQUIRED` stays 385 records, 3,875 keys;
photos are an A property, so no required key moved). Nothing was lowered.

## Where the photos are written (decision)

The brief names `data/capture/<trip>/PH.json`. A second record for a ref that `migrated.json` or `CS7.json` already holds fails
`E_CAP_DUP_REF`, and every target ref is already in one of them (the same finding as D4a decision 1). So the `photos` array went **into the
existing records, in place**: `data/capture/canadian-rockies-2029/migrated.json` (67 records), `.../CS7.json` (the Larch Valley part record) and
`data/capture/dolomites-2027/migrated.json` (the Tre Cime loop). Only `photos` was added; the diff shows no other change except trailing commas.
No `PH.json` or `R9-PH.json` exists. Reversible: `git revert` the data commit. D3a and D4a also edit `migrated.json`, in other records; the hunks
are separate and should merge line by line. The `photo` schema (`core/src/schema/capture/records.ts`) is strict (file, licence, author,
attribution, source_url, width, height), so the checkable detail (query, point, distance, geotag, taken date, subject check) sits beside it in
`research/runs/DATA-D5a/photo-picks.json`.

## Method

1. Scope: the five R2 trails first, then every capture record the Rockies schedule names (`data/schedules/canadian-rockies-2029.json`, 73 stop ids, 68
   matched records; refs resolved from `targets.json`, the schedule ids matched to refs by their last path segment).
2. Search, one Commons request at a time, sequentially, 2 s between requests, under `flock /tmp/travel-commons.lock`, user agent
   `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. `tools/gallery/gallery_find.py` was not used as it is: it only does text search,
   uses the old user agent `nks-travel-gallery/1.0`, and keeps no lock. I used a small cached client with the same filters (jpeg, landscape,
   width at least 1600, licence regexp from `gallery.py`) and the shared lock: `research/runs/DATA-D5a/cm.py`, `run_geo.py`, `textrun.py`, `sheet.py`.
   Because `tools/**` is off limits to this batch, the geosearch support is a request for a builder (below).
3. 62 geosearches (list=geosearch, 1,000 m around the record point or its payoff part, namespace 6, up to 50 files), then imageinfo in batches of 50
   (size, mime, licence, author, description, date), one imageinfo per geosearch. Where the 1 km answer held no file of the place (a point at a
   trailhead 3 km from the payoff, a point that names a car park), 33 text searches followed (list=search, namespace 6, limit 40, then imageinfo and
   coordinates in batches of 50). 640 Commons requests in total (242 API, 398 thumbnail downloads for 400 px contact sheets), 15 of them answered
   `cirrussearch-too-busy-error` (Commons' search backend, not rate limiting; retried after 30 s, 60 s, ...). **No 429.** The full log with times is
   `research/runs/DATA-D5a/commons-calls.log` (one request at a time: the timestamps never overlap).
4. Contact sheets (9 thumbnails each, 400 px) for every stop, viewed one by one; a pick must show the stop or its payoff, in summer or early
   autumn, without people in the foreground and without watermarks. Rejected on sight: winter views (Troll Falls, Grassi Lakes winter files, Highwood
   summit sign), lookalikes, close-ups of animals or bench views, and files with crowds.
5. Licence, author and width come from the file's own metadata. After writing, all 107 distinct files were fetched again fresh (not from the cache,
   `verify.py`, `verify-fresh-2026-10-25.json`): 0 mismatches in licence, author or width against what the record holds.

## Sample check (16 re-opened, 16 pass)

Re-fetched the metadata and the file's non-hidden Commons categories for 16 picks across all trips and read the category names against the stop:
Fenland (category Footbridges in Alberta, Banff), Johnston Canyon Lower Falls (Johnston Canyon waterfalls), Larch Valley (Larix lyallii, Hiking trails in
Banff NP, September 2016), Tre Cime from Rifugio Locatelli (Dreizinnenhütte, Tre Cime di Lavaredo), Lake Agnes Tea House (Lake Agnes Tea House),
Upper Hot Springs bath house, Lake Minnewanka boat pier, Emerald Lake canoes (Canoes in British Columbia, Emerald Lake), Parker Ridge (Saskatchewan Glacier),
Sulphur Skyline (Mountains of Alberta only: weak, see below), Paint Pots ochre pot (Kootenay NP), Storm Mountain from Highwood Pass (Peter Lougheed PP),
Overlander Falls, Elk-Wapiti (Animals of Banff NP), Lake Annette (Annette Lake (Alberta)), Milky Way over The Whistlers (Jasper NP). Licence and
author matched the record on all 16, and the sheets I looked at before picking showed the same subject. Pass: 16 of 16 on licence, 15 of 16 on a
confirming category (Sulphur Skyline has only a geotag 0.4 km from the trail's payoff point and the title as proof).

## Weak picks for the Opus pass to look at first

- **No geotag, subject from title, description and categories only (18 files):** Larch Valley x2, Wilcox Pass icefield view, Overlander Falls Fraser River,
  Miette x2, Parker Ridge glacier, Ha Ling x2, Grassi falls, Rawson Lake, Bald Hills x2, Elk x2, Paint Pots (Kootenay Paint Pots.jpg), Lake Annette,
  Milky Way.
- **Miette Hot Springs:** the two files show the spring source and the trail to the spring head, not the pools (no licensed pool photo exists on Commons).
- **Lake Annette:** one pre-fire file (2017) and one after the 2024 wildfire (June 2025). Kept both so the page does not promise unburnt forest.
- **Rawson Lake:** the only usable file is an October snow-dusted state; a September visit may be snow-free.
- **Sarrail Ridge:** the view over Upper Kananaskis Lake with Mount Indefatigable is the file D5 already put on the payoff record; I cannot prove it was taken
  on the ridge itself.
- **Sunshine Meadows to Citadel Pass:** shows Rock Isle Lake and the meadows; no licensed Citadel Pass file exists.
- **Elk rut viewing:** generic Banff elk photos, not a rut-viewing spot.
- **Mary Schaffer Loop, Moose Lake loop, Bald Hills:** lake and ridge views from the same Maligne Lake area; none shows the trail surface.
- **Maligne Lake cruise:** Spirit Island (the cruise's destination) is 14 km from the record's point (the dock); the file's geotag is on the island.
- **Credit text:** 12 files (13 entries) from one Flickr uploader carry the author string "Thank you for visiting my page from Canada" (or "... from Calgary, Canada"),
  which is what Commons holds in the Artist field. Recorded exactly as the metadata has it; the attribution line reads awkwardly on a page.
  The Opus pass may prefer to map it to the uploader's account name, but I did not look it up.
- **Highwood Pass:** the file was found in the Ptarmigan Cirque search (its point is 0.6 km from the pass point), 970 m from that centre.
- **Emerald Lake:** the same Mount Burgess file is on both the canoe and the lakeshore record.

## DECISIONS NEEDED

1. **Photos in place, not in `PH.json`** (above). Safe default taken. Owner or coordinator: confirm, or have a builder add a `searched_none` form for
   `photos` (a dated gap has no home in the strict `photo` schema, so the four dated gaps live in the run record and `photo-picks.json` only).
2. **The "Thank you for visiting my page" author strings.** Keep exactly, or map to the uploader's account name? Needs a decision before the pages
   show credits.
3. **Wrong-season files.** Troll Falls has only winter or frozen-fall files, so it has no photo; the rule says wrong season is rejected "unless the
   point is weather". The owner may prefer a winter photo over none.

## Requests for a builder

- `tools/gallery/gallery_find.py`: add a geosearch mode, take the lock `/tmp/travel-commons.lock`, use the `travel-relevance-signals/1.0` user agent,
  drop `Unsplash` and `Pexels` file titles and descriptions, and cache search errors (an `error` body is not a result).
- Warm the image renditions in one sequential run after the merge (see below). New files: 107 Commons files, hotlinked, none copied.

## Coordinator

- **Image renditions need one sequential warm-up run** (the `prebuild` step since API-0) before any build; 107 new files.
- `node web/scripts/fetch-photo-credits.mjs` needs one run for the new files' credits (`web/data-snapshots/photo-credits.json`), one request at a time.
- The `data-snapshots` and any place-page snapshot that lists photos are stale until `pnpm --dir web snapshot` runs.
- Merge `public/DATA-D5a` after D3a and D4a; the three branches edit different records of `migrated.json`.

## Files

- `data/capture/canadian-rockies-2029/migrated.json`, `.../CS7.json`, `data/capture/dolomites-2027/migrated.json` (photos in place)
- `data/capture/runs/api-2026-10-25-data-d5a-photos.json`
- `research/runs/DATA-D5a/photo-picks.json` (every pick with file page URL, author, licence, width, found-by query, distance, geotag, subject check; the gaps; the 95 queries)
- `research/runs/DATA-D5a/{cm,run_geo,textrun,sheet,kw,apply,verify}.py`, `picks.json`, `batch.txt`, `textq-second-batch.txt`, `commons-calls.log`,
  `verify-fresh-2026-10-25.json`, `after-tier-required.json`
