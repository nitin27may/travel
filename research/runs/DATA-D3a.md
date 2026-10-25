# DATA-D3a: trail facts for the R2 trails and the Rockies plan-day trails

Run 25 Oct 2026, travel-researcher on Opus, worktree `v2-DATA-D3a`, branch `public/DATA-D3a` (from `main` f2dee4b). Rows
10.2, 3.47b, 3.47c, RB-3 (COVERAGE lines 17, 18, 225). Run record for the API calls:
`data/capture/runs/api-2026-10-25-data-d3a-overpass.json`. Gap reports: the before reports are byte-identical to D1's after reports, so they are not copied (folder contract rule 7): `gaps --placement` before and after = `research/runs/DATA-D1-points/after-placement.json` (D3a writes no points, the report did not change); `gaps --tier required` before = `research/runs/DATA-D1-points/after-tier.json`, after = `research/runs/DATA-D3a/after-tier-required.json`.

## Result in one paragraph

The scope was 38 trail records: the five R2 trails (Fenland, Johnston Canyon walk, Larch Valley, Tre Cime loop, Lake
Agnes) and the 36 Rockies trail records on plan days (from `data/schedules/canadian-rockies-2029.json`, matched to capture
refs; Fenland and Larch are in both sets). Most of them were already filled by lane R2a (18 to 19 Oct) and R1. Four had no
lane record and are now in `data/suitability/canadian-rockies-2029/R9-TF.json` with every required field answered: Lake
Agnes, Rawson Lake, the Sulphur Mountain summit boardwalk and the Moraine Lake Rockpile loop. The rest of the work found
values for records that sit in lane files this batch does not own; a ref may appear in only one lane file of a trip
(`E_SUIT_DUP_REF`, `E_CAP_DUP_REF`), so those values are in `research/runs/DATA-D3a/patch-proposals.json`, ready to apply.
`W_TIER_REQUIRED.keys` fell from 3,875 to 3,832 (budget lowered); no other count moved.

## Counts (38 target trails; value + dated gap)

| Field | Before | After (committed) | After the patch proposals |
|---|---|---|---|
| distance | 33 + 3 | 35 + 3 | 36 + 2 (Sarrail estimate) |
| gain | 31 + 5 | 32 + 6 | 33 + 5 (Seekofel is outside the 38; Tre Cime gains a computed conflict) |
| time | 35 + 1 | 36 + 2 | same |
| shape | 33 | 37 | 38 (Johnston) |
| surface | 10 + 7 | 12 + 9 | same |
| dogs | 33 | 36 | 37 (Tre Cime) |
| stroller | 32 + 1 | 35 + 2 | 36 + 2 (Johnston) |
| wheelchair | 9 + 6 | 11 + 7 | 12 + 7 (Johnston) |
| season | 23 + 10 | 26 + 11 | 27 + 11 (Johnston) |

Wheelchair and surface are A (not required) for the hike profile, so the low counts there do not hold a record at draft.
Required tier for the four TF records: Lake Agnes 24 keys missing to 15, Rawson 25 to 15, boardwalk 25 to 12, Rockpile 23
to 12; what is left is capture-layer keys (summary, draw, links, geometry, access points), outside D3a.

`gaps --placement`: unchanged (D3a writes no points). `gaps --budget --check`: OK, one count fell and was written.

## The five R2 trails

| Trail | Ref | State after this run |
|---|---|---|
| Fenland loop | `legacy/canadian-rockies-sept-2029/trails/fenland-loop` | complete for D3a fields in R2a (1.9 km, 20 m, 40 min, loop, dirt, leash, all-terrain stroller, no wheelchair, open all year). The winter page gives 2.1 km and no gain for its winter loop; not recorded, a different loop. Link set: official only; no OSM id (gap) |
| Johnston Canyon walk | `part/legacy/canadian-rockies-sept-2029/sights/johnston-canyon#walk` | R2a has distance, gain, time, surface, dogs; draft. Shape, stroller (official "Strollers are not recommended"), wheelchair, age band, exposure, navigation and access season are in the patch proposals. **2026 closure:** trail, day-use area and P1 closed 13 Oct to 11 Dec 2026 for rock-slope work (bulletin, read 25 Oct); the Upper Falls and Ink Pots stay reachable by Moose Meadows. A one-off; the 2029 trip is not affected |
| Larch Valley | `legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass` | R2a: 11.2 km, 750 m, 270 to 330 min, out and back, leash, no stroller, season 1 Jun to 12 Oct by shuttle. Re-read 25 Oct: the figures still match (Sentinel Pass via Larch Valley 5.6 km one way, 750 m, 4.5 to 5.5 h, Difficult) |
| Tre Cime loop | `place/tre-cime-di-lavaredo-loop` | R1: 8.8 km, 550 m, 240 min (tourism board, re-read 25 Oct: same). Dogs and the computed track figures (9.0 km, 435 m) are in the patch proposals |
| Lake Agnes Tea House | `legacy/canadian-rockies-sept-2029/trails/lake-agnes` | **new in R9-TF.json**: 7.8 km, 495 m (80 m loss), 150 to 180 min, Moderate, out and back, leash, no stroller, no wheelchair, shuttle 15 May to 12 Oct, tea house mid-May to mid-October, avalanche terrain November to mid-May. Not on any plan day (it is an R2 trail only) |

