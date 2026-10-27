# Property catalogue and display matrix: every property, its rules, and where it is shown or exposed

Status: **spec only, planned** (26 Oct 2026, travel-planner, Opus 5.5). Docs only: no app code, no new HTML. Owner direction
of 26 Oct 2026 (TODO row of that date). BACKLOG 15.300 to 15.312 (numbers to be reconciled at merge with the parallel
`public/ENTITY-SPEC` branch); owner questions QM1 to QM10 (section 13). The MCP half of the same request is
[../mcp/tools-v1-from-api.md](../mcp/tools-v1-from-api.md); the two pages share one task list (section 12 here).

Measured on `main` 4d4eae90 with read-only scripts over `core/src/schema/capture/properties.ts`, `data/vocab/types.json`
(through `core/src/capture/resolve.ts`, the same resolver `capture.ts fields` uses), `data/schema/freshness.json`,
`core/src/schema/api/*.ts` and `web/lib/public/{contract,sections}.ts`. Principles cited by number from
[../design/foundation/principles.md](../design/foundation/principles.md).

**Builds on, does not replace:** the capture contract ([capture-contract.md](../../../research/method/capture-contract.md)
3.2, 3.3, 3.5, 7, 8.1), the keep-or-drop rule ([catalogue-intake-and-storage.md](catalogue-intake-and-storage.md) 2), the
field audit ([AUDITS-AFTER-RELEASE.md](../build/AUDITS-AFTER-RELEASE.md) 4, FA-1 to FA-7, AU-D), the parks spec
([protected-area-entry.md](protected-area-entry.md) 4, 5) and the place-page rules of
[trip-and-places-ux-fixes.md](trip-and-places-ux-fixes.md) 8 (UXB-7).

**Supersedes:** nothing outright. It narrows three things: AU-D's output becomes registry overrides (`expose.mcp`), not a
free-standing list (14, row 3); `formatValue` moves from `web/lib/public/sections.ts` to core (PM-F); the MCP resources
`schema://entity/<kind>` give way to generated type and property resources (MCP page section 12).

## 0. The decision in one paragraph

The property registry (`PropertyDef` in `core/src/schema/capture/properties.ts`) becomes the **one place** that says, for
every property, not only its label, value type, unit, section and display level (as today) but also its **privacy class**
and its **exposure** on each surface: the web place page, the trip page, lists and filters, search, print and CSV, GPX,
`/api/v1`, the public MCP and the private MCP. Defaults are derived from what the registry already says (as `keepOf`
derives the keep reasons), so a new row writes only its exceptions. `capture.ts build` generates the full matrix
(`data/schema/generated/property-matrix.json` and `.md`) by joining the registry, the resolved type marks, the freshness
classes and the API contracts, and `build --check` in check-all fails on drift and on twelve rule breaks (section 10). The
value formatter moves to core, the API gains one registry-keyed facts read model, and the MCP, print and CSV all read that
model, so a property added once is labelled, formatted, gated and exposed the same way everywhere. **Trade-off:** about
13 h of contract and generator work in bundle D before the fields audit and MCP need it, against today's six scattered
places (registry, `contract.ts`, `sections.ts`, the list allowlist, `respond()`, freshness) that each decide part of a
property's fate and can disagree.

## 1. Owner direction, traced

| # | Owner, 26 Oct 2026 | Where |
|---|---|---|
| O1 | Schema, database and properties, and how we show everything, matter a lot; finish the planning before more building | 0, 12 (contract tasks before MCP and before the fields audit) |
| O2 | Research which properties exist for each entity type | 2, 5, 6, 7 |
| O3 | Write them so they are reusable across UI, API, MCP, export and print | 3, 4, 10 |
| O4 | Per property: id, value type and units, required or optional, source lane, freshness, privacy class, where shown or exposed, display rule | 3.2, 5, 6, 7 |
| O5 | Flag properties nobody fills or reads, and properties the UI needs that do not exist | 9 |
| O6 | Make the matrix generatable or checkable so it cannot drift; one place to add a property | 4, 10 |
| O7 | MCP built only from the API side, specified in detail from the API contracts | [../mcp/tools-v1-from-api.md](../mcp/tools-v1-from-api.md) |
| O8 | Where it fits in MASTER-ORDER's lanes and bundles, with hours and models | 12 |
| O9 | Interface with the entity-graph spec | 11 |

## 2. What exists today (measured 26 Oct 2026)

### 2.1 The sources of truth and what each decides

| Source | Decides | Gap for this request |
|---|---|---|
| `core/src/schema/capture/properties.ts` (`PROPERTIES`) | key, group, label, value type, unit, gap wording, section, display levels (`rest`, `rest!`, `card`, `detail`, `filter`), base mark, trigger, home, filter role and band, layers, keep reasons K1 to K7 | no privacy class; no exposure per surface; units missing on 13 numeric facts (9.3) |
| `data/vocab/types.json` (398 nodes, 324 type ids, 47 profiles) | marks R, R?, A, N per type node and layer; links per type; **source order per type** (`sources`: O, F, T, D, C, X); slot 3 | source lanes are per type, not per property (kept that way, 3.2) |
| `data/schema/freshness.json` (8 classes) | stale-after days and the action per class, keyed by property | two `rest!` properties in no class (9.3) |
| `web/lib/public/contract.ts` | `HIDDEN_FROM_PAGE` (`near_town`, `near_town_km`), chip-row and warning-line properties, glance slots | a page-only decision the API and MCP cannot see |
| `web/lib/public/sections.ts` `formatValue` | how a value reads by value type; **guesses units from the key suffix** (`_m`, `_km`, `_min`) when the registry has none | web only: print, CSV and MCP cannot reuse it |
| `core/src/schema/api/place.ts` | the list row allowlist (41 keys, P8), facet keys, the detail page model whose `sections[].rows[]` carry the registry `key`, `label`, `unit`, `val`, `state`, `gapWording` | the detail also carries a second, legacy flat copy of the same facts (`stats`, `minAge`, `hazards`, `facts`, `access`) |
| `web/lib/server/respond.ts` | row allowlists, privacy detector, error mapping | web only; the MCP needs the same guard (MCP page 1, finding F9) |
| `core/src/privacy/detect.ts` | keys and patterns that must never leave the server (`PRIVATE_KEYS`, `ORIGIN_REF`, `PLANNING_NOTE`) | not tied to the registry; fine, because no registry property is household data |

### 2.2 Counts

| Measure | Value |
|---|---|
| Registry properties | **239**: 86 base, 153 suitability |
| Base properties by home | capture 30, relevance 12, tracks 1, **none 43** |
| By display level | `rest!` 23, `card` 19, `detail` 153, filter role 29 |
| Freshness classes | 8 (prices 120 d, hours 180 d, booking windows 365 d, closures 7 d untrusted, hard limits 365 d, trail stats 1,095 d, geography never, summaries 730 d) |
| Capture records | 498 (place 304, route 143, offer 50, event 1); suitability sidecars 605; relevance 292 (AUDITS 4.1) |
| Place list row keys (P8 allowlist) | 41 (`PLACE_ROW_KEYS`) |
| Trip list row keys | 37 plus `ref` |
| `/api/v1` routes | 23 GET and 1 POST (`data/schema/generated/openapi.json`) |
| MCP today | the local stdio server only: 15 read tools over files (`core/bin/mcp.ts`), owner-only |

## 3. The model

### 3.1 Entity kinds (layers) and the main types this page covers

Records are one of four layers (capture contract 2.4): **place**, **route**, **offer** (classes experience, rental, ticket,
access, lodging) and **event**. A "stay" is not a layer: it is a `stay.*` place plus its lodging offer, and on a trip a
**base** (trip-level, section 8). An **operator** record (`operator/<slug>`, used by the parks spec for authorities and
system passes) carries no registry properties today; section 11 asks ENTITY-SPEC to settle it.

| Column code | Type id | Layer | Profile |
|---|---|---|---|
| NP | `nature.protected.national_park` | place | area |
| PP | `nature.protected.state_provincial_park` | place | area |
| Trail | `nature.trail.hike` | route | hike |
| Lake | `water.body.lake` | place | lake |
| View | `nature.viewpoint.viewpoint` | place | viewpoint |
| CampP, CampO | `stay.camp.campground` | place; offer (lodging) | stay |
| Drive | `wheels.drive.scenic_drive` | route | drive |
| Pass | `access.pass.park_pass` | offer (access) | none |
| Permit | `access.pass.backcountry_permit` | offer (access) | none |
| Tour | `culture.tour.guided_tour` | offer (experience) | sight |
| Rental | `water.paddle.canoe.rental` | offer (rental) | canoe_kayak |
| HotelP, HotelO | `stay.room.hotel` | place; offer (lodging) | stay |
| Event | `event.natural.larch` | event | none |

### 3.2 The columns of the matrix

