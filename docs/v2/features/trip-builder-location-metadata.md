# Trip builder: the location metadata the engine needs

Status: **contract, planned only** (27 Oct 2026, travel-planner, Opus, task TB-FLOW). No schema edited here. Owner
requirement of 27 Oct 2026: "each location needs extra metadata so the algorithm works (airports, region split, durations
and so on)". The flow that reads it: [design/trip-builder/FLOW.md](../design/trip-builder/FLOW.md). BACKLOG 15.353 (task
TB-MD).

**Finding first: almost everything the engine needs already has a home.** The property registry
(`core/src/schema/capture/properties.ts`) and the type tree (`data/vocab/types.json`) hold durations, best time of day,
seasons, hours, booking windows, effort, age fit, access points, rainy-day fit and relevance. Airports and drive times
are reference layers, not place properties (origin OR10; driving-time model 5). The gap is **fill**, plus **three true
additions**, none of which is a new place property:

1. **M1** a two-level region-groups reference (macro-region and travel region), extending planned TB-RG and DC-5;
2. **M3** a researched arrival gateway and a transport note per travel region (on the same file);
3. **M6** the `on_site_min` mark on the `town` profile in `types.json` (towns have no time-on-site today).

Principles: P8 (light rows; no new list field beyond the allowlist), P9 (served through `PlanService` and `CatalogueStore`).
This page supersedes nothing; it refines [trip-builder.md](trip-builder.md) 8.3 and feeds
[destination-data-coverage.md](destination-data-coverage.md) 2.3 (the T2 bar).

## 1. The hierarchy

```
country (locations store `countries`, ISO 3166-1)
  macro-region        NEW level, M1: "Northern Italy", "Southern Italy", "Islands"; "Ontario", "Quebec"
    travel region     NEW level, M1: "Dolomites", "Lake Garda", "Tuscany", "Algonquin and Muskoka", "Canadian Rockies"
      area            exists (`areas`, `area_id` on every record, R): "IT/trentino-alto-adige/val-gardena"
        place         exists (capture record; `area_id`, `point`, `near_town`)
region (admin-1)      exists (`regions`, "IT/veneto"); kept for addresses and the Where pill, not for the builder's chooser
```

A travel region is a named set of **areas**, so it can cross admin regions (the Dolomites span Trentino-Alto Adige and
Veneto; the Canadian Rockies span Alberta and British Columbia). A macro-region is a named set of travel regions. A place
belongs to a travel region through its `area_id`; no place carries a region id of its own (one fact, one home).

## 2. The contract: need, home, status

