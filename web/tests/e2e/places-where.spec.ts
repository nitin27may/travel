import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// LST2 part a (nearby-and-regions N0): the Where pill. Country, then state or province, then parks and areas, with counts and a chip
// per level. Real data; the numbers are read from the menu and compared with the list, never typed in.

const count = (page: Page) => page.locator('.filter-bar .count strong');
const pill = (page: Page) => page.locator('.facet-group .where-pill .pill-trigger');
const rowCount = async (row: ReturnType<Page['getByRole']>) => Number(/\d+/.exec(await row.locator('.opt-count').innerText())![0]);

/** The page and its lazy chunks are in before a step runs (the pills are placeholders until then). */
async function go(page: Page, site: { url: string }, path: string) {
  await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
  // on a phone the bar's pills are folded away; there the sheet and the panel are the controls
  if ((page.viewportSize()?.width ?? 1280) < 640) return;
  const ready = page.locator('.facet-group .pill-trigger:not([aria-disabled])').first();
  // a script chunk dropped by the static server under load leaves the placeholders for good: one reload is the visitor's own remedy
  try {
    await expect(ready).toBeVisible({ timeout: 6_000 });
  } catch {
    await page.reload({ waitUntil: 'networkidle' });
    await expect(ready).toBeVisible();
  }
}

