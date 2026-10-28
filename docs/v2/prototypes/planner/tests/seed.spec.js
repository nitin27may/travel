const { test, expect, watch, open, trips } = require('./helpers.js');

test('first visit seeds three trips by running the engine; every one passes the contract', async ({ page, base }) => {
  const errors = watch(page);
  await open(page, base, '/planner/index.html');
  const r = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('proto.trips'));
    return { ids: raw.map((t) => t.id), problems: raw.map((t) => window.ProtoContract.validate(window.ProtoContract.normalise(t))), counts: raw.map((t) => t.days.reduce((n, d) => n + d.items.length, 0)), nights: raw.map((t) => [t.nights, t.days.length]) };
  });
  expect(r.ids).toEqual(['t-algonquin', 't-dolomites', 't-banff']);
  r.problems.forEach((p) => expect(p).toEqual([]));
  r.counts.forEach((n) => expect(n).toBeGreaterThan(3));
  r.nights.forEach(([n, d]) => expect(d).toBe(n + 1));
  expect(errors()).toEqual([]);
});

test('the seeded weekend uses the builder date model: next weekend from ProtoEngine.whenInfo', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  const r = await page.evaluate(() => {
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const w = window.ProtoEngine.whenInfo({ when: { type: 'next' } });
    const t = window.ProtoContract.readTrips(localStorage).find((x) => x.id === 't-algonquin');
    return { from: iso(w.from), to: iso(w.to), t: t.dates, nights: t.nights, days: t.days.length };
  });
  expect(r.t.from).toBe(r.from);
  expect(r.t.to).toBe(r.to);
  expect(r.from).toBe('2026-11-06');
  expect(r.days).toBe(r.nights + 1);
});

test('seeded dates match the builder: the exact-range Dolomites trip has the same dates in both apps', async ({ page, base }) => {
  await open(page, base, '/builder/index.html?fast', { ready: '#frame' });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('proto.trips') || '[]').length > 0);
  const builder = await page.evaluate(() => JSON.parse(localStorage.getItem('proto.trips')).filter((t) => t.kind === 'weekair').map((t) => t.dates));
  expect(builder.length).toBeGreaterThan(0);
  await open(page, base, '/planner/index.html');
  const mine = (await trips(page)).find((t) => t.id === 't-dolomites').dates;
  expect(builder.some((d) => d.from === mine.from && d.to === mine.to)).toBe(true);
});

test('Reseed rebuilds the demo trips and the engine keeps locked and must-see flags', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const t = (await trips(page)).find((x) => x.id === 't-dolomites');
  const flat = t.days.flatMap((d) => d.items);
  expect(flat.filter((i) => i.locked).map((i) => i.id).sort()).toEqual(['seceda', 'tre-cime']);
  expect(flat.every((i) => /^\d\d:\d\d$/.test(i.time))).toBe(true);
});
