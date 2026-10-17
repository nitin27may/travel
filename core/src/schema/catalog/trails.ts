import * as E from "../enums.ts";
import { date, enumOf, int, real, strList, table, text, url } from "../meta.ts";
import { CATALOG_INDEXES, common } from "./common.ts";

const base = common();
// trails use trailhead_lat and trailhead_lon, not lat and lon
delete base.lat;
delete base.lon;

export const trails = table("trails", {
  ...base,
  place_id: text({ null: true, fk: "places.id" }),
  km: real({ null: true, min: 0 }),
  km_range: text({ null: true }),
  gain_m: int({ null: true, min: 0 }),
  loss_m: int({ null: true, min: 0 }),
  hours: text({ null: true }),
  shape: enumOf(E.TRAIL_SHAPE, { null: true }),
  house_basis: enumOf(E.HOUSE_BASIS, { null: true }),
  local_system: enumOf(E.LOCAL_SYSTEM, { null: true }),
  local_grade: text({ null: true }),
  local_source_url: url({ null: true }),
  trailhead_lat: real({ null: true, min: -90, max: 90 }),
  trailhead_lon: real({ null: true, min: -180, max: 180 }),
  trailhead_name: text({ null: true }),
  hazards: strList(),
  permit: text({ null: true }),
  geometry_file: text({ null: true }),
  geometry_source: enumOf(E.GEOMETRY_SOURCE, { null: true }),
  geometry_source_id: text({ null: true }),
  geometry_fetched: date({ null: true }),
  official_url: url({ null: true }),
  alltrails_url: url({ null: true }),
  komoot_url: url({ null: true }),
  outdooractive_url: url({ null: true }),
  wikiloc_url: url({ null: true }),
  notes: text(),
}, {
  family: "catalog", pk: ["id"], ui: { label: "Trails" },
  sql: {
    indexes: CATALOG_INDEXES,
    checks: ["CHECK ((trailhead_lat IS NULL) = (trailhead_lon IS NULL))"],
  },
});

