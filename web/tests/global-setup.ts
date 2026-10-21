import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetBuiltViews } from './helpers/built';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const next = path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next');

/**
 * The build tests (privacy, budget, og, fonts, analytics) need real builds. They run once here, in
 * order: the real app (web/.next, server mode, then the rendition and share-image steps that write web/public/img and og),
 * the fixture app (.fixture-out), and the fixture app with the analytics beacon on (.fixture-beacon).
 * SKIP_WEB_BUILD=1 reuses web/.next when `pnpm build` just ran (check-all does this). The tests read an export-shaped view
 * of each build (tests/helpers/built.ts); the views are dropped here and assembled again on first use.
 */
export default function setup() {
  if (process.env.SKIP_WEB_BUILD !== '1') {
    execFileSync(process.execPath, [next, 'build'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_DIST_DIR: '' } });
    execFileSync(process.execPath, [path.join(web, 'scripts', 'images.mjs')], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_DIST_DIR: '' } });
    execFileSync(process.execPath, [path.join(web, 'scripts', 'og.mjs')], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_DIST_DIR: '' } });
  }
  resetBuiltViews(['.next']);
  const fixture = path.join(web, 'scripts', 'build-fixture.mjs');
  execFileSync(process.execPath, [fixture, '.fixture-out'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_PUBLIC_CF_BEACON_TOKEN: '' } });
  execFileSync(process.execPath, [fixture, '.fixture-beacon'], { cwd: web, stdio: 'pipe', env: { ...process.env, NEXT_PUBLIC_CF_BEACON_TOKEN: 'beacon-test-token' } });
  resetBuiltViews(['.fixture-out', '.fixture-beacon']);
}
