import * as E from "../enums.ts";
import { bool, enumOf, int, table, text } from "../meta.ts";
import { CATALOG_INDEXES, LATLON_CHECK, common } from "./common.ts";

export const activities = table("activities", {
  ...common(),
  type: enumOf(E.ACTIVITY_TYPE, { ui: { label: "Type", facet: true } }),
  operator: text({ null: true }),
  place_id: text({ null: true, fk: "places.id" }),
  indoor: bool(),
  weather_sensitive: bool(),
  adventure_level: int({ null: true, min: 1, max: 5 }),
  notes: text(),
}, { family: "catalog", pk: ["id"], ui: { label: "Activities" }, sql: { indexes: CATALOG_INDEXES, checks: [LATLON_CHECK] } });
