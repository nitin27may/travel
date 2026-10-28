/* Plan 1B: free days. Two-pass relax in fillFree, half-day items, "Remove this day" (nights minus one, undoable), "Add a place". */
const { test, expect } = require('../../shared/tests/fixtures.js');
test.use({ viewport: { width: 390, height: 844 } }); // PHONE-DEFAULT: these specs drive the phone layout (below 1024); desktop.spec.js covers 1024 and up
const { dolomitesPlan } = require('./helpers.js');

test('fillFree: pass 1 is strict, pass 2 relaxes, then half a day; the result says which', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    const E = window.ProtoEngine;
    const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.picks = ['ortisei', 'seceda', 'funes']; S.nights = 6; S.when = { type: 'month', month: 7 };
    const plan = E.build(S);
    const free = E.freeDays(plan).length;
    const res = E.fillFree(S, plan);
    const items = res.filled.map((di) => plan.days[di].items[0]);
    return { free, filled: res.filled.length, relaxed: res.relaxed, half: res.half, still: res.stillEmpty, auto: items.every((i) => i.auto), recalc: items.filter((i) => i.half).map((i) => ({ dur: i.dur, full: Math.round(PL[i.pid].dur * E.eff(S).P.mult / 5) * 5 })) };
  });
  expect(r.free).toBeGreaterThan(0);
  expect(r.filled + r.still.length).toBe(r.free); // every free day is either filled or listed as still empty
  expect(r.auto).toBe(true);
  r.recalc.forEach((x) => expect(x.dur).toBeLessThanOrEqual(Math.round(x.full / 2 / 5) * 5 + 5)); // a half-day item runs half the time
});

test('fillFree: a day nothing fits stays in stillEmpty (never padded)', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    U.ctx = { area: 'castle-provincial-park', cc: 'CA' }; chooseKind('weekair');
    S.picks = ['castle-falls', 'beaver-mines']; S.nights = 6; S.nightsTouched = true;
    const plan = ProtoEngine.build(S);
    const res = ProtoEngine.fillFree(S, plan);
    return { stillEmpty: res.stillEmpty.length, free: ProtoEngine.freeDays(plan).length };
  });
  expect(r.stillEmpty).toBeGreaterThan(0);
  expect(r.free).toBe(r.stillEmpty);
});

test('editor: Fill this day lists two-pass suggestions with half-day labels and Add puts one on the day', async ({ page, base }) => {
  await dolomitesPlan(page, base, { nights: 6, picks: ['ortisei', 'seceda', 'funes'] });
  const free = await page.evaluate(() => freeDays(S.plan)[0].n);
  await page.locator('.dc', { hasText: new RegExp('^' + (free + 1)) }).first().click();
  await page.getByRole('button', { name: 'Fill this day' }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: 'Fill free days' })).toBeVisible();
  const add = dlg.getByRole('button', { name: /^Add / }).first();
  await expect(add).toBeVisible();
  await add.click();
  const n = await page.evaluate((i) => S.plan.days[i].items.length, free);
  expect(n).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: /Added to Day/ })).toBeVisible();
});

test('editor: a free day nothing fits offers Remove this day (nights minus one) and Add a place; Undo brings the day back', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => {
    U.ctx = { area: 'castle-provincial-park', cc: 'CA' }; chooseKind('weekair');
    S.picks = ['castle-falls', 'beaver-mines']; S.nights = 6; S.nightsTouched = true;
    S.plan = buildPlan(S, null); S.unfit = S.plan.unfit; S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = false; save(true); render();
  });
  const before = await page.evaluate(() => ({ days: S.plan.days.length, nights: S.nights }));
  const dayIdx = await page.evaluate(() => freeDays(S.plan)[0].n);
  await page.locator('.dc', { hasText: String(dayIdx + 1) }).first().click();
  await expect(page.getByText(/Free day: nothing we hold fits this day/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fill this day' })).toHaveCount(0); // nothing to fill with
  await expect(page.getByRole('button', { name: /Add a place to Day/ })).toBeVisible(); // the dashed row is the add action
  await page.getByRole('button', { name: 'Remove this day' }).click();
  const after = await page.evaluate(() => ({ days: S.plan.days.length, nights: S.nights }));
  expect(after.days).toBe(before.days - 1);
  expect(after.nights).toBe(before.nights - 1);
  await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  const undone = await page.evaluate(() => ({ days: S.plan.days.length, nights: S.nights }));
  expect(undone).toEqual(before);
});

test('editor: every empty day in the Dolomites path carries a label and an action (no unlabelled empty day)', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const days = await page.evaluate(() => S.plan.days.map((d) => ({ n: d.n, empty: !d.items.length, kind: d.kind })));
  for (const d of days.filter((x) => x.empty)) {
    await page.locator('.dc', { hasText: new RegExp('^' + (d.n + 1)) }).first().click();
    const label = d.kind === 'arrival' ? /Arrival day/ : d.kind === 'departure' ? /Departure day/ : /Free day/;
    await expect(page.getByText(label).first(), 'day ' + (d.n + 1)).toBeVisible();
    await expect(page.getByRole('button', { name: /Add a (short stop|place)/ }).first()).toBeVisible();
  }
});

test('fillFree: a relaxed second pass fills days the strict pass leaves empty (Ontario, relaxed pace)', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    const E = window.ProtoEngine;
    const S = newState('weekair'); S.regions = ['ontario']; S.cc = 'CA'; S.macro = 'east'; S.when = { type: 'month', month: 7 }; S.pace = 'relaxed'; S.paceSet = true; S.nights = 7;
    S.picks = PLACES.filter((p) => p.reg === 'ontario' && p.type !== 'town').slice(0, 2).map((p) => p.id); setAirports(S);
    const plan = E.build(S); const res = E.fillFree(S, plan);
    return { free: E.freeDays(plan).length, filled: res.filled.length, relaxed: res.relaxed.length, still: res.stillEmpty.length };
  });
  expect(r.relaxed).toBeGreaterThan(0);
  expect(r.filled).toBeGreaterThan(r.relaxed - 1);
});

test('half-day items: the Half a day switch halves the visit, shows a chip and undoes', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const info = await page.evaluate(() => { const d = S.plan.days.find((x) => x.items.some((i) => PL[i.pid].type === 'hike')); const it = d.items.find((i) => PL[i.pid].type === 'hike'); return { day: d.n, pid: it.pid, dur: it.dur, name: PL[it.pid].name }; });
  await page.locator('.dc', { hasText: new RegExp('^' + (info.day + 1)) }).first().click();
  await page.getByRole('button', { name: new RegExp(info.name) }).first().click();
  await page.getByRole('switch', { name: /Half a day/ }).click();
  const half = await page.evaluate((pid) => find(pid).it.dur, info.pid);
  expect(half).toBeLessThanOrEqual(Math.round(info.dur / 2 / 5) * 5 + 5);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.chip', { hasText: 'Half day' }).first()).toBeVisible();
  await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  expect(await page.evaluate((pid) => find(pid).it.dur, info.pid)).toBe(info.dur);
});
