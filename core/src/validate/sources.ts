import type { SourceEntry } from "../schema/sources.ts";
import { normaliseUrl, sourceId } from "../sources/normalize.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

/** Rules the table schema cannot express: the id is the hash of the url, the url is normalised, entries are sorted and unique. */
export function validateSourcesRules(doc: Record<string, unknown>, ctx: Ctx): void {
  const entries = doc.entries as SourceEntry[];
  const seen = new Set<string>();
  let prev = "";
  entries.forEach((e, i) => {
    if (!isObj(e)) return;
    const n = normaliseUrl(e.url);
    if (n !== e.url) err(ctx, "E_SCHEMA", `/entries/${i}/url`, `url ${JSON.stringify(e.url)} is not in normalised form (expected ${JSON.stringify(n)}). The registry is derived: run node core/bin/sources.ts build.`);
    if (sourceId(n) !== e.id) err(ctx, "E_SCHEMA", `/entries/${i}/id`, `id ${e.id} is not the hash of the url (expected ${sourceId(n)}). Run node core/bin/sources.ts build.`);
    if (seen.has(e.id)) err(ctx, "E_SCHEMA", `/entries/${i}/id`, `id ${e.id} appears twice. Run node core/bin/sources.ts build.`);
    seen.add(e.id);
    if (e.url < prev) err(ctx, "E_SCHEMA", `/entries/${i}/url`, "entries must be sorted by url. Run node core/bin/sources.ts build.");
    prev = e.url;
    if (e.first_read > e.last_read) err(ctx, "E_SCHEMA", `/entries/${i}/first_read`, "first_read is after last_read.");
  });
}
