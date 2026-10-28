/* Plan 1B: departure-day light stop (only when the departure leaves 3 h or more); far-park card in the editor; trip mode with a
   pinned park defaults the arrival airport to the park's nearest ("arrive at YYC" for Banff). */
const { test, expect } = require('../../shared/tests/fixtures.js');
test.use({ viewport: { width: 390, height: 844 } }); // PHONE-DEFAULT: these specs drive the phone layout (below 1024); desktop.spec.js covers 1024 and up

async function planWithDeparture(page, base, departAt) {
  await page.goto(base + '/builder/?fast');
  return page.evaluate((dep) => {
    const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.picks = ['ortisei', 'seceda', 'funes', 'siusi', 'braies']; S.nights = 6; S.when = { type: 'month', month: 7 }; S.departAt = dep;
    const plan = ProtoEngine.build(S); const last = plan.days[plan.days.length - 1];
    return { slack: ProtoEngine.departSlack(S, last.base), items: last.items.map((i) => ({ pid: i.pid, auto: !!i.auto })), kind: last.kind, end: last.end };
  }, departAt);
}

test('departure day: an early flight leaves under 3 h, so no light stop and the Departure day label stays', async ({ page, base }) => {
  const r = await planWithDeparture(page, base, 7 * 60);
  expect(r.slack).toBeLessThan(180);
  expect(r.items).toEqual([]);
  expect(r.kind).toBe('departure');
});

test('departure day: a late flight leaves 3 h or more, so one light stop is added', async ({ page, base }) => {
  const r = await planWithDeparture(page, base, 20 * 60);
  expect(r.slack).toBeGreaterThanOrEqual(180);
  expect(r.items).toHaveLength(1);
  expect(r.items[0].auto).toBe(true);
  expect(r.end).toBeLessThan(20 * 60 - 150); // the day ends before the airport buffer
});

test('departure day: the edge is exactly 3 h (179 min none, 180 min a stop)', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => {
    const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.picks = ['ortisei', 'seceda', 'funes']; S.nights = 5; S.when = { type: 'month', month: 7 };
    S.flyMode = 'fly'; const base0 = ProtoEngine.build(S).days[5].base; const dep0 = 150 + 510 + drive(base0, AIRPORTS[S.leave]);
    const at = (slackMin) => { S.departAt = dep0 + slackMin; return ProtoEngine.build(S).days[5].items.length; };
    return { s179: at(179), s180: at(180) };
  });
  expect(r.s179).toBe(0);
  expect(r.s180).toBe(1);
});

test('departure day: the Getting there sheet sets the departure time and a rebuild applies it', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => {
    U.ctx = null; chooseKind('weekair'); S.picks = ['ortisei', 'seceda', 'funes', 'siusi', 'braies']; S.nights = 6; S.nightsTouched = true; S.departAt = 7 * 60;
    S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = false; save(true); render();
  });
  await expect(page.getByText(/Leaving about 07:00/)).toHaveCount(0); // only on the departure day itself
  await page.locator('.dc').last().click();
  await expect(page.getByText(/Leaving about 07:00: under 3 h free/)).toBeVisible();
  await page.locator('.gt').getByRole('button', { name: 'Change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Evening 20:00/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText(/Settings changed:.*departure 20:00/i)).toBeVisible();
  await page.getByRole('button', { name: /^Rebuild \d+ days/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Apply/ }).click();
  expect(await page.evaluate(() => S.plan.days[S.plan.days.length - 1].items.length)).toBe(1);
});

test('far park, trip mode: Banff pinned defaults the arrival airport to YYC and says so', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast&m=trip&cc=CA&p=banff-national-park');
  await expect(page.getByText(/arrive at YYC/i).first()).toBeVisible();
  expect(await page.evaluate(() => S.arrive)).toBe('YYC');
});

test('far park, trip mode: Lake O\'Hara and Castle also land at their nearest airport, not the first gateway of a list', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  const r = await page.evaluate(() => ['banff-national-park', 'lake-ohara-area', 'castle-provincial-park'].map((k) => { U.ctx = { area: k, cc: 'CA' }; chooseKind('weekair'); return S.arrive; }));
  expect(r).toEqual(['YYC', 'YYC', 'YYC']);
});

test('far park, near mode: the card shows in the editor only after reach, start or party change; it offers fixes', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast&m=near&n=1&p=algonquin-provincial-park');
  await expect(page.getByText(/is about .* from Toronto/).first()).toBeVisible(); // stage 1: 3 h reach, Algonquin is further
  await page.getByRole('button', { name: /Raise the reach to 4 h/ }).click();
  await expect(page.getByText(/is about .* from Toronto/)).toHaveCount(0);
  await page.evaluate(() => { S.picks = ['algonquin', 'lookout-trail', 'spruce-bog']; S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = false; save(true); render(); });
  await expect(page.getByText(/is about .* from Toronto/)).toHaveCount(0); // nothing changed since the build
  await page.getByRole('button', { name: /^Settings/ }).click();
  await page.getByRole('button', { name: /^Where:/ }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: '3 h', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).click();
  const card = page.getByRole('status').filter({ hasText: /is about .* from Toronto/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: /Raise the reach to 4 h/ })).toBeVisible();
  await card.getByRole('button', { name: /Raise the reach to 4 h/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /is about .* from Toronto/ })).toHaveCount(0);
});
