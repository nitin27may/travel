// `pnpm --dir web snapshot:check`: fails when a generated file is not what the seed data produces.
import { expect, it } from 'vitest';
import { snapshotRun } from './run';

it('snapshot files match the seed data', async () => { expect(await snapshotRun(true), 'stale snapshot files').toEqual([]); });
