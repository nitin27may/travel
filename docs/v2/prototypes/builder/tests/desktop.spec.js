/* Desktop (1024 px and wider): no phone frame, the product header and the step rail, every stage laid out in columns, sheets as
   side drawers or centred dialogs, the walkthrough and a keyboard walk at 1440, and a strict contrast sweep in both themes. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');
const { walkKeyboard } = require('../../shared/tests/keyboard.js');
const { dolomitesPlan } = require('./helpers.js');

const WIDTHS = [1024, 1280, 1440, 1920];
const H = (w) => (w > 1500 ? 1080 : 900);

async function setStage(page, n) {
  await page.evaluate((s) => {
    if (!S.kind || !U.marked) { U.ctx = { area: 'algonquin-provincial-park', cc: 'CA' }; chooseKind('weekend'); U.ctx = null; }
    if (s >= 3 && !S.picks.length) S.picks = ['algonquin', 'arrowhead', 'lookout-trail'];
    if (s === 7 || s === 8) { S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.title = titleOf(S); save(true); }
    S.stage = s; render();
  }, n);
}
const noScroll = (page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, frame: document.querySelector('#frame').scrollWidth - document.querySelector('#frame').clientWidth, body: document.querySelector('#body').scrollWidth - document.querySelector('#body').clientWidth }));

for (const w of WIDTHS) {
  test(`desktop ${w}px: no phone frame, no horizontal scroll, product header and rail on every stage`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: H(w) });
    await page.goto(base + '/builder/?fast');
    await page.evaluate(() => document.fonts.ready);
    for (const stage of [0, 1, 2, 3, 4, 7, 8]) {
      await setStage(page, stage);
      const s = await noScroll(page);
      expect(s.doc, 'stage ' + stage + ' document').toBeLessThanOrEqual(0);
      expect(s.frame, 'stage ' + stage + ' frame').toBeLessThanOrEqual(0);
      expect(s.body, 'stage ' + stage + ' body').toBeLessThanOrEqual(0);
      const f = await page.evaluate(() => { const e = document.querySelector('#frame'), cs = getComputedStyle(e); return { w: e.getBoundingClientRect().width, vw: innerWidth, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, shadow: cs.boxShadow }; });
      expect(f.w, 'frame fills the page').toBeGreaterThanOrEqual(f.vw - 2);
      expect(f.radius).toBe('0px'); expect(f.border).toBe('0px'); expect(f.shadow).toBe('none');
      await expect(page.locator('#phdr')).toBeVisible();
      await expect(page.locator('#phdr').getByRole('link', { name: 'Parks' })).toHaveAttribute('href', '/parks-app/index.html');
      if (stage <= 4) await expect(page.getByRole('navigation', { name: 'Trip steps' })).toBeVisible();
      if (stage === 7) await expect(page.locator('#hdr').getByRole('button', { name: /^Settings/ })).toBeVisible();
    }
  });
}

/* the layout must hold whether the web fonts have loaded or not: blocked (fallback fonts), slow (measured at once, before they arrive) */
for (const mode of ['blocked', 'slow']) for (const w of [1024, 1280]) {
  test(`desktop ${w}px with fonts ${mode}: nothing makes the frame or the page overflow, at once and settled`, async ({ page, base }) => {
    await page.route('**/fonts/**', async (route) => { if (mode === 'blocked') return route.abort(); await new Promise((r) => setTimeout(r, 1200)); return route.continue(); });
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/builder/?fast');
    for (const stage of [0, 1, 2, 3, 4, 7, 8, 0]) {
      await setStage(page, stage); // no wait for fonts: the first measure happens while they load
      const s = await noScroll(page);
      expect(s.doc, 'stage ' + stage + ' document').toBeLessThanOrEqual(0); expect(s.frame, 'stage ' + stage + ' frame').toBeLessThanOrEqual(0); expect(s.body, 'stage ' + stage + ' body').toBeLessThanOrEqual(0);
      const out = await page.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('#frame *')].filter((e) => !e.closest('svg,.scrim,.sheet:not(.in),#toast') && e.getBoundingClientRect().width && e.getBoundingClientRect().right > vw + 1).map((e) => e.tagName + '.' + String(e.className).split(' ')[0]).slice(0, 4); });
      expect(out, 'stage ' + stage + ' elements past the right edge').toEqual([]);
    }
  });
}

