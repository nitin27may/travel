import * as E from "../enums.ts";
import { bool, enumOf, int, pattern, real, table, text } from "../meta.ts";
import { provenance } from "./common.ts";

export const legs = table("legs", {
  id: pattern(/^lg-[0-9a-f]{10}$/),
  from_id: text({ min: 1 }),
  to_id: text({ min: 1 }),
  mode: enumOf(E.LEG_MODE),
  km: real({ null: true, min: 0 }),
  minutes: int({ null: true, min: 0 }),
  basis: enumOf(E.LEG_BASIS),
  seasonal_notes: text(),
  symmetric: bool(),
  geometry_file: text({ null: true }),
  ...provenance(),
}, {
  family: "catalog", pk: ["id"], ui: { label: "Legs" },
  sql: { checks: ["UNIQUE (from_id, to_id, mode)"], indexes: [["review_status"], ["last_verified"]] },
  rules: [{ code: "E_LEG_ID", kind: "custom", describe: "id is lg- plus the first 10 hex digits of SHA-256 of from_id|to_id|mode" }],
});
