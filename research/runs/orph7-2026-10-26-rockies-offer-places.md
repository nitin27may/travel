# Run orph7-2026-10-26-rockies-offer-places: places for the seven offers that said where nowhere

Run record: `data/capture/runs/orph7-2026-10-26-rockies-offer-places.json`. Lane file:
`data/capture/canadian-rockies-2029/ORPH7.json`. Agent: travel-researcher (Opus). Task: ORPH-7 (`docs/v2/build/DATA-PLAN.md`).

## Scope

Trip `canadian-rockies-2029` (prose folder `canadian-rockies-sept-2029`). There were 7 offers with `E_PLACE_ORPHAN`:
`banff-springs-spa`, `bow-river-raft`, `burgess-mt-stephen`, `heli-flight-canmore`, `heli-hiking`, `norquay-via-ferrata`, and
`yamnuska-scramble` (all under `legacy/canadian-rockies-sept-2029/adventures/`). None of the trip's place records fit any of
them: there was no Bow Falls, Norquay, Canmore, Field or heliport record. So each offer got a new meeting-point place, cut from
the offer (`part/<offer>#<slug>`, `meta.origin` names the offer), the same pattern as `kicking-horse-family-float#river-base`.

Type: `access.start.meeting_point`. Its required tier is `name, type, point, area_id, links, parks_for`, plus `price` because
offers that sell point at it (answered `not_applicable`: the price is on the offer). It needs no suitability or relevance keys,
so these records have no sidecar rows. `parks_for` names the offers the point serves, so an offer page lists it as an
access point.

## Found

| Offer | `at` (new place) | Point (OSM) | Named by |
|---|---|---|---|
| banff-springs-spa | `#spa` Fairmont Spa, Fairmont Banff Springs | way 24823886 (hotel, Q806429) | Fairmont spa page: the spa's address is the hotel's |
| bow-river-raft | `#launch` Bow River float launch, base of Bow Falls | node 263386936 (Bow Falls) | Banff Adventures: "The tours depart from the base of Bow Falls" |
| burgess-mt-stephen | `#meeting` Yoho National Park Visitor Centre, Field | way 492008964 (Q69742837) | Parks Canada: "Meet in front of the Yoho National Park Visitor Centre" |
| heli-flight-canmore, heli-hiking | `heli-flight-canmore#heliport` Alpine Helicopters Canmore base, Canmore Municipal Heliport | way 208141661 (terminal), helipad way 222350989 (CEW9) | Alpine Helicopters (Canmore base); White Mountain Adventures ("Arrival Canmore Heliport for safety briefing") |
| norquay-via-ferrata | `#start` Norquay Via Ferrata start, top of the North American Chair | way 184206150 (upper station of chair way 23259693) | Norquay FAQ: "located on the cliffs above Mt Norquay Ski Resort at the top of North American Chair" |
| yamnuska-scramble | `#classroom` Yamnuska Mountain Adventures classroom, Canmore | way 362080642 | Yamnuska: "The course begins at the Yamnuska classroom" |

Areas come from `capture.ts derive-area --write` (from the point). Nearest towns come from `derive-near --write`: Banff for
the spa (1.5 km), the launch (1.2 km) and Norquay (3.9 km); Canmore for the heliport (1.1 km) and the classroom (0.9 km);
Golden for Field (34.9 km, since Field is under 1,000 people).

Completeness: all six places are **Usable, required tier complete** (`capture.ts fields --ref`: "still missing (R): nothing").
None of the enrichment fields is filled: names, geonames_id, transit, wheelchair, toilets, walk_m and the rest.

## Gaps and why

- GAP: the Norquay via ferrata check-in point. Four Norquay pages were read (routes, via ferrata, FAQs, getting here) and none
  names one. The run record holds this as an `ask` to Banff Norquay.
- Bow Falls launch: no slipway or dock is mapped in OSM within 800 m of the falls, so the point is the Bow Falls node. The
  launch is at the base of the falls, within about 100 m. The point is not marked approximate, because it is the landmark the
  operator names.
- The seven offers keep their earlier required-tier gaps (summary, access_cost, suitability limits and so on). They are pinned
  records, so these gaps are warnings, and this run did not research them. Each offer's list is in `capture.ts fields --ref`.

## Conflicts

None.

## Questions for the owner

1. Canmore's two points (the heliport and the classroom) derive `CA/AB/kananaskis-country`, through the Canmore Nordic
   Centre and the store's Kananaskis places. The town of Canmore is not legally inside Kananaskis Country. Should Canmore or
   the Bow Valley get an area of its own in the locations store?
2. Norquay check-in: ask the operator, or accept the chair top as the place.

## Files written

`data/capture/canadian-rockies-2029/ORPH7.json` (new), `data/capture/canadian-rockies-2029/migrated.json` (`at` on the 7 offers),
`data/capture/points.json` (6 rows), `data/relevance/inputs/points.json` (rebuilt), `data/capture/derived-areas.json`,
`data/capture/gap-budget.json` (`E_PLACE_ORPHAN` 7 to 0, `W_TIER_REQUIRED.keys` 3731 to 3724), `data/sources/registry.json`
(rebuilt), `research/trips/canadian-rockies-sept-2029/adventure.md`, and this note.

## Requests

Overpass: one query at a time under `flock /tmp/travel-overpass.lock`. overpass-api.de returned 502 (at capacity) four times
before answering, and one try on a mirror timed out. Wikidata: 14 requests, 1.1 s apart, under `/tmp/travel-wikidata.lock`.
Every request sent the user agent `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`, with no email. Commons was not
called.

## Commands and results

- `capture.ts gaps --placement --trip canadian-rockies-2029`: records 205, no area 15, no point 0, approximate 8, no nearest
  town 0, outside its area 0, offers saying nowhere 0 (was 7).
- `capture.ts gaps --budget --check`: OK, no gap count rose.
- `validate.ts --all`: OK, 102 files. `capture.ts run --check` on the run record: OK.
- `relevance.ts check`: OK. `relevance.ts points --build --check`: OK. `relevance.ts derive --check`: OK. `suitability.ts check`: OK.
- `sources.ts check`: OK, 594 sources. `normalise.ts --check --family capture,points`: OK, the same findings as before the run.
- `slugs.ts --check`: OK. `tools/tree_check.py`: OK.
