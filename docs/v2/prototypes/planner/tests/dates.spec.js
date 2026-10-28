const { test, expect, open, trips } = require('./helpers.js');

async function openDates(page) {
  await page.getByRole('button', { name: /Change dates|Add dates/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
const get = async (page, id) => (await trips(page)).find((t) => t.id === id);

test('date sheet: exact range, month only and flexible window all keep the nights', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const before = await get(page, 't-dolomites');
  expect(before.nights).toBe(9);

  await openDates(page);
  await page.getByLabel('A month').check();
  await expect(page.getByLabel('First day')).toBeHidden();
  await page.getByLabel('Month', { exact: true }).selectOption('8');
  expect(await page.getByLabel('Nights').inputValue()).toBe('9');
  await page.getByRole('button', { name: 'Save dates' }).click();
  let t = await get(page, 't-dolomites');
  expect(t.dates).toEqual({ month: 8 });
  expect(t.nights).toBe(9);
  await expect(page.locator('.thead .facts')).toContainText('Aug');

  await openDates(page);
  await expect(page.getByLabel('A month')).toBeChecked();
  await page.getByLabel('Flexible window').check();
  await page.getByRole('button', { name: 'Save dates' }).click();
  t = await get(page, 't-dolomites');
  expect(t.dates).toEqual({ month: 8, flexible: true });
  expect(t.nights).toBe(9);
  await expect(page.locator('.thead .facts')).toContainText('Around Aug');

  await openDates(page);
  await page.getByLabel('Exact dates').check();
  await page.getByLabel('First day').fill('2027-08-10');
  await page.getByRole('button', { name: 'Save dates' }).click();
  t = await get(page, 't-dolomites');
  expect(t.dates).toEqual({ from: '2027-08-10', to: '2027-08-19' });
  expect(t.nights).toBe(9);
});

test('the date model maps to the builder when: exact, month, flex; next weekend resolves to a range', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  const r = await page.evaluate(() => {
    const D = window.PDates, E = window.ProtoEngine;
    const out = {
      exact: D.whenOf({ dates: { from: '2027-07-13', to: '2027-07-22' } }),
      month: D.whenOf({ dates: { month: 9 } }),
      flex: D.whenOf({ dates: { month: 9, flexible: true } }),
      none: D.whenOf({ dates: {} }),
      next: D.fromWhen({ type: 'next' }),
    };
    // the engine reads the mapped values the way the builder does
    out.infoMonth = E.whenInfo({ when: out.month }).month;
    out.infoExact = E.whenInfo({ when: out.exact }).dated;
    out.roundTrip = ['exact', 'month', 'flex'].map((k) => D.modeOf({ dates: D.fromWhen(out[k]) }));
    return out;
  });
  expect(r.exact).toEqual({ type: 'dates', from: '2027-07-13', to: '2027-07-22' });
  expect(r.month).toEqual({ type: 'month', month: 9 });
  expect(r.flex).toEqual({ type: 'flex', month: 9 });
  expect(r.none).toEqual({ type: 'unsure' });
  expect(r.next).toEqual({ from: '2026-11-06', to: '2026-11-08' });
  expect(r.infoMonth).toBe(9);
  expect(r.infoExact).toBe(true);
  expect(r.roundTrip).toEqual(['exact', 'month', 'flex']);
});

test('a trip with a month shows no book-by dates and the planner still lists it under Planning', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  await openDates(page);
  await page.getByLabel('A month').check();
  await page.getByRole('button', { name: 'Save dates' }).click();
  await page.getByRole('tab', { name: /Bookings/ }).click();
  await expect(page.getByText('Book-by dates need travel dates')).toBeVisible();
  await page.goto(base + '/planner/index.html#planning');
  await expect(page.getByRole('article', { name: /Dolomites/ })).toBeVisible();
});
