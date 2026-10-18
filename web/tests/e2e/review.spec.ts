import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { ROOT, expect, serve, test } from './fixtures';
import type { Server } from './fixtures';

// The review queue against the real local server (core/bin/serve.ts) on a temporary root that holds proposals built from
// the sidecar fixtures of core/test/fixtures/sidecars. Nothing here touches data/catalog of the repository.

const CORE = path.join(ROOT, 'core');
const FIXTURE_ROOT = path.join(CORE, 'test', 'fixtures', 'sidecars', 'root');
const WEB = path.join(ROOT, 'web');
const DIST = '.fixture-review';
const SHOTS = process.env.REVIEW_SHOTS;

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

const cli = (root: string, ...args: string[]): string =>
  execFileSync('node', [path.join(CORE, 'bin', 'catalog.ts'), ...args, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, TRAVEL_TODAY: '2026-10-17', TRAVEL_NOW: '2026-10-17T15:00:00Z' },
  });
const proposalId = (out: string): string => /proposal (cp-[^:]+):/.exec(out)![1]!;

const T = 'research/trips/patagonia-fixture';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a JSON document read back from disk, checked field by field below
const read = (root: string, rel: string): any => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const trailIds = (root: string): string[] => (existsSync(path.join(root, 'data/catalog/trails/AR.json')) ? read(root, 'data/catalog/trails/AR.json').trails.map((r: { id: string }) => r.id) : []);

let root = '';
let api: { port: number; pid: number } | null = null;
let app: Server | null = null;
let ids: { trails: string; adventure: string; duplicate: string };

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(420_000);
  root = mkdtempSync(path.join(os.tmpdir(), 'p4b-review-'));
  cpSync(FIXTURE_ROOT, root, { recursive: true });
  for (const rel of ['data/catalog/policy.json', 'data/schema/freshness.json', 'data/schema/difficulty-map.json']) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  }
  // a queue with every kind of change: three trails, activities with an offer and prices, a near-duplicate stay, a review edit
  ids = {
    trails: proposalId(cli(root, 'propose', `${T}/trails.json`)),
    adventure: proposalId(cli(root, 'propose', 'research/trips/rockies-fixture/adventure.json')),
    duplicate: '',
  };
  const stays = proposalId(cli(root, 'propose', 'research/trips/stays-fixture/stays.json'));
  cli(root, 'apply', stays, '--actor', 'agent:stays');
  cli(root, 'apply', ids.trails, '--changes', 'ch-002', '--actor', 'agent:trails');
  cli(root, 'propose', `${T}/trails-update.json`, '--date', '2026-10-21');
  ids.duplicate = proposalId(cli(root, 'propose', 'research/trips/stays-fixture/stays-duplicate.json', '--date', '2026-10-18'));

  const port = await freePort();
  const child = spawn('node', [path.join(CORE, 'bin', 'serve.ts'), '--port', String(port), '--root', root], { stdio: 'ignore', env: { ...process.env, TRAVEL_TODAY: '2026-10-17' } });
  api = { port, pid: child.pid as number };
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // the page with editing switched on, in its own dist dir so the real export is untouched
  const built = spawnSync(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
    cwd: WEB, stdio: 'pipe', env: { ...process.env, NEXT_PUBLIC_EDITING: 'local', NEXT_DIST_DIR: DIST },
  });
  if (built.status !== 0) throw new Error(`next build failed:\n${built.stdout}\n${built.stderr}`);
  app = await serve(path.join(WEB, DIST));
});

test.afterAll(() => {
  if (api) process.kill(api.pid);
  if (app) app.stop();
});

/** the page must be opened on localhost: the local server only accepts that origin */
const open = async (page: Page, query = ''): Promise<void> => {
  await page.goto(`http://localhost:${new URL(app!.url).port}/review/?api=http://127.0.0.1:${api!.port}${query}`);
  await expect(page.locator('.rv-card').first()).toBeVisible();
};

const card = (page: Page, text: string) => page.locator('.rv-card', { has: page.getByRole('heading', { name: text, exact: true }) });

