# Research: how the catalog grows

Status: draft (17 Oct 2026). Planning only; nothing here is built yet.

Research is how facts about the world get into the catalog: trails, trailheads and parking lots,
adventures with their hard limits, stays, food, booking windows, seasons, light, documents. It is
the part of the product that compounds: every accepted fact improves every trip that uses it, today's
and next year's, the owner's and a stranger's who forks a template.

This folder defines **what** research must find (the lane contracts), **who** runs it and **how**
(skills in Claude Code, prompts over the MCP, later server agents), and **what happens** to the
results (changesets, review, trust, freshness, coverage).

| Page | What it covers |
|---|---|
| [trip-types.md](trip-types.md) | Profiles for day trip, weekend, vacation, family, couple, romantic, luxury, adventure, road trip, camper, trek and more: what matters, which lanes go deep, deal-breakers |
| [lanes/](lanes/README.md) | One strict contract per lane: required and optional fields with units, sources in order, evidence rules, freshness, traps, example changeset |
| [kinds/](kinds/README.md) | One profile per kind of place (trail, trailhead, parking, viewpoint, lake, waterfall, sight, town, adventure, lift, hut, stay, eatery, swim spot, event): required fields with format and unit, location and `point_source`, link checklist, sources, people limits, time and money, and the exact checks for **Draft, Usable and Complete**; plus the one-page "adding a place" flow and how the validator, the badge, the skill and the MCP enforce it |
| [sources-and-licences.md](sources-and-licences.md) | What we may store, what we may only link, how to paraphrase and attribute |
| [skills-and-prompts.md](skills-and-prompts.md) | The Claude Code skills to build, the MCP prompts that mirror them, budgets, parallelism rules, a worked Banff example |
| [onboarding-and-refresh.md](onboarding-and-refresh.md) | A new destination step by step, refresh by staleness, the pre-trip conditions check and its verdict |

## 1. Who runs research

| Runner | Where | Writes through | Typical job |
|---|---|---|---|
| **The owner in Claude Code** | the repo checkout, with the research skills (skills-and-prompts.md) | the MCP (`research:propose` scope) or the local ops CLI against the home server | "onboard Banff and Lake Louise", "refresh prices in Lake Louise", "conditions check for the Algonquin weekend" |
| **Any user's chat client** | Claude, ChatGPT, any MCP client connected to `/mcp` | MCP research tools only | "research food in El Chalten, nothing is there yet" |
| **Importers** (scripts, not models) | the repo or the worker container | ops CLI, as changesets with `client = import:<name>` | area polygons, Wikidata and OSM candidates, OurAirports, link checks |
| **Server agents** (later, owner-only first) | a worker container with the Claude Agent SDK | the same ops, with a token budget per job | the backlog, overnight |

All four produce the same thing: a **changeset** of proposed changes with **evidence** attached to each
field (01-domain-model.md 2.4 and 4). None of them writes a live catalog value directly. A person
editing an entity in the UI also creates a changeset; for the owner it auto-accepts.

## 2. The loop

```
 brief ──► job ──► propose (changes + evidence + gaps) ──► submit ──► review ──► publish
   ▲                                                                     │
   └──────── backlog ◄── coverage, staleness, conflicts, user requests ◄─┘
```

1. **Brief.** `research_brief(area | entity, lanes)` returns what exists already, coverage per kind,
   stale fields, open conflicts, open gaps, the lane contracts that apply, and the source rules. Every
   runner starts here so it never re-researches what is known and never misses what is stale.
2. **Job.** `start_job(scope, lanes, budget)` opens a `research_job` and an empty changeset.
3. **Propose.** For each entity: create or update with a JSON merge patch against the entity's
   `base_version`; for each field changed, one or more evidence rows (source URL, read date, our own
   paraphrase of at most 300 characters, confidence). Fields that could not be verified are **not
   filled**; they go into the changeset's `gaps` list with what was tried.
4. **Submit.** `submit_job` closes the changeset with a summary: what was found, what was not, what
   contradicts the catalog. Gaps are data: they become backlog items.
5. **Review.** The owner (or a moderator) sees each change as a diff with its evidence and accepts,
   edits then accepts, or rejects it. Low-risk changes can auto-accept (section 4).
6. **Publish.** Accepted values become the entity's current values; the evidence rows stay attached;
   `fresh_until` and the coverage scores are recomputed; trips that use the entity see the change
   (and a "this changed since you planned" note when it matters, for example a new closure).

## 3. Lanes

A lane is one kind of research with one contract. The same contract file serves three readers:

- **Claude Code skills** load it as the lane's instructions (skills-and-prompts.md).
- **The MCP** serves it as a resource (`lane://trails`) and as part of the matching prompt, so any
  chat client gets the same rules.
- **The validator** reads its required fields, units and enums to check a changeset before review
  (a changeset that claims a trail without a trailhead point, or a price without a currency and a read
  date, is bounced back to the runner with the reason).

