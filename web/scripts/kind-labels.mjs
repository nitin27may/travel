// Writes web/lib/entities/kind-labels.json: the visitor-facing label of each place kind, read from data/vocab/types.json (CONS-2).
// The client bundle must not carry the 122 KB type tree, so the few words it needs are derived here and the drift test
// (tests/entities/kind-labels.test.ts) fails when the file no longer matches types.json. Run: node web/scripts/kind-labels.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The place kinds a card, glyph or timeline stop can name (components 3.1, plus the timeline's activity). */
export const PLACE_KINDS = [
  'trail', 'trailhead', 'parking', 'viewpoint', 'lake', 'waterfall', 'sight', 'town', 'adventure', 'lift', 'hut', 'stay', 'eatery', 'swim_spot', 'event',
  'area', 'scenic_drive', 'activity',
];

/** kind -> label of the type-level node whose last id segment is the kind (`water.body.lake` answers to `lake`). A kind with no type of its own is left out. */
export function kindLabelsFrom(nodes) {
  const byLast = new Map();
  for (const n of nodes) if (n.level === 'type') byLast.set(n.id.slice(n.id.lastIndexOf('.') + 1), n.label);
  return Object.fromEntries(PLACE_KINDS.filter((k) => byLast.has(k)).map((k) => [k, byLast.get(k)]));
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const TYPES = path.resolve(here, '..', '..', 'data', 'vocab', 'types.json');
export const OUT = path.resolve(here, '..', 'lib', 'entities', 'kind-labels.json');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { nodes } = JSON.parse(readFileSync(TYPES, 'utf8'));
  writeFileSync(OUT, JSON.stringify(kindLabelsFrom(nodes), null, 1) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
}
