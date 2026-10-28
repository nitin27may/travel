const { test, expect, watch } = require('./helpers.js');

// Regression: the builder seeds proto.trips first with its own ids, then a deep link to a planner demo trip must still open.
test('a deep link to a demo trip opens after the builder seeded proto.trips first', async ({ page, base }) => {
  const errors = watch(page);
  await page.goto(base + '/builder/index.html');
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('proto.trips') || '[]')).length)).toBeGreaterThan(0);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('proto.trips')).map((t) => t.id));
  expect(before).not.toContain('t-dolomites');
  await page.goto(base + '/planner/trip.html?id=t-dolomites');
  await expect(page.locator('#chip')).toContainText('Dolomites');
  await expect(page.locator('body')).not.toContainText('No trip open');
  await page.goto(base + '/planner/today.html?id=t-banff');
  await expect(page.locator('body')).not.toContainText('No trip open');
  expect(errors()).toEqual([]);
});
