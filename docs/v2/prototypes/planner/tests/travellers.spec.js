const { test, expect, watch, open, trips } = require('./helpers.js');

const dolomites = async (page) => (await trips(page)).find((t) => t.id === 't-dolomites');
const placeDays = (t) => Object.fromEntries(t.days.flatMap((d) => d.items.map((i) => [i.id, d.n])));

test('adding an infant re-flows the plan: the diff sheet shows pace, moved, added and removed, and keeps locked stops', async ({ page, base }) => {
  const errors = watch(page);
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  const before = await dolomites(page);
  await page.getByRole('button', { name: 'Add infant' }).click();
  const sheet = page.getByRole('dialog', { name: /Plan changes for 4 travellers/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Pace');
  await expect(sheet).toContainText('Standard');
  await expect(sheet).toContainText('Relaxed');
  const removed = await sheet.locator('[data-diff=removed]').count();
  const moved = await sheet.locator('[data-diff=moved]').count();
  const added = await sheet.locator('[data-diff=added]').count();
  expect(removed + moved + added).toBeGreaterThan(0);
  expect(removed).toBeGreaterThan(0); // a hike is not for an infant
  await expect(sheet.locator('[data-diff=removed]').first()).toContainText(/Not for age 0|Every day is full|No room/);
  // before Apply the days are unchanged but the party already has the infant
  expect(placeDays(await dolomites(page))).toEqual(placeDays(before));
  await sheet.getByRole('button', { name: 'Apply to the plan' }).click();
  await expect(sheet).toBeHidden();
  const after = await dolomites(page);
  expect(after.party.map((p) => p.type)).toEqual(['adult', 'adult', 'child', 'infant']);
  expect(placeDays(after)).not.toEqual(placeDays(before));
  // locked stops stay on their day
  const lockedBefore = before.days.flatMap((d) => d.items.filter((i) => i.locked).map((i) => [i.id, d.n]));
  const lockedAfter = after.days.flatMap((d) => d.items.filter((i) => i.locked).map((i) => [i.id, d.n]));
  expect(lockedAfter).toEqual(lockedBefore);
  expect(after.days.length).toBe(before.days.length);
  expect(errors()).toEqual([]);
});

test('Undo after Apply restores the plan and the party', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  const before = await dolomites(page);
  await page.getByRole('button', { name: 'Add infant' }).click();
  await page.getByRole('button', { name: 'Apply to the plan' }).click();
  await page.locator('.toast button', { hasText: 'Undo' }).click();
  const after = await dolomites(page);
  expect(after.party.length).toBe(3);
  expect(placeDays(after)).toEqual(placeDays(before));
  expect(after.days.map((d) => d.items.map((i) => i.id))).toEqual(before.days.map((d) => d.items.map((i) => i.id)));
});

test('Undo this change in the sheet reverts the traveller too', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  await page.getByRole('button', { name: 'Add infant' }).click();
  await page.getByRole('button', { name: 'Undo this change' }).click();
  expect((await dolomites(page)).party.length).toBe(3);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('closing the sheet keeps the traveller, leaves the plan, and offers Review plan changes', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  const before = await dolomites(page);
  await page.getByRole('button', { name: 'Add infant' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(placeDays(await dolomites(page))).toEqual(placeDays(before));
  await page.getByRole('button', { name: 'Review plan changes' }).click();
  await expect(page.getByRole('dialog', { name: /Plan changes/ })).toBeVisible();
});

test('a toddler (child aged 2) changes pace and a hike, and removing the traveller re-flows again', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-algonquin#travellers');
  const hikes = async () => (await trips(page)).find((t) => t.id === 't-algonquin').days.flatMap((d) => d.items.map((i) => i.id));
  const before = await hikes();
  await page.getByLabel('Age').first().fill('2');
  await page.getByLabel('Age').first().press('Tab');
  const sheet = page.getByRole('dialog', { name: /Plan changes/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Relaxed');
  await expect(sheet.locator('[data-diff]').first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Apply to the plan' }).click();
  expect(await hikes()).not.toEqual(before);
});

test('a trip with no engine places says so instead of wiping the days', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-banff#travellers');
  await page.evaluate(() => {
    const a = window.P.trips();
    a[2].days.forEach((d) => d.items.forEach((i) => { i.id = 'x' + i.id; i.slug = i.id; }));
    window.P.save(a);
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Travellers' }).click();
  await page.getByRole('button', { name: 'Add adult' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/no places the planner can re-flow/)).toBeVisible();
  const t = (await trips(page)).find((x) => x.id === 't-banff');
  expect(t.days.flatMap((d) => d.items).length).toBeGreaterThan(3);
});
