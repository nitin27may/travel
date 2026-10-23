# Nearby places, the Where filter and the smart trip builder

Status: spec, 20 Oct 2026. Written by travel-planner (Opus) from the owner's request of 20 Oct (backlog 8.1 to 8.6).
Nothing in it is built. It extends, and does not replace: smart-search.md (A5, A6, A14, Q37), relevance.md 3.2
(`pair_with`, Similar nearby), place-page-sections.md section 11, short-trips.md 4.1 (the hub matrix, row 3.12) and
trip-timeline.md 2.5 and 3.7 (drive legs, "Add to this day"). Where this page changes one of them, it says so in 9.

Principles cited: P1 scale, P3 glance, P4 no manual, P7 the 90%, P8 protect the catalogue, P9 one data boundary,
T1 when, T5 honest maps.

## 1. Goal and non-goals

**Goal.** A visitor can narrow Places by country, then region, then area, with counts at each step, and from any
place, town or city can see what is near it, by distance and direction, sorted nearest first. The same data then feeds a
trip builder that starts from a destination and suggests what to do around it. To make both work for every record, each
place, route, offer and event carries one placement block: its area chain, a sourced point and its nearest town.

| # | Owner ask (20 Oct) | Answer in this spec |
|---|---|---|
| 1 | Canada, then Alberta, then the city ("country, state and city"): see every place in Alberta, and what is near a city | The Where pill: Country, State or province, City (4) |
| 2 | Near one place or a city: "near Whitby" includes Oshawa and Ajax | Nearby (5): the place-page section, the list's near mode, the towns layer |
| 3 | Every record maps to the hierarchy and has a point | The data rule (3) |
| 4 | Reuse the country, state and city data we hold | 2.4 and 5.6: the tree and the gazetteer are reused for Where; the gazetteer is too coarse for towns, so a towns layer is added |
| 5 | Start from a destination, ask what is near for 7 or 8 days, choose by distance and fit | The smart trip builder (6) |
| 6 | Enhancements to Places now, ready for the planner later | Phasing (7) |

**Non-goals.**
- No routed drive times in the browser. The ORS key never ships to a client; routed times come from stored matrices.
- No server search or PostGIS before a backend exists for other reasons (P9: each server step replaces one adapter).
- No suggestions of places we have not researched on the public site (Q60).
- No new whole-catalogue file, and no request that returns every place (P8). Near mode is always a centre plus a capped radius.
- No change to the household privacy rule beyond the narrow towns exception the owner decides in Q50.

## 2. Data audit (20 Oct 2026, measured)

Method: node and python scripts under `/tmp/nearby-audit/` (not committed) over the built list shards
(`web/out/list/places/*/data.json`, built 20 Oct 15:25 from the v2 HEAD of that time), `data/locations/locations.json`,
`data/capture/**`, `data/capture/points.json`, `data/relevance/inputs/points.json` and `web/public/globe/data/gazetteer.json`.
Distances are great-circle (haversine), straight line.

### 2.1 Built place pages: point, chain and nearest town

The build has **359 place pages and 359 list rows** (the report of 20 Oct counted 364; the later build has 359).

| Measure | Count | Share |
|---|---|---|
| Rows with a point (`lat`, `lon`) | 238 | 66% |
| Rows with **no point** | **121** | 34% |
| Rows with a region in the chain | 359 | 100% |
| Rows with an area in the chain | 359 | 100% (2 rows use the region as the area) |
| Rows with a stored nearest town or city | **0** | 0%: no record has the field |
| Rows whose point is within 10 / 25 / 50 km of a gazetteer city (derivable today) | 33 / 75 / 135 of 238 | 14% / 32% / 57% |
| Pairs of rows within 200 m of each other (a place and its own walk) | 19 | Johnston Canyon and its walk, Athabasca Falls and its walk |

The backlog row 8.3 said 62 pages have no point. The real figure is 121: the L4b trail pages and the CS7 seeds added pages
without one.

**By country**

| Country | Rows | With point | Share |
|---|---|---|---|
| CA | 178 | 89 | 50% |
| IT | 61 | 55 | 90% |
| US | 61 | 50 | 82% |
| IS | 25 | 22 | 88% |
| FR | 14 | 10 | 71% |
| AR | 14 | 6 | 43% |
| VN, IN, CN, CH | 6 | 6 | 100% |

**By trip** (a place in two trips counts in both)

| Trip | Rows | With point | Share |
|---|---|---|---|
| canadian-rockies-2029 | 152 | 68 | 45% |
| no trip (the locations store) | 66 | 65 | 98% |
| dolomites-2027 | 52 | 46 | 88% |
| utah-five-parks | 26 | 17 | 65% |
| iceland-ring-road-2027 | 25 | 22 | 88% |
| patagonia-2027 | 14 | 6 | 43% |
| chamonix-mont-blanc-2028 | 13 | 9 | 69% |
| algonquin-muskoka-2026 | 5 | 1 | 20% |
| vermont-fall-2026 | 5 | 3 | 60% |
| new-hampshire-stopover-2026 | 1 | 1 | 100% |

**The 121 rows with no point, by kind:** trail 81, sight 14, activity 12, waterfall 4, viewpoint 4, area 2, lift 2,
lake 2. Most are Rockies trails: Moraine Lakeshore, Lake Agnes Tea House, Plain of Six Glaciers, Larch Valley to
Sentinel Pass, Johnson Lake Loop, Ink Pots. **23 of them already have a point in a sidecar** (`data/capture/points.json`
or `data/relevance/inputs/points.json`) that does not reach the list row: a join gap, not a research gap (row 8.7).

### 2.2 The locations store and the capture records

| Store | Records | `area_id` | Point | Notes |
|---|---|---|---|---|
| `locations.json` places | 74 | 74 (100%) | 73 (99%) | resolver: Wikidata 66, Nominatim 4, manual 3, none 1 |
| `locations.json` areas | 62 | every area has a region (62 of 62) | n/a | 25 regions, 7 countries |
| Capture records (`data/capture/<trip>/*.json`) | 394 (284 records, 110 parts) | **48 (12%)**: 24 places, 24 routes, 0 offers | 0 inline; **267 (68%)** have one in a sidecar | place 201, route 143, offer 49, event 1 |

The capture records rely on joins for placement: `area_id` comes mostly from the trip and the locations store at build
time, and points live in two sidecars. That works for pages but leaves no single rule a validator can check.

### 2.3 What "nearby" gives today (straight line, rows with a point only)

| Centre | Within 25 km | 50 km | 100 km | Nearest five |
|---|---|---|---|---|
| Moraine Lake | 9 | 31 | 45 | Moraine Lake Rockpile 0.7, Larch Valley 2.6, Sentinel Pass 3.2, Lake Louise 10.3, Lake Louise Summer Gondola 13.4 |
| Lake Louise | 10 | 21 | 45 | Summer Gondola 5.7, Sentinel Pass 7.9, Larch Valley 8.7, Moraine Lake Rockpile 9.9, Moraine Lake 10.3 |
| Montmorency Falls | **0** | 3 | 5 | La Crete trail, Mont-Sainte-Anne 27.6, Canyon Sainte-Anne 28.9, L'Eperon 35.7, Le Buton lookout 59.4, Mont du Dome 98.0 |
| Whitby (town centre) | **0** | **0** | **0** | Ragged Falls 166 km; next is the Finger Lakes at 219 km |
| Tre Cime di Lavaredo | 26 | 40 | 45 | its loop 1.0, north-face viewpoint 2.2, Cadini di Misurina 3.1, Strada per il Rifugio Auronzo 3.4, Monte Piana 3.8 |

Across all 238 pointed rows, 168 (71%) have a neighbour within 25 km and 192 (81%) within 50 km.

**What it implies.** In the Dolomites and around Lake Louise the feature already works. Around Lake Louise it misses the
best-known walks (Lake Agnes, the Lakeshore, Plain of Six Glaciers), because those trails have no point. Around Quebec
City it finds 5 places within 100 km. **Around Whitby it finds nothing**: Ontario has 5 places, all in Muskoka and
Algonquin. "Near Whitby" for a day trip only becomes useful when the catalogue grows around the Toronto hubs. Until then,
the honest result is the towns around it and an empty state that says so.

### 2.4 Towns and cities in the data we ship

