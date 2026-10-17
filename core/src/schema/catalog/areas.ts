import { z } from "zod";
import { json, monthList, table, text } from "../meta.ts";
import { provenance } from "./common.ts";

export const area_guides = table("area_guides", {
  id: text({ min: 1, fk: "areas.id" }),
  summary: text(),
  best_months: monthList(),
  getting_there: text(),
  hidden_gems: json(z.array(z.strictObject({ place_id: z.string(), line: z.string() }))),
  what_to_know: text(),
  safety: text(),
  ...provenance(),
}, { family: "catalog", pk: ["id"], ui: { label: "Area guides" }, sql: { indexes: [["review_status"], ["last_verified"]] } });
