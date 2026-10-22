// Shared by write.test.ts and check.test.ts. Loads the seed .ts files and runs the generator over them.
import { runSnapshot } from '../snapshot-prototype.mjs';
import * as trip from '../../../data/seed/prototype/trip';
import * as places from '../../../data/seed/prototype/places';
import * as trails from '../../../data/seed/prototype/trails';
import * as pub from '../../../data/seed/prototype/public-trips';

/** Returns the generated files that differ from disk; with check = false it writes them first. */
export async function snapshotRun(check: boolean): Promise<string[]> {
  const seed = {
    TRIP: trip.TRIP, PLACES: places.PLACES,
    TRAILS: trails.TRAILS, ACCESS: trails.ACCESS, CHECK_KINDS: trails.CHECK_KINDS, LINK_KINDS: trails.LINK_KINDS,
    LINK_GROUPS: trails.LINK_GROUPS, FIELDS: trails.FIELDS, GROUPS: trails.GROUPS, DIFFICULTY: trails.DIFFICULTY,
    PUBLIC_TRIPS: pub.PUBLIC_TRIPS,
  };
  return runSnapshot(seed, async () => {
    process.chdir(new URL('../../', import.meta.url).pathname); // the loaders resolve the repo root from cwd = web/
    return import('../../lib/public/cli');
  }, check);
}
