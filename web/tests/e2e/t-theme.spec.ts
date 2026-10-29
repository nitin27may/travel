import { expect, test } from './fixtures';

// The stored dark theme must survive /t/<id>/. The page is rendered on the server with no storage; when the first client render differed
// from it (a missing trip showed "Not here" where the server drew the skeleton), React threw the server HTML away, re-rendered the whole
// document and rebuilt <html> from the layout's data-theme="light". Needs the build with NEXT_PUBLIC_TRIP_EDIT=1 (with the flag off /t/ is
// a 404 and the test skips): PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-theme
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const MISSING = '00000000-0000-4000-8000-000000000000';
const COPIES_KEY = 'travel.copies.local';
const copy = { id: ID, slug: 'canadian-rockies-2029', title: 'Canadian Rockies', days: 14, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z' };
const envelope = JSON.stringify({ schema: 'copies/1', items: [copy], noteSeen: null, snoozedUntil: null, merged: {} });

const theme = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.describe('theme on /t/', () => {
  test.beforeEach(async ({ site, playwright }) => {
    const ctx = await playwright.request.newContext();
    const status = (await ctx.get(`${site.url}/t/${ID}/`)).status();
    await ctx.dispose();
    test.skip(status === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  });

  for (const [label, id] of [['a copy on this device', ID], ['an id with no trip', MISSING]] as const) {
    test(`stored dark stays dark: ${label}`, async ({ page, site }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(([k, v]) => { localStorage.setItem('travel:v1:theme', 'dark'); localStorage.setItem(k!, v!); }, [COPIES_KEY, envelope]);
      await page.goto(`${site.url}/t/${id}/`);
      await page.locator('h1').first().waitFor({ state: 'attached' });
      await page.waitForTimeout(1500); // hydration and the first reads settle
      expect(await theme(page)).toBe('dark');
      expect(errors, 'a hydration mismatch rebuilds <html> and loses the theme').toEqual([]);
      if (id === ID) {
        await expect(page.locator('li.tl-day').first()).toBeAttached();
        for (const name of ['Days', 'Summary']) {
          await page.getByRole('tab', { name }).first().click();
          expect(await theme(page)).toBe('dark');
        }
        await page.getByRole('button', { name: 'Edit trip' }).click();
        await expect(page).toHaveURL(/edit=1/);
        expect(await theme(page)).toBe('dark');
      }
      await page.reload();
      await page.waitForTimeout(1500);
      expect(await theme(page)).toBe('dark');
      expect(await page.evaluate(() => localStorage.getItem('travel:v1:theme'))).toBe('dark');
    });
  }

  test('light is the default, and a stored light beats a dark system', async ({ browser, site }) => {
    for (const stored of [null, 'light']) {
      const context = await browser.newContext({ colorScheme: 'dark' });
      const page = await context.newPage();
      await page.addInitScript(([k, v, s]) => { localStorage.setItem(k!, v!); if (s) localStorage.setItem('travel:v1:theme', s); }, [COPIES_KEY, envelope, stored]);
      await page.goto(`${site.url}/t/${ID}/`);
      await page.waitForTimeout(1000);
      expect(await theme(page)).toBe('light');
      await context.close();
    }
  });
});