## Sources read (25 Oct 2026)

Parks Canada: Banff hiking tables, trail conditions, closures, the Johnston Canyon bulletin, the Lake Louise shuttle page,
the Lake Louise top-10 page (teahouse season), the bear management page (seasonal restrictions), the Banff winter walking
page; BC Parks Mount Robson; Alberta Parks Rawson Lake trail report and pets rule; Pursuit Banff Gondola page and FAQ;
3 Zinnen Dolomites route 569; the South Tyrol nature-park code of conduct. Page reads were one at a time with at least 5 s
between reads on a host. No AllTrails, Google, Tripadvisor or Komoot page was read or cited.

Overpass (overpass-api.de): 3 requests under `flock /tmp/travel-overpass.lock`, more than 10 s apart, user agent
`travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`. One answered (Kananaskis named ways); the
Overlander Falls query got HTTP 502 twice and the run stopped there. `flock` was already installed at
`/opt/homebrew/bin/flock` when this run started (not installed by this run). No Wikidata or Commons call was made.

## Sample check (values against the raw page HTML, re-fetched with curl after writing)

17 of 17 pass: Lake Agnes 3.9 km one way, 495 m, 80 m loss, 2.5 to 3 h, listed under Moderate trails; Rockpile 0.7 km
loop, 35 m, 30 min, listed under Easy; Johnston "Strollers are not recommended", Lower Falls 1.1 km one way and 1 h;
Rawson 3.9 km one-way, 320 m, group size limit 15; gondola FAQ 368 shallow stairs each way, pets not permitted, open
year-round except a short November maintenance; shuttle seasons 15 May to 12 Oct (Lake Louise) and 1 Jun to 12 Oct
(Moraine).

