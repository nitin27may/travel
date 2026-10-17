# Import plan

How each source in [inventory.md](inventory.md) becomes v2 data. Importers live in
`packages/importers/` as CLI commands (`pnpm import <source> --dry-run`), run by the owner from the
home server or a laptop with a personal access token. Each import is **one changeset** (catalog) or
**one operation batch** (trips), so it shows in the review queue or the activity feed and can be
rolled back.

## 1. Order

| Step | Import | Depends on | Milestone |
|---|---|---|---|
| 1 | Reference data: tag vocabulary, difficulty map, freshness rules, countries, licences | schema | M0 |
| 2 | Geography: countries, regions, areas from `locations.json` (7 / 24 / 52), polygons from OSM or geoBoundaries for areas with trips | 1 | M1 |
| 3 | Household: the owner's household, people, preferences from `Travel Preferences.md` | auth | M0 |
| 4 | Wishlist places (64) as catalog entities | 2 | M1 |
| 5 | Rockies catalog (trails 62, sights 48, adventures 43, bookings 33 → offers, bases 16) | 2 | M1 |
| 6 | Rockies trip (itinerary 15 days, tracks, split days, deadlines) | 5 accepted | M2 |
| 7 | Galleries (255 photos in 9 trips) as media | 4-5 | M1-M2 |
| 8 | Local day trips: 40 destinations + 6 detailed day trips + bike trips | 2 | M1 |
| 9 | Other trips, one at a time when next revised (Patagonia first: tables in PLAN.md) | catalog for the area | M2+ |
| 10 | Year plan: goals, long weekends, idea tables from `Plan.md` | 3 | M3 |
| 11 | Templates: each imported trip published as a curated template | 6, 9 | M5 |

## 2. Rules that apply to every import

### 2.1 Evidence

Every legacy row with `source_urls` and `checked` produces one `source` per URL (deduped by URL) and
one `evidence` row per imported fact, with `observed_on = checked`. Rows without sources import their
facts with `confidence: agent_inferred`, `trust: unverified`, and a backlog item "find a source for
<entity>.<field>".

### 2.2 Legacy status → trust

| Legacy marker | `confidence` | `trust` | Extra |
|---|---|---|---|
| `VERIFIED` (with an official URL) | `official` | `stated` | |
| `VERIFIED` (only blogs or community) | `community` | `unverified` | backlog: official source |
| `INFERENCE` in a field | `agent_inferred` | `unverified` | value kept, note "inferred" shown in the UI |
| `GAP` | field left empty | | backlog item with the GAP text as the reason |
| 2026 price or window used for 2028-29 | as its source | as its source | `observed_on` 2026; freshness makes it stale; backlog before the trip's booking window |

### 2.3 Text

Legacy prose was written by the owner and Claude in their own words, so it can be imported as
`summary` and notes. Quotes copied from source sites (rare) are trimmed to 300 characters. Long
reasoning ("why not", "Plan B because") becomes item notes on the trip, not catalog facts.

### 2.4 Dedupe

Before creating, match against the catalog by Wikidata id, then OSM id, then name similarity
(trigram > 0.6) within 500 m. Matches become updates (new evidence) instead of duplicates.

### 2.5 Geocoding

Order: Wikidata coordinates → OSM (Nominatim, 1 request/second, cached) → manual. The Rockies files
have **no coordinates** in trails, sights, adventures or bases (126 rows; `map_url` is a Google search
link, which must not be used as a data source). Trailheads are resolved by name in OSM
(`highway=trailhead`, parking `amenity=parking` nearby); unresolved rows go to a "needs a pin" list
for the owner (a map screen in `/admin` to drop pins).

## 3. Field mappings

### 3.1 Wishlist place (`locations.json` v3) → `entity`

