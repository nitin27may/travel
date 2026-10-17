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
window computed with core/src/sun). The entity's **trust** is derived (research/README.md section 4).
