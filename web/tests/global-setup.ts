import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const next = path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next');

/**
 * The export tests (privacy, budget, og, fonts, analytics) need real builds. They run once here, in
 * order: the real app (web/out), the fixture app (.fixture-out), and the fixture app with the
 * analytics beacon on (.fixture-beacon). SKIP_WEB_BUILD=1 reuses web/out when `pnpm build` just ran.
 */
export default function setup() {
  if (process.env.SKIP_WEB_BUILD !== '1') {
    execFileSync(process.execPath, [next, 'build'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_DIST_DIR: '' } });
  }
  const fixture = path.join(web, 'scripts', 'build-fixture.mjs');
  execFileSync(process.execPath, [fixture, '.fixture-out'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_PUBLIC_CF_BEACON_TOKEN: '' } });
  execFileSync(process.execPath, [fixture, '.fixture-beacon'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_PUBLIC_CF_BEACON_TOKEN: 'beacon-test-token' } });
}