| # | The engine needs | Used at (FLOW stage) | Home today | Status | True addition? | Who fills |
|---|---|---|---|---|---|---|
| M1 | **Macro-region and travel region** for every area | 2 Where; counts; Surprise me | none; TB-RG (`data/reference/region-groups.json`, P2) and DC-5 (the same file for wave 1) planned with one level | planned, one level | **yes: a second level.** `region-groups/1` holds `macro` rows (id, label, travel region ids) and `travel` rows (id, label, `areas[]`, `gateways`, `transport`) per country. Ids `it-north`, `it-dolomites` (match `PLAN_REGION_RE`) | Opus researcher authors per country (judgement: where the Dolomites end); `capture.ts build --check` validates that every area is in at most one travel region and every listed area exists |
| M2 | **Region split north or south** | 2 Where | M1 | as M1 | covered by M1 (macro rows) | as M1 |
| M3 | **Arrival hub** (researched gateway airports) per travel region | 1 Start (suggested airport for air kinds), 5 Build (base order), 6 Getting there | per trip only: `trip-gateways/1` (origin 10) | per trip | **yes: per travel region**, `gateways: { in: ["VCE","VRN"], basis: "researched", src, checked }` on the travel region row; it plays O5 for builder plans (origin 3 rule 4 analogue) | Opus researcher (ORG-G method), with the airports layer for codes |
| M4 | **Nearest airports with drive minutes** | 1, 5, 6 | derived at request time from the airports layer (ORG-D, OurAirports) and `estimateDrive` (origin 4.2, OR10: never stored per place) | specified, not built | **no.** Computed per base or travel-region centroid; the travel region row may cache the top 3 as a generated value (`capture.ts build` writes `data/reference/generated/region-airports.json`, never hand-edited) | generated |
| M5 | **Transport note**: car needed, or bus and train work | 6 Getting there; factor 5 (FLOW 3) | none (TB-D4 planned, no home named) | planned | **yes, on the travel region row**: `transport: { car: "needed" \| "useful" \| "optional", note, src, checked }` | Opus researcher (TB-D4) |
| M6 | **Visit duration** (typical time on site, range, by kind) | 3 tray estimate, 5 packing | `on_site_min` (37 of 47 profiles), `adult_time_min` and `child_time_min` (trails), `duration_min` and `activity_min` (offers), `walk_m`; type rules `DURATION_RULES` (`core/src/schedule/rules.ts`) via `resolveDuration` | exists; fill thin | **yes, one mark**: the `town` profile (settlement types) lacks `on_site_min`, so a picked town has only the default rule. Add `on_site_min: "A"` to the `town` profile in `types.json` (a data change, CC7; `capture.ts build` regenerates the checklists) | Sonnet fills from tourism-board "how long to spend" pages; Opus samples |
| M7 | **Best time of day** | 5 order inside a day | `best_time` (object_list, A), `ext.wildlife.best_time`, `sun_loss`, `bearing`, `fills_by` (car park fills by), `ext.lift.last_up`, `ext.lift.last_down`, `hours` | exists; fill very thin | no | Sonnet with a source; never invented (trip-builder 4.9) |
| M8 | **Season and access window** | 1 When, 3 filters, 5 `TB_CLOSED` | `season`, `access_season`, `best_window`, `snow_free_window`, `closures`, `hours` | exists | no | Sonnet; type default seasons TK-S as ≈ |
| M9 | **Booking required and window** | 5 checks, 8 Book ahead | `window`, `access_cost`, `reservation`, `entry` and park offers via `requirementsOf` (protected-area-entry) | exists | no | Opus for entry rules (DC 2.1 T2) |
| M10 | **Base suitability** (can host overnight, lodging density) | 5 bases | lodging signal TB-BL (OSM counts per candidate town, generated), town base facts STY-P (`why_stay`, cost band), settlement records | planned | no (TB-BL writes `data/reference/towns/lodging.json`, generated) | script (TB-BL), Sonnet for STY-P |
| M11 | **Cluster id** | 5 bases (p-median), 4 envelope | none | **not stored, by decision**: clusters are computed per build (sweep by bearing inside a base; p-median over towns), and `area_id` is the stored grouping. A stored cluster id goes stale as soon as a place is added | no | n/a |
| M12 | **Interest tags** (activity, landscape) | 3 Looking for, ranking | type prefixes and `data/vocab/tags.json` mapped to 19 activity ids (trip-kinds 2.1, TK-C); landscapes derived (TK-L) | planned | no | TK-C (contract), TK-L (derivation) |
| M13 | **Difficulty and fit** | 3 filters, 5 `TB_FIT` | `effort.source_grade`, `effort.drivers.*`, `age_band`, `kid_note`, `min_age`, `hazards`, `exposure`, `stroller`, `wheelchair` | exists | no | Sonnet; Opus for hard limits |
| M14 | **Drive anchors**: where a car stops and how long the roads are | 4, 5, 7 | `access_points` (derived from `starts_at`, `parks_for`, `serves`), `near_town` and `near_town_km` (derived), `data/reference/drive/areas.json` terrain, `crossings.json`, `segments.json`, `leg_cache` keys `r:` and `t:`, the hubs matrix MX | exists or planned | no | derive steps; DT tasks; MX |
| M15 | **Cost** (factor 3, known costs only in v1) | 7 and 8 known costs | `price`, `access_cost`, `cost_band`, `entry` on offers | exists; fill thin (price on 70 records) | no | Sonnet; no total over gaps (FLOW TF16) |
| M16 | **Kid-friendliness, stroller, accessibility, rainy-day fit, dogs** (family factors) | 3 filters | `age_band`, `kid_note`, `stroller`, `wheelchair`, `indoor`, `ext.trail.dogs` | exists | no | Sonnet |

**Rule:** the builder reads these only through `PlanService` over `CatalogueStore` (ISO-5); light rows carry only the
P8 allowlist plus the duration band and score parts (trip-builder 5). No new list-row key is added by this page.

## 3. `region-groups/1` (M1, M3, M5), the shape

```jsonc
{
  "schema": "region-groups/1",
  "country": "IT",
  "macro": [
    { "id": "it-north", "label": "Northern Italy", "travel": ["it-dolomites", "it-lakes", "it-venice"] },
    { "id": "it-south", "label": "Southern Italy", "travel": ["it-amalfi", "it-puglia"] }
  ],
  "travel": [
    {
      "id": "it-dolomites",
      "label": "Dolomites",
      "areas": ["IT/trentino-alto-adige/val-gardena", "IT/veneto/cortina-d-ampezzo"],
      "gateways": { "in": ["VCE", "VRN", "INN"], "basis": "researched", "src": ["src-..."], "checked": "2026-10-27" },
      "transport": { "car": "needed", "note": "Buses link the valleys in summer; passes close in winter storms", "src": ["src-..."], "checked": "2026-10-27" }
    }
  ]
}
```

- Authored, one file per country under `data/reference/region-groups/<cc>.json`; validated by a Zod schema in
  `core/src/schema/` (TB-MD); exported to `data/schema/generated/`.
- `gateways.in` codes must exist in the airports layer (`E_GATEWAY_IATA`, origin 10).
- Counts per travel region are derived (never stored), from the records whose `area_id` is in `areas`.
- Labels are ours ("Northern Italy"), QB7.

## 4. Who fills what

