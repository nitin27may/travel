import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
import { assembleInto, resetBuiltViews } from '../helpers/built';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const root = path.resolve(web, '..');
const next = path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next');

/**
 * The family the specs expect is set here, not read from a local .env.local: Next never overrides a variable that is
 * already defined (an empty one included), so a developer's google-js settings cannot change what the tests build.
 */
export const BUILD_ENV = { NEXT_PUBLIC_PLACE_MAP_FAMILY: 'maplibre', NEXT_PUBLIC_GOOGLE_MAPS_KEY: '', NEXT_PUBLIC_GOOGLE_MAP_ID: '' };

/** The build line of web/package.json, step by step (a unit test keeps the two in step): renditions and share images come BEFORE `next build`. */
const BUILD_STEPS: string[][] = [
  [path.join(web, 'scripts', 'images.mjs'), '--prebuild'],
  [path.join(web, 'scripts', 'og.mjs'), '--prebuild'],
  [next, 'build'],
  [path.join(web, 'scripts', 'images.mjs'), '--verify'],
];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** node:http, not fetch: undici asserts when a request lands on a server that is still starting under load. */
async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server at ${url} did not start`);
}

/**
 * The site runs as it will in production: the rendition and share-image steps (they write web/public/img and og before `next build`, which the Vercel adapter needs and
 * `next start` lists public/ when it starts), `next build`, the verify step, then ONE `next start` on a free port shared by every worker.
 *
 * - SKIP_WEB_BUILD=1 reuses the build in web/.next (check-all has just built it).
 * - PW_REUSE_SITE=1 with PW_SITE_URL reuses a server that is already running; nothing is built or started and nothing is killed.
 * - The URL and PID go to the workers through PW_SITE_URL and PW_SITE_PID (a worker inherits the environment set here). The returned
 *   teardown kills that PID, never a process by name.
 *
 * One `next build` per distDir at a time: do not run this while another build of web/.next is in flight.
 */
export default async function setup(): Promise<(() => void) | void> {
  if (process.env.PW_REUSE_SITE === '1') {
    if (!process.env.PW_SITE_URL) throw new Error('PW_REUSE_SITE=1 needs PW_SITE_URL');
    return;
  }
  const env = { ...process.env, HUB_TODAY: '2026-10-17', NEXT_DIST_DIR: '', ...BUILD_ENV };
  if (process.env.SKIP_WEB_BUILD !== '1') {
    for (const args of BUILD_STEPS) {
      execFileSync(process.execPath, args, { cwd: web, stdio: 'pipe', env });
    }
  }
  // specs that serve the build as plain files (globe.stage4, globe.features.gpu) read an export-shaped copy in <repo>/.site (gitignored)
  resetBuiltViews(['.next']);
  rmSync(path.join(root, '.site'), { recursive: true, force: true });
  assembleInto(path.join(root, '.site'));

  const port = await freePort();
  const child = spawn(process.execPath, [next, 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: web, stdio: 'ignore', env: { ...env, NODE_ENV: 'production' } });
  const pid = child.pid as number;
  const url = `http://127.0.0.1:${port}`;
  const stop = () => {
    try {
      process.kill(pid);
    } catch {
      /* already gone */
    }
  };
  try {
    await waitFor(`${url}/`);
  } catch (e) {
    stop();
    throw e;
  }
  process.env.PW_SITE_URL = url;
  process.env.PW_SITE_PID = String(pid);
  return stop;
}
