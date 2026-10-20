import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// Lane LST (stage 4): list shards, the phone summary, the non-modal header search, one Kids control, the count line, search fixes.
// Real data; the assertions read structure, never a count.

test.describe('list shards (3.59)', () => {
  test('the places page serves its first page; a deep link with a filter and a page renders after its files load, with no layout shift', async ({ page, site }) => {
    const files: string[] = [];
    page.on('request', (r) => /\/list\/places\//.test(r.url()) && files.push(r.url()));
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.card')).toHaveCount(48);
    expect(files, 'the first page needs no file').toEqual([]);
    await page.goto(`${site.url}/places/?q=lake&page=2`, { waitUntil: 'networkidle' });
    await expect(page.locator('.filter-bar .count strong')).toHaveText(/^\d+$/);
    expect(files.length, 'a text search reads every file, progressively').toBeGreaterThan(1);
    expect(await page.locator('.card').count()).toBeGreaterThan(0);
  });
  test('a country reads its own files only', async ({ page, site }) => {
    const files: string[] = [];
    page.on('request', (r) => /\/list\/places\/[^/]+\/data\.json/.test(r.url()) && files.push(r.url()));
    await page.goto(`${site.url}/places/?country=IT`, { waitUntil: 'networkidle' });
    await expect(page.locator('.filter-bar .count strong')).toHaveText(/^\d+$/);
    expect(files.every((u) => /\/list\/places\/it(-\d+)?\//.test(u)), files.join(' ')).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });
  test('the first four cards of the default order have photos (3.56)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    const first = page.locator('.card').first().locator('xpath=../../..').locator('.card').nth(3);
    await expect(first).toBeVisible();
    for (let i = 0; i < 4; i++) await expect(page.locator('.card').nth(i).locator('.card-media img')).toHaveCount(1);
  });
});

test.describe('one Kids control', () => {
  for (const [path, noun] of [['/places/', 'places'], ['/trips/', 'trips']] as const) {
    test(`${noun}: "Youngest child", a stepper, quick ages, Any age, and the chip reads the same`, async ({ page, site }) => {
      await page.goto(`${site.url}${path}`);
      await page.locator('.pill-trigger', { hasText: /^Youngest child/ }).click();
      const menu = page.getByRole('dialog', { name: 'Youngest child' });
      for (const q of ['Baby', '3', '6', '9', '12']) await expect(menu.getByRole('button', { name: q, exact: true })).toBeVisible();
      await menu.getByRole('button', { name: '6', exact: true }).click();
      await expect(page).toHaveURL(/kid=6/);
      await expect(page.locator('.chips')).toContainText('Youngest child 6');
      await menu.getByRole('button', { name: 'Any age' }).click();
      await expect(page).not.toHaveURL(/kid=/);
    });
  }
});

test.describe('the count line', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('is at most two lines at 390 with Kind and Kids set, and the denominator is the scope', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?k=nature.trail&kid=6&country=CA`);
    await expect(page.locator('.filter-bar .count strong')).toHaveText(/^\d+$/);
    const h = await page.locator('.filter-bar .count-block').evaluate((el) => {
      const kids = [...el.children].filter((c) => !c.classList.contains('count-why'));
      return kids.reduce((a, c) => a + c.getBoundingClientRect().height, 0);
    });
    expect(h).toBeLessThanOrEqual(50);
    await expect(page.locator('.filter-bar .count .of')).toContainText(/of \d+ trails/);
    await page.getByRole('button', { name: /Why these/ }).click();
    await expect(page.locator('.count-why')).toContainText(/stretch at 6/);
  });
});

test.describe('the phone summary (4.8, T2)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('the sticky line is at most 20% of the screen with three filters, after scrolling; Edit opens a non-modal panel that Esc closes', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?k=nature.trail&kid=6&country=CA`);
    await expect(page.locator('.filter-bar .count strong')).toHaveText(/^\d+$/);
    await page.mouse.wheel(0, 1600);
    const summary = page.locator('.phone-summary');
    await expect(summary).toBeVisible();
    const box = (await summary.boundingBox())!;
    expect(box.height / 844).toBeLessThanOrEqual(0.2);
    await expect(summary).toContainText(/\d+ places? · 3 filters/);
    await summary.getByRole('button', { name: /Edit/ }).click();
    const panel = page.locator('.phone-panel');
    await expect(panel).toBeVisible();
    expect(await page.evaluate(() => !!document.querySelector('.scrim, [aria-modal="true"]'))).toBe(false);
    const open = (await panel.boundingBox())!;
    expect(open.y + open.height, 'summary and panel together are at most 45%').toBeLessThanOrEqual(844 * 0.45 + 56);
    await page.keyboard.press('Escape');
    await expect(summary.getByRole('button', { name: /Edit/ })).toBeFocused();
    await expect(page.locator('.phone-sticky[data-open]')).toHaveCount(0);
  });
});

test.describe('the header search is not modal (S5)', () => {
  test('no scrim, no aria-modal, the page scrolls behind it, Esc clears then closes and focus returns to the button', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    const opener = page.getByRole('button', { name: 'Search' }).first();
    await opener.click();
    const box = page.getByRole('combobox', { name: 'Search trips, places and areas' });
    await expect(box).toBeFocused();
    expect(await page.evaluate(() => ({ modal: !!document.querySelector('[aria-modal="true"]'), scrim: !!document.querySelector('.scrim'), inert: !!document.querySelector('[inert]:not(.phone-panel):not(.phone-summary):not(.count-why):not(.unchecked-body):not(.smart-row > div)') }))).toMatchObject({ modal: false, scrim: false });
    await box.fill('lake');
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.move(300, 600);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
    await box.press('Escape');
    await expect(box).toHaveValue('');
    await box.press('Escape');
    await expect(box).toHaveCount(0);
    await expect(opener).toBeFocused();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
  test('a click outside closes it', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Search' }).first().click();
    const box = page.getByRole('combobox', { name: 'Search trips, places and areas' });
    await expect(box).toBeVisible();
    await page.locator('.page-head h1').click({ position: { x: 20, y: 20 } });
    await expect(box).toHaveCount(0);
  });
});

test.describe('search fixes (S1, S3, 4.14)', () => {
  test('"waterfall I can reach with a stroller" never offers to drop the Kind', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    const box = page.getByRole('searchbox', { name: 'Search places' });
    await box.fill('waterfall I can reach with a stroller');
    await box.press('Enter');
    await expect(page).toHaveURL(/stroller=any/);
    await expect(page.getByRole('button', { name: /Without Waterfalls/ })).toHaveCount(0);
  });
  test('a trip name in the Places box, which holds no row of it, is offered as the trip page (4.14)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=Canadian+Rockies+2029`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /No places match/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /open its page/ })).toBeVisible();
  });
});

test.describe('axe on the lists with a menu open, in both themes', () => {
  for (const path of ['/places/', '/trips/']) {
    for (const view of ['cards', 'list', 'table']) {
      test(`${path} ${view}`, async ({ page, site }) => {
        await page.goto(`${site.url}${path}?view=${view}`, { waitUntil: 'networkidle' });
        await page.locator('.facet-group .pill-trigger').first().click();
        const res = await new AxeBuilder({ page }).analyze();
        expect(res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
      });
    }
  }
});
