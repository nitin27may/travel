// Validator for capture-changeset/1 (core/src/schema/capture/changeset.ts; R-133). Structure from Zod, reported as E_CAP_SCHEMA; the
// rules a schema cannot hold are E_CAP_CHANGESET: a change targets a lane file, set and add carry a value and remove does not, a Val
// value cites only the file's own sources, and the same (file, ref, path) is not changed twice.
import { changesetDoc, CHANGE_TARGET_RE } from "../schema/capture/changeset.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

export function validateCaptureChangeset(doc: unknown, ctx: Ctx): void {
  if (!isObj(doc)) {
    err(ctx, "E_CAP_SCHEMA", "", "the file must be one JSON object with schema, run, by, on, sources and changes.");
    ctx.schemaBroken = true;
    return;
  }
  const parsed = changesetDoc.safeParse(doc);
  if (!parsed.success) {
    for (const i of parsed.error.issues) err(ctx, "E_CAP_SCHEMA", "/" + i.path.join("/"), `${String(i.path[i.path.length - 1] ?? "the file")}: ${i.message}. Example: {"file": "data/suitability/canadian-rockies-2029/R2a.json", "ref": "...", "op": "set", "path": "suitability.access_season", "value": {...}, "why": "..."}.`);
    ctx.schemaBroken = true;
    return;
  }
  const d = parsed.data;
  const ids = new Set(d.sources.map((s) => s.id));
  const seen = new Map<string, number>();
  d.changes.forEach((c, i) => {
    const base = `/changes/${i}`;
    if (!CHANGE_TARGET_RE.test(c.file)) err(ctx, "E_CAP_CHANGESET", `${base}/file`, `"${c.file}" is not a lane file. A change targets data/capture/<trip>/<lane>.json, data/suitability/<trip>/<lane>.json or data/relevance/<trip>/<lane>.json; the ledger, the budget, points and the registry are never patched by a changeset.`);
    if ((c.op === "set" || c.op === "add") && c.value === undefined) err(ctx, "E_CAP_CHANGESET", base, `op "${c.op}" needs a value.`);
    if (c.op === "remove" && c.value !== undefined) err(ctx, "E_CAP_CHANGESET", `${base}/value`, `op "remove" takes no value.`);
    const v = c.value;
    if (isObj(v) && Array.isArray(v.src)) for (const s of v.src) if (typeof s === "string" && !ids.has(s)) err(ctx, "E_CAP_CHANGESET", `${base}/value/src`, `src names ${JSON.stringify(s)}, which is not in this changeset's sources.`);
    const key = `${c.file}|${c.ref}|${c.path}`;
    const first = seen.get(key);
    if (first !== undefined && !(c.op === "add" && d.changes[first]!.op === "add")) err(ctx, "E_CAP_CHANGESET", base, `change ${i} touches the same file, ref and path as change ${first}. Keep one change per value.`);
    else seen.set(key, i);
  });
}