| Work | Model | Lane |
|---|---|---|
| Travel regions and macro-regions per country | Opus researcher (judgement) | data seat; DC-5 for wave 1 countries |
| Gateways and transport notes | Opus researcher | TB-D4 and ORG-G method |
| Durations, best time, seasons, booking windows | Sonnet researcher by `capture.ts fields`; Opus samples 10% | data seat (DATA-PLAN) |
| Lodging signal | script (TB-BL), Haiku check | data seat |
| Airports, drive minutes, clusters | generated | n/a |

Captures go through the `research` skill and the capture contract (`research/README.md` 3a); never into the notes vault.

## 5. Coverage audit, per travel region

Run before a travel region is offered as builder-ready (green in stage 2). The command is `capture.ts coverage --builder
--region <travel id>` (DC-4 plus TB-MD; until it exists, a reviewer runs the measure below by script and records the
table in the hand-back).

| Check | Bar for "builder-ready" (T2 slice bar, coverage 2.3, plus the engine's needs) |
|---|---|
| Region mapping | travel region row exists; every area of its records is in it; macro row lists it |
| Picks | at least 25 plan-ready places across 4 type families within 100 km of each proposed base |
| Point and access | 100% with a point; 80% of trails and viewpoints with `access_points` (car park or trailhead) |
| Duration | 90% with `on_site_min`, `adult_time_min` or `duration_min` (else the type rule, marked ≈) |
| Season | 90% with `season` or `access_season` (or a dated `searched_none`) |
| Age fit | 80% with `age_band` |
| Booking | every park and lift: `window` or `access_cost` answered or dated |
| Best time | where the type marks it (viewpoints, summits, wildlife), 50% |
| Bases | at least 2 base towns with a lodging class |
| Gateways and transport | `gateways` and `transport` present with a source |
| Drive | a routed matrix among bases and picks in `leg_cache`, or `estimateDrive` L2 with the area's terrain row |

Below the bar the region is offered as "Thin" with its true count; with no records it is "Not researched yet · Ask us"
(TB9).

### 5.1 Pilot baseline (measured 27 Oct 2026 on `main` 819dc834)

Place and route records by area prefix, joined to their suitability and relevance sidecars; a scratch script, not
committed (DC-4 replaces it). "Season" counts `season` on the record or `access_season` in the sidecar; "time on site"
counts `on_site_min` or `adult_time_min`.

| Metadata | Dolomites (IT trentino-alto-adige, veneto) | Ontario (CA/ON) | Canadian Rockies (CA/AB, CA/BC) |
|---|---|---|---|
| Records (place and route) | 42 | 4 | 119 |
| Point (via derived `near_town`) | 42 | 4 | 116 |
| Season or access season | 27 | 2 | 50 |
| Time on site | 27 | 3 | 84 |
| Age band | 25 | 3 | 52 |
| Draw (relevance) | 32 | 4 | 49 |
| Best time of day | 2 | 0 | 2 |
| Hours | 1 | 0 | 2 |
| `starts_at` (drive anchor) | 1 | 0 | 3 |
| Travel region, gateways, transport | none | none | none (Rockies base plan has gateways for its trip only) |

**Reading:** the Dolomites and the Rockies have enough places and durations to build; they lack travel-region rows,
gateways at region level, best time and drive anchors, so first builds order days by drive only ("Shortest drive order",
trip-builder 4.9) and route to the place point, not the car park. **Ontario is not builder-ready** (4 records); FS-1 shows
its thin count on stage 1 before Pick, with "Ask us" (owner decision F-Q1: research later; launch on the trips by air).

### 5.2 Order of fill for the pilots

| Order | Work | Region | Model | h (estimate) |
|---|---|---|---|---|
| 1 | `region-groups/1` for IT and CA with the pilot travel regions, gateways, transport | Dolomites, Rockies, Algonquin and Muskoka | Opus | 3 |
| 2 | `starts_at` for trails and viewpoints (car park or trailhead), from OSM and agency pages | Dolomites, Rockies | Sonnet | 6 |
| 3 | `best_time` where a source states it; `fills_by` for the busy car parks | Dolomites, Rockies | Sonnet, Opus sample | 4 |
| 4 | season and age band to the bar | Dolomites | Sonnet | 3 |
| 5 | Ontario: the 4 h batch | Ontario | later (owner, F-Q1) | coverage plan |

These rows go to DATA-PLAN through BACKLOG 15.353; they do not start before TB-MD lands the schema.

## 6. Gotchas

- Do not add a `region_id` or `cluster_id` to records: membership comes from `area_id`, clusters from the build.
- Do not store nearest airports per place (OR10); they are derived.
- A travel region's `areas` must use locations-store area ids, which are not record refs (as `covers_areas`).
- Longitudes are positive east wherever a centroid is computed (`core/src/sun` convention).
- 78 records have no `area_id` (trip-builder 8.2); they belong to no travel region until AREA-2 places them.

## Change log

- 2026-10-27: created (TB-FLOW, travel-planner, Opus). Three true additions (two-level region groups with gateways and
  transport notes; `on_site_min` on the town profile); pilot baseline measured.
