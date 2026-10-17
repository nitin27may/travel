// Locations store, schema v3, exactly as tools/locations.py COLUMNS defines it. v3 (P2b) moves the tag
// vocabulary to data/vocab/tags.json (the `tags` table stays in the registry as the FK target and gains
// `kind`) and gives places the catalog common-block columns. The v2 tables are exported as `locationsV2`
// for the migration fixture. The Python validator remains the deeper check for this family; tests assert
// both agree on column names, types and nullability.
import { z } from "zod";
import * as E from "./enums.ts";
import { bool, date, enumOf, idList, int, iso2, json, monthList, pdate, real, table, text, url } from "./meta.ts";

const FAMILY = "locations" as const;
const LATLON = "CHECK ((lat IS NULL) = (lon IS NULL))";

export const countries = table("countries", {
  code: iso2(),
  a3: text({ null: true }),
  name: text({ min: 1 }),
}, { family: FAMILY, pk: ["code"], ui: { label: "Countries" }, sql: { checks: ["CHECK (length(code) = 2)"] } });

export const regions = table("regions", {
  id: text({ min: 1 }),
  country: iso2({ fk: "countries.code" }),
  code: text({ min: 1 }),
  name: text({ min: 1 }),
  iso_3166_2: text({ null: true }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Regions" }, sql: { checks: ["UNIQUE (country, code)"] } });

export const areas = table("areas", {
  id: text({ min: 1 }),
  region_id: text({ min: 1, fk: "regions.id" }),
  slug: text({ min: 1 }),
  name: text({ min: 1 }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Areas" }, sql: { checks: ["UNIQUE (region_id, slug)"] } });

const placeColumnsV2 = () => ({
  id: text({ min: 1 }),
  area_id: text({ min: 1, fk: "areas.id" }),
  name: text({ min: 1 }),
  resolved_name: text({ null: true }),
  kind: enumOf(E.PLACE_KIND, { ui: { label: "Kind", facet: true } }),
  status: enumOf(E.PLACE_STATUS, { ui: { label: "Status", facet: true } }),
  trip: text({ null: true }),
  lat: real({ null: true, min: -90, max: 90 }),
  lon: real({ null: true, min: -180, max: 180 }),
  elevation_m: int({ null: true }),
  location_status: enumOf(E.LOCATION_STATUS),
  resolver: enumOf(E.RESOLVERS),
  wikidata: text({ null: true }),
  image: text({ null: true }),
  season_months: monthList(),
  kid_fit: enumOf(E.KID_FIT, { ui: { label: "Kid fit", facet: true } }),
  stats: json(z.record(z.string(), z.union([z.string(), z.number()]))),
  stats_verified: bool(),
  notes: text(),
  added: date(),
});

/** the common-block columns v3 adds to places (plan 2.3A "Locations v3"); `sources` and `tags` stay in their own tables */
const placeColumnsV3Added = () => ({
  name_lang: text({ null: true }),
  min_age: int({ null: true, min: 0 }),
  max_age: int({ null: true, min: 0 }),
  min_height_cm: int({ null: true, min: 0 }),
  max_height_cm: int({ null: true, min: 0 }),
  min_weight_kg: int({ null: true, min: 0 }),
  max_weight_kg: int({ null: true, min: 0 }),
  house_grade: int({ null: true, min: 1, max: 5, ui: { label: "House grade", facet: true } }),
  walk_km: real({ null: true, min: 0 }),
  walk_gain_m: int({ null: true, min: 0 }),
  duration_min: int({ null: true, min: 0 }),
  accessibility: enumOf(E.ACCESSIBILITY),
  cost_ref: text({ null: true }),
  review_status: enumOf(E.REVIEW_STATUS, { ui: { label: "Review status", facet: true } }),
  confidence: enumOf(E.CONFIDENCE, { ui: { label: "Confidence", facet: true } }),
  field_meta: json(z.record(z.string(), z.unknown())),
  verified_by: text({ null: true }),
  last_verified: date({ null: true }),
  contributed_by: idList(),
  licence: enumOf(E.LICENCE),
  merged_from: idList(),
  updated: date(),
});

const placesMeta = { family: FAMILY, pk: ["id"], ui: { label: "Places" }, sql: { checks: [LATLON], indexes: [["review_status"], ["last_verified"], ["area_id"]] } };
export const places = table("places", { ...placeColumnsV2(), ...placeColumnsV3Added() }, placesMeta);
const placesV2 = table("places", placeColumnsV2(), { family: FAMILY, pk: ["id"], ui: { label: "Places" }, sql: { checks: [LATLON] } });

export const place_tags = table("place_tags", {
  place_id: text({ min: 1, fk: "places.id" }),
  tag_id: text({ min: 1, fk: "tags.id" }),
}, { family: FAMILY, pk: ["place_id", "tag_id"], ui: { label: "Place tags" } });

export const TAG_KIND = ["style", "activity", "feature", "audience", "free"] as const;

export const tags = table("tags", {
  id: text({ min: 1 }),
  label: text({ min: 1 }),
  kind: enumOf(TAG_KIND, { ui: { label: "Kind", facet: true } }),
  alias_of: text({ null: true, fk: "tags.id" }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Tags" } });

const tagsV2 = table("tags", {
  id: text({ min: 1 }),
  label: text({ min: 1 }),
  alias_of: text({ null: true, fk: "tags.id" }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Tags" } });

export const sources = table("sources", {
  id: text({ min: 1 }),
  place_id: text({ null: true, fk: "places.id" }),
  collection_id: text({ null: true, fk: "collections.id" }),
  type: enumOf(E.LOCATION_SOURCE_TYPES),
  url: url({ null: true }),
  note: text({ null: true }),
  screenshot: text({ null: true }),
  post_date: date({ null: true }),
  saved: date(),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Sources" },
  sql: { checks: ["CHECK ((place_id IS NULL) <> (collection_id IS NULL))"] },
});

export const visits = table("visits", {
  id: text({ min: 1 }),
  place_id: text({ min: 1, fk: "places.id" }),
  date_start: pdate(),
  date_end: pdate({ null: true }),
  trip: text({ null: true }),
  notes: text(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Visits" } });

export const collections = table("collections", {
  id: text({ min: 1 }),
  name: text({ min: 1 }),
  country: iso2({ null: true, fk: "countries.code" }),
  notes: text(),
  added: date(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Collections" } });

export const collection_places = table("collection_places", {
  collection_id: text({ min: 1, fk: "collections.id" }),
  position: int({ min: 1 }),
  place_id: text({ min: 1, fk: "places.id" }),
}, {
  family: FAMILY, pk: ["collection_id", "position"], ui: { label: "Collection places" },
  rules: [{ code: "E_SEQ_CONTIGUOUS", kind: "contiguous", columns: ["position"], groupBy: ["collection_id"], describe: "positions run 1..n per collection" }],
});

/** every table of the family, in the order the Python tool lists them (the in-memory order) */
export const LOCATION_TABLES = [
  countries, regions, areas, places, place_tags, tags, sources, visits, collections, collection_places,
];
/** the arrays locations.json holds: v3 keeps the tags in data/vocab/tags.json */
export const LOCATION_FILE_TABLES = LOCATION_TABLES.filter((t) => t !== tags);
export const LOCATIONS_SCHEMA_VERSION = 3;
export const VOCAB_SCHEMA_VERSION = 1;

/** the v2 shape, for the migration fixture and nothing else */
export const locationsV2 = {
  schemaVersion: 2,
  tables: [countries, regions, areas, placesV2, place_tags, tagsV2, sources, visits, collections, collection_places],
};
