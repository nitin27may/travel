// Writes web/.generated/slug-snapshot.json (gitignored): every identity key the dataset builder gave a slug, and every region the
// Places rows carry with its spellings. `node core/bin/slugs.ts` compares it with data/catalogue/slugs.json (D-B1, D-B3).
// Named *.dump.mjs so neither core's nor web's own test run picks it up, and plain JS so core's typecheck (which cannot resolve web's
// `@/` imports) skips it.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { loadSources } from '@/lib/public/sources';
import { buildPlaces } from '@/lib/public/places';
import { createPublicData } from '@/lib/public';
import { buildPlaceRows } from '@/components/places/rows';
import { loadPlaces } from '@/lib/data/places';

const OUT = path.resolve(process.cwd(), '.generated', 'slug-snapshot.json');

it('dumps the slug snapshot', () => {
  const pb = buildPlaces(loadSources());
  const data = createPublicData();
  const rows = buildPlaceRows(data.listPlaces(), loadPlaces(), data.legacyPlaceRedirects());
  /** @type {Record<string, { name: string; aliases: string[] }>} */
  const regions = {};
  for (const r of rows) {
    if (!r.country || !r.region) continue;
    const key = `${r.country.toLowerCase()}/${r.region}`;
    const had = regions[key];
    regions[key] = { name: had?.name ?? r.region_name, aliases: [...new Set([...(had?.aliases ?? []), ...r.regionAliases])] };
  }
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ places: Object.fromEntries(pb.slugByRef), regions }, null, 1)}\n`);
});
