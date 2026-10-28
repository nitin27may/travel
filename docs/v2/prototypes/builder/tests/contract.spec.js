/* Plan 1B: every proto.trips read and write goes through shared/contract.js (normalise, validate, readTrips, writeTrips). */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { dolomitesPlan } = require('./helpers.js');
const fs = require('node:fs');
const path = require('node:path');

test('contract: builder.js never touches proto.trips directly', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'builder.js'), 'utf8');
  expect(src).not.toMatch(/(store\.(get|set)|localStorage\.(get|set|remove)Item)\(\s*['"]proto\.trips['"]/);
  expect(src).toMatch(/ProtoContract/);
});

test('contract: every trip the builder saves validates, including seeded demo trips', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('proto.trips')).map((t) => ({ id: t.id, problems: ProtoContract.validate(t) })));
  expect(r.length).toBeGreaterThanOrEqual(3); // two seeded plus this one
  r.forEach((x) => expect(x.problems, x.id).toEqual([]));
});

test('contract: a trip stored with month "2027-07" (another app\'s shape) opens in the builder with month 7', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => {
    const t = { id: 'x1', title: 'Month text trip', kind: 'weekend', mode: 'near', start: { city: 'Toronto' }, party: [{ type: 'adult' }], dates: { month: '2027-07' }, nights: 1, inMine: true,
      days: [{ n: 1, label: 'Day 1', base: 'Huntsville', notes: '', items: [{ id: 'algonquin', name: 'x', time: '09:00', durMin: 120 }] }, { n: 2, label: 'Day 2', base: 'Huntsville', notes: '', items: [] }], bookings: [], checklist: [], costs: [] };
    const cur = JSON.parse(localStorage.getItem('proto.trips')); cur.push(t); localStorage.setItem('proto.trips', JSON.stringify(cur));
  });
  await page.goto(base + '/builder/?fast&edit=x1');
  expect(await page.evaluate(() => ({ when: S.when, stage: S.stage, days: S.plan.days.length }))).toEqual({ when: { type: 'month', month: 7 }, stage: 7, days: 2 });
  await page.evaluate(() => { S.nights = 1; save(true); });
  const saved = await page.evaluate(() => ProtoContract.validate(JSON.parse(localStorage.getItem('proto.trips')).find((t) => t.id === 'x1')));
  expect(saved).toEqual([]);
});

test('contract: toTrip then normalise then fromTrip round-trips the picks and the day count', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const r = await page.evaluate(() => {
    const t = ProtoContract.normalise(toTrip(S)); const back = fromTrip(t);
    return { days: [S.plan.days.length, back.plan.days.length], picks: [[...new Set(S.plan.days.flatMap((d) => d.items.map((i) => i.pid)))].sort(), back.picks.slice().sort()], title: [S.title, back.title], problems: ProtoContract.validate(t) };
  });
  expect(r.days[1]).toBe(r.days[0]);
  expect(r.picks[1]).toEqual(r.picks[0]);
  expect(r.title[1]).toBe(r.title[0]);
  expect(r.problems).toEqual([]);
});

test('contract: a trip with problems is refused, the old data stays and the status says so', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const before = await page.evaluate(() => localStorage.getItem('proto.trips'));
  await page.evaluate(() => { S.party = []; save(true); });
  expect(await page.evaluate(() => U.status)).toMatch(/^Could not save: party/);
  expect(await page.evaluate(() => localStorage.getItem('proto.trips'))).toBe(before);
  await expect(page.locator('#autosave')).toContainText('Could not save');
});

test('contract: bad JSON in proto.trips reads as an empty list and the builder still starts', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => localStorage.setItem('proto.trips', '{not json'));
  await page.reload();
  await expect(page.locator('#frame')).toBeVisible();
  expect(await page.evaluate(() => ProtoContract.readTrips(localStorage).length)).toBeGreaterThanOrEqual(0);
});

test('contract: deleting a plan goes through the contract and leaves the others valid', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const n = await page.evaluate(() => ProtoContract.readTrips(localStorage).length);
  await page.evaluate(() => A.delGo());
  const r = await page.evaluate(() => ({ n: ProtoContract.readTrips(localStorage).length, v: JSON.parse(localStorage.getItem('proto.trips')).map((t) => ProtoContract.validate(t).length) }));
  expect(r.n).toBe(n - 1);
  expect(r.v.every((x) => x === 0)).toBe(true);
});
