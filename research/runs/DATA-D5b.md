# DATA-D5b: licensed thumbnails for the remaining trail records (25 Oct 2026)

Branch `public/DATA-D5b` (worktree `v2-DATA-D5b`, from `main` 753bbcc). Model: Claude Sonnet 5.5 (`claude-sonnet-5-5`); the Opus pass reads the weak list below first.
Run record: `data/capture/runs/api-2026-10-25-data-d5b-photos.json` (`capture.ts run --check` OK). Ledger of every pick and gap: `research/runs/DATA-D5b/photo-picks.json`.

## Result: trail records (route layer, `nature.trail.*`, 118) with a photo, before and after

| Trip | Trails | Before | After | Dated gaps |
|---|---|---|---|---|
| Rockies | 67 | 32 | 57 | 10 (Solitaire is Algonquin, see below) |
| Dolomites | 20 | 1 | 20 | 0 |
| Utah | 13 | 0 | 13 | 0 |
| Patagonia | 7 | 0 | 7 | 0 |
| Iceland | 5 | 0 | 5 | 0 |
| Chamonix | 3 | 0 | 3 | 0 |
| Algonquin | 2 | 0 | 1 | 1 (Solitaire Lake Trail) |
| Vermont | 1 | 0 | 0 | 1 (Stowe Recreation Path) |
| Total | 118 | 33 | 106 | 12 |

85 targets (118 minus the 33 that already had photos: the five R2 trails and the trails D5a covered). 73 now have one or two photos (131 entries, 131 distinct files), 12 have the dated gap "No licensed photo yet".
Rockies gaps (10): Troll Falls, Miette Mine Trail, Rockwall Lookout, Beauvais Lake Trail, Chester Lake, Elbow Falls loop, Elk Lakes (Lower and Upper), Elk Lakes Viewpoint, Opal Hills Loop, Ribbon Creek. Reasons per record are in the ledger `gaps` and as `searched_none` rows with `tried` URLs in the run record. The gap has no home in the strict `photo` schema, so it lives there (same as D5a decision 1).
Licences: CC BY-SA 4.0 (41), CC BY 2.0 (32), CC BY-SA 3.0 (23), CC BY-SA 2.0 (17), CC BY 3.0 (6), CC0 (4), CC BY 4.0 (3), CC BY-SA 2.5 (2), Public domain (2), CC BY-SA 2.5 ca (1). Smallest width 1,600. No NC, ND, Unsplash, Pexels, Flickr-direct, AllTrails, Google, Tripadvisor or Komoot file.

## Where the photos are written
In place as a `photos` array on the existing route records (`migrated.json` and `CS7.json`), by `research/runs/DATA-D5b/apply.py` (same decision as D5a: a second record per ref fails `E_CAP_DUP_REF`). The script changes only the `photos` key; the files round-trip byte-identically through the same JSON writer first, so the diff is additions only. Reversible with `git revert` of the trip commits.

