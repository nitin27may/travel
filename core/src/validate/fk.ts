import type { Table } from "../schema/meta.ts";
import { err, fkColumns, valuesOf } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";

const WHERE: Record<string, string> = {
  "places.id": "data/locations/locations.json (places)",
  "areas.id": "data/locations/locations.json (areas)",
  "regions.id": "data/locations/locations.json (regions)",
  "countries.code": "data/locations/locations.json (countries)",
  "collections.id": "data/locations/locations.json (collections)",
  "tags.id": "data/vocab/tags.json or the tags table of data/locations/locations.json",
  "trails.id": "data/catalog/trails/<CC>.json",
  "activities.id": "data/catalog/activities/<CC>.json",
  "stays.id": "data/catalog/stays/<CC>.json",
  "eateries.id": "data/catalog/eateries/<CC>.json",
  "offers.id": "data/catalog/offers/<CC>.json",
  "legs.id": "data/catalog/legs/<CC>.json",
};

/**
 * Checks every x-fk column of every table. `local` maps a SQL table name to its rows when that table
 * lives in the same document; any other target is resolved through the reference index.
 */
export function checkForeignKeys(
  tables: { table: Table; rows: Row[]; path: string }[],
  local: Map<string, Row[]>,
  ctx: Ctx,
): void {
  const localSets = new Map<string, Set<string>>();
  const localSet = (tbl: string, col: string): Set<string> => {
    const key = `${tbl}.${col}`;
    let s = localSets.get(key);
    if (!s) {
      s = new Set((local.get(tbl) ?? []).map((r) => String(r[col])));
      localSets.set(key, s);
    }
    return s;
  };
  for (const { table, rows, path } of tables) {
    const cols = fkColumns(table);
    if (cols.length === 0) continue;
    rows.forEach((row, i) => {
      const rowPath = table.meta.single ? path : `${path}/${i}`;
      for (const { col, target, json } of cols) {
        const [tTable, tCol] = target.split(".") as [string, string];
        for (const v of valuesOf(row, col, json)) {
          let ok: boolean;
          let aliasOf: string | null | undefined;
          if (local.has(tTable)) ok = localSet(tTable, tCol).has(v);
          else if (ctx.refs.knows(tTable, tCol)) {
            ok = ctx.refs.has(tTable, tCol, v);
            if (ok && target === "tags.id") aliasOf = ctx.refs.tagAliasOf(v);
          } else continue;
          const where = local.has(tTable) ? `the ${tTable} table of this file` : (WHERE[target] ?? target);
          if (!ok) {
            err(ctx, "E_FK", `${rowPath}/${col}`, `"${col}" is ${JSON.stringify(v)}, which is not in ${where}. Check the spelling, or add that row first. Example of a valid id: ${exampleId(target)}.`);
          } else if (typeof aliasOf === "string") {
            err(ctx, "E_FK", `${rowPath}/${col}`, `"${col}" is the tag alias ${JSON.stringify(v)}; use the canonical tag ${JSON.stringify(aliasOf)}.`);
          }
        }
      }
    });
  }
}

function exampleId(target: string): string {
  switch (target) {
    case "trails.id": return '"AR/santa-cruz/el-chalten/laguna-de-los-tres"';
    case "places.id": return '"CA/ON/niagara/niagara-falls"';
    case "areas.id": return '"AR/santa-cruz/el-chalten"';
    case "tags.id": return '"waterfall"';
    case "offers.id": return '"of-piratour-harberton-martillo"';
    case "countries.code": return '"AR"';
    default: return '"AR/santa-cruz/el-chalten/some-name"';
  }
}

/** E_SRC: every id in `src` columns must be in the sources table of the same document. */
export function checkSources(
  tables: { table: Table; rows: Row[]; path: string }[],
  sourceIds: Set<string>,
  columns: (t: Table) => { col: string; list: boolean }[],
  where: string,
  ctx: Ctx,
): void {
  for (const { table, rows, path } of tables) {
    const cols = columns(table);
    if (cols.length === 0) continue;
    rows.forEach((row, i) => {
      for (const { col, list } of cols) {
        for (const v of valuesOf(row, col, list)) {
          if (!sourceIds.has(v)) {
            err(ctx, "E_SRC", `${table.meta.single ? path : `${path}/${i}`}/${col}`, `"${col}" names ${JSON.stringify(v)}, which is not in ${where}. Add a sources row with that id, or remove it. Example: "src-0001".`);
          }
        }
      }
    });
  }
}
