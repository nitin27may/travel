import { areas, countries, place_tags, places, regions, sources, tags, visits } from '@travel/core/schema/locations.ts';

// The store is checked against the same Zod schemas the Python validator is tested against. The
// schema's table() erases column types, so z.infer gives only Record<string, unknown>: the typed
// views of a row stay local (lib/data/types.ts) and this check keeps them honest at build time.
const CHECKED = { countries, regions, areas, places, place_tags, tags, sources, visits } as const;

export function validateStore(store: Record<string, unknown>): void {
  const problems: string[] = [];
  for (const [name, table] of Object.entries(CHECKED)) {
    const rows = store[name];
    if (!Array.isArray(rows)) {
      problems.push(`${name}: missing`);
      continue;
    }
    rows.forEach((row, i) => {
      const r = table.schema.safeParse(row);
      if (!r.success) problems.push(`${name}[${i}]: ${r.error.issues.slice(0, 2).map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    });
  }
  if (problems.length) throw new Error(`locations.json does not match the core schema:\n  ${problems.slice(0, 10).join('\n  ')}`);
}
