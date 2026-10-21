# Inventory: what the repo holds (counted 17 Oct 2026)

Counts were taken with scripts against the working tree on 17 Oct 2026; rerun before importing.

## 1. Trip folders (`legacy/<slug>/`)

13 trip folders plus two site pages (`globe`, `locations`) and the design system (`_system`). All 15
pages are marked `served: true` in `legacy/MANIFEST.json` (published by `publish.sh` to
nks-travel.pages.dev; CLAUDE.md says several are "built, not published" in the sense of not announced,
but the manifest serves them).

| Slug | Dates (page meta) | Nights | PLAN.md lines | Structured data | Gallery (sections / photos) | Builder | Notes |
|---|---|---|---|---|---|---|---|
| `algonquin-muskoka-oct-2026` | 10-12 Oct 2026 | 2 | 152 | none | none | `build_page.py` (theme autumn) | past trip; day permit rule; Plan B toggle |
| `canadian-rockies-sept-2029` | 8-22 Sep 2029 | 14 | 743 | **yes**: `trails.json` 62, `sights.json` 48, `adventures.json` 43, `bookings.json` 33, `bases.json` 16, `itinerary.json` 15 days (tracks A/B/C, split days, deadlines), `links-*.json`, `national.json`, `provincial.json`, `verify-adventures.json` | 14 / 41 | `merge_data.py`, `plan_tables.py`, `build_page.py`, `check_links.py`, `anchor_check.py`, `sun-times.py` | the pilot; the only trip with machine-readable rows |
| `chamonix-mont-blanc-sept-2028` | 1-9 Sep 2028 | 8 | 434 | none | 9 / 26 | `build_page.py` | lift closing dates pattern |
| `costa-rica-feb-2027` | 13-23 Feb 2027 | 10 | 135 | none | 6 / 17 | `build_page.py` | |
| `dolomites-july-2027` | 13-26 Jul 2027 | 13 | 401 | none | 8 / 22 | hand-written HTML (older component family) | |
| `iceland-ring-road` | 4-15 Sep 2027 | 11 | 225 | none | 8 / 21 | `build_page.py`, `sun-times.py`, `dark-times.py`, `verify.py`, `shots.py` | camper van; 10 campsites |
| `new-hampshire-stopover-2026` | 30 Sep-1 Oct 2026 | 1 | none | none | none | hand-written | past |
| `niagara-day-aug-2026` | 29 Aug 2026 | 0 (day trip) | 167 | none | none | hand-written | past; day trip |
| `norway-summer` | summer 2028, dates open | 14 | 385 | none | 9 / 24 | `build_page.py` (first `_system` page) | windows A/B |
| `patagonia-feb-mar-2027` | 26 Feb-11 Mar 2027 | 13 | 898 | pipe tables in PLAN.md (trails, bookings, adventures, budget, night split, day by day) | 14 / 42 | `build_page.py`, `photos.py`, `sun-times.py` | |
| `quebec-sept-2026` | 29 Sep-1 Oct 2026 | 2 | none | none | none | hand-written | past |
| `switzerland-2027` | 27 Jul-10 Aug 2027 | 14 | 483 | none | 8 / 21 | hand-written | |
| `usa-southwest-rockies` | 11 days, dates open | 10 | 96 | `photos.json` | 7 / 21 | `build_page.py`, `fetch_photos.py`, `verify_photos.py` | archive holds the 15-day plan |
| `vermont-fall-2026` | 1-4 Oct 2026 | 3 | 734 | `assets/vermont-pins.csv`, `vermont-pins.kml` | none | hand-written | past |

Totals: PLAN.md 4,853 lines over 12 files; galleries 255 photos in 9 trips (each photo has place,
licence and attribution metadata from Commons).

## 2. Research (`research/`)

- `research/trips/<slug>/`: **83 Markdown lane files, 26,911 lines**, across 13 folders (the 12 trips
  with research plus `peru`, research-only). Lanes seen: trails, adventure, attractions/sights,
  logistics, stays/bases, timing, foliage, parking, geology, costs/fares, bookings, days, hazards,
  gap-closing notes, community day reports. Several folders have `archive/` (superseded plans) and
  `notes/`.
- `research/audits/sun-audit-2026-10-18.md`: the audit of all published light claims.
- `research/vault-notes/` (imported from Obsidian on 17 Oct 2026):

