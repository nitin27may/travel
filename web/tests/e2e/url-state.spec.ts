import { expect, readStore, test } from './fixtures';
import type { Page } from '@playwright/test';

const store = readStore();
const count = (page: Page) => page.locator('.filter-bar .count strong');
const pressed = (page: Page, view: string) => page.locator(`.seg-btn[data-view="${view}"]`);
const CHECKED = 'aria-checked';
// the app lists every public place, not only the 64 saved ones, so counts here are read from the page or bounded by the saved set
const caKinds = (kind: string) => store.places.filter((p) => p.kind === kind && p.area_id.startsWith('CA/')).length;

test.describe('the views share one URL state', () => {
  test('a view switch keeps the filters, and reload restores everything', async ({ page, site }) => {
    const lakes = caKinds('lake');
    await page.goto(`${site.url}/places/?country=CA&kind=lake&view=table`);
    await expect(pressed(page, 'table')).toHaveAttribute(CHECKED, 'true');
    await expect(count(page)).toHaveText(String(lakes));
    await expect(page.locator('.data-table tbody tr[data-row]')).toHaveCount(lakes);

    await pressed(page, 'list').click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page).toHaveURL(/country=CA/);
    await expect(page).toHaveURL(/kind=lake/);
    await expect(count(page)).toHaveText(String(lakes));
    await expect(page.locator('.list-view .row')).toHaveCount(lakes);

    await pressed(page, 'cards').click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.locator('.card')).toHaveCount(lakes);
    await expect(page.getByRole('button', { name: /Remove filter Country: Canada/ })).toBeVisible();

    await pressed(page, 'table').click();
    await page.reload();
    await expect(pressed(page, 'table')).toHaveAttribute(CHECKED, 'true');
    await expect(count(page)).toHaveText(String(lakes));
    await expect(page.getByRole('button', { name: /Remove filter Kind: Lake/ })).toBeVisible();
  });

  test('chips remove one filter, Clear all removes the rest, Back undoes', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&kind=lake,area`);
    await expect(page.locator('.chips .chip')).toHaveCount(3);
    await page.getByRole('button', { name: /Remove filter Kind: Area/ }).click();
    await expect(page).toHaveURL(/kind=lake$/);
    await page.goBack();
    await expect(page).toHaveURL(/kind=lake,area/);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/country|kind/);
    expect(Number(await count(page).textContent())).toBeGreaterThan(64);
  });

  test('a facet menu filters with live counts', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.getByRole('button', { name: 'Kind' }).click();
    const lakeOption = page.getByRole('checkbox', { name: /^Lake/ });
    const lakes = Number(((await lakeOption.evaluate((el) => el.closest('label')?.textContent)) ?? '').replace(/\D/g, ''));
    await lakeOption.check();
    await expect(page).toHaveURL(/kind=lake/);
    await expect(count(page)).toHaveText(String(lakes));
    expect(lakes).toBeGreaterThanOrEqual(store.places.filter((p) => p.kind === 'lake').length);
    // Region sits under More filters and appears only after a country is chosen
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More filters' }).click();
    await expect(page.getByRole('dialog', { name: 'More filters' }).locator('summary', { hasText: 'Region' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Country/ }).click();
    await page.getByRole('radio', { name: /^Canada/ }).check();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^More filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'More filters' }).locator('summary', { hasText: 'Region' })).toBeVisible();
  });

  test('season filters on the app (the legacy page has no season)', async ({ page, site }) => {
    const july = store.places.filter((p) => p.season_months.includes(7)).length;
    expect(july).toBeGreaterThan(0);
    await page.goto(`${site.url}/places/?season=7`);
    // the saved places plus the researched Dolomites places that are open in July
    expect(Number(await count(page).textContent())).toBeGreaterThanOrEqual(july);
  });

  test('a legacy hash is rewritten to the query string, and view=grid means cards', async ({ page, site }) => {
    await page.goto(`${site.url}/places/#country=CA&view=grid&kind=lake`);
    await expect(page).toHaveURL(/\/places\/\?country=CA&kind=lake$/);
    await expect(pressed(page, 'cards')).toHaveAttribute(CHECKED, 'true');
    await expect(count(page)).toHaveText(String(caKinds('lake')));
    await page.goto(`${site.url}/places/?view=grid`);
    await expect(pressed(page, 'cards')).toHaveAttribute(CHECKED, 'true');
  });

  test('the map tab is on: it opens the Map view and keeps the filters', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=IT`);
    const map = pressed(page, 'map');
    await expect(map).not.toHaveAttribute('aria-disabled', 'true');
    await map.click();
    await expect(page).toHaveURL(/country=IT.*view=map|view=map.*country=IT/);
    await expect(page.locator('.places-map')).toBeVisible();
  });

  test('an empty result names the filters to loosen', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&kind=lighthouse&kid=strong-kid`);
    await expect(page.getByRole('heading', { name: 'No places match' })).toBeVisible();
    // the closest match comes first as the main action, and the bar holds the only Clear all
    await expect(page.getByRole('button', { name: 'Clear all' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Clear all filters/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Remove .*Kids: .* to see/ }).click();
    await expect(page.getByRole('heading', { name: 'No places match' })).toHaveCount(0);
    await expect(count(page)).not.toHaveText('0');
  });

  test('the closest match is the removal that keeps the most of the request', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&kind=lighthouse&kid=strong-kid`);
    const main = page.locator('.empty').getByRole('button', { name: /to see \d+ place/ });
    const counts = (await main.allTextContents()).map((t) => Number(/to see (\d+)/.exec(t)![1]));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  test('the Kids filter says how many places were left out because nobody has checked them', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?kid=yes`);
    await expect(page.locator('.filter-bar .count .count-note')).toHaveText(/\d+ not checked yet/);
    await page.goto(`${site.url}/places/?kid=unknown`);
    await expect(page.locator('.filter-bar .count .count-note')).toHaveCount(0);
  });

  test('old links with Tag, Trip, Region and effort parameters still work', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&region=AB&tag=hiking`);
    await expect(page.getByRole('button', { name: /Remove filter Region: / })).toBeVisible();
    await expect(page.getByRole('button', { name: /Remove filter Tag: / })).toBeVisible();
    await expect(page.getByRole('button', { name: /^More filters · 2/ })).toBeVisible();
    // the hidden slots never filter, so a link that carries them is not a dead end
    await page.goto(`${site.url}/places/?effort=easy&stroller=any`);
    await expect(page.getByRole('heading', { name: 'No places match' })).toHaveCount(0);
  });
});

test.describe('keyboard and place links', () => {
  test('"/" focuses search', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeFocused();
    await page.keyboard.type('louise');
    await expect(count(page)).toHaveText('1');
    await expect(page).toHaveURL(/q=louise/);
  });

  test('a card opens its place page (places are pages, not sheets)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=louise`);
    const open = page.locator('a.card-open', { hasText: 'Lake Louise' });
    await expect(open).toHaveAttribute('href', '/places/lake-louise/');
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/places\/lake-louise\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lake Louise' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('table: header sorts with aria-sort, arrows move between rows, Enter opens', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table&group=none`);
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(page).toHaveURL(/sort=name/);
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(page).toHaveURL(/sort=name&dir=desc/);
    const rows = page.locator('tr[data-row]');
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/places\/[a-z0-9-]+\/$/);
  });

  test('table: group by with counts, collapse a group, choose columns', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table`);
    const groups = page.locator('tr.grp-row');
    await expect.poll(() => groups.count(), { message: 'groups render after hydration' }).toBeGreaterThanOrEqual(3); // one page of 48 rows spans a few countries, not all seven
    const first = groups.first();
    const n = Number(await first.locator('.gh-count').textContent());
    const rowsBefore = await page.locator('tr[data-row]').count();
    await first.getByRole('button').click();
    await expect(page.locator('tr[data-row]')).toHaveCount(rowsBefore - n);
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('checkbox', { name: 'Tags' }).check();
    await expect(page).toHaveURL(/cols=/);
    await expect(page.getByRole('columnheader', { name: 'Tags' })).toBeVisible();
  });

  test('table: saved views round trip, and no whole-list CSV', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table&country=CA`);
    await page.getByRole('button', { name: 'Saved views' }).click();
    await page.getByPlaceholder('Name this view').fill('Canada table');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.goto(`${site.url}/places/`);
    await page.getByRole('radio', { name: 'Table', exact: true }).click();
    await page.getByRole('button', { name: /Saved views/ }).click();
    await page.getByRole('button', { name: 'Canada table', exact: true }).click();
    await expect(page).toHaveURL(/country=CA/);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
  });
});

