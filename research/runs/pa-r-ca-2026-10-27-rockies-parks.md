# Run pa-r-ca-2026-10-27-rockies-parks: Rockies protected areas and their entry requirements (PA-R-CA)

Run record: `data/capture/runs/pa-r-ca-2026-10-27-rockies-parks.json`. Agent: travel-researcher (Opus). Task PA-R-CA
(`docs/v2/features/protected-area-entry.md` sections 11 and 12; DATA-PLAN PA-R-CA). Read 2026-10-27, one request at a time, user
agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`. Lane prose: `research/trips/canadian-rockies-sept-2029/bookings.md`,
section "PA-R-CA protected-area records (27 Oct 2026)".

## What was stored

| Where | Records |
|---|---|
| Locations store (`locations.py add`, then `slugs.ts build`) | Banff, Jasper, Yoho and Kootenay national parks, Kananaskis Country (5 places, `place/<slug>` pinned) |
| `data/capture/catalogue/PA-ca.json` (new lane) | 5 parks, 2 zones (`part/place/banff-national-park#lake-louise-area`, `part/place/yoho-national-park#lake-ohara`), 6 visitor centres and the Lake O'Hara car park as access points, the Discovery Pass on the operator, 4 daily admission fees (`covered_by` the pass), the Lake O'Hara day-use bus (lottery then leftover seats), the Kananaskis Conservation Pass day pass (`covered_by` the yearly pass) and yearly pass: 22 records |
| `data/relevance/catalogue/PA-ca.json`, `data/suitability/catalogue/PA-ca.json` (new) | 13 relevance records (parks, zones, visitor centres; class `park/protected-area` for parks and zones), 7 suitability records (parks and zones, area profile) |
| `data/capture/canadian-rockies-2029/CS7.json` | Moraine Lake shuttle seat: `summary`, `entry`, `run_by`, `at` gains `place/lake-louise`, `window` reshaped to a launch day (40%) then a rolling phase (60%), booking link; new record Roam Reservable Super Pass (`monthly_release`, `alternative_to` the shuttle seat) |
| `data/capture/dolomites-2027/CS7.json` | Tre Cime toll: `summary` and `entry` (12-hour slot, online only, free cancellation until five days before), from this lane's own reads of 18 and 19 Oct; not re-fetched |
| `data/capture/operators.json` | `operator/alberta-parks`, `operator/roam-transit`; `terms_url` on `operator/parks-canada` |
| `data/capture/points.json` | 14 points from one Overpass read: the parks at their main visitor centre (spec 4.1), the Lake Louise area at its visitor centre, the Lake O'Hara area at the lake, the access points |

Completeness: every new record is **Usable**, required tier complete (`capture.ts fields --ref` on all 22 catalogue records and
the two CS7 offers: "still missing (R): nothing"). The Tre Cime toll went from 3 missing keys to 1 (`hours`, an older gap).

## Sources (official first)

Parks Canada: admission and passes, printable Discovery Pass, reservation policies and pass terms, the four fees pages, the Banff
and Jasper park-pass pages, the four park home pages, the Lake O'Hara visit page, the Lake Louise and Moraine Lake page, the
bulletins pages, the Banff travel order (8 Sep 2026), the Johnston Canyon closure, the Jasper caribou closure, the mountain-parks
bear page. Alberta: the Kananaskis Conservation Pass page (alberta.ca), Alberta Parks' Kananaskis Country, advisories, annual road
closures, wildlife and Barrier Lake visitor centre pages. Roam Transit: Super Pass page. Banff & Lake Louise Tourism (the online day
pass seller Parks Canada names; kind press, used only for the booking link and as the conflict below). Wikidata (QIDs, P625, P402,
P1435) and OpenStreetMap through Overpass (points, `osm_ref`). The registry is rebuilt (`sources.ts build`).

## Conflicts (recorded, not picked)

- Discovery Pass coverage: "more than 80 destinations" (admission page) against "more than 100" (Banff and Jasper pass pages). No
  count is stored.
