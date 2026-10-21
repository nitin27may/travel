# Review of PLAN-platform.md (revision 3, approved 2026-10-17)

> **Archived 21 Oct 2026** (CLEANUP-PLAN CLN-1). Superseded by `docs/v2/PLAN.md`; kept for its ideas. Paths in this page are as they were when it was written.

Independent senior review, 2026-10-17. Scope: is the plan ready to hand to Sonnet coding agents, and where does it need enhancement. The plan was not edited and nothing was implemented. Every repo claim below was checked with commands against `/home/nitin27may/workspace/travel` (pytest, grep, a dry-run publish, a rebuild of all eight `build_page.py` pages); statements I could not verify are marked "inference".

## 1. Verdict in one page

The plan is strong on product thinking and weak on the mechanics a coding agent needs. Sections 0A, 0B, 3A and 4 would survive contact with a good product team. Sections 1.2, 2 and 6 would not survive contact with a Sonnet agent working alone: the migration table misses half of the path constants that break, the schema is specified in three partially contradictory layers (2.2/2.3, then 2.8, then 0B.2), and three of the eight phases (P2, P4, P5b) are each two to four agents of work presented as one.

| Phase | Verdict | One-line reason |
|---|---|---|
| P1 restructure | **Not ready as written; ready with the fixes in section 3 and 8** (can be applied today) | the hooks compute their own root (`../../..`), `trips_root` validation, the inbox rule, the generated-footer strings and seven test files break in ways the 1.2 table does not list |
| P2 schema | **Not ready**; split in two | schema contradictions must be reconciled first; the TS half needs `web/` which P3 creates; the uv/jsonschema runtime for hooks is unspecified |
| P3 app shell and places | Ready with fixes | pin versions, define how `web/out` merges into `.site`, split the map view and the advanced panel into a second PR |
| P4 import two trips | **Not ready**; split in three | ops layer, ingestion pipeline and two imports in one phase; hidden geocoding of 48 sights and 62 trailheads; Opus spend not budgeted |
| P5a plan pages | Ready with fixes | carve the nine skills and agent files out into their own phase; specify the offline test harness |
| P5b trip creation UI | **Not ready**; split in three | nine screens, accessible drag-and-drop, IndexedDB autosave, undo, universal search and a spatial index in one agent |
| P6 globe | Ready with fixes | parity fixtures need naming; the MapLibre version is already recorded (G2 is wrong) |
| P7 builder | **Not ready** | scoring inputs (quality signals, crowding, opening hours, durations, eateries, legs) do not exist in any data; the coverage gate is unreachable without new research |
| P8 routing with breaks | Ready with fixes | needs its route fixture named and committed; polyline precision and the geohash reader specified |
| Phase 2 outline | Outline only, as intended | the D1-as-truth plus nightly export design deserves a challenge before that plan is written (section 4.4) |

