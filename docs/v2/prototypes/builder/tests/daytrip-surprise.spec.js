/* Plan 1B: a day trip stays one base (and says why); "Surprise me" covers every country in data.js by month, drive time and interests. */
const { test, expect } = require('../../shared/tests/fixtures.js');
test.use({ viewport: { width: 390, height: 844 } }); // PHONE-DEFAULT: these specs drive the phone layout (below 1024); desktop.spec.js covers 1024 and up

test('day trip: Days and driving explains the single base and offers a weekend instead', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('day'); S.picks = ['rom', 'cntower']; S.stage = 4; render(); });
  const note = page.locator('#onebase');
  await expect(note).toContainText('One base: your home');
  await expect(note).toContainText('Toronto');
  await expect(page.getByRole('button', { name: /^Fewer nights|^More nights/ })).toHaveCount(0); // no nights to split
  await note.getByRole('button', { name: 'Switch to Weekend' }).click();
  expect(await page.evaluate(() => ({ kind: S.kind, nights: S.nights }))).toEqual({ kind: 'weekend', nights: 2 });
});

test('day trip: the editor shows one base with the reason and no second base', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('day'); S.picks = ['rom', 'cntower']; S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; save(true); render(); });
  expect(await page.evaluate(() => ({ days: S.plan.days.length, bases: S.plan.bases.length }))).toEqual({ days: 1, bases: 1 });
  await page.getByRole('button', { name: /One base: your home/ }).click();
  await expect(page.getByText(/A day trip starts and ends at home/)).toBeVisible();
});

test('Surprise me covers every country in data.js (Canada and Italy) and respects month, drive time and interests', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    const all = surpriseOptions({ month: 7, drive: 'any', vibes: [], seed: 0 });
    const ccs = [...new Set(all.map((x) => x.cc))].sort();
    const drive3 = surpriseOptions({ month: 7, drive: '3', vibes: [], seed: 0 });
    const lakes = surpriseOptions({ month: 7, drive: 'any', vibes: ['lakes'], seed: 0 });
    const shuffled = surpriseOptions({ month: 7, drive: 'any', vibes: [], seed: 3 });
    return { countries: Object.keys(COUNTRIES).sort(), ccs, drive3: drive3.map((x) => x.cc), lakes: lakes.map((x) => x.region), allRegions: all.map((x) => x.region), shuffled: shuffled.map((x) => x.cc) };
  });
  expect(r.ccs).toEqual(r.countries);
  expect(r.drive3.length).toBeGreaterThan(0);
  expect(new Set(r.drive3)).toEqual(new Set(['CA'])); // from Toronto only Ontario is within 3 h by car
  expect(r.lakes.length).toBeGreaterThan(0);
  expect(new Set(r.shuffled)).toEqual(new Set(r.countries));
});

test('Surprise me: the sheet lists Canada and Italy options; picking one starts a plan there with picks and the chosen month', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.getByRole('button', { name: 'Surprise me' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: 'Surprise me' })).toBeVisible();
  await expect(dlg.getByText(/· Canada/).first()).toBeVisible();
  await expect(dlg.getByText(/· Italy/).first()).toBeVisible();
  await dlg.getByRole('button', { name: /Change/ }).click();
  await dlg.getByRole('button', { name: 'Jul', exact: true }).click();
  await expect(dlg.getByText(/places open in July/).first()).toBeVisible();
  await dlg.getByRole('button', { name: 'Drive up to 3 h', exact: true }).click();
  await expect(dlg.getByText(/· Italy/)).toHaveCount(0);
  await dlg.getByRole('button', { name: 'Any, flying is fine' }).click();
  await dlg.locator('[data-opt]').filter({ hasText: 'Italy' }).first().getByRole('button', { name: 'Plan this' }).click();
  const st = await page.evaluate(() => ({ stage: S.stage, cc: S.cc, month: S.when.month, picks: S.picks.length, kind: S.kind }));
  expect(st).toMatchObject({ stage: 3, cc: 'IT', month: 7, kind: 'weekair' });
  expect(st.picks).toBeGreaterThan(0);
  await expect(page.getByRole('status').filter({ hasText: /^Surprise:/ })).toBeVisible();
});

test('Surprise me: a Canadian region within reach starts a by-car weekend', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.getByRole('button', { name: 'Surprise me' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /Change/ }).click();
  await dlg.getByRole('button', { name: 'Drive up to 3 h', exact: true }).click();
  await dlg.locator('[data-opt]').first().getByRole('button', { name: 'Plan this' }).click();
  expect(await page.evaluate(() => ({ kind: S.kind, cc: S.cc, picks: S.picks.every((id) => PL[id].reg === 'ontario') }))).toMatchObject({ kind: 'weekend', cc: 'CA', picks: true });
});
