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
| `python3 tools/locations.py quick-add <file> [--dry-run] [--source-note TEXT]` | add many places from one `Name, Country[, kind]` per line (`#` comments, blank lines skipped) | a list of names to remember (README 3a step 2) | `data/locations/locations.json`, written once at the end; ambiguous (two candidates within 2 points, even in the same country), not-found and duplicate lines are printed and not written | Wikidata then Nominatim, one request a second, holding `/tmp/travel-wikidata.lock` and `/tmp/travel-nominatim.lock` for the run (flock; gives up after 300 s) | `tools/tests/test_locations_basics.py` |
| `python3 tools/locations.py basics --report [--json]` | every stored place by missing basics layer (identity, image, when, links, and by kind trail, parking, booking; DATA-LOC section 2), worst first, with its page ref and the lane its capture records go to | the brief of the basics batch (D2b) and its before and after counts | stdout (local only: the JSON names page refs; never commit it to a public file) | offline | `tools/tests/test_locations_basics.py` |
| `python3 tools/locations.py edit ID --wikidata Q.. --elevation-m N --image File:..` (`--basis`, `--source URL`), `edit ID --searched-none COLS --tried WHAT` | set a basics column with its provenance in `field_meta` (date, basis, the source row), or record a dated search that found nothing | filling the basics (D2b) | `data/locations/locations.json` | offline | `tools/tests/test_locations_basics.py`; `locations.py validate` checks `field_meta` |

