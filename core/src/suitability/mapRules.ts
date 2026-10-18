// Rules of difficulty-map v2 that the table schema cannot hold: every mapping row names its source and read date.
import { err } from "../validate/rows.ts";
import type { Ctx } from "../validate/rows.ts";

type Row = Record<string, unknown>;

export function validateDifficultyMapRules(doc: Row, ctx: Ctx): void {
  if (doc.schema_version !== 2) return;
  if (doc.modes === null || doc.modes === undefined) {
    err(ctx, "E_SCHEMA", "/modes", 'a version 2 difficulty map needs "modes", the km factor by travel mode. Example: {"walk": 1, "ride": 0.25, "note": "our rule"}.');
  }
  const systems = Array.isArray(doc.systems) ? (doc.systems as Row[]) : [];
  systems.forEach((s, i) => {
    const rows = Array.isArray(s.mappings) ? (s.mappings as Row[]) : [];
    rows.forEach((m, j) => {
      const src = m.source;
      if (typeof src !== "string" || !(/^https?:\/\/\S+$/.test(src) || src.startsWith("docs/"))) {
        err(ctx, "E_SCHEMA", `/systems/${i}/mappings/${j}/source`, `mapping "${String(m.local)}" in "${String(s.id)}" needs a source: a URL, or a docs/ path for a row kept from plan 3A. Example: "https://parks.canada.ca/...".`);
      }
      if (typeof m.read !== "string") {
        err(ctx, "E_SCHEMA", `/systems/${i}/mappings/${j}/read`, `mapping "${String(m.local)}" in "${String(s.id)}" needs the date its source was read. Example: "2026-10-18".`);
      }
    });
  });
}
