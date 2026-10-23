// `node scripts/legs-ors.mjs` runs this under vitest to read the route model: it reads the trip slugs from tools/.cache/legs-ors/request.json
// and writes each trip's pairs to pairs.json beside it.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { routePairs } from './pairs';

const DIR = path.resolve(process.cwd(), '..', 'tools', '.cache', 'legs-ors');

it('writes the route-model pairs', async () => {
  const slugs: string[] = JSON.parse(readFileSync(path.join(DIR, 'request.json'), 'utf8'));
  const all: Record<string, unknown> = {};
  for (const s of slugs) all[s] = await routePairs(s);
  writeFileSync(path.join(DIR, 'pairs.json'), JSON.stringify(all));
});
