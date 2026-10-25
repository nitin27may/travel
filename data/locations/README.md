# Locations: the laundry list

Every place we might go, as data. One store, one copy, every view generated from it.

| Path | What |
|---|---|
| `locations.json` | The store (schema v3). One array per table, one row per line. Edit through the tool, not by hand. |
| `../vocab/tags.json` | The shared tag vocabulary (`id`, `label`, `kind`, `alias_of`), shared with trips and the catalog. `kind` is `style`, `activity`, `feature`, `audience` or `free`. |
| `WISHLIST.md` | Generated tree: country > region > area > place, then collections. |
| `../../legacy/locations/index.html` | Generated list page (grid and list, filters). Published at `/locations/`. Exists once the page template reads the `locations-view/1` contract. |
| `../../legacy/globe/assets/data/places.json` | Generated places for the globe (`globe-places/1`). |
| `../../research/inbox/` | Raw captures: screenshots of saved posts, batch files for `import`. Never published. |
| `page-keys.json` | PRIVATE (store.ts A24). Each place page with no capture record (`loc:<id>` here, `proto:<id>` for the old prototype) -> its public ref `place/<slug>`. Written only by `node core/bin/slugs.ts build`, `reorigin` and `migrate-origins`; read only by the dataset builder. Never served or published, and never copied into `data/catalogue/slugs.json`. When a place's `id` changes, run `node core/bin/slugs.ts reorigin loc:<old id> loc:<new id>` so its page keeps its ref and slug. |