P1 go/no-go today: **no-go as written, go the same day once the P1 brief carries the checklist in section 8.** The byte-identical-site claim is achievable (I verified that the eight builders already reproduce their pages and that the dry-run publish is deterministic apart from the hub's date badges), but only if P1 does not touch two generated strings, pins `HUB_TODAY`, and defers the inbox move.

## 2. Verdict per phase

### P1 restructure (6, "pure restructure, no behaviour change")

Verdict: not ready as written; ready with fixes. Details in section 3 (the move simulation) and section 8 (the brief). The headline problems:

1. Counts are wrong. 1.2 and R1 say "16 trip folders" and "9 builders"; there are 15 trip folders (the list in 1.2 itself names 15) and 8 `build_page.py` files (`find . -name build_page.py` excluding `.site`). An agent told to expect 9 builders will look for a missing one.
2. The hooks are not "paths in `.claude/settings.json`". Both `_system/tools/hooks/*.sh` compute `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"`, three levels up. Under `tools/hooks/` that is the parent of the repo. Both also hard-code `$ROOT/_system/tools/locations.py` and `_system/tests`. The 1.2 row for hooks must say so.
3. `trips_root` (`_system/tools/location_views.py:49`, used at `locations.py:1228,1278` and `location_views.py:121`) resolves `places.trip` against `<root>/<slug>/`. Eight places carry a `trip` today (Lake Louise, Dolomites, White Mountain NF, four Utah parks, Stowe). After the move those folders live in `legacy/`, so `validate` fails, the hook blocks, and the list page loses its `trip_url` links (a byte change on `/locations/index.html`). The plan's "Paths gains `data_root`, `legacy_root`" does not name this.
4. The inbox move is a behaviour change, not a path change. `locations.py:1267-1268` rejects any `sources.screenshot` not under `locations/inbox/`; five test assertions (`test_locations.py:157,160,165,404`, `test_location_views.py:143`), `test_site_outputs.py:31` and `.claude/skills/location/SKILL.md:35,52-53` encode the same prefix. Moving `locations/inbox/` to `research/inbox/` means a rule change, five assertion edits and a data rewrite. Recommendation: defer the inbox move to P2 (which already rewrites `sources` for v3) and keep P1 pure.
5. The byte-identical acceptance (1.3, P1 acceptance bullet 2) conflicts with "paths updated". `location_views.py:199-200` writes "Generated from `locations/locations.json` ... `python3 _system/tools/locations.py add`" into `locations/WISHLIST.md` and `locations/index.html` (verified: both files contain the strings). If the agent updates those strings, the published `/locations/index.html` changes and `test_site_outputs.py` then demands a rebuild. The brief must say: leave these two strings verbatim in P1; P2 changes them.
6. "Tests green after each commit group" is unattainable for the groups as listed (trips, locations, globe, `_system`, docs) because the tests reference globe, locations and `_system/site` paths at once. Section 8 gives an order that is green after each step.
7. `README.md` does not exist at the root; P1 "owns" it. Creating documentation is out of scope for a pure restructure; keep it to a stub or move it to P3.
8. 1.1 says `legacy/<slug>/` is "every trip folder as it is today minus research/", while 1.2 moves `archive/` and the loose notes (BRAINSTORM, CALL-LIST, MASTER-*, OPTIONS-*, PARKING, DAYS) to `research/trips/<slug>/`. Pick one; the agent will otherwise do whichever it reads last. Note `usa-southwest-rockies/archive/` holds a superseded page and builder; `research/` is a reasonable home only if the plan is explicit that research may contain HTML.
9. Claude Code hook configuration is captured when the session starts (inference from how `settings.json` hooks behave; not re-verified for the current CLI). Mid-P1, the old `prepublish.sh` will still fire on any Bash command containing `publish.sh` and will fail because `_system/tests` no longer exists, which blocks the acceptance command. Workaround in section 8.

What is right: the `HERE.parent / "_system"` observation holds for all eight builders (verified); `ROOT = parents[2]` to `parents[1]` for tools is correct; the gallery import needs exactly one extra `sys.path` entry; the dry-run publish is fast (0.4 s) and deterministic except for the hub's "In N days" badges (12 occurrences), so `HUB_TODAY` is the right fix.

### P2 schema and generators

Verdict: not ready; split into P2a (Python side) and P2b (TypeScript side, after P3 scaffolds `web/`).

- The schema is specified three times and the layers contradict. 2.2 lists root tables `adventures`, `bookings`; 2.8 replaces them with `trip_activities`, `trip_bookings`; 2.3 `items` has `adventure_id` and `booking_id` while 2.8 adds `activity_id`, `offer_id`, `leg_id`; `bases.booking_id` points at a table 2.8 removed; 2.3 `trip.web_published` (bool) versus 1.3 `"web": {"published": true}` (object); 0B.2 adds `notes`, `custom_items`, `routes`, `items.custom_item_id`, `items.pinned`, none of which appear in the 2.2 key order. P2 must not be launched until an editor re-issues 2.2 and 2.3 as the single canonical table list with 2.8 and 0B.2 folded in.
- P2 owns `web/package.json` and `web/mcp/server.ts` but `web/` is created by P3, which 6.0 says runs in parallel. Two agents creating or editing `web/package.json` in one checkout will collide.
- The Python validator "jsonschema via uv" introduces a uv project under `tools/` (1.1). The hooks and `publish.sh` call plain `python3` (system 3.14, no jsonschema). The plan never says whether hooks run `uv run`, whether `tools/pyproject.toml` pins Python, or how CI installs it. Today's tools are stdlib-only by design (`locations.py` docstring).
- Acceptance "existing `test_schema_sqlite.py` passes against the generated DDL" is good. Acceptance "at least 40 broken fixtures, one per rule" is a real test budget; name the rules (2.4 lists about 20 structural rules and 10 day checks) so the count is not padded.
- "About 400 lines in total" for the TS and Zod generators is an estimate, not a requirement; drop the number.
- Locations v3 migration (tags vocabulary moved out, `kind` added) is bundled here; it touches the 109-test suite and the `location` skill. Give it its own acceptance line: `migrate_locations_v3.py --check` idempotent, every v2 id present, WISHLIST headings unchanged.

### P3 app skeleton, theme, places in four views

Verdict: ready with fixes.

- Pin what is pinned: Node 22.23 and pnpm 12.4 are on this machine (verified); MapLibre must be `6.14.0` (`globe/assets/vendor/VERSIONS.txt`, verified, contradicting G2 and the 3B gotcha); Next.js and shadcn versions should be fixed in the brief, not discovered.
- The parity acceptance says "63+ places"; the store has 64 (verified). Use the exact number and the URL-param list from PLAN-locations-g5 2.4.
- How `web/out` lands in `.site/` is undefined for P3 even though P3 "owns route table additions only" in `tools/publish.py`. State: `web/out/*` is copied first, then legacy routes overwrite nothing (collision rule 1.3), `_redirects` is written last, and the served-URL superset test runs. Without this, the P3 agent will invent a merge order.
- The export must exclude trips with `visibility != public` (0A.4) and strip `x-private` fields. Neither is in P3's acceptance; the first public build of `/data/*.json` is P3's.
- Split: P3a scaffold, theme tokens, `EntityPage`, cards, list, table, filter bar, `/places/`, place pages, `/trips/` from the manifest; P3b `MapView`, `AdvancedFilterPanel`, saved views, CSV export, axe and keyboard suites. Each is a PR a Sonnet agent can finish and a reviewer can read.
- Legal and attribution page (`/about/data/`) listing ODbL, OGL-Canada, Open-Meteo, Natural Earth, geoBoundaries: required the moment `/data/catalog/*.json` is downloadable; P3 is where it belongs.

### P4 trip schema in use, import Patagonia and the Rockies

Verdict: not ready; split into P4a (operations core), P4b (catalog ingestion), P4c (the two imports).

- Scope as written: all operations of 5.3 and 5.8 in TypeScript, `FileStore`, the ops CLI, the local API server, `trip-import` with an Opus mapping step, sidecars for every existing research file, `tools/catalog.py` (normalise, match, merge, propose, apply, freshness, coverage) plus a "TS twin", `/review/` UI, `sun.py`, `links.py`, `anchors.py`, `shots.py`, `research.py`, `lanes.py` and a skill. That is three or four agents of work.
- Hidden dependency: coordinates. Rockies `sights.json` rows have no `lat`/`lon` (0 of 48, verified); `trails.json` has a `trailhead` text name, not coordinates (verified); only `bases.json` may carry points. The catalog common block requires `area_id` and the matcher (0A.2 step 3) needs coordinates within 300 m. Importing the Rockies therefore means geocoding about 110 rows through Wikidata and Nominatim at one request a second, with review of the misses. The plan does not mention it. P4c needs a `geocode` pre-step with a report of unresolved rows.
- Spend: the owner's rule is "no model spend until the end; build on mocks". P4's Opus mapping of two PLAN.md files is model spend inside the phase. Say so and budget it, or make the mapping a reviewed JSON fixture the owner approves once.
- Acceptance "every booking, trail, adventure, hazard, budget row and day in today's PLAN.md tables appears in `trip.json`" is testable for the Rockies (48, 62, 43, 33 verified in `data/*.json`; `build_page.py` reads `adventures.merged.json`, not `adventures.json`, say which) but not for Patagonia, whose tables are prose Markdown. Name the Patagonia counts or change the criterion to "the owner signs off the proposal diff".
- The book-by offsets (-118 and -88 for 26 Feb 2027) are arithmetically correct (verified).
- "An op applied through the CLI and the same op through the local API produce identical files" is a good test; add "and through MCP `apply_operation` in Phase 2" to the Phase 2 outline so the three paths stay joined.

### P5a plan pages, maps, trails

Verdict: ready with fixes.

- Carve out the skills and agents. P5 owns nine skills, `.claude/agents/*.md` and the rewritten `trip-planner`. That is prompt engineering and process design, not app code; it has different reviewers and no tests. Make it P5c, owned by Opus per the house rule, after P5a ships the data it points at.
- Trail geometry depends on live Waymarked Trails and Overpass calls (3A). Say that geometry fetching is an owner-run step with committed outputs, and that P5a's tests run against committed GeoJSON fixtures, never the network.
- The offline acceptance ("Playwright offline test") needs the harness named: `context.setOffline(true)` after the SW install, which assets are expected, and that OpenFreeMap tiles are not asserted.
- Gallery: 1.2 moves `gallery.json` to `data/trips/<slug>/gallery.json` on migration; the web `Gallery` reads it. Confirm `gallery.py verify` keeps working on the new path (it takes a path argument, so yes, but the skill text changes).
- Fonts: the hub and pages load Google Fonts; offline pages will fall back to system fonts unless the app self-hosts them. Decide (self-host is the right answer for an offline-first trailhead page).

### P5b trip creation UI

Verdict: not ready as one phase; split into P5b-1 (S0-S6 inputs, match counter, candidate picker, `TripDraft` state, IndexedDB autosave, undo log), P5b-2 (S7 day board, `BoardMap`, keyboard moves, legs, day checks in the panel), P5b-3 (S8-S9, notes, custom items, universal search, spatial index reader, guardrails and fixes).

- The `TripDraft` state must be the trip.json shape with an operation log, or the "every board action is an operation" rule (5.1, 4.12) is broken on day one. Say it.
- The "simple fallback" draft (0B.2) groups picks "by nearest base" and needs coordinates and either legs or straight-line distance; with the P4 data most Rockies sights will have been geocoded only if P4c did its job. Make P5b depend on P4c explicitly.
- The match counter wording ("38 things match in Banff and Lake Louise; 12 suit a 10-year-old; 9 are open in September") assumes `season_months`, `min_age` and `kid_fit` are populated. With two regions imported, the counter will mostly say "unknown". Specify how unknowns are counted (kept, with a hedge word) so the UI copy is not misleading.
- A new user's trip lives only in IndexedDB in Phase 1. There is no export. Add "Download trip.json" and "Import trip.json" to S9 or the trip exists nowhere the owner can help with.
- Eleven guardrails each with a test, plus axe, plus a 390 x 844 phone layout test, plus keyboard-only creation of a 3-day trip: a good acceptance list, but it is the whole phase's test budget. Keep it, split the phase.

### P6 globe

Verdict: ready with fixes.

- G2 ("exact MapLibre version not recorded") is wrong; `globe/assets/vendor/VERSIONS.txt` says `maplibre-gl 6.14.0` and `GLOBE-RESEARCH.md:62` says the same. Correct the plan and pin the npm version to it.
- "Same drill paths, labels and pin counts" needs a committed fixture: a list of 10-20 `#c=..&s=..&d=..` hashes with expected labels and counts, captured from the legacy globe before P6 starts.
- 441 files under `globe/assets/` (verified), not 432; they move to `web/public/geo/`. Fine for the file budget, but `globe_data.py` heavy steps download from Natural Earth and geoBoundaries; say P6 moves committed outputs and does not re-run the downloads.
- Deleting `legacy/globe/` in the same PR after owner confirmation matches the house rule on deletions.

### P7 no-AI builder

Verdict: not ready; re-scope to a v1 planner with an explicit data-readiness check.

- Step 3's score uses `quality` "from signals we hold (official top-10 lists, appearance in N plans, owner rating when present)" and a `crowded` tag. None of these are fields in 0A.1, 2.3 or the Rockies data. Either add `quality_signals` to the catalog common block or drop the term for v1.
- Step 4 (k-medoids over leg minutes) needs a distance matrix. Catalog legs will be sparse for years; the fallback (straight-line x 1.4 at 60 km/h) will dominate and produce mountain-road nonsense (the plan's own R29). Say that v1 uses the fallback everywhere and labels it.
- Step 5 needs per-row `duration_min`, opening hours by weekday, and eateries for meal insertion. Places have no duration field (Rockies sights have `time_needed_hours`, a start); eateries exist nowhere. v1 should insert a generic meal slot, not an eatery.
- Sun times in the browser need a TS implementation; `tools/sun.py` is Python. Another parity pair, unmentioned.
- The gate ("good" coverage for two regions) requires eateries 3/area and an area guide present (0A.3 weights 0.05 and 0.10) and legs between top places and stays. None of the current research has eateries or area guides, and the owner's rule forbids new model spend before the end. The gate is unreachable as written. Recommendation: compute coverage after P4c, then calibrate targets and the gate against what two well-researched regions actually look like.
- The determinism and property-test acceptance is good and should stay.

### P8 routing with breaks (Phase 1 part)

Verdict: ready with fixes.

- The acceptance route (Calgary-Banff-Lake Louise-Jasper) must be a committed fixture: who fetches it (owner, `tools/route.py` with an ORS key), when, and its licence line (ORS routes over OSM data are ODbL-derived for the geometry).
- Specify the encoded polyline precision (5 or 6) and that `t(s)` and `d(s)` are stored per vertex in a sidecar array, since standard encoded polylines carry no time.
- The geohash reader (`/data/index/geo/<gh3>.json`) is owned by P5b-3 (`tools/views.py index`); P8 depends on it. State the dependency.
- Ferry and pass detection relies on OSM tags via Overpass; for the fixture, hand-mark the segments so the test does not need the network.
- The "one Overpass query every 5 seconds" rule needs to be enforced in code (a client-side limiter) and tested, since this is the one place the static site makes a third-party call on a user's behalf.

### Phase 2 outline

Verdict: outline only, acceptable as such. Before the Phase 2 plan is written, challenge the central design decision (D1 as the source of truth with a nightly export PR); see 4.4. Also note that a GitHub Action calling `/api/v1/export` behind Access needs its own service token, a second secret to manage.

## 3. P1 move simulation: everything the restructure breaks

Every item below was located with grep on 2026-10-17. "Plan lists it" says whether the 1.2 table or the P1 steps mention it.

| # | File and line | What it does today | After the move | Plan lists it |
|---|---|---|---|---|
| 1 | `_system/tools/hooks/locations_changed.sh`, `prepublish.sh`: `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"` | three levels up to the repo root | under `tools/hooks/` must be `/../..` | no |
| 2 | `locations_changed.sh`: `python3 "$ROOT/_system/tools/locations.py" validate` and `build` | | `$ROOT/tools/locations.py` | no |
| 3 | `prepublish.sh`: `python3 -m pytest _system/tests -q` | | `tools/tests` | no |
| 4 | `locations_changed.sh` globs `*/locations/locations.json`, `*/locations/[A-Z][A-Z].json`, `*/_system/site/locations.html`, `*/_system/site/site.css` | | still match `data/locations/...` and `legacy/_system/site/...`; no change needed | n/a |
| 5 | `.claude/settings.json` two hook commands `"$CLAUDE_PROJECT_DIR"/_system/tools/hooks/...` | | `tools/hooks/...` | yes |
| 6 | `_system/tools/locations.py:42` `ROOT = parents[2]`; `location_views.py:19`, `globe_data.py:25` same | | `parents[1]` | yes |
| 7 | `locations.py:231` `ROOT / "_system" / "site" / "countries.json"` | ISO2 to ISO3 | `data/reference/countries.json` | no (countries.json move is listed; this reader is not) |
| 8 | `location_views.py:42-49` `Paths`: `store`, `wishlist` under `locations/`; `list_page` `locations/index.html`; `globe_places` `globe/assets/data/places.json`; `template`, `css`, `countries_json` under `_system/site/`; `trips_root = r` | one root, one layout | five different new prefixes: `data/locations/`, `legacy/locations/`, `legacy/globe/assets/data/`, `legacy/_system/site/`, `data/reference/`; `trips_root` must be `legacy/` and later also `data/trips/` | partly ("Paths gains data_root, legacy_root") |
| 9 | `locations.py:1228,1278` `paths.trips_root / trip` must be a directory; `location_views.py:121` `trips_root / slug / "index.html"` for `trip_url` | validates 8 places' `trip` and emits links | fails validation and drops links unless `trips_root` is `legacy/` | no |
| 10 | `locations.py:1267-1268` screenshot must start with `locations/inbox/`; `:1386,1412` help text | validation rule | rule string changes if the inbox moves | no (only the data rewrite is listed) |
| 11 | `location_views.py:199-200` generated header text naming `locations/locations.json` and `_system/tools/locations.py` | written into `WISHLIST.md` and `locations/index.html` | changing it changes published bytes | no |
| 12 | `globe_data.py:26-27` `ASSETS = ROOT/"globe"/"assets"`, `CACHE = ROOT/"_system"/"site"/"cache"`; `:89` writes `_system/site/countries.json` | | `legacy/globe/assets`, `tools/.cache`, `data/reference/countries.json` | partly (cache yes, writer no) |
| 13 | `_system/tests/*.py` (7 files) `sys.path.insert(0, str(HERE.parent / "tools"))` | `_system/tools` | under `tools/tests/`, `HERE.parent` is already `tools/`; the `/ "tools"` must go | "path constants updated" only |
| 14 | `test_migrate_v2.py:52` `D.Paths(HERE.parents[1])`; `test_locations_split.py:16` `REPO = HERE.parents[1]` | repo root | becomes `tools/`; must be `parents[2]` | no |
| 15 | `test_site_outputs.py:7`, `test_list_page.py:12` `ROOT / "_system" / "tools"` | | `ROOT / "tools"` | no |
| 16 | `test_globe_data.py:8-9,86,106`, `test_globe_page.py:10`, `test_site_outputs.py:14-15` `ROOT/"globe"/...`, `ROOT/"locations"/"locations.json"` | | `legacy/globe/...`, `data/locations/locations.json` | no |
| 17 | `test_site_outputs.py:12-13` `WISHLIST`, `LIST_PAGE`; `:38` asserts no `locations/assets` | | `data/locations/WISHLIST.md`, `legacy/locations/index.html`; the assets assertion must target `legacy/locations/assets` | no |
| 18 | `test_list_page.py:16` `TEMPLATE = ROOT/"_system"/"site"/"locations.html"` | | `legacy/_system/site/locations.html` | no |
| 19 | `test_schema_sqlite.py:14` `DDL = HERE.parent/"tools"/"locations_schema.sql"` | | `data/schema/legacy/locations_schema.sql` | SQL move listed; the test path not |
| 20 | `test_locations_split.py:175-195` copies `REPO/_system/site` into `tmp/_system/site`, and creates `tmp/<slug>/index.html` for every repo child with `index.html` not starting with `.` or `_` | builds a tmp root in today's layout | must build `tmp/legacy/_system/site`, `tmp/data/locations`, `tmp/legacy/<slug>/`; otherwise the eight `trip` references fail validation in the tmp root | no |
| 21 | `test_location_views.py:187` and others set `LOCATIONS_ROOT` to a tmp dir and lay out `locations/` under it | | every tmp layout changes to `data/locations/` etc. | no |
| 22 | Five assertions on the literal `locations/inbox/` (`test_locations.py:157,160,165,404`, `test_location_views.py:143`) and `test_site_outputs.py:31` | | change only if the inbox moves | no |
| 23 | 8 x `legacy/<slug>/build_page.py` `sys.path.insert(0, str(HERE.parent / "_system"))` | resolves to `legacy/_system` after the move (verified reasoning; the plan is right) | add `sys.path.insert(0, str(HERE.parents[1] / "tools" / "gallery"))` for `import gallery as G` (module-level at `canadian-rockies-sept-2029/build_page.py:800`, inside functions elsewhere) | yes |
| 24 | `_system/build.py:30-31` `SYSTEM = parent`, `ROOT = SYSTEM.parent`; themes, components, layout relative to `SYSTEM` | | works unchanged under `legacy/_system/`; `ROOT` becomes `legacy/`, only used for relative display paths | n/a |
| 25 | `_system/gallery_find.py:27-28` imports `gallery` from its own folder; caches under `/tmp/gal` | | fine inside `tools/gallery/` | n/a |
| 26 | `publish.sh:8` runs `locations.py build` before staging; `:15-27` iterates `ROOT/*/` with `index.html`; `:49` hub excludes `globe`, `locations`; `:68` `date.today()`; `:181` wrangler from inside `.site` | | `tools/publish.py` must iterate `legacy/*/`, map `legacy/globe` and `legacy/locations` to `/globe/`, `/locations/`, keep the hub text, CSS, 404 page and footer byte-identical, honour `HUB_TODAY`, and run `locations.py build` first | yes, broadly |
| 27 | `.gitignore`: `_system/gallery.html`, `_system/site/cache/` | | `legacy/_system/gallery.html`, `tools/.cache/` | yes |
| 28 | `CLAUDE.md` (16 references to `_system`), `.claude/skills/location/SKILL.md` (paths at 8-9, 29, 35, 45, 52-53), `.claude/skills/trip-planner/SKILL.md` (16, 125-132, 159, 194-204, 231), `locations/README.md`, `_system/README.md` | | text updates | yes |
| 29 | `_system/migrate.py`, `migrate_legacy.py` take `<slug>` and resolve relative to their own parent | | under `legacy/_system/` they resolve to `legacy/<slug>`, which is where the trips are; works by luck, note it | n/a |

Byte-identical check: achievable. Evidence gathered today: all eight builders reproduce their committed `index.html` exactly (rebuilt in place, compared, restored); `PUBLISH_DRY_RUN=1 ./publish.sh` runs in 0.4 s, stages 461 files, leaves the working tree clean, and differs from a stale `.site/` only where the store changed since. The hub's `index.html` carries 12 date-relative badges, so `HUB_TODAY` is needed. The two conditions that would break it are items 9 (lost `trip_url` links) and 11 (generated header strings).

## 4. Architecture review

### 4.1 One JSON Schema as the source for DDL, TypeScript, Zod and the operation catalogue (2.5)

Realistic for the restricted subset, with three places it breaks:

- `money` is an object in JSON and two columns in DDL (2.5 "DDL mapping"). The generated TS type and the D1 row shape then differ, and `D1Store` must map every money field by hand. Either make money two scalar fields in the JSON too (`price_amount`, `price_currency`), or accept a documented mapping layer. The first is simpler and matches the "flat rows" rule in 2.1.
- `x-rules` interpreted by two runtimes is the actual cost, not the generators. Every new rule is written twice and parity-tested; the 40-fixture suite is the tax paid forever.
- Cross-file `$ref` between `trip.schema.json`, `locations.schema.json` and the ops schemas means the generator needs a resolver and a stable file order; say so.

Alternative worth one paragraph in the plan: Zod as the source, exporting JSON Schema (committed to `data/schema/generated/`) for Python, MCP and docs. The stated objection ("Python hooks must not need Node") survives because the exported JSON Schema is committed; Python only needs `jsonschema`. It removes one generator and the TS-type generator entirely. The remaining argument for JSON-Schema-first is reviewability of diffs, which is real but smaller than the parity tax.

### 4.2 Python tooling and TypeScript validators in parity (2.5, 5.2, R2, R3)

The plan has at least six parity pairs, not one: structural validator, day checks, `compute_book_by`, the catalog normalise/match/merge "TS twin" (0A.2 step 2), `place.*` (Python now, TS in Phase 2), and sun times (Python `sun.py`, needed in the browser for P7 and 0B.5). This is the plan's largest hidden cost and its most likely source of silent drift.

Recommendation: one implementation per concern. Operations, structural validation, day checks and book-by in TypeScript only; the Python hooks call `node web/bin/validate.js <file>` (Node 22 is installed; startup cost is about 200 ms, acceptable for a hook). Python keeps what is already Python and does not need a twin: `locations.py` and its resolver, `globe_data.py`, the gallery pipeline, trail fetching, screenshots. Drop the "TS twin" of `catalog.py`: in Phase 1 the pipeline runs on the owner's machine; in Phase 2 the Worker calls the same logic only if it is TS, so write `catalog` normalise/match/merge in TS from the start and give it a thin Python CLI wrapper if skills need one. This change deletes R2 and most of R3.

### 4.3 Static-export Next.js 16 on Cloudflare Pages with editing deferred to a local server (3C, 4.7, R4)

Sound for a single owner. Two things to add: a deployed `/<slug>/edit/` route that renders disabled forms is confusing and costs a build route per trip; render a single `/edit-unavailable/` page instead, and link to it. And `NEXT_PUBLIC_API_ORIGIN` unset meaning "editor disabled" is an implicit feature flag; make it an explicit `NEXT_PUBLIC_EDITING=local|hosted|off`. Cloudflare's own steer towards Workers (R10) is handled correctly by staying portable.

I could not re-verify the Next.js 16 static-export limitations list or shadcn's Base UI default from this machine; treat 3B/3C's version claims as the plan author's and pin exact versions in the P3 brief.

### 4.4 Git JSON as the source of truth, then D1 with a nightly export PR (5.6, 3C)

The Phase 1 half is right: git is the truth, every write is an operation, hooks validate. The Phase 2 half creates two sources of truth with a 24-hour window between them, and the plan's own guards (the `D1-Export` trailer, `data/.mode = d1`, `diff-d1` with `expected_rev`) are evidence of how much machinery that takes. Failure modes not covered: a 409 in the git-to-D1 job has no resolution procedure; the owner's local `pnpm data:serve` still exists in Phase 2 and can write files the hook now rejects; a red export PR left open means the public site (built from git) silently lags the editor by days; `auto-merge` needs branch protection and a bot token in a private repo.

Alternative to evaluate before the Phase 2 plan: keep git as the only truth and let the Worker commit through the GitHub API (one commit per operation or per short batch, with the validator run in the Worker before committing). D1 becomes a read index rebuilt from git, not a truth. Trade-offs: a write takes two to five seconds instead of milliseconds; concurrency is one writer at a time (fine for one owner, a problem for a product); the Worker holds a GitHub token (a secret either way). It removes the export loop, the mode flag and `diff-d1` entirely. Decide this before Phase 2, not inside it.

### 4.5 The catalog flywheel and staleness model (0A.1-0A.3)

Freshness limits are sensible (prices 120 days, hours 180, windows 365, closures 7, stats 3 years). Two problems:

- Coverage targets and weights are invented, not measured. Legs weigh 0.10 and demand 100% of top-6-places x stays pairs per area (up to 18 routed legs each); eateries weigh 0.05 and area guides 0.10, and neither exists in any research today. "Good" at 0.7 is reachable only when sights, trails, activities and stays are all at target and fresh. Calibrate after P4c against the two imported regions, then write the numbers down.
- Auto-accept of a new row with one `official` or `operator` source landing as `verified` (0A.2) means an agent's misread of an operator page becomes a verified fact for everyone. Lower the landing status to `proposed` with auto-accept only into `stated`, or require two independent sources for `verified`. R22 names the risk but the mitigation ("the owner can filter for it") is weak.
- The `priority = trips_using * urgency * severity` formula goes to zero for every backlog item on an area no trip uses yet, which is exactly where coverage work is needed. Add a floor of 1.

### 4.6 The ID scheme (2.1, 0A.1)

Hierarchical path ids (`CA/AB/banff/lake-louise`) are readable and already in use, and PLAN-locations R15 records their known weakness (an area edit breaks the prefix). New problems the platform adds: geometry file names "with slashes as dashes" collide (`a-b/c` and `a/b-c` both become `a-b-c`); offer ids `of-<provider>-<product>` and leg ids `<from>~<to>~<mode>` embed other ids and reach hundreds of characters; URL routes for places need catch-all segments. Keep the readable ids, but define the file-name encoding as `__` for `/` (no collision with `-`) and give legs a hashed short id with `from`, `to`, `mode` as columns.

### 4.7 Trails as a catalog with stored GeoJSON (3A, 2.3)

Size (1.5 MB for 84 trails) is fine; the repo is 19 MB with the 24 MB globe assets tracked, so the real repo-size problem is already `globe/assets/`, which P6 moves but does not shrink. Licence handling (one source per file, NOTICE, attribution strings) is correct. Missing: an update path. Geometry is marked "never stale" (freshness table) but OSM relations get re-drawn and agency datasets update weekly; add an annual `trails.py refetch --changed` that diffs against the stored `geometry_source_id` and reports length changes over 5%. Also state that `tools/trails.py` network calls are owner-run, never in tests or hooks (R5 implies it).

### 4.8 The corridor search index shipped as static JSON (0B.5)

The geohash-3 file layout is fine at 10,000 rows. Two caveats: trails are indexed by trailhead, and today no trail in the data has a trailhead point (section 2, P4); and the index is only useful offline if the service worker precaches the geohash files for the trip's bounding box, which 4.9's precache list does not include. Add `/data/index/geo/` for the trip's cells to the precache list.

### 4.9 The no-AI builder (0A.5, P7)

Under-specified where it matters (inputs that do not exist) and over-promised in tone ("same inputs give byte-identical drafts" is easy; "a draft worth editing" is the hard part). See the P7 verdict. The honest v1 is the fallback already described in 0B.2: picks grouped by base, spread across days in score order, no times. Ship that as "P7 v1" with the data-readiness report, and keep the full algorithm as the P7 v2 spec to be re-planned once two regions have real coverage numbers.

### 4.10 Multi-user readiness without auth (0A.4)

What will change regardless of the auth choice: the static export must filter by `visibility` (not stated anywhere in P3/P5 acceptance); localStorage and IndexedDB state (ticks, drafts, saved views, undo log) has to move server-side per user; `contributed_by` attribution needs a display name table; proposals need a per-user queue and rate limits; deletion of a user's data (and their proposals) needs a procedure; a privacy policy and terms page are needed the day a second person logs in. None of these are blockers now; the first (visibility filtering in the export) is a correctness requirement from P3.

### 4.11 Privacy and licensing (0A.4, 3A)

Verified: the GitHub repo is private, so D4's premise holds and `x-private` fields in git are acceptable for now. ODbL for the whole catalog is the right simplification; note that it also binds anyone who downloads `/data/catalog/*.json` to share-alike, which is fine for a personal open-data project and a constraint if D17 ever says "product with partners". Copied text: the rule (facts in our words plus the link; quotes only in `research/`) is right; R23's "test flags summaries with long overlaps against cited source snippets" is not implementable without storing the snippets, which 0A.4 says never to publish and the plan never says to store. Make it a review-time check in `catalog-review`, not a test. Images: Commons hotlinking via `Special:FilePath` is tolerated but Wikimedia asks high-traffic sites not to; fine at this scale, worth a line. Source URLs of other people's Instagram posts published in `sources` (PLAN-locations R11 raised this) should stay behind the allow-list for `community` kinds.

### 4.12 Offline at a trailhead (4.9)

The GeoJSON-on-blank fallback and GPX/KML downloads are the realistic offline story; the 1,500-tile cap will be hit by any multi-day mountain trip at zoom 14 (inference: a 30 x 30 km day box is about 200 tiles at z14 alone), so expect blank basemaps. Three things not covered: web fonts from Google Fonts (self-host), Commons images (precache thumbnails, cap count), and the geohash index (4.8). A `manifest.json` for "Add to Home Screen" costs an hour and makes the offline story usable on a phone; add it to P5a.

### 4.13 Accessibility (3B, 0B.6)

Better than most plans: axe in CI, keyboard paths for drag-and-drop, colour-blind-safe day palette with dash patterns, ARIA live announcements. Gaps: no `prefers-reduced-motion` rule (the owner's own UI-motion rule says everything animates; it must yield to the OS setting); maps and the elevation profile need a text equivalent (an sr-only table of items and legs per day; the profile's min/max/gain in text); focus management when URL state changes views; `lang` attributes on local place names. Add these four lines to 0B.6.

## 5. Missing requirements and gaps

Against what the owner asked for, the plan covers: global catalog usable by others (0A), research feeding data (0A.2, 7.6), intuitive creation with search-to-add, notes and custom stops (0B.2-0B.4), A-to-B routing with breaks every N hours (0B.5, Phase 1 as estimates), filters on top with card/list/table/map views (4.2), the same data on the globe (4.6), trails drawn with difficulty and click-out (3A, 4.4), embeds plus links (4.8), trip tags (2.6), research agents by trip type with booking links, prices, windows and sell-out speed (7.2-7.4), MCP exposing the schema (5.7), no paid services (0A.6). Two caveats on "no paid": the Google Maps Embed key (D12) needs a Google Cloud project with a billing account attached even though the Embed API is free; and Open-Meteo is free for non-commercial use only.

What the plan never mentions, and when it matters:

| Need | Matters | Where to put it |
|---|---|---|
| Visibility filtering of the static export (private and unlisted trips must not be built into `web/out` or `/data/*.json`) | now, P3 | 1.3, P3 acceptance |
| Legal and attribution page listing every data licence | now, P3 (the moment `/data/catalog/*.json` is downloadable) | 4.1 route `/about/data/` |
| Backups and recovery: git covers `data/` and `research/`; nothing covers a user's IndexedDB draft, the `.site` deploy history, or D1 before the first export | P5b (download trip.json); Phase 2 (D1 export is also the backup; say so) | 0B.2, 5.6 |
| Analytics (privacy-respecting): Cloudflare Web Analytics is free and cookie-less | P3, one line | 14 |
| Error monitoring: none planned; at minimum a `window.onerror` beacon to a Worker log in Phase 2, or a free Sentry tier | Phase 2 | Phase 2 outline |
| Performance budgets: MapLibre alone is about 800 KB; set a per-route JS budget (plan page under 250 KB gzipped before the map island loads lazily) and an LCP target, enforced by a build test | P3 | 4.3 or a new 4.13 |
| SEO and sharing previews: `noindex` is decided (D16) but Open Graph title, description and image per trip are not; the hero image exists | P3 lists, P5a plan pages | 4.5 |
| Units and currencies: Rockies trails already carry `mi`; US trips are in miles; a `units` preference (km/mi, m/ft, C/F) and a display currency on top of the CAD base | P3 (preference), P5a (display) | 4.2, G9 |
| Time zones: `hhmm` item times are implicitly in the base's local zone; Patagonia (UTC-3) with Toronto departures and overnight flights has day-0 items in two zones; sun times depend on the zone | P2 schema: `bases.tz` (IANA) and `items.tz` override; P4 import | 2.3 |
| PWA install (`manifest.json`, icons) | P5a with the service worker | 4.9 |
| ICS export (booking deadlines, day titles, check-in and check-out) | P5a, `tools/exports.py` | 12 |
| Import from Google Maps lists (Takeout CSV or GeoJSON into custom items or places) | later, Phase 2 | 9 |
| Collaboration (two travellers editing one trip, shared ticks) | later; G8 covers ticks, nothing covers edits | 0A.4 |
| Running cost and limits: Pages 500 builds a month (builds are local, so irrelevant), Workers free 100k requests a day, D1 free tier, KV, ORS 2,000 a day, Overpass fair use | Phase 2 plan, one table | 14 |
| Migration of existing localStorage state: 4.10 says "same storage keys per trip slug, migrated once" but never names the keys (`base.js:65-136` uses `getItem(key)` with a `legacy` fallback already) | P5a | 4.10 |
| Schema versioning policy for `trip.json` and catalog files (`tools/data.py migrate` is named once) | P2 | 2.5 |
| CI: 1.1 says "CI validates every commit" but no workflow exists and the owner's standing rule elsewhere is "verify locally, CI is not a focus"; decide and say which | before P1 | 1.1 |
| Hook runtime once `tools/` is a uv project: `python3` versus `uv run`, and how `jsonschema` is available to hooks and `publish.sh` | P2 | 7.5 |
| Moderation if others contribute: proposals-only (D19) is right; add rate limits and a block list for the inbox endpoint | Phase 2 | 5.5 |
| Data quality and trust signals in the UI: provenance line and freshness badge are specified (4.11); a per-row "disputed" flag from `confidence: conflict` is not surfaced | P5a | 4.11 |

## 6. Risks ranked (top ten)

| Rank | How the effort fails or stalls | Why likely | Mitigation to add to the plan |
|---|---|---|---|
| 1 | P1 ships with hooks pointing at a non-existent root and `validate` failing on `trip` references; every later agent's PostToolUse hook exits 2 and work stalls | the 1.2 table omits items 1-3, 7-11, 13-22 of section 3 | put section 3's table into the P1 brief as a checklist; add "run both hooks by hand with a sample JSON on stdin" to P1 acceptance |
| 2 | P2, P4 and P5b are each handed to one Sonnet agent, which compresses scope to finish, and the compressed parts (parity tests, geocoding, keyboard paths) are the ones that hurt later | phase sizes in 6 | split as in section 2; one PR per sub-phase |
| 3 | The schema agent guesses which of 2.2/2.3, 2.8 and 0B.2 is canonical | the contradictions listed under P2 | editor re-issues 2.2 and 2.3 as one table list before P2 starts |
| 4 | Six Python/TS parity pairs drift; a day check passes in the hook and fails in the editor | 4.2 above | one runtime per concern (TS for ops, validation, checks; Python for existing tools) |
| 5 | The Rockies import stalls on coordinates: 48 sights and 62 trailheads have none | verified in `canadian-rockies-sept-2029/data/` | P4c pre-step: `geocode` with a review report; accept rows without coordinates as `raw` |
| 6 | P7's coverage gate never opens, or the owner spends on new research lanes to open it against the no-spend rule | 0A.3 targets include eateries and area guides that no research has | calibrate targets after P4c; define a v1 planner that needs only what exists |
| 7 | Two agents in one checkout both touch `web/package.json` (P2 and P3) or `web/components/map/**` (P5a and P5b) and one overwrites the other | 6.0 parallelism without a file-ownership table | add a file-ownership table like PLAN-locations-g5 section 5, and the "commit only owned paths, never `git add -A`" rule; prefer git worktrees per agent |
| 8 | Phase 2's two-truth design (D1 plus nightly export) produces a stuck red PR and a public site days behind the editor | 4.4 above | decide git-backed writes versus D1-as-truth before the Phase 2 plan |
| 9 | External APIs break or throttle (Waymarked Trails already lost its GPX route; Overpass, OpenFreeMap tiles, ORS quotas) | R5, R9, R30, R31 | every fetch is owner-run with committed outputs; tests never touch the network; a weekly contract test outside CI |
| 10 | The owner becomes the bottleneck: proposal review queues, 40 broken fixtures to approve, screenshots to read, two full plan-page sign-offs | 0A.2 step 6, P4, P5a acceptance | batch reviews per phase; auto-accept only to `stated`; a single "review packet" per PR |

Also real but lower: legacy pages keep being edited while migration runs (two component vocabularies, CLAUDE.md gotcha) so parity targets move; the no-spend rule versus P4's Opus mapping; the `.pages.dev` hostname is hard-coded in nothing today but will be the moment OG tags exist (14 covers it).

## 7. Concrete enhancements to the plan

Priority: **A** = must before P1 launches, **B** = must before P2 launches, **C** = later (before the phase it names).

| # | Where | Change | Why | Priority |
|---|---|---|---|---|
| E1 | 1.2, R1 | "16 trip folders" to 15; "9 builders" to 8 (list them) | agents hunt for missing files | A |
| E2 | 1.2 hooks row | add: both hooks compute `ROOT` from `../../..`, change to `../..`; replace `_system/tools/locations.py` and `_system/tests` inside the scripts | silent breakage of every later hook | A |
| E3 | 1.2 `_system/tools` row | replace "Paths gains data_root, legacy_root" with the exact new `Paths` layout: `store`, `wishlist` under `data/locations/`; `list_page` `legacy/locations/index.html`; `globe_places` `legacy/globe/assets/data/places.json`; `template`, `css` `legacy/_system/site/`; `countries_json` `data/reference/countries.json`; `trips_root` `legacy/` (and `data/trips/` from P4: a trip exists if either has it); `locations.py:231` reads `countries_json` from `Paths`, not `ROOT` | items 7-9 of section 3 | A |
| E4 | 1.2 inbox row | move the inbox move to P2 (with the v3 sources rewrite) and say why (validation rule at `locations.py:1267`, six assertions, skill text) | keeps P1 behaviour-free | A |
| E5 | P1 acceptance | add: "the two generated strings in `location_views.py:199-200` stay verbatim in P1; P2 updates them"; and "diff of `.site/` is byte-identical with `HUB_TODAY` pinned, no exceptions" | items 11 and 26 | A |
| E6 | P1 steps | replace the five commit groups with the five-step order in section 8 (code move first with constants still pointing at old data paths, then data, then legacy, then publish, then docs), each step green | "green after each group" is otherwise false | A |
| E7 | P1 owns | list the seven test files by name with the exact constant edits (section 3 items 13-21), `test_locations_split.py`'s tmp-root layout, and `test_schema_sqlite.py`'s DDL path | the brief says "path constants updated" and nothing else | A |
| E8 | P1 pitfalls (new subsection) | hooks are read at session start (inference): during P1 run the dry-run as `python3 tools/publish.py --dry-run` (does not match `*publish.sh*`), and edit `locations.json` only via Bash, never Write/Edit, until the session restarts | the stale hook blocks the acceptance command | A |
| E9 | 1.1 and 1.2 | resolve the `archive/` and loose-notes contradiction (1.1 "minus research/" versus 1.2 moves them); recommended: move to `research/trips/<slug>/archive/` and `notes/` | agent does whichever it reads last | A |
| E10 | 1.1 rules table | decide CI: either add a `.github/workflows/tests.yml` to P1's owns, or change "CI validates every commit" to "the pre-publish hook validates; CI is deferred" | an asserted guard that does not exist | A |
| E11 | 3B gotcha, G2 | MapLibre is `6.14.0` per `globe/assets/vendor/VERSIONS.txt`; delete G2, pin `maplibre-gl@6.14.0` in P3 | wrong claim | A (edit), C (use) |
| E12 | 2.2, 2.3 | re-issue as the single canonical table list with 2.8 (`trip_activities`, `trip_bookings`, `items.activity_id/offer_id/leg_id/override`, `bases.stay_id`) and 0B.2 (`notes`, `custom_items`, `routes`, `items.custom_item_id/pinned`) folded in; remove `bases.booking_id`; make `trip.web_published` and 1.3's `web.published` one field; make `money` two scalar columns | P2 cannot start on three contradictory layers | B |
| E13 | 2.3 | add `bases.tz` (IANA) required, `items.tz` nullable override; `hhmm` values are in the item's zone; sun times use the base zone | multi-zone trips | B |
| E14 | 2.5, 5.2 | one runtime per concern: TS for ops, structural validation, day checks, book-by, catalog normalise/match/merge, sun in the browser; Python hooks call `node web/bin/validate.js`; delete the "TS twin" and the Python validator; keep a parity test only for `place.*` until Phase 2 ports it | removes six parity pairs | B |
| E15 | 2.5 | one paragraph evaluating Zod-as-source with exported JSON Schema; decide | the plan rejects it on a premise that does not hold | B |
| E16 | 6 P2 | split: P2a schemas, Python-side DDL and SQLite tests, v3 migration, `freshness.json`, `policy.json`; P2b (after P3 scaffolds `web/`) TS types, Zod, ops catalogue, validator, MCP stdio server, `.mcp.json` | `web/` does not exist in P2 | B |
| E17 | 7.5, 1.1 | specify the Python runtime: `tools/pyproject.toml` with `requires-python`, `jsonschema`; hooks and `publish.sh` run `uv run --project tools python ...` or keep stdlib-only validation in hooks; pick one | hooks on a system `python3` without jsonschema | B |
| E18 | 1.3, P3 acceptance | the export excludes `visibility != public` trips and strips `x-private`; the privacy test greps for traveller fields and research paths; define the `web/out` to `.site/` merge order and `_redirects` | first public build is P3 | B |
| E19 | 4.1 | add `/about/data/` (licences and attribution), OG tags per trip, `manifest.json`, Cloudflare Web Analytics, a JS budget test | product basics never mentioned | B (route list), C (build) |
| E20 | 6 P3 | split P3a and P3b as in section 2; pin Next.js, shadcn and MapLibre versions; "64 places" | one agent, one PR each | B |
| E21 | 6 P4 | split P4a ops core, P4b ingestion and coverage, P4c imports; add the geocoding pre-step and its report; name the Patagonia count criterion or replace with owner sign-off; state the Opus spend | hidden work and spend | C (before P4) |
| E22 | 0A.2 auto-accept | new rows auto-accept to `stated`, not `verified`; `verified` needs owner review or two independent official sources | agent misreads become facts | C (before P4) |
| E23 | 0A.3 | add a priority floor of 1; replace fixed coverage targets with "calibrated after P4c" and a dated table to fill | formula zeros out unplanned areas; targets are guesses | C (before P4) |
| E24 | 6 P5 | P5c skills and agents as its own phase (Opus); P5a tests on committed GeoJSON only; name the offline harness; self-host fonts; add ICS export and `manifest.json` to P5a | mixed concerns | C (before P5a) |
| E25 | 6.2 P5b | split in three; `TripDraft` is the trip.json shape plus an op log; "Download/Import trip.json" in S9; dependency on P4c geocoding; unknown-count wording in the match counter | one agent cannot finish it | C (before P5b) |
| E26 | 0A.5, 6.1 P7 | P7 v1 = the 0B.2 fallback plus a data-readiness report per area; the full algorithm becomes a v2 spec re-planned after calibration; drop `quality` and `crowded` until the fields exist; add the TS sun implementation to the owns list | over-promised on data that does not exist | C (before P7) |
| E27 | 0B.5, 6.2 P8 | commit the Calgary-Jasper route fixture with provenance and licence line; polyline precision and per-vertex time arrays; dependency on `tools/views.py index`; hand-marked ferry and pass segments for tests; a tested Overpass limiter | fixture and format gaps | C (before P8) |
| E28 | 3A storage | add `trails.py refetch --changed` yearly; geometry file name encoding `__` for `/`; legs get a short hashed id | collision and staleness | C (before P4) |
| E29 | 5.6, Phase 2 outline | add "decision: git-backed writes from the Worker versus D1-as-truth with export", with the trade-offs in 4.4 | the biggest Phase 2 design risk is undecided | C (before the Phase 2 plan) |
| E30 | 6.0 | a file-ownership table for every parallel pair (P2 and P3; P5a, P5b and P6; P7 and P8) plus the "commit only owned paths" rule, or one worktree per agent | overwrites in one checkout | B |
| E31 | 0B.6 | `prefers-reduced-motion`; sr-only day and leg tables under maps and the profile; focus management on view changes; `lang` on local names | accessibility gaps | C (before P5a) |
| E32 | 4.9 | precache `/data/index/geo/` cells for the trip; state the tile cap will usually be hit and the blank-basemap fallback is the expected mountain-trip experience | honest offline expectations | C (before P5a) |
| E33 | 4.10 | name the localStorage keys from `base.js` and the migration rule | "migrated once" is unspecified | C (before P5a) |

## 8. P1 readiness: go / no-go and the P1 brief

**Decision: no-go on the plan text as it stands; go today once the brief below is attached.** Nothing here needs a new owner decision; D8 (research namespace) stands and the inbox deferral (E4) is a scheduling change inside the approved target layout.

### 8.1 Order of work (each step ends green)

| Step | Move | Fix in the same commit | Green check |
|---|---|---|---|
| 0 | nothing | `PUBLISH_DRY_RUN=1 ./publish.sh`; `cp -r .site /tmp/site-before`; write `tools/tests/fixtures/served-urls.txt` from `find .site -type f`; record `pytest` = 109 | baseline |
| 1 | `git mv _system/tools tools` (hooks come with it), `git mv _system/tests tools/tests` (fixtures come with it), `.claude/settings.json` | `ROOT = parents[1]` in `locations.py`, `location_views.py`, `globe_data.py`; `sys.path.insert(0, str(HERE.parent))` in seven tests; `parents[2]` in `test_migrate_v2.py:52` and `test_locations_split.py:16`; `ROOT / "tools"` in `test_site_outputs.py:7`, `test_list_page.py:12`; hook `ROOT` to `../..` and script paths to `tools/...`; `prepublish.sh` to `tools/tests`. Leave every data path (`locations/`, `globe/`, `_system/site/`) as it is | `pytest tools/tests -q` = 109; `echo '{"tool_input":{"file_path":"x/locations/locations.json"}}' \| bash tools/hooks/locations_changed.sh; echo $?` = 0 |
| 2 | `git mv locations/locations.json locations/WISHLIST.md locations/README.md data/locations/`; `git mv locations/PRIORITIES.md research/places/`; `git mv _system/site/countries.json data/reference/`; `git mv _system/tools/locations_schema.sql data/schema/legacy/` (now under `tools/`) | `Paths.store`, `wishlist`, `countries_json`; `locations.py:231`; `test_schema_sqlite.py:14`; `test_site_outputs.py:12`; `test_globe_data.py:106`; the tmp-root layouts in `test_locations_split.py` and `test_location_views.py` | 109 passed; `locations.py validate`; `build --check` |
| 3 | `git mv` the 15 trip folders to `legacy/`; `_system/{build.py,base.css,base.js,layout.html,themes,components,migrate.py,migrate_legacy.py,README.md,site/locations.html,site/site.css}` to `legacy/_system/`; `_system/gallery*.py` to `tools/gallery/`; `globe/` to `legacy/globe/`; `locations/index.html` to `legacy/locations/`; `<slug>/research/` to `research/trips/<slug>/`; `archive/` and loose notes per E9; `_system/site/{GLOBE-RESEARCH,PLAN-locations-g5}.md` and `AUDIT-2026-10-16.md` to `docs/`; `_system/site/cache` to `tools/.cache` (gitignored, so just delete or move locally) | `Paths.list_page`, `globe_places`, `template`, `css`, `trips_root = root/"legacy"`; `globe_data.py` `ASSETS`, `CACHE`, countries writer; `test_globe_data.py`, `test_globe_page.py`, `test_site_outputs.py:13-15,38`, `test_list_page.py:16-17`; `test_locations_split.py` copies `legacy/_system/site` and iterates `legacy/`; one `sys.path` line added to each of the 8 builders; `.gitignore` | 109 passed; `build --check`; rebuild all 8 builders and `git status --short legacy` is empty |
| 4 | none | `tools/publish.py` (route table: `legacy/<slug>` to `/<slug>/` plus `assets/`, `legacy/globe` to `/globe/`, `legacy/locations/index.html` to `/locations/`; runs `locations.py build` first; `--dry-run`; `HUB_TODAY`), `tools/hub.py` (the heredoc verbatim, CSS and 404 included), `publish.sh` three-line wrapper; new tests: served-URL superset, no `research/` in `.site/`, `legacy/MANIFEST.json` frozen, reserved-slug check | `HUB_TODAY=<date of step 0> python3 tools/publish.py --dry-run && diff -r /tmp/site-before .site` is empty |
| 5 | none | `CLAUDE.md`, `.claude/skills/*/SKILL.md`, `data/locations/README.md`, `legacy/_system/README.md`, a stub `README.md`; `docs/` index line | all of the above again; `git diff --stat` reviewed against the 1.2 table |

Deferred to P2 on purpose: `locations/inbox/` to `research/inbox/` and the two generated strings in `location_views.py:199-200`. The P1 brief must say both.

### 8.2 Commands the agent runs (absolute paths)

```bash
python3 -m pytest /home/nitin27may/workspace/travel/tools/tests -q
python3 /home/nitin27may/workspace/travel/tools/locations.py validate
python3 /home/nitin27may/workspace/travel/tools/locations.py build --check
HUB_TODAY=2026-10-19 python3 /home/nitin27may/workspace/travel/tools/publish.py --dry-run && diff -r /tmp/site-before /home/nitin27may/workspace/travel/.site && echo SITE_IDENTICAL
for f in /home/nitin27may/workspace/travel/legacy/*/build_page.py; do (cd "$(dirname "$f")" && python3 build_page.py >/dev/null) || echo "FAIL $f"; done; git -C /home/nitin27may/workspace/travel status --short legacy
echo '{"tool_input":{"file_path":"/x/data/locations/locations.json"}}' | bash /home/nitin27may/workspace/travel/tools/hooks/locations_changed.sh; echo "hook rc=$?"
echo '{"tool_input":{"command":"./publish.sh"}}' | bash /home/nitin27may/workspace/travel/tools/hooks/prepublish.sh; echo "hook rc=$?"
```

Step 0's baseline must be taken with the same `HUB_TODAY` the final diff uses, or the hub badges differ; today's `publish.sh` has no such variable, so the baseline is taken by setting the system date in the diff script instead: run the baseline, then in step 4 pass `HUB_TODAY` equal to the baseline's calendar date.

### 8.3 Pitfalls to write into the brief

1. The eight builders already reproduce their pages byte-for-byte (verified 2026-10-17). If one differs after the move, the cause is the move, not pre-existing drift.
2. `import gallery as G` is module-level in `canadian-rockies-sept-2029/build_page.py:800` and inside a function in the other seven; the extra `sys.path` line must precede line 800 there.
3. `trips_root` must be `legacy/` or `validate` fails on eight places and the list page loses links.
4. Do not change the strings at `location_views.py:199-200` in P1.
5. Do not move `locations/inbox/` in P1.
6. The PostToolUse and PreToolUse hooks in the running session still point at `_system/` (inference); use `python3 tools/publish.py --dry-run`, not `./publish.sh`, for the acceptance diff, and never Write/Edit `locations.json` during P1.
7. `git mv` only; never `git add -A`; one commit per step above; push after each green step (house rule).
8. `.site/`, `.wrangler/`, `.pytest_cache/`, `__pycache__/`, `_system/gallery.html`, `_system/site/cache/` are untracked; the `.gitignore` entries move with them.
9. `peru/` has no `index.html` and is not served; it still moves to `legacy/peru/` and appears in `MANIFEST.json` with `served: false`.
10. `locations.py` has a `LOCATIONS_ROOT` override used by tests; after the move it points at a root that contains `data/`, `legacy/` and `research/`, so every test that builds a tmp root must build that shape.

### 8.4 If the owner wants a smaller first step

A safer P1 is two PRs: P1a = steps 0-2 (code and data, no URLs change, no builders touched), P1b = steps 3-5 (legacy, publish, docs). P1a is a half-day for a Sonnet agent and proves the test-constant edits before anything the public sees is touched. P1b carries the byte-identical gate. This is the order I would use.
