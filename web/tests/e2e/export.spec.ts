import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

// Exports end to end on the specimen page (which renders the three actions with the real Dolomites data): the files are
// downloaded in the browser and read back. Lane L5.
test.describe('copy, export, share', () => {
  test('GPX and CSV download with the toast naming the file', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [gpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^GPX/ }).click()]);
    expect(gpx.suggestedFilename()).toBe('dolomites-2027.gpx');
    const xml = readFileSync((await gpx.path())!, 'utf8');
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('© OpenStreetMap contributors');
    expect(xml).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    await expect(page.locator('.toast-region')).toContainText('Downloaded dolomites-2027.gpx');

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^CSV/ }).click()]);
    expect(csv.suggestedFilename()).toBe('dolomites-2027.csv');
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Day,Time,Name,Kind,Category,Area,Lat,Lon,Links');
  });

  test('the public trip menu offers no calendar download', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Calendar/ })).toBeDisabled();
  });

  test('copy sheet: primary off until a date is picked, then a dated calendar downloads and sign-in is offered', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: /Open copy sheet/ }).click();
    const copy = page.getByRole('button', { name: 'Copy to my trips' });
    await expect(copy).toBeDisabled();
    await expect(page.getByRole('button', { name: /Calendar \(\.ics\): pick a start date first/ })).toBeDisabled();
    await page.locator('.cal-cell:not([disabled])').last().click();
    await expect(copy).toBeEnabled();
    const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Calendar \(\.ics\)/ }).click()]);
    const text = readFileSync((await ics.path())!, 'utf8');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThanOrEqual(14);
    await copy.click();
    await expect(page.getByText('held in this browser only')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in to keep it' })).toHaveAttribute('href', '/sign-in/');
  });

  test('share copies the link and announces it in the polite live region', async ({ page, site, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: /^Share/ }).click();
    await expect(page.locator('.toast-region[aria-live="polite"]')).toContainText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/trips/dolomites-2027');
  });
});
