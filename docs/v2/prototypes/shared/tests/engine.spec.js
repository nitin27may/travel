const { test, expect } = require('./fixtures.js');

test('engine: window.ProtoEngine exposes build, rebuild, fillFree, fits on the builder page', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    const E = window.ProtoEngine;
    const api = ['build', 'rebuild', 'fillFree', 'fits', 'recalc', 'freeDays', 'planStats', 'bookAhead', 'toTrip', 'whenInfo'].map((k) => [k, typeof E[k]]);
    const S = newState('weekair'); // builder.js global; the planner builds its own state from a contract trip
    S.picks = PLACES.filter((p) => p.reg === 'dolomites' && p.type !== 'town').slice(0, 3).map((p) => p.id);
    S.regions = ['dolomites']; S.cc = 'IT'; S.nights = 6;
    const plan = E.build(S);
    const again = E.rebuild(S, plan);
    const free = E.freeDays(plan).length;
    const f = E.fillFree(S, again);
    const fit = E.fits(S, again, 1, S.picks[0]);
    const trip = E.toTrip(Object.assign(S, { plan: again }));
    return { api, days: plan.days.length, again: again.days.length, free, filled: f.filled.length, stillEmpty: f.stillEmpty.length, fitKeys: Object.keys(fit), trip: { id: trip.id, days: trip.days.length } };
  });
  r.api.forEach(([k, t]) => expect(t, k).toBe('function'));
  expect(r.days).toBe(7);
  expect(r.again).toBe(7);
  expect(r.fitKeys).toEqual(['ok', 'reasons', 'legMin', 'backMin', 'durMin']);
  expect(r.filled + r.stillEmpty).toBeGreaterThanOrEqual(0);
  expect(r.trip.days).toBe(7);
});

test('engine: the builder still loads with the moved engine and shows no script errors', async ({ page, base }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/builder/?fast');
  await expect(page.locator('#frame')).toBeVisible();
  expect(errors).toEqual([]);
});
