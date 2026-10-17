-- Locations schema v2. The JSON store in locations/locations.json maps one array to one table.
-- Loaded by _system/tests/test_schema_sqlite.py. If the local SQLite has no JSON1, the test strips
-- the json_valid checks.
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
