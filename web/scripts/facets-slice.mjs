// Writes web/lib/entities/facets/contract-slice.json from data/schema/capture/contract.json and data/vocab/types.json.
// `--check` fails when the committed file is out of date (the vitest drift test does the same).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'web/lib/entities/facets/contract-slice.json');
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const { sliceContract } = await import('../lib/entities/facets/slice.ts');
const text = JSON.stringify(sliceContract(read('data/schema/capture/contract.json'), read('data/vocab/types.json')), null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) {
    console.error('contract-slice.json is out of date: run `node web/scripts/facets-slice.mjs`');
    process.exit(1);
  }
} else writeFileSync(out, text);