| Column | Meaning | Where it comes from | New? |
|---|---|---|---|
| `key` | stable property id; suitability paths dotted (`effort.drivers.gain_m`) | registry | no |
| `group`, `label` | grouping and the visitor-facing label | registry | no |
| `value`, `unit` | value type (24 types) and unit | registry; units become mandatory for numeric facts (K6) | rule new |
| `mark` per type and layer | R, R? with its trigger, A, N | `types.json` through the resolver | no |
| `home` | where a value is stored: capture record, relevance record, suitability sidecar, tracks, or none | registry | no |
| `source lanes` | the order of sources researchers use: O operator, F official, T tourism board, D open data, C community, X computed | the type's `sources` in `types.json`; a property-level override only where the capture contract names one (`point`: D then F, never Google; `geometry`: D; relevance: ours plus D; X for derived) | override new (optional `lanes` on a row) |
| `freshness` | the class from `freshness.json`, or `none` (never stale) | joined by key | no |
| `keep` | K1 to K7 (decision, display, filter, check, money, proof, freshness) | `keepOf` | no |
| `privacy` | `public`, `derived`, `internal` (3.3) | registry, defaulted | **new** |
| `expose.page` | `rest!`, `rest`, `card`, `detail`, `no` | registry `display` minus `HIDDEN_FROM_PAGE` | moved into the registry |
| `expose.trip` | `day` (day row), `book` (Bookings tab), `sum` (Summary), or `-` | registry, defaulted (3.4) | **new** |
| `expose.list` | the list row key or band it feeds (`km`, `time_band`), the facet key, `search` (indexed text), or `-` | registry `filter.band`, the row allowlist | made explicit |
| `expose.export` | any of `print`, `csv`, `gpx`, `ics` | registry, defaulted | **new** |
| `expose.api` | `row` (in the list row), `detail` (in the detail and the facts model), `none` | registry, defaulted; checked against the Zod contracts | **new** |
| `expose.mcp` | `public` (both MCP endpoints), `private` (the private endpoint only), `none` | registry, defaulted; AU-D writes the overrides | **new** |
| `display` rule | label, unit format, the five states per surface, section, order | 3.5 | written once in core |
| `deprecated`, `reserved` | the release a field leaves in (AUDITS 4.6), or the task a deferred field waits for (rubric DEFER) | registry | **new** |

### 3.3 Privacy classes

