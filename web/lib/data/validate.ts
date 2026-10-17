import { areas, countries, place_tags, places, regions, sources, tags, visits } from '@travel/core/schema/locations.ts';

// locations.json (schema v3) holds everything but the tag vocabulary, which lives in
// data/vocab/tags.json. Both are checked against core's Zod schemas on every build. The schema's
// table() erases column types, so z.infer gives only Record<string, unknown>: the typed row views
// stay local (lib/data/types.ts) and this check keeps them honest.
const CHECKED = { countries, regions, areas, places, place_tags, sources, visits } as const;

function checkRows(label: string, table: { schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } } }, rows: unknown, problems: string[]) {
  if (!Array.isArray(rows)) {
    problems.push(`${label}: missing`);
    return;
  }
  rows.forEach((row, i) => {
    const r = table.schema.safeParse(row);
    if (!r.success) problems.push(`${label}[${i}]: ${(r.error?.issues ?? []).slice(0, 2).map((x) => `${x.path.map(String).join('.')}: ${x.message}`).join('; ')}`);
  });
}

export function validateStore(store: Record<string, unknown>, vocab: Record<string, unknown>): void {
  const problems: string[] = [];
  if (store.schema_version !== 3) problems.push(`locations.json: schema_version must be 3, got ${JSON.stringify(store.schema_version)}`);
  for (const [name, table] of Object.entries(CHECKED)) checkRows(name, table, store[name], problems);
  checkRows('tags', tags, vocab.tags, problems);
  if (problems.length) throw new Error(`data does not match the core schema:\n  ${problems.slice(0, 10).join('\n  ')}`);
}
