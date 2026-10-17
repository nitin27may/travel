import { expect, readStore, test } from './fixtures';
import type { Page } from '@playwright/test';

// The legacy list page (hash state) and /places/ (query state) must show the same number of places
// for the same filters. Parameter sets follow docs/PLAN-locations-g5.md 2.4. The legacy page has no
// `season` parameter, so season is tested on the app alone in url-state.spec.ts.

const store = readStore();
const regionOf = (areaId: string) => store.areas.find((a) => a.id === areaId)!.region_id;
const countryOfPlace = (p: { area_id: string }) => store.regions.find((r) => r.id === regionOf(p.area_id))!.country;

const tagCounts = new Map<string, number>();
for (const pt of store.place_tags) tagCounts.set(pt.tag_id, (tagCounts.get(pt.tag_id) ?? 0) + 1);
const tag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
const quebec = store.regions.find((r) => r.country === 'CA' && r.code === 'QC')!;
const charlevoix = store.areas.find((a) => a.slug === 'charlevoix')!;
const statuses = [...new Set(store.places.map((p) => p.status))];
const kinds = [...new Set(store.places.map((p) => p.kind))];
const twoKinds = kinds.slice(0, 2).join(',');

const SETS: { name: string; params: string }[] = [
  { name: 'no filters', params: '' },
  { name: 'country CA', params: 'country=CA' },
  { name: 'country US', params: 'country=US' },
  { name: 'one region', params: `country=CA&region=${quebec.code}` },
  { name: 'region by name', params: `country=CA&region=${encodeURIComponent(quebec.name)}` },
  { name: 'one area', params: `country=CA&region=${quebec.code}&area=${charlevoix.slug}` },
  ...statuses.map((s) => ({ name: `status ${s}`, params: `status=${s}` })),
  { name: 'two kinds', params: `kind=${twoKinds}` },
  { name: 'one tag', params: `tag=${tag}` },
  { name: 'kid=yes', params: 'kid=yes' },
  { name: 'search', params: 'q=lake' },
  { name: 'combined: country, kind, status', params: `country=CA&kind=${kinds[0]}&status=${statuses[0]}` },
  { name: 'combined: two kinds and kid', params: `kind=${twoKinds}&kid=strong-kid` },
];

async function legacyCount(page: Page, base: string, params: string): Promise<number> {
  await page.goto(`${base}/legacy-locations/index.html${params ? `#${params}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#count');
  return Number((await page.locator('#count').textContent())?.trim());
}

async function appCount(page: Page, base: string, params: string): Promise<number> {
  await page.goto(`${base}/places/${params ? `?${params}` : ''}`);
  const strong = page.locator('.filter-bar .count strong');
  await expect(strong).toBeVisible();
  return Number((await strong.textContent())?.trim());
}

test.describe('places parity with the legacy list page', () => {
  const rows: { set: string; legacy: number; app: number }[] = [];

  test('unfiltered: both show 64', async ({ page, site, legacy }) => {
    expect(store.places).toHaveLength(64);
    expect(await legacyCount(page, legacy.url, '')).toBe(64);
    expect(await appCount(page, site.url, '')).toBe(64);
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
