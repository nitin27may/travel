/* Plan 1B: shared/map.js for every map (day colours, legs, numbered pins, tap a pin to open the item sheet);
   "Swap for indoor" rain plan on an item (indoor places within the drive budget, undoable, marks Placed by you). */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { dolomitesPlan } = require('./helpers.js');

test('map: the editor map is shared/map.js with a coloured leg per day, numbered pins and base squares', async ({ page, base }) => {
  await dolomitesPlan(page, base, { nights: 3, picks: ['ortisei', 'seceda', 'siusi', 'funes', 'braies', 'carezza', 'gherdeina', 'dobbiaco'], when: { type: 'month', month: 7 } });
  await page.getByRole('button', { name: /Map of your days/ }).click();
  const total = await page.evaluate(() => S.plan.days.reduce((n, d) => n + d.items.length, 0));
  const pins = page.getByRole('button', { name: /^Day \d+, stop \d+:/ });
  await expect(pins).toHaveCount(total);
  const legs = await page.evaluate(() => S.plan.days.filter((d) => d.items.length || d.n === 0 || d.n === S.plan.days.length - 1).length);
  expect(await page.locator('[data-map="plan"] svg path[stroke^="var(--id-"], [data-map="plan"] svg path[stroke="var(--map-route-dim)"]').count()).toBe(legs); // every day with a stop (and arrival and departure) draws a route from its base
  expect(await page.locator('[data-map="plan"] svg path[stroke^="var(--id-"]').count()).toBe(1); // only the selected day is full colour
  await expect(page.locator('[data-map="plan"] svg rect[fill="var(--map-stop)"]')).toHaveCount(await page.evaluate(() => S.plan.bases.length));
  expect(await page.evaluate(() => window.ProtoMap && typeof ProtoMap.render)).toBe('function');
  const literal = await page.evaluate(() => [...document.querySelectorAll('[data-map] svg *')].flatMap((e) => ['fill', 'stroke'].map((a) => e.getAttribute(a))).filter((v) => v && v !== 'none' && v !== 'transparent' && !v.startsWith('var(')));
  expect(literal).toEqual([]);
  await expect(page.getByRole('group', { name: 'Days on the map' }).getByRole('button')).toHaveCount(await page.evaluate(() => S.plan.days.length));
});

test('map: tapping a pin opens that stop\'s item sheet on its day', async ({ page, base }) => {
  await dolomitesPlan(page, base, { nights: 3, picks: ['ortisei', 'seceda', 'siusi', 'funes', 'braies', 'carezza', 'gherdeina', 'dobbiaco'], when: { type: 'month', month: 7 } });
  await page.getByRole('button', { name: /Map of your days/ }).click();
  const target = await page.evaluate(() => { const d = S.plan.days[2]; return { name: PL[d.items[0].pid].name, day: d.n + 1 }; });
  await page.getByRole('button', { name: new RegExp('^Day ' + target.day + ', stop 1: ') }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: target.name })).toBeVisible();
  await expect(dlg.getByText(new RegExp('Day ' + target.day + ' ·'))).toBeVisible();
  expect(await page.evaluate(() => U.day)).toBe(target.day - 1);
});

test('map: the pick-stage map joins the picks, and a pin jumps to its row', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekend'); S.picks = ['algonquin', 'arrowhead', 'lookout-trail']; S.stage = 3; render(); });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Day 1, stop \d:/ })).toHaveCount(3);
  await page.getByRole('button', { name: /^Day 1, stop 1:/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.prow .nm').first()).toBeVisible();
});

test('map: desktop shows the day map beside the plan', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await dolomitesPlan(page, base, { nights: 3, picks: ['ortisei', 'seceda', 'siusi', 'funes'], when: { type: 'month', month: 7 } });
  await page.evaluate(() => { U.desk = true; render(); });
  await expect(page.locator('.dgrid.plan [data-map="plan"] svg')).toBeVisible();
  const box = await page.locator('.dgrid.plan [data-map="plan"] svg').boundingBox();
  expect(box.width).toBeGreaterThan(300);
});

async function dayWithHike(page) {
  return page.evaluate(() => { const d = S.plan.days.find((x) => x.items.some((i) => PL[i.pid].type === 'hike')); const it = d.items.find((i) => PL[i.pid].type === 'hike'); return { n: d.n, pid: it.pid, name: PL[it.pid].name }; });
}

test('rain plan: Swap for indoor lists indoor places that fit the drive budget; the swap is placed by you and undoable', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const h = await dayWithHike(page);
  await page.locator('.dc', { hasText: new RegExp('^' + (h.n + 1)) }).first().click();
  await page.getByRole('button', { name: new RegExp(h.name) }).first().click();
  await page.getByRole('button', { name: /Swap for indoor/ }).click();
  const dlg = page.getByRole('dialog').last();
  await expect(dlg.getByRole('heading', { name: 'Swap for indoor' })).toBeVisible();
  const rows = dlg.locator('[data-a="doRain"]');
  expect(await rows.count()).toBeGreaterThan(0);
  const indoor = await page.evaluate(() => PLACES.filter((p) => p.in).map((p) => p.name));
  for (const t of await rows.allInnerTexts()) expect(indoor.some((n) => t.includes(n)), t).toBe(true); // only indoor places
  const pick = await rows.first().locator('.title').innerText();
  await rows.first().click();
  const after = await page.evaluate((n) => { const d = S.plan.days[n]; return d.items.map((i) => ({ name: PL[i.pid].name, placed: !!i.placed, rain: !!i.rain })); }, h.n);
  expect(after.find((x) => x.name === pick)).toMatchObject({ placed: true, rain: true });
  expect(after.some((x) => x.name === h.name)).toBe(false);
  await expect(page.locator('.it', { hasText: pick }).locator('.chip', { hasText: 'Placed by you' })).toBeVisible();
  await expect(page.locator('.it', { hasText: pick }).locator('.chip', { hasText: 'Indoor swap' })).toBeVisible();
  await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  const undone = await page.evaluate((n) => S.plan.days[n].items.map((i) => PL[i.pid].name), h.n);
  expect(undone).toContain(h.name);
  expect(undone).not.toContain(pick);
});

test('rain plan: only indoor places within the day\'s driving are offered; none says so and links to the indoor list', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => {
    U.ctx = null; chooseKind('weekair'); S.regions = ['tuscany']; S.cc = 'IT'; S.macro = 'central'; setAirports(S); S.picks = ['siena', 'orcia']; S.nights = 2; S.nightsTouched = true;
    S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = false; save(true); render();
  });
  const pid = await page.evaluate(() => S.plan.days.find((d) => d.items.some((i) => i.pid === 'orcia')).items.find((i) => i.pid === 'orcia').pid);
  await page.evaluate((p) => openSheet('rainswap:' + p), pid);
  const dlg = page.getByRole('dialog').last();
  await expect(dlg.getByText(/No indoor place we hold fits/)).toBeVisible();
  await dlg.getByRole('button', { name: 'Look at all indoor places' }).click();
  await expect(page.getByRole('dialog').last().getByRole('button', { name: /Rainy day/ })).toHaveClass(/on/);
});