| Legacy field | v2 | Notes |
|---|---|---|
| `id` (`CA/AB/banff-national-park/lake-louise`) | `slug` (last segment, deduped) + import map | old ids kept in an `import_map` table for redirects and re-runs |
| `area_id` | `area_id` | via the geography import |
| `name`, `resolved_name`, `name_lang` | `name`, `names` | |
| `kind` | `kind` + `subkind` | city/town → `place`/`town`; park → area or `place`/`park`; trail → `trail`; mountain, lake, waterfall, island, viewpoint, canyon, lighthouse, valley → `place`/<same>; activity → `activity`; drive → `place`/`scenic_drive`; region → area |
| `lat`, `lon`, `elevation_m` | `point`, `attrs.elevation_m` | |
| `wikidata` | `wikidata_qid` | |
| `season_months` | `season.open_months` | |
| `min_age`, `max_age`, `min_height_cm`, `max_height_cm`, `min_weight_kg`, `max_weight_kg` | `eligibility` | |
| `kid_fit`, `accessibility` | tags (`kid-friendly`, `stroller-ok`...) when not `unknown` | |
| `house_grade`, `walk_km`, `walk_gain_m`, `duration_min` | `attrs.grade_house`, `attrs.distance_km`, `attrs.gain_m`, `duration_min` | |
| `notes` | `summary` (if descriptive) or entity note | |
| `image` | `media` (role hero, storage commons) | licence looked up via Commons API |
| `status` (idea/planned), `trip` | **not catalog**: the owner's household **wishlist** (a saved list "Places we want to go") and, for the 8 with `trip`, items on that trip | the wishlist is personal, the place is shared |
| `place_tags` (175) | `tags` | via the vocabulary |
| `review_status`, `confidence`, `field_meta`, `verified_by`, `last_verified` | `trust`, evidence `confidence`, `observed_on` | |
| `contributed_by`, `added`, `updated` | `created_by`, `created_at` | |

### 3.2 Rockies `trails.json` (62) → `entity` kind `trail`

| Legacy field | v2 | Notes |
|---|---|---|
| `id`, `name` | `slug`, `name` | |
| `park`, `jurisdiction` | `area_id` (Banff, Yoho, Kootenay, Jasper, Kananaskis...), `attrs.jurisdiction` | |
| `difficulty` | `attrs.grade_local` ("hard (Parks Canada)") + `attrs.grade_house` via the difficulty map | |
| `km`, `mi` | `attrs.distance_km` (mi dropped; derived) | |
| `gain_m` | `attrs.gain_m` | |
| `hours` ("5-6 h") | `duration_min` 300, `duration_max` 360 | parsed; unparseable → note |
| `trailhead` ("Moraine Lake") | `relation trailhead_of` to a trailhead entity (created or matched), `attrs.trailhead_ref` | geocoded (2.5) |
| `parking_or_shuttle` | `attrs.parking` `{notes}`; if it names a shuttle, `relation serves` from the shuttle entity and its offer | |
| `official_url` | `attrs.links.official` + evidence source | |
| `alltrails_url`, `alltrails_checked` | `attrs.links.alltrails` (link only) | never import AllTrails data |
| `map_url` | dropped (a Google search link) | |
| `audience` (`adult_only`, `family`...) | tags (`adults`, `family`) | |
| `child_note` | `eligibility.notes` | |
| `family_alternative_id`, `less_walking_alternative` | `relation alternative_to` with `attrs.reason: family` / `less_walking` | the adapter uses these (mcp/tools-templates.md) |
| `needs_split_day` | trip-level (Rockies trip item note), not catalog | |
| `sept_notes` | `season.notes` with month 9; larch timing → tag `larches` + season note | |
| `hazards` | `attrs.hazards` (bears, scree, exposure) | |
| `source_urls`, `checked`, `status` | evidence (2.1, 2.2) | |

### 3.3 Rockies `sights.json` (48) → `entity` kind `place`

`what` → `summary`; `why_must_do` → tag `must-see` + item note on the trip; `time_needed_hours` →
`duration_min`; `best_time` → `attrs.best_time` (+ time hint on trip items); `booking_needed` → an
`offer` when it names a booking (Moraine shuttle) with its window parsed from the text
(`opens_2026_pattern` style: "opened 15 Apr 2026 8am MT, 40% of seats, rest 48 h ahead" →
`window_rule: fixed_date`, `fallback: 48 h release`); `child_note` → `eligibility.notes`; the rest as
for trails.

### 3.4 Rockies `adventures.json` (43) → `entity` kind `activity` + `offer`