test('desktop 1440: the content is wide (over 900 px) on every stage, within a max width', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  for (const stage of [0, 1, 2, 3, 4, 8]) {
    await setStage(page, stage);
    const w = await page.locator('.dwrap').first().evaluate((e) => { const cs = getComputedStyle(e); return e.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); });
    expect(w, 'stage ' + stage).toBeGreaterThan(900);
    expect(w).toBeLessThanOrEqual(1600);
  }
  await setStage(page, 7);
  expect((await page.locator('.dgrid.plan').boundingBox()).width).toBeGreaterThan(1300); // three panes
});

test('desktop 1920: content keeps a max width, not stretched edge to edge', async ({ page, base }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(base + '/builder/?fast');
  await setStage(page, 1);
  const w = await page.locator('.dwrap').first().boundingBox();
  expect(w.width).toBeLessThanOrEqual(1500 + 1);
  expect(w.x).toBeGreaterThan(150);
  const input = await page.locator('#orig').boundingBox();
  expect(input.width).toBeLessThanOrEqual(430); // inputs are not stretched
});

test('desktop: the stage panel is a collapsed Prototype controls drawer', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  const side = page.locator('#side');
  expect(await side.evaluate((e) => e.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  const btn = page.locator('#phdr').getByRole('button', { name: 'Prototype controls' });
  const b = await btn.boundingBox();
  expect(b.y + b.height).toBeLessThan(60); // in the product header, not floating over the page
  await expect(page.locator('#frame').getByRole('button', { name: 'Prototype controls' })).toHaveCount(0);
  await btn.click();
  await expect(side.getByText('Reachable states')).toBeVisible();
  expect(await side.evaluate((e) => e.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0);
});

test('desktop: the rail has done, current and upcoming states and every stage is reachable from it', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.picks = ['ortisei', 'seceda']; S.stage = 2; render(); });
  const nav = page.getByRole('navigation', { name: 'Trip steps' });
  await expect(nav.locator('.dstep.done')).toHaveCount(2);
  await expect(nav.locator('.dstep.cur')).toContainText('Where');
  await expect(nav.locator('.dstep.cur')).toHaveAttribute('aria-current', 'step');
  await expect(nav.locator('.dstep.up')).toHaveCount(3);
  for (const [name, check] of [['Kind', '.tilegrid'], ['Start', '.d1grid'], ['Where', '.d2grid'], ['Pick', '.d3grid'], ['Days and driving', '.d4grid'], ['Your plan', '.dgrid.plan']]) {
    await nav.getByRole('button', { name: new RegExp('^\\d+\\s*' + name) }).or(nav.getByRole('button', { name: new RegExp(name) })).first().click();
    await expect(page.locator(check).first(), name).toBeVisible();
  }
  await page.locator('#hdr').getByRole('button', { name: /^Review/ }).click();
  await expect(page.locator('.d8grid')).toBeVisible();
});

test('desktop rail: stages a kind skips show as skipped (disabled, muted, tooltip) and a deep link to one still has a current node', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekend'); S.stage = 3; S.picks = ['algonquin']; render(); });
  const nav = page.getByRole('navigation', { name: 'Trip steps' });
  await expect(nav.locator('.dstep')).toHaveCount(6);
  const skip = nav.locator('.dstep.skip');
  await expect(skip).toHaveCount(1);
  await expect(skip).toBeDisabled();
  await expect(skip).toHaveAttribute('title', 'Not needed for a weekend');
  await expect(skip).toContainText('Skipped');
  await page.evaluate(() => { S.stage = 2; render(); }); // deep link to a skipped stage
  await expect(nav.locator('.dstep.cur')).toHaveCount(1);
  await expect(nav.locator('.dstep.cur')).toContainText('Where');
  await page.evaluate(() => { U.ctx = null; chooseKind('day'); S.stage = 3; S.picks = ['rom']; render(); });
  await expect(nav.locator('.dstep.skip')).toHaveCount(2); // Where and Days and driving
  await expect(nav.locator('.dstep.cur')).toContainText('Pick');
});

