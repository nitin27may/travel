/* Plan 1B: the shared contrast checker (light and dark) reports nothing on the builder's screens, sheets and states. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');
const { dolomitesPlan } = require('./helpers.js');

const BUSY = ['ortisei', 'seceda', 'siusi', 'funes', 'braies', 'carezza', 'gherdeina', 'dobbiaco'];

async function settle(page) { await page.waitForTimeout(380); }

for (const w of [390, 1440]) {
  test(`contrast: start, flow stages and sheets at ${w}px`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/builder/?fast');
    const out = [];
    const chk = async (name) => { const c = await checkContrast(page); expect(c.checked, name).toBeGreaterThan(0); const f = formatFailures(c); if (f) out.push('## ' + name + '\n' + f); };
    await chk('start');
    await page.evaluate(() => { U.ctx = { area: 'algonquin-provincial-park', cc: 'CA' }; chooseKind('weekend'); S.picks = ['algonquin', 'arrowhead', 'lookout-trail']; S.reachH = 3; ProtoContract.addRequest(localStorage, { kind: 'place', name: 'Old Mill viewpoint', note: 'x' }); });
    for (const n of [1, 2, 3, 4]) { await page.evaluate((s) => { S.stage = s; render(); }, n); await chk('stage ' + n + ' (far card)'); }
    await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.picks = ['ortisei', 'seceda', 'siusi']; S.stage = 2; render(); });
    await chk('stage 2 trip');
    await page.evaluate(() => { U.moreOpen = true; U.more4 = true; S.stage = 4; render(); });
    await chk('stage 4 more options');
    await page.evaluate(() => { U.ctx = null; chooseKind('day'); S.picks = ['rom', 'cntower']; S.stage = 4; render(); });
    await chk('stage 4 day trip (one base)');
    for (const sh of ['ask', 'surprise', 'keys', 'party', 'dates', 'month', 'reach', 'filters', 'vibes', 'map', 'tray', 'drafts', 'ours', 'saved', 'airports', 'arrive']) {
      await page.evaluate((v) => { closeAll(); S.kind = S.kind || 'weekend'; if (v === 'dates') initCal(); openSheet(v); }, sh);
      await settle(page); await chk('sheet ' + sh);
    }
    expect(out.join('\n')).toBe('');
  });

  test(`contrast: editor, review and editor sheets at ${w}px`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await dolomitesPlan(page, base, { nights: 3, picks: BUSY, when: { type: 'dates', from: '2027-10-20', to: '2027-10-23' } });
    const out = [];
    const chk = async (name) => { const c = await checkContrast(page); expect(c.checked, name).toBeGreaterThan(0); const f = formatFailures(c); if (f) out.push('## ' + name + '\n' + f); };
    await chk('editor (just built)');
    await page.evaluate(() => { U.justBuilt = false; U.secOpen = { bases: true, checks: true, map: true }; U.day = 2; render(); });
    await chk('editor, sections open, map');
    await page.evaluate(() => { U.menu = true; render(); }); await chk('plan menu'); await page.evaluate(() => { U.menu = false; render(); });
    await page.evaluate(() => { const d = S.plan.days[2]; d.items[d.items.length - 1].pid; d.items.forEach((i) => { i.placed = true; }); d.items[0].half = true; d.items[1].rain = true; d.items[1].locked = true; recalc(S.plan, S); U.moved = [d.items[2].pid]; render(); });
    await chk('editor, chips (placed, half, rain, kept, moved, sunset)');
    await page.evaluate(() => { U.kb = { pid: S.plan.days[2].items[0].pid, snap: J(S.plan), from: '2:0' }; render(); });
    await chk('editor, a lifted stop'); await page.evaluate(() => { U.kb = null; render(); });
    const pid = await page.evaluate(() => S.plan.days[1].items[0].pid);
    for (const sh of ['item:' + pid, 'rainswap:' + pid, 'moveto:' + pid, 'swap:' + pid, 'replace:' + pid, 'add:1', 'fill', 'settings', 'start', 'where', 'days', 'getting', 'places', 'history', 'delete', 'print', 'daymenu:1', 'swapbase:0', 'convert', 'makeit']) {
      await page.evaluate((v) => { closeAll(); openSheet(v); }, sh);
      await settle(page); await chk('sheet ' + sh);
    }
    await page.evaluate(() => { closeAll(); S.stage = 8; render(); });
    await chk('review');
    expect(out.join('\n')).toBe('');
  });
}

test('contrast: free day, departure day and warnings states', async ({ page, base }) => {
  await dolomitesPlan(page, base, { nights: 6, picks: ['ortisei', 'seceda', 'funes'], when: { type: 'month', month: 11 } });
  const out = [];
  for (const d of await page.evaluate(() => S.plan.days.map((x) => x.n))) {
    await page.evaluate((n) => { U.justBuilt = false; U.day = n; render(); }, d);
    const c = await checkContrast(page); const f = formatFailures(c); if (f) out.push('## day ' + (d + 1) + '\n' + f);
  }
  expect(out.join('\n')).toBe('');
});
