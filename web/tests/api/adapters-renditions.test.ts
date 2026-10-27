import { describe, expect, it, vi } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { placeShards } from '@/app/places/shards';
import { createApiClient } from '@/lib/client/api';
import { callsFromStore } from '@/lib/client/stub';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { withRenditions } from '@/lib/server/images';
import { createJsonSource } from '@/lib/server/source';

// Split from adapters.test.ts (WF-3b): this one test compares photos with the renditions the build cuts from the photo cache, which a
// CI runner does not have (Q-W5), so tools/gate/map.json leaves only this file out of CI. The rest of the adapter tests run there.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');

const real = createApiClient(callsFromStore(new JsonStore(createJsonSource()), true));

describe('ApiAdapter over JsonStore (renditions)', () => {
  it('builds each country file as the build writes it, photos as the rendition the build rewrote them to (rows, keys and default order)', async () => {
    const files = placeShards().files;
    const ids = Object.keys(files).filter((id) => id !== 'xx');
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) {
      const got = await real.shardRows('place', id, placeDescriptor as never);
      expect(JSON.parse(JSON.stringify(got)), id).toEqual(JSON.parse(JSON.stringify(withRenditions(files[id]))));
    }
  });
});