test('the published build says review runs on the owner machine and loads nothing', async ({ page, site }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) calls.push(r.url());
  });
  await page.goto(`${site.url}/review/`);
  await expect(page.getByText("Review runs on the owner's machine", { exact: false })).toBeVisible();
  await expect(page.locator('.rv-card')).toHaveCount(0);
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
  expect(calls).toEqual([]);
  // unlisted: no nav link and not in the sitemap
  await expect(page.locator('.site-nav a[href="/review/"]')).toHaveCount(0);
});

test('the queue puts possible duplicates first, then conflicts, then the rest, each with a diff', async ({ page }) => {
  await open(page);
  const heads = page.locator('.rv-group-head');
  await expect(heads.first()).toContainText('Possible duplicates');
  const dup = page.locator('.rv-card[data-op="add"][data-flags~="possible-duplicate"]');
  await expect(dup).toHaveCount(1);
  await expect(dup).toContainText('Hosteria Pilar');
  await expect(dup).toContainText('Looks like');
  await expect(dup).toContainText('name match');
  // an edit shows what is stored beside what research said
  const edit = page.locator('.rv-card[data-op="edit"]', { hasText: 'Laguna de los Tres' });
  await edit.click();
  await expect(edit.locator('.rv-diff tr[data-kind="alternative"]')).toContainText('22.4');
  await expect(edit.locator('.rv-diff tr[data-kind="alternative"] .rv-was')).toContainText('21.5');
  await expect(edit.locator('.rv-sources li').first()).toContainText('read 2026-10-20');
  // provenance badges: a new row lands proposed and stated, never verified
  const fresh = card(page, 'Senda Costera');
  await expect(fresh.locator('.pv')).toHaveText(['proposed', 'stated']);
  await expect(page.locator('.pv[data-v="verified"]')).toHaveCount(0);
  // the rail counts what is pending per area
  await expect(page.locator('.rv-area').first()).toContainText('All areas');
});

