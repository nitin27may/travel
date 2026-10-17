import { createHash } from "node:crypto";
import { CATALOG_FILES, tableOf } from "../schema/index.ts";
import type { Table } from "../schema/meta.ts";
import { checkForeignKeys, checkSources } from "./fk.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";

export const CATALOG_SCHEMA_VERSION = 1;

/** the entity (folder name) a catalog document belongs to, from the tables it carries */
export function entityOfDoc(doc: Record<string, unknown>): string | null {
  for (const [entity, tables] of Object.entries(CATALOG_FILES)) if (tables[0]! in doc) return entity;
  return null;
}

const ID_RE = /^[A-Za-z0-9/-]+$/;

export function legId(fromId: string, toId: string, mode: string): string {
  return "lg-" + createHash("sha256").update(`${fromId}|${toId}|${mode}`).digest("hex").slice(0, 10);
}

export function validateCatalog(doc: unknown, ctx: Ctx, entityHint: string | null, fileCC: string | null): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", 'the file must be one JSON object with schema_version, country, the entity table and sources. Example: {"schema_version": 1, "country": "AR", "trails": [], "sources": []}.');
    ctx.schemaBroken = true;
    return;
  }
  const entity = entityHint ?? entityOfDoc(doc);
  if (!entity || !(entity in CATALOG_FILES)) {
    err(ctx, "E_SCHEMA", "", `cannot tell which catalog entity this file holds; it needs one of the tables ${Object.values(CATALOG_FILES).map((t) => t[0]).join(", ")}.`);
    ctx.schemaBroken = true;
    return;
  }
  const names = CATALOG_FILES[entity]!;
  const tables = names.map((n) => tableOf("catalog", n));
  const sourcesTable = tableOf("catalog", "sources");
  const rootKeys = ["schema_version", "country", ...names, "sources"];

  if (doc.schema_version !== CATALOG_SCHEMA_VERSION) {
    const newer = typeof doc.schema_version === "number" && doc.schema_version > CATALOG_SCHEMA_VERSION;
    err(ctx, "E_SCHEMA", "/schema_version", newer
      ? `this file is schema version ${doc.schema_version} but this code reads version ${CATALOG_SCHEMA_VERSION}.`
      : `"schema_version" must be ${CATALOG_SCHEMA_VERSION}, got ${JSON.stringify(doc.schema_version)}.`);
    ctx.schemaBroken = true;
  }
  if (typeof doc.country !== "string" || !/^[A-Z]{2}$/.test(doc.country)) {
    err(ctx, "E_SCHEMA", "/country", `"country" must be a two-letter upper-case ISO code, got ${JSON.stringify(doc.country)}. Example: "AR".`);
    ctx.schemaBroken = true;
  } else if (fileCC && doc.country !== fileCC) {
    err(ctx, "E_SCHEMA", "/country", `"country" is "${doc.country}" but the file is named ${fileCC}.json; they must match.`);
    ctx.schemaBroken = true;
  }
  for (const k of Object.keys(doc)) {
    if (!rootKeys.includes(k)) {
      err(ctx, "E_SCHEMA", `/${k}`, `unknown top-level key "${k}". This file holds: ${rootKeys.join(", ")}.`);
      ctx.schemaBroken = true;
    }
  }
  for (const k of [...names, "sources"]) {
    if (!(k in doc)) {
      err(ctx, "E_SCHEMA", `/${k}`, `"${k}" is missing; add it as [] when there are no rows.`);
      ctx.schemaBroken = true;
    }
  }
  const present = Object.keys(doc).filter((k) => rootKeys.includes(k));
  const want = rootKeys.filter((k) => present.includes(k));
  if (present.join("|") !== want.join("|")) {
    const i = present.findIndex((k, j) => k !== want[j]);
    err(ctx, "E_KEY_ORDER", `/${present[i]}`, `top-level keys are out of order at "${present[i]}". The order is: ${rootKeys.join(", ")}.`);
  }

  const seen: { table: Table; rows: Row[]; path: string }[] = [];
  for (const t of [...tables, sourcesTable]) {
    if (!(t.name in doc)) continue;
    seen.push({ table: t, rows: checkTable(t, doc[t.name], `/${t.name}`, ctx), path: `/${t.name}` });
  }
  if (ctx.schemaBroken) return;

  ctx.refs.addDoc("catalog", doc);
  checkForeignKeys(seen, new Map(), ctx);
  const sourceIds = new Set(seen.find((s) => s.table.name === "sources")!.rows.map((r) => String(r.id)));
  checkSources(
    seen.filter((s) => s.table.name !== "sources"),
    sourceIds,
    (t) => [
      ...("sources" in t.shape ? [{ col: "sources", list: true }] : []),
      ...("source_id" in t.shape ? [{ col: "source_id", list: false }] : []),
    ],
    "the sources table of this file",
    ctx,
  );

  for (const { table, rows, path } of seen) {
    rows.forEach((r, i) => {
      const p = `${path}/${i}`;
      if (table.name !== "offer_prices" && table.name !== "sources" && typeof r.id === "string" && (!ID_RE.test(r.id) || r.id.includes("__"))) {
        err(ctx, "E_ID_ENCODING", `${p}/id`, `id ${JSON.stringify(r.id)} may only contain letters, digits, "/" and "-", and never "__" (it becomes a file name by replacing "/" with "__"). Example: "AR/santa-cruz/el-chalten/laguna-de-los-tres".`);
      }
      if (table.name === "legs") {
        const want = legId(String(r.from_id), String(r.to_id), String(r.mode));
        if (r.id !== want) {
          err(ctx, "E_LEG_ID", `${p}/id`, `leg id ${JSON.stringify(r.id)} is not the hash of from_id, to_id and mode; it should be "${want}" (lg- plus the first 10 hex digits of SHA-256 of "from_id|to_id|mode").`);
        }
      }
      if (table.name === "offers" && r.opens_kind === "rolling-lead" && r.opens_lead_days === null) {
        err(ctx, "E_OFFER_WINDOW", `${p}/opens_lead_days`, `offer "${r.id}" opens on a rolling lead, so opens_lead_days is required. Example: 5 (bookable five days ahead).`);
      }
    });
  }
}