test('desktop: Back at the left and the primary at the right end of the rail', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await setStage(page, 3);
  const back = await page.getByRole('button', { name: 'Back' }).boundingBox(), next = await page.locator('.drail-next').boundingBox(), vw = 1440;
  expect(back.x).toBeLessThan(200); expect(next.x + next.width).toBeGreaterThan(vw - 200);
  await expect(page.locator('.drail-next')).toContainText('Next: Days and driving');
  await page.evaluate(() => { S.picks = []; render(); });
  await expect(page.locator('.drail-next')).toBeDisabled();
});

test('desktop stage 0: six tiles in a 3 by 2 grid, none preselected, other ways in at the side', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  const tiles = page.locator('.tilegrid .tile');
  await expect(tiles).toHaveCount(6);
  await expect(page.locator('.tilegrid .tile.on')).toHaveCount(0);
  const ys = [...new Set(await tiles.evaluateAll((t) => t.map((e) => Math.round(e.getBoundingClientRect().top))))];
  expect(ys.length).toBe(2);
  const side = page.getByRole('complementary', { name: 'Other ways in' });
  for (const t of ['Surprise me', 'A place you saved', 'One of our trips']) await expect(side.getByRole('button', { name: t })).toBeVisible();
  const tb = await page.locator('.tilegrid').boundingBox(), sb = await side.boundingBox();
  expect(sb.y).toBeGreaterThan(tb.y + tb.height - 2); // under the tiles, using the width
  expect(sb.y + sb.height).toBeLessThan(900); // the whole of stage 0 fits one screen at 1440 x 900
  await tiles.nth(1).click();
  expect(await page.evaluate(() => ({ stage: S.stage, kind: S.kind }))).toEqual({ stage: 1, kind: 'weekend' });
});

test('desktop stage 1: three columns plus a summary; the party editor and a calendar are inline, not sheets', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast&m=near&n=1&p=algonquin-provincial-park');
  const cards = page.locator('.d1grid > section');
  await expect(cards).toHaveCount(3);
  const bx = await cards.evaluateAll((c) => c.map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; }));
  expect(bx[0].t).toBe(bx[1].t); expect(bx[0].l).toBeLessThan(bx[1].l); // From where and When side by side
  expect(bx[2].t).toBeGreaterThan(bx[0].t); expect(bx[2].w).toBeGreaterThan(bx[0].w * 2.5); // Who is going spans both, one row per traveller
  const who = page.getByRole('region', { name: 'Who is going' });
  await expect(who.getByRole('button', { name: 'Child' }).first()).toBeVisible();
  const rowsBox = await who.locator('.prow2:not(.padd)').evaluateAll((r) => r.map((e) => Math.round(e.getBoundingClientRect().height)));
  rowsBox.forEach((h) => expect(h).toBeLessThanOrEqual(80)); // one line each, even a child with age and needs // a compact row per traveller
  await expect(who.locator('.prow2.padd').getByRole('button', { name: /Child/ })).toBeVisible(); // add traveller as a row
  await who.locator('.prow2.padd').getByRole('button', { name: /Infant/ }).click();
  expect(await page.evaluate(() => S.party.length)).toBe(4);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exact dates' }).click();
  await expect(page.locator('.dcal .cgrid')).toBeVisible();
  await page.locator('.dcal .cgrid button:not(.past)').nth(10).click();
  await page.locator('.dcal .cgrid button:not(.past)').nth(12).click();
  await page.getByRole('button', { name: 'Use these dates' }).click();
  expect(await page.evaluate(() => S.when.type + ':' + !!S.when.from)).toBe('dates:true');
  const side = page.getByRole('complementary', { name: 'Summary' });
  await expect(page.locator('.d1grid')).toContainText('Because of your party');
  await expect(side.getByRole('button', { name: '4 h', exact: true })).toBeVisible(); // reach inline
  await expect(side).toContainText(/about .* from Toronto/); // far-park card
  await side.getByRole('button', { name: '4 h', exact: true }).click();
  await expect(side.getByText(/outside your/)).toHaveCount(0);
});

