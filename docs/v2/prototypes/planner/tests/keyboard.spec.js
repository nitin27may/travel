/* Keyboard-only walk (no mouse): My trips, Trip home tabs, Bookings, Checklist, Travellers, Today. */
const { test, expect, open, trips } = require('./helpers.js');

const active = (page) => page.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { name: '', tag: 'body' };
  const lb = e.labels && e.labels[0] ? e.labels[0].textContent : '';
  const name = (e.getAttribute('aria-label') || lb || e.textContent || e.getAttribute('data-pin') || '').replace(/\s+/g, ' ').trim();
  return { name, tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || '', id: e.id, sel: e.getAttribute('aria-selected'), checked: e.checked };
});
/** Tab until the focused control's name matches; fails if it takes more than `max` presses. */
async function tabTo(page, re, max = 70) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const a = await active(page);
    if (re.test(a.name)) return a;
  }
  throw new Error('keyboard never reached ' + re);
}

test('keyboard only: My trips tabs, card menu, open a trip', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  let a = await tabTo(page, /^All\b/);
  expect(a.role).toBe('tab');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  a = await active(page);
  expect(a.name).toMatch(/^Upcoming/);
  expect(a.sel).toBe('true');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.keyboard.press('Home');
  await expect(page.getByRole('article')).toHaveCount(3);

  await tabTo(page, /Menu for Algonquin/);
  await page.keyboard.press('Enter');
  expect((await active(page)).name).toBe('Rename');
  await page.keyboard.press('ArrowDown');
  expect((await active(page)).name).toBe('Duplicate');
  await page.keyboard.press('Escape');
  expect((await active(page)).name).toMatch(/Menu for Algonquin/);
  await expect(page.locator('.menu:not([hidden])')).toHaveCount(0);

  // the trip switcher in the header opens and closes from the keyboard
  await page.locator('#chip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#switcher')).toBeVisible();
  expect((await active(page)).tag).toBe('button');
  await page.keyboard.press('Escape');
  await expect(page.locator('#switcher')).toBeHidden();
  expect((await active(page)).id).toBe('chip');

  await tabTo(page, /^Open$/);
  await tabTo(page, /^Open$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/trip\.html\?id=t-dolomites/);
});

test('keyboard only: Trip home tabs, Bookings, Checklist', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  await tabTo(page, /^Overview/);
  await page.keyboard.press('End');
  expect((await active(page)).name).toBe('Share');
  await expect(page.getByRole('tab', { name: 'Share' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Bookings/ })).toHaveAttribute('aria-selected', 'true');

  await tabTo(page, /Done: Hire car/);
  await page.keyboard.press('Space');
  let t = (await trips(page)).find((x) => x.id === 't-dolomites');
  expect(t.bookings.find((b) => /Hire car/.test(b.label)).done).toBe(true);
  expect((await active(page)).name).toMatch(/Done: Hire car/); // focus stays on the control after the page re-renders

  await page.getByRole('tab', { name: /Bookings/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Checklist/ })).toHaveAttribute('aria-selected', 'true');
  await tabTo(page, /New item/);
  await page.keyboard.type('Binoculars');
  await page.keyboard.press('Enter');
  t = (await trips(page)).find((x) => x.id === 't-dolomites');
  expect(t.checklist.map((c) => c.label)).toContain('Binoculars');
  expect((await active(page)).id).toBe('ck-new');
});

test('keyboard only: Travellers, the diff sheet traps focus, Escape closes it and focus lands on a sensible control', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  await tabTo(page, /Add infant/);
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await expect.poll(async () => (await active(page)).name).toBe('Apply to the plan');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('.sheet'))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await active(page)).role + (await active(page)).tag).not.toBe('body');
  await expect(page.getByRole('button', { name: 'Review plan changes' })).toBeVisible();
  await tabTo(page, /Review plan changes/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(async () => (await active(page)).name).toBe('Apply to the plan');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await trips(page)).find((x) => x.id === 't-dolomites').party.length).toBe(4);
});

test('keyboard only: dates sheet radios and fields', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  await tabTo(page, /Change dates/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await tabTo(page, /Exact dates/);
  await page.keyboard.press('ArrowDown');
  expect((await active(page)).name).toMatch(/A month/);
  await tabTo(page, /^Month$/);
  await page.keyboard.type('Aug');
  await tabTo(page, /Nights/);
  await tabTo(page, /Save dates/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  const t = (await trips(page)).find((x) => x.id === 't-dolomites');
  expect(t.dates.month).toBe(8);
  expect(t.nights).toBe(9);
});

test('keyboard only: Today day tabs, tick a stop, add a stop', async ({ page, base }) => {
  await open(page, base, '/planner/today.html?id=t-dolomites&day=2');
  await tabTo(page, /^Day 1/);
  await page.keyboard.press('ArrowRight');
  expect((await active(page)).name).toMatch(/^Day 2/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /^Day 3/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await tabTo(page, /^Done: /);
  await page.keyboard.press('Space');
  const t = (await trips(page)); // the done flag lives beside the contract record
  const done = await page.evaluate(() => window.P.get('t-dolomites').days[1].items.filter((i) => i.done).length);
  expect(done).toBe(1);
  expect(t.length).toBe(3);
  await tabTo(page, /Place or activity/);
  await page.keyboard.type('Gelato');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.P.get('t-dolomites').days[1].items.some((i) => i.name === 'Gelato'))).toBe(true);
});
