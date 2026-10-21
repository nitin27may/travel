# Research skills (Claude Code) and prompts (MCP)

Status: draft (17 Oct 2026).

The same research must work in two places: **the owner's Claude Code** in this repo (skills, parallel
agents, local tools such as `core/src/sun` and the gallery tools) and **any chat client** connected to
the MCP (one conversation, no local tools). Both read the same lane contracts and write the same
changesets; only the orchestration differs.

## 1. How results reach the catalog

| From | Path | Auth |
|---|---|---|
| Claude Code, home network | the MCP at `https://app.<domain>/mcp` with a personal token (or OAuth), tools `research_brief`, `start_job`, `propose`, `submit_job` | owner token with `research:propose` (and `review` for self-accept) |
| Claude Code, offline or bulk | the ops CLI (`node packages/domain/bin/ops.ts <op> --input <file>`, the successor of `core/bin/ops.ts`) writing changesets to the database through the same operations | service credentials on the home server only |
| Chat client | MCP tools only | OAuth, `research:propose` |

A skill never writes Markdown research files as the record any more. It may keep a scratch file per run
(`research/runs/<job>/notes.md`, git-ignored or archived) for the agent's own working, but the
deliverable is the changeset.

## 2. The skill set

Each skill is a folder under `.claude/skills/` with a `SKILL.md`; lane contracts are read from
`research/method/lanes/` (or from the MCP resource `lane://<id>` so the skill and the server never
drift).

| Skill | Input | Steps | Output |
|---|---|---|---|
| **research-destination** | area name or id, trip types, budget | 1. `research_brief`; 2. run importers for geography and candidates if the area is new (onboarding-and-refresh.md steps 1-2); 3. waves of `research-lane` per the onboarding order; 4. one sequential `find-media` run; 5. `check-links`; 6. summary with coverage before and after | several jobs and changesets; a coverage report |
| **research-lane** | area, lane, depth (trip-types.md), optional entity list | 1. brief for the lane; 2. read the contract; 3. for each target: search catalog (avoid duplicates), read sources in contract order, fill required fields with evidence, record gaps; 4. validate against the contract locally; 5. `propose` in batches of up to 25 changes; 6. `submit_job` with a summary | one changeset |
| **refresh-area** | area, optional lanes, horizon (days) | 1. brief returns stale fields ranked; 2. re-read only those sources; 3. propose updates with new evidence; 4. close backlog items | one changeset per lane |
| **conditions-check** | trip id | onboarding-and-refresh.md section 4 | condition reports + a verdict on the trip |
| **find-media** | area or entity list | sequential Commons search (never parallel), metadata and licence check, hotlink check, contact sheet for the owner to look at, propose `media` rows | media changeset |
| **check-links** | area | HEAD/GET each `entity_link`, record status, flag 404 and generic redirects | link-status changeset (auto-accept) |
| **import-trip** | a legacy trip folder | docs/v2/migration/: read `data/*.json`, PLAN.md tables and research files; propose catalog entities with their sources; create the trip and its items through plan operations | a catalog changeset + a trip |
| **capture** (successor of the `location` skill) | a place name, a post, a screenshot | resolve identity (Wikidata, then Nominatim), propose a `draft` entity with the source post, add it to the household's wishlist list | a small changeset |

### What replaces the current trip-planner skill

The current `trip-planner` skill does research **and** builds a static page. In v2:
- Its **Phase 1 research fan-out** becomes `research-destination` / `research-lane` (the six lanes it
  names map to trails, adventure, road-trips-and-legs, sights, stays, timing-light; the rest are new).
- Its **Phase 2 conditions routine** becomes `conditions-check`, run by the worker by default.
- Its **Phase 3 page building** becomes the app (the plan document, area guide, entity pages); the
  orientation section becomes the destination-overview lane's area guide.
- Its **rules** carry over verbatim into the lane contracts: rule zero (do not take the draft at face
  value), record gaps as gaps, AllTrails never alone, hard limits, parking capacity and fill time, light
  computed not guessed, no parallel Commons.

## 3. Parallelism and cost rules

- Lanes in a wave run as parallel agents (Claude Code `Agent` calls in one message), **except media**,
  which is one sequential runner.
- Each lane agent gets: the brief for its lane, the contract, the target list, a cap on changes (default
  60 entities per job) and a token budget; it stops and submits what it has when the budget is reached,
  listing the rest as gaps.
