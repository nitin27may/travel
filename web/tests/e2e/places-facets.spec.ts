import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// L3b: the Kind pill, the type-aware facets, and the Kids, Effort and Stroller filters on Places.
const axe = (page: import('@playwright/test').Page) => new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
const clean = (r: Awaited<ReturnType<typeof axe>>) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);

test.describe('Places filters', () => {
  test('the Kind menu lists domains first, then categories, each with a count', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.locator('.pill-trigger', { hasText: /^Kind/ }).click();
    const menu = page.getByRole('dialog', { name: 'Kind' });
    const groups = await menu.locator('.opt-group').allInnerTexts();
    expect(groups.map((g) => g.toLowerCase())).toEqual(['domains', 'categories']);
    await expect(menu.getByLabel(/^Nature/)).toBeAttached();
    expect(clean(await axe(page))).toEqual([]);
    await menu.getByLabel(/^Trails and walks/).check();
    await expect(page).toHaveURL(/k=nature\.trail/);
  });

  test('narrowing Kind to trails promotes Effort into the bar (six pills at most) and brings the scope under More filters', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?k=nature.trail`);
    const pills = page.locator('.facet-group .pill-trigger');
    await expect(pills.first()).toBeVisible();
    const texts = await pills.allInnerTexts();
    expect(texts.length).toBeLessThanOrEqual(7); // six pills and More filters
    expect(texts.some((t) => /^Effort/.test(t))).toBe(true);
    await page.getByRole('button', { name: /^More filters/ }).click();
    const more = page.getByRole('dialog', { name: 'More filters' });
    await expect(more.locator('summary', { hasText: 'Stroller' })).toBeVisible();
    expect(clean(await axe(page))).toEqual([]);
  });

  test('a facet that too few results answer is hidden, and the count line says why', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?k=nature.trail`);
    await expect(page.locator('.count')).toContainText(/hidden: not known for most results/);
  });

  test('clearing the Kind removes the scope facets and keeps the four primary pills', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?k=nature.trail&f.dogs=yes`);
    await page.getByRole('button', { name: /Remove filter Kind/ }).click();
    await expect(page).not.toHaveURL(/k=nature/);
    await expect(page).not.toHaveURL(/f\./);
    await expect(page.locator('.facet-group .pill-trigger')).toHaveText([/^Country/, /^Kind/, /^Season/, /^Kids/, /^More filters/]);
  });

  test('Kids is a stepper with quick ages; a pick lands in the URL and the count line names the age', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.locator('.pill-trigger', { hasText: /^Kids/ }).click();
    const menu = page.getByRole('dialog', { name: 'Kids' });
    await expect(menu.getByText('Youngest child')).toBeVisible();
    expect(clean(await axe(page))).toEqual([]);
    await menu.getByRole('button', { name: '6', exact: true }).click();
    await expect(page).toHaveURL(/kid=6/);
    await expect(page.locator('.count')).toContainText('for age 6');
    await menu.getByRole('button', { name: 'One year older' }).click();
    await expect(page).toHaveURL(/kid=7/);
    await menu.getByRole('button', { name: 'Any age' }).click();
    await expect(page).not.toHaveURL(/kid=/);
  });

  test('a card whose age is advice fades to 60% while the age is below it', async ({ page, site }) => {
    // the advice cards carry a marker for the ages they are a stretch for
    await page.goto(`${site.url}/places/?kid=1`);
    const faded = page.locator('article.card[data-fade~="1"]').first();
    await expect(faded).toBeVisible();
    await expect(page.locator('article.card[data-fade~="1"] .card-media :is(img, .img-fallback svg)').first()).toHaveCSS('opacity', '0.6');
    // the same in the list and the table
    await page.goto(`${site.url}/places/?kid=1&view=list`);
    await expect(page.locator('li.row[data-fade~="1"] > .kind-glyph').first()).toHaveCSS('opacity', '0.6');
    await page.goto(`${site.url}/places/?kid=1&view=table`);
    // table rows keep every word at full contrast; the reason is for screen readers
    const cell = page.locator('tr[data-row][data-fade~="1"] td:first-child').first();
    await expect(cell).toBeAttached();
    expect(await cell.evaluate((el) => getComputedStyle(el, '::after').content)).toMatch(/A stretch at 1, advice says \d+ and up/);
    await page.goto(`${site.url}/places/?kid=17`);
    await expect(page.locator('article.card .card-media :is(img, .img-fallback svg)').first()).toHaveCSS('opacity', '1');
  });

  test('a stretch keeps its words at full contrast and says why (AA, light and dark)', async ({ page, site }) => {
    for (const theme of ['light', 'dark']) {
      await page.addInitScript((t) => localStorage.setItem('travel:v1:theme', t), theme);
      await page.goto(`${site.url}/places/?kid=1`);
      const card = page.locator('article.card[data-fade~="1"]').first();
      await expect(card).toBeVisible();
      // the picture fades, the words do not
      // the picture fades (a card with no photo has nothing to fade: its label stays at full contrast)
      await expect(page.locator('article.card[data-fade~="1"] .card-media :is(img, .img-fallback svg)').first()).toHaveCSS('opacity', '0.6');
      await expect(card.locator('.card-title')).toHaveCSS('opacity', '1');
      await expect(card).toHaveCSS('opacity', '1');
      const chip = await card.locator('.card-title').evaluate((el) => getComputedStyle(el, '::after').content);
      expect(chip).toMatch(/A stretch at 1 · advice says \d+\+/);
      const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').withRules(['color-contrast']).analyze();
      expect(r.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    }
  });

  test('Effort and Stroller are under More filters with the plain names, never FE', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.getByRole('button', { name: /^More filters/ }).click();
    const more = page.getByRole('dialog', { name: 'More filters' });
    await more.locator('summary', { hasText: 'Effort' }).click();
    // only the efforts some place has are listed; each is one of the five plain names
    const labels = await more.locator('.opt-label').allInnerTexts();
    const efforts = labels.filter((l) => /^(Stroll|Easy|Moderate|Hard|Technical)/.test(l));
    expect(efforts.length).toBeGreaterThan(0);
    await expect(more.getByText(/\bFE\d?\b/)).toHaveCount(0);
    await more.locator('summary', { hasText: 'Stroller' }).click();
    await expect(more.getByText('Any stroller')).toBeVisible();
    await expect(more.getByText('All-terrain stroller')).toBeVisible();
  });

  test('an old kind=trail link still filters and shows as a chip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?kind=trail`);
    await expect(page.locator('.chips')).toContainText('Kind: Trail');
    expect(Number(await page.locator('.filter-bar .count strong').innerText())).toBeGreaterThan(0);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the sheet has the Kids stepper and a Done button; no horizontal scroll', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.locator('summary', { hasText: /^Kids/ }).click();
    await expect(sheet.getByRole('button', { name: 'One year older' })).toBeVisible();
    const step = (await sheet.getByRole('button', { name: 'One year older' }).boundingBox())!;
    expect(step.height).toBeGreaterThanOrEqual(44);
    expect(clean(await axe(page))).toEqual([]);
    await sheet.getByRole('button', { name: 'Done' }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('the view switcher keeps its own size, with notes in the count line too', async ({ page, site }) => {
    for (const url of ['/places/', '/places/?k=nature.trail', '/places/?kid=6']) {
      await page.goto(`${site.url}${url}`);
      const box = (await page.locator('.filter-bar .seg').first().boundingBox())!;
      expect(box.height, url).toBeLessThanOrEqual(48);
      const active = (await page.locator('.filter-bar .seg-btn[aria-checked="true"]').boundingBox())!;
      expect(active.width, url).toBeLessThanOrEqual(80);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), url).toBe(true);
    }
  });
});