test('desktop stage 2: region cards with counts, a map beside them and an Ask us card', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.stage = 2; render(); });
  await expect(page.locator('.rcard').first()).toBeVisible();
  await expect(page.locator('.rcard.ask')).toContainText('Ask us for more');
  await expect(page.locator('[data-map="where"] svg')).toBeVisible();
  const before = await page.locator('[data-map="where"] rect[fill="var(--accent)"]').count();
  await page.getByRole('checkbox', { name: /Lake Garda/ }).click();
  expect(await page.locator('[data-map="where"] rect[fill="var(--accent)"]').count()).toBeGreaterThan(before); // the selection is highlighted on the map
  const mb = await page.locator('.dmap').boundingBox(), cb = await page.locator('.dcol2').boundingBox();
  expect(mb.x).toBeGreaterThan(cb.x + cb.width - 5);
  expect(await page.locator('[data-map="where"] svg path[stroke-dasharray]').count()).toBe(1); // the area we hold, outlined
});

test('desktop stage 3: filters rail, results, tray and map at once; no sheet needed for filters', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await setStage(page, 3);
  const f = page.getByRole('complementary', { name: 'Filters' });
  await expect(f.locator('button').first()).toContainText(/Kids/); // kids chip first (reach is for day trips and weekends only)
  const filt = await f.boundingBox(), res = await page.getByRole('region', { name: 'Places' }).boundingBox(), tray = await page.getByRole('complementary', { name: 'Your picks' }).boundingBox();
  expect(filt.x).toBeLessThan(res.x); expect(res.x).toBeLessThan(tray.x);
  await f.getByRole('button', { name: 'Lakes and water' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => S.vibes)).toEqual(['lakes']);
  await f.getByRole('button', { name: 'Lakes and water' }).click();
  await expect(page.locator('[data-map="picks"] svg')).toBeVisible();
  await page.getByRole('region', { name: 'Places' }).getByRole('button', { name: 'Pick', exact: true }).first().click();
  await expect(page.locator('.dtray')).toContainText('picked');
});

test('desktop stage 4: the form on the left and a live preview of what this will build on the right', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.picks = ['ortisei', 'seceda', 'siusi']; S.nights = 5; S.nightsTouched = true; S.stage = 4; render(); });
  const prev = page.locator('.dprev');
  await expect(prev).toContainText('What this will build');
  const days0 = await prev.locator('.dstat b').first().innerText();
  expect(days0).toBe('6');
  await page.getByRole('button', { name: 'More nights' }).click();
  await expect(prev.locator('.dstat b').first()).toHaveText('7');
  await page.getByRole('button', { name: 'Relaxed' }).click();
  await expect(prev).toContainText('Pace Relaxed');
  await expect(page.getByRole('region', { name: 'Also within your driving' })).toBeVisible();
  await expect(page.locator('[data-map="preview"] svg')).toBeVisible();
});

test('desktop editor: three panes, Make it yours above Day 1, free-day suggestions inline, Settings and Review visible', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast&copy=dolomites');
  await expect(page.locator('.dgrid.plan')).toBeVisible();
  const card = await page.locator('.dmid').getByText('Make it yours').first().boundingBox(), day = await page.locator('.dmid .dayh').boundingBox();
  expect(card.y).toBeLessThan(day.y);
  await page.evaluate(() => { U.convertOk = true; S.copy = false; });
  await dolomitesPlan(page, base, { nights: 6, picks: ['ortisei', 'seceda', 'funes'] });
  const free = await page.evaluate(() => freeDays(S.plan)[0].n);
  await page.locator('.dgrid.plan').getByRole('button', { name: new RegExp('^Day ' + (free + 1) + ' ·') }).click();
  await expect(page.locator('.inlinefill .ifrow').first()).toBeVisible();
  await page.locator('.inlinefill').getByRole('button', { name: /^Add / }).first().click();
  expect(await page.evaluate((i) => S.plan.days[i].items.length, free)).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#hdr').getByRole('button', { name: /^Settings/ })).toBeVisible();
  await expect(page.locator('#hdr').getByRole('button', { name: /^Review/ })).toBeVisible();
});

