import { z } from "zod";
import * as E from "../enums.ts";
import { bool, enumOf, HHMM_RE, int, json, real, table, text } from "../meta.ts";
import { CATALOG_INDEXES, LATLON_CHECK, common } from "./common.ts";

const interval = z.tuple([z.string().regex(HHMM_RE), z.string().regex(HHMM_RE)]);

export const eateries = table("eateries", {
  ...common(),
  lat: real({ min: -90, max: 90 }),
  lon: real({ min: -180, max: 180 }),
  cuisine: text({ null: true }),
  price_tier: int({ null: true, min: 1, max: 4 }),
  kids_menu: bool({ null: true }),
  reservation: enumOf(E.RESERVATION, { null: true }),
  // keys are ISO weekdays "1".."7"
  hours: json(z.record(z.string().regex(/^[1-7]$/), z.array(interval))),
  notes: text(),
}, { family: "catalog", pk: ["id"], ui: { label: "Eateries" }, sql: { indexes: CATALOG_INDEXES, checks: [LATLON_CHECK] } });
