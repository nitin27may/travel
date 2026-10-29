import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

type ReferenceKind = "reference-hubs" | "reference-airports" | "region-groups";

/**
 * Rules the table schemas of core/src/schema/reference.ts cannot express: ids unique, the origin token matches the id, a hub's and an
 * airport's point is not (0, 0), a group's id starts with its country, a region sits in one group of its country, and `offered` follows
 * `min_places`. Every code is E_SCHEMA, like sources.ts.
 */
export function validateReferenceRules(doc: Record<string, unknown>, kind: ReferenceKind, ctx: Ctx): void {
  const list = kind === "reference-hubs" ? "hubs" : kind === "reference-airports" ? "airports" : "groups";
  const rows = Array.isArray(doc[list]) ? (doc[list] as unknown[]) : [];
  const seen = new Map<string, number>();
  const unique = (key: string, value: unknown, i: number, field: string): void => {
    if (typeof value !== "string") return;
    const k = `${field}:${value}`;
    const first = seen.get(k);
    if (first !== undefined) err(ctx, "E_SCHEMA", `/${list}/${i}/${field}`, `${field} ${JSON.stringify(value)} appears twice (rows ${first} and ${i}); each ${key} is listed once.`);
    else seen.set(k, i);
  };
  const regionOwner = new Map<string, string>();
  rows.forEach((r, i) => {
    if (!isObj(r)) return;
    const at = `/${list}/${i}`;
    if (kind !== "region-groups") {
      if (r.lat === 0 && r.lon === 0) err(ctx, "E_SCHEMA", `${at}/lat`, "the point is (0, 0), which is a missing coordinate, not a place.");
    }
    if (kind === "reference-hubs") {
      unique("hub", r.id, i, "id");
      if (r.ref !== `hub:${String(r.id)}`) err(ctx, "E_SCHEMA", `${at}/ref`, `ref must be "hub:${String(r.id)}".`);
    } else if (kind === "reference-airports") {
      unique("airport", r.id, i, "id");
      unique("airport", r.iata, i, "iata");
      if (r.ref !== `iata:${String(r.iata)}`) err(ctx, "E_SCHEMA", `${at}/ref`, `ref must be "iata:${String(r.iata)}".`);
    } else {
      unique("group", r.id, i, "id");
      const cc = typeof r.cc === "string" ? r.cc : "";
      if (typeof r.id === "string" && r.id.slice(0, 2) !== cc.toLowerCase()) {
        err(ctx, "E_SCHEMA", `${at}/id`, `a group id starts with its country in lower case: ${JSON.stringify(r.id)} is in ${cc}. Example: "${cc.toLowerCase()}-north".`);
      }
      for (const slug of Array.isArray(r.regions) ? r.regions : []) {
        const key = `${cc}/${String(slug)}`;
        const owner = regionOwner.get(key);
        if (owner) err(ctx, "E_SCHEMA", `${at}/regions`, `region ${key} is in two groups (${owner} and ${String(r.id)}); a region sits in one group.`);
        else regionOwner.set(key, String(r.id));
      }
      for (const loc of Array.isArray(r.locations_regions) ? r.locations_regions : []) {
        if (typeof loc === "string" && !loc.startsWith(`${cc}/`)) err(ctx, "E_SCHEMA", `${at}/locations_regions`, `${loc} is not a region of ${cc}.`);
      }
      const min = typeof doc.min_places === "number" ? doc.min_places : null;
      if (min !== null && typeof r.places === "number" && r.offered !== r.places >= min) {
        err(ctx, "E_SCHEMA", `${at}/offered`, `offered must be ${r.places >= min} for ${r.places} places (min_places ${min}).`);
      }
    }
  });
}
