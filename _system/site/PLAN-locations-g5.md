# Plan: locations schema v2, list page, G5 saved places on the globe (17 Oct 2026)

Scope: the owner's four pieces (16-17 Oct 2026). A, schema tightening and the per-country split ("items 1 and 2"). B, the grid/list page at `locations/index.html`. C, G5 saved places on the globe. D, consistency: tests, hooks, publish. JSON in git stays the system of record. SQLite/D1 comes later, and only when phone capture is wanted.

Written for Sonnet coding agents. Every path is relative to `/home/nitin27may/workspace/travel` unless absolute. Planned on Opus; the summary of findings is in section 6.

## 0. Decisions taken

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Which tables | `countries`, `regions`, `areas`, `places`, `tags`, `place_tags`, `sources`, `visits`, `collections`, `collection_places` | The five the owner listed, plus the geography tables and two join tables. Without them, region and area names repeat in every place row (they drift; one area is called "Bas-Saint-Laurent / Gaspésie (to confirm)"), tags stay a list inside a row, and collection order is a list inside a row. Each array maps to one CREATE TABLE. |
| D2 | Place ids | Keep the current path ids (`CA/QC/charlevoix/le-buton`). They are fixed once created and never recomputed. A collision gets `-2`, `-3`. | Readable, already used by collections and links, and in git history. Once created the id is just a label: if an `edit --area` changes `area_id`, the id prefix will no longer match, and the validator must not check that it does. |
| D3 | Sources | 1:N. Each source row has exactly one of `place_id` or `collection_id`. | Provenance is per place, and 19 of 20 current sources have `url: null`, so there is nothing to deduplicate on. Moving to M:N later is mechanical (group by url). |
| D4 | Visits | New table, references `place_id`. `status = visited` requires at least one visit. | Status is the planning state; a visit is a dated fact with its own trip. Empty after migration (no place is visited yet). |
| D5 | Tags | `tags` holds the vocabulary (`id`, `label`, `alias_of`); `place_tags` is the join. The tool resolves aliases at write time, so the join only points at canonical tags. | 1NF. Merges waterfall/waterfalls and similar pairs once, as data the owner can extend. |
| D6 | Tag normalisation | slugify; resolve alias; drop a tag equal to the place's own `kind`; drop `location-unconfirmed`. | The kind filter already covers a tag that repeats the kind. A `waterfall` tag on a `trail` stays, because it says something new. |
| D7 | `trip` | Stays a nullable text column on `places` holding a trip folder slug. The validator requires `<slug>/` to exist. Visits carry their own `trip`. | There is no trips table until P2 (`trips.json`). One adopting trip per place covers every current row. A join table can come with P2. |
| D8 | `location_unconfirmed` | Becomes `location_status` in {`resolved`, `unconfirmed`}. The tag is removed. | One field instead of a boolean plus a tag that say the same thing. |
| D9 | `verified` | Renamed `stats_verified`. | It means "the numbers from the post were checked", not "the location is right". |
| D10 | `season` | `season_months`, an array of ints 1-12 (a JSON column). The CLI still takes `--season Sep,Oct`. | Sortable and language-neutral. Pages show abbreviations. |
| D11 | `stats` | Stays a JSON column (object of number or string values). | Keys vary by source. Normalise when a research lane needs it. |
| D12 | Collections | `collections` (id = old slug) plus `collection_places(collection_id, position, place_id)`, PK (collection_id, position). | Ordered, and allows a loop that passes the same place twice. |
| D13 | File format | Top-level object; each array element on its own line as compact JSON; arrays sorted by primary key; keys in schema column order. | One changed row is one changed line in `git diff`, which reads like a table. Hand edits go through `locations.py edit`. |
| D14 | Public fields | Pages get an explicit allow-list: the first line of notes only, http(s) source URLs only, no screenshot or inbox paths, no resolver internals. | nks-travel.pages.dev is publicly reachable, and the list and globe publish this data. Owner to confirm; proceeding with this default. |
| D15 | Dropped places | Hidden by default on both pages; the list shows them when the `dropped` status chip is on; the globe never shows them. | The two pages' counts stay consistent. |
| D16 | Globe to list links | Level 1: `#country=CA`. Levels 2 and 3: `#ids=<place ids>&label=<name>`, computed by point-in-polygon in the page. | Natural Earth ADM1 is provinces in Italy and departments in France, while store regions are regions (risk R1). Name or ISO mapping would be wrong; ids are exact. |

## 1. Schema v2

### 1.1 Root object (`locations/locations.json`)

Key order: `schema_version` (int, 2), `updated` (ISO date), `layout` (`"single"` or `"by-country"`), `parts` (only when by-country: list of ISO2), then `countries`, `regions`, `areas`, `places`, `place_tags`, `tags`, `sources`, `visits`, `collections`, `collection_places`.

The validator rejects unknown top-level keys and unknown columns. Missing nullable columns are written as `null`.

### 1.2 Tables

