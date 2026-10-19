import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// L3b: trip tags, the Trips filter bar, the length and drive pills. Counts of real trips are not pinned: the data moves.
const axe = (page: import('@playwright/test').Page) => new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
const clean = (r: Awaited<ReturnType<typeof axe>>) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);

test.describe('the Trips filter bar', () => {
  test('four primary pills and More filters; the rest are one tap further (P4)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    const pills = page.locator('.facet-group .pill-trigger');
    await expect(pills).toHaveText([/^Where/, /^When/, /^Length/, /^Kids/, /^More filters/]);
    await page.getByRole('button', { name: 'More filters' }).click();
    const more = page.getByRole('dialog', { name: 'More filters' });
    for (const name of ['Activities', 'Source']) await expect(more.locator('summary', { hasText: name })).toBeVisible();
    expect(clean(await axe(page))).toEqual([]);
  });

  test('Length lists the short classes before the 4+ bands, with counts, and lands in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await page.locator('.pill-trigger', { hasText: /^Length/ }).click();
    const menu = page.getByRole('dialog', { name: 'Length' });
    const labels = await menu.locator('.opt-label').allInnerTexts();
    expect(labels.length).toBeGreaterThan(2);
    const order = ['Day trips', 'Overnights', 'Weekends', 'Long weekends', '4 to 8', '9 to 14', '15 nights'];
    const idx = labels.map((l) => order.findIndex((o) => l.startsWith(o))).filter((i) => i >= 0);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(clean(await axe(page))).toEqual([]);
    await menu.getByLabel(/^9 to 14 nights/).check();
    await expect(page).toHaveURL(/length=9-14/);
    await expect(page.locator('.chips')).toContainText('Length: 9 to 14 nights');
  });

  test('Kids is "a child of N", with the older plans filtered out and the unguided ones counted', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await page.locator('.pill-trigger', { hasText: /^Kids/ }).click();
    const menu = page.getByRole('dialog', { name: 'Kids' });
    await expect(menu.getByText('A child of 4', { exact: false })).toBeVisible();
    expect(clean(await axe(page))).toEqual([]);
    await menu.getByLabel(/A child of 6/).check();
    await expect(page).toHaveURL(/kid=6/);
    await expect(page.locator('.count')).toContainText('not checked yet');
  });

  test('every state is in the URL and survives a reload and Back', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?length=9-14&group=length&sort=nights&dir=desc`);
    await expect(page.locator('.card').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.chips')).toContainText('Length');
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page).toHaveURL(/view=list/);
    await page.goBack();
    await expect(page).not.toHaveURL(/view=list/);
  });

  test('an impossible combination suggests the nearest match', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?country=IT&length=day`);
    await expect(page.getByRole('heading', { name: /No trips match/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Remove .* to see \d+ trips?/ }).first()).toBeVisible();
    expect(clean(await axe(page))).toEqual([]);
  });

  test('the From Toronto pill is hidden while no trip has a drive time, with no line about it', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await expect(page.locator('.pill-trigger', { hasText: /^From Toronto/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'More filters' }).click();
    await expect(page.getByRole('dialog', { name: 'More filters' }).locator('summary', { hasText: 'From Toronto' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.count')).not.toContainText('From Toronto');
  });

  test('group by Length puts the shortest trips first', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?group=length`);
    const heads = await page.locator('.group-head h2, .group-heading, section[aria-labelledby^="grp-"] > :first-child').allInnerTexts();
    expect(heads.length).toBeGreaterThan(1);
    const order = ['Day trips', 'Overnights', 'Weekends', 'Long weekends', '4 to 8', '9 to 14', '15 nights'];
    const idx = heads.map((h) => order.findIndex((o) => h.startsWith(o))).filter((i) => i >= 0);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

test.describe('trip cards', () => {
  test('a full trip card has its length line, at most two suitability chips, tag links and the Highlights line, and no relevance chip', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?q=rockies`);
    const card = page.locator('article.card', { hasText: 'Rockies' }).first();
    await expect(card.locator('.card-sub')).toContainText('14 nights · 15 days');
    await expect(card.locator('.trip-tag-row[aria-label="Who it suits"] a')).toHaveCount(2);
    await expect(card.locator('.card-note')).toContainText('Highlights:');
    await expect(card.getByText(/Worth the journey|Worth a detour|Anchor/)).toHaveCount(0);
    expect(clean(await axe(page))).toEqual([]);
  });

  test('a tag chip opens the list filtered by it, with the chip active', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?q=rockies`);
    const card = page.locator('article.card', { hasText: 'Rockies' }).first();
    const chip = card.locator('.trip-tag-row[aria-label="Tags"] a[href*="tag="]').first();
    const href = (await chip.getAttribute('href'))!;
    const label = (await chip.innerText()).trim();
    expect(href).toMatch(/^\/trips\/\?tag=[a-z-]+$/);
    await chip.click();
    await expect(page).toHaveURL(new RegExp(href.replace('?', '\\?')));
    await expect(page.locator('.chips')).toContainText(`Activities: ${label}`);
    await expect(page.locator('article.card', { hasText: 'Rockies' }).first()).toBeVisible();
  });

  test('an overview trip shows Where and Length only, with no empty chips', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?q=costa rica`);
    const card = page.locator('article.card', { hasText: 'Costa Rica' }).first();
    await expect(card.locator('.trip-tag-row[aria-label="Who it suits"]')).toHaveCount(0);
    await expect(card.locator('.trip-tag-row[aria-label="Tags"] a')).toHaveCount(2);
    await expect(card.locator('.card-note')).toHaveCount(0);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the filter sheet: each facet folds with a Done button of 44 px, and nothing scrolls sideways', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.locator('summary', { hasText: /^Length/ }).click();
    const done = sheet.getByRole('button', { name: 'Done' }).first();
    await expect(done).toBeVisible();
    const box = (await done.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(clean(await axe(page))).toEqual([]);
    await done.click();
    await expect(sheet.locator('details.sheet-facet[open]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
