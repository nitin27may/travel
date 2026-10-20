// Writes .cache/places.json (the public place cards) and .cache/parser.json (what the merged phase 1 parser and the Places list do
// with each labelled query). Run from web/:  pnpm exec vitest run -c scripts/embed-spike/vitest.config.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { listPlaces, legacyPlaceRedirects, getPlace } from '@/lib/public';
import { loadPlaces } from '@/lib/data/places';
import { buildPlaceRows } from '@/components/places/rows';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { matchesRow } from '@/lib/entities/filter';
import { decodeState } from '@/lib/entities/url';
import { sortRows } from '@/lib/entities/sort';
import { uncheckedRows } from '@/lib/entities/gaps';
import { parse } from '@/lib/search/parse/parse';
import { buildSearchParts } from '@/lib/search/build';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '..', '..');

test('dump public places and parser output', () => {
  const cards = listPlaces();
  const places = cards.map((p) => ({
    slug: p.slug, name: p.name, kindLabel: p.kindLabel, type: p.type, areaLabel: p.areaLabel,
    areaChain: p.areaChain.map((a) => a.name), cc: p.areaChain.find((a) => a.level === 'country')?.slug ?? 'xx', summary: p.summary, tags: p.tags,
  }));
  mkdirSync(path.join(here, '.cache'), { recursive: true });
  writeFileSync(path.join(here, '.cache', 'places.json'), JSON.stringify(places));

  const rows = buildPlaceRows(cards, loadPlaces(), legacyPlaceRedirects(), (slug) => getPlace(slug)?.elevationM ?? null);
  const vocab = JSON.parse(readFileSync(path.join(web, 'public/search/vocab.json'), 'utf8'));
  const records = Object.values(buildSearchParts().parts).flat();
  const labels = JSON.parse(readFileSync(path.join(here, 'labels.json'), 'utf8')).queries;
  const d = placeDescriptor;
  const out = {};
  for (const l of labels) {
    const got = parse(l.query, vocab, records, { target: 'places' });
    const href = got.href.includes('?') ? got.href.split('?')[1] : '';
    const state = decodeState(href);
    const noQ = { ...state, q: '' };
    const filtered = rows.filter((r) => matchesRow(r, noQ, d));
    const listed = rows.filter((r) => matchesRow(r, state, d));
    // the soft pool: only where and what (country, region, area, type). Band filters (kids, effort, season, f.*) are mostly unanswered in the public data, so rows are kept and flagged instead of dropped
    const WHERE = ['country', 'region', 'area', 'k', 'kind'];
    const soft = { ...noQ, facets: Object.fromEntries(Object.entries(state.facets).filter(([k]) => WHERE.includes(k))) };
    const softPool = rows.filter((r) => matchesRow(r, soft, d));
    const unchecked = uncheckedRows(rows, noQ, d).flatMap((g) => g.rows.map((r) => r.id));
    out[l.id] = {
      query: l.query,
      target: got.target,
      chips: got.chips.map((c) => c.label),
      href,
      leftoverQ: got.q,
      unused: got.unused,
      notYet: got.notYet,
      filtersApplied: Object.keys(state.facets).length,
      // (a) the list as phase 1 shows it: facets plus the leftover words as a substring filter, default order
      listOrder: sortRows(listed, state, d).map((r) => r.id),
      // (a') the facets alone, default order
      filterOrder: sortRows(filtered, noQ, d).map((r) => r.id),
      pool: filtered.map((r) => r.id),
      softPool: softPool.map((r) => r.id),
      unchecked,
    };
  }
  writeFileSync(path.join(here, '.cache', 'parser.json'), JSON.stringify(out, null, 1));
  console.log(`places ${places.length}; queries ${labels.length}`);
});
