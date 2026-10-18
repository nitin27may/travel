import { tableOf } from "../schema/index.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";
import { polylineVertexCount } from "./polyline.ts";

import { validateSuitability } from "./suitability.ts";
import { validateDifficultyMapRules } from "../suitability/mapRules.ts";

export type DocumentKind = "research-sidecar" | "route-geometry" | "policy" | "freshness" | "difficulty-map" | "suitability";

const TABLE_OF: Record<DocumentKind, string> = {
  "research-sidecar": "research_sidecar",
  "route-geometry": "route_geometry",
  policy: "policy",
  freshness: "freshness",
  "difficulty-map": "difficulty_map",
  suitability: "suitability",
};

export function validateDocument(doc: unknown, kind: DocumentKind, ctx: Ctx): void {
  const t = tableOf("sidecar", TABLE_OF[kind]);
  if (kind === "suitability") {
    // its own error codes (E_SUIT_*): the generic table check would report everything as E_SCHEMA
    validateSuitability(doc, ctx);
    return;
  }
  // a v1 difficulty map predates `modes`; fill the column it does not have so v1 files keep validating
  if (kind === "difficulty-map" && isObj(doc) && doc.schema_version === 1 && !("modes" in doc)) doc = { ...doc, modes: null };
  checkTable(t, doc, "", ctx);
  if (ctx.schemaBroken || !isObj(doc)) return;
  if (kind === "difficulty-map") validateDifficultyMapRules(doc, ctx);
  if (kind === "route-geometry") {
    const n = polylineVertexCount(String(doc.polyline));
    const ts = doc.t_s as unknown[];
    const dm = doc.d_m as unknown[];
    if (n < 0) err(ctx, "E_SCHEMA", "/polyline", "polyline is not a valid encoded polyline (precision 6 string).");
    else if (ts.length !== n || dm.length !== n) {
      err(ctx, "E_SCHEMA", "/t_s", `t_s and d_m need one entry per polyline vertex: the polyline has ${n} vertices, t_s has ${ts.length} and d_m has ${dm.length}.`);
    }
    const flags = doc.flags as { from_vertex: number; to_vertex: number }[];
    flags.forEach((f, i) => {
      if (n >= 0 && (f.to_vertex >= n || f.from_vertex > f.to_vertex)) {
        err(ctx, "E_SCHEMA", `/flags/${i}`, `flag runs from vertex ${f.from_vertex} to ${f.to_vertex}; vertices must be inside 0..${n - 1} and from_vertex must not exceed to_vertex.`);
      }
    });
  }
  if (kind === "research-sidecar") {
    const ids = new Set((doc.sources as { id: string }[]).map((s) => s.id));
    const check = (list: unknown[], path: string): void => {
      list.forEach((x, i) => {
        const src = isObj(x) ? (x.src as unknown) : null;
        if (Array.isArray(src)) {
          for (const s of src) {
            if (typeof s === "string" && !ids.has(s)) {
              err(ctx, "E_SRC", `${path}/${i}/src`, `src names ${JSON.stringify(s)}, which is not in this sidecar's sources. Add it there or remove it. Example: "src-0001".`);
            }
          }
        }
      });
    };
    check(doc.facts as unknown[], "/facts");
    const recs = doc.records as Record<string, unknown[]>;
    for (const [k, v] of Object.entries(recs)) if (Array.isArray(v)) check(v, `/records/${k}`);
  }
}

