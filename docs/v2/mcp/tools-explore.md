# Explore tools

> **Amended 25 Oct 2026 (trip origin and nearest airport):** the public MCP's `get_trip` gains an optional `origin` and returns `getting_there`; a new read-only `nearest_airports` tool is planned (ORG-MCP, with MCP-1). See [../features/trip-origin-and-nearest-airport.md](../features/trip-origin-and-nearest-airport.md) section 11 (PLAN R-206).

> **Rule, 26 Oct 2026 (planned; PLAN R-252; [README](README.md) 1.1):** every tool on this page calls the same
> `CatalogueStore` method as its `/api/v1` route (`search` the search route, `get` the detail routes, `area_guide` the
> area and near routes), and its result passes through `respond()`. No tool here imports a database client or runs SQL;
> the "Ops" lines below name operations of that shared layer. After the Postgres cutover these tools read Postgres
> through the store with no change of their own.

Scope `catalog:read` (anonymous allowed at low limits). Read-only. Results come from the published
catalog only (`entity.status = 'published'`); proposed changes are never shown here.

Common output shape for an entity in compact form, used by every tool on this page:

```json
{ "id": "ent_01J9...", "kind": "trail", "subkind": "hike", "name": "Larch Valley to Sentinel Pass",
  "slug": "larch-valley-sentinel-pass", "area": "Banff National Park > Lake Louise",
  "point": [-116.1862, 51.3217], "tags": ["hike", "lookout", "larches"],
  "facts": { "distance_km": 11.2, "gain_m": 750, "duration": "5-6 h", "grade": "hard (Parks Canada)" },
  "season": "mid-Jun to early Oct", "trust": "stated", "fresh_until": "2027-04-12",
  "url": "https://app.<domain>/p/larch-valley-sentinel-pass" }
```

---

## `search`

**Purpose.** Find catalog entries by text, kind, tags, place, distance, season and party fit, ranked,
each with a one-line reason. The workhorse for "what should we do".

**Scope.** `catalog:read`. With `trips:read` it can read a trip's party and dates via `for_trip`.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `q` | string | no | free text; typo-tolerant (trigram) and accent-insensitive |
| `kinds` | string[] | no | `place`, `trail`, `activity`, `stay`, `eatery`, `hub` |
| `subkinds` | string[] | no | `waterfall`, `viewpoint`, `zipline`, `hotel`, `hut`... |
| `tags` | string[] | no | from the tag vocabulary resource; aliases accepted |
| `area` | string | no | area id or slug ("banff-national-park"); includes children |
| `near` | `{point:[lon,lat] \| entity_id, radius_km?, drive_min?}` | no | straight-line radius, or drive-time budget (uses `leg_cache` and routing; slower) |
| `along_route` | `{points:[[lon,lat]...] \| trip_id+day, corridor_km}` | no | entries within a corridor of a route |
| `open_between` | `{from:date, to:date}` | no | season and closures overlap the dates |
| `party` | `{ages:int[], walk_km_max?, gain_m_max?, fitness_min?}` | no | eligibility filter; returns fit per person |
| `for_trip` | string | no | trip id: takes party, dates, area, prefs and avoid rules from the trip (needs `trips:read`) |
| `filters` | object | no | `trail_km_max`, `trail_gain_max`, `duration_max_min`, `cost_band_max`, `indoor`, `dog_ok`, `stroller_ok`, `wheelchair_ok` |
| `persona` | string | no | a saved view id (`family-young-kids`, `hard-hikes`, `rainy-day`) |
| `sort` | enum | no | `relevance` (default), `distance`, `drive_time`, `duration`, `fresh` |
| `limit` | int | no | default 20, max 50 |
| `cursor` | string | no | pagination |

**Output.**

```json
{ "total": 38, "fits_party": 12,
  "results": [ { "...compact entity...": "",
     "reason": "Matches lakes + family · open in Sep · 22 min drive from Lake Louise · 3.8 km",
     "fit": [ {"traveller": "Adult 1", "ok": true}, {"traveller": "Child 1 (6)", "ok": false, "why": "750 m gain over the walking limit 300 m"} ],
     "distance": {"km": 14.2, "drive_min": 22, "from": "Lake Louise village", "estimated": false } } ],
  "coverage": {"area": "Banff National Park", "trails": "good", "food": "thin"},
  "zero_result_hint": null, "cursor": "c2..." }
```

When nothing matches, `zero_result_hint` names the filter that removed the most candidates
("Without gain_m_max=300, 9 trails match").

**Example.**

```json
{"tool":"search","arguments":{"q":"lake","kinds":["place","trail"],"area":"banff-national-park",
 "party":{"ages":[42,40,9,6],"walk_km_max":8},"open_between":{"from":"2029-09-08","to":"2029-09-22"},"limit":5}}
```

**Errors.** `validation_failed` (unknown tag: the hint lists the nearest vocabulary terms),
`not_found` (area), `upstream_unavailable` (drive-time: falls back to straight line with
`estimated: true`).

**Ops.** `search`, `search.near`, `search.along_route` (one query planner with PostGIS, full-text and
trigram indexes).

**Notes for clients.** Use `for_trip` instead of restating the party. Quote the `reason` to the user.
`coverage: thin` means the catalog may be missing things: say so and offer to add custom items or
start research; never fill gaps from memory as if they were catalog facts.

---

## `get`

