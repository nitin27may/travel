// Locations store, schema v2, exactly as tools/locations.py COLUMNS defines it today.
// P2b adds v3 (the common-block columns). The Python validator remains the deeper check for this
// family; tests assert both agree on column names, types and nullability.
import { z } from "zod";
import * as E from "./enums.ts";
import { bool, date, enumOf, int, iso2, json, monthList, pdate, real, table, text, url } from "./meta.ts";

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

export const places = table("places", {
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
}, { family: FAMILY, pk: ["id"], ui: { label: "Places" }, sql: { checks: [LATLON] } });

export const place_tags = table("place_tags", {
  place_id: text({ min: 1, fk: "places.id" }),
  tag_id: text({ min: 1, fk: "tags.id" }),
}, { family: FAMILY, pk: ["place_id", "tag_id"], ui: { label: "Place tags" } });

export const tags = table("tags", {
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

/** file order of the arrays in locations.json (the order tools/locations.py writes today) */
export const LOCATION_TABLES = [
  countries, regions, areas, places, place_tags, tags, sources, visits, collections, collection_places,
];
export const LOCATIONS_SCHEMA_VERSION = 2;