| Source | Rows | What it holds | Whitby | Oshawa | Ajax | Fit for "nearest town" |
|---|---|---|---|---|---|---|
| `web/public/globe/data/gazetteer.json` (Natural Earth 10m populated places, plus admin-1, countries, physical, marine) | 13,741 rows, 898 KB raw, 316 KB gzip; **7,342 cities** with a scale rank (0-10) and a population | Canada 255 cities (Ontario 47, Alberta 22, Quebec 40), US 769, Italy 56, France 71, Iceland 9 | **no** | yes (rank 8, pop 450,963) | **no** | **No.** Too coarse: Tre Cime's nearest is Bolzano at 73.5 km; Cortina d'Ampezzo, Canmore, Huntsville, Levis and Pickering are missing |
| `cities-adm8.json` (OSM admin_level 8 outlines) | 45 municipalities | only those that hold our places (Cortina d'Ampezzo, Beaupre, Stowe ...) | no | no | no | No: chosen for the globe, not a gazetteer |
| `data/relevance/inputs/points.json` `towns` | 33 | the trip bases (Banff, Akureyri, Argentiere ...) with Wikidata points | no | no | no | Partly: real bases, but only 33 |
| Area tree (`/globe-data/index.json`, 16.5 KB) | countries, regions, 140 areas with place counts | parks and municipalities, mixed ("Banff" the town and "Banff National Park" both exist; A14 joins them) | no | no | no | Yes for the Where cascade; no for towns |

**Implication.** The tree is enough for the country and province levels of the Where filter, with no new file (4.7); the city level needs the towns layer. For towns we need a proper layer
(5.6). GeoNames `cities1000` (CC BY 4.0) holds Whitby, Oshawa, Ajax, Pickering, Canmore, Cortina and Huntsville, with
population and admin-1 codes. From the sizes on GeoNames, the subset within 100 km of our points is an estimate of
1,500 to 3,000 rows. The builder measures the real figure.

**Privacy (a real conflict).** "Whitby" is the household's home town. `web/lib/public/origin.ts` rewrites every
"whitby" string in public output to "Toronto" and moves any point within 2 km of it to Toronto City Hall, and the privacy
tests fail on the string. A public towns layer that holds Whitby, and a chip "Within 25 km of Whitby", would trip both.
This is owner question Q50.

**Settled (owner ruling 23 Oct 2026, Q87 reopened, FINAL; API-3c).** The home town is in the towns layer like any town,
shown exactly as the public GeoNames and OSM data show it: nothing moved, nothing dropped, nothing flagged. The site then
reveals nothing that the public maps do not already show. The household stays private because the site never publishes a
point of the household's, not because it changes public ones. The privacy check accepts a town's point only when it
equals the loaded public gazetteer point for that town id; any other point within 2 km of home still fails closed. The
rule is generic and names no town (5.6, "Privacy"). The contract is `core/src/catalogue/store.ts` A33; the code is
`core/src/privacy/towns.ts` (`publicTownLayer`, `publicGazetteer`) and `core/src/privacy/detect.ts`; contract case K26
plants a town 0.5 km from home and proves it is served unchanged, with no 500, and that only the identity rule lets it
through. API-3a's moved centre and dropped outlines are withdrawn: a diff against GeoNames would have shown which town was
changed, which said more about home than the public data does (review API3-R-3).

## 3. The data rule (8.3): one placement block on every record

### 3.1 The block

Every place, route, offer and event resolves to this block. Most of it already exists as registry properties (`point`
and `area_id` are base R). The rule makes it complete, gives it one home and makes it checkable.

| Field | Home | Mark | Source order | Rule |
|---|---|---|---|---|
| `area_id` | the record (`capture/1`) | R (exists) | the locations store, the trip, then point-in-polygon against the area tree | `CC/REGION/area-slug`. **Country and region are read from it, never stored again**, so the chain cannot disagree with itself |
| `point` | `data/capture/points.json`, keyed by ref (exists) | R (exists) | D: OSM node or way, Wikidata P625; F: the agency page; manual last | `{lat, lon}`. Never from Google (T5) |
| `point_role` | with the point (**new**) | R | as the point | `centre`, `trailhead`, `entrance`, `parking`, `meeting`, `summit`, `route_start` (`POINT_ROLE` in `core/src/schema/enums.ts`, defined once). Directions and distances use it: a trail's point is its trailhead, a lift's its lower station. A row with no role reads as its type's default (capture contract 3.7.1) |
| `point_source`, `point_checked` | with the point (exist in points.json) | R | | the source row and who checked it, when |
| `approx` | with the point (**new**) | R | | `true` when the point is a centroid or a guess, with `approx_note` saying why. Approximate points count for Where but **never for distances** (T5) |
| `near_town` | the record (**new property**) | R in the placement block (`W_PLACE_TOWN`); registry mark N until META-2 derives it, computed (X) | derived from the towns layer; a researcher can override it with the town the operator names | A town id `<cc>-<admin1>-<slug>`, for example `ca-on-whitby` (owner Q76), and `near_town_km`. `<admin1>` is the lower-case ISO 3166-2 subdivision suffix (`on`, `ab`), not the GeoNames admin1 code (Ontario is `08`), so META-2 maps one to the other; `00` when the country has none. The nearest settlement of at least 1,000 people within 50 km, else the value `none_within_50km`, never a gap. Rule and codes: capture contract 3.7 |

**Offers and events** do not carry their own point. They inherit placement through `at`, `on` or `starts_at` (capture
contract 2.5). The rule is met when that chain ends at a place or route that has the block. **Routes** carry the start
(`point_role: trailhead`), and point-to-point routes also carry `ends_at` with its own point.

### 3.2 Contract change, in the registry style

One new property in `core/src/schema/capture/properties.ts`, in the identity group beside `area_id`:

```ts
def({ key: "near_town", group: "identity", label: "Nearest town", value: "ref", section: "access",
      display: ["rest"], base: "R", gap: "Nearest town not worked out yet", home: cap("near_town") }),
```

`point_role` and `approx` are fields of the `point` value type, not properties. They change the `point` value schema in
`core/src/schema/capture/` and the points sidecar schema. The registry row for `point` stays as it is.

A **placement rule** is a record-level rule. It is not a property, because it spans fields and layers:

```
placement(record):
  place, route  -> area_id in the tree; point (or approx point); near_town (derived)
  offer, event  -> one of at / on / starts_at resolves to a place or route that passes placement
```

### 3.3 What the tools print

- **`capture.ts fields --type <id>`** prints a "Placement (every record)" block first, before the type's own groups:
  `area_id`, `point` with its role for this type (a trail asks for the trailhead, a viewpoint for the viewpoint, a lift
  for the lower station), `near_town` ("computed; override only when the operator names a town"), and the source order.
  The JSON format carries the same block, so crawlers and the MCP `profile://type/<id>` resource see it.
- **`capture.ts gaps --placement [--trip <t>]`**, a new mode. It prints one table per trip, then the records:

```
Placement gaps: canadian-rockies-2029
records 152 · no area 0 · no point 84 · approximate 0 · no nearest town 152 · outside its area 0
  place/moraine-lakeshore          no point        role trailhead  hint: track start (data/tracks) or OSM
  place/lake-agnes-tea-house       no point        role centre     hint: Wikidata P625 (QID not linked yet)
  ...
```

- **The researcher brief** (`.claude/agents/travel-researcher.md`, and every research lane brief) gains one line: "Every
  record you add or touch leaves with its placement block: area, point with its role and source, and no approximate point
  unless you say why." The lane hand-back includes `gaps --placement` for its trip.

### 3.4 Validator

New codes in the capture validator, run by `bash tools/check-all.sh`:

| Code | Level | When |
|---|---|---|
| `E_PLACE_AREA` | error | a place or route with no `area_id`, or an `area_id` not in the tree |
| `E_PLACE_ORPHAN` | error | an offer or event whose `at`, `on` and `starts_at` all fail to resolve |
| `W_PLACE_POINT` | warning, error after migration | a place or route with no point |
| `W_PLACE_APPROX` | warning | an approximate point with no note |
| `E_PLACE_FAR` | error | the point lies more than 25 km outside the bounding box of its area (a wrong area or a swapped lat and lon) |
| `W_PLACE_TOWN` | warning | `near_town` not derived (the derive step was not run) |

Migrated records are pinned by `migration-ledger.json`, so the new checks warn on them until migration step 5 below, then
the two warnings become errors. New records get errors from day one, so the gap cannot grow.

### 3.5 Migration of existing records

| Step | What | Records | Needs research? |
|---|---|---|---|
| 1 | **Join fix.** List rows read the point from `data/capture/points.json`, then `data/relevance/inputs/points.json`, by ref, before saying "no point" | 23 rows gain a point | no |
| 2 | **Area from the hierarchy.** Write `area_id` onto capture records from, in order: the locations store, the trip's placement, the parent through `part_of`, `at` or `starts_at`, then point-in-polygon against the area tree | the 346 records without one (296 of them offers, parts or routes that inherit) | no |
| 3 | **Trail points from what we hold.** A trail's trailhead from its `starts_at` access point, then the first vertex of a confirmed L4b track, then the OSM trailhead node the track matcher found | part of the 81 trails | no (data we hold) |
| 4 | **Points from open data.** Wikidata P625 by QID, then OSM through the existing Overpass runner (one runner, `flock`) | the rest of the 121 | yes, a light pass: open data only, no operator pages (Q58) |
| 5 | **Nearest town, derived** for every record with a non-approximate point, once the towns layer exists | all | no |
| 6 | Turn `W_PLACE_POINT` into an error. Any record still without a point is listed in the research backlog by trip, public trips first (Q23 order) | the remainder | yes, when research resumes |

## 4. The Where filter (8.1): country, state or province, city

The owner's wording (20 Oct, repeated with a screenshot of the bar showing only a Country pill): "we need to filter by
country, state and city too". The control therefore has **three levels: Country, State or province, City**. Parks and
other areas of our tree are a group inside the third level, not a fourth level.

### 4.1 What exists today

- `region` and `area` are already facets of the Places descriptor (`dependsOn: 'country'` and `dependsOn: 'region'`,
  tier `more`). They show under "More filters" only after a country is picked, which is why the owner sees a Country pill
  and nothing else. The URL keys `country`, `region` and `area` already work, and the smart-search parser writes them
  (A5, A14).
- **There is no city level.** Our "areas" are mostly land-manager units: Banff National Park, Peter Lougheed, Spray
  Valley, Chamonix Valley. Some are municipalities (Banff the town, Canmore, Auronzo). No row carries a city (2.1), and the
  gazetteer we ship is too coarse to supply one (2.4). The city level needs the towns layer (5.6, row 8.4).

### 4.2 Levels and URL keys

| Level | Label | URL key | Values come from | Selection |
|---|---|---|---|---|
| 1 | Country | `country` (exists) | the row's country | single |
| 2 | State or province (the label follows the country: "Province" for Canada, "State" for the US, "Region" for Italy, France and Iceland) | `region` (exists) | the row's region | multi within the country |
| 3a | City or town | **`city`, new**: a towns-layer id, for example `city=ca-on-whitby` | the towns layer (5.6) | single |
| 3b | Park or area | `area` (exists) | the area tree | multi within the region |

**Why a new `city` key and not `area` (Q62).** An area is a polygon-like unit we file places under. A city is a point with
a radius: "Banff" the town and "Banff National Park" are different questions. A city chosen in Where means "what is in
and around this city". Reusing `area` would mix a membership filter with a distance filter under one key, and it would
break the old `area=` links. There is one exception: where a tree area *is* the municipality (the area "banff" and the
city Banff, joined by A14's name rule), the menu shows one row, the city, and `area=banff` links keep working as
before.

**What a city selection does.** It works like a near query anchored on the city:
- **Results:** places within the city radius of the city centre. The default is 25 km, adjustable with `r` (10, 25, 50,
  100; Q56).
- **Order:** nearest first.
- **Towns strip:** the towns inside the radius, so Whitby lists Oshawa (6 km E) and Ajax (8 km WSW). Each is a link to
  the same view centred on that town.
- **Count:** the menu's count for a city is the number of places within 25 km under the other filters. A place inside
  the radius counts whatever its own region, so a city on a border counts across it.
- **Keys:** `city` sets `country` and `region` too, so the chips read Canada, Ontario, Whitby, and removing Ontario
  removes Whitby.

### 4.3 The control

The **Country pill becomes "Where"**. It takes the same slot, so the bar keeps four pills (Where, Kind, Season, Youngest
child), and six when Kind is scoped (Q27). Region and Area leave "More filters". This matches Trips, whose first pill is
already Where.

- **One cascading menu: Country, then State or province, then City.** The third column has two groups:
  - "Cities and towns": the towns of the region with at least one place within 25 km, ordered by that count;
  - "Parks and areas": the tree areas, ordered by place count.
- **Counts.** Every option shows its count under the other active filters. Options are ordered by count, with names as
  the tie-break.
- **"All of Alberta"** sits at the top of each level and clears the level below.
- **Cities with no places nearby** are not listed (P1: Ontario has hundreds of towns). The find field still reaches them:
  "Whitby · 0 within 25 km · nearest place 166 km". Picking one gives the honest empty state (5.3) and the towns strip.
- **The pill label** names the deepest choice: "Where · Alberta", "Where · Canmore", "Where · Banff National Park, Yoho"
  or "Where · 3 areas".
- **Chips.** One chip per level: "Canada x", "Alberta x" and "Canmore · 25 km x". The city chip opens its radius
  stepper. Removing a parent removes its children, which `filter.ts` already does.
- **Type to find.** A field at the top of the menu ("Find a state, city or park") searches all three levels at once. It
  matches `regionAliases`, the area names and the towns part of the chosen country, so "AB", "Alta", "Canmore" and
  "Whitby" all work.
- **City and area together.** A city and a park can both be chosen ("near Canmore", in Spray Valley). The result is the
  intersection, and the count line names both.

### 4.4 Wireframes

Desktop, 1440, the menu open after Canada then Alberta. The city counts are measured on today's rows with a point
(2.3). Jasper reads 3 only because its trails have no point yet (2.1).

```
[Search places                    ]  [Where · Alberta v] [Kind v] [Season v] [Youngest child v]  More filters
+-----------------------------------------------------------------------------------+
| [Find a state, city or park                    ]                                  |
| COUNTRY            | PROVINCE in Canada      | CITY OR AREA in Alberta             |
|  Canada      178 > |  All of Canada          |  All of Alberta                116  |
|  Italy        61   |  Alberta        116 >   |  CITIES AND TOWNS (within 25 km)    |
|  United States 61  |  British Columbia 56    |  ( ) Banff                      23  |
|  Iceland      25   |  Quebec          21     |  ( ) Canmore                    19  |
|  Argentina    14   |  Ontario          5     |  ( ) Lake Louise                11  |
|  France       14   |                         |  ( ) Jasper                      3  |
|  4 more            |                         |  PARKS AND AREAS                    |
|                    |                         |  [ ] Banff National Park        45  |
|                    |                         |  [ ] Jasper National Park       29  |
|                    |                         |  [ ] Peter Lougheed             12  |
|                    |                         |  14 more                            |
|                                                           Clear Where    [Show 116] |
+-----------------------------------------------------------------------------------+
116 of 359 places · Alberta, Canada
(Canada x) (Alberta x)  Clear all
```

After Canmore is picked:

```
19 places within 25 km of Canmore · nearest first
Towns in this radius: Banff 18 km NW · and the smaller ones the towns layer holds
(Canada x) (Alberta x) (Canmore · 25 km v x)  Clear all
```

Phone, 390: the menu drills down in place, inside the expanded filter panel. It is non-modal, with no scrim and no focus
trap, like every overlay in the LST note.

```
+--------------------------------------+   +--------------------------------------+   +--------------------------------------+
| < Where                     Done     |   | < Canada                    Done     |   | < Alberta                   Done     |
| [Find a state, city or park      ]   |   | [Find a state, city or park      ]   |   | [Find a state, city or park      ]   |
| Canada                     178  >    |   | All of Canada               178      |   | All of Alberta              116      |
| Italy                       61  >    |   | Alberta                     116  >   |   | CITIES AND TOWNS                     |
| United States               61  >    |   | British Columbia             56  >   |   | Banff                        23      |
| Iceland                     25  >    |   | Quebec                       21  >   |   | Canmore                      19      |
| 6 more                               |   | Ontario                       5  >   |   | PARKS AND AREAS                      |
+--------------------------------------+   +--------------------------------------+   | [ ] Banff National Park      45      |
                                                                                      +--------------------------------------+
```

- The phone summary bar reads "116 places · Alberta · 1 filter", and "19 places · near Canmore · 1 filter" once a city is
  picked. Where counts as one filter, whatever its depth.
- Each row is 44 px (`--touch-min`). The back row names the parent ("< Canada"). Tapping a city applies it and closes
  the panel, because it is a single choice. Areas are checkboxes and need Done. Done returns focus to the pill.

### 4.5 Keyboard and screen readers

- The pill is a button with `aria-expanded`. The menu is three listboxes on desktop, and one listbox per level on phone.
  The two groups of the third level are labelled groups.
- Up and Down move within a level. Right or Enter on a parent opens the next level and moves focus there. Left goes back
  up. Enter picks a city, and Space toggles an area. Esc closes the menu and returns focus to the pill. Typing goes to the
  find field.
- Accessible names carry the count and its meaning: "Alberta, 116 places", "Canmore, 19 places within 25 kilometres".

### 4.6 Empty states

- **A level with no match.** Options with 0 under the other filters are hidden behind one muted line: "3 more provinces
  have no waterfalls · Show". Shown, they are muted with a 0 and can still be picked.
- **An empty result.** This uses the nearest-match rule (P4). For a city, widen the radius first ("0 within 25 km of
  Whitby. Nearest place in our catalogue: Ragged Falls, 166 km N"). For an area or a province, move up a level ("No
  waterfalls in Spray Valley yet. 6 in Alberta"), then try a neighbouring province ("4 in British Columbia"). Each is one
  button. `k` is never relaxed first (LST rulings).
- **A province with few places** (Ontario 5) shows them all, with no empty-state copy.

### 4.7 Files and P8

- **Before the towns layer** (phase N0): no new file. Country counts are in the manifest (12 KB). Province and area counts
  come from the loaded country rows (one file of at most 300 rows). The city group is not drawn.
- **With the towns layer** (N1): the city group needs the towns of the chosen province and the distances to the rows.
  - Each row gains a `near_town` id (a label, inside the P8 allowlist; one field).
  - The build writes per-city counts into `/list/places/where-<cc>.json`: town id, name, point, places within 25 km.
    That is about 60 bytes a listed city. Canada today lists an estimated 30 cities, about 2 KB.
  - The find field reaches unlisted towns through the towns part of the province (5.6), loaded only when the visitor
    types.
- **At scale** (a country above 300 rows): the same `where-<cc>.json` also carries the province and area counts, and the
  shard key becomes `<cc>-<region>` (8.11), so choosing Alberta loads Alberta's files only. A city near a provincial
  border loads the neighbouring province's file only if the circle meets its bbox (5.7).
- Names, points and counts are public already (on the globe and in GeoNames), so P8 holds.

### 4.8 Search and Trips

- **"Alberta" typed in search** resolves through A5 to `country=CA&region=alberta`. The list's own box writes the keys,
  so the pill shows "Where · Alberta". "Banff" resolves through A14 to the Banff areas and, once the towns layer exists,
  to the city Banff, which is offered first.
- **A town that is not in the tree** ("Canmore", "Whitby") resolves to `city=` through the towns layer: "near Whitby"
  writes `country=CA&region=ontario&city=ca-on-whitby`. That one key serves Where, search and near mode for a town.
- **Trips.** The Where pill gains the province level (8.12): a trip row's regions are the regions of its stops. Trip rows
  ship whole, so this costs one field per row and no file. Trips get no city level: "trips through Canmore" is a place
  question. It is phase N1, not launch.

## 5. Nearby (8.2, 8.4)

### 5.1 The model

- **Distance is straight line first.** It comes from our own non-approximate points, never Google's (T5). It is always
  shown in km, with a compass direction from the centre: N, NE, E and so on (8 points).
- **Drive time is an estimate until a matrix exists.** The timeline's rule (trip-timeline 2.5: distance x 1.42, plus
  1.5 km under 60 km, at 46 km/h or 72 above 60 km, plus 3 min) overstates highway drives badly. Whitby to Toronto, 44.6
  km straight, comes out at 88 min, against the real 45 to 60 min with no traffic. So nearby lists show **bands, not
  minutes**: "under 15 min ≈", "15-30 min ≈", "30-60 min ≈", "1-2 h ≈". Each band carries the "Drive time estimated"
  chip, and the chip's tooltip explains it (Q57).
- **Routed times come later**, from a stored ORS matrix. It covers each base and hub against every place within 100 km
  (8.13). It runs sequentially from one lane at build time and is committed like `from-hubs.json`. Where a routed value
  exists, it replaces the band with "about 25 min". `basis: 'routed'` versus `'estimate'` is the same field as in
  short-trips 2.2.
- **Walks.** A distance under 1.2 km is a walk ("8 min walk ≈"), using the same rule as the timeline.
- **Collapse pairs.** A place and a route that starts at it, within 200 m (19 such pairs today), show as one row: "Johnston
  Canyon · and its walk".

### 5.2 The "Nearby" section on place pages

This extends section 11 of place-page-sections.md. Its two existing blocks stay first: "Nearby, worth adding" (pairs,
"as well as") and "Similar nearby" ("instead of"), both capped at 25 km (`NEARBY_MAX_KM`). A third block follows:

```
11  Nearby
    Nearby, worth adding          (pairs, unchanged)
    Similar nearby                (substitutes, unchanged)
    Around here                   within 25 km · 9 places
      A short walk
        Moraine Lake Rockpile       viewpoint   0.7 km NW   10 min walk ≈
      A short drive
        Larch Valley                area        2.6 km SW   under 15 min ≈
        Lake Louise                 lake        10 km N     15-30 min ≈   Worth the journey
        Lake Louise Summer Gondola  lift        13 km NE    15-30 min ≈
      Day trips (25-100 km)         36 more · Show on the map  ->  /places/?near=place:moraine-lake&r=100
    Towns: Lake Louise 12 km N · Banff 52 km SE
```

- **What it shows.** Up to 8 places within 25 km, grouped by distance band (walk, short drive, then a "Day trips" link),
  and then by kind within a band. The relevance badge is shown when present. The "Kids from" fade applies under the
  page's party profile, as on cards.
- **Day-trip fit.** "Day trips (25-100 km)" is a count and a link, not a list, so the page stays short (P2). It opens
  the list in near mode at r=100.
- **Towns** (once 8.4 lands): the nearest two or three towns, each a link to near mode on that town.
- **Empty.** "No other place within 25 km is in our catalogue yet · checked <build date>" is a value (PS14). The day-trip
  link still shows when the 100 km count is above 0.
- **No point, or an approximate one.** The block is not drawn. Section 7 already says "Location approximate".
- **Built at build time**, into the page's own HTML, from rows the build already holds. It adds about 1.5 KB a page and
  no file. Each row holds a name, slug, kind, km, direction, band and badge: fields cards already show (the P8 allowlist).

### 5.3 Near mode in the Places list

```
/places/?near=place:moraine-lake&r=25
/places/?country=CA&region=ontario&city=ca-on-whitby&k=nature.trail     (a town: the Where key, 4.2)
/places/?near=area:ca-alberta-spray-valley&r=50
```

- **URL keys.** A town or city centre is the Where key `city=` (4.2), so one key means one thing. A place or area
  centre is `near=<type>:<id>` (type `place` or `area`; an area means its centre). `r=<km>` sets the radius for either.
  `near` and `r` are new top-level `ListState` fields beside `bbox`, not facets, and `city` is a facet key with `dependsOn: 'region'`. All other filters combine with them. `parseState` drops `r` without `near` or
  `city`, and drops `near` when `city` is set (the city wins).
- **Radius presets:** 10, 25, 50 and 100 km. The default is 25 km for a place, a town or a city, and 50 for an area centre. **The cap is
  100**: a larger `r` is clamped to 100 and the chip says so. There is no "everything near nothing" state.
- **The bar.** A near chip leads the chips: "Within 25 km of Moraine Lake x". It has a radius stepper inside its menu
  (the four presets) and the centre's own link. Where and near can combine ("Alberta" and "within 25 km of Canmore");
  the count line names both.
- **Sort.** The default sort in near mode is distance, nearest first, and the count line says "nearest first". Each card
  and row shows "12 km NE · 15-30 min ≈" in its mono line. Table view gains a Distance column. The other sorts still work.
- **Map view** draws the centre (a ring pin, not an amber pin), a circle of radius `r` and the results. "Search this
  area" (the existing `bbox`) leaves near mode.
- **Groups.** "Group by distance band" joins the group options (walk, short drive, 25-50, 50-100).
- **Towns strip.** Above the results, a quiet line lists the towns inside the radius from the towns layer: "Towns in this
  radius: Oshawa 6 km E · Ajax 8 km WSW · Pickering 13 km WSW · Bowmanville 21 km E". Each town opens near mode on that
  town. This is how "near Whitby" includes Oshawa and Ajax, as places to go and as centres (Q50).
- **Empty.** "No place in our catalogue within 25 km of Whitby yet." It offers the next radius with results ("2 within
  100 km · Show") and the towns strip. It never invents places (non-goal).

### 5.4 Relevance badges and "Nearby, worth adding"

- The near list orders by distance, but the relevance badge stays on every card. A "Worth the journey first" sort is one
  click away, using the vacation order of Q18.
- `pair_with` (walk pairs within 1.5 km) and Similar nearby (25 km) are unchanged. They are judged; Around here is plain
  distance. The section keeps the judged blocks first, so a visitor reads our advice before the raw list.
- A badge's "far-visitor pointer" ("Coming from far? Nearby, X is the one people travel for") uses the same distance
  function, so all four consumers share one module: `lib/public/nearby.ts`. It is pure, so a server can run it unchanged.

### 5.5 Smart search into near mode

| Query | Today (SQ1) | With this spec |
|---|---|---|
| "near Banff" | A14: both Banff areas | unchanged: an area in the tree wins (A5) |
| "near Lake Louise" | A6: the place's area | **A6 changes**: `near=place:lake-louise&r=25`, chip "Within 25 km of Lake Louise". The area reading becomes "Did you mean: Banff National Park" |
| "near Whitby", "near Toronto" | ignored (Q37) | town lookup: `country=CA&region=ontario&city=ca-on-whitby` (Q37 closed) |
| "waterfalls within 50 km of Quebec City" | the figure is unused | `city=ca-qc-quebec&r=50&k=water.falls` (with its country and region). "within N km of" sets `r` to the nearest preset at or above N |
| "day trips from Calgary" | none | `city=ca-ab-calgary&r=100`, sorted by distance, with the 1-2 h band chip |

- **Resolution order** for a place-like phrase after "near", "around", "close to" or "within N km of": an exact tree area
  first, then a place name, then a town. Ties go to "Did you mean", as in A5.
- **Towns load like search parts.** The parser looks a word up in a towns part only when the search manifest's 3-letter
  prefixes say a town part holds it. So "Whit" loads the Ontario towns part, about 3 KB gzip, and nothing else.

### 5.6 The towns and cities layer (8.4)

- **Source.** GeoNames `cities1000` (CC BY 4.0, credited on /about/data/), plus our 33 trip bases and the short-trip hubs.
  It is filtered at build time to settlements within 100 km of any public place point, plus every hub (Q55). Natural Earth
  stays the globe's gazetteer and is not reused for towns (2.4).
- **Script.** `tools/towns.py` downloads once, caches under the globe tools cache and writes
  `data/reference/towns/<cc>.json`, committed and regenerable. Each row is `[id, name, lat, lon, pop, admin1, ascii]`. The
  id is `<cc>-<admin1>-<slug>`, for example `ca-on-whitby`.
- **Size.** An estimated 1,500 to 3,000 rows today, about 60 to 120 KB raw over all countries. Each region part is
  estimated at 2 to 15 KB gzip; the budget is 20 KB gzip a part, and the build fails above it. At 10,000 places the
  filter radius bounds it: towns grow with the places, not with the world.
- **How Whitby, Oshawa and Ajax resolve.** All three are in `cities1000` (populations of about 138k, 175k and 126k), in
  Ontario admin-1 `08`, so they land in the part `town-ca-on`. Whitby to Oshawa is 6.2 km E and to Ajax 8.1 km WSW
  (centres from public sources, to be replaced by the GeoNames points).
- **Uses.** `near_town` derivation, the Where city level (4.2), the towns strip, the parser, the planner's base
  picker (6), and the globe's city outlines (row 9.3).
- **Built once, shared with the globe's city outlines (9.3).** The globe outlines a state when one is picked, but a city
  falls back to a ring, because OSM admin-level-8 polygons were prebuilt for only 45 cities (`cities-adm8.json`, 120 KB).
  Row 9.3 outlines every city of the towns layer, so both rows read the same list and the same ids:
  - **One script, one list.** `tools/towns.py` writes `data/reference/towns/<cc>.json`. Each row carries a Wikidata QID
    where GeoNames links one, and the QID joins it to the OSM boundary relation. GLB2's outline step reads that file;
    it never builds its own city list.
  - **Points and outlines are separate files.** The points (5.7) are small and load with the parser or the Where menu.
    The outlines are larger and load only when a city is picked on the globe.
  - **Outline scope and size (estimates for GLB2 to measure first).** Outline only the towns that are listed somewhere:
    those with at least one place within 25 km, plus the hubs and bases. That is an estimated 300 to 600 cities today.
    Simplified to about 1 to 3 KB a city, that is about 0.5 to 1.5 MB raw in total.
  - **Outline files.** One file per city, `/globe/city/<town-id>.json`, at about 1 to 2 KB gzip, is loaded on the pick.
    Per-city files beat per-country parts here: a pick needs one outline, never the country's.
  - **Fallback.** A town without an OSM polygon keeps the ring, and the card says why.
  - **P8.** The geometry is ODbL, not catalogue, so the limit is the payload, not the catalogue.
- **Privacy: public towns, shown exactly (owner ruling 23 Oct 2026, Q87 reopened, FINAL; API-3c, replacing API-3a's
  safe geometry).** The fact to hide is where the household lives. That a town exists, where its centre is and where its
  border runs is public: GeoNames and OSM publish it. So the home town is in the layer like Oshawa and Ajax, at its public
  centre with its public outline, and "near Whitby" works.
  1. **At load, every town, never by name.** The towns loader (META-2) calls `publicTownLayer(towns, outlines)` in
     `core/src/privacy/towns.ts` before a store holds the rows (store.ts A18). It serves the rows as loaded (`safeTown` and
     `safeOutline` are the identity) and builds the `PublicGazetteer` from the same rows. The store exposes it through
     `publicTowns()`, and respond() and the contract kit hand it to the detector. Neither file names a town; a test greps
     both for the home town's pattern and for coordinates.
  2. **Nothing is moved, dropped or flagged.** No rule depends on where home is, so no town's output changes because home
     is near it. Distances from a town ("within 25 km of Whitby") are measured from its true public centre.
  3. **The detector accepts public towns by identity only.** A point within 2 km of home passes only in an object whose
     `id` or `key` is a gazetteer town id and whose `lat`/`lon` equal that town's gazetteer point exactly; a coordinate
     pair only as an exact vertex of that town's gazetteer outline. A place's point, a moved centre, another town's point,
     a planted point under a real town id, or an id the gazetteer does not hold still answers 500.
  4. **The name.** The home-town text rule is lifted only for a gazetteer town id (under `id`, `key`, `value`, `nearTown`,
     `townId` or in a `city` array, that string only), a short name or chip label of an object whose `id`, `key`, `value`
     or chip `set.city` is a gazetteer id and that holds its gazetteer name, and `city=<id>` in an href. A place whose
     `nearTown` is the home town is exempt in that field only; its name is still read (review API3-R-2).
  5. **The search box is not an oracle.** Search, parse and card search echo the visitor's words. The detector does not
     read an echo of the request's own strings as household text, so searching for any town's name, the home town's
     included, answers 200 like every other (store.ts A40, case K29).
  6. **Residual risk, for the owner.** The site shows nothing about towns beyond what the free GeoNames and OSM files
     show, so comparing them reveals nothing. What stays private is everything below that: the household point, trip
     origins and planning notes, which the scrub and the detector keep out. The one trust root is the towns FILE: a row
     edited by hand to a household point would be served and accepted, so `tools/towns.py` writes it from the GeoNames dump
     verbatim (META-2). `TOWN_POLICY = "exclude"` is still a documented switch, but it is a product choice, not a privacy
     one: a missing town is itself a diff against GeoNames.
  7. **Route lines are not towns.** A routed leg is not public gazetteer data, so a leg with a vertex within 2 km of home
     is still served with no geometry (`safeLine`, store.ts A34; review API3-R-5 is open for TRP2b).
  Proof: contract case K26 plants a town 0.5 km from home with an outline around it and a neighbour whose outline reaches
  within 1.5 km, and requires every town method to serve them exactly, with no 500 and a clean K7 scan with the store's
  gazetteer; the same outputs without the gazetteer, and a moved, swapped or planted point with it, must fail.

### 5.7 Files, sizes and how P8 holds

> **Superseded in part (20 Oct 2026, owner: API-over-JSON now, deployment out of scope).** The default path is no longer static files. Near mode, the Where counts, the towns and the Around here block are `CatalogueStore` methods (`near`, `countPlaces`, `towns`, `nearbyForPlace`) served by route handlers under `/api/v1/` (`GET /api/v1/near`, `/api/v1/places/counts`, `/api/v1/towns`, `/api/v1/places/{slug}/nearby`), with shared Zod contracts in `core/src/schema/api/` and the pure logic in `core/src/nearby/` and `core/src/geo/`. **The caps (radius clamped to 100 km, no unscoped query, page size) live inside those methods and are tested by the contract kit**, not by the file layout. The files in the table below remain as the `StaticAdapter` fallback and build-time path. "At a server step, `GET /api/places?near=&r=` replaces steps 1 and 2" is now true from phase B, and a `SupabaseStore` (lane SRV-0) later implements the same methods with PostGIS. The functions named below move: `resolveNear`, `nearPlaces`, `townsNear`, `townParts` stay as `DataClient` exports and call the API; `nearbyForPlace` lives in `core/src/nearby/`, not `web/lib/public/nearby.ts`. See [build/public-site/EXECUTION-PLAN.md](../build/public-site/EXECUTION-PLAN.md) section 4.

| File | Built from | Size | Scope | Loaded when |
|---|---|---|---|---|
| Place page Around here block | build rows | about 1.5 KB a page, in its HTML | one place | with the page |
| `/list/places/manifest.json` gains a bbox per shard, `b: [w, s, e, n]` | shards | +40 bytes a shard | none | as today |
| `/list/places/where-<cc>.json` (only when a country has more than one shard) | rows | about 4 KB | one country | the Where menu, at that country |
| `/search/town-<cc>-<region>/data.json` | `data/reference/towns` | 2 to 15 KB gzip (estimate) | one region | the parser, the Where find field or a `city=` view needs a town there |
| `/globe/city/<town-id>.json` (row 9.3, lane GLB2) | `data/reference/towns` plus OSM admin level 8 | 1 to 2 KB gzip each (estimate), 300 to 600 files | one city | a city picked on the globe |
| `data/outings/nearby-ors.json` (8.13, later) | ORS | about 50 KB, build-time input only | not shipped whole; values go into pages and rows | never fetched by the browser |

**How an unscoped request is prevented.**
1. Near mode requires a centre that resolves and an `r` of at most 100 km. The data module (`nearPlaces`) returns an error
   state for anything else; it never falls back to "all shards".
2. It loads only the shards whose bbox meets the circle: one or two files in practice. Vermont near the Quebec border
   loads two.
3. No file holds every point. Points stay in the row files, which are already scoped by country and later by region.
4. The towns parts hold public GeoNames data, not ours, and are scoped by region.
5. At a server step (P9), `GET /api/places?near=&r=` replaces steps 1 and 2 with the same signature, and the files stay
   as the cache.

New functions in `web/lib/client/data.ts`, in an appended section (P9: no component reads a file):
`resolveNear(token)`, `nearPlaces(centre, r, query, pageSize)`, `townsNear(centre, r)` and `townParts(prefix)`. The
build-side `nearbyForPlace(slug)` lives in `lib/public/nearby.ts`.

## 6. The smart trip builder (8.5, 8.6)

### 6.1 The idea, in steps

1. **Where.** "I want to visit Banff" or "Quebec City". The field resolves through the parser to a town, area or place,
   and the map flies there.
2. **Base and source.** The base defaults to the destination town. The visitor can pick another from the towns layer or
   our trip bases. The source ("from Toronto") is a hub; signed in, it is the private origin. The map draws source to base
   with the long leg as an estimate band, or routed if the pair is in the hub matrix.
3. **Days, season and theme.** Seven or eight days; a month or season (T1); theme chips from `tags.json` and the type tree
   ("Fall colours", "Waterfalls", "Easy hikes", "Rainy day"); the party profile (youngest child, effort), as on trip pages.
4. **Ask for suggestions.** The engine ranks catalogue places within a day-trip radius of the base (default 100 km, a
   2 h band) and groups them: "Around the base", "Half-day trips", "Full-day trips", "Worth a night elsewhere" (beyond
   100 km, for a second base).
5. **Choose and order.** The visitor ticks places. They go into a day tray: the engine proposes a day split by cluster
   (places within 25 km of each other share a day), and the visitor drags to reorder.
6. **See distances on the map.** Each day draws its legs with bands or routed times, and the day's total drive.
7. **Hand to the scheduler.** "Make the timeline" builds a draft trip in the timeline model, using the existing
   `core/src/schedule` add-a-place path: profile, leave by, meals and rests. The visitor then lands on the existing trip
   timeline UI.

8.6 is step 1 to 4 run from one sentence: "fall colours near Quebec City, 7 days" parses to a town, a theme tag
(`fall-colours`), a season (Sep and Oct, from the tag's season and the place seasons) and `days=7`, and it opens the
builder pre-filled. Today the parser has no `days` key, so 8.6 adds one.

### 6.2 What the engine needs, and the ranking shown to the user

| Input | Source | Exists? |
|---|---|---|
| Candidates near the base | the nearby layer (5) over shards | after N2 |
| Distance and drive | straight line plus band; ORS matrix for pairs | band now; matrix 8.13 |
| Season fit | `season` months on the row, access season | yes |
| Party fit | `kids_from`, `kids_basis`, effort, stroller | yes (L3b) |
| Draw | relevance badge | yes (RV) |
| Theme | tags and type | yes |
| Time on site | `time_band` | partly |
| Day packing | scheduler `addItem`, the day cap | yes (L3c) |

**The ranking is a sum with visible parts, never a black box.** Each suggestion shows its reasons as chips, in this
order: draw ("Worth the journey"), fit ("Fits age 6"), season ("Open in October" or "Best weeks 25 Sep-10 Oct"), theme
match ("Fall colours"), and distance ("45 km NE · 30-60 min ≈"). A "Why this order?" disclosure lists the weights in
words: "Badge first, then fit for your party, then season, then distance." There are no hidden scores. A "Not checked
yet" item never ranks above a checked one on a constraint it fails to answer: a gap is never a yes.

**Honest limits.** Around Quebec City the catalogue holds 5 places within 100 km and 21 in the province. Around Whitby it
holds none. The builder says how many it found and does not pad the list. Places we have not researched (OSM, Wikidata)
are a later, signed-in step (Q60), and each one it surfaces also becomes a research request.

### 6.3 Guest first, then sign-in

| Capability | Guest, in memory (SB1) | Signed in, with a backend (SB2, part of L1) |
|---|---|---|
| Destination, base, days, season, theme, profile | yes | yes |
| Suggestions from the catalogue | yes (shards in the browser) | yes (server query) |
| Distances | straight line and bands | routed, through `leg_cache` and ORS on the server |
| From the household's home | no (hubs only) | yes, private origin |
| Draft kept | in memory, plus a share URL (`ids=`, `base=`, `days=`) | saved, across devices |
| Timeline and add-a-place | yes (the existing scheduler bundle) | yes |
| Exports (ICS, PDF) | per trip, as today | plus GPX and KML (P8, sign-in) |
| Suggestions beyond the catalogue | no | yes, labelled "Not researched yet" (Q60) |

**What is out of reach without a backend:** routed times for arbitrary pairs (the ORS key cannot ship); a home origin;
saving and sync; candidates beyond the catalogue; a ranking over 10,000 places without loading many shards. Up to a few
hundred places in a 100 km circle, the browser is fine.

### 6.4 Reuse

- **The timeline:** the draft is a `trip` in the same model. "Make the timeline" calls the scheduler as "Add to this day"
  does, so the diff, warnings and dinner rule all hold.
- **The add-a-place panel:** in the builder, its candidate source is the near layer around the base, not "the catalogue
  within 30 km" (trip-timeline 3.7). The 30 km stays for public trip pages.
- **The map:** the trips map (MapLibre) with the near circle, the day legs and cluster pins. One map family per page
  holds.

### 6.5 First screen

```
+--------------------------------------------------------------------------------------------+
| Plan a trip                                                                                |
| [Where to?  Quebec City                     ]  From [Toronto v]   [7 days -+]  [October v] |
| Themes: (Fall colours x) (+ Waterfalls) (+ Easy hikes) (+ Rainy day)   Youngest child [6 v] |
+-------------------------------------+------------------------------------------------------+
| 5 places within 100 km · 21 in Quebec |                                                    |
| Around the base (under 30 min ≈)    |        [map: Toronto ---- 730 km ---- Quebec City]  |
|  [ ] Montmorency Falls   12 km NE   |              ring 100 km, 5 pins                    |
|      Open all year · Fits age 6     |                                                    |
| Half-day (30-60 min ≈)              |                                                    |
|  [ ] Canyon Sainte-Anne  37 km NE   |                                                    |
|      Fall colours · Sep-Oct · Fits 6|                                                    |
|  [ ] La Crete, Mont-Sainte-Anne 35  |                                                    |
| Full day (1-2 h ≈)                  |                                                    |
|  [ ] Le Buton lookout    66 km NE   |                                                    |
|      Fall colours · Worth a detour  |                                                    |
| Worth a night elsewhere (over 100 km)|                                                   |
|  Mont du Dome, Mont-Megantic ...  2 |                                                    |
| Why this order?                     |                                                    |
+-------------------------------------+------------------------------------------------------+
| Day tray: 0 chosen                                   [Make the timeline]  (disabled until 1) |
+--------------------------------------------------------------------------------------------+
```

(The distances above are illustrative, measured from the city. The build measures from the chosen base.)

## 7. Phasing and where it sits in the plan

> **Superseded in part (20 Oct 2026):** the owner moved this work before go-live (phase A UI fixes with R1, phase B API, phase E features, review R2; deployment out of scope). N0 ships in phase A; N1, N2 and N3 ship in phase E, before go-live, and the "week 1 after go-live" timings below no longer hold. Lane names map as WH to LST2a, WH-C and TR to LST2b, NB to PLC2b and LST2c, DR to META-0, PJ to META-1, PJ-R to DATA D1, TW to META-2, MX unchanged. See [build/public-site/EXECUTION-PLAN.md](../build/public-site/EXECUTION-PLAN.md). E2E specs live in `web/tests/e2e/`, not `web/e2e/`.

**The launch question, honestly.** The owner wants the site reviewed and merged soon: the preview was due about 22-23
Oct, and go-live about 25-27 Oct (REPORT-2026-10-20 section 5). Anything added now lands between the stage 5 checks and
the stage 6 preview, needs a design review and a verifier pass, and touches the filter bar the owner is about to review.
**Recommendation: add only the Where pill to the launch, with its country and province levels and the parks and
areas group, and only if it merges before the stage 6 preview is built. If it is not verified by then, it moves to N1
and the preview goes without it.** It uses data we already ship and keys that already work, and the owner asked for it
directly.

**The city level cannot be in that launch build without adding risk.** It needs the towns layer (TW, about 5 h with a
new download, licence credit and a privacy decision, Q50) and the city counts (about 4 h more). Putting it in the launch
adds about 10 h and the Q50 decision to the critical path, about one day on the preview date. The recommendation is to
ship it as the first lane after go-live (WH-C), with no change to the URL keys, so links made at launch keep working. If
the owner wants all three levels at launch, the alternative is to move the preview by a day (Q54). The Nearby section and near mode wait until after go-live. With
34% of pages lacking a point, 5 places in Ontario and no towns layer, they would show "nothing near Whitby" on day one,
which is worse than not showing them.

| Phase | When | Lanes | What |
|---|---|---|---|
| **N0** | launch, gated on merging before the preview | WH | The Where pill on Places: country, province, parks and areas |
| **N1** | week 1 after go-live | TW, WH-C, DR, PJ, TR | The towns layer first, then the Where city level, the data rule, the point join fix and the light points pass, Trips Where by province |
| **N2** | weeks 1-2 after go-live | NB | The Around here section, near mode, smart search into near mode (closes Q37) |
| **N3** | after N2, when hub and base pairs are wanted | MX | The ORS nearby matrix: routed times replace bands |
| **P1** | the planner product (second product) | SB1, then SB2 with L1 | The smart trip builder, guest first, then signed in |

### N0: WH, the Where pill

- **Files it owns:** `components/entity/WhereMenu.tsx` (new), `components/entity/FilterBar.tsx` (pill slot only),
  `lib/entities/types.ts` (a `control: 'where'` facet option), `lib/entities/descriptors/place.tsx` (the Country facet
  becomes Where; region and area lose `tier: 'more'` and gain `inWhere: true`), `styles/filters.css`, the tests
  `web/tests/entities/where.test.ts` and `web/e2e/places-where.spec.ts`.
- **Must not touch:** `rows.ts`, `shards.ts`, `data.ts` (no new file), the trips descriptor, the search parser.
- **Effort:** 6 h to build, plus 1 h of Opus design review and 1 h of verifier time.
- **Risks:** a regression in the filter bar just before the owner's review; the six-pill rule; phone chip targets (row
  7.13 just fixed them); e2e timing under load.
- **Acceptance checks:**
  1. Canada, then Alberta, gives 116 places and the URL `country=CA&region=alberta`.
  2. Adding Banff gives 45, and the chips read Canada, Alberta, Banff.
  3. Removing Canada clears all three.
  4. Typing "Alberta" in the list box gives the same state and pill label.
  5. The bar has four pills with no Kind chosen and six at most with one; Region and Area are gone from More filters.
  6. The keyboard path in 4.5 works with no mouse.
  7. At 390 the drill-down rows are 44 px, the summary bar reads "116 places · Alberta · 1 filter", and the sticky
     summary stays at 52 px.
  8. "Counting…" shows while the country file loads.
  9. Screenshots at 1440 and 390 in light and dark, and `tsc`, unit and e2e tests pass.

### N1: DR, PJ, TW, TR

| Lane | Owns | Effort | Risks | Acceptance |
|---|---|---|---|---|
| **DR**, the data rule (travel-builder, core) | `core/src/schema/capture/properties.ts` (`near_town`), the `point` value schema (`point_role`, `approx`), the validator placement checks, `capture.ts fields` and `gaps --placement`, `capture.ts build` outputs, capture-contract.md (new section 3.7 "Placement"), `.claude/agents/travel-researcher.md` (one line) | 6 h | Ledger pins: the new checks must warn, not fail, on migrated records; generated files change (`build --check`) | `fields --type nature.trail.hike` prints the placement block first; `gaps --placement --trip canadian-rockies-2029` prints the table in 3.3; `check-all.sh` passes; a new record with no `area_id` fails |
| **PJ**, the point join and migration steps 1 to 3 (builder plus data) | `lib/public/places.ts` (the point read order), the migration script in `core/bin/capture.ts migrate-placement` (a new verb that runs once, like `migrate`), `data/capture/**` (`area_id` writes), `data/capture/points.json` | 5 h | A wrong join puts a pin in the wrong place (T5); `E_PLACE_FAR` must run first | The no-point rows drop from 121 to at most 98 after step 1; `E_PLACE_FAR` reports 0; every capture place or route has `area_id` |
| **PJ-R**, migration step 4 (travel-researcher, open data only) | `data/capture/points.json`, the run record | 4 h agent | **Research is paused by the owner** (Q58); one Overpass and Wikidata runner at a time | Rockies trails with a point rise from 68 of 152 to at least 130; every new point has a source row |
| **TW**, the towns layer | `tools/towns.py`, `data/reference/towns/**`, `web/lib/search/build.ts` (town parts), `core/src/derive/near.ts` (`near_town`), the /about/data/ credit line | 5 h | Licence credit (CC BY); the privacy scrub (Q50); part size | Whitby, Oshawa, Ajax, Canmore and Cortina d'Ampezzo resolve; every part is under 20 KB gzip; `near_town` is derived for every record with a point; the privacy test passes under the Q50 decision |
| **WH-C**, the Where city level (after TW) | `components/entity/WhereMenu.tsx` (the city group), the `city` facet in `lib/entities/descriptors/place.tsx`, `lib/entities/url.ts` and `types.ts` (`city`, `r`), the `near_town` row field in `components/places/rows.ts` (the allowlist test changes by one key), `where-<cc>.json` in `app/list/places/**` and `lib/entities/shards.ts`, the near ordering and towns strip it shares with NB (NB reuses them) | 8 h, plus 1 h of review and 1 h of verify | The allowlist key; a city on a border; the radius semantics must read plainly (P4) | Canada, then Alberta, then Canmore gives 19 places nearest first, with `city=ca-ab-canmore`; Whitby is reachable from the find field and gives the empty state and the towns strip with Oshawa and Ajax; removing Alberta removes Canmore; `area=banff` links still work |
| **TR**, Trips Where by region | `lib/entities/descriptors/trip.tsx` (the region level), `lib/public/tags.ts` or `trips.ts` (regions from stops) | 2 h | Trip rows grow by one field | "Where · Alberta" on Trips gives the Rockies trip |

### N2: NB, Nearby and near mode

- **Files it owns:** `lib/public/nearby.ts` (new, pure: distance, bearing, bands, collapse, grouping);
  `components/places/sections/Nearby.tsx` (the Around here block) and its wiring in `Sections.tsx`; `lib/entities/url.ts`
  and `types.ts` (`near` and `r`); `lib/entities/shards.ts` (the shard bbox); `lib/client/data.ts` (an appended near
  section); `components/entity/NearChip.tsx` and the towns strip; the parser's near rule in `lib/search/parse/*`
  (smart-search A6 changes); tests and e2e.
- **Effort:** 12 h to build, plus 2 h of Opus design review and 1 h of verifier time.
- **Risks:** P8 (the cap and scope must be tested); misleading bands (Q57); the place page payload budget (INT-C cut it to
  147 KB, so the block must stay under 2 KB); a parser regression on the 30-query fixture.
- **Acceptance checks:**
  1. The Moraine Lake page lists Larch Valley 2.6 km SW and Lake Louise 10 km N, with bands.
  2. `/places/?near=place:moraine-lake&r=25` gives the same set, nearest first.
  3. `r=500` clamps to 100, with the chip saying so.
  4. `near=` with an unknown id gives the error state and loads 0 shards.
  5. A near query loads only the shards whose bbox meets the circle (a network assertion in e2e).
  6. "near Whitby" gives the towns strip with Oshawa and Ajax, and the honest empty state.
  7. The 30-query parser fixture still passes, and query 21 ("free things to do near Lake Louise") now uses near mode.
  8. No approximate point appears in any distance.
  9. Screenshots at 1440 and 390, light and dark.

### N3: MX, the ORS nearby matrix

`web/scripts/nearby-ors.mjs` writes `data/outings/nearby-ors.json`: every base and hub against every place within 100 km.
It runs sequentially, with the key read from the environment file and never printed, under the ORS free-tier limits. About 33
bases and 4 hubs against about 50 places each makes about 1,800 cells, in tens of matrix calls. Effort 3 h. Acceptance: a
routed "about 25 min" replaces the band wherever a pair exists, and `--check` fails on a missing pair.

### P1: SB1 and SB2, the planner product

- **SB1, the guest builder.** The route `/plan/` (new), `components/plan/**`, `lib/plan/rank.ts` (pure, with its reasons),
  and the reused scheduler, trip map and add-a-place panel. Effort 24 to 32 h, plus a design round with a mock first (the
  owner reviews mocks before a UI build). It starts after go-live and after N2, because it needs the near layer and the
  towns.
- **SB2, signed in.** Saved drafts, the private origin, routed legs through the server and `leg_cache`, and "Not
  researched yet" candidates. It is part of L1 and is sized with the backend.
- **Risks:** the thin catalogue outside the planned trips (the builder is only as good as the places we hold); the
  scheduler bundle budget (13.1 KB against 13.3 KB); a ranking that looks authoritative on gaps.
- **Acceptance (SB1):**
  1. "fall colours near Quebec City, 7 days" opens the builder pre-filled.
  2. Every suggestion shows its reason chips.
  3. Choosing 5 places and "Make the timeline" gives a draft with days, legs and meals, through the existing scheduler.
  4. The share URL restores the draft in a new tab.
  5. Nothing is stored server-side.

## 8. Owner questions

| ID | Question | Recommendation |
|---|---|---|
| Q50 | "Whitby" is the household's home town, and the public build scrubs it to "Toronto". May the public towns layer and the near chip name Whitby, as one Ontario town among hundreds, while trip text stays scrubbed? | **Yes**, option (a) in 5.6. A test allows "Whitby" only as a towns-part row and in a near chip; trip text, origin points and the 2 km rule stay as they are. If no, "near Whitby" works only in the signed-in planner |
| Q54 | Launch scope: put the Where pill into the launch with country, province, and parks and areas (N0, gated on merging before the stage 6 preview), and add the city level as the first lane after go-live (WH-C, with the towns layer)? Nearby and near mode also wait until after go-live | **Yes**. N0 is about 8 h on data we already ship. All three levels at launch add about 10 h and the Q50 decision, about one day on the preview. Nearby waits for the points and the towns, or it shows "nothing near" too often |
| Q55 | Towns source: GeoNames `cities1000` (CC BY 4.0, one download, with population) or OSM `place=town/village` through Overpass (ODbL)? | **GeoNames**. One file, no Overpass load, admin codes included. OSM stays the source for points |
| Q56 | Radius presets of 10, 25, 50 and 100 km, a default of 25 km for a place, a city or a town (50 for an area centre), and a cap of 100? | **Yes**. The cap keeps a near query to one or two files (P8), and 100 km is a day trip |
| Q57 | Until routed times exist, show drive time as bands ("15-30 min ≈") rather than minutes? The timeline's straight-line rule gives Whitby to Toronto as 88 min | **Yes, bands**, in nearby lists and the builder. The timeline keeps its minutes, where the legs are short and in parks |
| Q58 | 121 place pages have no point, and the owner paused research. May a light, open-data-only points pass run (Wikidata P625 and OSM, no operator pages, about 4 h of agent time) after the join fix? | **Yes**, as a scoped exception. It is what makes Nearby and the builder work for the Rockies trails |
| Q59 | Smart builder guest drafts: memory plus a share URL only, or also kept in the browser (localStorage)? | **Memory plus URL** for SB1. Browser storage waits for the L1 decision on guest planning, so there is one rule |
| Q60 | Suggest places we have not researched (from OSM or Wikidata, labelled "Not researched yet") in the builder? | **Not on the public site.** In the signed-in builder (SB2) only, and each one shown becomes a research request |
| Q61 | Trips: add the province level to the Where pill (a trip's regions from its stops), but not the city level? | **Yes**, in N1. Trip rows ship whole, so it costs one field |
| Q62 | The city level: a new `city=` key holding a towns-layer id, meaning "within the radius of this city, nearest first" (counts within 25 km), rather than reusing `area=`? | **Yes**. A city is a point and a radius, and an area is something we file places under; one key per meaning. Where a tree area is the municipality (Banff), the menu shows one row, and `area=` links keep working |

## 9. Change log

| Date | Change |
|---|---|
| 2026-10-23 | 2.4 and 5.6 (API-3c, Opus; owner ruling Q87 reopened, FINAL): towns are shown exactly as GeoNames and OSM show them, the home town included; the detector accepts a town point or outline vertex near home only when it is the loaded gazetteer's own (store.ts A33); the moved centre, the 4.5 km offset, the dropped outlines and the flag question are withdrawn, with the leak statements; echoes of the visitor's words are not read as household text (A40, K29); `nearTown` exempts only itself |
| 2026-10-23 | 2.4 and 5.6 (API-3a, Opus): the town guard settles Q50 and records Q87 (safe geometry, not exclusion): every town through `safeTown`/`safeOutline` at load, a fixed 4.5 km offset instead of D-E3's "nearest point outside" (which would leak the home point), no flag on a guarded row, the typed detector exemption, and the residual town-level risk with its one-line switch. Contract: store.ts A33, case K26 |
| 2026-10-21 | 3.1 (META-0): the town id is `<cc>-<admin1>-<slug>` (Q76, `ca-on-whitby`) with the ISO admin1 rule; `point_role` gains `route_start` and is the one `POINT_ROLE` enum; `approx` carries `approx_note`; `near_town` is asked by `W_PLACE_TOWN` and marked N in the registry until META-2 derives it. The rules, codes and gap reports are in capture contract 3.7 |
| 2026-10-20 | 5.7 superseded in part: the default path is API-over-JSON with caps in the store methods; the static files are the fallback; `nearby` moves to `core/src/nearby/` |
| 2026-10-20 | Phasing superseded by the execution plan (E before go-live); lane names mapped; e2e path corrected |
| 2026-10-20 | First version, from the owner's request of 20 Oct (backlog 8.1-8.6): data audit, the placement rule, the Where pill, Nearby and near mode, the towns layer, the smart trip builder, phases N0-N3 and P1, Q50, Q54-Q62. Same day, after the owner's repeat with a screenshot: the Where control has three levels, Country, State or province, City (a new `city` key, Q62, fed by the towns layer), with parks and areas as a group in the third level; a city selection shows what is near it; the towns layer is built once and shared with the globe's city outlines (row 9.3), with sizes in 5.6. Q51, Q52 and Q53 were taken by rows 9.5, 9.8 and 10.3, so this page's questions are Q50 and Q54-Q62. **Amends** smart-search A6 ("near <place>" uses a radius around the place in N2, not its area) and Q37 (closed by the towns layer); place-page-sections section 11 gains the "Around here" block after the two judged blocks; trip-timeline 3.7's 30 km candidate rule stays for public pages, while the builder uses the near layer. Backlog row 8.3's "62 place pages have no point" is corrected to 121 |
