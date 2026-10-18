# Kind profiles: what "done" means for each kind of place

Status: draft (18 Oct 2026). Planning only; the validator, badge and tools described in section 12 are
not built yet.

A lane contract (`../lanes/`) says how one kind of research runs. A **kind profile** (this folder) says
what one kind of *place* must carry before the product can show it, schedule it, or call it finished.
The same profile serves three readers:

- **a person** adding a place in the app or reviewing a changeset,
- **a Claude Code skill** (`research-lane`, `capture`, `import-trip`; ../skills-and-prompts.md),
- **a chat client over the MCP** (`propose` returns the profile's missing checks; section 12).

The owner's ask (18 Oct 2026): "If we are getting any trailhead, it means we have to do research. We
have to know what format, what things we need when we are adding trails, when we are adding a
sightseeing place, when we are adding an adventure thing." Each profile answers: which fields, in which
format and unit, where to look first, what must never be guessed, and which fields make it Draft,
Usable or Complete.

## 1. The profiles

| Profile | File | Stored as (`entity.kind` / `subkind`) | Produced by lane | Separate entities, never folded in |
|---|---|---|---|---|
| Trail | [trail.md](trail.md) | `trail` / `hike`, `walk`, `scramble`, `trek_stage`, `snowshoe`, `bike`, `paddle`, `via_ferrata_approach` | trails | trailhead, parking, shuttle stop, hut, the via ferrata itself (adventure) |
| Trailhead | [trailhead.md](trailhead.md) | `place` / `trailhead` | trails | parking lot, shuttle stop, the trails it starts |
| Parking | [parking.md](parking.md) | `place` / `parking` | trails, sights, road-trips | the trailhead or sight it serves, the reservation (`offer`) |
| Viewpoint | [viewpoint.md](viewpoint.md) | `place` / `viewpoint`, `summit` (reached by lift or road), `pullout` | sights-and-viewpoints | the trail that reaches it, the lift, the parking |
| Lake | [lake.md](lake.md) | `place` / `lake` | sights-and-viewpoints | parking, shuttle stop, canoe rental (adventure), lakeshore trail |
| Waterfall | [waterfall.md](waterfall.md) | `place` / `waterfall`, `canyon`, `gorge` | sights-and-viewpoints | parking, the access trail when it is longer than 2 km |
| Sight | [sight.md](sight.md) | `place` / `museum`, `church`, `castle`, `landmark`, `old_town`, `historic_site`, `market`, `garden`, `zoo`, `aquarium`, `science_centre`, `cave` | sights-and-viewpoints | ticket (`offer`), parking, guided tour (adventure when it is the product) |
| Town, village, base | [town.md](town.md) | `place` / `town`, `village`, `city` (with `attrs.base` when slept in) | destination-overview, stays | its `area` row, the stays in it, the old town as a sight |
| Adventure activity | [adventure.md](adventure.md) | `activity` / `zipline`, `via-ferrata`, `rafting`, `canyoning`, `glacier-walk`, `boat-tour`, `cruise`, `kayak`, `canoe`, `coaster`, `paragliding`, `heli`, `horse`, `wildlife`, `guided-hike`, ... | adventure | the operator (when it runs several activities), each product (`offer`), meeting point |
| Lift, cable car, scenic train | [lift.md](lift.md) | `activity` / `gondola`, `cable_car`, `chairlift`, `funicular`, `rack_railway`, `scenic_train` | adventure, sights, relax-and-luxury | the viewpoint or trailhead at the top, parking at the valley station, passes (`offer` kind `pass`) |
| Hut, refuge | [hut.md](hut.md) | `stay` / `hut` (beds); `eatery` / `hut_kitchen` (no beds: malga, baita) | stays, trails | the access trail, the lift that shortens it |
| Stay | [stay.md](stay.md) | `stay` / `hotel`, `lodge`, `b_and_b`, `guesthouse`, `apartment`, `rental_house`, `hostel`, `campsite`, `glamping`, `resort`, `motel` | stays | room or pitch products (`offer`), the base town |
| Eatery | [eatery.md](eatery.md) | `eatery` / `restaurant`, `cafe`, `bakery`, `teahouse`, `bar`, `market`, `grocery`, `supermarket`, `winery`, ... | food | the hut it sits in, the trail it is on |
| Beach, hot spring, swim spot | [swim-spot.md](swim-spot.md) | `place` / `beach`, `swim_spot`, `hot_spring` (natural); `activity` / `hot_spring`, `thermal_bath` (ticketed pools) | sights, relax-and-luxury, family-and-kids | parking, the lake it is on, boat or SUP rental |
| Event | [event.md](event.md) | `event` / `festival`, `market`, `sport`, `holiday`, `natural`, `closure` | events-and-seasonal | the places it affects (`affects` relation), each year's `event_occurrence` |

Subkinds not listed use the nearest profile: `glacier` (seen from a point) is a viewpoint, (walked on)
an adventure; `picnic_area`, `playground`, `splash_pad` use the sight profile with the family fields;
`shuttle_stop` and `meeting_point` use the trailhead profile's location and access rules.

## 2. The profile template

Every profile has the same sections, in this order:

1. **What it is**, which lane produces it, and what is a separate entity.
2. **Required fields**: field · format · example · why it matters to a family planning a day. Core
   fields (section 3) apply to every kind and are not repeated.
3. **Location**: the subject point, the access point, `point_source`, navigation links.
4. **Link checklist**: every link kind for the kind; each filled or `searched_none` (section 6).
5. **Where to research, in order**, with what each source is trusted for.
6. **People limits**, where relevant, and how they are checked against the household (section 8).
7. **Time and money**: hours by season, closures, prices, booking windows (section 9 formats).
8. **Never guess**.
9. **Completeness levels**: the exact checks for Draft, Usable and Complete (section 10).
10. **Freshness** per field group.
11. **Traps** from this repo's real research, with the file.
12. **Worked example** from real data.

## 3. Core fields (every kind)

| Field | Format | Example | Why it matters |
|---|---|---|---|
| `name` | as signed on the ground or as the land manager or operator writes it | `Lago di Braies` | the name people see on signs and in bookings |
| `names` | `{lang: name}` | `{"de": "Pragser Wildsee"}` | South Tyrol signs are bilingual; searches come in both |
| `kind`, `subkind` | from `vocab://subkinds` | `place` / `lake` | picks the profile and the editor |
| `area_id` | the smallest area that contains it (park, valley, town) | `area_braies` | "everything in Val Pusteria"; two places with one name stay apart |
| `point` | WGS84 `[lon, lat]`, at least 5 decimals (about 1 m) | `[12.08449, 46.69481]` | the map pin and the routing target; section 5 |
| `point_source` | section 5 | `osm_relation:14517899` | proves the pin did not come from Google |
| `point_checked` | `{by, on}` | `{by: "owner", on: "2026-10-18"}` | a person looked at the pin over imagery |
| `summary` | our words, 1-3 sentences, no copied text | "Glacier-fed lake ringed by a flat shore path; the boathouse jetty is the classic view." | why go, in one breath |
| `tags` | `vocab://tags` | `["lake", "family", "photo"]` | filters and personas |
| `season` | season structure (section 9) | `[{from: "06-01", to: "10-12", status: "open"}]` | whether it exists on the trip's dates |
| `hours` | hours structure (section 9), or `always_open` | | whether it exists at the hour planned |
| `cost_band` | 0-4 (0 free) | `2` | budget filter |
| `duration_min`, `duration_max` | minutes, realistic for a family, on site (not travel) | `90`, `240` | fits the day or not |
| `eligibility` | section 8 keys | | who in the party can go |
| `wikidata_qid`, `osm_ref` | `Q...`; `node/123`, `way/123`, `relation/123` | `relation/14517899` | identity, dedupe, imports |
| evidence | one row per field value (01-domain-model.md 2.4) | | every fact traceable to a source and a read date |

## 4. Value states

A field is not just "filled or empty". The completeness engine counts these states:

| State | Meaning | Counts as passed? |
|---|---|---|
| `value` | filled, with evidence that meets the profile's evidence rule | yes |
| `no_limit` | the authoritative source explicitly says there is none ("no minimum age", "free entry"); the words are in `quote` | yes |
| `none_stated` | the sources are silent and we record no limit (not on the group-access list, no age on the terms page); soft | yes, but it can cap the level at `usable_partial` |
| `not_applicable` | the field does not apply, with a reason ("shuttle-only access: no parking at the lake") | removed from the total |
| `searched_none` | looked in the profile's sources, nothing published; carries `{on, query or tried[]}` | only for checks marked **SN ok** in the profile (links, capacity, fill time, published height limits) |
| `gap` | not found and not yet looked for properly | no |
| conflict | evidence disagrees with the chosen value | yes for Usable if the chosen value meets the rule; Complete needs it resolved or explained (C6) |

`no_limit`, `none_stated` and `searched_none` are different facts and the UI shows them differently: "No minimum
age (operator, read 12 Oct 2026)" versus "Minimum age not published; ask the operator (searched 12
Oct 2026)". Mixing them up is how a 6-year-old gets booked onto a trip with an unwritten age rule.

## 5. Location

**The subject point and the access point are different things.** The subject is what you came to see
or do: the lake, the waterfall, the viewpoint, the payoff of a trail, the museum entrance, the lift's
valley station. The access point is where you leave the vehicle or the bus: a parking lot, a shuttle
stop, a trailhead. Each access point is its own entity (trailhead, parking, shuttle stop, meeting
point) related to the subject (`parks_for`, `serves`, `trailhead_of`, `starts_at`), because one lot
serves several places and has its own capacity, fee and fill time.

**`point_source` values** (the validator rejects anything else):

| Value | Use for | Notes |
|---|---|---|
| `osm_node:<id>`, `osm_way:<id>`, `osm_relation:<id>` | most points | for a way or relation, the point is the entrance node when one is tagged, else the centroid, and the evidence says which |
| `official:<url>` | the agency's dataset, map or GPX | Parks Canada open data, NPS, swisstopo, Provincia di Bolzano open data |
| `wikidata:<QID>` | towns, lakes and large features at Draft only | P625 is often a centroid copied from Wikipedia; never for an access point |
| `gps:<track or photo ref>` | a person's recorded track or a geotagged photo of their own | |
| `manual_pin` | a person placed the pin on our map over imagery | with `point_checked`; the Vermont lots were Google pins sent in chat (research/trips/vermont-fall-2026/notes/PARKING.md, `USER` rows): under this rule those are re-placed as `manual_pin` on our map, not stored as sent |

**Coordinates never come from Google Maps** (or Apple, Bing, a Google-derived blog widget). Google's
terms forbid storing its data, and its pin is often the business or the village, not where the walk
starts. A coordinate of unknown origin is treated as Google-derived.

**Navigation links are generated, never stored.** From the "arrive at" point, at render time:

| Link | URL |
|---|---|
| Google Maps, show | `https://www.google.com/maps/search/?api=1&query=<lat>,<lon>` |
| Google Maps, directions | `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>` (add `&travelmode=transit` when access is by bus) |
| Apple Maps, directions | `https://maps.apple.com/?daddr=<lat>,<lon>` |

"Arrive at" resolves in this order: the first related parking lot (`parks_for`, lowest walk minutes,
not `reservation: required` unless the trip holds that reservation); else the park-and-ride of the
shuttle that `serves` it; else the trailhead; else the entity's own point. The page shows both:
"Drive to: Lake Louise Park and Ride" and "Show the lake".

## 6. Link checklist mechanics

Every profile lists its link kinds. A link is an `entity_link` row (`kind`, `url`, `label`, `lang`,
`link_only`, `last_checked`, `http_status`). A checklist kind that has no link must carry
`searched_none` with the date and the exact query, for example
`webcam: searched_none 2026-10-18 "Lago di Braies webcam" + prags.bz`. The UI shows that as "none
found (checked 18 Oct 2026)". Sites that block the link checker (AllTrails) are recorded as
`found_in_search` with the search date instead of an HTTP status.

Link kinds used across profiles: `official` (the land manager's or operator's own page),
`hours_rates`, `booking`, `conditions` (closures, trail status), `status` (live lift or road status),
`timetable`, `terms` (T&C, waiver, cancellation), `tourism_board`, `osm`, `wikidata`, `wikipedia`,
`commons` (category), `wikivoyage` (facts only, CC BY-SA), `webcam`, `map_sheet`, `menu`, `accessibility`, `trip_report`, `video`, and the
link-only platforms `alltrails`, `komoot`, `gaia`, `outdooractive`, `wikiloc`. `navigation` is
generated (section 5).

## 7. Sources by region

Order everywhere: **the land manager or operator first, then official tourism, then open reference
data, then community**. Named sources per region (URLs are in the lane files and the research folders;
the ones marked * were not opened while writing this page):

| Region | Land managers and official data | Transport and access | Open reference |
|---|---|---|---|
| Canada | Parks Canada (trail pages, trail conditions, open data under OGL-Canada), Ontario Parks, Alberta Parks / Kananaskis, BC Parks*, Sepaq*, conservation authorities | Parks Canada shuttle reservations, Roam transit*, 511 Alberta* | OSM, Wikidata, NRCan topo* |
| USA | NPS (alerts, public domain), USFS, state parks (Vermont FPR), Vermont Trailfinder | NPS shuttle pages, recreation.gov for permits | OSM, Wikidata, USGS* |
| Italy, South Tyrol and Veneto | Provincia autonoma di Bolzano (open data and geoportal*), South Tyrol tourism (south-tirol.com lift hours), valley boards (val-gardena.net, dreizinnen.com, altabadia.org, cortinadampezzo.it), CAI/AVS trail numbers | südtirolmobil timetables and Braies booking, auronzo.info (Tre Cime toll road), DolomitiBus | OSM (CAI `ref` tags), Wikidata |
| France, Chamonix | Compagnie du Mont-Blanc (lift dates), Office de Haute Montagne, Chamonix tourist office, refuge sites | ATMB (Mont Blanc tunnel), Mont-Blanc Express | OSM, IGN Geoportail* |
| Switzerland | SAC huts, cantonal parks, swisstopo (OGD) | SBB, PostAuto | OSM, swisstopo |
| Norway | UT.no (DNT), Statens vegvesen (road status) | Entur* | OSM, Kartverket* |
| Iceland | Vatnajokull NP, Umhverfisstofnun*, Safetravel | road.is, Vegagerdin | OSM |
| Argentina, Chile | Parques Nacionales (argentina.gob.ar), CONAF* | operator timetables | OSM, Wikidata |
| Everywhere | Wikimedia Commons for photos (licence from file metadata; one sequential runner, never parallel: research/README.md, lanes/media.md) | | Wikidata (identity), OSM (geometry, points, `opening_hours` as a hint) |

Never a source of stored facts: Google Maps and Places, AllTrails and the other route platforms,
TripAdvisor, Yelp, Booking.com, Expedia, resellers' limit tables (../sources-and-licences.md).

## 8. People limits and the household check

Limits live in `eligibility` on the entity, or on each `offer` when products differ (Norquay via
ferrata routes 12+ and 14+; research/README.md R5).

| Key | Format | Notes |
|---|---|---|
| `min_age`, `max_age` | years, integer | measured on the activity date, not the booking date |
| `min_height_cm`, `max_height_cm` | cm | convert inches and say so in the quote |
| `min_weight_kg`, `max_weight_kg` | kg, one decimal | convert pounds and say so (40 lb = 18.1 kg); record which it is: the Rockies file stored a 50 lb **minimum** as `max_weight_kg` 22.7 (legacy/canadian-rockies-sept-2029/data/adventures.json, `kicking-horse-family-float`; research/trips/canadian-rockies-sept-2029/adventure.md line 136) |
| `adult_required` | `none`, `under_N_with_adult`, `one_adult_per_N_children` | |
| `fitness` | 1-5 with what it means here | |
| `swim_required` | bool | |
| `stroller` | `yes`, `jogging_stroller`, `no` | |
| `carrier_ok` | bool | |
| `accessibility` | `step_free`, `partial`, `none` with a note | |
| `min_age_guidance` | years, **our** recommendation with a reason, never a rule | trails and viewpoints only |

**The household check** (`check_trip`, the place page and `search` with `for_trip`): for each
traveller on the item (`trip_item.who`, else everyone), compare the traveller's age **on the item's
date**, height, weight (proposed: `person.weight_kg`, private, optional; not in schema.sql yet),
fitness and swimming against every limit. Result per traveller: `pass`, `fail`, `marginal` (within 2 cm,
1 kg or 3 months of a limit, or a value that only passes after a lb-to-kg rounding), or `unknown` (the
limit is `searched_none` or the traveller's value is missing). Any `fail` or `unknown` on a scheduled
item is a `check_trip` issue with the reason and the alternative (`alternative_to`).

## 9. Time and money formats

**Season** (R11): `[{from: "MM-DD", to: "MM-DD", status: "open" | "limited" | "closed", note, applies_to: "2026"}]`.
A year-round place stores one row `01-01..12-31 open`. Ranges may wrap the year (`11-15..04-15`).

**Hours**:

```json
{ "tz": "Europe/Rome",
  "periods": [
    { "season": "05-22..07-10", "days": ["mon","tue","wed","thu","fri","sat","sun"],
      "open": "08:30", "close": "17:30", "last_entry": null, "last_up": "17:00", "last_down": "17:30" } ],
  "closed_days": [],
  "breaks": [ { "from": "13:00", "to": "13:40", "note": "operators' lunch" } ],
  "closures": [ { "from": "2025-09-01", "to": "2026-04-01", "note": "renovation" } ],
  "applies_to": "2026" }
```

`last_entry` (museums), `last_up` and `last_down` (lifts) are separate from closing because they are
earlier and they are what strands people.

**Price** (on an `offer`, or `attrs.fee` for free-entry places with a fee such as parking):
`{amount, currency (ISO 4217), basis: per_person | per_vehicle_day | per_hour | per_group | per_boat,
band: "adult 16+", applies_to: "2026", read_on: "YYYY-MM-DD"}`. Several bands per offer. Never a price
without `currency`, `applies_to` and `read_on`.

**Booking window** (`offer.window_rule` and `window_spec`, 01-domain-model.md 2.3): `fixed_date`,
`rolling` (`days_before`, `opens_time`, `tz`), `monthly_release`, `lottery`, `same_day`, `anytime`;
plus `sellout` (`minutes`, `hours`, `days`, `weeks`, `rarely`) and `fallback` (a second release such as
Moraine Lake's 48-hour re-release). Every window carries the zone of the place, not of the household.

## 10. Completeness levels

| Level | What it allows | Badge |
|---|---|---|
| **Draft** | shown on the map and in search with a warning ("Draft: not checked"); can be saved to Ideas; cannot be dropped on a day without "use anyway", which `check_trip` then flags | grey "Draft" |
| **Usable** | can be put in a day plan; the day check trusts its duration, season, hours, access and limits | "Usable · 18 of 24" |
| **Complete** | every check passes: verified sources, every link resolved, photo licensed, nothing stale, reviewed | "Complete" |

The level is **computed, never set**. Each profile lists numbered checks, each tied to one level:

- `D` checks: the minimum to store the entity at all.
- `U` checks: the minimum to plan with it.
- `C` checks: everything else.

**Common checks** (every profile includes them; profiles add `D`, `U` and `C` checks numbered from
where these stop):

| Id | Level | Check |
|---|---|---|
| D1 | Draft | `name` present |
| D2 | Draft | `kind` and `subkind` in the vocabulary |
| D3 | Draft | `area_id` set; point inside the area polygon or within 5 km of it |
| D4 | Draft | `point` with 5 decimals and an allowed `point_source` |
| D5 | Draft | at least one source with URL and read date |
| U1 | Usable | `summary` in our words, with a source |
| U2 | Usable | `season` (or a year-round row) with evidence |
| C1 | Complete | `point_checked` by a person |
| C2 | Complete | `osm_ref` or `wikidata_qid` set, or both `searched_none` |
| C3 | Complete | every link kind in the profile's checklist filled or `searched_none` |
| C4 | Complete | at least one approved photo with a free licence and author (profiles may mark this `not_applicable`) |
| C5 | Complete | every Usable field is at trust `stated` or better, except fields the profile allows from `community` or `agent_inferred` |
| C6 | Complete | no open conflict on a Usable field (resolved, or explained in a reviewer note) |
| C7 | Complete | no field past its freshness window |
| C8 | Complete | accepted by a reviewer at least once (auto-accept alone does not count) |

**Conditional checks.** A check marked "when ..." applies only when its trigger holds (a reservation
offer is checked only when `attrs.reservation` is `required` or `recommended`). A check that does not
apply leaves the total.

**Counting.** `passed` = applicable checks passed across all levels; `total` = applicable checks across
all levels. The level is the highest one whose checks, and every lower level's checks, all pass. So
"Usable · 18 of 24" is an entity that passes every D and U check and 18 of the 24 applicable checks
overall. The **missing list** shows the failed checks of the next level first, each with its field,
the profile's hint and the first source to try ("U5 distance: read the Parks Canada trail page").

## 11. Adding a place: the flow

The same seven steps for a person in the editor, the `research-lane` skill, or a chat client.

```
 1 pick kind ─► 2 dedupe ─► 3 locate ─► 4 required fields ─► 5 links ─► 6 limits ─► 7 time and money ─► level
```

| Step | Do | Done when |
|---|---|---|
| 1. Pick the kind | choose the profile (section 1); split access points off (a lake with a lot is two entities, three with a shuttle stop) | every entity has one profile |
| 2. Dedupe | `search` by name and by point within 500 m; reuse or `merge`; two places with one name stay two (Moss Glen Falls, Stowe and Granville) | no duplicate proposed |
| 3. Locate | subject point and access points from OSM, then official data, then a manual pin; `point_source` on each; relate access points | D3, D4 pass for each entity |
| 4. Required fields | the profile's table, sources in its order, evidence per value; leave unknowns empty and record them as gaps | the Usable field checks pass, or each failure is a recorded gap |
| 5. Links | walk the link checklist; fill or `searched_none` with date and query | C3 passes |
| 6. Limits | every hard limit per product: value, `none_stated`, or `searched_none`; units converted | the profile's limit checks pass |
| 7. Time and money | season, hours with last entry or last lift, closed days, prices with currency and read date, booking window with zone and sell-out | the profile's time checks pass |
| Level | read the badge; the missing list is the next job | Usable before it goes into a day; Complete before it goes into a published template |

A person adding a quick pin (the `capture` skill) stops after step 3 with a Draft; that is allowed and
expected. Research jobs aim at Usable for everything they touch and Complete for anything a published
template or a trip within 120 days uses.

## 12. Enforcement

### 12.1 The validator (runs inside `propose`; rejects bounce the change with a code)

| Code | Bounces when | Why |
|---|---|---|
| `missing_draft_field` | a `create` fails any D check of its profile | nothing below Draft is stored |
| `forbidden_point_source` | `point_source` is missing, `google`, `apple`, `bing`, or the evidence URL host is a Google Maps or `goo.gl/maps` / `maps.app.goo.gl` link | terms of use; wrong pins |
| `low_precision_point` | fewer than 5 decimals | a 3-decimal pin is 100 m off: the wrong car park |
| `point_outside_area` | more than 5 km outside the area polygon | the wrong Moss Glen Falls |
| `missing_evidence` | any number, date, price, hour, limit or window without an evidence row | existing rule (mcp/tools-research.md) |
| `price_incomplete` | price without `currency`, `applies_to` or `read_on` | a price with no year is a guess |
| `window_incomplete` | booking window without `tz`, or `rolling` without `days_before` | reminders fire at the wrong hour |
| `limit_source` | a hard limit whose only evidence is `community` or a reseller | resellers copy stale limits; the value is kept as a conflict, not the chosen value |
| `unit_unconverted` | a field ending `_kg`, `_cm`, `_km`, `_m` whose quote shows lb, in, mi or ft without a conversion note | the 40 lb case |
| `link_only_as_source` | an evidence `source.url` on AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Google, TripAdvisor or Booking.com | link only, never a source of facts |
| `searched_none_incomplete` | `searched_none` without `on` and a query or tried list | "nobody looked" must stay visible |
| `quote_too_long` | quote over 300 characters | paraphrase rule |
| `enum_unknown` | a value outside the profile's enums | |
| `split_required` | a `create` that stores an access point inside the subject (a trail with `attrs.parking`, a lake with a parking fee) | access points are entities; the legacy trail proposal shape in mcp/tools-research.md is converted, not accepted |

Warnings (stored, shown to the reviewer, never bounced): `duplicates_suspected`, a value that
contradicts a `stated` or `verified` value, a level lower than the one the job's brief asked for.

### 12.2 The completeness engine

Runs after every accepted change and nightly (freshness moves entities down a level without anyone
editing them). Proposed schema additions, for 01-domain-model.md and schema.sql to adopt:

| # | Addition | Shape |
|---|---|---|
| K1 | `entity.completeness jsonb` and a generated `entity.level` (`draft`, `usable`, `complete`), indexed | `{profile, version, level, passed, total, failed: [{check, field, level}], computed_at}` |
| K2 | `kind_profile` reference table | `(id, version, checks jsonb, updated_on)`; source of truth is the Markdown here plus a generated JSON, like `lane` (R8) |
| K3 | value states on evidence-less fields | `entity.field_state jsonb`: `{"eligibility.min_height_cm": {"state": "searched_none", "on": "2026-10-12", "tried": [...]}}` |
| K4 | `entity_link.state` | `filled`, `searched_none`, `found_in_search`, with `query` |
| K5 | `offer.completeness jsonb` | products carry their own limit and price checks (adventure, lift, stay) |

### 12.3 The UI

- **Badge** on every card, map pin popup and place page: level plus "18 of 24".
- **Missing list** under the badge on the place page: failed checks of the next level first, each
  with its hint and an "Add" button that opens the editor at that field.
- **Map**: Draft pins are hollow with a warning in the popup.
- **Day plan**: dropping a Draft on a day asks "use anyway"; `check_trip` lists it.
- **Templates**: `publish_template` refuses entities below Complete and lists them.
- **Review queue**: each change shows the level before and after ("Draft to Usable").

### 12.4 The research skill

`research-lane` (../skills-and-prompts.md) loads the profile for every kind it touches, aims each
entity at Usable (Complete for entities used by a published template or a trip within 120 days),
runs the checks locally before `propose`, records every failed check as a gap with what was tried,
and ends its summary with a line per entity: "Lago di Braies: Usable · 21 of 27; missing C3 webcam,
C4 photo". `capture` stops at Draft. `refresh-area` re-reads only the fields whose C7 freshness failed.

### 12.5 The MCP tools (names as in ../../mcp/)

| Tool or resource | Change |
|---|---|
| resource `profile://kind/<profile>` (new) | serves this folder's profiles and the generated check list, beside `lane://<lane>` and `schema://entity/<kind>` |
| `research_brief` | per known entity: `level`, `passed`, `total` and the next-level missing checks; per area: count by level |
| `propose` | output gains `completeness: {<ref or id>: {level, passed, total, missing: [{check, field, level, hint}]}}` for every created or updated entity, so a chat client knows what to fill next (there is no separate `propose_entity` tool; `propose` is the one) |
| `submit_job` | refuses to submit a create below Draft (cannot happen after validation) and lists entities below the brief's target level as gaps automatically |
| `get`, `search` | return `level` and `completeness`; `search` accepts `min_level` (default `usable` for planning clients, `draft` for researchers) |
| `review_queue`, `decide` | show the level change per change; `decide` can mark a check `not_applicable` with a reason but can never set a level |
| `publish_template` | refuses entities below Complete |

**Nothing reaches Complete without passing every C check.** The owner's only lever is marking a check
`not_applicable` with a reason, which is recorded in `op_event` and shown on the place page.

## 13. Gaps in this design

- The thresholds (which checks are U and which are C) are a first cut from the Rockies, Dolomites and
  Patagonia research; recalibrate after importing the first two legacy trips (docs/v2/migration/).
- `person.weight_kg` is not in schema.sql; without it weight limits always return `unknown`.
- Horizon-aware sun loss for towns and viewpoints needs a DEM horizon in `core/src/sun`; today it is
  flat-horizon only (research/trips/chamonix-mont-blanc-sept-2028/stay.md section 1 GAP).
- The town profile's split between `area` and `place/town` is not settled in 01-domain-model.md.
- The prototype's trail field keys differ from the lane's (trail.md section 13).
