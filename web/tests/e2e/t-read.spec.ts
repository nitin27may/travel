import { mkdirSync } from 'node:fs';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-T1: a person's own trip at /t/<id>/ in read mode, with the edits the page already had saved to the document (the party, a day's
// version, an added place, the name and the start date). Needs the build with the flag on:
//   NEXT_PUBLIC_TRIP_EDIT=1 next build
// then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-read (alone, on a free port). With the flag off /t/ answers 404 and
// every test here skips (tests/trip-edit/links.test.ts pins the off state).
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const OTHER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const PARTY_KEY = 'travel.party';

const copy = (days: number, o: Record<string, unknown> = {}) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [],
  copiedAt: '2026-10-20T10:00:00.000Z', ...o,
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return; // the first document of the tab only, so a reload keeps what the page wrote
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const stored = async (page: Page) => (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as { items: Record<string, unknown>[] } | null, COPIES_KEY))?.items.find((i) => i.id === ID);

test.describe('/t/<id>/ read mode', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    const model = (await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] };
    days = model.days.length;
    await ctx.dispose();
  });

  async function open(page: Page, site: { url: string }, query = '', items?: unknown[]) {
    await seed(page, { [COPIES_KEY]: envelope(items ?? [copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/${query}`);
  }

  test('is private: no-store, noindex, no canonical, no share image, not in the sitemap, and the HTML knows nothing of the trip (EA13)', async ({ request, site }) => {
    const res = await request.get(`${site.url}/t/${ID}/`);
    expect(res.status()).toBe(200);
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('no-store');
    expect(cc).toContain('private');
    const html = await res.text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).not.toMatch(/rel="canonical"/);
    expect(html).not.toMatch(/og:image|twitter:image/);
    expect(html).not.toContain('Rockies');
    const map = await (await request.get(`${site.url}/sitemap.xml`)).text();
    expect(map).not.toContain('/t/');
  });

  test('an id that is not here gives the not-found state, the same for any id (no existence signal)', async ({ page, site }) => {
    for (const id of [OTHER, 'not-an-id']) {
      await page.goto(`${site.url}/t/${id}/`);
      await expect(page.getByRole('heading', { name: 'This trip is not on this device or in your account.' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open Mine' })).toHaveAttribute('href', '/mine/');
    }
    // a copy of another id on this device does not open this one
    await open(page, site, '', [copy(days, { id: OTHER })]);
    await expect(page.getByRole('heading', { name: 'This trip is not on this device or in your account.' })).toBeVisible();
  });

  test('a copy opens as the same details page: cover, kicker, Edit trip, the days, and no Copy to my trips', async ({ page, site }) => {
    await open(page, site, '?view=day');
    await expect(page.locator('h1.trip-title')).toHaveText('Canadian Rockies');
    await expect(page.locator('.trip-kicker')).toHaveText(/^Your copy · from our .+ trip$/);
    await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to calendar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy to my trips' })).toHaveCount(0);
    await expect(page.locator('.own-sync')).toHaveText('On this device');
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    await expect(page.getByTestId('party-line')).toContainText('2 adults · 1 child (10) · Standard pace');
    await expect(page.getByRole('tab', { name: /Days/ })).toHaveAttribute('aria-selected', 'true');
    // the sticky bar says whose trip it is (scenario rule 1)
    await expect(page.getByTestId('own-identity')).toContainText('Canadian Rockies');
    expect(await page.title()).toContain('Your trip');
  });

  test("A7: swapping Day 2's version is kept after a reload, and the device party is never written", async ({ page, site }) => {
    await open(page, site, '?view=day#day-2');
    await page.locator('#day-2').getByRole('button', { name: /Version of Day 2/ }).click();
    await page.getByRole('menuitem', { name: /Easy day/ }).click();
    await expect(page.locator('#day-2').getByText('Changed for this day')).toBeVisible();
    await expect.poll(async () => (await stored(page))?.overrides).toEqual({ '2': 'C' });
    await expect(page).not.toHaveURL(/d=2C/);
    await page.reload();
    await expect(page.locator('#day-2').getByText('Changed for this day')).toBeVisible();
    await expect(page.locator('.own-changes')).toHaveText('1 change from our plan');
    expect(await page.evaluate((k) => localStorage.getItem(k), PARTY_KEY)).toBeNull();
  });

  test('add a place to a day and remove it again; it survives a reload', async ({ page, site }) => {
    await open(page, site, '?view=day#day-5');
    const day = page.locator('#day-5');
    await day.getByRole('button', { name: /Add a place to Day 5/ }).click();
    await day.locator('.tl-add-item:has(.tl-add-cost[data-state="ok"])').first().click();
    await expect(day.getByText('You added this')).toBeVisible();
    await expect.poll(async () => ((await stored(page))?.added as unknown[]).length).toBe(1);
    await page.reload();
    await expect(page.locator('#day-5').getByText('You added this')).toBeVisible();
    const added = page.locator('#day-5 .tl-entry[data-added]').first();
    await added.getByRole('button', { name: 'Why this time' }).click();
    await added.getByRole('button', { name: 'Remove from this day' }).click();
    await expect(page.locator('#day-5').getByText('You added this')).toHaveCount(0);
    await expect.poll(async () => ((await stored(page))?.added as unknown[]).length).toBe(0);
  });

  test('the settings sheet saves the party, the name and the start date at once', async ({ page, site }) => {
    await open(page, site, '?view=day');
    await page.getByRole('button', { name: 'Edit trip' }).click();
    const sheet = page.getByRole('dialog', { name: 'Edit trip' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Fewer children' }).click();
    await expect(page.getByTestId('party-line')).toContainText('2 adults · Standard pace');
    await sheet.getByRole('radio', { name: 'Relaxed' }).click();
    await sheet.getByLabel('Trip name').fill('Rockies with the cousins');
    await sheet.getByLabel('Trip name').blur();
    const before = (await stored(page))?.start;
    // SW-018: the date reads as everywhere else and is picked from the calendar
    await sheet.locator('.own-set-date').click();
    await sheet.locator('[role="grid"] button:not([disabled])').nth(20).click();
    await expect.poll(async () => (await stored(page))?.start).not.toBe(before);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('h1.trip-title')).toHaveText('Rockies with the cousins');
    await page.reload();
    await expect(page.locator('h1.trip-title')).toHaveText('Rockies with the cousins');
    await expect(page.getByTestId('party-line')).toContainText('2 adults · Relaxed pace');
    const c = await stored(page);
    expect(c).toMatchObject({ title: 'Rockies with the cousins', start: '2029-09-15', adults: 2, children: [] });
    expect(await page.evaluate((k) => localStorage.getItem(k), PARTY_KEY)).toBeNull();
  });

  test("Mine's Open goes to the copy's page, and a mine=<id> link on the public trip redirects to it", async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/mine/`);
    await page.locator('.crow-link').first().click();
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/\\?view=day$`));
    await expect(page.locator('h1.trip-title')).toHaveText('Canadian Rockies');
    await page.goto(`${site.url}/trips/${SLUG}/?mine=${ID}`);
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/`));
    // the older marker stays on the public page, and an id that is not here leaves it too
    await page.goto(`${site.url}/trips/${SLUG}/?mine=1`);
    await expect(page).toHaveURL(/\/trips\//);
    await page.goto(`${site.url}/trips/${SLUG}/?mine=${OTHER}`);
    await expect(page.getByRole('button', { name: 'Copy to my trips' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/trips\//);
  });

  test('the published trip is unchanged: Copy to my trips, the party bar and the address-driven profile (EA12)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/${SLUG}/?pace=relaxed&view=day`);
    await expect(page.getByRole('button', { name: 'Copy to my trips' }).first()).toBeVisible();
    await expect(page.locator('#plan-for-h')).toHaveText('Plan it for');
    await expect(page.locator('#plan-for .pb-long')).toContainText('Relaxed pace');
    await expect(page.getByRole('button', { name: 'Edit trip' })).toHaveCount(0);
  });
});

// Screenshots for the review (SHOTS_DIR=<folder>): the page at 1440 x 900 and 390 x 844, light and dark, 2x.
const SHOTS = process.env.SHOTS_DIR;
test.describe('screenshots', () => {
  test.skip(!SHOTS, 'set SHOTS_DIR to take the review shots');
  test.setTimeout(240_000);

  async function shoot(browser: Browser, url: string, days: number, name: string, prepare?: (p: Page) => Promise<void>) {
    mkdirSync(SHOTS!, { recursive: true });
    for (const theme of ['light', 'dark'] as const) {
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
        const page = await context.newPage();
        await page.addInitScript(([k, v]) => localStorage.setItem(k!, v!), ['travel:v1:theme', theme]);
        await seed(page, { [COPIES_KEY]: envelope([copy(days, { overrides: { '2': 'C' } })]) });
        await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
        await page.goto(url);
        await page.locator('h1').first().waitFor();
        await page.waitForTimeout(900);
        if (prepare) await prepare(page);
        await page.screenshot({ path: `${SHOTS}/${name}-${size.width}-${theme}.png` });
        await context.close();
      }
    }
  }

  test('summary, days and settings', async ({ browser, site, playwright }) => {
    const ctx = await playwright.request.newContext();
    if ((await ctx.get(`${site.url}/t/${ID}/`)).status() === 404) test.skip(true, 'flag off');
    const model = (await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] };
    const n = model.days.length;
    await shoot(browser, `${site.url}/t/${ID}/`, n, 't-summary');
    await shoot(browser, `${site.url}/t/${ID}/?view=day`, n, 't-days');
    await shoot(browser, `${site.url}/t/${ID}/?view=day`, n, 't-settings', async (p) => {
      await p.getByRole('button', { name: 'Edit trip' }).click();
      await p.getByRole('dialog').waitFor();
      await p.waitForTimeout(700);
    });
    await shoot(browser, `${site.url}/t/${OTHER}/`, n, 't-notfound');
  });
});
