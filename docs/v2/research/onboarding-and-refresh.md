# Onboarding a destination, refreshing it, and the pre-trip conditions check

Status: draft (17 Oct 2026).

## 1. Onboarding a new destination

A destination goes from nothing to `usable` in a fixed order. Mechanical steps are importers (scripts,
licence-clean, cheap); reading steps are lanes (models). Each step is its own job so a failure stops one
step, not the destination.

| Step | Runner | Output | Done when |
|---|---|---|---|
| 0. Scope | owner | the area name, the expected trip types (trip-types.md), a budget | a `research_job` with scope and lanes |
| 1. Geography | importer: Wikidata + geoBoundaries + OSM | `area` tree (country > region > park, valley, town) with polygons, QIDs, time zones | every child area has a polygon and a centre |
| 2. Candidates | importer: Wikidata (instances of lake, waterfall, mountain, museum, trail, hut... within the polygon) + OSM (`route=hiking` relations, `tourism=viewpoint`, `natural=waterfall`, `amenity=parking` near trailheads, `tourism=alpine_hut`, `tourism=camp_site`) | `draft` entities with identity and geometry only; no descriptions | candidate list reviewed for duplicates (merge by QID, OSM id, name + 500 m) |
| 3. Destination overview | lane | area guide | required fields filled; summary reviewed |
| 4. Timing, light and weather | lane | climate, peaks, holidays, light windows for main viewpoints | 12 months of climate; peaks with variability |
| 5. Trails | lane (deepest) | trails, trailheads, parking, tracks, links, conditions sources | coverage `usable` for trails |
| 6. Sights and viewpoints | lane | places with hours, access, light | coverage `usable` |
| 7. Adventure | lane | activities and offers with hard limits and windows | every offer has limits or an explicit "no minimum stated" or a gap |
| 8. Stays | lane | bases and properties, huts and campsites | at least one base per sub-region with base facts |
| 9. Food | lane | eateries per base with hours and closed days | each base has dinner options for every weekday |
| 10. Road trips and legs | lane + routing | legs between bases and main sights, seasonal roads, ferries | legs routed, not estimated |
| 11. Entry and documents | lane | rules for the household's citizenships | rules with official sources |
| 12. Fares and costs | lane | prices, passes, cost anchors | budget anchors for the area |
| 13. Events and seasonal | lane | events with occurrences | the next 12 months covered |
| 14. Family and kids, accessibility | lanes, when trip types need them | fields on existing entities | per trip-types.md |
| 15. Hidden gems, community reality checks | lanes | gems and dated community evidence | at least 5 gems with two sources each |
| 16. Media | one sequential runner | photos with licences | `good` needs 70% with media |
| 17. Review | owner | accepted changesets | no open conflicts on required fields |
| 18. Link check | importer | `http_status` on every link | no 404 on official links |

Steps 3-15 can run in parallel **except media**, and except where a lane needs another's output
(food needs bases from stays; legs need bases and sights). The skill runs them in waves (skills-and-prompts.md).

## 2. Coverage thresholds

As in research/README.md section 7, per kind and per trip type. A destination is **published** (shown in
Explore for everyone) when overview, trails or sights (whichever the area is for), stays and legs are
`usable`. Before that it is visible to the owner and to trips that already use it, with a "thin coverage"
note.

## 3. Refresh by staleness

- Nightly, the worker computes stale fields per entity (`fresh_until` < today + horizon), weighted by the
  trips that use the entity and how soon.
- It writes backlog items grouped by area and lane ("Lake Louise: 14 prices stale, 3 used by a trip in
  42 days").
- The owner runs `refresh-area` from Claude Code (or a chat client via the MCP) on the top items; a
  refresh job re-reads only stale fields, proposes updates with new evidence (old evidence stays), and
  closes the backlog items it covered.
- Booking windows are refreshed **before** the next window opens (the backlog item is dated to 30 days
  before the expected opening).
- Links are re-checked every 90 days by the importer; broken official links become backlog items.

## 4. Pre-trip conditions check

Purpose: one decision, made with fresh facts, close to departure. The repo's Vermont routine (a cloud
routine that emailed a foliage and weather verdict two days ahead) is the model.

**When:** default 3 days before departure and the evening before; daily during the trip for the next
day (Today mode's tomorrow briefing reuses it). Editable per trip.

**What it reads, for every item on the trip in the window:**
1. The `conditions` and `area_closures` links of each trail, sight and road (re-read, not cached).
2. Road authority status for seasonal roads and passes on the route.
3. The forecast (Open-Meteo) at each day's key points: precipitation, wind gusts, freezing level,
   thunderstorm risk, temperature at the high point.
4. Specialist bulletins when relevant: avalanche (winter or early-season high routes), fire bans and
   wildfire maps, river levels for rafting, ferry status, air quality.
5. Booking state: anything still `to_book` whose window is open.
6. The day's weather rules and Plan B items.

**What it writes:**
- `condition_report` rows (closures, warnings) with sources and validity.
- A **verdict** on the trip, one of: `plan_a_holds`, `swap_days` (which), `use_plan_b` (which day, which
  items), `drop_item` (which, why), `at_risk` (what to do now). Each verdict carries 1-5 reasons with
  evidence links and, where possible, a one-tap fix (an `edit_trip` payload: swap days, toggle Plan B).
- A notification to the trip members (push, and email if the trip is within 2 days).

**Example:** "Use Plan B on day 2: Moraine Lake shuttle runs, but gusts of 70 km/h forecast at Sentinel
Pass at 11:00 (Open-Meteo, read 07:12) and the Larch Valley group-of-four restriction is in force
(Parks Canada, read 07:10). Plan B: Lake Agnes Tea House. Swap applied on tap."

**Who runs it:** for family use, the worker container runs it as a small job (forecast and status pages
are cheap HTTP reads; the verdict text can be rule-based with a model pass only when rules conflict).
The owner can also run `conditions-check` from Claude Code for a richer read.