| File | What | Rows / size |
|---|---|---|
| `Travel Preferences.md` | standing household preferences (home Whitby, kids 9-12, radius ~2 h, interests, avoid rules, Conservation Authority notes) | 1 profile |
| `Plan.md` | annual goals (1 international + 1 local), 2026 calendar tasks, India options, fall and summer idea tables, long weekends, 2026 budget | ~6 tables |
| `Day Trips Local.md` | "40 destinations" from Whitby with costs, timing, packing by type | 72 table lines |
| `Day Trips Bike.md` | cycling day trips | 28 table lines |
| `day-trips/*.md` | 6 detailed day trips (Elora Gorge, Spencer Gorge, Rattlesnake Point + Crawford Lake, Rockwood, Warsaw Caves, options 2026) | 6 |
| `Nova Scotia Road Trip.md`, `Nova Scotia Halifax Loop.md` | two itinerary drafts | 361 + 346 lines |
| `VERMONT FALL FOLIAGE TRIP.md`, `Norway Road Trip.md`, `Switzerland.md`, `Italy.md` | early notes and stubs | |
| `archive/India Trip Oct-Nov 2024.md` | a past trip | 31 lines |
| `travel-finder/*.md` | product idea documents (input to the design, not data) | 6 |
| `vault-trip-planner-skill/` | the vault's skill: intake, discovery, budget, maps references, templates, `make_maps.py` | reference |

## 3. Data (`data/`)

| Path | Contents | Count |
|---|---|---|
| `data/locations/locations.json` (schema v3) | the wishlist: countries 7, regions 24, areas 52, **places 64** (kinds: city 8, park 8, trail 7, town 7, mountain 6, lake 4, waterfall 4, island 4, region 4, viewpoint 3, canyon 2, activity 2, place 2, lighthouse, valley, drive), place tags 175; status idea 56 / planned 8; **8 linked to a trip**; 56 with a Wikidata id; 63 with coordinates | 64 |
| `data/locations/WISHLIST.md`, `legacy/locations/index.html`, `legacy/globe/assets/data/places.json` | generated views | generated |
| `data/vocab/tags.json` | tag vocabulary (id, label, kind, alias_of) | 80 |
| `data/catalog/` | catalog folders (activities, areas, changes, eateries, legs, offers, stays, trails) — **all empty** (`.gitkeep`), plus `policy.json` | 0 rows |
| `data/schema/difficulty-map.json`, `freshness.json` | difficulty mapping, freshness rules | reference |
| `data/schema/generated/` | JSON Schema, DDL, `ops.json` (**86 operations** catalogued) | generated |
| `data/reference/countries.json`, `licences.json` | 249 countries, 4 licences | reference |
| `research/inbox/` | captures from social posts (schema v3) | check at import |

## 4. Code (`core/`, `web/`, `tools/`)

| Path | What | Fate |
|---|---|---|
| `core/src/sun` | sun and twilight (tested, longitude positive east) | **ported** to `packages/domain` with tests |
| `core/src/bookings/bookBy.ts` | book-by from booking windows | ported (feeds `opens_at`/`book_by`) |
| `core/src/checks/` | day checks with codes and messages | ported; extended with reservation checks |
| `core/src/schema/` (Zod, catalog, trip, locations, enums, difficulty map, freshness, policy) | v1 schemas | mined for kind schemas and enums; trip shape replaced (no editions) |
| `core/src/ops/` (catalogue of 86 ops, file and memory stores, runner) | v1 operation layer on files | design reused (registry, inverse, runner); stores replaced by Postgres |
| `core/src/mcp/` | read-only stdio MCP | replaced by the remote `/mcp` |
| `core/src/validate/` | validators | mined for rules |
| `core/test/` | 27 test files | ported where the code is ported |
| `web/` | Next.js 16 static export: home, trips, places, about, list views, filters, themes | becomes `apps/web` (server-rendered) |
| `tools/` (Python) | `locations.py` (Wikidata/Nominatim resolver), gallery tools (`gallery_find.py`, `gallery_pick.py`, `gallery.py`), hub, publish | resolver logic reused by `bulk_import`; gallery tools reused for media research; publish stays for legacy only |
| `.claude/skills/trip-planner`, `.claude/skills/location` | the research and capture skills | rewritten to call the MCP (see `docs/v2/research/`) |
