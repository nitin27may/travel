// Builds the app against tests/fixtures/root into a separate dist dir, so the privacy test never
// touches the real export. Usage: node scripts/build-fixture.mjs [outDirName]
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.argv[2] || '.fixture-out';
const root = path.join(web, 'tests', 'fixtures', 'root');
rmSync(path.join(web, dist), { recursive: true, force: true });

const r = spawnSync(process.execPath, [path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
  cwd: web,
  stdio: 'inherit',
  env: {
    ...process.env,
    TRAVEL_ROOT: root,
    LEGACY_TRIPS_JSON: path.join(root, 'legacy-trips.json'),
    NEXT_DIST_DIR: dist,
    HUB_TODAY: '2026-10-17',
    SITE_ORIGIN: 'https://example.test',
  },
});
process.exit(r.status ?? 1);
