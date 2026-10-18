import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The family the specs expect is set here, not read from a local .env.local: Next never overrides a variable that is
 * already defined (an empty one included), so a developer's google-js settings cannot change what the tests build.
 */
export const BUILD_ENV = { NEXT_PUBLIC_PLACE_MAP_FAMILY: 'maplibre', NEXT_PUBLIC_GOOGLE_MAPS_KEY: '', NEXT_PUBLIC_GOOGLE_MAP_ID: '' };

/** Stage .site/ (app plus every legacy route) so the specs test what publish would deploy. */
export default function setup() {
  if (process.env.PW_REUSE_SITE === '1') return;
  execFileSync('python3', [path.join(root, 'tools', 'publish.py'), '--dry-run'], { cwd: root, stdio: 'pipe', env: { ...process.env, HUB_TODAY: '2026-10-17', ...BUILD_ENV } });
}