Read only through the summarising fetch, not re-checked in raw HTML: the winter page figures (0.5 km to Sanson Peak;
Johnston 1.2 km and 50 m), the Alberta Parks 2 m leash rule, the South Tyrol dog rule quote, the 3 Zinnen route 569 facts
(they match R1's 18 Oct read), the teahouse season quote, and the Moraine Lake area restriction listing.

## Decisions taken (safest reversible choice) and DECISIONS NEEDED

1. **DECISION NEEDED: who writes the values for records in R2a.json, R1.json and the capture `migrated.json` files.**
   The brief gives D3 only `TF.json`, but a ref may sit in one lane file of a trip, and capture records are edited in
   place (capture contract 9.7). This run wrote nothing outside its owned paths and put every such value, with sources,
   in `research/runs/DATA-D3a/patch-proposals.json`. Options: the coordinator applies it; or D3 (and D3 later) is allowed
   to edit the R lane records and the capture records in place for trail-fact paths. Recommendation: allow in-place edits
   for the trail-fact paths, one batch at a time per trip file, after D1b hands back (D1b writes capture files for payoff
   parts).
2. **Lake Agnes and Rawson Lake:** their winning records were `migrated-offplan.json` (values carried over from the
   legacy datasets, not re-read). The TF records supersede them by the migrated-file rule; the old leaves stay in the
   migrated file, so the ledger holds.
3. **Rawson Lake distance:** official 7.8 km kept as `v`; the OSM ways (4.9 km return from the Rawson Lake Trailhead)
   kept as a conflict, not averaged. The difference is the Upper Lake Trail approach, which Alberta Parks counts.
4. **Sulphur summit boardwalk distance:** official 1.0 km return (0.5 km to Sanson Peak) as `v`; the operator's "2 km
   stroll" as a conflict. The FAQ says the boardwalk now ends before the observatory.
5. **Estimates are marked:** Rawson time (Naismith on the official figures), the Sarrail distance proposal (OSM ways).
   Each says "estimate" in its note.
6. **3.47b Seekofel:** proposal sets the computed track (1,467 m up, 14.6 km return) as `v` with the earlier 1,314 m as a
   conflict citing the migrated file's computed source. The 1,314 m came from a route platform, which can never be a
   source, so it is shown as "earlier figure", not as that platform's value. **DECISION NEEDED (owner or coordinator):**
   show a computed value as the main figure, or keep `searched_none` with the track only as a conflict.
7. **3.47c Tre Cime second line:** not fixable in data owned by a DATA batch. The cause and two fixes (one line in
   `web/lib/public/tracks.ts`, or the seed text in `data/seed/prototype/trails.ts`) are in the proposals for a builder.
8. **RB-3:** Larch Valley is already done (the draw sits on the Sentinel Pass part; the route has no relevance record).
   Tre Cime needs relevance records for its two payoff parts and possibly a supersede entry; no DATA batch owns those
   files. **DECISION NEEDED (coordinator):** which lane writes them.
9. **DECISION NEEDED (coordinator): the lane file name.** The brief says `data/suitability/<trip>/TF.json`, but
   `core/test/suitability/kind-map.test.ts` (line 112) allows only `R<n>*.json` beside the migration output, so `TF.json`
   failed check-all. The file is named `R9-TF.json` (lane `TF` inside; R9 is unused). Renaming is free while nothing links
   to it. D4a (`AC.json`), D8 (`OV.json`) and D9 (`BS.json`) will hit the same test: either name them `R<n>-<lane>.json`
   or have a builder widen the pattern in the test.

10. **DECISION NEEDED (owner, D-E8 / Q88): place-page size budget.** With this batch the median place page is 1.264x
    its baseline against the 1.25 budget (`web/tests/data/place-size.test.ts`); without the R9-TF.json records it is
    1.249x (measured 25 Oct by building with the file removed). Two pages cross the median: `lake-agnes-tea-house`
    (1.014x to 1.356x) and `rawson-lake` (1.223x to 1.415x); `moraine-lake-rockpile-loop` grows 0.881x to 1.232x but stays
    below the median. Either one of the two alone already moves the median over 1.25 (the next ratio up is 1.257x). As D-E8
    says, the records stay committed on `public/DATA-D3a` and are listed here for the R2 ruling: merge them and raise or
    re-base the budget, or hold Lake Agnes and Rawson Lake back until the page carries less per record. Every other page
    is under its own cap.

## check-all (25 Oct 2026)

`PATH=<scratchpad venv>/bin:$PATH bash tools/check-all.sh` with `data/sources/registry.json` rebuilt in the working tree
only for the run and restored after (the coordinator regenerates it at merge; built cleanly, 407 sources, 0 errors).
No `web/.env.local` exists in this worktree, so nothing was moved aside; `web/.og-cache` was created empty (untracked), as
the D6a check did. Result: every stage passes up to `web test`, where one test fails: the place-size median (item 10).
An earlier run on the busy machine also failed `tests/budget.test.ts` (30 s timeout) and `tests/search/split.test.ts`
(25.9 ms against 25 ms); both pass when rerun alone. That run also showed two core failures
(`test/capture/migration.test.ts`, `test/capture/placement-block.test.ts`) whose output carried another worktree's point
counts (no point 0, approximate 8, not this branch's 2 and 23); both pass alone and in the next full run. Unverified cause:
another agent's run sharing a temp path.

## Gaps left (GAP lines)

- GAP: Overlander Falls trail: distance, gain, time, surface, stroller and wheelchair stay `searched_none` (R2a); BC
  Parks Mount Robson page silent (read 25 Oct); Overpass 502 twice. Next: retry Overpass off-peak.
- GAP: Interlakes trail distance: no official figure; no OSM way named Interlakes (only the roads). Next: Alberta Parks
  Peter Lougheed trail map PDF (open.alberta.ca).
- GAP: Kinney Lake gain: BC Parks gives 7 km to Kinney Lake (cycling limit) and no gain.
- GAP: Rawson Lake access season dates: the trail report says Summer only.
- GAP: summit boardwalk gain and time: neither the operator nor Parks Canada publishes them.
- GAP: Rockpile loop surface, stroller and wheelchair: the Parks Canada table is silent.
- GAP: OSM link for most Rockies trails: not searched in this run (the brief's OSM-first step has stored tracks only for
  the Dolomites). Fenland, Johnston, Larch and Lake Agnes have no OSM id.

## Files

- `data/suitability/canadian-rockies-2029/R9-TF.json` (new, 4 records, 11 sources)
- `data/capture/runs/api-2026-10-25-data-d3a-overpass.json` (new)
- `data/capture/gap-budget.json` (`W_TIER_REQUIRED.keys` 3,875 to 3,832)
- `research/runs/DATA-D3a/after-tier-required.json`, `research/runs/DATA-D3a/patch-proposals.json`
- this note

No capture `TF.json` was written: every target ref already has a capture record elsewhere. No household data in any file.
No ref renamed.
