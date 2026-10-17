// route-geometry/1 (plan 0B.5): a route sidecar under data/trips/<slug>/routes/ or data/catalog/legs/geo/.
import { z } from "zod";
import { date, int, json, pattern, table, text } from "./meta.ts";

const flag = z.strictObject({
  from_vertex: z.number().int().min(0),
  to_vertex: z.number().int().min(0),
  kind: z.enum(["ferry", "pass"]),
  label: z.string(),
  source: z.enum(["osm", "hand"]),
});

export const route_geometry = table("route_geometry", {
  schema: pattern(/^route-geometry\/1$/),
  polyline: text({ min: 1 }),
  precision: int({ min: 5, max: 6 }),
  t_s: json(z.array(z.number())),
  d_m: json(z.array(z.number())),
  flags: json(z.array(flag)),
  provider: text({ min: 1 }),
  profile: text({ min: 1 }),
  fetched: date(),
  licence: text({ min: 1 }),
}, {
  family: "sidecar", pk: [], single: true, ui: { label: "Route geometry" },
  rules: [{ code: "E_SCHEMA", kind: "custom", describe: "t_s and d_m have one entry per decoded polyline vertex" }],
});
