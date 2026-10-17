import * as E from "../enums.ts";
import { date, enumOf, pattern, real, table, text } from "../meta.ts";

export const backlog = table("backlog", {
  id: pattern(/^bl-[0-9a-f]+$/),
  subject_entity: text({ null: true }),
  subject_id: text({ null: true }),
  area_id: text({ null: true, fk: "areas.id" }),
  reason: enumOf(E.BACKLOG_REASON),
  field: text({ null: true }),
  lane: text({ null: true }),
  priority: real({ min: 0 }),
  status: enumOf(E.BACKLOG_STATUS),
  claimed_by: text({ null: true }),
  created: date(),
  done: date({ null: true }),
}, { family: "catalog", pk: ["id"], ui: { label: "Research backlog" }, sql: { indexes: [["status"], ["area_id"]] } });
