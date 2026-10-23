import { describe, expect, it, vi } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import { placeShards } from '@/app/places/shards';
import type { PlaceListRow } from '@/components/places/rows';
import { createApiClient } from '@/lib/client/api';
import { createStubClient, callsFromStore } from '@/lib/client/stub';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { filterRows, matchesRow } from '@/lib/entities/filter';
import { uncheckedRows } from '@/lib/entities/gaps';
import { emptyState } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';
import { placeTextShards } from '@/app/places/shards';
import { searchTexts } from '@/lib/search/fulltext';
import { buildGlobeFiles } from '@/lib/globe/data';
import { buildSearchParts } from '@/lib/search/build';
import { createSearcher } from '@/lib/search/search';
import { tripExportFor, placeExportFor } from '@/lib/export/build.server';
import { withRenditions } from '@/lib/server/images';
import { createJsonSource } from '@/lib/server/source';

// The ApiAdapter over a store in memory (no network): what the browser's adapter returns, checked against what the StaticAdapter's
// files hold, so swapping the adapter changes no answer.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');

const real = createApiClient(callsFromStore(new JsonStore(createJsonSource()), true));

describe('ApiAdapter over JsonStore', () => {
  it('builds each country file as the build writes it, photos as the rendition the build rewrote them to (rows, keys and default order)', async () => {
    const files = placeShards().files;
    const ids = Object.keys(files).filter((id) => id !== 'xx');
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) {
      const got = await real.shardRows('place', id, placeDescriptor as never);
      expect(JSON.parse(JSON.stringify(got)), id).toEqual(JSON.parse(JSON.stringify(withRenditions(files[id]))));
    }
  });

  it('answers search like the browser searcher, and trims each group to the sizes it always showed', async () => {
    const all = Object.values(buildSearchParts().parts).flat();
    const want = createSearcher(all).search('lake');
    const got = await real.search('lake');
    expect(got.counts).toEqual(want.counts);
    expect(got.groups.map((g) => [g.id, g.hits.length])).toEqual(want.groups.map((g) => [g.id, g.hits.length]));
    expect(got.partial).toBe(false);
  });

  it('serves one export as the model the page carries', async () => {
    const trip = buildGlobeFiles().pins['ca']!.find((p) => p.kind === 'trip')!.slug;
    expect(await real.loadExport('trip', trip)).toEqual(JSON.parse(JSON.stringify(tripExportFor(trip))));
    const place = buildGlobeFiles().pins['ca']!.find((p) => p.kind === 'place')!.slug;
    expect(await real.loadExport('place', place)).toEqual(JSON.parse(JSON.stringify(placeExportFor(place))));
  });

  it('reads the globe: the tree, one country of pins, one card, and no card for a key that is not on it', async () => {
    const files = buildGlobeFiles();
    expect(await real.globeTree()).toEqual(JSON.parse(JSON.stringify(files.tree)));
    expect(await real.globePins({ country: 'ca' })).toEqual(JSON.parse(JSON.stringify(files.pins['ca'])));
    const key = Object.keys(files.cards)[0]!.replace('/', ':');
    expect((await real.globeCard(key))?.card.key).toBe(key);
    expect(await real.globeCard('place:no-such-place-anywhere')).toBeNull();
    expect(await real.globeCard('everything')).toBeNull();
  });

  it('reads a line by feature id, and null for an unknown id', async () => {
    expect(await real.globeLine('no-such-line-anywhere')).toBeNull();
    expect((await real.globeLine('abay'))?.id).toBe('abay');
  });

  it('parses a query like the pure parser would on the server', async () => {
    const got = await real.parseQuery('easy hike near Banff in September');
    expect(got.target).toBe('places');
    expect(got.chips.length).toBeGreaterThan(0);
  });

  it('keeps report off while the product has no feedback form, without asking the server', async () => {
    const ask = vi.fn();
    const client = createApiClient({ ...callsFromStore(new StubStore()), report: ask });
    expect(await client.reportProblem({ page: '/places/x/' })).toEqual({ kind: 'off' });
    expect(ask).not.toHaveBeenCalled();
  });
});

