// `pnpm --dir web snapshot`: regenerates web/data-snapshots/prototype.json, snapshot-report.json and web/redirects.json
// from data/seed/prototype/. Not part of `pnpm test` (that config only includes tests/).
import { it } from 'vitest';
import { snapshotRun } from './run';

it('writes the snapshot files from the seed data', async () => { await snapshotRun(false); });
