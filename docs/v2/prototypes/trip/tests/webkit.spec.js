/* STEP2-PR: WebKit with touch emulation (EA3): the Move buttons work in Safari's engine, and the item sheet opens by tap. */
const { test, expect } = require('../../shared/tests/fixtures.js');
test.use({ browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, launchOptions: { args: [] } });
const COPY = '/trip/?id=demo-copy&edit=1';
const pos = (page, id) => page.evaluate((i) => { const l = TripDoc.locate(TripDoc.get('demo-copy'), i); return l ? [l.n, l.j] : null; }, id);

test('EA3 (WebKit touch): Move to day and Undo work by tap', async ({ page, base }) => {
  await page.goto(base + COPY);
  await page.getByRole('button', { name: /^Actions for Lago di Carezza/ }).tap();
  await page.getByRole('button', { name: 'Move to day…' }).tap();
  await page.getByRole('dialog').getByRole('button', { name: /^Day 5/ }).tap();
  expect((await pos(page, 'carezza'))[0]).toBe(5);
  await page.locator('#toast [data-a=undo]').tap();
  expect((await pos(page, 'carezza'))[0]).toBe(3);
});

test('EA3 (WebKit touch): Move up and Move down by tap', async ({ page, base }) => {
  await page.goto(base + COPY);
  await page.getByRole('button', { name: /^Actions for Lago di Carezza/ }).tap();
  await page.getByRole('button', { name: 'Move down' }).tap();
  expect(await pos(page, 'carezza')).toEqual([3, 1]);
});