// The server's evaluation against the browser's, over the same rows: the swap changes no number, no unchecked row and no ranking (API-3, P9).
describe('ApiAdapter evaluates on the server what the browser evaluated', () => {
  const rows = Object.entries(placeShards().files).filter(([id]) => id !== 'xx').flatMap(([, r]) => r) as unknown as PlaceListRow[];
  const d = placeDescriptor as never;
  const state = (over: Partial<ListState>): ListState => ({ ...emptyState(), ...over });
  const states: ListState[] = [
    state({ facets: { country: ['IT'] } }),
    state({ facets: { country: ['CA'], kind: ['lake'] } }),
    state({ facets: { effort: ['moderate'] } }),
    state({ facets: { kid: ['yes'] } }),
    state({ facets: { country: ['CA'], stroller: ['all-terrain'] } }),
  ];

  it('counts a state like filterRows does, and the unchecked rows like uncheckedRows does', async () => {
    for (const s of states) {
      const got = await real.countPlaces!(s);
      expect(got?.n, JSON.stringify(s.facets)).toBe(filterRows(rows, s, d).length);
      expect(got?.unchecked, JSON.stringify(s.facets)).toBe(uncheckedRows(rows, s, d).reduce((n, g) => n + g.rows.length, 0));
    }
  });

  it('counts a parse merged into nothing like the state it opens', async () => {
    const parsed = { q: '', facets: { country: ['IT'], kind: ['trail'] } };
    const got = await real.countPlaces!(emptyState(), parsed);
    expect(got?.n).toBe(filterRows(rows, state({ facets: parsed.facets }), d).length);
  });

  it('lists the unchecked slugs per constraint, in the browser\'s group order', async () => {
    for (const s of states) {
      const local = uncheckedRows(rows, s, d);
      const got = await real.uncheckedGroups!(s);
      expect(got?.map((g) => [g.param, [...g.slugs].sort()]), JSON.stringify(s.facets)).toEqual(local.map((g) => [g.param, g.rows.map((r) => r.slug).sort()]));
      expect(got?.map((g) => [g.label, g.note])).toEqual(local.map((g) => [g.label, g.note]));
    }
  });

  it('counts free text on the server by the list\'s own word rule (HYG, review API3-R-7), the same n the rows beside it show', async () => {
    const texts: ListState[] = [
      state({ q: 'lake' }),
      state({ q: 'National  PARK' }),
      state({ q: 'lake', facets: { country: ['CA'] } }),
      state({ q: 'falls', facets: { kid: ['yes'] } }),
    ];
    for (const s of texts) {
      const got = await real.countPlaces!(s);
      expect(got?.n, JSON.stringify([s.q, s.facets])).toBe(filterRows(rows, s, d).length);
      expect(got?.unchecked, JSON.stringify([s.q, s.facets])).toBe(uncheckedRows(rows, s, d).reduce((n, g) => n + g.rows.length, 0));
    }
    const parsed = { q: 'lake', facets: { country: ['CA'] } };
    expect((await real.countPlaces!(emptyState(), parsed))?.n).toBe(filterRows(rows, state({ q: 'lake', facets: parsed.facets }), d).length);
    const s = state({ q: 'lake', facets: { kid: ['yes'] } });
    const local = uncheckedRows(rows, s, d);
    const got = await real.uncheckedGroups!(s);
    expect(got?.map((g) => [g.param, [...g.slugs].sort()])).toEqual(local.map((g) => [g.param, g.rows.map((r) => r.slug).sort()]));
  });

  it('refuses a state it cannot read (an advanced filter, a saved view), so the browser evaluates it', async () => {
    expect(await real.countPlaces!(state({ f: 'x', facets: { country: ['IT'] } }))).toBeNull();
    expect(await real.uncheckedGroups!(state({ sv: 'mine', facets: { country: ['IT'] } }))).toBeNull();
    expect(await real.cardRank!(state({ f: 'x', q: 'lake' }))).toBeNull();
  });

  it('ranks the cards like the full-text pass, best first', async () => {
    const words = 'turquoise';
    const s = state({ q: words });
    const local = searchTexts(Object.values(placeTextShards()), words).filter((h) => rows.some((r) => r.slug === h.id && matchesRow(r, s, d, 'q')));
    const got = await real.cardRank!(s);
    expect(got).toEqual(local.map((h) => h.id));
    expect(got!.length).toBeGreaterThan(0);
  });
});

describe('StubAdapter', () => {
  const stub = createStubClient();
  it('answers from the in-memory StubStore through the same adapter', async () => {
    const tree = await stub.globeTree();
    expect(tree.continents.length).toBeGreaterThan(0);
    const r = await stub.search('glacier');
    expect(r.counts.places).toBeGreaterThan(0);
  });
});
