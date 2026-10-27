import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// An export-shaped copy of the server build (tests/helpers/built.ts, assembled by global-setup; gitignored), for the specs that serve files
// directly and read web/redirects.json relative to it. The shared `site` server below is `next start`, not this directory.
export const SITE = path.join(ROOT, '.site');

/**
 * For the specs that serve the export-shaped `.site` copy as plain files (globe.stage4, globe.features.gpu): that copy has no /api/v1, which the
 * ApiAdapter (the default data path since API-1b) reads. They test the globe UI, not the transport, so every /api/ and /globe-data/ request is
 * forwarded to the shared `next start` server (PW_SITE_URL) and answered by the real handlers. Returns true when it handled the request.
 */
export function forwardData(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = req.url ?? '/';
  if (!/^\/(api|globe-data)\//.test(url)) return false;
  const target = new URL(url, process.env.PW_SITE_URL);
  const up = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(up);
  return true;
}

export interface Server {
  url: string;
  pid: number;
  stop: () => void;
}

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

/**
 * Polls until the server answers. Uses node:http, not fetch: undici throws an internal `assert(!this.paused)` when a
 * request lands on a server that is still starting under CPU load, and that failed the first test of a worker.
 */
async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 150; i++) {
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

/** `python3 -m http.server` on a free port; stopped by its own PID, never by name. */
export async function serve(dir: string): Promise<Server> {
  const port = await freePort();
  // `python3 -m http.server` listens with a backlog of 5, so a page that fetches 15 shards at once under load got ERR_CONNECTION_RESET and never finished
  // loading (the "Counting..." that failed ten specs at 30 s). Same server, a backlog of 256.
  const code = 'import sys, functools, http.server as h; h.ThreadingHTTPServer.request_queue_size = 256; ' +
    'h.test(HandlerClass=functools.partial(h.SimpleHTTPRequestHandler, directory=sys.argv[2]), ServerClass=h.ThreadingHTTPServer, port=int(sys.argv[1]), bind="127.0.0.1")';
  const child: ChildProcess = spawn('python3', ['-c', code, String(port), dir], { stdio: 'ignore' });
  const pid = child.pid as number;
  const url = `http://127.0.0.1:${port}`;
  await waitFor(`${url}/`);
  return { url, pid, stop: () => process.kill(pid) };
}

/** `next start` over a fixture build in `distDir` (a spec that builds its own variant), on a free port; stopped by its own PID. */
export async function startNext(distDir: string): Promise<Server> {
  const port = await freePort();
  const web = path.join(ROOT, 'web');
  const child: ChildProcess = spawn(process.execPath, [path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: web,
    stdio: 'ignore',
    env: { ...process.env, NEXT_DIST_DIR: distDir, NODE_ENV: 'production' },
  });
  const pid = child.pid as number;
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${url}/`);
  } catch (e) {
    process.kill(pid);
    throw e;
  }
  return { url, pid, stop: () => process.kill(pid) };
}

const signInCache = new Map<string, boolean>();

/**
 * Whether the shared build has the account path on (`NEXT_PUBLIC_SIGN_IN=1`, as release B+C ships): its /sign-in/ is the card's page,
 * not the one-screen notice. The specs that describe the public shell assert the flag-off state only when this is false, and the
 * sign-in state otherwise, so the suite passes on either build (GSI-1).
 */
export async function signInBuild(site: Server): Promise<boolean> {
  const known = signInCache.get(site.url);
  if (known !== undefined) return known;
  const html = await new Promise<string>((resolve, reject) => {
    http.get(`${site.url}/sign-in/`, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
  const on = html.includes('class="auth-page"');
  signInCache.set(site.url, on);
  return on;
}

/** A temp copy of the legacy list page at /legacy-locations/, served on its own port. */
async function serveLegacyList(): Promise<Server> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'legacy-locations-'));
  mkdirSync(path.join(tmp, 'legacy-locations'));
  cpSync(path.join(ROOT, 'legacy', 'locations', 'index.html'), path.join(tmp, 'legacy-locations', 'index.html'));
  return serve(tmp);
}

export const test = base.extend<{ blockRemote: void; allowRemote: boolean }, { site: Server; legacy: Server }>({
  // `test.use({ allowRemote: true })` lets a spec reach real tile servers (the cross-browser basemap check)
  allowRemote: [false, { option: true }],
  site: [
    // One `next start` for the whole run, started by global-setup (or PW_REUSE_SITE=1 with PW_SITE_URL); workers only read its URL.
    async ({}, use) => {
      const url = process.env.PW_SITE_URL;
      if (!url) throw new Error('no site: tests/e2e/global-setup.ts starts `next start` and sets PW_SITE_URL');
      await use({ url, pid: Number(process.env.PW_SITE_PID ?? 0), stop: () => {} });
    },
    { scope: 'worker' },
  ],
  legacy: [
    async ({}, use) => {
      const s = await serveLegacyList();
      await use(s);
      s.stop();
    },
    { scope: 'worker' },
  ],
  // no network in tests: photos fall back to the tinted placeholder, fonts are local
  blockRemote: [
    async ({ page, allowRemote }, use) => {
      if (!allowRemote) await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export interface StoreRows {
  places: { id: string; area_id: string; kind: string; status: string; kid_fit: string; season_months: number[] }[];
  regions: { id: string; country: string; code: string; name: string }[];
  areas: { id: string; region_id: string; slug: string; name: string }[];
  place_tags: { place_id: string; tag_id: string }[];
}

export function readStore(): StoreRows {
  return JSON.parse(readFileSync(path.join(ROOT, 'data', 'locations', 'locations.json'), 'utf8')) as StoreRows;
}

/**
 * Waits until `read` returns the same value on two reads `quietMs` apart, then returns it. For values a page writes more than once while it
 * hydrates or re-renders (a title, a link, a count): the spec compares the settled value, not the first one it saw.
 */
export async function settledValue<T>(read: () => Promise<T>, opts: { quietMs?: number; timeout?: number; message?: string } = {}): Promise<T> {
  const { quietMs = 300, timeout = 10_000, message = 'the value never settled' } = opts;
  const started = Date.now();
  let prev = JSON.stringify(await read().catch(() => undefined));
  for (;;) {
    await new Promise((r) => setTimeout(r, quietMs));
    const value = await read().catch(() => undefined);
    const now = JSON.stringify(value);
    if (now === prev && value !== undefined) return value as T;
    if (Date.now() - started > timeout) throw new Error(message);
    prev = now;
  }
}

/**
 * `expect` with a 30 s wait. Under load (several suites on one machine) a page needs longer than the 10 s default to hydrate and load its rows;
 * the assertions are the same and still wait for the settled value, they just give a slow machine the time it needs.
 */
export const expectSlow = expect.configure({ timeout: 30_000 });
