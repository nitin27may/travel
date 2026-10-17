import { LOCATION_FILE_TABLES, LOCATIONS_SCHEMA_VERSION } from "../schema/locations.ts";
import { checkForeignKeys } from "./fk.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";
import type { Table } from "../schema/meta.ts";

const SCALARS = ["schema_version", "updated", "layout", "parts"];

export function validateLocations(doc: unknown, ctx: Ctx): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", "the file must be one JSON object with schema_version and the location tables.");
    ctx.schemaBroken = true;
    return;
  }
  if (doc.schema_version !== LOCATIONS_SCHEMA_VERSION) {
    const newer = typeof doc.schema_version === "number" && doc.schema_version > LOCATIONS_SCHEMA_VERSION;
    err(ctx, "E_SCHEMA", "/schema_version", newer
      ? `this file is schema version ${doc.schema_version} but this code reads version ${LOCATIONS_SCHEMA_VERSION}.`
      : `"schema_version" must be ${LOCATIONS_SCHEMA_VERSION}, got ${JSON.stringify(doc.schema_version)}; run python3 tools/migrate_locations_v3.py for a v2 store (tools/migrate_locations_v2.py first for a v1 store).`);
    ctx.schemaBroken = true;
  }
  const names = LOCATION_FILE_TABLES.map((t) => t.name);
  for (const k of Object.keys(doc)) {
    if (k === "tags") {
      err(ctx, "E_SCHEMA", "/tags", 'schema v3 keeps the tag vocabulary in data/vocab/tags.json; remove the "tags" table from this file.');
      ctx.schemaBroken = true;
    } else if (!SCALARS.includes(k) && !names.includes(k)) {
      err(ctx, "E_SCHEMA", `/${k}`, `unknown top-level key "${k}". The tables are: ${names.join(", ")}.`);
      ctx.schemaBroken = true;
    }
  }
  if (typeof doc.updated !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(doc.updated)) {
    err(ctx, "E_SCHEMA", "/updated", `"updated" must be an ISO date, got ${JSON.stringify(doc.updated)}. Example: "2026-10-17".`);
    ctx.schemaBroken = true;
  }
  const seen: { table: Table; rows: Row[]; path: string }[] = [];
  for (const t of LOCATION_FILE_TABLES) {
    if (!(t.name in doc)) continue;
    seen.push({ table: t, rows: checkTable(t, doc[t.name], `/${t.name}`, ctx), path: `/${t.name}` });
  }
  if (ctx.schemaBroken) return;

  for (const r of seen.find((s) => s.table.name === "sources")?.rows ?? []) {
    if ((r.place_id === null) === (r.collection_id === null)) {
      err(ctx, "E_SCHEMA", `/sources`, `source "${r.id}" must have exactly one owner: set place_id or collection_id, not both and not neither.`);
    }
  }
  const stops = new Map<string, number[]>();
  for (const r of seen.find((s) => s.table.name === "collection_places")?.rows ?? []) {
    const k = String(r.collection_id);
    (stops.get(k) ?? stops.set(k, []).get(k)!).push(r.position as number);
  }
  for (const [cid, ps] of stops) {
    ps.sort((a, b) => a - b);
    if (!ps.every((p, i) => p === i + 1)) {
      err(ctx, "E_SEQ_CONTIGUOUS", "/collection_places", `collection "${cid}" has positions ${JSON.stringify(ps)}; positions must run 1..${ps.length} with no gaps. Example: ${JSON.stringify(ps.map((_, i) => i + 1))}.`);
    }
  }
  ctx.refs.addDoc("locations", doc);
  checkForeignKeys(seen, new Map(), ctx);
}
