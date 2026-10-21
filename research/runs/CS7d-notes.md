# CS7d: data batch 4 (batch A: duplicates, shells, Rockies stop points)

Read on 19 Oct 2026 by travel-researcher (Opus). Operator and official pages were read one at a time by the lead and three read-only
helpers. Overpass ran one request at a time under `/tmp/travel-overpass.lock` with the no-email UA (run record
`data/capture/runs/api-2026-10-19-cs7d-overpass.json`: 29 requests, 24 answered, 5 returned 502/504, no 429). No Wikidata, Nominatim or
Commons call was made. Every point is "agent checked, needs a person's check". Batch B (3.9, 3.10, 3.53, 3.47, 4.15, 3.50) follows
after PLC merges.

## 3.55 and 3.58 Duplicates

| Survivor (first) | Second record | Mark |
|---|---|---|
| `sights/radium-hot-springs` (radium-hot-springs) | `adventures/radium-hot-springs` (radium-hot-springs-pools) | same_place_as |
| `sights/red-rock-parkway` (red-rock-parkway-and-red-rock-canyon) | `adventures/red-rock-parkway` (waterton-red-rock-parkway) | same_place_as |
| `adventures/lake-louise-gondola` (lake-louise-summer-gondola) | `adventures/lake-louise-sightseeing` (lake-louise-sightseeing) | same_place_as |
| `adventures/canmore-nordic-centre` (canmore-nordic-centre-summer) | `part/.../canmore-nordic-centre#centre` (canmore-nordic-centre-provincial-park) | same_place_as |
| `adventures/banff-horse-ride` | `adventures/lake-louise-horse` | **none: not a duplicate** |

**How the mark is stored.** A capture record has no `same_place_as`, and capture `aliases` cannot be used: core's migration test pins the
world's alias count at 2 (`core/test/capture/migration.test.ts`). So each second record has a relevance record in
`data/relevance/canadian-rockies-2029/CS7d.json` whose only job is the mark: `same_place_as` the survivor, every judged field
`not_applicable` with the note "duplicate record of ...". Derive gives them role `local_only`, no badge and no pair. The two routes among
them carry `route_is_attraction` with a reason, as E_CAP_DRAW_LAYER asks. Neither side of any pair held a value the other lacked (both were
offplan suitability shells), so nothing moved; the ledger test is green.

**Horseback is two places.** Banff Trail Riders rides from its stables at the end of Sundance Road in Banff (horseback.com); Brewster
Adventures rides from Brewster Lake Louise Stables, 111 Lake Louise Drive (brewsteradventures.com). Different operators, towns about
55 km apart. Both records stay, and both now carry their operator's link and prices.

## 3.58 Shells

28 records on 26 shell pages now carry what their operator or land manager states (36 new sources): the official link on all 28, a season on
16, a price on 16, a duration on 12, hours on 2 (Banff Upper Hot Springs, the Fairmont spa), and 15 OSM points. `searched_none` with the
query: Brewster's season, the Golden Skybridge, White Mountain heli-hike and Jasper bike prices.

Facts worth a person's eye:
- **Nakiska** has no summer operation in 2026 (construction) and no gondola; summer activities open in 2027 on the Silver Chair.
- **Banff Upper Hot Springs** closes from 13 October to early November for repairs (no year on the page; modified 28 Sep 2026).
- **Burgess Shale**: Parks Canada (8+ Mount Stephen, 10+ Walcott) and the Burgess Shale Geoscience Foundation (6+ and 8+) run separate hikes
  at other prices. Only Parks Canada's values are stored; the Foundation is a second operator, not a conflict on one product.
- **Heli-hiking**: the same White Mountain page says mid-June to mid-October and, in its FAQ, mid-June to mid-September; stored as a conflict.
- **Fairmont spa** is now "Fairmont Spa" (no longer Willow Stream); facilities are 18+.
- **Lake Louise horseback**: the operator says 230 lb / 104 kg; an older search snippet said 250 lb. 132 cm and 8 years minimum.
- **Waterton shuttle**: whether the 35 CAD Crypt Landing fare is one-way or return is not stated; the departure table did not read cleanly.

Not filled (no source or no single point): Athabasca IceWalks meeting point, the Walcott meeting lot (unnamed in OSM), Lake Louise stables
(not in OSM), the Canmore heliport, the Jasper and Waterton horse record (two operators in one record), the Jasper bike and wildlife
tours (pickups), the four river parts (Kananaskis, Kicking Horse and its sections), Beagle Channel, Rienza, Grand Sault (no public trip).
Suitability limits (minimum age, weight, height) read from the operator pages are in the helper notes for batch B: they need a suitability
lane record per ref, which is a larger change than batch A.

## 3.35 Rockies stop points

| Stop | Point | Source |
|---|---|---|
| Kinney Lake (Day 6) | 53.04984, -119.21545 | OSM way 1185166549, the car park where the Berg Lake Trail (relation 6035635) starts, 125 m away |
| Elk rut (Day 1) | 51.17508, -115.57208 | OSM node 29546626 Banff town; Parks Canada says elk are seen "in town"; the rut has no single point |
| Jasper dark sky (Day 7) | 52.86934, -118.05812 | OSM node 4925566921 Old Fort Point, one of the four best locations on Parks Canada's dark-sky page, nearest the plan's Lake Annette evening |

All 30 Rockies stops now have a capture point; TRP wires them into the timeline.

## Research levels (all 353 pages, public adapter)

| | Basics only | Early research | Partly checked | Checked |
|---|---|---|---|---|
| Before batch A | 163 | 180 | 10 | 0 |
| After batch A | 160 | 183 | 10 | 0 |

The shells moved little in level because most of their checks are the family checks of "Who it suits", which batch A does not touch.

## Requests for builders

1. **PLC (3.55 collapse).** Collapse on a relevance `same_place_as` **only when the record carrying it has `draw.state ===
   "not_applicable"`**. Eight existing records use `same_place_as` for an activity at a place (Maligne, Minnewanka and three canoe records,
   the Ice Explorer, the minitrekking, the Montenvers train): those are two pages and must stay two. A ninth, the Canmore summer record,
   points at `sights/canmore-nordic-centre`, which is its own alias. The four marks above are the only duplicates.
2. **Core (later).** A capture-level duplicate field (or letting research lanes add aliases without breaking the migration count test)
   would be cleaner than a relevance record that exists only to carry the mark.
3. **PLC (shell rule).** After this batch, 21 pages still read as near-empty by the "name and kind only" test; the list is in the
   hand-back. Most now show a link, price or season in their sections even where the place facts are empty.

## Owner questions

- Canmore: the summer trails and the provincial park are an activity at a place, like the canoe and its lake. The brief lists them as a
  pair, so they are marked; keep them as one page? Recommendation: yes, one page, because the park page had no data of its own.
- Horseback: keep Banff and Lake Louise as two pages. Recommendation: yes.
