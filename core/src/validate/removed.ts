// Catalog rows are never deleted by an edit: that is `catalog.retire`, confirmed by the owner (plan 0A.2).
type Doc = Record<string, unknown>;

function idsByTable(doc: unknown): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return out;
  for (const [table, rows] of Object.entries(doc as Doc)) {
    if (table === "sources" || !Array.isArray(rows)) continue;
    const ids = new Set<string>();
    for (const r of rows) if (r && typeof r === "object" && typeof (r as Doc).id === "string") ids.add((r as Doc).id as string);
    out.set(table, ids);
  }
  return out;
}

/** "table:id" for every row present in `before` and absent from `after`. */
export function removedRows(before: unknown, after: unknown): string[] {
  const a = idsByTable(before);
  const b = idsByTable(after);
  const gone: string[] = [];
  for (const [table, ids] of a) for (const id of ids) if (!b.get(table)?.has(id)) gone.push(`${table}:${id}`);
  return gone.sort();
}
