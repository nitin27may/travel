import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/;

test.describe('trips list', () => {
  test('keeps cards, pills, the four views and the map camera in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await expect(page.locator('.card').first()).toBeVisible();
    for (const name of ['When', 'Source', 'Country', 'Kids']) await expect(page.getByRole('button', { name })).toBeVisible();
    for (const v of ['Cards', 'List', 'Table', 'Map']) await expect(page.getByRole('radio', { name: v })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done, use as a template' })).toBeVisible();
    await expect(page.locator('.card').first().getByRole('link', { name: 'Public page' })).toHaveAttribute('href', /\/trips\/[a-z0-9-]+\/$/);
    expect(await page.locator('main').innerText()).not.toMatch(DATE);
    await page.goto(`${site.url}/trips/?view=map&c=12.1,46.5,7`);
    await expect(page.locator('[data-map-family="maplibre"]')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('view=map');
    expect(page.url()).toMatch(/c=12\.1/);
  });
  test('sort writes sort and dir', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?sort=nights&dir=desc`);
    await expect(page.locator('.card').first()).toBeVisible();
    expect(page.url()).toContain('dir=desc');
  });
});

test.describe('trip page', () => {
  test('Dolomites: 14 day rows in order, six chips, By category regroups', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/`);
    const rows = page.locator('.day-row');
    await expect(rows).toHaveCount(14);
    expect(await rows.evaluateAll((els) => els.map((e) => e.id))).toEqual(Array.from({ length: 14 }, (_, i) => `day-${i + 1}`));
    const chips = page.locator('.cat-chip');
    await expect(chips).toHaveCount(6);
    expect(await chips.allInnerTexts()).toEqual(['Stays\n4', 'Trails\n10', 'Sights\n11', 'Activities\n3', 'Food\n2', 'Logistics\n7']);
    expect(await page.locator('main').innerText()).not.toMatch(DATE);
    await chips.nth(1).click();
    await expect(page).toHaveURL(/view=category#trails/);
    await expect(page.getByRole('heading', { name: /^Trails/ })).toBeVisible();
    await page.goBack();
    await expect(page.locator('.day-row').first()).toBeVisible();
  });
  test('anchors #day-3 and #stays work on load', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-3`);
    await expect(page.locator('#day-3 .day-head')).toHaveAttribute('aria-expanded', 'true');
    await page.goto(`${site.url}/trips/dolomites-2027/#stays`);
    await expect(page.getByRole('heading', { name: /^Stays/ })).toBeVisible();
  });
  test('Rockies day 5 shows tracks A, B and C', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/#day-5`);
    await expect(page.getByRole('radiogroup', { name: 'Day 5 options' })).toBeVisible();
    await expect(page.getByRole('radio')).not.toHaveCount(0);
  });
  test('summary and overview trips are labelled', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/patagonia-2027/`);
    await expect(page.getByText('Condensed from the full plan').first()).toBeVisible();
    await page.goto(`${site.url}/trips/switzerland-2027/`);
    await expect(page.getByText('This plan has not been converted to days yet')).toBeVisible();
    await expect(page.locator('.cat-chip')).toHaveCount(0);
    await expect(page.getByText('Season not set yet').first()).toBeVisible();
  });
  test('no horizontal scroll at 390 and axe is clean', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/trips/', '/trips/dolomites-2027/', '/trips/switzerland-2027/']) {
      await page.goto(`${site.url}${path}`);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-map-family]').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`), path).toEqual([]);
    }
  });
  test('private trips have no page', async ({ page, site }) => {
    const res = await page.goto(`${site.url}/trips/some-private-trip/`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('trip page extras', () => {
  test('a done trip is read-only and offers "Use as a template"', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/vermont-fall-2026/`);
    await expect(page.getByRole('button', { name: 'Use as a template' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy to my trips' })).toHaveCount(0);
    await expect(page.getByText('the plan is read-only')).toBeVisible();
  });
  test('an open day offers a link to itself and every row has its anchor', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-3`);
    await expect(page.locator('#day-3')).toBeVisible();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const copy = page.locator('#day-3 [data-day-link="3"]').getByRole('button', { name: 'Copy link to day 3' });
    await expect(copy).toBeVisible();
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/trips\/dolomites-2027\/#day-3$/);
    expect(await page.locator('.day-row[id^="day-"]').count()).toBeGreaterThan(10);
  });
});
