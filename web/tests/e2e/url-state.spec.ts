import { expect, readStore, test } from './fixtures';
import type { Page } from '@playwright/test';

const store = readStore();
const count = (page: Page) => page.locator('.filter-bar .count strong');
const pressed = (page: Page, view: string) => page.locator(`.seg-btn[data-view="${view}"]`);
const caKinds = (kind: string) => store.places.filter((p) => p.kind === kind && p.area_id.startsWith('CA/')).length;

test.describe('the views share one URL state', () => {
  test('a view switch keeps the filters, and reload restores everything', async ({ page, site }) => {
    const lakes = caKinds('lake');
    await page.goto(`${site.url}/places/?country=CA&kind=lake&view=table`);
    await expect(pressed(page, 'table')).toHaveAttribute('aria-pressed', 'true');
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
    await expect(pressed(page, 'table')).toHaveAttribute('aria-pressed', 'true');
    await expect(count(page)).toHaveText(String(lakes));
    await expect(page.getByRole('button', { name: /Remove filter Kind: Lake/ })).toBeVisible();
  });

  test('chips remove one filter, Clear all removes the rest, Back undoes', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&kind=lake,park`);
    await expect(page.locator('.chips .chip')).toHaveCount(3);
    await page.getByRole('button', { name: /Remove filter Kind: Park/ }).click();
    await expect(page).toHaveURL(/kind=lake$/);
    await page.goBack();
    await expect(page).toHaveURL(/kind=lake,park/);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/country|kind/);
    await expect(count(page)).toHaveText('64');
  });

  test('a facet menu filters with live counts', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.getByRole('button', { name: 'Kind' }).click();
    const lakeOption = page.getByRole('checkbox', { name: /^Lake/ });
    await lakeOption.check();
    await expect(page).toHaveURL(/kind=lake/);
    await expect(count(page)).toHaveText(String(store.places.filter((p) => p.kind === 'lake').length));
    // the Region button appears only after a country is chosen
    await expect(page.getByRole('button', { name: 'Region' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Country/ }).click();
    await page.getByRole('radio', { name: /^Canada/ }).check();
    await expect(page.getByRole('button', { name: 'Region' })).toBeVisible();
  });

  test('season filters on the app (the legacy page has no season)', async ({ page, site }) => {
    const july = store.places.filter((p) => p.status !== 'dropped' && p.season_months.includes(7)).length;
    expect(july).toBeGreaterThan(0);
    await page.goto(`${site.url}/places/?season=7`);
    await expect(count(page)).toHaveText(String(july));
  });

  test('a legacy hash is rewritten to the query string, and view=grid means cards', async ({ page, site }) => {
    await page.goto(`${site.url}/places/#country=CA&view=grid&kind=lake`);
    await expect(page).toHaveURL(/\/places\/\?country=CA&kind=lake$/);
    await expect(pressed(page, 'cards')).toHaveAttribute('aria-pressed', 'true');
    await expect(count(page)).toHaveText(String(caKinds('lake')));
    await page.goto(`${site.url}/places/?view=grid`);
    await expect(pressed(page, 'cards')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the map tab is present but disabled with a reason', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    const map = pressed(page, 'map');
    await expect(map).toHaveAttribute('aria-disabled', 'true');
    await expect(map).toHaveAttribute('title', 'Map view arrives in the next release');
    await map.click({ force: true });
    await expect(page).not.toHaveURL(/view=map/);
  });

  test('an empty result names the filters to loosen', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&kind=lighthouse&status=planned`);
    await expect(page.getByRole('heading', { name: 'No places match' })).toBeVisible();
    await page.getByRole('button', { name: /Remove .*Status: Planned.* to see/ }).click();
    await expect(page.getByRole('heading', { name: 'No places match' })).toHaveCount(0);
    await expect(count(page)).not.toHaveText('0');
  });
});

test.describe('keyboard and detail sheet', () => {
  test('"/" focuses search', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeFocused();
    await page.keyboard.type('louise');
    await expect(count(page)).toHaveText('1');
    await expect(page).toHaveURL(/q=louise/);
  });

  test('opening a card shows the sheet, Escape closes it and focus returns to the trigger', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=louise`);
    const open = page.locator('a.card-open', { hasText: 'Lake Louise' });
    await open.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Lake Louise' })).toBeVisible();
    await expect(page).toHaveURL(/focus=CA/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/focus=/);
    await expect(open).toBeFocused();
  });

  test('a ?focus= deep link opens the sheet on load', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?focus=CA/AB/banff-national-park/lake-louise`);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Lake Louise' })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: /Open place page/ })).toHaveAttribute('href', '/places/CA/AB/banff-national-park/lake-louise/');
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
    await expect(page).toHaveURL(/sort=-name/);
    const rows = page.locator('tr[data-row]');
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(rows.first()).toBeFocused();
  });

  test('table: group by with counts, collapse a group, choose columns', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table`);
    const groups = page.locator('tr.grp-row');
    await expect(groups).toHaveCount(7);
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

  test('table: saved views round trip and CSV export', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table&country=CA`);
    await page.getByRole('button', { name: 'Saved views' }).click();
    await page.getByPlaceholder('Name this view').fill('Canada table');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.goto(`${site.url}/places/`);
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await page.getByRole('button', { name: /Saved views/ }).click();
    await page.getByRole('button', { name: 'Canada table', exact: true }).click();
    await expect(page).toHaveURL(/country=CA/);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('places.csv');
  });
});

test.describe('pages', () => {
  test('a place page links onward and has its own title', async ({ page, site }) => {
    await page.goto(`${site.url}/places/CA/AB/banff-national-park/lake-louise/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Lake Louise' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Globe' }).first()).toHaveAttribute('href', /^\/globe\/#c=CAN&p=/);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/places\/CA\/AB\/banff-national-park\/lake-louise\/$/);
  });

  test('/locations/ forwards to /places/ and keeps the hash', async ({ page, site }) => {
    await page.goto(`${site.url}/locations/#country=CA`);
    await expect(page).toHaveURL(/\/places\/\?country=CA/);
  });

  test('home lists the legacy trips with date badges and links onward', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Trip plans' })).toBeVisible();
    await expect(page.locator('.trip-card-grid .card').first()).toBeVisible();
    await expect(page.getByText(/In \d+ days|Past trip/).first()).toBeVisible();
    const hrefs = await page.locator('.trip-card-grid a.card-open').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs.length).toBe(14);
    expect(hrefs.every((h) => /^\/[a-z0-9-]+\/$/.test(h ?? ''))).toBe(true);
  });

  test('about the data lists every source and the privacy line', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`);
    await expect(page.getByText('Never published: traveller ages')).toBeVisible();
    for (const name of ['OpenStreetMap', 'Natural Earth', 'Wikimedia Commons', 'Open-Meteo', 'geoBoundaries']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  });

  test('theme toggle switches and is remembered', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'shell');
    await page.getByRole('button', { name: /Switch to light theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'shell-light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'shell-light');
  });

  test('units preference converts elevations and is remembered', async ({ page, site }) => {
    await page.goto(`${site.url}/places/CA/AB/banff-national-park/lake-louise/`);
    await expect(page.getByText('1,730 m')).toBeVisible();
    await page.getByRole('button', { name: 'mi, ft' }).click();
    await expect(page.getByText('5,680 ft')).toBeVisible();
    await page.reload();
    await expect(page.getByText('5,680 ft')).toBeVisible();
  });
});
