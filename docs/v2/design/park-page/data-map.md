# Park page and /parks: data fields mapped to existing properties

Part of [the park page design](README.md) (PA-N, gate G-PA). Every element on the page maps to a read model the web gets
through `web/lib/public` (P9) and to a property of the registry (`core/src/schema/capture/properties.ts`), the relevance
schema (`core/src/schema/relevance.ts`) or a derived value. Nothing on the page is a new stored fact except the camping
block (P3, already planned as PA-3C) and the two list-row keys of Q-PN4. "Exists" means on `main` 27 Oct 2026.

Read models: `PlaceLookup` (the place page today), `EntryBlock` (protected-area-entry 6.5, PA-Q), `PlaceContext`
(entity-graph 9.3, EG-Q), the list row (P8 allowlist), and `entryFor` (`core/src/parks/needs.ts`, exists: state, rows,
exempted, counts, summary, access, closures).

## 1. Park page

| Element | Read model field | Registry property or source | Record home | Status | Supplied by |
|---|---|---|---|---|---|
| Name | `PlaceLookup.name` | `name` | capture park record | exists | |
| Kicker type word | `EntryBlock.park.kind` + country | `type` (`nature.protected.*`) + `label_by_country` (Q-PN9) | types.json | label map new | PA-IXC |
| Kicker authority | `EntryBlock.authority.name` | `run_by` (operator record) | capture | exists on 7 Rockies records | PA-Q |
| Area chain, breadcrumb | `PlaceContext.chain` | `area_id`, `part_of`, `covers_areas` | capture, locations store | exists in the graph index | EG-Q |
| Summary line | `PlaceLookup.summary` | relevance `why` | relevance sidecar | exists where researched | |
| Relevance badge | as today | `class_key` (`park/protected-area`), `draw` | relevance | class from PA-C | |
| Completeness chip, gap block | as today | completeness engine | derived | exists | |
| Directions target | `PlaceLookup.point` | `point` (main visitor centre) | capture | exists | |
| Plan a visit (shown or not) | `PlaceContext.members` count with points; capability `planBuilder` | derived | graph index | EG-Q; flag from TB-C | EG-Q, TB-C |
| Banner: closed season | `EntryBlock.access.state` for the render date | `season`, suitability `access_season` | capture, suitability | `entryFor` returns `access` (exists) | PA-Q |
| Banner: dated closure | `EntryBlock.closures` | `closures` (registry: group safety, display rest!) | capture | exists (Banff: Johnston Canyon) | PA-Q |
| Glance: places inside | `PlaceContext.members[].n` summed | derived (closure, entity-graph 6) | graph index | EG-Q | EG-Q |
| Glance: visitor centres | `PlaceContext.accessPoints` filtered to `access.amenity` | members | graph index | EG-Q | EG-Q |
| Glance: gateway town | `PlaceLookup.nearTown`, `nearTownKm` | `near_town`, `near_town_km` | capture | exists (Banff: Banff, 0.2 km) | |
| Glance: nearest airport | origin read model | ORG nearest airport (OurAirports) | reference data | planned | ORG-C, ORG-D |
| Glance: designations | relevance | `signals.designations` | relevance sidecar | exists in schema; sparse | |
| Glance: season | `EntryBlock.access` and the park `season` | `season` | capture | sparse (not on Banff) | |
| Entry state line | `EntryBlock.state`, `counts`, `read` | derived from requirement offers; `access_cost` when none | capture offers | `entryFor` exists | PA-Q |
| Requirement row: name, words | `EntryRequirement.name`, `kind` | `name`, `type` (`access.pass.*`) | capture offer | exists (8 offers in PA-ca) | PA-Q |
| Who needs it | `EntryRequirement.neededFor`, `required` | `entry.needed_for`, `entry.required` | capture offer | exists | PA-Q |
| Price line | `EntryRequirement.price` | `price` rows (`amount`, `currency`, `per`, ages, `residency`, `applies_to`) | capture offer | exists | PA-Q |
| Window chip and rule text | `EntryRequirement.window.text` | `window` (`rule`, `opens_from`, `opens_to`, `opens_time`, `tz`, `share_pct`, `then`, `closes_*`) through `bookRuleFromWindow` | capture offer | exists | PA-X (done), PA-Q |
| Covered by | `EntryRequirement.coveredBy` | `covered_by` | capture offer | exists | PA-Q |
| Pass: parks it covers | inverse of `covered_by` counted | derived | graph index | new field on `EntryBlock` (README R3) | PA-Q |
| Exemptions | `EntryRequirement.exemptions` | `entry.exemptions` | capture offer | exists | PA-Q |
| Details: validity, channel, proof, change, cancel, quota | `EntryRequirement.valid`, `channel`, `cancel`; proof and quota added | `entry.valid`, `entry.channel`, `entry.proof`, `entry.change`, `entry.cancel`, `entry.quota` | capture offer | `proof`, `change`, `quota` not yet in the 6.5 sketch | PA-Q |
| Season in force | `EntryRequirement.season` | `season` on the offer | capture offer | exists | PA-Q |
| Scope ("Moraine Lake", "From Yoho") | `EntryRequirement.scope`, `inheritedFrom` | `at`, chain | graph index | entity-graph 7.2 | PA-Q |
| Fees, booking, official links | `EntryBlock.links`, `EntryRequirement.link` | `links` (`official`, `hours_rates`, `conditions`, `booking`), `book_url` | capture | exists | |
| Read dates and stale marker | `read` on each item; freshness class | `read`/`on` on every Val; `data/schema/freshness.json` | capture | exists | PA-Q (compute), PA-2 (draw) |
| Safety: wildlife | `PlaceLookup.hazards` | `hazards` (display rest!) on the park; member `ext.wildlife.*` | capture, suitability | sparse | |
| Safety: alerts link | `EntryBlock.links.alerts` | link kind `conditions` | capture | exists | |
| Things to do: counts and top 6 | `PlaceContext.members` | derived; `k` from the type | graph index | EG-Q | EG-Q, EG-W |
| Areas inside | `PlaceContext.members` where type is the zone | `part_of` | graph index | EG-Q | EG-Q |
| Where to stay: campgrounds, huts, lodges | members `stay.*` with their lodging offers' `window`, `price`, `season` | `stay.camp.*`, `stay.mountain.*` places and offers | capture | none held yet | PA-R-ON (data), PA-3 |
| Camping detail: site kinds, food storage, max stay | `camp` block | `camp.site_kinds`, `camp.food_storage`, `camp.fire_rings`, `max_stay_nights`, `check_in_out` | capture | new property set, planned | PA-3C, PA-3 |
| Gateway towns outside | stay-bases data where held; `near_town` | `near_town`, base towns | capture, trips | partial | |
| Getting there: transit and shuttles | `PlaceContext.reachedBy`, members `access.transit`, `access.park` | members, `serves`, `parks_for` | graph index | EG-Q | EG-Q |
| Seasons: month strip | `EntryBlock.access`, park `season` | `season`, `access_season` | capture, suitability | sparse | PA-Q |
| Seasons: gate hours | park `hours` | `hours` | capture | sparse | |
| In public trips | `PlaceContext.inTrips` | "In a public trip" facet | trips | exists | |
| Member page park line | `EntryBlock` on the member with `inheritedFrom` | `requirementsOf` | graph index | `entryFor` exists | PA-Q, PA-2 |

