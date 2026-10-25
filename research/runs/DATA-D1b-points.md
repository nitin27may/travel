# DATA-D1b: points follow-up (25 Oct 2026)

Branch `public/DATA-D1b` (worktree `v2-DATA-D1b`, merged with `main` at f314284 before any change). Model: Claude Opus 5.5.
Run record: `data/capture/runs/api-2026-10-25-data-d1b-points.json`. Script: `research/runs/DATA-D1b-points/build_points_d1b.py`
(one function per step; the D1 rows came from `research/runs/DATA-D1-points/build_points.py`). Every point is agent checked and
needs a person's check. Before-snapshots: `before-budget.txt`, `before-build-check.txt` and `before-locations-validate.txt` in
`research/runs/DATA-D1b-points/`, taken by the earlier agent on the pre-merge branch. The merge was a fast-forward to `main`,
which already held D1, so the numbers did not change and they were not re-taken. The placement and tier snapshots it took were
byte-identical to D1's `research/runs/DATA-D1-points/after-placement.json` and `after-tier.json`, so those two files are the
before evidence (the folder contract forbids a second copy); my after-snapshots sit beside the script.

## Method and limits

- External calls ran one at a time through a small cached fetcher (scratchpad, not committed) under `flock` on the shared lock
  files: `/tmp/travel-overpass.lock` for Overpass, `/tmp/travel-wikidata.lock` for Wikidata, `/tmp/travel-d1b-web.lock` for land
  manager and operator pages. **`flock` was not installed; I installed it with `brew install flock` (flock 0.4.0) for this run.**
  Overpass calls waited 10 s after each answer; a 502 was retried after 20 s with doubling (no 429 was seen).
- User agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. No Google, AllTrails, Tripadvisor or Komoot
  coordinate; two web searches (search engine result pages) were used only to find official page addresses, never for a value.
- **Overpass was reachable this time** (D1 could not use it). Request counts are in the run record.
- Read dates: everything on 2026-10-25. The date and the source sit in each row's `point_source`.

## Counts

| | before | after |
|---|---|---|
| `W_PLACE_POINT` (records with no point) | 6 | (filled in at the end) |
| Approximate points | 41 | |
| Points in `data/capture/points.json` | 179 | |

## Step 1: the six `searched_none` records

| Record | Result | Point and source |
|---|---|---|
| Berg Lake Trail | **found** (role `parking`) | OSM way 1185166549, the car park at the end of Kinney Lake Road where the Berg Lake Trail ways start; BC Parks (bcparks.ca/mount-robson-park/berg-lake-trail/): "begins at the end of Kinney Lake Road" |
| Fryatt Valley | **found** (`trailhead`) | OSM node 2520427794, where Fryatt Trail (Parks Canada trail 122) leaves Geraldine Fire Road. Parks Canada: the Fryatt page says 2 km up Geraldine Road; the Geraldine page says the road runs 3.3 km beyond the Fryatt trailhead, and the mapped road runs 3.34 km beyond this node (2.09 km before it) |
| Laguna de los Tres | **found** (`trailhead`) | OSM node 7069713837 (`highway=trailhead`) at the north end of El Chalten, beside the "Senda al Fitz Roy" boards; the park leaflet (PNLG zona norte 2024) puts the lake on the Fitz Roy path, 2 km from the APN visitor centre to the path start |
| Laguna Esmeralda | **found** (`parking`) | OSM way 567999991 beside RN 3 where the Sendero Laguna Esmeralda ways start; Ushuaia tourism office: the path starts 18 km from Ushuaia on RN 3 at a large roadside car park |
| Windows Section, Arches | **found** (`trailhead`) | OSM node 4835435421 The Windows Trailhead (`highway=trailhead`); NPS place page lists the trailhead and parking |
| Lac du Chatelard (Chamonix) | **still none** | see below |

**Lac du Chatelard: the place does not exist in the plan's area.** Tried on 25 Oct: Overpass, every feature whose name contains
"telard" in 45.80-46.20 N, 6.70-7.10 E (52 hits: the hamlet Le Chatelard VS, its stations, the funicular, the Chatelard-Barberine
power plants, the Chatelard tunnel near Passy; no water body); Wikidata `wbsearchentities` in French for "Lac du Chatelard",
"Lac de Chatelard" and "lac Chatelard" (no result) and full-text search "Chatelard lac" (a mountain and a railway company). The
record first appears in the 18 Oct prototype seed list (the public-trips data file of the old prototype, commit 079f7ba, since removed), day 6 "Aiguillette
des Posettes": `Col des Montets|hike` and `Lac du Chatelard|water|45`. The legacy plan (`legacy/chamonix-mont-blanc-sept-2028/PLAN.md`)
has no such stop; it names Le Chatelard only as the Mont-Blanc Express station on the way to Lac d'Emosson, which the trip already
holds as `trip/chamonix-mont-blanc-2028/sight:emosson dam and dinosaur tracks`. **Proposal (not done; no ref deleted):** drop the
stop from day 6, or, if the owner meant the ponds at the Col des Montets or Lac d'Emosson, mark
`trip/chamonix-mont-blanc-2028/lake:lac du chatelard` `same_place_as` the record it meant. Until then it stays the one
`W_PLACE_POINT`. (DECISIONS NEEDED 1.)
