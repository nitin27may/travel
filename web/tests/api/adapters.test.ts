import { describe, expect, it, vi } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import { placeShards } from '@/app/places/shards';
import { createApiClient } from '@/lib/client/api';
import { createStubClient, callsFromStore } from '@/lib/client/stub';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
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

describe('StubAdapter', () => {
  const stub = createStubClient();
  it('answers from the in-memory StubStore through the same adapter', async () => {
    const tree = await stub.globeTree();
    expect(tree.continents.length).toBeGreaterThan(0);
    const r = await stub.search('glacier');
    expect(r.counts.places).toBeGreaterThan(0);
  });
});