| Class | Meaning | May appear on | Never |
|---|---|---|---|
| `public` | a researched catalogue fact about a place, route, offer or event | every surface its `expose` allows | |
| `derived` | computed in core from public facts (`near_town`, the list bands, completeness, park membership, a park's `access_cost` once PA-DV derives it, park visits on a public trip) | as `public`, labelled as computed where T3 asks | stored by hand on a record |
| `internal` | catalogue bookkeeping: `meta` (RowMeta), run ids, `origin`, `legacyKind`, `legacyMapped`, `searched` notes | nothing outside the server; the app role cannot read `meta` (R-131) | any API, MCP or export |
| `household` | travellers, ages, heights, start dates, the visitor's origin (`from`, `gw`), the home point, favourites, copies, booking state and codes, owner list status and notes, visits | the private MCP only, for the caller's own rows, behind the level and add-ons of [auth-and-sign-in.md](../mcp/auth-and-sign-in.md) 14 | any public surface; the home point anywhere (it has no stored row) |

**No registry property is `household`.** Household data lives in other schemas (`trip-custom/1`, `copies/1`,
`favourites/1`, the locations store's owner fields, the planner tables) and is listed in section 8.2 so the matrix covers
it; a registry row with `privacy: "household"` fails the registry test (K1).

### 3.4 Exposure defaults (`exposeOf`, derived like `keepOf`)

A row writes `expose` only for its exceptions. Defaults, first match per surface:

| Surface | Default | Exceptions written on the row today |
|---|---|---|
| page | the strongest of `display`: `rest!`, then `rest`, then `card`, then `detail`; `no` when the property is in `HIDDEN_FROM_PAGE` | `near_town`, `near_town_km` (`no`) |
| trip | `day` when the display has `card` or the property is a suitability chip (age band, effort, time, stroller); `book` for `window`, `price`, `book_url`, `reservation`, `check_in_out`, `access_cost`, `cancellation`, the PA `entry`; `sum` for `season`, `area_id`, `signals` (designations), park membership | none |
| list | the row key its `filter.band` names (K5 checks it is a real row key), the facet key of its `filter`, `search` for `name`, `names`, `type`, `summary`, `why`, `area_id` | registry bands that are not row keys today: `season_band`, `length_band`, `climb_band` (9.3) |
| export | `print` when the page level is `rest!`, `rest` or `card`; `csv` when `card`, or money (K5), or `window`; `gpx` for `point`, `geometry`, `name`; `ics` for none (public trips are dateless) | |
| api | `row` when the list row carries it; `detail` when it has a home; `none` when the home is `none` (the only answer possible is "not checked") | |
| mcp | `public` when `api` is not `none` and privacy is `public` or `derived`; `none` otherwise | ranking inputs `class_key`, `standing`, `distinction`, `easy_payoff`, `weather` default to `none` (proposal for AU-D; P7 small outputs); `geometry` is `none` in facts (served only by `trip_legs` and export, size) |

### 3.5 The display rule (one formatter in core: PM-F)

**Labels.** The registry label, sentence case, never a key. A suitability path without a row in `SUIT_ROWS` gets a
humanised label today (`ext.paddle.on_water_min` reads "Paddle on water min"); K7 fails a property with `card`, `rest` or
`rest!` display and no authored label.

**Units and number format** (moves from `sections.ts` to `core/src/format/property.ts`; the key-suffix guess is removed
once K6 holds):

| Value type | Format | Example |
|---|---|---|
| `number` | locale grouping, at most 1 decimal for km, 0 for m and min; unit after a space | `11.2 km`, `750 m` |
| `range` | `a–b unit`; minutes as durations | `2 h to 3 h 30`; `14–18 °C` |
| `duration` | as minutes above | `45 min` |
| `limit` | the rule in words with its unit and basis (rule or advice, Q20) | `From 6 years (operator rule)` |
| `price_list` | ISO currency then amount, `per` unit, age band, residency (PA C5) | `CAD 11 per person per day (ages 18+)` |
| `window` | the rule text of `bookRuleText` (one writer, PA-X); relative to Day N on public trips | `Opens 2 days before Day 10 at 08:00 local` |
| `season_rows`, `hours` | month-day ranges, then status or `via`; hours by period | `15 Jun to 30 Sep open` |
| `enum`, `enum_list` | the vocabulary label, never the code | `Fenced in part` |
| `bool` | Yes or No; `null` is a gap, never No | `Yes` |
| `point` | 4 decimals, with "approximate" when `approx` (T5) | `51.3217, -116.1862 (approximate)` |
| `grade` | system then value, with the system's own words | `Parks Canada moderate` |
| `object`, `object_list` | the authored `note` or `reason`; else key-value pairs in words | |
| `link_list`, `photo_list` | page: the links or photos; text surfaces: a count | `5 links` |
| temperature unit | `°C` (the registry writes `C` today: K6 renames) | |

**States** (the six of `SUIT_STATE`, the honesty rule "a gap is never a yes"):

| State | Place page (UXB-7) | Trip page | List and filter | Print, CSV | API facts | MCP |
|---|---|---|---|---|---|---|
| `value` | the value, with its read date where the freshness class has one (T3) | the value | the band or row value | the value | `{state: "value", text, value, unit, read, src, stale}` | same as API |
| `no_limit` | "No limit" (a sourced answer) | "No limit" | counts as a pass for the facet | "No limit" | `state: "no_limit"` | same |
| `none_stated` | "Not published (checked <date>)" | same | the row is in "not checked yet" for that facet (H1) | "Not published" | `state: "none_stated"` | same; the tool text tells the client never to fill it |
| `searched_none` | the property's `gap` wording with the date checked | same | as `none_stated` | the gap wording | `state: "searched_none"`, `text` = gap wording | same |
| `gap` (not checked) | safety (`rest!`) gaps keep their own row "Not checked yet"; every other gap goes into the one "Not checked yet" block at the end (Q300) | safety gaps only | the row is in "not checked yet" | `PRINT_GAP` for safety only | listed in `gaps[]`, safety first; not in `facts[]` | `gaps[]` keys only, safety first |
| `not_applicable` | not drawn | not drawn | not counted | not printed | absent | absent |

**Grouping and order.** Sections in the order of `SECTION_TITLES` (cover, glance, warnings, suits, activity, options,
access, when, facilities, around, pairs, photos, links, sources); inside a section, registry order. Glance facts follow the
type templates of the wireframes (W10: at most 8, only when held). The facts read model keeps the same section and order,
so print and MCP read in the same sequence as the page (P6).

## 4. The single place a new property is added, and what picks it up

**One row in the registry, one mark in `types.json`, and (only if it holds a value) one field in the record schema.**

| Step | File | What the step decides |
|---|---|---|
| 1 | `core/src/schema/capture/properties.ts`: a `def({...})` row for a base property; for a suitability property, its path in the suitability schema (`core/src/suitability/paths.ts`) plus one `SUIT_ROWS` or `EXT_ROWS` line (the registry test already fails a path without one) | key, label, value type, unit, section, display, home, filter role, layers, and now `privacy` and any `expose` exception |
| 2 | `data/vocab/types.json`: the mark on the type nodes that need it | which types ask for it, required or optional |
| 3 | `core/src/schema/capture/records.ts` (or the sidecar schema) when the home is new | where a value is stored |
| 4 | `node core/bin/capture.ts build` | regenerates checklists, the applicability file and the **property matrix**; `build --check` fails until committed |
| 5 | the fields ledger row ([AUDITS-AFTER-RELEASE.md](../build/AUDITS-AFTER-RELEASE.md) 9.2): reader and fill plan | who reads it and who fills it |

What picks it up with no further code:

| Surface | How |
|---|---|
| Place page | `buildSections` renders by `section` and `display`; UXB-7's hide-empty and gap block apply by state |
| Trip page | the day row reads the suit chips and `card` facts through the timeline adapter; Bookings reads `expose.trip = book` |
| Lists, filters, search | a `filter` role adds the facet (capture contract 7); `expose.list` names the row key, which still needs the P8 allowlist edit and its test (deliberate: a list row change is a budget decision, P8) |
| Print and CSV | read the facts read model (API-P) and `expose.export` |
| `/api/v1` | the detail's section rows and the facts model are generic over the registry; OpenAPI regenerates |
| MCP | `get_place` returns the facts model filtered by `expose.mcp` (MCP page 6); `get_type` and the resources read the matrix |
| Field audit | `fields.ts` (FA-1) reads `expose` as the claimed readers and checks them against the code |

The one deliberate exception: a **new list row key** is never automatic (P8 light list data); the matrix only says which
row key a property feeds, and K5 fails a band that names no row key.

## 5. Base properties (86): the matrix

Codes. **Home:** cap capture record, rel relevance record, suit suitability sidecar, trk `data/tracks`, none no home yet,
der derived in core. **Fresh:** the freshness class (pr prices, hr hours, bw booking windows, cl closures, hl hard limits,
ts trail stats, geo geography, su summaries) or `-`. **Priv:** P public, D derived. **Page, Trip, List, Export, API, MCP:**
3.4. Marks per type are in section 7; source lanes follow the type (3.2) unless the Notes column names one.

| Key | Value, unit | Home | Fresh | Priv | Page | Trip | List | Export | API | MCP | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `name` | text | cap | - | P | rest | day | row, search | print csv gpx | row | public | |
| `names` | names | cap | - | P | detail | - | search | - | detail | public | fill 1.4% |
| `type` | type_id | cap | - | P | rest | day | row `type`, `kind`, facet `k` | print csv | row | public | the label, never the id, on text surfaces |
| `point` | point | cap via `points.json` | geo | P | rest (map) | day (map) | row `lat`, `lon`, `approx` | print gpx | row, detail `apiPoint` | public | lanes D then F; never Google (T5) |
| `area_id` | ref | cap | geo | P | rest | sum | row `area`, `region`, `country`; facets | print csv | row | public | |
| `wikidata` | qid | rel | geo | P | detail | - | - | - | detail | public | lane D |
| `osm_ref` | text | cap | geo | P | detail | - | - | - | detail | public | lane D |
| `near_town` | ref | cap (derived, META-2) | geo | D | **no** | - | row `nearTown`, facet `city` | - | row (town id) | public (id only) | names only through `find_towns`, Q50 detector rule |
| `near_town_km` | number km | cap (derived) | geo | D | **no** | - | - | - | none | none | rides inside `near_town` |
| `geonames_id` | text | cap | geo | P | detail | - | - | - | detail | public | fill 7.2% |
| `summary` | text | rel `why`; cap on offers (PA C1, C7) | su | P | rest | - | search | print | detail | public | |
| `season` | season_rows | cap | hr | P | rest | sum | row `season`, facet `season` | print csv | row, detail | public | registry band `season_band` is not a row key (9.3) |
| `best_window` | season_rows | cap | - | P | rest | - | - | print | detail | public | fill 0.2%; MERGE review with `data/windows/` (AUDITS 4.8) |
| `best_time` | object_list | cap | - | P | rest | - | row `best_time`, facet | print | row, detail | public | fill 1.2% |
| `hours` | hours | cap | hr | P | rest | day | facet "Open on" | print | detail | public | fill 2.6% |
| `duration_min` | range min | **none** | - | P | rest | day | row `time_band`, facet | print csv | row | public after RIS-H | R on experience offers with no home; values held anyway on 13 of 50 offers (drift, AUDITS 4.8) |
| `activity_min` | range min | **none** | - | P | detail | - | - | print | none until a home | none until a home | R on experience offers |
| `check_in_out` | object | **none** | hr | P | rest | book | - | print | none until a home | none until a home | R on lodging offers; RIS-H gives a home |
| `access_points` | relation_list | der (from `parks_for`, `serves`, `starts_at`) | - | D | rest | day | - | print gpx | detail | public | |
| `transit` | relation_list | **none** | - | P | detail | - | - | - | none | none | |
| `access_cost` | object_list | rel; der on parks (PA-DV) | pr | P, D | rest! | book, sum | - | print | detail | public | R on every offer and on events today; see QM7 |
| `price` | price_list | cap | pr | P | rest | book | row `price_band`, facet | print csv | row, detail | public | read date mandatory on MCP (T3) |
| `window` | window | cap | bw | P | rest! | book | row `booking`, facet | print csv | row, detail | public | fill 2.8%; KEEP-FILL (safety) |
| `book_url` | text | **none** | bw | P | detail | book | - | csv | none until a home | none until a home | R on experience offers; held on 14 of 50 offers (drift) |
| `reservation` | enum | **none** | bw | P | rest | book | - | print | none | none | |
| `cost_band` | enum | **none** | pr | P | card | - | card | csv | none | none | R on lodging offers with no home |
| `included`, `cancellation`, `deposit` | text | **none** | pr | P | detail | book (`cancellation`) | - | print | none | none | homes from RIS-H |
| `variants` | object_list | **none** | pr | P | rest | - | - | print | none | none | |
| `class_key` | enum | rel | - | P | rest | - | rank | - | detail | **none** (proposal) | ranking input |
| `draw` | enum | rel | - | P | rest, card (badge) | day (badge) | row `badge`, sort | print | row | public (the badge label) | |
| `standing`, `distinction`, `easy_payoff`, `weather` | enum | rel | - | P | detail | - | rank | - | detail | **none** (proposal) | ranking inputs |
| `why` | text | rel | su | P | rest, card | - | search | print | detail | public | same text as `summary` today |
| `signals` | object | rel | - | P | detail | sum (designations) | - | - | detail | public: designations and fame only | `mentions[].reach` and volumes stay off MCP |
| `pairs_with` | object_list | rel | - | P | rest | - | - | - | detail | public (refs and reason) | fill 6.8% |
| `closures` | object_list | **none** | cl | P | rest! | day (check) | - | print | detail (standing rules only) | public, marked untrusted | live closures are never stored; the `conditions` link is the answer |
| `links` | link_list | cap | - | P | detail (links tab) | book (`booking`) | - | print csv | detail | public, `linkOnly` kept | link-only platforms are links, never data |
| `photos` | photo_list | cap | - | P | rest, card | Photos tab | row `image` | - | detail | public: url, credit, licence | |
| `reaches`, `passes` | relation_list | cap | - | P | rest | day | - | print | detail (`routeStops`) | public (ref, name, slug) | `passes` fill 2.8% |
| `part_of` | relation_list | cap | - | P | rest | sum (parks) | facet `park` (PA-Q) | print | detail (`partOf`) | public | fill 1.6%; park membership (ENTITY) |
| `starts_at`, `ends_at` | relation_list | cap | - | P | rest; detail | day | - | print gpx | detail | public | `ends_at` 0% |
| `on`, `at`, `run_by` | relation_list, ref | cap | - | P | rest | book | - | print | detail (`offers`) | public | `run_by` widens to parks (PA C7) |
| `parks_for`, `serves` | relation_list | cap | - | P | rest | day | - | print | detail (`accessPoints`) | public | `serves` 1.6% |
| `combo_with`, `alternative_to` | relation_list | cap | - | P | detail | - | - | - | detail | public | **0% filled** |
| `variant_of` | relation_list | cap | - | P | detail | - | - | - | detail | public | 4% |
| `geometry` | object | trk | geo | P (licence-bound) | detail (map line) | day (map), legs | - | gpx, kml (licence guard) | detail `lines` | **none in facts**; `trip_legs` and export only | ODbL and source licence travel with it |
| `high_point_m` | number m | **none** | ts | P | detail | - | - | print | none until a home | none until a home | a W10 glance fact for trails with no home (9.2) |
| `gpx_licence` | text | **none** | - | P | detail | - | - | gpx | none | none | |
| `snow_free_window` | season_rows | **none** | - | P | rest | - | - | print | none | none | |
| `turnaround_points` | object_list | **none** | - | P | detail | - | - | print | none | none | |
| 25 type facts: `bearing`, `crowds`, `photo_spot`, `visit_mode`, `indoor`, `dress_code`, `photo_rules`, `languages`, `queue_note`, `seat_side`, `fills_by`, `capacity`, `rv_limits`, `ev_charging`, `overflow`, `kids_menu`, `high_chairs`, `dietary`, `family_rooms`, `pitches`, `quiet_hours`, `why_stay`, `groceries`, `last_transport`, `tourist_tax`, `sun_loss` | as registry | **none** | `fills_by` bw; `last_transport` hr; `tourist_tax` pr; `why_stay` su | P | as registry (`indoor` card) | - | `indoor`, `kids_menu`, `family_rooms` have a filter role with no value possible | print | none | none | all 0%; FA-2 verdicts (DEFER or REMOVE-FROM-CONTRACT) |

**Rule (K10):** a property whose home is `none` is `expose.api = none` and `expose.mcp = none`. The page may still show
its gap inside the "Not checked yet" block when the type marks it R, because that is a research signal; an API or a chat
client gains nothing from a field that can only ever say "not checked".

## 6. Suitability properties (153)

All 153 have home `suit` (the suitability sidecar, joined by ref; on an offer, the block of its `at` place, or of
`offer/<ref>#ticket` for lifts), privacy `public`, `expose.api = detail` (the suitability groups and the facts model) and
`expose.mcp = public` by default. They differ in display, filter role, unit and freshness:

| Family | Keys | Display | Filter, row | Unit | Fresh | Trip |
|---|---|---|---|---|---|---|
| Hard limits | `min_age`, `max_age`, `min_height_cm`, `max_height_cm`, `min_weight_kg`, `max_weight_kg`, `adult_required`, `solo`, `group_min`, `participation.driver`, `participation.min_shoe_eu`, `ext.coaster.driver_rule`, `ext.wildlife.min_distance_m` | `rest!` (`min_shoe_eu` detail) | - | years, cm, kg, EU; **none on `adult_required`, `solo`, `group_min`, `participation.driver`, `ext.coaster.driver_rule`, `ext.wildlife.min_distance_m`** (a limit with no unit reads ambiguously in print) | hl | day (chip) |
| Who it suits | `age_band`, `kid_note`, `carrier_ok`, `stroller`, `stroller_extent`, `stroller_on_board`, `wheelchair`, `access_detail`, `accessible_toilet`, `accessible_parking`, `limited_capacity_note`, `limit_reason` | `age_band` rest card filter; `stroller`, `wheelchair` rest filter; rest detail | `age_band` → `kids_from`, `kid_fit`, `kids_basis`; facets `kid`, `stroller` | years | - | day (chips) |
| Effort | `effort.source_grade`, `effort.drivers.{distance_km, gain_m, loss_m, max_grade_pct, surface, scrambling, fixed_aids}` | grade, distance rest card filter; gain rest filter; rest detail | `effort`, `km`, `gain_m`; registry bands `length_band`, `climb_band` are not row keys (9.3) | km, m, % | ts | day (stats) |
| Time | `adult_time_min`, `child_time_min`, `on_site_min`, `walk_m` | rest card filter (`child_time_min` rest) | `time_band`, `walk_band` | min, m | ts (`adult_time_min`) | day |
| Facilities | `toilets`, `water`, `food`, `shade`, `signal`, `change_rooms`, `showers`, `picnic`, `baby_change` | detail (`toilets`, `change_rooms` filter) | facets | - | - | - |
| Safety | `exposure`, `hazards`, `altitude_m`, `bail_out` | `exposure`, `hazards` rest!; detail | `exposure` facet "Fenced" | m | cl (`exposure`, `hazards`) | day (warning line) |
| Water | `water_safety.{class, lifejacket, child_sizes_from_kg, swim_ability, lifeguard, entry, water_temp_c, current_or_tide}` | `lifejacket` rest!; `lifeguard`, `swim_ability` rest; detail | `lifeguard`, `water_temp_c` facets | kg, °C | **`lifejacket` in no class** (9.3) | day (chip) |
| Seasons | `access_season` | rest, rest! | - | - | hr | sum |
| Participation | `participation.{guide, kit_provided, wear, fitness, medical, pregnancy, waiver, weigh_in, weather_cancel}` | `guide`, `medical`, `pregnancy`, `weather_cancel` rest; detail | `guide`, `weather_cancel` facets | - | - | - |
| Extensions | 87 `ext.<family>.<key>` paths (trail 5, ride 9, paddle 9, ferrata 5, water 3, cave 7, snow 3, lift 4, boat 4, zip 5, jump 3, coaster 4, horse 4, glacier 3, flight 4, wildlife 6, area 4, drive 5) | detail by default; 17 promoted in `EXT_ROWS` (`ext.lift.last_up`, `last_down`, `ext.wildlife.stay_in_vehicle`, `ext.area.pass`, `ext.coaster.driver_rule`, `ext.wildlife.min_distance_m` rest!) | `ext.trail.shape` → `shape`; `ext.trail.dogs`, `ext.water.swimming`, `ext.snow.magic_carpet` facets | **12 numeric facts typed `text` and one `range`, all with no unit** (9.3) | `ext.lift.*` hr; `ext.area.pass` pr; **`ext.wildlife.stay_in_vehicle` in no class** | - |

The full 153-row table, with every column of 3.2, is the generated `data/schema/generated/property-matrix.md` (PM-G).
This page keeps the rules and the families so a reviewer can judge them; the generated file is the list.

## 7. Marks per main type (snapshot, generated)

Generated 26 Oct 2026 from `main` 4d4eae90 by the resolver (`resolveNode`) over `types.json`; PM-G regenerates it on every
build. Blank is N (never asked, shown or counted). `Ro` is "required when operated". Suitability marks are shown on the
place or route, and on the two offers that carry their own block (Tour, Rental); lodging, pass and permit offers carry
none. Planned additions from the parks spec are in 7.1.

| Property | NP | PP | Trail | Lake | View | CampP | CampO | Drive | Pass | Permit | Tour | Rental | HotelP | HotelO | Event |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `name` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| `names` | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A |
| `type` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| `point` | R | R | R | R | R | R |  | R |  |  |  |  | R |  | R |
| `area_id` | R | R | R | R | R | R |  | R |  |  |  |  | R |  | R |
| `wikidata` | R | R | R | R | R |  |  | A |  |  |  |  |  |  | R |
| `osm_ref` | A | A | A | A | A | A |  | A |  |  |  |  | A |  | A |
| `near_town` | R? | R? | R? | R? | R? | R? |  | R? |  |  |  |  | R? |  |  |
| `geonames_id` | A | A |  | A | A | A |  |  |  |  |  |  | A |  |  |
| `summary` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| `season` | R? | R? |  |  |  | R |  |  | R? | R? | R | R | R |  | R |
| `best_window` | A | A | A | A | A |  |  | A |  |  |  | A |  |  | A |
| `best_time` | A | A | A | R | R |  |  | A |  |  | A | A |  |  | A |
| `hours` | R? | R? |  | R? | R? | R |  |  | R? | R? | R | R | R |  |  |
| `duration_min` |  |  |  |  |  |  |  |  |  |  | R |  |  |  |  |
| `activity_min` |  |  |  |  |  |  |  |  |  |  | R |  |  |  |  |
| `check_in_out` |  |  |  |  |  |  | R |  |  |  |  |  |  | R |  |
| `access_points` | R | R | R | R | R? | A |  | R |  |  |  |  | A |  | R? |
| `transit` | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A |
| `access_cost` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| `price` | R? | R? | R? | R? | R? | R | R | R? | R | R | R | R | R | R |  |
| `window` | R? | R? | R? | R? | R? | A | A | R? | R | R | R? |  | A | A |  |
| `book_url` |  |  |  |  |  |  |  |  |  |  | R |  |  |  |  |
| `cost_band` |  |  |  |  |  |  | R |  |  |  |  |  |  | R |  |
| `included` |  |  |  |  |  |  |  |  |  |  | A | A |  |  |  |
| `cancellation` |  |  |  |  |  |  | A |  | A | A | A | A |  | A |  |
| `deposit` |  |  |  |  |  |  |  |  |  |  |  | A |  |  |  |
| `variants` |  |  |  |  |  |  |  |  |  |  | A | A |  |  |  |
| `class_key`, `draw`, `standing`, `distinction`, `easy_payoff`, `weather`, `why`, `signals` | R | R | R | R | R |  |  | R |  |  | R |  |  |  |  |
| `pairs_with` | A | A | A | A | A | A | A | A |  |  | A | A | A | A | A |
| `closures` | R? | R? | R? | R? | R? |  |  | R? | R? | R? | A | A |  |  | R? |
| `links` | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R |
| `photos` | A | A | A | A | A | A | A | A |  |  | A | A | A | A | A |
| `reaches` |  |  | R? |  |  |  |  |  |  |  |  |  |  |  |  |
| `passes` |  |  | A |  |  |  |  | A |  |  |  |  |  |  |  |
| `part_of` | A | A | R? | A | R? | A | A | A | A | A | A | A | A | A | A |
| `starts_at` |  |  | R |  |  |  |  | R |  |  |  |  |  |  |  |
| `on` |  |  |  |  |  |  | A |  | A | A | A | A |  | A |  |
| `at` |  |  |  |  |  |  | R |  | R | R | R | R |  | R |  |
| `run_by` |  |  |  |  |  |  | A |  | A | A | R | R |  | A |  |
| `geometry` |  |  | R |  |  |  |  | R |  |  |  |  |  |  |  |
| `high_point_m`, `gpx_licence`, `snow_free_window`, `turnaround_points` |  |  | A |  |  |  |  | A |  |  |  |  |  |  |  |
| `min_age` |  |  | A |  |  | A |  |  |  |  | A | R | A |  |  |
| `min_weight_kg`, `max_weight_kg`, `limit_reason` |  |  |  |  |  |  |  |  |  |  |  | A |  |  |  |
| `adult_required` |  |  | Ro |  |  |  |  |  |  |  | A | R |  |  |  |
| `group_min` | A | A | R |  |  |  |  |  |  |  |  |  |  |  |  |
| `age_band` |  |  | R | R | R |  |  |  |  |  | A | R |  |  |  |
| `kid_note` | R | R | R | R | R | A |  | A |  |  | R | R | A |  |  |
| `carrier_ok` |  |  | R | A | A |  |  |  |  |  | A |  |  |  |  |
| `stroller` | A | A | R | R | R | A |  |  |  |  | R |  | A |  |  |
| `stroller_extent` | A | A | A | A | A | A |  |  |  |  | A |  | A |  |  |
| `wheelchair` | A | A | A | R | R | R |  |  |  |  | R | A | R |  |  |
| `access_detail`, `accessible_parking` |  |  | A | A | A | A |  |  |  |  | A |  | A |  |  |
| `accessible_toilet` | A | A | A | A | A | A |  | A |  |  | A |  | A |  |  |
| `limited_capacity_note` | A | A | A | A | A |  |  |  |  |  | A | A |  |  |  |
| `effort.source_grade` |  |  | R |  |  |  |  |  |  |  |  |  |  |  |  |
| `effort.drivers.distance_km` |  |  | R | A | A |  |  |  |  |  |  | A |  |  |  |
| `effort.drivers.gain_m` |  |  | R | A | A |  |  |  |  |  |  |  |  |  |  |
| `effort.drivers.surface`, `loss_m` |  |  | A | A | A |  |  |  |  |  |  |  |  |  |  |
| `effort.drivers.scrambling`, `fixed_aids` |  |  | A |  |  |  |  |  |  |  |  |  |  |  |  |
| `adult_time_min` |  |  | R |  |  |  |  |  |  |  |  |  |  |  |  |
| `child_time_min` |  |  | A |  |  |  |  |  |  |  |  |  |  |  |  |
| `on_site_min` | R | R |  | R | R |  |  | R |  |  | R | R |  |  |  |
| `toilets` | A | A | A | A | A |  |  | A |  |  | A | A |  |  |  |
| `water` | A | A | A |  |  |  |  |  |  |  |  |  |  |  |  |
| `food` | A | A | A | A | A |  |  | A |  |  | A |  |  |  |  |
| `shade` |  |  | A | A |  |  |  |  |  |  |  |  |  |  |  |
| `bail_out` |  |  | A |  |  |  |  |  |  |  |  |  |  |  |  |
| `signal` | A | A | A |  |  |  |  | A |  |  |  |  |  |  |  |
| `picnic` | A | A |  | A | A |  |  |  |  |  | A |  |  |  |  |
| `baby_change` | A | A |  |  |  | A |  |  |  |  | A |  | A |  |  |
| `exposure` |  |  | R | A | R |  |  | A |  |  |  |  |  |  |  |
| `altitude_m` | A | A | A | A | A |  |  | A |  |  |  |  |  |  |  |
| `hazards` | R | R | R | A | A |  |  | A |  |  |  | A |  |  |  |
| `walk_m` |  |  |  | R | R |  |  |  |  |  |  |  |  |  |  |
| `water_safety.class`, `lifejacket`, `child_sizes_from_kg` |  |  |  |  |  |  |  |  |  |  |  | R |  |  |  |
| `water_safety.swim_ability`, `current_or_tide` |  |  |  |  |  |  |  |  |  |  |  | A |  |  |  |
| `water_safety.entry` |  |  |  | A |  |  |  |  |  |  |  |  |  |  |  |
| `water_safety.water_temp_c` |  |  |  | A |  |  |  |  |  |  |  | R |  |  |  |
| `access_season` | R | R | R | R | R | A |  | R |  |  | A | R | A |  |  |
| `participation.guide`, `wear`, `waiver`, `weather_cancel` |  |  | Ro |  |  |  |  |  |  |  |  | A |  |  |  |
| `participation.fitness` |  |  | Ro |  |  |  |  |  |  |  |  |  |  |  |  |
| `participation.kit_provided` |  |  |  |  |  |  |  |  |  |  |  | A |  |  |  |
| `ext.trail.navigation` |  |  | R |  |  |  |  |  |  |  |  |  |  |  |  |
| `ext.trail.shape`, `water_crossings`, `snowfields_until`, `dogs` |  |  | A |  |  |  |  |  |  |  |  |  |  |  |  |
| `ext.paddle.craft`, `wind_exposure`, `craft_capacity`, `guided` |  |  |  |  |  |  |  |  |  |  |  | R |  |  |  |
| `ext.paddle.on_water_min`, `portages` |  |  |  |  |  |  |  |  |  |  |  | A |  |  |  |
| `ext.water.swimming` |  |  |  | A |  |  |  |  |  |  |  |  |  |  |  |
| `ext.area.pass`, `access_road`, `stay_on_site`, `child_trails` | A | A |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `ext.drive.vehicle_limits`, `road_surface`, `drive_min` |  |  |  |  |  |  |  | R |  |  |  |  |  |  |  |
| `ext.drive.fuel_gap_km`, `winding` |  |  |  |  |  |  |  | A |  |  |  |  |  |  |  |

Links per type (from `types.json`; `official` is R everywhere): parks R? `booking`, A `conditions`, `osm`, `wikidata`,
`wikipedia`, `commons`, `map_sheet`; trail R? `booking`, A `conditions`, `osm`, `track_source`, `gpx_download`, link-only
platforms, `trip_report`, `webcam`, `map_sheet`, `video`; lake A `conditions`, `booking`, `timetable`, `osm`, `wikidata`,
`wikipedia`, `commons`, `webcam`; viewpoint A `conditions`, `osm`, `wikidata`, `commons`, `webcam`; camping and hotel A
`booking`, `terms`, `accessibility`; passes R? `booking`, A `status`, `webcam`; tour A `hours_rates`, `booking`,
`accessibility`, `tourism_board`; event A `tourism_board`.

Source lanes per type, in order: parks F; trail F T D C; lake F O T D X C; viewpoint F D X; camping and hotel O F; scenic
drive F O X; passes and permits F D C; guided tour O T F D; canoe rental O F T; event T F.

### 7.1 Planned additions (parks spec PA-C and PA-3C; not in the snapshot)

| Key | On | Mark | Home | Privacy | Expose | Source |
|---|---|---|---|---|---|---|
| `entry` (object: required, needed_for, unit, valid, channel, proof, exemptions, change, cancel, quota) | `access.pass.*` offers | R | cap | P | page rest!; trip book; export print csv; api detail (`EntryRequirement`); mcp public | PA C2, C7 |
| `covered_by` | access offers | A | cap | P | page rest!; trip book (park line); api detail; mcp public | PA C4, C6 |
| `covers_areas` | `nature.protected.*` | A (R? W_PARK_AREA) | cap | P | page none (drives membership); api none; mcp none (membership is the read model) | PA C4 |
| `run_by` on parks | `nature.protected.*` | R | cap | P | page rest (authority); api detail; mcp public | PA C7 |
| `summary` home on offers | offers | R | cap | P | as `summary` | PA C1, C7 |
| `camp.site_kinds`, `camp.food_storage`, `camp.fire_rings`, `camp.max_stay_nights` | campground place; lodging offer | R, R?, A, A | cap | P | page rest (site kinds), detail; trip book (max stay); api detail; mcp public | PA-3C |
| `access_cost` on access offers | `access.pass` | **N** | | | | PA C8 |
| `parks_for`, `point` marks on `access.pass` | | **removed** (dead marks today, 9.3) | | | | PA C8 |

## 8. Fields outside the registry

### 8.1 API envelope fields (the read models' own keys)

Every key of the public read models must have one row in the authored exposure map `core/src/schema/exposure.ts` (PM-C);
K8 fails a Zod key with no row. Shown here for the keys that matter to MCP and export.

| Read model | Keys | Privacy | MCP | Notes |
|---|---|---|---|---|
| `PlaceRow` | `ref`, `slug`, `name`, `kind`, `kindLabel`, `type`, `country`, `country_name`, `region`, `region_name`, `area`, `area_name`, `lat`, `lon`, `approx`, `season`, `kid_fit`, `kids_from`, `kids_basis`, `effort`, `km`, `gain_m`, `time_band`, `price_band`, `booking`, `walk_band`, `shape`, `best_time`, `badge`, `image`, `trips`, `tags`, `honesty`, `completeness`, `statsState`, `researched`, `nearTown` | P, D | public | the projection drops `regionAliases`, `legacyKind`, `flags`, `elevation_m` (see 9.2) |
| `PlaceRow` | `legacyKind` | I | none | legacy |
| `PlaceRow` | `elevation_m` | P | none until K-merge | a third elevation (with `altitude_m` and `high_point_m`) read from the locations store, no registry key (9.2) |
| `PlaceDetail` | identity, `areaChain`, `point`, `summary`, `photo`, `trips`, `tags`, `completeness`, `honesty`, `links`, `linksNone`, `citations`, `refSlugs`, `sections` | P | public through the facts model | |
| `PlaceDetail` | `stats`, `elevationM`, `kidFit`, `minAge`, `booking`, `hazards`, `seasonNote`, `access`, `facts`, `lines` | P | **none** (legacy flat copies of registry facts; MCP reads the facts model only) | FA-2 decides whether the page still needs them |
| `PlaceDetail` | `sources` (`prototype`, `trail`, `capture`), `notes` (always `""`), `legacyMapped` | I | none | `sources` is an origin list (PRIV1 spirit) |
| `PlaceDetail` | `suitability`, `relevance` blocks | P | public through the facts model plus `relevance.similar`, `pairs`, `planB` as refs | |
| `TripRow`, `TripDetail` | `ref`, `slug`, `title`, `subtitle`, `depth`, `nights`, `days`/`daysCount`, `region`, `cover`, `season` (months, label, why, weather), `countries`, `continents`, `length`, `lengthClass`, `ageFit`, `kidsBasis`, `effort`, `hike`, `strollerDays`, `activities`, `highlights`, `around`, `perDay`, `shape`, `fromHubs`, `bases` (name, nights, days, point), `days` (items, base, driveMin), `categories`, `gallery`, `honesty`, `tags`, `driveAvgMin` | P, D | public (`days` without `scheduleInput`; `schedule.timelines` none) | the scheduler's open shapes (`looseObject`) never reach MCP |
| `TripRow`, `TripDetail` | **`isDone`** | **household** (computed from the trip's real date in the old hub, `web/lib/public/trips.ts` 427) | **none** | a public "this trip already happened" flag breaks the "no personal status" rule (PLAN 1); BACKLOG 15.310 asks the API to drop it |
| `TripDetail` | `legacyUrl`, `visibility`, `seasonNotSet` | I | none | |
| `ExportFile` | per format | P | not in v1 (QM10) | |

### 8.2 Household and account data (never in the registry)

| Data | Store | Privacy | Public surfaces | Private MCP |
|---|---|---|---|---|
| travellers, children's ages, heights | `trip-custom/1` `travellers`; planner `person` | household | never | `people` add-on only; else labels "Child 1 (9)" |
| a copy's start date | `trip-custom/1` `start` | household | never | `plans_read` (the user's own trip) |
| the visitor's origin `from`, gateway `gw` | `trip-custom/1`, `origin/1` on the device, `account_start` (ORG-H) | household | never; server output never varies by origin | `people` add-on (QM8) |
| the home point | env only (`HOME_POINT_LAT`, `HOME_POINT_LON`) | household | never | never; no MCP code may read it (MCP page 11) |
| favourites, copies | `favourites/1`, `copies/1`; `account_favourite`, drafts | household | never | `plans_read` |
| booking state, confirmation codes | planner reservations | household | never | codes only with the `codes` add-on |
| owner list status, notes, visits, saved posts | `data/locations/locations.json` owner fields | household (PRIV1) | never | never in v1 |
| RowMeta | `meta` on catalogue rows | internal | never | never |

## 9. Findings

### 9.1 Properties nobody fills or reads (inputs for FA-1, FA-2 and AU-D)

| Finding | Properties | Evidence | Proposed verdict (FA-2 decides) | Task |
|---|---|---|---|---|
| No home, so no value can exist | the 43 home-`none` base properties (25 type facts, `transit`, `variants`, `reservation`, `cost_band`, `included`, `cancellation`, `deposit`, `closures`, `access_points` (derived), `duration_min`, `activity_min`, `check_in_out`, `book_url`, `high_point_m`, `gpx_licence`, `snow_free_window`, `turnaround_points`) | AUDITS 4.8: 43 at 0%, 21 with no mention outside the registry | RIS-H homes for the 10 with readers or R marks (`duration_min`, `activity_min`, `check_in_out`, `book_url`, `cost_band`, `cancellation`, `included`, `deposit`, `high_point_m`, `closures` standing rules); DEFER or REMOVE-FROM-CONTRACT for the 25 type facts | FA-2, RIS-H |
| Stored, never filled | `combo_with`, `alternative_to`, `ends_at` (0%), `best_window` 0.2%, `best_time` 1.2%, `names` 1.4%, `part_of` 1.6%, `serves` 1.6%, `hours` 2.6%, `passes` 2.8%, `window` 2.8% | AUDITS 4.8 | `window`, `hours` KEEP-FILL (safety, T1); `part_of` fills with PA-R-CA (park membership); `combo_with`, `alternative_to` KEEP-OPTIONAL or REMOVE-FROM-UI | FA-2, FA-7 |
| Required, never researched | `ext.trail.navigation` (148 required records, 0 values), `ext.lift.cabin`, `ext.lift.last_up`, `ext.lift.last_down`, `ext.paddle.craft`, `ext.drive.vehicle_limits`, `road_surface`, `drive_min`, `ext.boat.vessel`, `sea_state` | AUDITS 4.8 | lift times KEEP-FILL (`rest!`, C2 source); `ext.trail.navigation` KEEP-OPTIONAL (R to A) | FA-2 |
| Ranking inputs nobody outside ranking reads | `class_key`, `standing`, `distinction`, `easy_payoff`, `weather` | page detail rows that read as codes | keep for ranking; `expose.mcp = none` (AU-D) | AU-D |
| A filter role with no possible value | `indoor`, `kids_menu`, `family_rooms` (home none), `duration_min` (home none, values held off-contract) | registry | no facet until a home exists (K10) | RIS-H, FA-4 |

### 9.2 Properties the UI needs that do not exist (or exist without a home)

| Need | Where asked | State today | Proposal | Task |
|---|---|---|---|---|
| Trail high point (W10 glance) | wireframes W10 Trail | `high_point_m` has no home; three elevations exist (`altitude_m` suitability, `high_point_m` registry, `elevationM` in the API from the locations store) | one property per meaning: `high_point_m` (routes) gets a capture home; `altitude_m` stays the place's own elevation; API `elevationM` and row `elevation_m` read `altitude_m` (MERGE) | RIS-H, FA-4 |
| Offer duration (W10 offer glance) | W10 Offer | `duration_min` home none, 13 of 50 offers hold it anyway | capture home (RIS-H) | RIS-H |
| Lake "boats" (W10 lake glance) | W10 Lake | no property says whether boats, and which, are allowed | new suitability ext path `ext.water.boating` (enum: none, non_motor, electric_only, motor) with `rest` display, lanes F O | PM-C (registry row), FA-4 window |
| Lake "loop walk" | W10 Lake | derivable: routes that `reaches` or `passes` the lake | a derived read model (ENTITY-SPEC), not a property | ENTITY |
| Park: entry, places inside, designations | W10 Park; PA 6.4 | `entry`, `covered_by`, `covers_areas` planned (7.1); membership derived; designations inside `signals` | as PA; membership is a read model | PA-C, PA-Q |
| Campground site kinds, food storage, max stay | PA 4.3 | none | `camp.*` (7.1) | PA-3C |
| Operator facts (authority name, portal, terms) | PA 2.1 | operator records have no registry rows | a small operator property set (`url`, `terms_url`, `booking_portal`), layer `operator` | ENTITY (11, E4) |
| Event recurrence ("first weekend of July", "late September for larches") | events on trips and the Summary | events have `season` only; `wikidata` and `point` are R on a natural event, which rarely has either | new `recurrence` (object: pattern, months, basis) on events; `wikidata` and `point` A on `event.natural` | PM-C (row), `types.json` marks in FA-4 |
| Read date per fact on every surface (T3) | T3, MCP clients | Val `read` exists; the API section rows carry `val` but no `stale` flag | facts model gives `read` and `stale` (from `freshness.json`) per fact | API-P |
| Units on numeric extension facts | print, MCP, filters | 12 `ext.*` numerics typed `text` and `ext.lift.ride_min` with no unit (9.3) | retype to `number` or `range` with a unit | FA-4 (with value migration in FA-5) |

### 9.3 Registry defects the checks will catch (each a K rule of section 10)

| Defect | Items | Rule |
|---|---|---|
| Numeric facts typed `text`, no unit | `ext.paddle.on_water_min`, `ext.drive.drive_min`, `ext.drive.fuel_gap_km`, `ext.cave.air_temp_c`, `ext.cave.tour_m`, `ext.jump.height_m`, `ext.zip.tandem_under_kg`, `ext.coaster.max_load_kg`, `ext.flight.flight_min`, `ext.flight.takeoff_run_m`, `ext.ferrata.approach_min`, `ext.glacier.ice_min`; `ext.lift.ride_min` is `range` with no unit; `capacity` is `number` with no unit | K6 |
| Limits with no unit | `adult_required`, `solo`, `group_min`, `participation.driver`, `ext.coaster.driver_rule`, `ext.wildlife.min_distance_m` (the last should be `m`) | K6 (a unit or an explicit `unit: "rule"`) |
| Temperature unit written `C` | `water_safety.water_temp_c` | K6 |
| Filter bands that are not list row keys | `season_band` (row key `season`), `length_band` (`km`), `climb_band` (`gain_m`) | K5 |
| Safety fields in no freshness class | `water_safety.lifejacket`, `ext.wildlife.stay_in_vehicle` | K4 |
| Required (R) on a type with no home | `access_points` (derived; mark it `home: der`), `closures`, `duration_min`, `activity_min`, `book_url` (Tour), `check_in_out`, `cost_band` (lodging) | K3 |
| Dead marks | `access.pass` marks `parks_for: R`, `serves: A`, `point: R` on an offer layer that never carries them (dropped silently by the resolver) | K9 |
| `access_cost` R on every offer and on events | the offer is the cost; PA C8 sets N on access offers only | QM7 |
| `summary` R where no relevance record exists | access, rental and lodging offers | PA C1, C7 |
| Label guessed from the key | 70 `ext.*` paths with no authored label, of which 0 are `rest` or above today | K7 (holds today; guards the future) |

## 10. Generator and checks (PM-G)

**Where.** `core/src/capture/generate.ts` `writeAll` gains a writer; `node core/bin/capture.ts build` writes
`data/schema/generated/property-matrix.json` (schema `property-matrix/1`) and `property-matrix.md`, each with the
"Generated ... Do not edit" line. `build --check` (already a check-all stage) fails when either is stale. `core/bin/capture.ts`
itself does not change (it is a hot file for B2), only the generator module.

**Inputs.** `PROPERTIES` (with `privacy` and `expose` resolved by `exposeOf`), the resolved marks of every type node per
layer (`resolveNode`), `freshness.json`, `types.json` `sources` and `links`, the API Zod shapes (`placeRow`,
`placeDetail`, `tripRow`, `tripDetail`, the facts model of API-P), `core/src/schema/exposure.ts`, `HIDDEN_FROM_PAGE`.

**Outputs.** One row per property (every column of 3.2), one marks block per type id (R, R?, A per layer), one row per API
envelope key (8.1), and a `surfaces` index (which keys each surface may carry), which the MCP projection and the export
read at build time.

**Checks** (each fails `build --check`, each with a planted-fixture test):

| # | Check |
|---|---|
| K1 | every row has a `privacy` in `public`, `derived`, `internal`; none is `household` |
| K2 | `internal` rows have `expose` none on every surface |
| K3 | a property marked R or R? on any type has a home (or `der`), unless the row carries `reserved: <task>` |
| K4 | every property with `rest!` display or K5 money keep is in a freshness class |
| K5 | every `filter.band` and every `expose.list` row key is a key of `PLACE_ROW_KEYS` |
| K6 | `number`, `range` and `limit` values carry a unit (or `unit: "rule"`); a key ending `_m`, `_km`, `_min`, `_kg`, `_cm`, `_c`, `_pct` is numeric and its unit matches the suffix |
| K7 | a property with `rest!`, `rest` or `card` display has an authored label |
| K8 | every key of the public read models' Zod shapes has a row in `exposure.ts` with a privacy and an MCP exposure |
| K9 | no type node marks a property on a layer the property's `layers` excludes (dead marks) |
| K10 | home `none` implies `expose.api` and `expose.mcp` none |
| K11 | `expose.mcp = public` implies `expose.api` not none (MCP never exposes what the API does not; R-252) |
| K12 | a `deprecated` property is absent from `expose` of every surface added after its release, and removed in the release after (AUDITS 4.6) |

K3, K4, K5, K6 and K9 fail on today's registry (9.3). PM-G lands them as **warnings** with the current exceptions listed in
`data/schema/property-matrix-allow.json` (authored, shrinking), so the build stays green; FA-4 empties the list in v0.14.1
and the warnings become errors there.

## 11. Interface with ENTITY-SPEC (`public/ENTITY-SPEC`, `docs/v2/features/entity-graph.md`)

This page defines **properties and exposure**; the entity-graph spec defines **relations between kinds**. Nothing of that
spec was readable when this page was written; these are the assumptions to reconcile.

| # | Assumption this page relies on | If ENTITY-SPEC decides otherwise |
|---|---|---|
| E1 | A **stored** relation is a registry property of value type `relation_list` (or `ref`) on the side that stores it (`part_of`, `at`, `on`, `run_by`, `starts_at`, `covered_by`); a **derived** relation (members of a park, `reached_by`, what a member needs, park visits) is never a property: it is a read model behind the data boundary (P9) | a relation stored on both sides would need two registry rows and a consistency check; K-rule to add |
| E2 | Relation names come from one vocabulary (`CAP_RELATION` in `core/src/schema/enums.ts`) | the matrix reads the vocabulary from wherever ENTITY-SPEC puts it |
| E3 | Derived relations are exposed through **one generic API route** `GET /api/v1/places/{slug}/related?rel=<name>&kind=&page=&pageSize=` returning light rows (the `PlaceRow` allowlist plus `relation` and `via`), paged like every list; MCP `get_related` maps to it 1:1 | per-relation routes give one MCP tool per route; the tool count rises |
| E4 | "What it needs" (entry requirements inherited up the `part_of` chain, plus the record's own) is one read model `GET /api/v1/places/{slug}/needs?mode=&month=` returning the parks spec's `EntryBlock`; MCP `place_needs` maps to it | if needs fold into `getPlace` (`PlaceLookup.entry`), `place_needs` is a projection of `get_place` and is dropped |
| E5 | Operator records are a fifth record kind with a small property set (`name`, `url`, `terms_url`, `booking_portal`), registered with `layers: ["operator"]` | operator facts stay inside offer and park rows |
| E6 | Ids stay the capture refs (`place/...`, `route/...`, `offer/...#...`, `operator/...`); slugs for pages; no new id scheme | the API `ref` regex and `apiPlaceRef` change, and so does every MCP input **Superseded in part (27 Oct 2026, owner ruling on review M2):** public ids are the capture refs through `publicRef()`, which replaces a dated legacy folder (`canadian-rockies-sept-2029`) with its pinned alias (`canadian-rockies-2029`); internal ids are unchanged. [public-ref-aliases.md](public-ref-aliases.md) |
| E7 | Membership and needs are computed server-side once per build or request, never shipped as a client bulk file (P8, P9); the list `park` facet reads it (PA-Q) | |
| E8 | Relation read models have rows in `exposure.ts` (8.1) with privacy `derived` and their own MCP exposure | |

## 12. Tasks (one list for this page and the MCP page)

> **Superseded for the MCP rows, 26 Oct 2026 (the MCP as a product, [../mcp/product.md](../mcp/product.md)):** the PM, API-P,
> API-G, API-T and API-S rows below stand; the MCP rows (MCP-C, MCP-1, MCP-R, MCP-GR, MCP-2) and the totals are replaced by
> [../mcp/product-packaging-and-phases.md](../mcp/product-packaging-and-phases.md) 4 (237.5 h for the MCP product including
> these prerequisites; bundle H 81 h; new bundle H2 115 h). MCP-R is renamed MCP-M (resources and prompts over the method
> routes).

Models per CLAUDE.md "Model by task complexity": a shared contract or a new abstraction is Opus even when it is code;
well-specified builds are Sonnet; reviews never below the writer. Hours are agent hours. Bundles per MASTER-ORDER 0.

| Id | Task | Lane, seat | Model | h | Bundle | Depends on | Owns (main paths) | Acceptance |
|---|---|---|---|---|---|---|---|---|
| PM-C | Registry exposure contract: `privacy`, `expose` (page, trip, list, export, api, mcp), `lanes?`, `deprecated?`, `reserved?` on `PropertyDef`; `exposeOf` defaults (3.4); `core/src/schema/exposure.ts` for envelope keys (8.1); registry tests K1, K2, K10, K11; the two new rows of 9.2 (`ext.water.boating`, event `recurrence`) | C, B2 | **Opus** (shared contract) | 4 | D (Internal) | PA-C merged (same file); QM1 | `core/src/schema/capture/properties.ts`, `core/src/schema/exposure.ts` (new), `core/test/capture/registry-exposure.test.ts` | every row resolves a privacy and an exposure; no household row; snapshot of `exposeOf` for the 239 rows |
| PM-G | Matrix generator and checks K1 to K12 in `capture.ts build`; allow list for today's breaks | C, B2 | Sonnet build; Opus review 1 h | 5 | D (Internal) | PM-C | `core/src/capture/generate.ts` (one writer), `core/src/capture/matrix.ts` (new), `data/schema/generated/property-matrix.{json,md}`, `data/schema/property-matrix-allow.json`, `core/test/capture/matrix*.test.ts` | `build --check` green; each K rule has a failing and a passing fixture; the section 7 table regenerates identically |
| PM-F | Formatter to core: `core/src/format/property.ts` (`formatValue`, units, states of 3.5); `web/lib/public/sections.ts` and print call it; key-suffix unit guess kept behind the allow list until FA-4 | C, B2 | Sonnet; verifier 1 h | 4 | D (Internal) | PM-C; UXB-7 merged (same `sections.ts`) | `core/src/format/property.ts`, `core/test/format/property.test.ts`, the import lines in `web/lib/public/sections.ts`, `core/src/catalogue/printText.ts` | built place pages byte-identical before and after (parity snapshot on 20 sampled pages); place HTML budget unchanged |
| API-P | Facts read model: `getPlaceFacts(slug)` and `GET /api/v1/places/{slug}/facts` (registry-keyed `{key, label, section, text, value, unit, state, read, stale, src}` plus `gaps[]` safety first), OpenAPI; print and CSV read it | C then W, B2 | **Opus** contract 2 h, Sonnet 4 h | 6 | E | PM-F, PA-Q (same `place.ts`, one author), UXB-C | `core/src/schema/api/facts.ts` (new), `core/src/catalogue/store.ts` (one method), `core/src/catalogue/json/**`, `web/app/api/v1/places/[slug]/facts/route.ts`, tests | P8: per item only; detector passes; facts equal the page's section rows for 30 sampled refs (parity) |
| API-G | Transport-neutral endpoint table and guard: move the allowlists, privacy detector call, error mapping and moved-slug handling of `respond()` into `core/src/api/{endpoints,guard}.ts`; web `respond()` becomes the HTTP wrapper; MCP calls the same table | C, B2 | **Opus** (shared contract, privacy) | 4 | G (Internal) | quiet point after REQ-G-C | `core/src/api/**` (new), `web/lib/server/respond.ts`, `core/test/api/guard.test.ts` | every `/api/v1` route test unchanged; the planted-string privacy cases pass through both wrappers |
| API-T | Types and properties routes: `GET /api/v1/types` (the tree, light), `GET /api/v1/types/{id}` (the resolved checklist with labels, units, marks, links, sources from the matrix); store methods `listTypes`, `getType` | W, B2 | Sonnet | 3 | G (Internal) | PM-G, API-G | `web/app/api/v1/types/**`, `core/src/catalogue/types.ts` (new), store lines, tests | answers equal `capture.ts fields --format json` for 10 type ids; no record values |
| API-S | Sun route: `GET /api/v1/sun?lat=&lon=&from=&to=` (at most 60 days) over `core/src/sun` | W, B2 | Sonnet | 1.5 | G (Internal) | API-G | `web/app/api/v1/sun/route.ts`, endpoint row, tests | Reykjavik case with longitude -21.94 equals `core/bin/sun.ts`; 61 days refused |
| AU-D (unchanged hours, new output) | Delta audit on the MCP field list; output is a list of `expose.mcp` overrides applied by MCP-C, not a free list | H | Opus | 3 | before v0.19 (H) | v0.18, PM-G | `docs/v2/build/audits/delta-<date>.md` | every published field has a reader and a fill rate |
| MCP-C (revised, was 5.5 h) | Remote contract over API-G's endpoint table: tool-to-endpoint table, input schemas derived from the API Zod with MCP caps, output projections derived from the API read models and the matrix, error map, annotations, levels vocabulary, the R-252 grep test (database imports, SQL, `HOME_POINT`) | X, B2 | **Opus** | 8 | H | API-G, API-P, API-T, API-S, PM-G, AU-D | as MCP page 15 | MCP page 13 contract cases |
| MCP-1 (revised, was 6 h) | Public endpoint with the 12 tools of MCP page 3 | X, B2 | Sonnet | 7 | H (v0.19) | MCP-C, EML-Q | `web/app/mcp/route.ts`, `web/lib/mcp/**`, `core/src/mcp/remote/public/**`, tests | MCP page 13 |
| MCP-R | Resources from the matrix: `travel://types`, `travel://type/{id}`, `travel://properties`, `travel://freshness` through API-T | X, B2 | Sonnet | 1.5 | H (v0.19) | MCP-1, API-T | `core/src/mcp/remote/resources.ts` | resources equal the API answers |
| MCP-GR | Graph tools `get_related`, `place_needs` over the ENTITY and PA-Q routes | X, B2 | Sonnet | 2 | H if the routes merged by the v0.18 commit; else dark, next bundle (QM9) | MCP-1, ENTITY API route, PA-Q | `core/src/mcp/remote/public/graph.ts` | tool output equals the route answer; P8 caps |
| MCP-2 (+1 h) | Private tools map to account routes, with the household rules of MCP page 4 | X, B2 | Opus | 9 (was 8) | H (v0.20) | as today | as today | MCP page 13 private cases |
| PMD | Docs follow-up: PLAN rows, MASTER-ORDER 3.5, 3.8, 4.3, 5.3, RELEASE-PLAN H hours, AUDITS AU-D wording, research `capture-contract.md` 8.1 step list (section 4 here) | H | planner Opus (Haiku for the mechanical edits) | 1 | now (docs) | owner reads QM1 to QM10 | those docs | links resolve |

**Totals.** New: PM-C 4, PM-G 5, PM-F 4, API-P 6, API-G 4, API-T 3, API-S 1.5, MCP-R 1.5, MCP-GR 2, PMD 1 = 32 h; grown:
MCP-C +2.5, MCP-1 +1, MCP-2 +1 = 4.5 h. **36.5 h**: Opus about 15 (PM-C 4, PM-G review 1, API-P 2, API-G 4, MCP-C +2.5,
MCP-2 +1, PMD 0.5), Sonnet about 21.5. Bundle effect: D +13 (internal, B2), E +6, G +8.5 (internal), H +8 (MCP-C +2.5, MCP-1
+1, MCP-R 1.5, MCP-GR 2, MCP-2 +1) to about 64 h, docs 1.

**Order and conflicts.** The one-author contract order of MASTER-ORDER 4.3 gains: **PA-C** (C) → **PM-C** (D) → **PM-G**,
**PM-F** (D, after UXB-7) → **PA-Q**, **API-P** (E; same `place.ts`, PA-Q first) → **REQ-G-C** (G) → **API-G** (G) →
**API-T**, **API-S** (G) → **MCP-C**, **MCP-G** (H). PM-C and FA-4 both edit `properties.ts`: PM-C first so FA-4 (v0.14.1)
writes the overrides into the new fields; FA-1's `readers_mcp` and `readers_api` columns read `expose` as the claim to
verify. API-G edits `web/lib/server/respond.ts`, which every API route uses: it merges alone in its stack (TEST-STRATEGY
9.1, a `full` path branch first).

## 13. Owner questions (QM1 to QM10)

| Q | Question | Recommended | Trade-off |
|---|---|---|---|
| QM1 | Add `privacy` and per-surface `expose` to every registry row, with derived defaults, so the registry is the one place a property's display and exposure are decided? | **Yes** | a wider `PropertyDef` and one Opus contract task, against six places that decide part of it today |
| QM2 | Generate the full matrix with `capture.ts build` into `data/schema/generated/property-matrix.{json,md}`, checked in check-all, and keep only the rules and a snapshot on this page? | **Yes** | one more generated pair, against a hand table that drifts |
| QM3 | Give the API a registry-keyed facts read model (`/api/v1/places/{slug}/facts`) that MCP, print and CSV read, and move the formatter to core? | **Yes** | one more endpoint and 10 h (PM-F, API-P), against MCP and export each re-deriving facts from page sections |
| QM4 | MCP uses the API's page numbers (no opaque cursor), with a page size of at most 25 on MCP (API 100)? | **Yes** | a client that wants 100 rows makes four calls, against unbounded chat context and a second paging scheme |
| QM5 | Give `sun` and the type checklists their own `/api/v1` routes so every MCP tool has a route and R-252 has no exception? | **Yes** | 4.5 h of small routes, against an exception list in the rule |
| QM6 | `get_place` takes one place per call (P8 per item), not up to 20 as tools-explore.md proposed? | **Yes** | more calls for a comparison, against a bulk read path |
| QM7 | Mark `access_cost` N on every offer class (access, lodging, rental, ticket, experience) and on events, because the offer is the cost and its place carries the entry? | **Yes** | fewer required fields to fill; entry for a tour's place shows through the place, not on the tour |
| QM8 | Private MCP: start dates at `plans_read`; travellers' ages and the visitor's origin (`from`) only with the `people` add-on? | **Yes** | a client must ask for the add-on to plan "getting there", against home town leaving by default |
| QM9 | Graph tools (`get_related`, `place_needs`) ship in bundle H only when their API routes have merged by the v0.18 commit; otherwise dark, next bundle? | **Yes** | possibly no graph tools in v0.19, against an MCP tool with no route |
| QM10 | Leave per-item export (`/api/v1/export`) out of MCP until after v0.20? | **Yes** | a chat client cannot hand over a GPX or print file; it links to the page instead |

## 14. Conflicts with existing decisions

| Existing | Where | This page | Resolution |
|---|---|---|---|
| "A new property is a registry change" | PLAN 1 Taxonomy; capture contract 8.1 | unchanged; the registry row now also carries privacy and exposure | capture contract 8.1 step list gains the two fields (PMD) |
| Display decided in web (`HIDDEN_FROM_PAGE`, `formatValue`) | `web/lib/public/contract.ts`, `sections.ts` | moves into the registry and core | PM-C, PM-F; web reads from there |
| AU-D "the MCP field list" as a document | AUDITS 6; RELEASE-PLAN H "MCP publishes only the fields AU-D kept" | AU-D's output is `expose.mcp` overrides; MCP-C applies them | same gate, a mechanical output |
| PA C7 widens `PropertyDef` (`homeByLayer`) | parks spec 5.1 | PM-C widens it again | PA-C first, PM-C second (one author) |
| FA-4 edits the registry in v0.14.1 | AUDITS 6 | PM-C lands first; FA-4 empties the K-rule allow list | order in 12 |
| `isDone` on public trip rows and details | `core/src/schema/api/trip.ts` | a personal-status signal | BACKLOG 15.310: drop from the public contract (or derive from nothing but data trips); MCP never exposes it |
| UXB-C adds `safety` and `hasValue` to the place model | trip-and-places-ux-fixes 13.2 | API-P's facts model must agree with them | API-P after UXB-C, same section states |
| The wireframes' Lake "boats" glance fact | W10 | no property | `ext.water.boating` (PM-C) |

## Gotchas

- `exposeOf` defaults hide intent: a reviewer must read the generated matrix, not the registry rows, to see what a surface
  carries. The PR template for registry changes links the matrix diff.
- Suitability properties have two definers (the path in `paths.ts` and the label row); K7 and the existing
  `UNKNOWN_SUIT_ROWS` test keep them together.
- The resolver drops marks on layers a property excludes without a warning today; K9 makes that visible, and the first run
  will flag `access.pass`.
- A list row key is never added by the registry: P8 keeps it a deliberate, budgeted change with its own allowlist test.
- The facts model must never carry `geometry` (size); tracks travel only through legs and export with their licence.
- `near_town` is a town id on every surface; a town's name leaves only through `find_towns`, where the Q50 rule holds.

## Change log

- 26 Oct 2026, PM-G built (`public/PM-G`, Sonnet): `core/src/capture/matrix.ts` (inputs, K1 to K12, allow-list judge, the matrix document) and the
  writer in `generate.ts`; `capture.ts build` writes `data/schema/generated/property-matrix.json` and `.md`, `build --check` fails on drift,
  on a break not in `data/schema/property-matrix-allow.json` and on an entry that no longer breaks (reported as `DRIFT check` and `DRIFT
  allow`; `core/bin/capture.ts` is unchanged). 41 entries today (K3 1, K4 4, K5 3, K6 23, K9 10), FA-4 empties them. Differences: K7 is a
  heuristic (an `ext.` path shown at rest whose label equals its humanised key) because the registry does not record authored labels; K12
  checks the release form and that a deprecated property is off MCP (added v0.19), the "removed in the next release" half waits for a
  release list; the section 7 snapshot is the generated md table "Marks per main type".
- 26 Oct 2026, PM-C built (`public/PM-C`, Opus): `privacy`, `expose`, `lanes`, `deprecated`, `reserved` on `PropertyDef`;
  `exposeOf` and `exposureProblems` (K1, K2, K5 row keys, K10, K11) in `properties.ts`; `core/src/schema/exposure.ts` (8.1);
  test `core/test/capture/registry-exposure.test.ts` with the snapshot `registry-exposure.snap.json`. Differences from this
  page: `expose.trip`, `list` and `export` are lists; the trip `day` default is the suitability groups of 6 (limits, suits,
  effort, time, safety, water) plus the card display and the day keys of 5; where a cell of 5 differs from the 3.4 rules
  (`summary` and `why` on the day row and in CSV, for example) the rules win and PM-G's generated matrix is the list. A new
  home `derived` (`access_points`, `variants`; review EG-R0 S6) keeps K10 true; `variants` is no longer asked on any offer
  class. `recurrence` got a capture home on events (an optional `capture/1` field), `ext.water.boating` a water-extension
  path (marks wait for FA-4). QM7: `access_cost` is N on the offer and event layer rules (gap budget 3693 to 3664).
- 26 Oct 2026: written (travel-planner, Opus 5.5) on `public/PROP-MCP-SPEC`, with the MCP page
  [../mcp/tools-v1-from-api.md](../mcp/tools-v1-from-api.md).