Lanes: destination-overview · trails · adventure · sights-and-viewpoints · hidden-gems · stays · food ·
relax-and-luxury · road-trips-and-legs · timing-light-and-weather · entry-and-documents ·
fares-and-costs · events-and-seasonal · media · community-reality-checks · family-and-kids ·
accessibility. Which lanes get depth depends on the trip type (trip-types.md).

## 4. Trust

| Level | Meaning | How a value gets there |
|---|---|---|
| `unverified` | proposed by an agent from community or inferred sources, or entered by hand without a source | default for anything without an official or operator source; agent inference can never rise above this |
| `stated` | at least one official or operator source says so, read on a known date | accepted change with an `official` or `operator` evidence row |
| `verified` | reviewed, and either two independent official sources agree or the owner confirmed it on a visit | reviewer action, or a visit recorded after a trip (`After` phase) |

Auto-accept rules (owner can switch them off): a new `place` of a low-risk subkind (viewpoint, lake,
waterfall, town) with an official source and coordinates inside the area polygon; a Commons photo with
a free licence and attribution; a link-check result (`http_status`, `last_checked`). Never auto-accept:
hard limits (ages, heights, weights), prices, booking windows, closures, anything that contradicts an
existing `stated` or `verified` value, anything from an agent with `agent_inferred` confidence.

Conflicts are first-class. When evidence for a field disagrees with the chosen value, the entity page
and the review queue show both ("Parks Canada says 20.3 km and 1,090 m; a second Parks Canada page says
20.8 km and 710 m"). The current repo already found such conflicts (Iceline, Stanley Glacier in
`research/trips/canadian-rockies-sept-2029/trails-national.md`); the contract tells runners to record
both values rather than pick one silently.

## 5. Freshness and refresh

Each field family has a staleness rule (`freshness_rule`, carried over from
`data/schema/freshness.json`):

| Family | Stale after | What happens when stale |
|---|---|---|
| Prices and fares | 120 days, or when the season they were read for has ended | badge "price read 5 months ago"; backlog item if an upcoming trip uses it |
| Hours and closed days | 180 days | badge; backlog item |
| Booking windows and sell-out | 365 days (one season) | backlog item **before** the next window opens |
| Closures and conditions | 7 days | never trusted for planning; re-read by the conditions check |
| Hard limits (age, height, weight) | 365 days | badge on every row that carries them |
| Trail stats (distance, gain, grade) | 3 years | nothing unless a source changes |
| Geography and geometry | never | only on a reported change |
| Our summaries | 2 years | review prompt |
| Links | 90 days | the link checker re-tests; a 404 or redirect to a generic page becomes a backlog item |

