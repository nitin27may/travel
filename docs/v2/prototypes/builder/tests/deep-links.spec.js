/* Plan 1B: the three walkthrough paths and every deep link load with no console error, no horizontal scroll and a clean contrast
   report, at 390 and 1440, light and dark. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');

const LINKS = {
  'near 0': '?m=near&n=0&p=algonquin-provincial-park',
  'near 1': '?m=near&n=1&p=algonquin-provincial-park',
  'near 2': '?m=near&n=2&p=algonquin-provincial-park',
  'trip banff': '?m=trip&cc=CA&p=banff-national-park',
  'add': '?add=banff-national-park--johnston-canyon&p=banff-national-park',
  'saved': '?saved=1',
  'copy dolomites': '?copy=dolomites',
  'edit': '?edit=SEED1',
  'review': '?review=SEED1',
};
for (const w of [390, 1440]) for (const theme of ['light', 'dark']) for (const [name, q] of Object.entries(LINKS)) {
  test(`deep link ${name} at ${w}px ${theme}`, async ({ page, base }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/builder/?fast');
    const id = await page.evaluate(() => ProtoContract.readTrips(localStorage)[1].id);
    await page.goto(base + '/builder/' + q.replace('SEED1', id) + (q.includes('?') ? '&' : '?') + 'fast&theme=' + theme);
    await expect(page.locator('#frame')).toBeVisible();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const c = await checkContrast(page, { themes: [theme] });
    expect(formatFailures(c)).toBe('');
    expect(errors).toEqual([]);
  });
}

test('walkthrough: weekend from the Algonquin park page to a built, reviewed plan', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast&m=near&n=1&p=algonquin-provincial-park');
  await page.getByRole('button', { name: /Raise the reach to 4 h/ }).click();
  await page.getByRole('button', { name: /^Next: / }).click();
  await page.getByRole('button', { name: 'Pick', exact: true }).first().click();
  await page.getByRole('button', { name: /^Next: / }).click();
  await page.getByRole('button', { name: 'Build my days' }).click();
  await expect(page.getByText(/^Built \d+ days/)).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.locator('#hdr .t b')).toHaveText('Review');
});
