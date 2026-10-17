// data/vocab/tags.json: the shared tag vocabulary (P2b gives it its final shape). Until then this checks
// the one thing every consumer relies on: rows with a unique id, and alias_of pointing at a canonical tag.
import { tableOf } from "../schema/index.ts";
import { VOCAB_SCHEMA_VERSION } from "../schema/locations.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

export function validateVocab(doc: unknown, ctx: Ctx): void {
  const rows = isObj(doc) ? doc.tags : Array.isArray(doc) ? doc : null;
  if (!Array.isArray(rows)) {
    err(ctx, "E_SCHEMA", "", 'tags.json must be {"tags": [{"id": "waterfall", "label": "Waterfall", "alias_of": null}, ...]}.');
    return;
  }
  if (isObj(doc) && doc.schema_version !== VOCAB_SCHEMA_VERSION) {
    err(ctx, "E_SCHEMA", "/schema_version", `"schema_version" must be ${VOCAB_SCHEMA_VERSION}, got ${JSON.stringify(doc.schema_version)}.`);
  }
  // the column rules (kind enum, label, alias_of type) come from the tags table of the schema source
  checkTable(tableOf("locations", "tags"), rows, "/tags", ctx);
  const alias = new Map<string, string | null>();
  rows.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) {
      err(ctx, "E_SCHEMA", `/tags/${i}/id`, `every tag needs an "id" in lower-case words joined by hyphens. Example: "fall-colours".`);
      return;
    }
    alias.set(r.id, typeof r.alias_of === "string" ? r.alias_of : null);
  });
  rows.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== "string" || typeof r.alias_of !== "string") return;
    if (!alias.has(r.alias_of)) err(ctx, "E_FK", `/tags/${i}/alias_of`, `tag "${r.id}" is an alias of "${r.alias_of}", which is not a tag. Example: "waterfall".`);
    else if (alias.get(r.alias_of)) err(ctx, "E_FK", `/tags/${i}/alias_of`, `"${r.alias_of}" is itself an alias; point "${r.id}" at the canonical tag "${alias.get(r.alias_of)}".`);
  });
}
