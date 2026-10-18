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
export const SITE = path.join(ROOT, '.site');

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
  const child: ChildProcess = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
  const pid = child.pid as number;
  const url = `http://127.0.0.1:${port}`;
  await waitFor(`${url}/`);
  return { url, pid, stop: () => process.kill(pid) };
}

/** A temp copy of the legacy list page at /legacy-locations/, served on its own port. */
async function serveLegacyList(): Promise<Server> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'legacy-locations-'));
  mkdirSync(path.join(tmp, 'legacy-locations'));
  cpSync(path.join(ROOT, 'legacy', 'locations', 'index.html'), path.join(tmp, 'legacy-locations', 'index.html'));
  return serve(tmp);
}

export const test = base.extend<{ blockRemote: void }, { site: Server; legacy: Server }>({
  site: [
    async ({}, use) => {
      const s = await serve(SITE);
      await use(s);
      s.stop();
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
    async ({ page }, use) => {
      await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
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
