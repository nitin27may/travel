import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

// Exports end to end on the specimen page (which renders the three actions with the real Dolomites data): the files are
// downloaded in the browser and read back. Lane L5.
test.describe('copy, export, share', () => {
  test('GPX and CSV download with the toast naming the file', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [gpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^For a GPS or hiking app \(GPX\)/ }).click()]);
    expect(gpx.suggestedFilename()).toBe('dolomites-2027.gpx');
    const xml = readFileSync((await gpx.path())!, 'utf8');
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('© OpenStreetMap contributors');
    expect(xml).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    await expect(page.locator('.toast-region')).toContainText('Downloaded dolomites-2027.gpx');

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^For a spreadsheet \(CSV\)/ }).click()]);
    expect(csv.suggestedFilename()).toBe('dolomites-2027.csv');
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Day,Time,Name,Kind,Category,Area,Lat,Lon,Approximate,Links');
  });

  test('the public trip menu offers no calendar download', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Calendar/ })).toBeDisabled();
  });

  test('copy sheet: primary off until a date is picked, then a dated calendar downloads and the copy is kept in Mine', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: /Open copy sheet/ }).click();
    const copy = page.getByRole('button', { name: 'Copy to my trips' });
    await expect(copy).toBeDisabled();
    await expect(page.getByRole('button', { name: /Calendar \(\.ics\): pick a start date first/ })).toBeDisabled();
    await page.locator('.cal-cell[data-season]:not([disabled])').first().click();
    await expect(copy).toBeDisabled(); // adults are not chosen yet: nothing is preselected
    await page.getByLabel('Adults').selectOption('2');
    await page.getByRole('button', { name: 'More children' }).click();
    await expect(copy).toBeDisabled(); // and the child's age must be chosen too
    await page.getByLabel('Child 1 age').selectOption('7');
    await expect(copy).toBeEnabled();
    const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Calendar \(\.ics\)/ }).click()]);
    const text = readFileSync((await ics.path())!, 'utf8');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThanOrEqual(14);
    await copy.click();
    await expect(page.getByRole('link', { name: 'Open in Mine' })).toHaveAttribute('href', '/mine/?show=trips');
    await expect(page.locator('.toast-region .toast')).toHaveCount(0); // the sheet is modal: Undo sits in its footer, not in a toast
    await expect(page.locator('.copy-sheet').getByRole('button', { name: 'Undo' })).toBeVisible();
  });

  test('season window: the trip season is underlined and a start that runs past it warns', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: /Open copy sheet/ }).click();
    await expect(page.locator('.cal-cell[data-season]').first()).toBeVisible();
    await expect(page.getByText('Trip season')).toBeVisible();
    // 14 days from the end of August leaves the 15 Jul to 31 Aug window
    for (let i = 0; i < 14 && !(await page.locator('.cal-title', { hasText: 'August' }).count()); i++) await page.getByRole('button', { name: 'Next month' }).click();
    await page.locator('.cal-cell[data-date$="-08-25"]:not([disabled])').click();
    await expect(page.getByText(/outside the season this plan is built for/)).toBeVisible();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.locator('.cal-cell[data-date$="-07-20"]:not([disabled])').click();
    await expect(page.getByText(/outside the season this plan is built for/)).toHaveCount(0);
  });

  test('share copies the link and announces it in the polite live region', async ({ page, site, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: /^Share/ }).click();
    await expect(page.locator('.toast-region[aria-live="polite"]')).toContainText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/trips/dolomites-2027');
  });
});
