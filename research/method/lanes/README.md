# Lane contracts

Status: draft (17 Oct 2026).

Each file in this folder is the **contract** for one research lane. A runner (a Claude Code skill, a
chat client through the MCP, an importer, a server agent) must follow it; the validator checks
changesets against it before review; the review queue shows it beside the diff.

| Lane | File | Produces |
|---|---|---|
| Destination overview | [destination-overview.md](destination-overview.md) | area guide: what the place is, why famous, sub-regions, what to know |
| Trails | [trails.md](trails.md) | trails, trailheads, parking lots, tracks, links, conditions sources |
| Adventure | [adventure.md](adventure.md) | activities and their offers with hard limits and booking windows |
| Sights and viewpoints | [sights-and-viewpoints.md](sights-and-viewpoints.md) | places (lakes, viewpoints, waterfalls, museums, towns) |
| Hidden gems | [hidden-gems.md](hidden-gems.md) | lesser-known places with why and evidence they exist and are legal to visit |
| Stays | [stays.md](stays.md) | hotels, lodges, rentals, huts, campsites, with family and luxury specifics |
| Food | [food.md](food.md) | eateries, markets, groceries, with day-of-week gotchas |
| Relax and luxury | [relax-and-luxury.md](relax-and-luxury.md) | spas, hot springs, fine dining, scenic trains, private tours |
| Road trips and legs | [road-trips-and-legs.md](road-trips-and-legs.md) | legs, stops, seasonal roads, ferries, passes, fuel and EV |
| Timing, light and weather | [timing-light-and-weather.md](timing-light-and-weather.md) | seasons, peaks, light windows, climate, crowds, holidays |
| Entry and documents | [entry-and-documents.md](entry-and-documents.md) | document rules per citizenship and destination |
| Fares and costs | [fares-and-costs.md](fares-and-costs.md) | prices with read dates, passes, fare patterns, budget anchors |
| Events and seasonal | [events-and-seasonal.md](events-and-seasonal.md) | festivals, natural events, closures by season |
| Media | [media.md](media.md) | photos with licence and attribution |
| Community reality checks | [community-reality-checks.md](community-reality-checks.md) | what visitors report that official pages do not |
| Family and kids | [family-and-kids.md](family-and-kids.md) | kid fit, limits, facilities, family alternatives |
| Accessibility | [accessibility.md](accessibility.md) | step-free routes, facilities, transport access |

Each lane produces one or more kinds of place. What each kind must carry, field by field, and the
checks that make it Draft, Usable or Complete, are in the kind profiles: [../kinds/README.md](../kinds/README.md).

| Lane | Kind profiles it fills |
|---|---|
| trails | [trail](../kinds/trail.md), [trailhead](../kinds/trailhead.md), [parking](../kinds/parking.md), [hut](../kinds/hut.md) (approach) |
| sights and viewpoints | [lake](../kinds/lake.md), [waterfall](../kinds/waterfall.md), [viewpoint](../kinds/viewpoint.md), [sight](../kinds/sight.md), [swim spot](../kinds/swim-spot.md), [lift](../kinds/lift.md), [parking](../kinds/parking.md) |
| adventure | [adventure](../kinds/adventure.md), [lift](../kinds/lift.md) |
| stays | [stay](../kinds/stay.md), [hut](../kinds/hut.md), [town](../kinds/town.md) (base facts) |
| food | [eatery](../kinds/eatery.md) |
| destination overview | [town](../kinds/town.md) |
| relax and luxury | [swim spot](../kinds/swim-spot.md) (ticketed pools), [lift](../kinds/lift.md) (scenic trains), [adventure](../kinds/adventure.md) |
| events and seasonal | [event](../kinds/event.md) |
| road trips and legs | [parking](../kinds/parking.md), [viewpoint](../kinds/viewpoint.md) (pull-outs), [town](../kinds/town.md) |

## Every contract has the same sections

1. **Purpose** and the questions the lane answers.
2. **Produces**: which entity kinds, subkinds, offers, relations, links, reports.
3. **Required fields**: a change without them is bounced.
4. **Optional fields**, with units and definitions.
5. **Sources, in order of preference.**
6. **Evidence rules**: which fields need which source kinds.
7. **Leave empty**: what must never be guessed.
8. **Freshness**: which staleness family each field belongs to.
9. **Traps**: mistakes earlier research in this repo actually made or caught.
10. **Example changeset**.