Do not edit the generated files. `python3 tools/locations.py build` rewrites them, and
`build --check` exits 1 if any of them differs from what the store would produce. The build is
deterministic (the stamp is the store's own `updated` date), so a rebuild never leaves a stray diff.
Every CLI write and the PostToolUse hook run it for you.

## Hierarchy

```
country   CA                               ISO 3166-1 alpha-2
  region  CA/QC                            province or state, ISO 3166-2 suffix when known
    area  CA/QC/charlevoix                 park, valley, resort, lake district or town the place sits in
      place CA/QC/charlevoix/mont-du-dome  trail, viewpoint, waterfall, lake, town, activity
```

A collection (road trip, multi-stop idea) is an ordered list of place ids, so a 14-stop post is 14
findable places plus one route.

## Schema v3

Places carry the catalog common block (plan 2.3A): `name_lang`, the age, height and weight limits, `house_grade`,
`walk_km`, `walk_gain_m`, `duration_min`, `accessibility`, `cost_ref`, `review_status` (default `proposed`),
`confidence` (`stated`), `field_meta`, `verified_by`, `last_verified`, `contributed_by` (`["u_owner"]`), `licence`
(`own-words`), `merged_from` and `updated`. `add` and `edit` stamp `updated` and add `u_owner` to `contributed_by`.
`kind`, `status` (the wishlist status) and `trip` keep their v2 meaning.

## Tables

Each array in `locations.json` is one table. The DDL is `data/schema/legacy/locations_schema.sql`.

| Table | Key | Holds |
|---|---|---|
| `countries` | `code` | ISO2, ISO3 (`a3`), name |
| `regions` | `id` (`CA/QC`) | country, code, name, `iso_3166_2` when the code is 1-3 letters |
| `areas` | `id` (`CA/QC/charlevoix`) | region, slug, name |
| `places` | `id` | the place itself (below) |
| `tags` | `id` | lives in `data/vocab/tags.json`, not in `locations.json`: label, `kind`, and `alias_of` for merged spellings |
| `place_tags` | `place_id`, `tag_id` | which canonical tags a place carries |
| `sources` | `id` (`src-00001`) | where a place or collection came from; exactly one of `place_id`, `collection_id` |
| `visits` | `id` (`vis-00001`) | a dated visit to a place, with its own trip slug |
| `collections` | `id` | name, country, notes |
| `collection_places` | `collection_id`, `position` | ordered stops; a place may repeat |

### A place

| Field | Meaning |
|---|---|
| `id` | path id, fixed once created. After an `edit --area` the prefix can differ from `area_id`; that is allowed. A collision gets `-2`, `-3`. |
| `area_id`, `name`, `resolved_name` | hierarchy link, display name, the label the resolver returned |
| `kind` | trail, viewpoint, waterfall, lake, mountain, park, town, city, island, beach, canyon, valley, activity, lodge, drive, museum, lighthouse, region, place |
| `status` | idea, shortlisted, planned, visited, dropped. `visited` needs at least one row in `visits`. |
| `trip` | slug of a top-level trip folder that adopted the place, or null. The folder must exist. |
| `lat`, `lon`, `elevation_m`, `wikidata`, `image` | from the resolver, or `--lat/--lon` (resolver `manual`) |
| `location_status` | `resolved`, or `unconfirmed` when the place is known but its position is not. Coordinates may be null only when unconfirmed or kind is `region`. |
| `resolver` | wikidata, nominatim, manual, none |
| `season_months` | sorted ints 1-12, `[]` when unknown. The CLI takes `--season Sep,Oct`. |
| `kid_fit` | yes, strong-kid, no, unknown |
| `stats`, `stats_verified` | what the source post claimed (km, gain_m, hours); unverified until a research lane confirms |
| `notes`, `added` | free text (the first line is what the public pages show), ISO date |
| `field_meta` | per column, where its value came from: `{"state": "value", "on": DATE, "basis": B, "src": [SOURCE ID]}`, or the search that found nothing: `{"state": "searched_none", "on": DATE, "tried": [WHAT, ...]}`. `basis` is the capture value basis (core `SUIT_BASIS`), `src` names this place's own source rows. Written by `edit --wikidata/--elevation-m/--image` and `edit --searched-none`; `validate` checks it. |

Tags: the tool slugifies each tag, resolves aliases (`waterfalls` becomes `waterfall`), drops a tag
equal to the place's own `kind`, and drops `location-unconfirmed` (use `--unconfirmed`).

## Commands

```bash
python3 tools/locations.py add "Name" --country CA --region QC [--area ...] [--kind ...] [--tags a,b] [--season Sep,Oct] [--kid yes] [--stats '{"km":9}'] [--note ...] [--source URL] [--source-type instagram] [--source-note ...] [--screenshot research/inbox/FILE] [--lat N --lon N] [--trip SLUG] [--unconfirmed] [--display-name ...] [--alias ...]
python3 tools/locations.py import research/inbox/2026-10-16-quebec-hikes.json
python3 tools/locations.py quick-add names.txt [--dry-run] [--source-note "saved list, 25 Oct 2026"]   # one `Name, Country[, kind]` per line
python3 tools/locations.py collection add --slug gaspesie-loop --name "Quebec to Gaspesie" --places ID-OR-NAME,...
python3 tools/locations.py edit ID [--name --kind --status --kid --season Sep,Oct --trip SLUG|--no-trip --area NAME --tags-add a,b --tags-remove a --note TEXT --note-append TEXT --stats JSON --lat N --lon N --unconfirmed|--confirmed --source URL --source-type T --source-note TEXT --screenshot PATH]
python3 tools/locations.py edit ID --wikidata Q2217047 --elevation-m 1731 --image "File:Name.jpg" [--basis official_info] [--source URL --source-type official]
python3 tools/locations.py edit ID --searched-none elevation_m,walk_km --tried "Wikidata Q123 (no P2044)" --tried "park trail page"
python3 tools/locations.py basics --report [--json]   # every place by missing basics layer, worst first (DATA-LOC section 2)
python3 tools/locations.py visit add ID --date 2026-10-02 [--end 2026-10-03] [--trip SLUG] [--note ...]
python3 tools/locations.py tag alias waterfalls waterfall
python3 tools/locations.py tag list
python3 tools/locations.py validate
python3 tools/locations.py build [--check]      # `render` still works as an alias
python3 tools/locations.py list [--country CA] [--q charlevoix] [--status idea] [--tag lake]
python3 tools/migrate_locations_v2.py [--check]  # one-off v1 to v2 (chains to v3); "already v2 or later" afterwards
python3 tools/migrate_locations_v3.py [--check]  # one-off v2 to v3; "already v3" afterwards
python3 -m pytest tools/tests -q
```

`edit` takes a full id, or a unique name or id tail. `--stats` is merged into the existing stats,
`--note-append` adds a paragraph, `--source` adds a source row. Exit 2 means ambiguous: candidates
are printed, re-run with `--pick N`. Exit 1 with `DUPLICATE` means the place is already there; use
`edit`. Give `--lat` and `--lon` together and the resolvers are skipped.

`quick-add` resolves each line like `add`, but strictly: two candidates within 2 points are ambiguous even when the country hint
matches both, because nobody checks each printed chain of a bulk list. Ambiguous, not-found and duplicate lines are printed and
not written (exit 2 when any is ambiguous, 1 when a line is unreadable or not found); the store is written once at the end. It holds
the Wikidata and Nominatim lock files (`/tmp/travel-wikidata.lock`, `/tmp/travel-nominatim.lock`) for the whole run.

`--image` takes only a Wikimedia Commons file, whose licence the gallery check reads from its file page; a photo from anywhere
else goes in the place's gallery with its licence (CC BY, CC BY-SA, CC0 or public domain only; DD-3), never in this column.
`--searched-none` takes the basics columns (`wikidata`, `elevation_m`, `image`, `season_months`, `walk_km`, `walk_gain_m`,
`duration_min`) and needs at least one `--tried`; a later value replaces it.

`basics --report` reads the store, the private page keys (`page-keys.json`, for each place's `place/<slug>` ref) and the capture,
suitability and relevance records of every lane. A field is answered by a value or a dated `searched_none`; a gap is never a yes.
A stored place no trip uses keeps its capture records in the trip-less lane `data/capture/catalogue/` (and a
`catalogue/` folder under `data/suitability/` and `data/relevance/`), refs `place/<slug>` from `data/catalogue/slugs.json`, never a new
`loc:` key. The lane id is internal (DD-8): it never appears in public output. Its rules are E_CAP_LANE (core `validate`).

`validate` checks every column and type, enums, ISO dates, primary and foreign keys, the two-owner
rule on sources, contiguous collection positions, visited-needs-a-visit, and that each `trip` folder
exists. It warns, without failing, when the layout is `single` and there are more than 300 places.

## Views and what is public

`build` writes three files from one code path (`tools/location_views.py`), so the list and
the globe cannot disagree. The public pages get an allow-list: the first line of notes (280 characters
at most), http(s) source URLs only, trip links only when `legacy/<slug>/index.html` exists. Screenshots,
inbox paths, resolver internals and source notes never leave the store. Dropped places are hidden by
default on the list and never shown on the globe.

## Gotchas

- The PostToolUse hook only sees Claude's Write and Edit tools. A shell write is covered by the CLI
  (`save` rebuilds) and by the freshness test that runs before a publish.
- Tests must point the tool at a tmp dir with `monkeypatch.setattr(D, "PATHS", D.Paths(tmp_path))`,
  never by assigning module globals.
- If the machine's SQLite lacks JSON1, the schema test strips the `json_valid` checks.
- Natural Earth state names do not match store regions in Italy and France. The globe hands over
  place ids, not region names.

## Rules

- Capture, do not research. Hours, prices and conditions belong to a trip's research lanes.
- Numbers from a post are stored and flagged, never trusted.
- Wikidata and Nominatim get one request a second with a user agent. Never run two capture
  sessions in parallel.
- The Obsidian `Location.md` (both copies) is retired and points here. Do not write to it.

## Split layout

The committed store is one file (`layout: single`). Past about 300 places, convert it so each
country is its own file and a change touches one small file:

    python3 tools/locations.py layout split     # locations.json + one data/locations/<CC>.json per country
    python3 tools/locations.py layout single    # back to one file, byte-identical to before

Split is never automatic; `validate` only warns once a single file passes 300 places.

- `locations.json` keeps `schema_version`, `updated`, `layout: "by-country"`, `parts` (sorted ISO2),
  `countries`, `collections`, `collection_places` and the sources that belong to a collection.
- `data/locations/<CC>.json` holds `schema_version`, `country`, and that country's `regions`, `areas`,
  `places`, `place_tags`, place-owned `sources` and `visits`, one row per line as in the single file.
- `save` routes each row: a region by its `country`, an area by its region, a place by its area,
  and `place_tags`, `sources` and `visits` by their place. A country with no rows gets no part, and a
  part the root no longer lists is deleted.
- `load` concatenates the parts and fails if a listed part is missing or holds a row from another
  country. Every command, `validate` and `build` work the same on either layout.
- The hook pattern `*/locations/[A-Z][A-Z].json` already covers the part files.

Gotchas: `layout` changes do not touch `updated`. Edit a part by hand and the next `validate` is the
check that you kept the row in the right country file.