test.describe('pages', () => {
  test('a place page links onward and has its own title', async ({ page, site }) => {
    await page.goto(`${site.url}/places/lake-louise/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Lake Louise' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Globe' }).first()).toHaveAttribute('href', '/globe/place/lake-louise/');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/places\/lake-louise\/$/);
  });

  test('/locations/ forwards to /places/ and keeps the hash', async ({ page, site }) => {
    await page.goto(`${site.url}/locations/#country=CA`);
    await expect(page).toHaveURL(/\/places\/\?country=CA/);
  });

  test('home shows the cover, the trips strip from the data and season chips', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    const heads = await page.locator('main h1, main h2').allInnerTexts();
    expect(heads.map((h) => h.toLowerCase())).toEqual(['trip plans', 'trips', 'places worth a trip', 'about the data']);
    await expect(page.getByRole('link', { name: 'All 14 trips →' })).toHaveAttribute('href', '/trips/');
    const strip = page.locator('section[aria-labelledby="home-trips-h"]');
    const hrefs = await strip.locator('a.card-open').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs.length).toBe(6);
    expect(hrefs.every((h) => /^\/trips\/[a-z0-9-]+\/$/.test(h ?? ''))).toBe(true);
    // public trips are dateless: a season chip, never a countdown or a date
    await expect(strip.getByText(/In \d+ days|Past trip/)).toHaveCount(0);
    await expect(strip.locator('.chip').filter({ hasText: /September|Season not set yet|July/ }).first()).toBeVisible();
  });

  test('about the data lists every source and the privacy line', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`);
    await expect(page.getByText('Never published: traveller ages')).toBeVisible();
    for (const name of ['OpenStreetMap', 'Natural Earth', 'Wikimedia Commons', 'Open-Meteo', 'geoBoundaries']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  });

  test('theme toggle switches and is remembered (light is the default)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: /Switch to dark theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('units preference is remembered (the conversions are unit-tested in format.test.ts)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.getByRole('radio', { name: 'mi, ft' }).click();
    await expect(page.getByRole('radio', { name: 'mi, ft' })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'mi, ft' })).toBeChecked();
  });
});