test('desktop: sheets are side drawers or centred dialogs, never phone sheets', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await dolomitesPlan(page, base);
  await page.evaluate(() => openSheet('ask')); await page.waitForTimeout(400);
  const d = await page.locator('.sheet.dlg').boundingBox();
  expect(Math.abs(d.x + d.width / 2 - 720)).toBeLessThan(6); expect(d.width).toBeLessThan(600); expect(d.height).toBeLessThan(800);
  await page.evaluate(() => closeAll()); await page.waitForTimeout(300);
  await page.evaluate(() => openSheet('settings')); await page.waitForTimeout(400);
  const s = await page.locator('.sheet').last().boundingBox();
  expect(s.x + s.width).toBeGreaterThan(1430); expect(s.width).toBeLessThanOrEqual(480); // right side drawer
});

test('desktop review: two columns with the state line, book ahead, checks and the finish actions on the right', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await dolomitesPlan(page, base, { when: { type: 'dates', from: '2027-07-13', to: '2027-07-19' } });
  await page.evaluate(() => { S.stage = 8; render(); });
  const main = await page.locator('.d8main').boundingBox(), side = await page.locator('.d8side').boundingBox();
  expect(side.x).toBeGreaterThan(main.x + main.width - 5);
  await expect(page.locator('.d8main')).toContainText('In Mine');
  await expect(page.locator('.d8main')).toContainText('Book ahead');
  await expect(page.locator('.d8main')).toContainText('Reality checks');
  await expect(page.locator('.d8side').getByRole('button', { name: /Add to calendar/ })).toBeVisible();
  await expect(page.locator('.d8side')).toContainText('Known costs');
  await expect(page.locator('.d8side').getByRole('button', { name: /Print/ })).toBeVisible();
});

test('desktop walkthrough: weekend near Algonquin from the park link to a built plan and Review at 1440', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/builder/?fast&m=near&n=1&p=algonquin-provincial-park');
  await page.getByRole('button', { name: /Raise the reach to 4 h/ }).click();
  await page.locator('.drail-next').click(); // Pick
  await expect(page.locator('.d3grid')).toBeVisible();
  await page.getByRole('region', { name: 'Places' }).getByRole('button', { name: 'Pick', exact: true }).first().click();
  await page.locator('.drail-next').click(); // Days and driving
  await expect(page.locator('.d4grid')).toBeVisible();
  await page.locator('.drail-next').click(); // Build my days
  await expect(page.locator('.dgrid.plan')).toBeVisible();
  await expect(page.getByText(/^Built \d+ days/)).toBeVisible();
  await page.locator('#hdr').getByRole('button', { name: /^Review/ }).click();
  await expect(page.locator('.d8grid')).toBeVisible();
  expect(errors).toEqual([]);
});

test('desktop: the three deep links (edit, review, saved) land on the right desktop screen', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  const id = await page.evaluate(() => ProtoContract.readTrips(localStorage)[1].id);
  await page.goto(base + '/builder/?fast&edit=' + id); await expect(page.locator('.dgrid.plan')).toBeVisible();
  await page.goto(base + '/builder/?fast&review=' + id); await expect(page.locator('.d8grid')).toBeVisible();
  await page.goto(base + '/builder/?fast&saved=1'); await expect(page.locator('.tilegrid')).toBeVisible();
  await page.goto(base + '/builder/?fast&copy=dolomites'); await expect(page.locator('.dgrid.plan')).toBeVisible();
  await page.goto(base + '/builder/?fast&add=banff-national-park--johnston-canyon&p=banff-national-park'); await expect(page.locator('#frame')).toBeVisible();
});