Types: `text`, `int`, `real`, `bool`, `json`, `date` (ISO `YYYY-MM-DD`), `pdate` (partial ISO: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`). "Null?" means the column may be null.

**countries** (PK `code`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| code | text | no | ISO 3166-1 alpha-2, upper case |
| a3 | text | yes | ISO alpha-3 from `_system/site/countries.json` |
| name | text | no | |

Example: `{"code":"CA","a3":"CAN","name":"Canada"}`

**regions** (PK `id`; unique `country`+`code`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `<country>/<code>`, e.g. `CA/QC`, `IT/campania` |
| country | text | no | FK countries.code |
| code | text | no | ISO 3166-2 suffix in upper case when known (QC), otherwise a slug (campania) |
| name | text | no | |
| iso_3166_2 | text | yes | `CA-QC`; filled when `code` is 1-3 upper-case letters, otherwise null |

Example: `{"id":"CA/QC","country":"CA","code":"QC","name":"Quebec","iso_3166_2":"CA-QC"}`

**areas** (PK `id`; unique `region_id`+`slug`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `<region_id>/<slug>` |
| region_id | text | no | FK regions.id |
| slug | text | no | `[a-z0-9-]+` |
| name | text | no | |

Example: `{"id":"CA/QC/charlevoix","region_id":"CA/QC","slug":"charlevoix","name":"Charlevoix"}`

**places** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | regex `^[A-Z]{2}/[A-Za-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$`; fixed once created |
| area_id | text | no | FK areas.id |
| name | text | no | display name |
| resolved_name | text | yes | label the resolver returned |
| kind | text | no | enum KINDS (unchanged, 19 values) |
| status | text | no | idea, shortlisted, planned, visited, dropped |
| trip | text | yes | slug of an existing top-level trip folder |
| lat | real | yes | -90..90; null together with lon |
| lon | real | yes | -180..180 |
| elevation_m | int | yes | |
| location_status | text | no | `resolved` or `unconfirmed`. Coordinates may be null only when this is `unconfirmed` or kind is `region` |
| resolver | text | no | wikidata, nominatim, manual, none |
| wikidata | text | yes | `^Q\d+$` |
| image | text | yes | https URL |
| season_months | json | no | array of distinct ints 1-12, sorted; `[]` when unknown |
| kid_fit | text | no | yes, strong-kid, no, unknown |
| stats | json | no | object of number or string values; `{}` when none |
| stats_verified | bool | no | |
| notes | text | no | `""` when none |
| added | date | no | |

Example (one line in the file): `{"id":"CA/QC/charlevoix/le-buton","area_id":"CA/QC/charlevoix","name":"Le Buton lookout, Le Massif de Charlevoix","resolved_name":"Le Massif","kind":"viewpoint","status":"idea","trip":null,"lat":47.28,"lon":-70.61,"elevation_m":null,"location_status":"resolved","resolver":"wikidata","wikidata":"Q3224379","image":"https://commons.wikimedia.org/wiki/Special:FilePath/LeMassif.jpg","season_months":[9,10],"kid_fit":"yes","stats":{"km":"about 2 (loop)","minutes":45},"stats_verified":false,"notes":"Signature lookout ...","added":"2026-10-16"}`

**tags** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | slug |
| label | text | no | default: id with hyphens turned into spaces and the first letter capitalised ("Fall colours") |
| alias_of | text | yes | FK tags.id; the target must itself have `alias_of` null |

Examples: `{"id":"fall-colours","label":"Fall colours","alias_of":null}` and `{"id":"waterfalls","label":"Waterfalls","alias_of":"waterfall"}`

Initial aliases: waterfalls → waterfall, lighthouses → lighthouse, gorges → gorge, canyons → canyon, lakes → lake, suspension-bridges → suspension-bridge, mountains → mountain.

**place_tags** (PK `place_id`+`tag_id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| place_id | text | no | FK places.id |
| tag_id | text | no | FK tags.id, must be canonical (`alias_of` null) |

Example: `{"place_id":"CA/QC/charlevoix/le-buton","tag_id":"fall-colours"}`

**sources** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `src-00001`, sequential, assigned once |
| place_id | text | yes | FK places.id; exactly one of place_id or collection_id is set |
| collection_id | text | yes | FK collections.id |
| type | text | no | instagram, facebook, tiktok, youtube, reddit, blog, article, official, guidebook, friend, note |
| url | text | yes | http(s) only |
| note | text | yes | |
| screenshot | text | yes | path under `locations/inbox/` |
| post_date | date | yes | date of the post, when known |
| saved | date | no | date captured |

Example: `{"id":"src-00007","place_id":"CA/QC/charlevoix/le-buton","collection_id":null,"type":"instagram","url":null,"note":"saved post, 15 Oct 2026","screenshot":null,"post_date":"2026-10-15","saved":"2026-10-16"}`

**visits** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | `vis-00001` |
| place_id | text | no | FK places.id |
| date_start | pdate | no | |
| date_end | pdate | yes | not before date_start |
| trip | text | yes | trip folder slug |
| notes | text | no | `""` |

Example: `{"id":"vis-00001","place_id":"US/VT/lamoille-county/stowe","date_start":"2026-10-02","date_end":"2026-10-03","trip":"vermont-fall-2026","notes":""}`

**collections** (PK `id`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| id | text | no | slug (the old `slug`) |
| name | text | no | |
| country | text | yes | FK countries.code; null when the collection spans countries |
| notes | text | no | `""` |
| added | date | no | |

**collection_places** (PK `collection_id`+`position`)

| Column | Type | Null? | Rule |
|---|---|---|---|
| collection_id | text | no | FK collections.id |
| position | int | no | 1..n, contiguous per collection |
| place_id | text | no | FK places.id; may repeat inside one collection |

### 1.3 DDL (new file `_system/tools/locations_schema.sql`, loaded by a test)

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE countries (code TEXT PRIMARY KEY CHECK (length(code) = 2), a3 TEXT, name TEXT NOT NULL);
CREATE TABLE regions (id TEXT PRIMARY KEY, country TEXT NOT NULL REFERENCES countries(code), code TEXT NOT NULL, name TEXT NOT NULL, iso_3166_2 TEXT, UNIQUE (country, code));
CREATE TABLE areas (id TEXT PRIMARY KEY, region_id TEXT NOT NULL REFERENCES regions(id), slug TEXT NOT NULL, name TEXT NOT NULL, UNIQUE (region_id, slug));
CREATE TABLE places (id TEXT PRIMARY KEY, area_id TEXT NOT NULL REFERENCES areas(id), name TEXT NOT NULL, resolved_name TEXT,
  kind TEXT NOT NULL, status TEXT NOT NULL, trip TEXT, lat REAL, lon REAL, elevation_m INTEGER,
  location_status TEXT NOT NULL CHECK (location_status IN ('resolved','unconfirmed')), resolver TEXT NOT NULL,
  wikidata TEXT, image TEXT, season_months TEXT NOT NULL CHECK (json_valid(season_months)), kid_fit TEXT NOT NULL,
  stats TEXT NOT NULL CHECK (json_valid(stats)), stats_verified INTEGER NOT NULL, notes TEXT NOT NULL, added TEXT NOT NULL,
  CHECK ((lat IS NULL) = (lon IS NULL)));
CREATE TABLE tags (id TEXT PRIMARY KEY, label TEXT NOT NULL, alias_of TEXT REFERENCES tags(id));
CREATE TABLE place_tags (place_id TEXT NOT NULL REFERENCES places(id), tag_id TEXT NOT NULL REFERENCES tags(id), PRIMARY KEY (place_id, tag_id));
CREATE TABLE collections (id TEXT PRIMARY KEY, name TEXT NOT NULL, country TEXT REFERENCES countries(code), notes TEXT NOT NULL, added TEXT NOT NULL);
CREATE TABLE collection_places (collection_id TEXT NOT NULL REFERENCES collections(id), position INTEGER NOT NULL CHECK (position >= 1),
  place_id TEXT NOT NULL REFERENCES places(id), PRIMARY KEY (collection_id, position));
CREATE TABLE sources (id TEXT PRIMARY KEY, place_id TEXT REFERENCES places(id), collection_id TEXT REFERENCES collections(id),
  type TEXT NOT NULL, url TEXT, note TEXT, screenshot TEXT, post_date TEXT, saved TEXT NOT NULL,
  CHECK ((place_id IS NULL) <> (collection_id IS NULL)));
CREATE TABLE visits (id TEXT PRIMARY KEY, place_id TEXT NOT NULL REFERENCES places(id), date_start TEXT NOT NULL, date_end TEXT, trip TEXT, notes TEXT NOT NULL);
```

If the local SQLite has no JSON1 (`select json_valid('[]')` fails), the test strips the `json_valid` checks and still runs.

### 1.4 Migration v1 to v2 (`_system/tools/migrate_locations_v2.py`)

The core is a pure function `migrate(v1: dict) -> dict`. CLI: `--check` prints a summary and writes nothing; with no flag it writes in place through `locations.save()`. If `schema_version == 2` already, it prints "already v2" and exits 0. Before migrating, A1 freezes the current file as a test fixture: `git -C /home/nitin27may/workspace/travel show HEAD:locations/locations.json > _system/tests/fixtures/locations-v1.json`.

| v1 field | v2 destination | Rule |
|---|---|---|
| `version: 1` | `schema_version: 2` | |
| `updated` | `updated` | unchanged (ISO already) |
| `countries` {code: name} | `countries` rows | `a3` from `_system/site/countries.json` (a2 to a3) |
| place `country`, `region`, `region_name` | `regions` row `id = country/region` | name = most common `region_name` across places for that id; `iso_3166_2 = country-region` when region matches `^[A-Z]{1,3}$` |
| place `area`, `area_name` | `areas` row `id = country/region/area` | name = most common `area_name`; log any conflict |
| place `id` | `places.id` | unchanged |
| (derived) | `places.area_id` | `country/region/area` |
| `name`, `resolved_name`, `kind`, `status`, `trip`, `lat`, `lon`, `elevation_m`, `wikidata`, `image`, `kid_fit`, `stats`, `notes`, `added`, `resolver` | same names | unchanged |
| `country_name`, `region_name`, `area_name`, `country`, `region`, `area` | removed from places | live in the geography tables |
| `verified` | `stats_verified` | |
| `location_unconfirmed: true`, or tag `location-unconfirmed` | `location_status: "unconfirmed"` | otherwise `"resolved"` |
| `season` ["Sep","Oct"] or null | `season_months` [9,10] or [] | |
| `tags` [..] | `place_tags` rows plus `tags` vocabulary | slugify, resolve alias, drop tag == kind, drop `location-unconfirmed` |
| place `sources[]` | `sources` rows, `place_id` set | ids `src-NNNNN` in order of place id, then position; `saved` kept; `post_date` parsed from `note` with `\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\b`; `note` text kept |
| collection `slug` | `collections.id` | |
| collection `name`, `country`, `notes`, `added` | same | |
| collection `places` [ids] | `collection_places` rows | position = index + 1 |
| collection `sources[]` | `sources` rows, `collection_id` set | `saved` = collection `added` when missing; numbered after the place sources |
| (new) | `visits: []`, `layout: "single"` | |

Expected counts on the current store: 63 places, 6 countries, 23 regions, 51 areas, 4 collections, 38 collection_places (assert against the fixture rather than this number), 24 sources (20 + 4), 0 visits.

### 1.5 CLI changes (`_system/tools/locations.py`)

All current flags keep working.

| Command | Change |
|---|---|
| `add NAME` | Same flags (`--country --region --area --kind --tags --season --kid --stats --note --source --source-type --status --pick --force --offline`). New: `--lat --lon` (sets `resolver manual`, which the validator message already promises), `--trip`, `--unconfirmed`, `--screenshot PATH`, `--source-note TEXT`, `--display-name`, `--alias`. Creates any missing country, region and area rows. |
| `import FILE` | The batch spec format is unchanged (inbox files stay valid). Spec keys gain `lat`, `lon`, `trip`, `unconfirmed`. Each source in a spec may carry `screenshot`, `note`, `post_date`. |
| `collection add` | Same flags; `--slug` becomes `collections.id`; `--places` accepts ids or names (as import already does). |
| `edit ID` (new) | `--name --kind --status --kid --season --trip SLUG|--no-trip --area NAME --tags-add a,b --tags-remove a --note TEXT --note-append TEXT --stats JSON` (merged into the existing stats), `--lat --lon --unconfirmed|--confirmed --source URL --source-type T --source-note TEXT --screenshot PATH`. Replaces "merge by editing the JSON" in the skill. |
| `visit add ID --date PDATE [--end PDATE] [--trip SLUG] [--note]` (new) | Adds a visit and sets status to visited. |
| `tag alias ALIAS CANONICAL`, `tag list` (new) | Vocabulary upkeep; `alias` re-points existing place_tags. |
| `validate` | v2 rules: every check in 1.2, foreign keys, enums, ISO dates, unique keys, contiguous positions, visited needs a visit, trip folder exists. A v1 file fails with "run migrate_locations_v2.py". Warns (does not fail) when layout is single and places > 300. |
| `build [--check]` (new) | Writes WISHLIST.md, `locations/index.html` and `globe/assets/data/places.json`. `--check` writes nothing and exits 1 if any output differs from what it would write. |
| `render` | Alias of `build`, so older calls keep working. |
| `list` | Same flags plus `--status`, `--tag`. |
| `layout split|single` (A2) | See section 3, A2. |

Exit codes unchanged: 0 ok, 1 error or duplicate, 2 ambiguous.

Internals:
- `Paths(root)` dataclass with `store`, `wishlist`, `list_page`, `globe_places`, `template`, `css`, `trips_root`. The module-level `PATHS = Paths(Path(os.environ.get("LOCATIONS_ROOT", ROOT)))`. Tests use `monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))`; never assign module globals directly (risk R13).
- `Index(data)`: dicts `country`, `region`, `area`, `place`, `tags_of[place_id]`, `sources_of[place_id]`, `stops_of[collection_id]`, built once per load.
- `save(data)`: sort, dump in the D13 format, then `location_views.write_all(data)`.

## 2. Views and the build pipeline

### 2.1 One module, one command

`_system/tools/location_views.py` (owned by A1; stdlib only):

| Function | Output |
|---|---|
| `view(data) -> dict` | the list-page contract `locations-view/1` (2.2) |
| `globe_places(data) -> dict` | the globe contract `globe-places/1` (2.3), built from `view()` rows so the two pages cannot disagree |
| `wishlist_md(data) -> str` | WISHLIST.md (moved from locations.py; same layout as today, labels from the joins) |
| `list_page_html(data) -> str or None` | reads template `_system/site/locations.html` and `_system/site/site.css`; replaces `/*__SITE_CSS__*/` with the CSS, `__BUILT__` with `data["updated"]` (never the clock), `__SITE_DATA__` with `json.dumps(view, ensure_ascii=False, separators=(",",":")).replace("</", "<\\/")`; returns None if the template is missing |
| `render_all(data) -> dict[Path, bytes]` | all three outputs in memory |
| `write_all(data)` | writes only files whose bytes changed |

The build is deterministic: the same store gives the same bytes, so hook runs never leave diffs in git. Cost is under 200 ms with no network.

| Trigger | What runs |
|---|---|
| Any CLI write (`add`, `import`, `edit`, `collection`, `visit`, `tag`, `layout`) | `save()` → `write_all()` |
| A Claude Write/Edit on `locations/locations.json`, `locations/[A-Z][A-Z].json`, `_system/site/locations.html`, `_system/site/site.css` | hook `_system/tools/hooks/locations_changed.sh`: `validate` (exit 2 with errors on failure), then `build` (exit 2 if build fails) |
| `globe_data.py places` (C2) | same `write_all()`; also part of `globe_data.py all` |
| `./publish.sh` (C2) | runs `locations.py build` before staging; fails the publish on a non-zero exit |
| Pre-publish hook | pytest, including the freshness test that compares `render_all()` to the committed files |

Heavy steps (`globe_data.py base/admin1/admin2/gazetteer`, mapshaper) never run from a hook.

### 2.2 `locations-view/1` (embedded in `locations/index.html`)

```json
{"schema":"locations-view/1","updated":"2026-10-17",
 "countries":{"CA":"Canada"},
 "tags":{"fall-colours":"Fall colours"},
 "places":[{"id","name","kind","status","kid_fit","season":["Sep","Oct"],
   "country":"CA","country_name","country_a3":"CAN","region":"QC","region_name","region_iso":"CA-QC",
   "area":"charlevoix","area_name","lat","lon","elevation_m","wikidata","image",
   "tags":["fall-colours"],"stats":{},"stats_verified":false,
   "note":"<first line of notes, at most 280 chars>","links":[{"type":"official","url":"https://..."}],
   "trip":"slug or null","trip_url":"../slug/ when <slug>/index.html exists, else null",
   "location_status":"resolved","collections":["quebec-gaspesie-road-trip"],"added":"2026-10-16"}],
 "collections":[{"id","name","country","notes","stops":["place ids in order"],"links":[...]}]}
```

Allow-list (D14): `links` only include sources whose url starts with `http://` or `https://`. No `screenshot`, no `resolver`, no notes past the first line, no source `note`.

### 2.3 `globe-places/1` (`globe/assets/data/places.json`)

```json
{"schema":"globe-places/1","updated":"2026-10-17","count":63,
 "places":[{"id","name","kind","status","country","country_a3","region_name","area_name",
            "lat","lon","note","links","wikidata","trip","trip_url","location_status"}]}
```

Dropped places are excluded. Places without coordinates are included with `lat`/`lon` null: they count at country level and get no pin.

### 2.4 URL hash parameters (no collisions)

| Page | Param | Meaning |
|---|---|---|
| globe | `c` | ISO alpha-3 (existing) |
| globe | `s`, `d` | state and district name (existing). C1 also accepts the ADM1 `properties.iso` for `s` |
| globe | `p` (new) | place id: drill to the place's country, then the state and district containing it, fly to it, open its card |
| globe (query) | `style`, `spin`, `terrain` (existing), `pins=0` (new) | |
| list | `q`, `country` (ISO2), `region` (code, name or ISO 3166-2, any case), `area` (slug or name), `kind` (csv), `status` (csv), `kid`, `tag` | filters |
| list | `view` | `grid` (default) or `list` |
| list | `ids` (csv of place ids), `label` | a set handed over from the globe; shown as a removable chip "From the globe: <label>" |
| list | `focus` | scroll to and highlight one card; replaces in-page anchors (R8) |

Cross links:

| From | To |
|---|---|
| List card | `../globe/#c=<country_a3>&p=<encoded id>` (only when the place has coordinates) |
| List toolbar | `../globe/#c=<A3>` when exactly one country is selected, else `../globe/` |
| Globe, level 0 | `../locations/` |
| Globe, level 1 | `../locations/#country=<a2>` |
| Globe, levels 2-3 | `../locations/#ids=<ids>&label=<name>` |
| Globe card | "In the list": `../locations/#focus=<id>` |

## 3. Phases

### A1. Schema v2, migration, tool, views, skill, hook (runs first, alone)

Owns:
- `_system/tools/locations.py`
- `_system/tools/location_views.py` (new)
- `_system/tools/locations_schema.sql` (new)
- `_system/tools/migrate_locations_v2.py` (new)
- `locations/locations.json`
- `locations/WISHLIST.md`
- `locations/README.md` (schema, commands, views, generated files)
- `.claude/skills/location/SKILL.md`
- `_system/tools/hooks/locations_changed.sh`
- `_system/tests/test_locations.py` (rewrite)
- `_system/tests/test_migrate_v2.py`
- `_system/tests/test_schema_sqlite.py`
- `_system/tests/test_location_views.py`
- `_system/tests/fixtures/locations-v1.json`
- the first generated `globe/assets/data/places.json`; `locations/index.html` only if the draft template already builds

Steps:
1. Freeze the fixture (1.4).
2. Write `migrate()` and its tests.
3. Refactor `locations.py` to v2: Paths, Index, validate, add, import, edit, visit, tag, build. Move render into `location_views.py`.
4. Run the migration on the real store.
5. Update the skill: step 5 uses `edit`; step 6 uses `--screenshot`; add `visit add` and `build`; commit prefix `locations:`; add a line that the trip-planner adopts a place with `edit ID --trip SLUG --status planned`.
6. Update the hook path match and make it call `build`.

Acceptance:
- `validate` prints ok on the migrated store.
- Every v1 id is present.
- `chute-du-grand-sault` has `location_status: unconfirmed` and no such tag.
- `season_months` are ints.
- 24 sources with sequential ids; `post_date` 2026-10-15 on the "saved post, 15 Oct 2026" rows.
- Migrating twice is a no-op.
- The SQLite load passes with `PRAGMA foreign_key_check` empty.
- `build` twice gives identical bytes.
- The skill's exact example command parses under `--offline` against a tmp root.
- WISHLIST.md keeps the same headings and place lines; only tags and labels change.

Tests to add:
- migrate invariants and idempotency
- validate catches each rule (bad FK, two source owners, visited without a visit, bad pdate, lat without lon, unknown column, alias pointing at an alias, missing trip folder)
- tag normalisation (alias, plural, kind drop)
- `edit` merges stats, notes and sources
- `visit add` sets status
- `add --lat --lon` sets resolver manual
- view contract keys exactly as in 2.2
- note is the first line only
- links are http(s) only
- `trip_url` only when `<slug>/index.html` exists in the tmp root
- `</script` is escaped
- no "inbox/" or "screenshot" text in outputs
- determinism

Verify:
```bash
python3 /home/nitin27may/workspace/travel/_system/tools/migrate_locations_v2.py --check
python3 /home/nitin27may/workspace/travel/_system/tools/migrate_locations_v2.py
python3 /home/nitin27may/workspace/travel/_system/tools/locations.py validate
python3 /home/nitin27may/workspace/travel/_system/tools/locations.py build && python3 /home/nitin27may/workspace/travel/_system/tools/locations.py build --check
LOCATIONS_ROOT=$(mktemp -d) python3 /home/nitin27may/workspace/travel/_system/tools/locations.py add "Mont du Dôme" --country CA --region QC --area "Zec des Martres" --kind trail --offline
python3 -m pytest /home/nitin27may/workspace/travel/_system/tests -q
git -C /home/nitin27may/workspace/travel diff --stat
```

The `LOCATIONS_ROOT` run needs a minimal empty v2 store; `load()` creates one when the file is absent.

### A2. Per-country split (after A1; parallel with B1 and C1)

Owns: the load/save IO section of `_system/tools/locations.py`, the `layout` subcommand, `_system/tests/test_locations_split.py`, and the "Split layout" section of `locations/README.md`.

Design:
- Root file keeps: `schema_version`, `updated`, `layout: "by-country"`, `parts` (sorted ISO2), `countries`, `tags`, `collections`, `collection_places`, and sources owned by collections.
- Each `locations/<CC>.json` holds: `schema_version`, `country`, and that country's `regions`, `areas`, `places`, `place_tags`, place-owned `sources`, and `visits`. Same row format.
- `load()` merges the parts by concatenating arrays, and raises if a part holds a row from another country or a part listed in `parts` is missing.
- `save()` routes each row: region by `country`; area by its region; place by its area; place_tags, sources and visits by their place.
- `layout split` and `layout single` convert. Split is never automatic; `validate` only warns above 300 places.

Acceptance:
- single → split → single is byte-identical.
- With the store split, `validate`, `build` and every A1 test pass.
- The hook matches `locations/[A-Z][A-Z].json`; A1 already put that in the case pattern.
- The committed store stays single.

Verify: `python3 -m pytest /home/nitin27may/workspace/travel/_system/tests -q`, plus a round trip in a tmp `LOCATIONS_ROOT`.

### B1. List page (after A1; parallel with A2 and C1)

Owns: `_system/site/locations.html` (the template), `_system/site/site.css`, the generated `locations/index.html`, and `_system/tests/test_list_page.py`.

Reuse the draft. Changes:
1. Read the 2.2 contract. Field names are the same as the draft except `season` (now abbreviations), `note` (was `notes`) and `links` (was `sources`).
2. Grid/list toggle (`view` param, also remembered in localStorage `locations-prefs`; the hash wins). List view is a table: Name, Kind, Status, Area, Region, Season, Kids, Links.
3. Fix the globe links (2.4). Add the `ids`, `label` and `focus` params.
4. Hide dropped places unless the `dropped` status chip is on.
5. Region select matches code, name or ISO.
6. Tags: top 40 with n ≥ 2 plus a "show all tags" toggle.
7. Collections section: stops are buttons that set `focus`. Show a collection only when at least one stop is visible; "Open first stop on the globe".
8. Chips and toggles get `aria-pressed`; the count gets `aria-live="polite"`.
9. Under 900px the rail collapses into a `<details>` labelled "Filters (n active)".
10. `window.__lst = () => ({count, view, state})` for probes.
11. No external scripts.
12. Optional: lazy Commons thumbnail on grid cards (`image + '?width=400'`).

Acceptance:
- `locations/index.html` is built only by `locations.py build`.
- It opens over `file://` with no fetch.
- `#country=CA&region=QC` shows 21 places grouped under Quebec areas.
- `#view=list` shows the table.
- A chip never leads to zero results (facet counts ignore their own filter).
- The hash round-trips after reload.
- Card links: globe link carries `c=CAN` and `p=`; trip link `../<slug>/`.
- Page size under 1 MB at the current store.

Tests:
- placeholders gone
- embedded JSON parses and equals `location_views.view(load())`
- `node --check` on the extracted inline script (skip if `node` is missing)
- no `<script src=`
- every hash param name in 2.4 appears in the script
- the globe link pattern `../globe/#c=` is present

Verify:
```bash
python3 /home/nitin27may/workspace/travel/_system/tools/locations.py build
python3 -m pytest /home/nitin27may/workspace/travel/_system/tests/test_list_page.py -q
```

Then a short Playwright probe: navigate to `file:///home/nitin27may/workspace/travel/locations/index.html#country=CA&region=QC`, evaluate `window.__lst().count`, click the list toggle, evaluate `location.hash`. Three calls, then close the browser.

### C1. Globe pins, counts, card, "Plan these" (after A1; parallel with A2 and B1)

Owns: `globe/index.html`, `_system/tests/test_globe_data.py` (extend), `_system/tests/test_globe_page.py` (new).

Changes in `globe/index.html`:
1. Load the data. Add `fetch('assets/data/places.json').then(r => r.ok ? r.json() : {places: []}).catch(() => ({places: []}))` to the initial `Promise.all`, so a missing file cannot break the page (R4).
2. Build the GeoJSON once. Use places with coordinates. Give each feature a numeric `id` equal to its index; properties `pid`, `status`, `a3`, `name`.
3. In `style.load`, after every other layer:
   - source `pins` (geojson)
   - layer `pins` (circle): colour `['match', ['get','status'], ['planned','visited'], '#2a9a9e', '#d69329']`; radius interpolated by zoom 1 → 3.5, 5 → 5, 10 → 7; stroke `#0f1b15` 1.5; hollow (opacity 0, amber stroke) when `location_status` is unconfirmed
   - layer `pin-sel` (circle ring `#ffd27a`, filtered to the selected pid)
   - optional `pin-label` symbol layer at minzoom 8 using `labelFont`

   `restoreAfterStyle` re-applies visibility, focus opacity and the selection filter.
4. Pin hit-testing. `pinHit(point)` queries a 6px box on `['pins']` when the layer is visible. The generic mousemove/click and all six admin `country-fill`/`adm1-fill`/`adm2-fill` mousemove and click handlers return early on a pin hit (R2). The pin tooltip sets `state.tipOwner = 'pin'` and reads "kind · status", the name, and "area · region". Hovering a pin pauses rotation.
5. Click a pin: `openPlace(pid)`. It sets `state.place` and clears `state.feature` (the two are mutually exclusive), renders the card in `#feature` with the existing `.feat` styles, then drills via `drillToPoint(a3, [lon, lat])`: `await selectCountry`, find the ADM1 feature containing the point (bbox prefilter, then `inFeature`), `await selectState`, find the containing district, `selectDistrict`, then `flyTo` the point at zoom ≥ 10. Change the internal `selectState(i, opts)` call inside `selectCountry` to be awaited, so callers stop polling (the `goTo` city branch polls today).

   Card contents: kind · status eyebrow; name; area · region · country; note; links (each source by type, Wikidata, Map, Trip plan when `trip_url`, "In the list"); "Fly here"; a close button.
6. Counts:
   - Country: from `places` by `country` (ISO2) through `FACTS[ccn3].a2`, so dropped places and places without coordinates behave as on the list page.
   - State: after `loadAdmin(adm1)` in `selectCountry`, set `f.properties.n` by point-in-polygon before `setData`. Properties survive into rendered features; ad-hoc fields like `_n` do not.
   - District: the same, on `state.adm2` in `selectState`.
   - Tooltips: country "· N saved"; state and district "N saved places".
   - Panel lists: each `.item` shows its count; level 0 gets a "Saved places" block listing countries with counts above the region lists; level 3 lists the district's saved places above the towns.
   - Places inside no polygon are shown as "N not inside a mapped state" (R6). Places without coordinates as "N without coordinates".
7. "Plan these" button in `#actions`, per 2.4. Show the count; when the count is 0, show muted text instead of the button.
8. Pins toggle button `#pinsBtn`, saved in `globe-prefs.pinsOn`; `?pins=0` overrides.
9. Focus: at level ≥ 1, set `circle-opacity` to 1 for the selected country's pins (`a3`) and 0.35 for others, in `applyPinFocus()`, called from `selectCountry`, `backTo` and `restoreAfterStyle`.
10. Hash: `writeHash` adds `p` while a card is open; `readHash` handles `p` (look up the place, then `openPlace`); `s` matches `properties.name` or `properties.iso`.
11. Nav gets a `../locations/` link ("Locations", between Trips and Globe).
12. `window.__dbg` adds `pins` (feature count), `pinsOn`, `place` (pid) and `counts` (`{country, state, district}`).

Acceptance:
- 62 pins (63 places minus the one without coordinates).
- `#c=CAN&p=CA%2FAB%2Fbanff-national-park%2Flake-louise` ends at level 3 with that card open.
- Canada's tooltip and panel say 22 saved (21 Quebec + 1 Alberta).
- Clicking a pin never also selects the country underneath.
- Changing style keeps pins, card and toggle.
- The toggle hides pins and survives a reload.
- "Plan these" on Quebec carries the Quebec ids.
- The page still works when `places.json` returns 404.

Tests:
- `places.json` exists, `schema == globe-places/1`, ids unique, coordinates in range or both null, no dropped status, count equals the non-dropped places in the store
- the page references `assets/data/places.json`, contains layer ids `pins` and `pin-sel`, `#pinsBtn`, `../locations/`, and parses `p`
- `node --check` on the module script, written to `tmp_path/globe.mjs` (top-level await is valid ESM)

Verify:
```bash
python3 -m pytest /home/nitin27may/workspace/travel/_system/tests -q
python3 -m http.server 8765 -d /home/nitin27may/workspace/travel
```

Run the server in the background (so `../locations/` resolves) and stop it afterwards. Probe `http://localhost:8765/globe/#c=CAN&p=CA%2FAB%2Fbanff-national-park%2Flake-louise`: wait 5 s, evaluate `__dbg()`, close. At most three Playwright calls. Visual QA is the owner's.

### C2. Pipeline, hub, docs (after A1, B1, C1)

Owns: `publish.sh`, `_system/tools/globe_data.py`, `_system/tools/hooks/prepublish.sh` (only if needed), `_system/tests/test_site_outputs.py`, `CLAUDE.md`, `_system/site/GLOBE-RESEARCH.md`, `AUDIT-2026-10-16.md`.

Changes:
1. publish.sh: `python3 "$ROOT/_system/tools/locations.py" build` after `set -euo pipefail`.
2. publish.sh: `PUBLISH_DRY_RUN=1` stops after the hub is written (skips wrangler), for verification.
3. Hub lede gets a second link under the globe line: `<a href="locations/">Browse the locations list</a> &mdash; every saved place by country, region and area, with filters and a link to the globe.`
4. `globe_data.py places` subcommand, included in `all`.
5. Tests:
   - freshness: `render_all(load())` equals the committed bytes
   - privacy: generated outputs contain no `inbox/`, no `screenshot`, no `javascript:`
   - `locations/assets` does not exist
   - `locations/index.html` and `globe/index.html` link to each other
6. Docs:
   - CLAUDE.md locations paragraph: schema v2, `build`, `edit`, the two views
   - GLOBE-RESEARCH section 8: G5 row; section 9: the draft is now the template
   - AUDIT change log: P5 list page and G5

Acceptance:
- `PUBLISH_DRY_RUN=1 ./publish.sh` stages `locations/index.html` and nothing else under `/locations/`.
- The hub shows both links.
- The full suite is green.
- `git status` is clean after a build.
- Publishing waits for the owner's visual QA in a real browser.

Verify:
```bash
PUBLISH_DRY_RUN=1 /home/nitin27may/workspace/travel/publish.sh && find /home/nitin27may/workspace/travel/.site/locations
python3 -m pytest /home/nitin27may/workspace/travel/_system/tests -q
```

## 4. Order of execution and parallelism

| Step | Phases | Notes |
|---|---|---|
| 1 | A1 | Alone. Defines the contracts in 2.2 and 2.3 and the first generated outputs. |
| 2 | A2, B1, C1 in parallel | Their files do not overlap (table below). The hook rebuilds every output on any store or template write; that is safe because the build is deterministic. |
| 3 | C2 | Integration, docs, dry-run publish. |

Rules for parallel agents in one checkout:
- Commit only the paths you own: `git -C /home/nitin27may/workspace/travel add <paths>`, then `git -C /home/nitin27may/workspace/travel commit -m "..."`. Never `git add -A`.
- If `.git/index.lock` exists, wait a few seconds and retry.
- Push after each phase: `git -C /home/nitin27may/workspace/travel pull --rebase && git -C /home/nitin27may/workspace/travel push`.
- Run your own test file while working and the full suite before committing. A failure in a file you do not own is reported, not fixed.
- Commit messages: `locations: schema v2 ...`, `locations: list page ...`, `globe G5: ...`. End each with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## 5. File ownership

| File | A1 | A2 | B1 | C1 | C2 |
|---|---|---|---|---|---|
| `_system/tools/locations.py` | own | IO section and `layout` only | | | |
| `_system/tools/location_views.py` | own | | | | |
| `_system/tools/locations_schema.sql`, `migrate_locations_v2.py` | own | | | | |
| `locations/locations.json`, `locations/WISHLIST.md` | own | | | | |
| `locations/README.md` | own | Split section | | | |
| `.claude/skills/location/SKILL.md` | own | | | | |
| `_system/tools/hooks/locations_changed.sh` | own | | | | |
| `_system/tests/test_locations.py`, `test_migrate_v2.py`, `test_schema_sqlite.py`, `test_location_views.py`, `fixtures/` | own | | | | |
| `_system/tests/test_locations_split.py` | | own | | | |
| `_system/site/locations.html`, `_system/site/site.css`, `locations/index.html` | first build only | | own | | |
| `_system/tests/test_list_page.py` | | | own | | |
| `globe/index.html`, `_system/tests/test_globe_data.py`, `_system/tests/test_globe_page.py` | | | | own | |
| `globe/assets/data/places.json` | first build | | | commits rebuilds | |
| `publish.sh`, `_system/tools/globe_data.py`, `_system/tools/hooks/prepublish.sh`, `_system/tests/test_site_outputs.py` | | | | | own |
| `CLAUDE.md`, `_system/site/GLOBE-RESEARCH.md`, `AUDIT-2026-10-16.md` | | | | | own |

## 6. Risks and gotchas

| # | Finding | Handling |
|---|---|---|
| R1 | Natural Earth ADM1 is provinces in Italy (110) and departments in France; store regions (campania, provence-alpes-cote-d-azur) are the NE `region` grouping. geoBoundaries ITA ADM2 has only 20 features, which look like regions, so Italy's district level is inverted today and the centroid filter in `selectState` returns almost nothing. | "Plan these" uses ids (D16). C1 must render an empty district list cleanly. Log the Italy data issue in GLOBE-RESEARCH; it is not fixed in G5. |
| R2 | The per-layer `country-fill`/`adm1-fill`/`adm2-fill` handlers fire under a pin, so a pin click would also select the country or state. | `pinHit()` guard in all six handlers and in the generic ones. |
| R3 | A style switch rebuilds the style from scratch. | Add the pins source and layers inside `style.load`; re-apply in `restoreAfterStyle`. |
| R4 | The top-level `Promise.all` rejects if any one fetch fails, which blanks the page. | `.catch` on the `places.json` fetch. |
| R5 | One place has no coordinates (`chute-du-grand-sault`). | No pin, no polygon count; counted at country level; panel shows "N without coordinates". |
| R6 | Coastal and lake points fall outside simplified polygons (Stansbury Island, La Martre lighthouse, Ha Long Bay). | Show the remainder line; never assume the state counts add up to the country count. |
| R7 | The draft list page links to `../globe/#country=..&focus=..`, which the globe ignores. The globe's `c` is ISO3, the list's `country` is ISO2. Globe `writeHash` drops unknown params. | Contract 2.4; `country_a3` in the view; `p` added to globe `writeHash`. |
| R8 | In-page `#anchor` links on the list page would overwrite the filter hash. | `focus` param plus `scrollIntoView`. |
| R9 | `__BUILT__` filled with the clock would change `locations/index.html` on every hook run. | Use the store's `updated`; determinism test. |
| R10 | A note containing `</script>` would break the embedded JSON. | Escape `</`; test. |
| R11 | pages.dev is public; the list and globe now publish notes and source links. | Allow-list (D14); privacy test; owner confirms. |
| R12 | The validator tells users to "add --lat/--lon", but `add` has no such flags. | A1 adds them. |
| R13 | The existing render test assigns `D.WISHLIST` globally and never restores it. | `Paths` plus `monkeypatch` everywhere. |
| R14 | The PostToolUse hook only sees Claude Write/Edit, not Bash writes. | `save()` builds; the freshness test before publish catches the rest. |
| R15 | Path ids encode the hierarchy and are fixed, so after an area edit the id prefix differs from `area_id`. | Documented; the validator checks the id format only. |
| R16 | publish.sh publishes any top-level folder with `index.html`, so `locations/` goes live once the page exists. | Allow-list copy keeps `locations.json` and `inbox/` private; a test asserts there is no `locations/assets`. |
| R17 | Headless Chromium does not render the basemap vector tiles. | Probe `__dbg()` and `__lst()` state, not pixels; keep probes to 3 calls; run `http.server` in the background and stop it. |
| R18 | Overlapping pins at world zoom (21 in Quebec). | Small zoom-scaled radius. Clustering waits until more than 300 places, the same threshold as the split. |
| R19 | Source URLs go into `href`. | Export http(s) only. |
| R20 | SQLite builds without JSON1. | The test strips `json_valid` checks when unavailable. |
| R21 | `test_page_references_only_files_that_exist` will require `globe/assets/data/places.json`. | A1 commits the first build before C1 starts. |
| R22 | Parallel agents in one checkout. | Path-limited commits, index.lock retry, no cross-phase fixes (section 4). |
