import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, expect, readStore, test } from './fixtures';
import type { Page } from '@playwright/test';

// The legacy list page (hash state) and /places/ (query state) must show the same number of places
// for the same filters. Parameter sets follow docs/PLAN-locations-g5.md 2.4. The legacy page has no
// `season` parameter, so season is tested on the app alone in url-state.spec.ts.
//
// The app now lists every public place (the 64 saved ones plus the researched Dolomites places), so each app count is
// restricted to the 64 saved places with `ids=<their slugs>` (the slug of each comes from web/redirects.json, which
// maps every old URL to its new one). The legacy page and the app must still agree on every filter.

const store = readStore();
const redirects: { from: string; to: string }[] = JSON.parse(readFileSync(path.join(ROOT, 'web', 'redirects.json'), 'utf8'));
const slugOf = (id: string) => redirects.find((r) => r.from === `/places/${id.split('/').join('/')}/`)?.to.replace(/^\/places\//, '').replace(/\/$/, '');
const savedSlugs = store.places.map((p) => slugOf(p.id) as string);
const regionOf = (areaId: string) => store.areas.find((a) => a.id === areaId)!.region_id;
const countryOfPlace = (p: { area_id: string }) => store.regions.find((r) => r.id === regionOf(p.area_id))!.country;

const tagCounts = new Map<string, number>();
for (const pt of store.place_tags) tagCounts.set(pt.tag_id, (tagCounts.get(pt.tag_id) ?? 0) + 1);
const tag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
const quebec = store.regions.find((r) => r.country === 'CA' && r.code === 'QC')!;
const charlevoix = store.areas.find((a) => a.slug === 'charlevoix')!;
// The app filters by the canonical kind (a saved "city" is a Town, a "park" an Area ...). The legacy page filters by the
// saved kind, so every `kind=` value is expanded to the saved kinds that map to it when asking the legacy page.
const CANON: Record<string, string> = { city: 'town', park: 'area', region: 'area', valley: 'area', island: 'area', mountain: 'viewpoint', lighthouse: 'sight', place: 'sight', drive: 'sight', canyon: 'waterfall' };
const canon = (k: string) => CANON[k] ?? k;
const kinds = [...new Set(store.places.map((p) => canon(p.kind)))];
const twoKinds = kinds.slice(0, 2).join(',');
const toLegacy = (params: string) =>
  params.replace(/kind=([^&]+)/, (_m, list: string) => {
    const want = list.split(',');
    return `kind=${[...new Set(store.places.map((p) => p.kind).filter((k) => want.includes(canon(k))))].join(',')}`;
  });

const SETS: { name: string; params: string }[] = [
  { name: 'no filters', params: '' },
  { name: 'country CA', params: 'country=CA' },
  { name: 'country US', params: 'country=US' },
  { name: 'one region', params: `country=CA&region=${quebec.code}` },
  { name: 'region by name', params: `country=CA&region=${encodeURIComponent(quebec.name)}` },
  { name: 'one area', params: `country=CA&region=${quebec.code}&area=${charlevoix.slug}` },
  { name: 'two kinds', params: `kind=${twoKinds}` },
  { name: 'one tag', params: `tag=${tag}` },
  { name: 'kid=yes', params: 'kid=yes' },
  { name: 'search', params: 'q=lake' },
  { name: 'combined: country and kind', params: `country=CA&kind=${kinds[0]}` },
  { name: 'combined: two kinds and kid', params: `kind=${twoKinds}&kid=strong-kid` },
];

/** Reads a count that is written after hydration: waits for the network to go quiet, then for three equal reads in a row. */
async function settled(page: Page, read: () => Promise<number>): Promise<number> {
  await page.waitForLoadState('networkidle');
  let last = Number.NaN;
  let same = 0;
  for (let i = 0; i < 300 && same < 4; i++) {
    const n = await read().catch(() => Number.NaN);
    same = n === last && Number.isFinite(n) ? same + 1 : 0;
    last = n;
    await page.waitForTimeout(150);
  }
  expect(same, 'the count never settled').toBeGreaterThanOrEqual(4);
  return last;
}

async function legacyCount(page: Page, base: string, params: string): Promise<number> {
  await page.goto(`${base}/legacy-locations/index.html${params ? `#${toLegacy(params)}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#count');
  return settled(page, async () => Number((await page.locator('#count').textContent())?.trim()));
}

async function appCount(page: Page, base: string, params: string, onlySaved = true): Promise<number> {
  const all = [params, onlySaved ? `ids=${savedSlugs.join(',')}` : ''].filter(Boolean).join('&');
  await page.goto(`${base}/places/${all ? `?${all}` : ''}`);
  const strong = page.locator('.filter-bar .count strong');
  await expect(strong).toBeVisible();
  return settled(page, async () => Number((await strong.textContent())?.trim()));
}

test.describe('places parity with the legacy list page', () => {
  // a count read while another run loads the machine can lag the first paint; one retry, and the settle loop above is long
  test.describe.configure({ retries: 1, timeout: 120_000 });
  const rows: { set: string; legacy: number; app: number }[] = [];

  test('unfiltered: both show the 64 saved places, and the app lists more', async ({ page, site, legacy }) => {
    expect(store.places).toHaveLength(64);
    expect(savedSlugs.every(Boolean)).toBe(true);
    expect(new Set(savedSlugs).size).toBe(64);
    expect(await legacyCount(page, legacy.url, '')).toBe(64);
    expect(await appCount(page, site.url, '')).toBe(64);
    expect(await appCount(page, site.url, '', false)).toBeGreaterThan(64);
  });

  for (const set of SETS) {
    test(`same count: ${set.name}`, async ({ page, site, legacy }) => {
      const l = await legacyCount(page, legacy.url, set.params);
      const a = await appCount(page, site.url, set.params);
      rows.push({ set: `${set.name} (${set.params || 'none'})`, legacy: l, app: a });
      expect(a, `legacy ${l} vs app ${a} for ${set.params}`).toBe(l);
    });
  }

  test.afterAll(() => {
    console.log('PARITY TABLE\n' + rows.map((r) => `  ${r.set.padEnd(70)} legacy ${String(r.legacy).padStart(3)}  app ${String(r.app).padStart(3)}`).join('\n'));
  });

  test('countries add up on the app', async ({ page, site }) => {
    const total = store.places.length;
    const perCountry = new Map<string, number>();
    for (const p of store.places) perCountry.set(countryOfPlace(p), (perCountry.get(countryOfPlace(p)) ?? 0) + 1);
    let sum = 0;
    for (const [cc, n] of perCountry) {
      const got = await appCount(page, site.url, `country=${cc}`);
      expect(got).toBe(n);
      sum += got;
    }
    expect(sum).toBe(total);
  });
});