- Through travel in Banff: Banff & Lake Louise Tourism says every visitor needs a pass; the Parks Canada order exempts travel
  without stopping on Highways 1 and 93 South. The official rule is stored as a `through_traffic` exemption.

## Could not be verified or stored

- The daily pass runs until 16:00 the day after purchase; `entry.valid` has no time, so it is 1 day from purchase with the rule in
  the note. The Discovery Pass expires at the end of the month of purchase; stored as 12 months from purchase with that note.
- Kananaskis pass refunds: the page says online passes can be cancelled until 23:59 the day before they start but not whether
  the refund is full; `cancel` is unset, the rule is in the note. Commercial vehicle rates are not stored.
- Kananaskis Country has no OSM boundary relation for the whole area (only the Public Land Use Zone, relation 7231693); `osm_ref`
  is unset.
- Wikidata: no item for the Banff, Lake Louise, Kootenay and Kananaskis visitor centres or for the two zones (searched_none).
- Season of the passes: no sale season is published; stored as all year with basis `our_inference`.
- Lake O'Hara draw month: March in 2026 only; that it repeats is a pattern (`ask` result to the Lake O'Hara office).

## Contract findings (for PA-C, not changed here)

1. `price` R? [sells] and `window` R? [bookable] fire on a park or zone that has requirement offers at it; C11 answers only
   `access_cost`. Answered here with `not_applicable` Vals naming the offers (spec 4.6 moves the fee off the place).
2. `entry` is refused on `offer/place/lake-louise#parking` (an `access.park` offer, E_ENTRY_SCHEMA), so spec 11's row for it
   cannot be done.
3. `book_url` is N on `access.pass` (W_CAP_NA_FIELD) although spec 4.2 marks it R? reservable; the booking link carries the URL,
   which PA-X's `requirementLink` reads second.
4. A `stay.camp.campground` lodging offer needs `cost_band` (no home in the registry), `check_in_out` and the stay suitability
   block: the front-country campsite offer is not stored (D8-R prices and the launch-day rule stay in the prose).
