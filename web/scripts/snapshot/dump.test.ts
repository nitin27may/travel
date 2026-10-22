// Regenerates (or, with SNAPSHOT_CHECK=1, compares) web/data-snapshots/prototype.json, snapshot-report.json and
// web/redirects.json from data/seed/prototype/. Run through `pnpm --dir web snapshot` / `snapshot:check`; it is
// not part of `pnpm test` (the vitest config there only includes tests/).
import { expect, it } from 'vitest';
import { runSnapshot } from '../snapshot-prototype.mjs';
import * as trip from '../../../data/seed/prototype/trip';
import * as places from '../../../data/seed/prototype/places';
import * as trails from '../../../data/seed/prototype/trails';
import * as pub from '../../../data/seed/prototype/public-trips';

it('snapshot files match the seed data', async () => {
  const seed = {
    TRIP: trip.TRIP, PLACES: places.PLACES,
    TRAILS: trails.TRAILS, ACCESS: trails.ACCESS, CHECK_KINDS: trails.CHECK_KINDS, LINK_KINDS: trails.LINK_KINDS,
    LINK_GROUPS: trails.LINK_GROUPS, FIELDS: trails.FIELDS, GROUPS: trails.GROUPS, DIFFICULTY: trails.DIFFICULTY,
    PUBLIC_TRIPS: pub.PUBLIC_TRIPS,
  };
  const check = process.env.SNAPSHOT_CHECK === '1';
  const stale = await runSnapshot(seed, async () => {
    process.chdir(new URL('../../', import.meta.url).pathname); // the loaders resolve the repo root from cwd = web/
    return import('../../lib/public/cli');
  }, check);
  if (check) expect(stale, 'stale snapshot files').toEqual([]);
});
