# Research tools: every script by its real path

Scripts stay with their packages (`tools/`, `core/bin/`, `web/scripts/`), where their tests, hooks and check-all expect them
(cleanup D14). This page indexes them. Run every command from the repository root unless the row says otherwise. Every
path below exists; every `core/bin` command prints its full usage with `--help`.

Rate rules for every external call are in [README.md](README.md) section 9. A row's "hosts" column names what the script
calls; "offline" means it calls nothing.

## Places

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `python3 tools/locations.py` | the location store: `add`, `import <batch>`, `edit`, `visit add`, `collection add`, `tag alias`, `tag list`, `list`, `validate`, `build [--check]` | capture a place (README 3a); adopt a place for a trip (`edit ID --trip SLUG --status planned`) | `data/locations/locations.json`; `build` writes `data/locations/WISHLIST.md`, `legacy/locations/index.html`, `legacy/globe/assets/data/places.json` | Wikidata then Nominatim, one request a second, project user agent; `--offline` skips both | check-all "locations validate", "locations build --check"; `tools/tests/test_locations*.py`; the PostToolUse hook `tools/hooks/locations_changed.sh` |

## Capture contract and records

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `node core/bin/capture.ts fields --type <id>` (`--kind`, `--subkind`, `--ref`, `--format json`) | the checklist of a type: R, R?, A per layer, the suitability block, links, sources in order | before the first record of a type; `--ref` for what one record still lacks | stdout | offline | core tests |
| `node core/bin/capture.ts explain <type>` | where each mark comes from | a mark looks wrong | stdout | offline | core tests |
| `node core/bin/capture.ts types [--tree]` | the type tree and its counts | finding a type id | stdout | offline | core tests |
| `node core/bin/capture.ts gaps --trip <trip-id> [--level usable\|complete] [--json]` | per record, the missing required properties | the brief of a gap-filling pass (README 3c) | stdout | offline | core tests |
| `node core/bin/capture.ts run --check <file>` | validate a `capture-run/1` record | after every crawl or API run | exit code | offline | check-all "validate every data file" |
| `node core/bin/capture.ts build [--check]` | write the generated contract files: `data/schema/capture/*`, the per-domain checklists (`research/types/*`), `data/schema/suitability-applicability.json` | after any change to `data/vocab/types.json` or the property registry | generated files; `--check` exits 1 on drift | offline | check-all "capture contract: generated files match data/vocab/types.json" |
| `node core/bin/validate.ts <file...>` or `--all` | structural and reference validation of every data family | after writing any data file | one line per problem | offline | check-all "validate every data file"; the PostToolUse hook `tools/hooks/data_changed.sh` for trip, catalog and vocab files |

## Suitability, relevance and sources

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `node core/bin/suitability.ts check [--coverage <trip-id>]` | validate the suitability sidecars; with `--coverage`, list the scope refs no file covers and each record's level | after writing a suitability file | stdout | offline | check-all "suitability sidecars (suitability/1)" |
| `node core/bin/suitability.ts fields --ref <ref>` (or `--kind K --subkind S`) | the suitability paths a lane researches: R, A, N | before filling a suitability block | stdout | offline | core tests |
| `node core/bin/relevance.ts check` | validate the relevance sidecars | after writing a relevance file | stdout | offline | check-all "relevance sidecars" |
| `node core/bin/relevance.ts derive --write\|--check` | compute substitutes, detour, fits, role, badge | after a relevance change | `data/relevance/derived/<trip>.json` | offline | check-all "relevance derived files are current" |
| `node core/bin/relevance.ts signals --fetch [--osm]` | read Wikidata and Wikipedia page views (and Overpass class counts with `--osm`) for confirmed QIDs | before a relevance pass on new records | `data/relevance/signals/` | Wikidata, Wikimedia REST, Overpass; sequential, cached, project user agent | core tests (offline fixtures) |
| `node core/bin/relevance.ts points --build [--check]` | merge every known coordinate, including `data/capture/points.json`, into `data/relevance/inputs/points.json` | after adding captured points | the points file | offline | `relevance.ts check` |
| `node core/bin/relevance.ts freshness` | list stale relevance values | a refresh pass (README 3d) | stdout | offline | - |
| `node core/bin/sources.ts build [--check]` | derive the source registry from the lane files' `sources` arrays | after any lane file change | `data/sources/registry.json` (generated; never hand-edit) | offline | check-all "source registry is current and valid" |
| `node core/bin/sources.ts due`, `who <url\|id>`, `by-publisher` | sources past their re-check date; the facts that rely on a source | a refresh pass; before replacing a source | stdout | offline | core tests |
| `node core/bin/sources.ts links [--fetch] [--stale-days n]` | check every web source of the suitability and relevance lane files (HEAD, then GET) | before a refresh pass | `data/sources/links.json` | every source host, 500 ms apart per host, user agent `travel-source-check/1.0 (+https://nks-travel.pages.dev/about/)` | core tests |

## Time, light, schedule and the planner

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `node core/bin/sun.ts --lat <lat> --lon <lon> --zone <IANA zone> --date <YYYY-MM-DD> [--date ...] [--json]` | sunrise, sunset, twilights and darkness; longitude positive east | every light window, golden hour or darkness claim | stdout | offline | core tests; `tools/tests/test_sun_scripts.py` pins the legacy scripts to it |
| `node core/bin/schedule.ts --input <file> --day <n> --profile <id> --pace <pace> [--split] [--json]` | print a scheduled day as a table | reviewing authored timeline overrides | stdout | offline | core tests |
| `node core/bin/ops.ts <operation> --input <file\|->` (`--list`) | run one write operation on `data/trips/` | a skill changes a trip | the trip files; every operation returns its inverse | offline | check-all "ops CLI lists the catalogue" |
| `node core/bin/mcp.ts` | the read-only MCP server (registered in `.mcp.json`) | a chat client reads trips and the catalogue | stdio | offline | check-all "mcp server answers initialize" |