**Purpose.** Full details of one or more catalog entries, offers or areas: facts with sources and
read dates, conflicts, season, eligibility, offers with booking windows, relations, media.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `ids` | string[] | yes (or `slugs`) | up to 20 |
| `slugs` | string[] | no | alternative to ids |
| `include` | string[] | no | `evidence`, `offers`, `relations`, `media`, `geometry`, `conflicts` (default: offers, relations) |

**Output.** Per entity: the compact form plus `attrs` (kind-specific), `eligibility`, `hours`,
`season`, `offers[]` (`{id, kind, name, price, price_read_on, window:{rule, opens_at_pattern, tz},
sellout, fallback, url}`), `relations[]` (`{kind:"trailhead_of", entity:{compact}}`), `evidence[]`
(`{field, value, source:{publisher, url, kind}, observed_on, confidence}`), `conflicts[]`,
`media[]` (`{url, width, height, licence, attribution}`), and for trails the parking and trailhead
block:

```json
"access": { "trailhead": {"id":"ent_...","name":"Moraine Lake trailhead","point":[-116.185,51.322]},
  "parking": {"name":"Moraine Lake lot","status":"closed to private vehicles","alternative":"Parks Canada shuttle (reserve)"},
  "links": { "official": "https://parks.canada.ca/...", "osm": "https://www.openstreetmap.org/relation/...",
             "alltrails": "https://www.alltrails.com/trail/...", "gpx": "https://app.<domain>/gpx/ent_....gpx" } }
```

**Errors.** `not_found` per id (returned in `missing[]`, the rest still succeed).

**Ops.** `catalog.get` (reads, joins evidence and offers).

**Notes.** Third-party links (AllTrails and similar) are links only; never copy their text into a
proposal. Show `observed_on` with any price or time you quote.

---

## `area_guide`

**Purpose.** What an area offers, by kind and persona: highlights, seasons, getting there, bases,
coverage per kind. The first call when a user names a destination.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `area` | string | yes | area id or slug |
| `month` | int 1-12 | no | season-aware picks and closures |
| `persona` | string | no | saved view for the picks |
| `party` | object | no | as in `search` |

**Output.** `{area:{id,name,path,tz,centre}, summary, best_months:[...], seasons:[{months, notes}],
getting_there:[{from, mode, typical}], bases:[{entity compact, why}], picks:{trails:[...],
sights:[...], activities:[...], food:[...]}, coverage:{trail:"good", stay:"usable", eatery:"thin"},
closures_in_month:[...], url}`.

**Errors.** `not_found`.

**Ops.** `area.guide` (reads area, coverage, ranked entities per kind).

**Notes.** If coverage is thin for what the user wants, say so before planning.

---

## `plan_drive`

**Purpose.** Drive (or walk, bike, transit) legs between points, with suggested stops every N hours.
Answers "how long from Calgary to Jasper and where do we stop".

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `stops` | (`[lon,lat]` \| entity_id \| `{label, point}`)[] | yes | 2-25 points in order |
| `mode` | enum | no | `drive` (default), `walk`, `bike`, `transit` (transit is estimate-only in v1) |
| `break_every_min` | int | no | suggest a stop every N minutes of driving (default 120) |
| `break_kinds` | string[] | no | `viewpoint`, `washroom`, `food`, `playground`, `fuel` |
| `depart_at` | local datetime + tz | no | to report arrival times and daylight |

**Output.** `{legs:[{from, to, km, minutes, provider, cached, geometry?}], total:{km, minutes},
breaks:[{after_min, entity compact, detour_min, reason}], arrive_at, sunset, warnings:["Arrives 40 min after sunset"]}`.

**Errors.** `upstream_unavailable` (routing down: straight-line estimate with `estimated:true`),
`validation_failed` (more than 25 stops).

**Ops.** `route.compute`, `route.suggest_breaks`.

**Notes.** Times are typical, without traffic; say so. Do not promise ferry or pass schedules from
this tool.

---

## `sun`

**Purpose.** Sunrise, sunset, civil/nautical/astronomical twilight and darkness windows for a place
and dates. Backed by `core/src/sun`, longitude positive east.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `point` | `[lon,lat]` \| entity_id | yes | |
| `from`, `to` | date | yes | at most 60 days |
| `tz` | IANA zone | no | defaults to the point's zone |

**Output.** `{tz, days:[{date, sunrise, sunset, civil_dawn, civil_dusk, astro_dark_from, astro_dark_to, daylight_min}]}`.

**Ops.** `sun.times`. **Notes.** Never compute sun times yourself; call this.

---

## `weather`

**Purpose.** Forecast (up to 14 days) or climate normals (any month) for a point. Used by Today mode,
conditions checks and adapting templates to a new season.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `point` | `[lon,lat]` \| entity_id | yes | |
| `dates` | `{from,to}` | no | forecast if within 14 days |
| `month` | int | no | climate normals (mean high/low, rain days, snow line notes when known) |

**Output.** Forecast: `{source:"open-meteo", fetched_at, days:[{date, t_max, t_min, precip_mm,
precip_prob, wind_max_kmh, gust_max_kmh, code}]}`. Normals: `{month, t_max_mean, t_min_mean,
rain_days, source, period}`.

**Errors.** `upstream_unavailable` (returns the last cached forecast with its age).

**Ops.** `weather.forecast`, `weather.normals`. **Notes.** Quote the fetch time; forecasts beyond 7
days are low confidence.
