import * as E from "../enums.ts";
import { bool, enumOf, int, real, table, text } from "../meta.ts";
import { CATALOG_INDEXES, LATLON_CHECK, common } from "./common.ts";

export const stays = table("stays", {
  ...common(),
  lat: real({ min: -90, max: 90 }),
  lon: real({ min: -180, max: 180 }),
  kind: enumOf(E.STAY_KIND, { ui: { label: "Kind", facet: true } }),
  comfort_tier: int({ null: true, min: 1, max: 4 }),
  sleeps_max: int({ null: true, min: 1 }),
  elevation_m: int({ null: true }),
  car_free_access: bool(),
  last_transport: text({ null: true }),
  address: text({ null: true }),
  notes: text(),
}, { family: "catalog", pk: ["id"], ui: { label: "Stays" }, sql: { indexes: CATALOG_INDEXES, checks: [LATLON_CHECK] } });