test('desktop: keyboard-only walk of the Start stage reaches every control with no trap and a visible focus ring', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/builder/?fast');
  await setStage(page, 1);
  const k = await walkKeyboard(page, { max: 120 });
  expect(k.trapped).toBe(false);
  expect(k.count).toBeGreaterThan(20);
  expect(k.noIndicator.map((s) => s.name)).toEqual([]);
  const names = k.stops.map((s) => s.name).join('|');
  for (const n of ['Home', 'Parks', 'Back', 'Exact dates', 'Next: Pick']) expect(names, n).toContain(n);
  expect(names).not.toContain('Reachable states');
});

test('desktop: keyboard drag still works in the three-pane editor', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await dolomitesPlan(page, base, { nights: 3, picks: ['ortisei', 'seceda', 'siusi', 'funes', 'braies', 'carezza', 'gherdeina', 'dobbiaco'], when: { type: 'month', month: 7 } });
  const d = await page.evaluate(() => S.plan.days.findIndex((x) => x.items.length >= 3));
  await page.locator('.dgrid.plan').getByRole('button', { name: new RegExp('^Day ' + (d + 1) + ' ·') }).click();
  const before = await page.evaluate((i) => S.plan.days[i].items.map((x) => x.pid), d);
  await page.locator('.it button[data-row]').first().focus();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  expect(await page.evaluate((i) => S.plan.days[i].items.map((x) => x.pid), d)).not.toEqual(before);
});

test('tablet 1024 to 1279: touch targets are 44 px', async ({ page, base }) => {
  for (const w of [1024, 1180]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(base + '/builder/?fast');
    for (const stage of [1, 2, 3, 4]) {
      await setStage(page, stage);
      const small = await page.evaluate(() => [...document.querySelectorAll('#frame button.pill, #frame button.btn, #frame button.dstep, #frame button.tile, #frame button.rcard')].filter((b) => b.offsetParent && b.getBoundingClientRect().width > 0).map((b) => ({ t: (b.textContent || '').trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height) })).filter((x) => x.h < 44));
      expect(small, w + 'px stage ' + stage).toEqual([]);
    }
  }
});

for (const w of [1280, 1440]) for (const theme of ['light', 'dark']) {
  test(`desktop contrast (strict) at ${w}px ${theme}: every stage, the editor, review and dialogs`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/builder/?fast');
    const out = [];
    const chk = async (name) => { const c = await checkContrast(page, { themes: [theme] }); expect(c.checked, name).toBeGreaterThan(0); const f = formatFailures(c); if (f) out.push('## ' + name + '\n' + f); };
    await page.evaluate((t) => ProtoTheme.set(t), theme);
    await chk('stage 0');
    await page.evaluate(() => { U.ctx = { area: 'algonquin-provincial-park', cc: 'CA' }; chooseKind('weekend'); U.ctx = null; A.deskDates(); S.stage = 1; render(); });
    await chk('stage 1 near with calendar');
    await page.evaluate(() => { chooseKind('weekair'); S.stage = 1; render(); });
    await chk('stage 1 air');
    for (const n of [2, 3, 4]) { await page.evaluate((s) => { if (s >= 3) S.picks = ['ortisei', 'seceda', 'funes']; S.stage = s; render(); }, n); await chk('stage ' + n); }
    await page.evaluate(() => { U.ctx = null; chooseKind('weekend'); S.stage = 2; render(); }); await chk('stage 2 near');
    await page.evaluate(() => { S.picks = ['algonquin', 'arrowhead']; S.nights = 5; S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('B'); S.stage = 7; U.justBuilt = true; render(); });
    await chk('editor');
    await page.evaluate(() => { U.justBuilt = false; const f = freeDays(S.plan)[0]; if (f) U.day = f.n; render(); }); await chk('editor free day inline');
    await page.evaluate(() => { openSheet('ask'); }); await page.waitForTimeout(400); await chk('ask dialog'); await page.evaluate(() => closeAll());
    await page.evaluate(() => { openSheet('settings'); }); await page.waitForTimeout(400); await chk('settings drawer'); await page.evaluate(() => closeAll());
    await page.evaluate(() => { S.stage = 8; render(); }); await chk('review');
    await page.evaluate(() => { document.querySelector('#side').classList.add('open'); }); await chk('prototype controls drawer');
    expect(out.join('\n')).toBe('');
  });
}