| Legacy | v2 |
|---|---|
| `type` (gondola, cruise, rafting, via ferrata...) | `subkind` |
| `operator` | `offer.operator` |
| `season_window` | `season` + `hours` (2026 pattern noted) |
| `price_cad_2026` | `offer.price_min/max`, `currency CAD`, `price_read_on` 2026, `price_basis` (adult, child) |
| `min_age`, `min_height_cm`, `max_weight_kg` | `eligibility` |
| `child_6yo_ok` | evidence for eligibility (yes/no/unknown) |
| `booking`, `book_url`, `weather_refund` | `offer.url`, `offer.window` (parsed when possible), `offer.fallback`, `attrs.weather_policy` |
| `audience` | tags |

### 3.5 Rockies `bookings.json` (33) → `offer`

`item` → `offer.name`; `provider` → `operator`; `applies_to` → `relation covered_by` (passes) or the
offer's entity; `opens_2026_pattern` → `window_rule` + `window_spec` (parsed; the original text kept in
`fallback` notes); `sells_out_note` → `sellout`; `cost_cad_2026` → price fields; `refund_note` →
`attrs.refund`; `deadline_note` → kept for the trip import (to-book reservation notes); `must_do` →
trip priority. On the Rockies trip, each booking becomes a **`to_book` reservation** pointing at the
offer.

### 3.6 Rockies `bases.json` (16) → areas/towns + trip stays

Bases are towns (Calgary, Canmore, Banff, Lake Louise, Field, Golden, Radium, Jasper, Kananaskis
Village...) → `entity` kind `place`/`town` (or matched to existing areas). `drive_times_min` →
`leg_cache` rows (provider `legacy-estimate`, flagged estimated); `lodging_cad_2026_range` → evidence
on an area-level price note; `why_sleep_here`, `why_not`, `kid_friendly_notes`, `groceries_nearby`,
`parking_or_car_notes` → the area guide text (`summary` and `attrs.base_notes`). On the trip, the
itinerary's base plan becomes `to_book` **stay reservations**, one per base block, so the night bases
are visible before anything is booked.

### 3.7 Rockies `itinerary.json` → trip

| Legacy | v2 trip |
|---|---|
| `recommended` (nights, start, end, rationale) | `trip.start_date` 2029-09-08, `nights` 14, notes |
| `options` | alternative windows → `trip_candidate` rows or a trip note; the 16-night option → template `optional_days` |
| `bases[]` (base, nights, dates, why) | `to_book` stay reservations + day notes (`base` per day) |
| `days[]` `n`, `date`, `summary` | day notes (title, notes) |
| `track_a`, `track_b`, `track_c` (title, trail_ids, sight_ids, adventure_ids, notes) | items with `variant_group = day-N`, `variant = A/B/C`, `who` = adults / family / less walking; entity refs via the import map |
| `drive` | day note + the planner recomputes legs |
| `light` | recomputed from `sun`; the legacy text kept as a note only if it says more than times |
| `wet_weather` | Plan B items (`plan_b_for`) or a day weather rule |
| `decision_rule` | `day_note.weather_rule` |
| `split_days`, `needs_split`, `rejoin` | variants with a rejoin item (a meal or meeting point) |
| `booking_ids` | links from items to the to-book reservations |
| `deadlines` | to-book reservations' `book_by` and tasks |
| `status_flags` | warnings on the day; recomputed by checks |

### 3.8 Galleries (`gallery/gallery.json`, 255 photos) → `media`

Each section's `place` is matched to an entity (by name, with the owner confirming unmatched ones);
each photo → `media` with `storage: commons`, `key` = the Commons file name, `caption`, `author`,
`licence`, `attribution`, `role: gallery` (first per entity → `hero`), `status: approved` (they were
picked by the owner). `days` → trip-level gallery order.

### 3.9 Hand-written trips (PLAN.md and HTML)

No structured rows. The importer is **assisted**: a Claude Code session with the research MCP tools
reads the PLAN.md (and research lane files) and produces (a) a catalog changeset per area (trails,
sights, activities, offers with evidence from the URLs in the plan) and (b) an `author_trip` call that
rebuilds days, items, variants, Plan B and to-book reservations. The owner reviews both. Patagonia
first (its PLAN.md has tables for trails, bookings, adventures, budget, night split and day by day),
then Norway, Iceland, Chamonix, Dolomites, Switzerland, Costa Rica, Utah; past short trips (Algonquin,
Vermont, Québec, New Hampshire, Niagara) are imported as **done trips** with their places, mainly for
the catalog and as day-trip and weekend templates.

### 3.10 Local day trips (vault notes)