## Rules common to every lane

- **Units.** Metric in storage: km (one decimal), m, minutes, kg, cm, °C, local currency with an ISO
  4217 code. Imperial is a display choice. Times: local wall clock `HH:MM` with the IANA zone of the
  place. Dates ISO `YYYY-MM-DD`. Day-of-year ranges `MM-DD`.
- **Round trip unless stated.** Trail distance and gain are round trip for out-and-back, total for loops,
  one way for point-to-point, and the `shape` field says which. If a source gives one way, double it and
  say so in the evidence quote.
- **Ranges, not a pick.** When sources disagree, propose the official value and attach every disagreeing
  value as evidence; the reviewer sees the conflict. Never average.
- **The year of a fact.** Every price, hour and window is read for a season. Evidence carries
  `observed_on` (when read) and, where it matters, `applies_to` (the season it describes, for example
  `2026`). A plan for 2029 using 2026 data says so (the Rockies plan did).
- **Gaps are output.** A field that could not be verified goes into the changeset's `gaps` with what was
  tried and why it failed ("official Moraine Lake page returned 404"). Never fill a gap with a plausible
  number.
- **Paraphrase.** `quote` is our own words, at most 300 characters, or a short exact phrase in quotation
  marks when the exact wording matters (a rule, a limit). Never copy descriptions (sources-and-licences.md).
- **One entity, one identity.** Search the catalog (`search` by name and by point within 500 m) before
  proposing a create; propose `merge` when two records are the same place; anchor to a Wikidata QID or an
  OSM id when one exists. Two different places with the same name (Moss Glen Falls, Stowe versus
  Granville) must stay two entities with their areas named.
- **Coordinates.** WGS84, at least 5 decimals; for anything you walk to, the point is the thing itself
  (the waterfall, the viewpoint), and access points are separate entities (trailhead, parking).
- **Never** propose content from Google Maps or Places, never scrape AllTrails, never store a
  confirmation code or personal data in the catalog.

## Running a fan-out

Added 21 Oct 2026 (CLEANUP-PLAN CLN-1c). This is the fan-out half of the `trip-planner` skill's Phase 1, written once here;
the rules every lane obeys are in [research/README.md](../../README.md) section 9.

1. **Scope first.** The trip has its row in [research/trips/README.md](../../trips/README.md) and a trip type from
   [trip-types.md](../trip-types.md). The lane depth matrix there decides which lanes run and how deep.
2. **One wave, one message.** Launch the lanes of a wave as concurrent `Agent` calls in a single message. Tell each agent
   that its output is raw data for another agent to synthesise, not a report for a person, and that every claim needs a
   source URL and a read date.
3. **Disjoint files and hosts.** Each lane writes only `research/trips/<folder>/<lane>.md` and
   `data/{capture,suitability,relevance}/<trip-id>/<lane>.json`. Lanes run in parallel only when they hit disjoint hosts.
   **Media, Overpass, Nominatim and Commons are one sequential runner for the whole machine**, never part of a parallel wave.
4. **Model per lane.** A large model for lanes that need judgement (trails, adventure, stays, destination overview); a small
   one for mechanical lanes (media finding, link checks); see [skills-and-prompts.md](../skills-and-prompts.md) section 3.
   Give each lane a cap (default 60 records) and a budget; when it runs out it stops and lists the rest as gaps.
5. **Synthesis.** The planner reads every lane file, then orders each day by constraints, not by the map: the
   earliest-filling parking first, then light, then crowd windows, then driving efficiency, with a decision rule wherever
   weather or timing could flip a choice.

The skill's six classic lanes map to these contracts. The extra asks are what earlier trips showed the lane must not miss.