- Model choice: a large model for lanes that need judgement (trails, adventure, stays, overview); a small
  model for mechanical lanes (media finding, link checks, importers' clean-up); the owner reviews.
- One request at a time per external host from importers; caches for every fetched page.
- Budget per job is recorded on `research_job` (`budget_usd`, `spent_usd`); server-run jobs (later)
  enforce it hard.

## 4. Verification before submit

Every lane agent runs these checks before `submit_job` (the validator re-runs them server-side):
1. Required fields present or listed as gaps.
2. Units and ranges sane (a trail of 250 km in a day-hike subkind, gain larger than 3,000 m for a 5 km
   walk, a price without currency are rejected).
3. Every changed field has evidence with `observed_on`.
4. No Google, AllTrails or review-site content in `quote`; quotes under 300 characters.
5. Points inside the area polygon (or a reason).
6. Duplicates checked (name + 500 m, QID, OSM id).
7. Computed values labelled `agent_inferred` with the method.

## 5. MCP prompts that mirror the skills

Chat clients do not have skills, so the MCP serves **prompts** with the same steps written for a single
conversation:

| Prompt | Arguments | What it tells the client |
|---|---|---|
| `research_destination` | area, trip_types | call `research_brief`; then for each lane in order call `start_job`, research with your web tools following `lane://<id>`, `propose` in batches, `submit_job`; never invent values; list gaps |
| `research_lane` | area, lane | the single-lane version, with the contract inline |
| `refresh_area` | area, horizon_days | brief with stale fields; re-read only those |
| `conditions_check` | trip | read the trip's sources and forecast; propose condition reports; suggest a verdict (the server stores it only if the user accepts) |
| `capture_place` | text or URL | resolve identity, propose a draft entity, add to the user's wishlist |
| `plan_from_research` | trip | use catalog search, not the open web, to place items; propose new entities only through research tools |

Resources the prompts reference: `lane://<id>` (the contract as Markdown and JSON), `schema://entity/<kind>`,
`vocab://tags`, `vocab://subkinds`, `scale://difficulty`, `rules://sources`, `rules://freshness`.

A chat client without web access can still do `plan_from_research` and `capture_place`; the brief tells
it which lanes it cannot run.

## 6. Worked example: onboarding Banff and Lake Louise

Goal: Banff and Lake Louise `usable` for trip types family (tweens), adventure and couple, using the
Rockies 2029 research already in the repo as seed (the import path is in docs/v2/migration/).

1. **Scope.** Owner in Claude Code: "research-destination Banff and Lake Louise, family-tweens, adventure,
   couple, budget $40." The skill calls `research_brief(area='Banff National Park')`: area missing.
2. **Geography (importer).** Wikidata lookup for Banff National Park (its QID), geoBoundaries for
   Alberta, OSM boundary relation for the park; children: Banff townsite, Lake Louise, Moraine Lake area,
   Bow Valley Parkway, Icefields Parkway south. Changeset auto-accepted (owner, licence-clean).
3. **Seed import.** `import-trip legacy/canadian-rockies-sept-2029` proposes the Banff and Lake Louise
   subset of its 62 trails, 48 sights, 43 adventures and 33 bookings as entities and offers, keeping
   their `source_urls`, `checked` dates and `GAP` notes as evidence and gaps. Status of each becomes trust
   `stated` where the source was Parks Canada or the operator, `unverified` otherwise.
4. **Candidates (importer).** OSM hiking relations and Wikidata lakes, waterfalls and peaks inside the
   polygon; deduplicated against the seed; about 40 new drafts.
5. **Wave 1 (parallel):** destination-overview, timing-light-and-weather, trails (Lake Louise and Moraine
   first), stays (bases: Banff, Lake Louise, Canmore as overflow).
   - The trails agent reads the Parks Canada Lake Louise and Banff hiking pages and the trail-conditions
     page, fills trails with trailheads and parking lots (Lake Louise lakeshore lot, Park and Ride, the
     Moraine shuttle stops), records the shuttle as an `offer` with its 2026 window (40% of seats at
     15 Apr 08:00 MT, rest 48 h ahead), links OSM relations and AllTrails (link only), and lists gaps
     (lot capacities, fill times needing community evidence).
6. **Wave 2 (parallel):** sights-and-viewpoints, adventure (Norquay via ferrata products with limits,
   Lake Louise Gondola, canoe rentals, rafting operators with family and Class III products), food
   (per base, every weekday), road-trips-and-legs (Calgary-Banff-Lake Louise legs routed; Bow Valley
   Parkway seasonal closure rules).
7. **Wave 3:** fares-and-costs (Discovery Pass, shuttle fares, gondola bands), events-and-seasonal (larch
   peak pattern), family-and-kids and community-reality-checks over the trails and adventures.
8. **Media:** one sequential `find-media` run; owner looks at the contact sheet; about 3 photos per main
   place.
9. **Links:** `check-links`; the 404 on the official Moraine Lake page (seen in 2026) becomes a backlog
   item and the trail's evidence points to the shuttle page instead.
10. **Review:** owner reviews in `/admin` by lane; bulk-accepts official-source additions; resolves the
    Iceline and Stanley Glacier conflicts by choosing values and leaving both evidence rows.
11. **Result:** coverage report, for example trails `good`, sights `good`, adventure `usable`, stays
    `usable`, food `thin` (backlog), with the open gaps listed. The Rockies 2029 trip is then rebuilt in
    the app from these entities (milestone M2's exit).