`Day Trips Local.md` (40 destinations), `Day Trips Bike.md` and the 6 `day-trips/*.md` →
`bulk_import` rows (name, town, type → kind/tags, cost → cost band + price note, season, drive time
from Whitby as a `leg_cache` estimate). The 6 detailed day trips become **day-trip templates** (one day,
ordered stops, leave-by times). Packing advice by destination type becomes **pack templates** (beach,
park hike, cave, waterpark).

### 3.11 Household and year (`Travel Preferences.md`, `Plan.md`)

Preferences → `household.prefs` (home Whitby, radius 120 min, car, mid-range, balanced, interests as
tags, avoid rules) — personal data, entered through `household` ops, never catalog. `Plan.md` → a
`travel_goal` (1 international + 1 local per year), `calendar_window` rows for the long weekends
listed, trip **candidates** for the fall and summer idea tables, and household tasks (passport checks).
The India trip (2024) becomes a done trip with custom items only.

### 3.12 Research Markdown (83 files)

Stays in git. It is evidence, not data: importers cite lane files as the place a fact was compiled,
but evidence rows point at the original source URLs inside them. Facts found only in a lane file
(no URL) import as `agent_inferred`. The research skill's new version writes to the MCP instead of
Markdown (see `docs/v2/research/`).

### 3.13 Code

Covered in inventory.md section 4: sun, book-by and checks are ported with tests; the resolver logic
of `tools/locations.py` (Wikidata then Nominatim) becomes the `bulk_import` resolver; the Commons
gallery tools become the media lane's helpers.

## 4. Existing trips become curated templates

Every imported trip with a future or repeatable shape is published (after review) as a **curated
template** by the owner, so others can fork it as is or adapt it:

| Template | From | Nights | Adaptation metadata to author |
|---|---|---|---|
| Canadian Rockies with a young child (Sep) | Rockies | 14 (range 10-16) | cut order, Waterton optional days, valid Jun-Sep, family alternatives already in data |
| Patagonia: Ushuaia, El Chaltén, El Calafate | Patagonia | 13 | valid Nov-Mar; children 11+ |
| Iceland Ring Road by camper van (Sep) | Iceland | 11 | valid late Aug-mid Sep (campsite closures); 2WD only |
| Norway: Arctic then the fjords | Norway | 14 | window A/B as variants; hiking ceiling 12 km |
| Dolomites by car, four bases | Dolomites | 13 | valid late Jun-mid Sep (lifts) |
| Chamonix valley hikes | Chamonix | 8 | valid Jul-early Sep (lift closures) |
| Switzerland 14 nights | Switzerland | 14 | |
| Costa Rica family | Costa Rica | 10 | |
| Utah's five parks | USA Southwest | 10 (9-11) | hard line 1 Oct (Narrows) |
| Algonquin and Lake of Bays Thanksgiving weekend | Algonquin | 2 | weekend template; permit rule |
| Vermont fall foliage long weekend | Vermont | 3 | foliage timing note |
| Île d'Orléans prologue | Québec | 2 | |
| Niagara day | Niagara | day trip | |
| 6 Ontario day trips | vault day trips | day trips | |

Stripping (done by `publish_template`'s preview): travellers and ages, household home, reservation
details and codes (kept as to-book placeholders), attachments, expenses, private notes, anything that
mentions the children by name. The owner reviews each preview before publishing.

## 5. Verification

| Check | How |
|---|---|
| Counts | importer prints source rows vs created/matched/skipped per type; must add up (e.g. 62 trails = created + matched + flagged) |
| Evidence coverage | share of imported facts with an official source, per trip; reported, not blocking |
| Geocoding | every entity has a point or is on the "needs a pin" list; trailheads within 5 km of their trail's area |
| Spot checks | 10 random entities per import compared by the owner against the legacy page |
| Trip parity (Rockies) | the v2 trip's day checks agree with PLAN.md's own day notes; every legacy day's tracks exist as variants; every legacy booking is a to-book reservation with the same opening pattern |
| Re-runnable | a second run is a no-op (the import map makes it idempotent) |
| Rollback | each changeset's inverse tested on a copy of the database |

## 6. What stays outside the database

Research Markdown, archived plans, page builders and scripts, the legacy HTML (until retired), and the
travel-finder product notes. They remain in git as history.