## Capture contract and records

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `node core/bin/capture.ts fields --type <id>` (`--kind`, `--subkind`, `--ref`, `--format json`) | the checklist of a type: R, R?, A per layer, the suitability block, links, sources in order | before the first record of a type; `--ref` for what one record still lacks | stdout | offline | core tests |
| `node core/bin/capture.ts explain <type>` | where each mark comes from | a mark looks wrong | stdout | offline | core tests |
| `node core/bin/capture.ts types [--tree]` | the type tree and its counts | finding a type id | stdout | offline | core tests |
| `node core/bin/capture.ts gaps --trip <trip-id> [--level usable\|complete] [--json]` | per record, the missing required properties | the brief of a gap-filling pass (README 3c) | stdout | offline | core tests |
| `node core/bin/capture.ts gaps --trip catalogue` (also `--placement`, `--tier required`) | the same for the trip-less lane `data/capture/catalogue/`: stored places no trip uses (id: `TRIPLESS_LANE` in `core/src/capture/lane.ts`, DD-8) | after a basics batch (D2b) | stdout | offline | `core/test/capture/tripless-lane.test.ts` |
| `node core/bin/capture.ts derive-area [--check\|--write] [--trip <id>] [--accuracy] [--json]` | set `area_id` on places and routes from the parent, else from the sourced point (nearest labelled point of a locations-store area within 10 km, a clear margin over any other area, the same region and town as the record's `near_town`); never an id the store lacks; lists the points no area reaches as proposals | after new records or points, after `derive-near`, after a new area in the locations store | the `area_id` key of capture records (nothing else changes) and `data/capture/derived-areas.json` (what it wrote and why); `--write` refuses when the hold-out precision is under 95% | offline | check-all "area: every place and route the rule can place has its area_id"; `core/test/capture/derive-area.test.ts` |
| `node core/bin/capture.ts run --check <file>` | validate a `capture-run/1` record | after every crawl or API run | exit code | offline | check-all "validate every data file" |
| `node core/bin/capture.ts build [--check]` | write the generated contract files: `data/schema/capture/*`, the per-domain checklists (`research/types/*`), `data/schema/suitability-applicability.json` | after any change to `data/vocab/types.json` or the property registry | generated files; `--check` exits 1 on drift | offline | check-all "capture contract: generated files match data/vocab/types.json" |
| `node core/bin/validate.ts <file...>` or `--all` | structural and reference validation of every data family | after writing any data file | one line per problem | offline | check-all "validate every data file"; the PostToolUse hook `tools/hooks/data_changed.sh` for trip, catalog and vocab files |
| `node core/bin/normalise.ts --check\|--report\|--write [--family <f>]` (also `--budget --check`, `dupes`, `prose-links`) | bring the research JSON into the storage contract (RIS-N): basis vocabulary, season Vals, `point_source` to `point_src` (points /2), `origin` to `meta.origin`, the Estimate flag, units, dates, names; reports `W_KEEP_UNREAD` and the keep and meta findings; `dupes` lists S2 candidate pairs, `prose-links` checks `RECORDED` markers and `meta.research_ref` | before hand-back of a lane (the researcher runs `--write`); `--check` is read-only | files in place (only the changed values move); stdout | offline | check-all "normaliser budget" (`--budget --check`); `core/test/normalise/` |

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
script carries a constant. A request run by hand (curl, a one-off script) uses
`travel-capture/1.0 (+https://nks-travel.pages.dev/about/)`. `tools/tests/test_user_agents.py` fails when any user-agent
string in the code holds an email address, or a method page asks for a contact in the user agent.

| Constant | Where | Value |
|---|---|---|
| `USER_AGENT` | `core/src/relevance/signals.ts` (the reference), `web/scripts/tracks-osm.mjs` | `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)` |
| `UA` | `tools/locations.py`, `tools/globe_data.py`, `web/scripts/fetch-photo-credits.mjs`, `globe-cities.mjs`, `globe-images.mjs` | the same string |
| `LINK_USER_AGENT` | `core/src/sources/links.ts` | `travel-source-check/1.0 (+https://nks-travel.pages.dev/about/)` |
| `UA` | `tools/gallery/gallery.py` | `nks-travel-gallery/1.0 (personal trip planner)` |
| fetch header | `web/scripts/commons-cache.mjs` | `trip-plans-og/1.0 (nks-travel.pages.dev)` |

[capture-contract.md](method/capture-contract.md) 9.3 names `travel-capture/1.0 (+https://nks-travel.pages.dev/about/)` for
crawlers; no script uses it yet.

## Database: seed and sync

The JSON in git is the seed of record ([local-database-and-seed-sync.md](../docs/v2/features/local-database-and-seed-sync.md)).
The contract and the target guard are built (`core/src/seed/`, LOCAL-C); `db:seed`, `db:sync` and `db:verify` are built for the reference tables (LOCAL-2); the other commands below are **planned, not built**: each row
names the task that adds it. Every command decides its target through the guard before it connects: a loopback target is local;
any other host needs `--target child` or `--target production` (or `--target-kind` with a URL); production writes need
`--approve <sha of HEAD>`, a clean tree and a green child rehearsal of the same commit. No command prints a connection string.

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `pnpm db:up`, `db:down`, `db:reset`, `db:migrate [--target t]`, `db:psql`, `db:url` (planned, LOCAL-1) | the local Docker Postgres 18 with PostGIS on 127.0.0.1:54329; `db:reset` refuses any non-loopback host | local database work | a local database | loopback only (`db:migrate` also child, and production with the guard) | LOCAL-1 tests; `core/test/seed/guard.test.ts` for the guard |
| `pnpm db:seed`, `db:sync [--dry-run] [--target t] [--url u] [--commit sha] [--approve sha] [--json]` (built, LOCAL-2; `core/bin/db-seed.ts`) | build the seed (type_node, tag, relevance_class, area, town, operator, source, and the `seed_commit` stamp in catalogue_meta) from the working tree, or from the files of `--commit`, plan the difference per table and record id, apply it in one transaction under the seed advisory lock; `db:seed` is for an empty catalogue and loopback only | after a data change, to bring a database to a commit | the dry run prints `table +inserts ~updates -retires xdeletes =unchanged` and exits 0 (same), 3 (differs) or 1 (error); a guard refusal exits 2 before any connection | the target database only (default local Docker) | `core/test/catalogue/load-reference.test.ts`, `load-engine.test.ts`, `core/test/db/seed.integration.test.ts` (`pnpm db:test`); plan rules in `core/test/seed/hash-plan-drift.test.ts` |
| `pnpm db:verify [--target t] [--json]` (built, LOCAL-2) | read-only (a read only transaction): row count and table hash per seed table against the seed of the commit | before and after a sync, in the rehearsal | `seed-drift/1`; exit 0 equal, 1 any difference (a row the seed dropped from a kept table is retained, not drift) | the target database, read only | `core/test/catalogue/load-engine.test.ts`, `core/test/db/seed.integration.test.ts` |
| `pnpm db:rehearse` (planned, LOCAL-5; the coordinator runs it) | reset the child from production, delete copied sessions, migrate, sync, verify, run the child suites | before any production migration or sync | `seed-rehearsal/1` evidence under the gitignored tool cache, which the production guard reads | the Neon child branch | `core/test/seed/guard.test.ts` (evidence rules) |

## Tests and the gate

| Script | Job | When | Output | Hosts and rate | Covered by |
|---|---|---|---|---|---|
| `tools/gate.sh --tier 0\|1\|2\|3 [--base main] [--changed paths] [--dry-run] [--json] [--only suite]` | select the suites a change needs from `tools/gate/map.json` and run them cheapest first (usage: [tools/gate/README.md](../tools/gate/README.md)) | T0 in the edit loop, T1 before a hand-back, T2 per stack, T3 at release | at most 40 lines; the full log in `$(git rev-parse --git-dir)/gate-logs/` | offline | `tools/tests/test_gate.py`, `test_gate_map.py` |
| `tools/gate.sh --cache-stats`, `--no-cache`, `--verifier` | the gate's result cache (TS-3): a suite that passed on identical inputs prints CACHED; stats, bypass, the verifier's uncached mode (usage: [tools/gate/README.md](../tools/gate/README.md)) | automatic in T0 to T2; `--cache-stats` to inspect | `<git-common-dir>/gate-cache/` (7 days, passes only) | offline | `tools/tests/test_gate_cache.py` |

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