`entity.fresh_until` is the earliest of its fields' dates, so "what needs refreshing for trips in the
next 120 days" is one indexed query. Refresh jobs are ranked by **trips using it × urgency (days until
the first trip) × severity (a closure outranks a café's hours)**, with a floor so unused areas still get
refreshed eventually.

## 6. Conditions check before a trip

Before each trip (default 3 days and again the evening before departure, editable per trip; the current
repo's Vermont routine ran 2 days before), a small job re-reads the trip's closure and conditions
sources, the forecast and any live status pages (trail conditions, road reports, avalanche bulletin,
fire bans, ferry status), and posts **one verdict** to the trip with the evidence: "Plan A holds", "Swap
day 3 and 4", "Use Plan B for day 2", or "Trip at risk: call X". Details in onboarding-and-refresh.md.

## 7. Coverage and backlog

`coverage` per area and kind: count of published entities, share with media, share fresh, share with a
`stated` or better value for the contract's required fields. Score:

| Score | Rule (provisional, recalibrate after the first two destinations) |
|---|---|
| thin | fewer than 5 entities of the kind, or under 50% have required fields filled |
| usable | at least 5, at least 80% of required fields filled, at least 50% fresh |
| good | usable plus at least 70% with media, at least 80% fresh, no open conflicts on required fields |

The intent sheet shows the score ("We know little about food in El Chalten yet"). Backlog items come
from: thin coverage for kinds the trip type needs, stale fields used by upcoming trips, open conflicts,
gaps returned by jobs, failed link checks, and user requests ("nothing about food here").

## 8. Where today's research fits

The repo already holds a lot of research in the shape these contracts formalise:
`research/trips/<slug>/*.md` lane files with sources and `GAP:` markers, and structured JSON such as
`legacy/canadian-rockies-sept-2029/data/trails.json` (62 trails with distance, gain, trailhead,
AllTrails and official URLs, parking or shuttle, child note, family alternative, season notes,
hazards, sources, checked date, status) and `adventures.json` (43 with operator, season window,
2026 price, min age, height, weight, booking, weather refund). The import path is in
`docs/v2/migration/`; the contracts keep every field those files have and add the ones they lack
(trailhead points, parking lots as their own records, structured season windows, link checks).

What "done" means for each kind of place is in [kinds/](kinds/README.md): a lane says how research
runs, a kind profile says what a place must carry to be Draft (on the map with a warning), Usable
(in a day plan) or Complete (verified, every link resolved, photo licensed). The level is computed,
never set.

The rules that made the current research good carry over unchanged: **record gaps as gaps** (never a
plausible number), **official source first, AllTrails never alone**, **report ranges when sources
disagree**, **hard limits are the most commonly missing fact**, **parking capacity and fill time decide
the order of a day**.

## 9. Schema additions this folder proposes

These are proposals for `schema.sql` and 01-domain-model.md; the parent document owns the final DDL.

| # | Addition | Why | Shape |
|---|---|---|---|
| R1 | **Trailheads and parking lots as entities** | a trailhead can serve several trails; a lot can serve several trailheads; each lot has its own capacity, fee and fill time; Moraine Lake has no private parking at all | `entity.kind = 'place'` with `subkind` `trailhead`, `parking`, `shuttle_stop`; parking `attrs` per lanes/trails.md section 4; relations `trailhead_of` (trailhead → trail), `parks_for` (parking → trailhead or sight), `serves` (shuttle stop → trailhead or sight) |
| R2 | **`entity_link`** table instead of url columns | a trail needs many links (official, conditions page, OSM, GPX source, AllTrails, Komoot, Gaia, trip reports, webcam, video), each with a kind, a language, a check date and status | `entity_link(id, entity_id, kind, url, label, lang, licence, link_only bool, source_id, last_checked, http_status, added_by)`; kinds in lanes/trails.md section 3 |
| R3 | **`track`** table for trail geometry | geometry has its own source, licence (ODbL for OSM) and fetch date, and must stay separable from our own data | `track(id, entity_id, geom geography(LineString), source enum osm/park/agency/manual_gpx, source_ref, licence, fetched_on, length_m, gain_m_dem, loss_m_dem)`; `entity.shape` stays the display geometry |
| R4 | **`condition_report`** table | closures and warnings change weekly, need their own dates and validity, and feed the conditions check | `condition_report(id, entity_id or area_id, kind closure/warning/restriction/status, status open/closed/caution/restricted, summary, source_id, observed_at, valid_from, valid_until, superseded_by)` |
| R5 | **Eligibility on `offer`**, not only on `entity` | one activity has several products with different limits (Norquay via ferrata routes 12+ and 14+; rafting family float 8+ and Class III 12+) | `offer.eligibility jsonb` with the same keys as `entity.eligibility` |
| R6 | **`event` entities and occurrences** | festivals, larch peak, salmon runs, Diwali, a dark-sky festival recur with dates that change per year | `entity.kind` gains `event`; `event_occurrence(entity_id, year, starts_on, ends_on, status confirmed/expected/cancelled, source_id)` |
| R7 | **Gaps as rows** | gaps from jobs must survive review and feed the backlog | `research_gap(id, job_id, entity_id or temp_ref, field, reason, tried jsonb, created_at, closed_by_change)`; a closed gap keeps both dates ("GAP CLOSED 2026-11-02") |
| R8 | **Lane contracts as reference data** | the MCP serves them, the validator reads them, the review queue shows the contract beside the diff | `lane(id, version, contract jsonb, updated_on)`; source of truth is the Markdown here plus a generated JSON |
| R9 | **Trip-type profiles as reference data** | drive the intent sheet defaults, the lanes a job runs, and the suggestion filters | `trip_type(id, label, lanes jsonb weights, default_filters jsonb, deal_breakers jsonb)`; system `saved_view` rows point at them |
| R10 | **Evidence confidence values** | the current repo uses `verified/stated/inference/gap/conflict`; schema.sql uses `official/operator/community/agent_inferred` | keep schema.sql's four on evidence (they describe the source); trust lives on the entity; `gap` and `conflict` are not evidence but `research_gap` rows and computed conflicts |
| R11 | **Season structure** | "open months" is too coarse for a road that opens mid-June or a shuttle that runs 1 Jun to 12 Oct | `season` jsonb: `[{from: 'MM-DD', to: 'MM-DD', status: 'open'|'limited'|'closed', note, year_observed}]` plus `snow_free` for trails; computed `season_months` for filters |
| R12 | **Best-light windows** | timing-light lane produces "front-lit until 10:30" | `attrs.light jsonb`: `[{subject, best: 'sunrise'|'morning'|'afternoon'|'sunset'|'night', until_hhmm, months, note}]` computed with core/src/sun, never hand-entered times |
| R13 | **New relation kinds** | lanes need them to connect access and context | `parks_for` (parking → trailhead or sight, `attrs.walk_min`), `starts_at` (activity → meeting point), `along` (stop → road, `attrs.km`), `affects` (event → place, `attrs.effect`), `turnaround_of` is not needed (turnarounds live in trail attrs) |
| R14 | **New place subkinds** | access points and kid places must be first-class | `trailhead`, `parking`, `shuttle_stop`, `meeting_point`, `scenic_road`, `pass`, `ferry_route`, `border_crossing`, `rest_area`, `ev_charger`, `splash_pad`, `playground`; a controlled list in the vocabulary |
