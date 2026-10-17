import { z } from "zod";
import * as E from "../enums.ts";
import { datetime, enumOf, idList, int, json, table, text } from "../meta.ts";

export const catalog_changes = table("catalog_changes", {
  seq: int({ min: 1 }),
  at: datetime(),
  actor_id: text({ min: 1 }),
  actor_via: text({ min: 1 }),
  entity: text({ min: 1 }),
  id: text({ min: 1 }),
  op: enumOf(E.CATALOG_OP),
  before: json(z.record(z.string(), z.unknown()), { null: true }),
  after: json(z.record(z.string(), z.unknown()), { null: true }),
  reason: text({ null: true }),
  proposal_id: text({ null: true }),
  sources: idList(),
}, { family: "catalog", pk: ["seq"], ui: { label: "Catalog changes" }, sql: { indexes: [["entity", "id"]] } });