5. **E_PLACE_FAR false positive (blocker for check-all).** The new store place Banff National Park gives the area
   `CA/AB/banff-national-park` a second store point, so the 25 km box is judged for the first time and flags Bow Lake, its car
   park, Peyto Lake and the Peyto lookout, all inside the park on the Icefields Parkway. The budget is raised with that reason
   (`gaps --budget --write --reason`), but `core/test/capture/placement-block.test.ts` pins `E_PLACE_FAR` at 0 and fails. Options
   for the coordinator: a larger `minBoxPoints` or a park exemption in `PLACEMENT_RULES` (shared contract, Opus), or more store
   places in northern Banff (owner's list). No data was bent to pass it.
6. The migration test pins the operator count; it moves from 24 to 26 (two operators added), as earlier lanes did.

## For PA-W (booking-refs entries; PA-W is not on main, so not written)

```json
"pass-discovery": { "ref": "offer/operator/parks-canada#discovery-pass", "days": [1, 2] },
"moraine-private-access": { "ref": "offer/legacy/canadian-rockies-sept-2029/sights/moraine-lake#roam-super-pass", "days": [11] },
"lake-ohara-bus": { "ref": "offer/place/yoho-national-park#lake-ohara-day-use-bus", "days": [9] },
"kananaskis-pass": { "ref": "offer/place/kananaskis-country#conservation-pass-day", "days": [12, 13, 14, 15] }
```

- The shuttle seat now has a launch-day window with a second phase and `entry.valid` of 1 day, so `requirementRows` splits it
  into one row per ridden day (10 and 11). The existing note "40% of seats go on sale on a spring launch day; book then" repeats
  the rule; PA-W may drop it.
- No trip stop is a member of the Lake O'Hara zone, so only the mapping above gives the lottery row. The Lake Louise area zone has
  no requirement of its own, so it stays out of the park line; Moraine Lake and Lake Louise are not yet `part_of` it (they are
  members of Banff by area; the edit is in `migrated.json`, not owned here).
- Kananaskis day pass: window `anytime` with a close at 23:59 on the day, so the export says "Buy by 23:59 on Day 12".

## Commands and results

| Command | Result |
|---|---|
| `node core/bin/validate.ts --all` | before (main fd11643d): OK, 107 files, 0 errors, 1397 warnings; after: OK, 111 files (3 lane files and the run record added), 0 errors, 1399 warnings (+4 E_PLACE_FAR, -2 tier warnings on the shuttle seat) |
| `node core/bin/capture.ts run --check data/capture/runs/pa-r-ca-2026-10-27-rockies-parks.json` | OK, 0 errors |
| `node core/bin/capture.ts build --check` | OK |
| `node core/bin/graph.ts build`, `build --check` | 527 records, 144 with a container, 0 cycles; current |
| `node core/bin/capture.ts gaps --budget --check` | OK after `--write` (W_TIER_REQUIRED 383 to 382, keys 3663 to 3659; E_PLACE_FAR 0 to 4 with the reason above) |
| `node core/bin/sources.ts check` | OK after `build`, 700 sources |
| `derive-near --check`, `derive-area --check`, `relevance.ts derive --check`, `slugs.ts --check`, `locations.py build --check`, `normalise.ts --check` and `--budget --check` | OK |
| `pnpm --dir core exec vitest run test/parks test/export test/graph test/capture` | 1 failure: the E_PLACE_FAR pin (finding 5) |
| `node core/bin/capture.ts gaps --placement --trip catalogue` | 115 records; no area 0, no point 0, approximate 19 (none new), no nearest town 0, outside its area 0, offers saying nowhere 0 |
| `node core/bin/capture.ts gaps --placement --trip canadian-rockies-2029` | 206 records; no area 14, no point 0, approximate 8, outside its area 4 (finding 5) |

## Follow-up PA-R-CA2 (27 Oct 2026, Opus)

- Finding 5 is fixed in the rule, not the data: `core/src/capture/placementBlock.ts` judges a member of a protected area that covers its
  own `area_id` (graph.ts containment: `part_of`, else `covers_areas`) against the area's store places widened by the park's point and
  the exact points of its other such members. A lone or swapped point is still flagged (unit tests in
  `core/test/capture/placement-block.test.ts`). `E_PLACE_FAR` is back to 0 and the raise is removed from `gap-budget.json`.
- PA-W wiring written in `data/trips/booking-refs.json`: `pass-discovery` (days 1 to 11, every national-park day of the plan),
  `moraine-private-access`, `lake-ohara-bus`, `kananaskis-pass` (their legacy days already match). The shuttle keeps `days: [10, 11]`
  (the legacy row lists days 8 to 11; it is ridden on 10 and 11) and drops the note that repeated the launch-day rule.
- Kootenay has no park line: Marble Canyon and the Paint Pots (day 3) have no `area_id` (`gaps --placement`: no area 14), so they are
  not members. That is a `migrated.json` edit for the owner of the Rockies records.

## Follow-up PA-R-CA3 (27 Oct 2026, Sonnet)

- Kootenay park line: `derive-area` cannot place Marble Canyon and the Paint Pots (10 km radius fence on purpose; Marble Canyon is
  15.6 km from a labelled point), so the four day-3 records (`sights/marble-canyon`, `sights/paint-pots`, `trails/marble-canyon-walk`,
  `trails/paint-pots-walk`) carry an authored `area_id` of `CA/BC/kootenay-national-park` in `data/capture/canadian-rockies-2029/migrated.json`.
  The Kootenay park record (`place/kootenay-national-park`, with its entry rule) already existed; nothing was invented.
- `derive-area --write` refreshed `derived-areas.json` (one rival distance moved); `gaps --budget --write` lowered the placement budget (no area 14 to 10).
- Rockies lines now: Banff days 1 to 4 and 10 to 11, Kootenay day 3, Jasper days 4 to 8, Yoho day 9, Kananaskis days 12 to 15.