async function openWhere(page: Page) {
  await pill(page).click();
  const menu = page.getByRole('dialog', { name: 'Where' });
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('Where pill (N0)', () => {
  test('Canada, then Alberta, then a park: counts, URL keys, pill label and a chip per level', async ({ page, site }) => {
    await go(page, site, `/places/`);
    const menu = await openWhere(page);
    await menu.getByRole('option', { name: /^Canada\b/ }).click();
    await expect(page).toHaveURL(/country=CA/);
    const alberta = menu.getByRole('option', { name: /^Alberta\b/ });
    await expect(alberta).toBeVisible();
    const albertaN = await rowCount(alberta);
    expect(albertaN).toBeGreaterThan(0);
    await alberta.click();
    await expect(page).toHaveURL(/country=CA&region=alberta/);
    await expect(count(page)).toHaveText(String(albertaN));
    await expect(pill(page)).toHaveText('Where · Alberta');
    // the third level: parks and areas of Alberta, with a count each; "All of Alberta" leads
    const areas = menu.getByRole('listbox', { name: 'Parks and areas' });
    await expect(areas.getByRole('option').first()).toHaveAccessibleName(/^All of Alberta \d+ places$/);
    const banff = areas.getByRole('option').nth(1);
    const banffName = (await banff.locator('.where-name').innerText()).trim();
    const banffN = await rowCount(banff);
    await banff.click();
    await expect(page).toHaveURL(/area=/);
    await expect(count(page)).toHaveText(String(banffN));
    await expect(pill(page)).toHaveText(`Where · ${banffName}`);
    await page.keyboard.press('Escape');
    const chips = page.getByRole('list', { name: 'Active filters' });
    await expect(chips.locator('.chip')).toHaveText(['Canada', 'Alberta', banffName]);
  });

  test('removing Canada clears region and area; removing Alberta keeps Canada and drops the area', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA&region=alberta&area=banff`);
    await expect(count(page)).toHaveText(/^\d+$/);
    await page.getByRole('button', { name: 'Remove filter Alberta' }).click();
    await expect(page).toHaveURL(/country=CA/);
    await expect(page).not.toHaveURL(/region=|area=/);
    await go(page, site, `/places/?country=CA&region=alberta&area=banff`);
    await page.getByRole('button', { name: 'Remove filter Canada' }).click();
    await expect(page).not.toHaveURL(/country=|region=|area=/);
    await expect(pill(page)).toHaveText('Where');
  });

  test('the pill clear button clears all three levels', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA&region=alberta`);
    await expect(pill(page)).toHaveText('Where · Alberta');
    await page.getByRole('button', { name: 'Clear Where filter' }).click();
    await expect(page).not.toHaveURL(/country=|region=/);
  });

  test('a sentence in the list box ("hikes in Alberta") lands on the same keys and the same pill label as the menu', async ({ page, site }) => {
    await go(page, site, `/places/`);
    const box = page.getByRole('searchbox', { name: /Search places/ });
    await box.fill('hikes in Alberta');
    // the reading is drawn once the parser has loaded; Enter before that would search the words
    await expect(page.getByRole('group', { name: 'How the search was read' })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA&region=alberta/);
    await expect(pill(page)).toHaveText('Where · Alberta');
  });

  test('four pills with no Kind, six at most with one; Region and Area are not under More filters', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA&region=alberta`);
    const pills = page.locator('.facet-group .pill-trigger');
    await expect(pills).toHaveText([/^Where/, /^Kind/, /^Season/, /^Youngest child/, /^More filters/]);
    await page.getByRole('button', { name: /^More filters/ }).click();
    const more = page.getByRole('dialog', { name: 'More filters' });
    for (const name of ['Region', 'Area', 'Country']) await expect(more.locator('summary', { hasText: new RegExp(`^${name}`) })).toHaveCount(0);
    await expect(more.getByText(/Region appears once/)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await go(page, site, `/places/?k=nature.trail`);
    await expect(count(page)).toHaveText(/^\d+$/);
    expect(await pills.count()).toBeLessThanOrEqual(7);
  });

  test('the find field reaches a province by its name, a prefix or its code, and says so when nothing matches', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA`);
    await expect(count(page)).toHaveText(/^\d+$/);
    const menu = await openWhere(page);
    const find = menu.getByRole('searchbox', { name: /Find a country/ });
    await expect(find).toBeFocused();
    await find.fill('AB');
    await expect(menu.getByRole('option', { name: /^Alberta\b/ })).toBeVisible();
    await find.fill('Alb');
    await expect(menu.getByRole('option', { name: /^Alberta\b/ })).toBeVisible();
    await find.fill('Alberta');
    await find.press('Enter');
    await expect(page).toHaveURL(/country=CA&region=alberta/);
    await expect(find).toHaveValue('');
    await find.fill('zzzz');
    await expect(menu.getByRole('button', { name: /Search places for/ })).toBeVisible();
  });

  test('keyboard only: open, pick a country, a province and a park, then Escape returns focus to the pill', async ({ page, site }) => {
    await go(page, site, `/places/`);
    await pill(page).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Where' });
    await expect(menu.getByRole('searchbox', { name: /Find a country/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('option', { name: /^Canada\b/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    // Enter on a country opens the level below: focus is on its first option, "All of Canada"
    await expect(menu.getByRole('option', { name: /^All of Canada\b/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('option', { name: /^Alberta\b/ })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/region=alberta/);
    await page.keyboard.press('ArrowRight');
    await expect(menu.getByRole('option', { name: /^All of Alberta\b/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/area=/);
    await page.keyboard.press('ArrowLeft');
    await expect(menu.getByRole('option', { name: /^Alberta\b/ })).toBeFocused();
    // typing goes to the find field
    await page.keyboard.press('q');
    await expect(menu.getByRole('searchbox', { name: /Find a country/ })).toHaveValue('q');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(pill(page)).toBeFocused();
  });

  test('options carry their count and meaning in their names; the open menu has no axe violations', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA&region=alberta`);
    await expect(count(page)).toHaveText(/^\d+$/);
    const menu = await openWhere(page);
    await expect(menu.getByRole('option', { name: /^Alberta \d+ places$/ })).toBeVisible();
    await expect(menu.getByRole('listbox')).toHaveCount(3);
    const results = await new AxeBuilder({ page }).include('.where-popover').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  test('"Counting…" shows while the country rows load, in the count line and in the province column', async ({ page, site }) => {
    await page.route(/\/api\/v1\/places\/\?(?=.*country=CA)/, async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.continue();
    });
    // no wait for the network here: the point is the moment before the file arrives
    await page.goto(`${site.url}/places/?country=CA`);
    await expect(page.locator('.filter-bar .count')).toContainText('Counting');
    const menu = await openWhere(page);
    await expect(menu.getByRole('status')).toHaveText(/Counting/);
    await expect(count(page)).toHaveText(/^\d+$/);
    await expect(menu.getByRole('option', { name: /^Alberta\b/ })).toBeVisible();
  });
});

test.describe('Where at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the summary line names Where and counts it as one filter; the drill-down rows are 44 px with a back row that names the parent', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA&region=alberta`);
    await expect(page.locator('.filter-bar .count')).toBeVisible();
    await expect(page.locator('.phone-summary-text')).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, 500));
    const summary = page.locator('.phone-summary-text');
    await expect(summary).toHaveText(/^\d+ places · Alberta · 1 filter$/);
    expect(await page.locator('.phone-summary').evaluate((el) => el.getBoundingClientRect().height)).toBe(52);
    await page.getByRole('button', { name: /^Edit/ }).click();
    await page.locator('.phone-pills .where-pill .pill-trigger').click();
    const menu = page.getByRole('dialog', { name: 'Where' });
    // Alberta is chosen, so the menu opens on its parks and areas; the back row names the province
    await expect(menu.locator('.where-title')).toHaveText('Alberta');
    await expect(menu.getByRole('button', { name: 'Back to provinces' })).toBeVisible();
    const rows = menu.getByRole('option');
    await expect(rows.first()).toBeVisible();
    for (const i of [0, 1, 2]) expect(Math.round((await rows.nth(i).boundingBox())!.height)).toBeGreaterThanOrEqual(44); // layout reports 43.99999 for a 44 px row
    await menu.locator('.where-back').click();
    await expect(menu.locator('.where-title')).toHaveText('Canada');
    await expect(menu.getByRole('option', { name: /^All of Canada\b/ })).toBeVisible();
    await menu.locator('.where-back').click();
    await expect(menu.getByRole('option', { name: /^Italy\b/ })).toBeVisible();
    // no scrim and no focus trap; Done closes the menu and the sticky summary keeps its 52 px
    await menu.getByRole('button', { name: /^(Done|Show)/ }).click();
    await expect(menu).toBeHidden();
    expect(await page.locator('.phone-summary').evaluate((el) => el.getBoundingClientRect().height)).toBe(52);
  });

  test('the Filters sheet carries Where as its first group', async ({ page, site }) => {
    await go(page, site, `/places/?country=CA`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet.locator('summary').first()).toContainText('Where');
    await expect(sheet.locator('summary', { hasText: /^(Region|Area)/ })).toHaveCount(0);
  });
});