## 2. /parks rows

| Element | Row key | Source | Status | Task |
|---|---|---|---|---|
| Name, slug, kind, area, photo, season, completeness label | existing allowlist | as today | exists | |
| Type word | `k` + country | `type`, `label_by_country` | label map new | PA-IXC |
| Entry label | `entry` enum: `none`, `fee`, `book_ahead`, `not_checked` | `entryFor(...).state` and whether any row is `booking` | new key (Q-PN4) | PA-IXC |
| Places inside | `members` integer | graph closure count of public members | new key (Q-PN4) | PA-IXC |
| Drive time | `driveMin`, `driveBasis` (`routed`, `modelled`) in a `from` query's response only | driving-time model `estimateDrive` from the hub to the park's point | new query output | PA-IXD after DT |
| Filters | `country`, `region`, `k`, `season`, `from`, `drive` | existing facets; `from`/`drive` new query params | `from`, `drive` new | PA-IXC (reserve), PA-IXD |

## 3. What the page must never carry (privacy, P8)

- No party, household, home point or device location in any URL, row or response (trip-builder 2.4, OR9); `from` is a
  public hub or an airport code.
- No record refs in the HTML: legacy refs name dated trip folders (public-ref-aliases); slugs only.
- No member list bigger than one page in the HTML (6 per group, 3 groups at rest, 18 cards at most; entity-graph 9.3 caps).
- No full park point set on `/parks`: the current page's pins and per-country counts only.