## Method
1. Targets: every `nature.trail.*` route record with no `photos`, point from `data/relevance/inputs/points.json` (the record's own ref, else its `starts_at`/part ref); `targets.json`.
2. Geosearch (list=geosearch, 1,500 m around the record point, namespace 6, 50 files) for all 85, then imageinfo; then text search (list=search) with one query per record (85), plus 54 follow-up text queries (rounds b, c) for records whose first answer held nothing of the place. Filters as D5a: jpeg, landscape, width at least 1600, licence regexp, Unsplash and Pexels words in title or description dropped. Client: D5a's cached, locked client (`cm.py`: `flock /tmp/travel-commons.lock`, 2 s between requests, user agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`, one request at a time). 781 Commons requests in total (log: `commons-calls.log`), 4 `cirrussearch-too-busy` answers (retried after a pause), no 429.
3. Candidates ranked by place words in title and description, then distance; contact sheets (400 px thumbnails) of the candidates viewed one by one; a pick must show the trail or its payoff in summer or autumn, no watermark, no people in the foreground.
4. Evidence per pick, in the ledger (`geotag`, `distance_from_record_point_m`, `subject_check`): a geotag within 1.5 km of the record point where one exists; where the payoff is farther from the trailhead point (lakes, passes, falls) the geotag sits at the payoff and the distance says so; where a file has no geotag the evidence is its title, description and Commons categories.
5. After writing, all 131 files were fetched again fresh, with their non-hidden categories (`verify-fresh-2026-10-25.json`).

## Sample check (all 131 files re-fetched; more than the required 20)
- Licence, author and width against the stored record: 131 of 131 match.
- Subject against the categories: 121 of 131 carry a category naming the place (a lake, falls, trail or peak of the trail). 10 carry only a generic category and rest on title, description and my reading of the contact sheet: Massive Mountain and Bow Valley (Sulphur boardwalk), Ink pots view (second file), Lillian Lake x2, Victoria Glacier above Lake Louise (Fairview), Red Rock Canyon x2, Tent Ridge Horseshoe, Cadini di Misurina Lavaredo 4 (category is "Ramo di San Lucano"), Rainbow at Mirador Condores (category "Rainbows in Chile", wrong country, title says El Chalten).

## Least certain picks (Opus pass first)
1. **Mirador de las Aguilas** (Patagonia): one bland Lago Viedma view, geotag 1.8 km from the point; nothing better exists.
2. **Chorrillo del Salto**: the two files show the trail and valley, not the fall (the uploader's whole series is the trail).
3. **Emerald Triangle**: Emerald Lake only; the Wapta Highline and Burgess Pass sections have no file.
4. **Cadini di Misurina viewpoint**: the view from the Lavaredo side, geotag 1.8 km (category odd).
5. **Lago Federa**: the Federa shore files have geotags at the park centroid (10 km) or 2.6 km from the point; the non-cropped file is a fisheye.
6. **Col des Montets**: geotags 2.2 km from the record point (the point may sit off the col).
7. **Burstall Pass, Fryatt Valley, Opal-like views**: payoff only, no trail surface; Fryatt files are 2004 and 1600 px wide.
8. **Skyline Trail**: hikers visible mid-ground in one file; both files have no geotag.
9. **Indefatigable Bench viewpoint**: a bench over Upper Kananaskis Lake; cannot prove it is the named bench.
10. **Tent Ridge Horseshoe**: a 16,382 px wide panorama of the ridge, geotag 2.1 km from the trailhead; one photo only.
11. **Laguna de los Tres**: both files are panoramas, one is a very wide strip.
12. **Sulphur Mountain switchback**: the Banff view file's geotag (282 m) is at the base though it was shot from the summit.
13. Single-photo trails where a second view would help: Cache Lake lookout (Track and Tower), Burstall, Vallunga, Val Fiscalina, Seceda, Devils Garden, Upheaval Dome, Riverside Walk, Upper Kananaskis Lake circuit, Mount Shark to Lake Magog, Bear's Hump, Tent Ridge.

## Dated gaps and why
Troll Falls (all winter or frozen-fall files; D5a's finding repeated), Elbow Falls loop (every falls file is winter, post-2013-flood debris, or has people in the foreground), Solitaire Lake Trail, Miette Mine Trail, Rockwall Lookout, Beauvais Lake Trail, Chester Lake, Elk Lakes x2, Opal Hills Loop, Ribbon Creek (no file of the place on Commons under any query), Stowe Recreation Path (the one file has hikers in the foreground).

## Credit-string issue
10 picks (13 files counting reuse across D5a) carry the Artist text "Thank you for visiting my page from Canada" and 4 carry "Wilson Hui from Calgary, Canada". The Artist metadata links only to a numeric Flickr id (`flickr.com/people/92599451@N08`), not to a readable account name, so the rule (map only if the username is visible in the metadata) was not met: the strings are kept as Commons holds them and listed here. Files affected: Ink Pots x2, Lillian Lake x2, Mt Lorette Ponds x2, Red Rock Canyon x2, Indefatigable bench, Upper Kananaskis Lake (92599451@N08). A builder or the Opus pass may show "Flickr user 92599451@N08" or ask the owner.

## DECISIONS NEEDED
1. Credit strings above: keep, or show the Flickr id.
2. Winter files: Troll Falls and Elbow Falls have only winter or post-flood files; keep the gap or accept one winter photo.
3. A file with hikers in the foreground (Stowe Recreation Path) as better than none?
4. Places of the same name in other trips (Trail "Elk Lakes" has only Victoria BC lakes on Commons): a land-manager photo (BC Parks) is not licensed for reuse here, so the gap stands.

## Gap reports and checks
`gaps --budget --check`: no count rose (photos is a property of tier A, so no required key moved; nothing lowered). `normalise.ts --budget --check`, `sources.ts check` (423 sources, 0 errors), `capture.ts build --check`, `validate.ts --all` (exit 0, no E_CAP_PHOTO_LICENCE) pass. `gaps --tier required --json` after: `research/runs/DATA-D5b/after-tier-required.json`. No point is written, so `gaps --placement` is unchanged. `tools/tree_check.py --check` reports one baseline entry that no longer fires (rule 10, `placementBlock.ts`); it is not from this batch. Full `bash tools/check-all.sh` result is in the hand-back.

## Coordinator, afterwards
- Warm the image renditions once, sequentially (`prebuild`): 131 new Commons files, hotlinked, none copied.
- `node web/scripts/fetch-photo-credits.mjs` once for the new files' credits (`web/data-snapshots/photo-credits.json`), one request at a time.
- `pnpm --dir web snapshot` (snapshots that list photos are stale).
- Merge after D5a (different records of the same files).

## Files
`data/capture/*/migrated.json` (algonquin-muskoka-2026, canadian-rockies-2029, chamonix-mont-blanc-2028, dolomites-2027, iceland-ring-road-2027, patagonia-2027, utah-five-parks), `data/capture/canadian-rockies-2029/CS7.json`, `data/capture/runs/api-2026-10-25-data-d5b-photos.json`, `research/runs/DATA-D5b/` (ledger, scripts, query lists, call log, fresh verify file; the raw geosearch and text-search answers and the thumbnail cache are left untracked).

Note on scripts: `cm.py` (the cached, locked Commons client) and `kw.py` are the D5a files, not copied again (the tree check refuses identical copies); to rerun, copy them from `research/runs/DATA-D5a/` next to the other scripts. The raw geosearch and text-search answers, thumbnails and contact sheets are not committed.