test('accept and reject round trip: keyboard and buttons, files on disk, undo', async ({ page }) => {
  await open(page);
  const before = trailIds(root);
  expect(before).toEqual(['AR/santa-cruz/el-chalten/laguna-de-los-tres']);

  // accept Senda Costera with the button
  const senda = card(page, 'Senda Costera');
  await senda.click();
  await senda.getByRole('button', { name: /Accept/ }).click();
  await expect(page.locator('.rv-toast')).toContainText('Accepted Senda Costera.');
  await expect(card(page, 'Senda Costera')).toHaveCount(0);
  expect(trailIds(root)).toContain('AR/tierra-del-fuego/ushuaia/senda-costera');
  const log = readFileSync(path.join(root, 'data/catalog/changes/2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  expect(log.at(-1)).toMatchObject({ entity: 'trails', op: 'add', id: 'AR/tierra-del-fuego/ushuaia/senda-costera', actor_id: 'u_owner', actor_via: 'ui' });
  const row = read(root, 'data/catalog/trails/AR.json').trails.find((r: { id: string }) => r.id.endsWith('senda-costera'));
  expect(row).toMatchObject({ review_status: 'proposed', confidence: 'stated', verified_by: null });

  // reject Quokka Walk with the keyboard: move to it with j, press r
  const quokka = card(page, 'Quokka Walk');
  await quokka.click();
  await expect(quokka).toHaveAttribute('data-current', '');
  await page.keyboard.press('r');
  await expect(page.locator('.rv-toast')).toContainText('Rejected Quokka Walk.');
  await expect(card(page, 'Quokka Walk')).toHaveCount(0);
  const prop = read(root, `data/catalog/proposals/${ids.adventure}.json`);
  expect(prop.changes.find((c: { id: string }) => c.id.endsWith('quokka-walk')).status).toBe('rejected');
  expect(existsSync(path.join(root, 'data/catalog/activities/CA.json'))).toBe(false);

  // undo brings the rejection back
  await page.keyboard.press('u');
  await expect(card(page, 'Quokka Walk')).toHaveCount(1);
  expect(read(root, `data/catalog/proposals/${ids.adventure}.json`).changes.find((c: { id: string }) => c.id.endsWith('quokka-walk')).status).toBe('open');

  // undo of an accept: the row is retired, never deleted
  await card(page, 'Laguna Capri and Mirador Fitz Roy').click();
  await page.keyboard.press('a');
  await expect(page.locator('.rv-toast')).toContainText('Accepted Laguna Capri');
  await expect(card(page, 'Laguna Capri and Mirador Fitz Roy')).toHaveCount(0);
  expect(trailIds(root)).toContain('AR/santa-cruz/el-chalten/laguna-capri-and-mirador-fitz-roy');
  await page.keyboard.press('u');
  await expect(card(page, 'Laguna Capri and Mirador Fitz Roy')).toHaveCount(1);
  const capri = read(root, 'data/catalog/trails/AR.json').trails.find((r: { id: string }) => r.id.endsWith('laguna-capri-and-mirador-fitz-roy'));
  expect(capri.review_status).toBe('retired');
  // the retired row keeps its id, so re-accepting the same add is refused; the owner rejects it instead
  await card(page, 'Laguna Capri and Mirador Fitz Roy').click();
  await page.keyboard.press('r');
  await expect(card(page, 'Laguna Capri and Mirador Fitz Roy')).toHaveCount(0);
});

test('j and k move through the queue, e edits before accepting', async ({ page }) => {
  await open(page);
  const cur = page.locator('.rv-card[data-current]');
  const first = await cur.getAttribute('data-change');
  await page.keyboard.press('j');
  expect(await cur.getAttribute('data-change')).not.toBe(first);
  await page.keyboard.press('k');
  expect(await cur.getAttribute('data-change')).toBe(first);

  const act = card(page, 'Banff Gondola').first();
  await act.click();
  await page.keyboard.press('e');
  const input = act.locator('.rv-edit input').first();
  await expect(input).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(act.locator('.rv-edit')).toHaveCount(0);
});

test('bulk accept takes the low-risk changes together and keeps the rest', async ({ page }) => {
  await open(page);
  const bulk = page.getByRole('button', { name: /Accept \d+ low-risk/ });
  const n = Number((await bulk.textContent())!.match(/Accept (\d+)/)![1]);
  expect(n).toBeGreaterThan(1);
  const before = await page.locator('.rv-card').count();
  await bulk.click();
  await expect(page.locator('.rv-toast')).toContainText(`Accepted ${n} low-risk`);
  await expect(page.locator('.rv-card')).toHaveCount(before - n);
  // what needs a person is still there
  await expect(page.locator('.rv-card[data-op="add"][data-flags~="possible-duplicate"]')).toHaveCount(1);
  expect(read(root, 'data/catalog/offers/CA.json').offer_prices).toHaveLength(2);
});

test('coverage and backlog views show bands and ranked reasons', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: /Coverage/ }).click();
  await expect(page.locator('.cv-band[data-band="thin"]')).toBeVisible();
  await expect(page.locator('.cv-row').first()).toBeVisible();
  await page.getByRole('tab', { name: /Backlog/ }).click();
  const rows = page.locator('.bl-row');
  await expect(rows.first()).toBeVisible();
  const prios = (await page.locator('.bl-prio').allTextContents()).map(Number);
  expect(prios).toEqual([...prios].sort((a, b) => b - a));
  expect(prios.every((p) => p >= 1)).toBe(true);
  await expect(rows.first()).toContainText(/\./);
});

test('screenshots for the visual check', async ({ browser }) => {
  test.skip(!SHOTS, 'set REVIEW_SHOTS to a folder to write desktop and phone screenshots in both themes');
  mkdirSync(SHOTS!, { recursive: true });
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    for (const theme of ['dark', 'light'] as const) {
      const ctx = await browser.newContext({ viewport, locale: 'en-CA', serviceWorkers: 'block' });
      await ctx.addInitScript((t) => window.localStorage.setItem('travel:v1:theme', t), theme);
      const page = await ctx.newPage();
      await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (r) => r.abort());
      await open(page);
      await page.screenshot({ path: path.join(SHOTS!, `queue-${name}-${theme}.png`), fullPage: false });
      await card(page, 'Banff Gondola').first().click().catch(() => undefined);
      await page.screenshot({ path: path.join(SHOTS!, `queue-open-${name}-${theme}.png`), fullPage: false });
      await page.getByRole('tab', { name: /Coverage/ }).click();
      await expect(page.locator('.cv-row').first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS!, `coverage-${name}-${theme}.png`), fullPage: true });
      await page.getByRole('tab', { name: /Backlog/ }).click();
      await expect(page.locator('.bl-row').first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS!, `backlog-${name}-${theme}.png`), fullPage: true });
      await ctx.close();
    }
  }
});
