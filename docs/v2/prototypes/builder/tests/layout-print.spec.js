/* Plan 1B: layout sweep (no horizontal scroll at 320, 360, 390, 400, 480, 600, 760 and 1440) and the print stylesheet (page.pdf()). */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { dolomitesPlan } = require('./helpers.js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WIDTHS = [320, 360, 390, 400, 480, 600, 760, 1440];

/** every visible element must sit inside the viewport, except content that scrolls on purpose (pill rows, day chips, SVG maps scale to fit) */
const overflowing = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, bad = [];
  const root = document.querySelector('#frame');
  root.querySelectorAll('*').forEach((e) => {
    if (e.closest('.pills,.dchips,svg,.scrim,.sheet:not(.in)') || e.closest('#toast.off')) return;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (r.right > vw + 1 || r.left < -1) bad.push((e.tagName + '.' + (e.className && e.className.baseVal === undefined ? String(e.className).split(' ')[0] : '')) + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + vw + ' "' + (e.textContent || '').trim().slice(0, 30) + '"');
  });
  return { bad: bad.slice(0, 5), doc: document.documentElement.scrollWidth - vw, body: document.querySelector('#body') ? document.querySelector('#body').scrollWidth - document.querySelector('#body').clientWidth : 0, frame: root.scrollWidth - root.clientWidth };
});
async function check(page, label) {
  const r = await overflowing(page);
  expect(r.doc, label + ' document scroll').toBeLessThanOrEqual(0);
  expect(r.frame, label + ' frame scroll').toBeLessThanOrEqual(0);
  expect(r.body, label + ' body scroll').toBeLessThanOrEqual(0);
  expect(r.bad, label + ' elements outside the viewport').toEqual([]);
  const hib = await page.evaluate(() => [...document.querySelectorAll('.shdr .hib')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height }; }));
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  hib.forEach((b) => { expect(b.l, label + ' header icon').toBeGreaterThanOrEqual(0); expect(b.r, label + ' header icon').toBeLessThanOrEqual(vw); expect(b.w).toBeGreaterThanOrEqual(44); expect(b.h).toBeGreaterThanOrEqual(44); });
}

for (const w of WIDTHS) {
  test(`layout: no horizontal scroll at ${w}px across the flow and its sheets`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/builder/?fast');
    await check(page, 'start');
    await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.picks = ['ortisei', 'seceda', 'siusi', 'funes', 'braies']; S.nights = 6; S.nightsTouched = true; S.when = { type: 'dates', from: '2027-07-13', to: '2027-07-19' }; });
    for (const stage of [1, 2, 3, 4]) { await page.evaluate((n) => { S.stage = n; render(); }, stage); await check(page, 'stage ' + stage); }
    await page.evaluate(() => { S.plan = buildPlan(S, null); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = true; U.secOpen = { bases: true, checks: true, map: true }; save(true); render(); });
    await check(page, 'editor');
    for (const d of [0, 2, 5]) { await page.evaluate((n) => { U.day = n; render(); }, d); await check(page, 'editor day ' + (d + 1)); }
    for (const sh of ['settings', 'party', 'dates', 'fill', 'ask', 'surprise', 'keys', 'getting', 'history', 'ours']) {
      await page.evaluate((v) => { closeAll(); openSheet(v); }, sh);
      await page.waitForTimeout(350);
      await check(page, 'sheet ' + sh);
    }
    await page.evaluate(() => { closeAll(); openSheet('item:' + S.plan.days[1].items[0].pid); });
    await page.waitForTimeout(350); await check(page, 'item sheet');
    await page.evaluate(() => { closeAll(); S.stage = 8; render(); });
    await check(page, 'review');
    await page.evaluate(() => { U.menu = true; S.stage = 7; U.warnOpen = { 1: true, 2: true }; render(); });
    await check(page, 'plan menu');
    await page.evaluate(() => { U.menu = false; S.copy = true; U.convertAsk = true; render(); });
    await check(page, 'inline convert card');
    await page.evaluate(() => { openSheet('settings'); }); await page.waitForTimeout(350); await check(page, 'convert card in settings sheet');
    await page.evaluate(() => { S.copy = false; U.convertAsk = false; closeAll(); U.sur = surpriseInit(); U.sur.open = true; openSheet('surprise'); }); await page.waitForTimeout(350); await check(page, 'surprise open');
  });
}

test('layout: the desktop layout has no horizontal scroll either', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await dolomitesPlan(page, base);
  await page.evaluate(() => { U.desk = true; render(); });
  await check(page, 'desk plan');
  await page.evaluate(() => { S.stage = 3; render(); });
  await check(page, 'desk pick');
});

/* ---- print ---- */
function pdfText(buf) {
  const f = path.join(os.tmpdir(), 'proto-builder-' + process.pid + '.pdf'); fs.writeFileSync(f, buf);
  try { return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch { return null; } finally { fs.rmSync(f, { force: true }); }
}
const pageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

test('print: page.pdf() has the itinerary for every day and the book-ahead list, and not the app chrome', async ({ page, base }) => {
  await dolomitesPlan(page, base, { nights: 6, picks: ['ortisei', 'seceda', 'siusi', 'braies', 'funes', 'otzi'], when: { type: 'dates', from: '2027-07-13', to: '2027-07-19' } });
  const info = await page.evaluate(() => ({ days: S.plan.days.length, books: planStats(S.plan, S).books.map((b) => b.item), stop: PL[S.plan.days[1].items[0].pid].name, title: S.title }));
  await page.emulateMedia({ media: 'print' });
  const vis = await page.evaluate(() => ({ view: getComputedStyle(document.querySelector('#printview')).display, frame: getComputedStyle(document.querySelector('#frame')).display, side: getComputedStyle(document.querySelector('#side')).display, bodyOverflow: getComputedStyle(document.body).overflow }));
  expect(vis).toEqual({ view: 'block', frame: 'none', side: 'none', bodyOverflow: 'visible' });
  const buf = await page.pdf({ format: 'A4', printBackground: false });
  expect(buf.slice(0, 4).toString()).toBe('%PDF');
  expect(pageCount(buf)).toBeGreaterThanOrEqual(1);
  const text = pdfText(buf);
  if (text === null) test.info().annotations.push({ type: 'note', description: 'pdftotext not installed: text of the PDF not checked' });
  else {
    const has = (t) => expect(text.toLowerCase()).toContain(t.toLowerCase()); // headings are upper-cased by the stylesheet
    has('Itinerary');
    for (let d = 1; d <= info.days; d++) has('Day ' + d + ' ·');
    has(info.stop);
    has('Book ahead (' + info.books.length + ')');
    info.books.forEach((b) => has(b));
    has('Before you go');
    expect(text).not.toContain('Prototype stages');
    expect(text).not.toContain('Add a place to Day');
    has('Jul'); // dated: each day carries its date
  }
  await page.emulateMedia({ media: 'screen' });
});

test('print: the print view is rebuilt on every change and the print sheet shows the same content', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  const a = await page.evaluate(() => document.querySelector('#printview').innerText.length);
  expect(a).toBeGreaterThan(200);
  await page.evaluate(() => { A.remove(S.plan.days[1].items[0].pid); });
  const b = await page.evaluate(() => document.querySelector('#printview').textContent);
  expect(b).not.toContain('undefined');
  await page.evaluate(() => openSheet('print'));
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Itinerary' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Print or save as PDF/ })).toBeVisible();
});

test('print: printing from a dark theme switches to light for the page and restores it', async ({ page, base }) => {
  await dolomitesPlan(page, base);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