## Tracks, legs and geography

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `node web/scripts/tracks-osm.mjs` (`--only`, `--refresh`, `--rebuild`, `--check`, `--source`) | fetch OSM geometry and elevation for every trail with an OSM id | after adding an OSM relation or way id to a trail | `data/tracks/` | Overpass or the OSM API, AWS Terrain Tiles; one request at a time, at least 1 s apart, at most 200 a run, stop after the second 429; holds `/tmp/travel-overpass.lock` | `web/tests/places/tracks-script.test.ts` |
| `node scripts/legs-ors.mjs` (run in `web/`; `--check`, `--list`, `--refetch`, `--env-file`) | road times between consecutive Dolomites places | a missing leg | `data/schedules/legs/dolomites-2027.json` | OpenRouteService with `ORS_API_KEY` (never printed or logged); sequential, at most 28 a minute | `web/tests/trips/timeline.test.ts` |
| `node scripts/globe-cities.mjs` (run in `web/`) | OSM `admin_level=8` boundaries of towns that hold a public place | after new public places | `web/public/globe/data/cities-adm8.json` | Overpass and Nominatim, sequential, inside `/tmp/travel-overpass.lock`; cache in `tools/.cache/cities/` | `web/tests/globe/privacy.test.ts` |
| `python3 tools/globe_data.py <subcommand>` | the globe's country, admin and gazetteer data (`base`, `admin1`, `admin2`, `gazetteer`, `world`, `canada`, `split`, `audit`, `check`, `places`, `all`) | geography changes only; owned by the GLB2 lanes | `web/public/globe/` only (CLN-4; `places` writes the pins through `location_views`, unchanged) | Natural Earth, geoBoundaries, StatCan, Wikidata; cached | `tools/tests/test_globe_data.py` |

## Photos

Commons is one runner for the whole machine. Never run any of these from parallel agents.

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `python3 tools/gallery/gallery_find.py <trip>/gallery/gallery-spec.json` | find gallery candidates and write contact sheets | a legacy page needs a gallery | `/tmp/gal/<trip>/` (cache and sheets) | Commons, one request per query, 6 s apart, cached | - |
| `python3 tools/gallery/gallery_pick.py <trip>/gallery/gallery-picks.json` | turn a person's picks into `gallery.json` | after looking at the contact sheet | `gallery.json` | offline | - |
| `python3 tools/gallery/gallery.py verify\|sheet\|inject` | check licence, size and hotlink; draw a contact sheet; inject the gallery into a legacy page (`inject` is frozen: legacy pages only) | before a gallery is accepted | the page (`inject`, frozen) | Commons, paced, backs off 20 s then 60 s on 429; user agent `nks-travel-gallery/1.0` | - |
| `node web/scripts/fetch-photo-credits.mjs [--list]` | author and licence for every Commons file the public site uses without a credit | after adding photos | `web/data-snapshots/photo-credits.json` | Commons, one request at a time, 2 s apart, stops on 429 | - |
| `node scripts/globe-images.mjs` (run in `web/`) | Wikidata P18 images and their Commons credits for the globe's cards | after new places with a QID | `data/reference/globe/p18.json` | Wikidata one a second; Commons in batches of 50, 2 s apart; holds `/tmp/travel-commons.lock` and gives up if it is held | - |
| `web/scripts/commons-cache.mjs` | shared module: one Commons thumbnail at a time, cached in `web/.og-cache` | imported by `og.mjs` and `images.mjs` in the web build | cache files | Commons, sequential, backs off on 429 | web build |

## User agents

The rule is one: name the project and the public site, never an email or personal data. There is no shared module yet; each
script carries a constant.

| Constant | Where | Value |
|---|---|---|
| `USER_AGENT` | `core/src/relevance/signals.ts` (the reference), `web/scripts/tracks-osm.mjs` | `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)` |
| `UA` | `tools/locations.py`, `tools/globe_data.py`, `web/scripts/fetch-photo-credits.mjs`, `globe-cities.mjs`, `globe-images.mjs` | the same string |
| `LINK_USER_AGENT` | `core/src/sources/links.ts` | `travel-source-check/1.0 (+https://nks-travel.pages.dev/about/)` |
| `UA` | `tools/gallery/gallery.py` | `nks-travel-gallery/1.0 (personal trip planner)` |
| fetch header | `web/scripts/commons-cache.mjs` | `trip-plans-og/1.0 (nks-travel.pages.dev)` |

[capture-contract.md](method/capture-contract.md) 9.3 names `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)` for
crawlers; no script uses it yet.

## Known gaps

- **No general link checker.** `sources.ts links --fetch` checks the sources of the suitability and relevance lane files only.
  `legacy/canadian-rockies-sept-2029/check_links.py` checks one legacy trip and sends a browser user agent; do not reuse it.
- **No shared user-agent module.** Five copies of one string and three other strings (table above).
- **No validator for `capture-points/1`.** `relevance.ts points --build` reads `data/capture/points.json` but nothing checks
  its shape ([formats/README.md](formats/README.md#captured-points)).
- **The legacy sun scripts** (`legacy/*/sun-times.py`, `legacy/iceland-ring-road/dark-times.py`) are fixed and tested, but
  they are per-trip copies. New work uses `core/bin/sun.ts`.

## Adding a script

Put it in its package (`tools/`, `core/bin/` or `web/scripts/`) with a test, give it a `--check` or offline mode where it
writes committed files, follow the rate rules of README section 9, and add one row here.