| Classic lane | Contracts | Must not miss |
|---|---|---|
| Trails and hikes | [trails](trails.md), [timing-light-and-weather](timing-light-and-weather.md) | distance and gain from an official source; trailhead and car-park points from OSM or the agency; the full link checklist; parking capacity, cost and fill time; recent closures; what you see at the top; whether offline maps need a paid tier; popular routes that cross a closed section |
| Adventure and activities | [adventure](adventure.md) | price in local currency; minimum age, height and weight (the most often missing fact); booking channel (advance, same-day only, sells out); operating window; weather cancellation and refund terms; hours that contradict the plan's weather strategy |
| Route and logistics | [road-trips-and-legs](road-trips-and-legs.md), [entry-and-documents](entry-and-documents.md), [fares-and-costs](fares-and-costs.md) | two or three route options with time and tolls; border crossings and wait-time links; documents; fuel price across jurisdictions; signal dead zones; drive times between every pair of stops; sunrise and sunset for the exact dates |
| Attractions and hours | [sights-and-viewpoints](sights-and-viewpoints.md), [food](food.md) | dates, hours and prices; anything the traveller assumed, checked; closures and reservations; groceries; restaurants with their day-of-week closures; crowd patterns by day and hour |
| Villages and where to stay | [stays](stays.md), [destination-overview](destination-overview.md) | elevation; car-free or not and how it is reached; tourist tax; when the base loses the sun; overnight temperature (most alpine hotels have no air conditioning); day-tripper churn against evening quiet; last transport up; the nearest real supermarket; the honest trade when the famous village is the wrong place to sleep |
| Seasonal timing and photography | [timing-light-and-weather](timing-light-and-weather.md), [events-and-seasonal](events-and-seasonal.md), [media](media.md) (sequential) | when the thing they came for peaks, by sub-region; live-condition sources; which spots want sunrise, sunset or overcast; times from `node core/bin/sun.ts` for the actual dates, with sun azimuth and elevation from `sunPosition()` in `core/src/sun` when an alignment matters |

Adapt the lanes to the trip but keep the shape (capability, adventure, logistics, hours, where to stay, timing and light). A
city trip swaps trails for neighbourhoods and via ferrata for tours, but still needs the age, price and booking limits and
still answers "which district should we sleep in, and why".

## The changeset envelope (all lanes)

```json
{
  "job_id": "rj_01J...",
  "purpose": "trails lane: Lake Louise area",
  "client": "claude-code:research-lane",
  "changes": [
    {
      "op": "create",
      "target_kind": "entity",
      "temp_ref": "t1",
      "patch": { "kind": "trail", "subkind": "hike", "name": "...", "area_id": "...", "attrs": { } },
      "evidence": [
        {
          "field": "attrs.distance_km",
          "value": 7.4,
          "source": { "url": "https://...", "publisher": "Parks Canada", "kind": "official", "licence": null },
          "observed_on": "2026-10-17",
          "applies_to": "2026",
          "quote": "Lake Agnes Tea House: 7.4 km return, 385 m gain (Parks Canada Lake Louise hiking page)",
          "confidence": "official"
        }
      ]
    },
    {
      "op": "update",
      "target_kind": "entity",
      "target_id": "ent_01H...",
      "base_version": 3,
      "patch": { "attrs": { "gain_m": 400 } },
      "evidence": [ ]
    }
  ],
  "relations": [ { "from": "t2", "to": "t1", "kind": "trailhead_of" } ],
  "links": [ { "entity": "t1", "kind": "official", "url": "https://...", "label": "Parks Canada: Lake Louise hikes" } ],
  "condition_reports": [ ],
  "gaps": [
    { "target": "t1", "field": "attrs.toilets", "reason": "not stated on official page; community reports disagree", "tried": ["https://..."] }
  ],
  "summary": "8 trails, 3 trailheads, 4 parking lots created; 2 conflicts (Iceline stats); 11 gaps"
}
```

`temp_ref` lets one changeset create a trail, its trailhead and its parking lot and relate them before
any of them has an id. `base_version` makes concurrent research safe: if the entity changed since the
brief, the reviewer sees a three-way diff.

Confidence values on evidence describe the **source**: `official` (government, park agency, the land
manager), `operator` (the business that runs it), `community` (blogs, forums, trip reports, reviews),
`agent_inferred` (computed or reasoned by the runner, for example a doubled one-way distance or a light
window computed with core/src/sun). The entity's **trust** is derived (method/README.md section 4).
