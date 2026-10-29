# Run lt-where-2026-10-28-osm-address (LT-WHERE)

Run record: [data/capture/runs/lt-where-2026-10-28-osm-address.json](../../data/capture/runs/lt-where-2026-10-28-osm-address.json).
Findings, every table and the review list: [research/reports/lt-where-2026-10-28.md](../reports/lt-where-2026-10-28.md).
Machine-readable proposals (one entry per place, for LT-AP and LT-1 to LT-4):
[lt-where-2026-10-28-osm-address/proposals.json](lt-where-2026-10-28-osm-address/proposals.json).
Agent: travel-researcher, model Opus. Read on 28 Oct 2026.

## Scope

All 155 places of `data/locations/locations.json`, as their `place/<slug>` refs (from `locations.py basics --report --json`), all
kinds, no trip. Batch LT-WHERE ([location-type-requirements.md](../../docs/v2/features/location-type-requirements.md) 7.2;
DATA-PLAN 2.5 row 72). Layers: OSM id candidates, Wikidata QID check and fill, address proposals, and an AllTrails search list.
**Proposals only:** no record, sidecar, store row or registry entry was written.

## What was found

- **OSM ids:** 109 high (the element carries the store QID and fits the kind, is Wikidata's P402, or is the record's own
  `osm_ref` resolving with QID or name), 21 medium, 16 low, 4 conflicts, 4 none found, 1 place without a point. 63 of the 64
  `osm_ref` values already in records resolve today: 47 are this run's candidate as well, 13 resolve with the QID or the name and
  are kept over this run's pick (another element of the same place, listed as an alternative), and 4 are conflicts.
- **Wikidata:** 145 of the 148 stored QIDs confirmed (P625 within the kind's radius and a label match), 2 confirmed by coordinates
  only (the label is in another language), 1 flagged: Sentier des Cimes stores Q1751092, the Mont-Mégantic park, not the trail.
  The 7 places without a QID were searched again: still no item, now `searched_none` dated today.
- **Addresses:** 88 proposals (80 nearest road, 8 postal); 43 confident, 45 flagged (a footpath given as the nearest road, a
  county as the locality, the answer far from the target, a Wikidata line to split); 16 none found (10 with no road near the
  point, 5 parks without an access record, 1 without a point); 51 not applicable (towns, cities, regions, the drive).
- **Car park candidates:** 26 natural places with no access record got their address looked up at the nearest OSM car park
  or trailhead within 1.5 km; the candidates are listed for LT-AP.
- **AllTrails:** 13 search pairs (7 trails, 6 single-hike places), not run; nothing fetched.
- **Review list:** 85 places need a person for at least one layer.

## Gaps and why

GAP: `place/grand-sault-waterfall` has no store point, so no spatial search ran. Find the falls first.

GAP: Nominatim gave no road for 10 summits, glaciers and remote lakes; their address is their car park's (LT-AP).

GAP: 5 parks have no entrance or visitor-centre record, so no address was looked up (a park's point is its centre, D2).

GAP: the `address` property does not exist yet (LT-C adds it), so the run record carries only `osm_ref` and `wikidata` results;
the address proposals are in the report and the proposals file. A follow-up appends `address` results to this run record (or a
new one) once LT-C merges.

## Conflicts

- `place/kootenay-national-park`: the record and Wikidata P402 hold `relation/7707395`, which does not resolve in Overpass today;
  this run found `way/673733022` tagged with the QID.
- `place/bonaventure-island`: the record holds the national park's relation (`relation/6989318`, Q745054), not the island.
- `place/qq-canyon-racer-mountain-coaster-gulong-gorge`: the record holds `way/1424946284`, named only in Chinese; no English name
  or QID to match.
- `place/columbia-river-gorge`: the record holds the National Scenic Area's relation (Q35692371), not the gorge (Q1112581).

All four are recorded as `conflict` in the run record with both sides; none was picked.

## Questions for the owner

None new. Q322 (Q-LT1, the AllTrails page or a dated "none found" on every trail) decides whether the section 7 list of the
report is run.

## Requests

| Host | Requests | Errors | Notes |
|---|---|---|---|
| query.wikidata.org | 2 | 0 | SPARQL, 80 QIDs a query |
| www.wikidata.org | 19 | 0 | 18 `wbsearchentities`, 1 `wbgetentities` |
| overpass-api.de | 56 | 11 x 502, 6 x 504 (retried with back-off) | 38 cluster queries and 1 record-id query answered; `/tmp/travel-overpass.lock` |
| nominatim.openstreetmap.org | 96 | 0 | single reverse lookups, 1.2 s apart; `/tmp/travel-nominatim.lock` |

User agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`. Cache: `tools/.cache/lt-where/` (gitignored); a rerun
makes no request. One stalled first attempt at a case-insensitive name regex in a 25 km circle (Buenos Aires) was stopped and
replaced with exact name values, which use the tag index. No Google, no commercial page, no AllTrails request; no home point read
or written.

## Files written

- `data/capture/runs/lt-where-2026-10-28-osm-address.json`
- `research/runs/lt-where-2026-10-28-osm-address.md` (this note)
- `research/runs/lt-where-2026-10-28-osm-address/proposals.json`
- `research/reports/lt-where-2026-10-28.md`

## Commands run

| Command | Result |
|---|---|
| `python3 tools/locations.py basics --report --json` | 155 places, 155 `place/` refs, 72 with a record |
| `node core/bin/capture.ts run --check data/capture/runs/lt-where-2026-10-28-osm-address.json` | OK: 0 error(s), 0 warning(s) |
| `node core/bin/validate.ts --all` | OK: 114 file(s) validated |
| `python3 tools/tree_check.py --check` | folder contract OK: 11 rules, 5639 files |
| `python3 tools/gate/check_map.py` | gate map OK: 5639 files, 69 rules |
| `python3 tools/cons/hardcode_scan.py --check` | hardcode scan OK: 187 baselined findings |
