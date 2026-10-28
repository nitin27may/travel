/* Plan 1B: convert notice follows FLOW (copied stops stay placed; opt-in link for the old behaviour); sun times from shared/sun.js
   for every day and hikes flagged when they end after sunset minus 30 min; the calendar file comes from shared/ics.js. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { openSeeded } = require('./helpers.js');
const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');

test.describe('convert notice (decision D1: follow FLOW C5)', () => {
  async function startConvert(page, base) {
    await page.goto(base + '/builder/?fast&copy=dolomites');
    await page.getByRole('button', { name: 'Plan menu' }).click();
    await page.getByRole('menuitem', { name: /Rebuild/ }).or(page.getByRole('button', { name: /^Rebuild$/ })).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^Rebuild|^Apply/ }).click();
  }
  test('the notice is inline in the sheet that triggered it (no second dialog), says copied stops stay placed and offers an opt-in link, not a switch', async ({ page, base }) => {
    await startConvert(page, base);
    await expect(page.getByRole('dialog')).toHaveCount(1); // the Settings sheet only
    const card = page.getByRole('dialog').locator('#convertcard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Make it your own plan');
    await expect(card).toContainText('Our later updates to the Dolomites trip will no longer change it');
    await expect(card).toContainText('Stops copied from our trip stay placed on their days');
    await expect(card.getByRole('switch')).toHaveCount(0);
    expect(await page.evaluate(() => S.releaseTrip)).toBe(false);
    await card.getByRole('button', { name: 'Let the plan move places from our trip' }).click();
    await expect(card).toContainText('Places from our trip can move');
    expect(await page.evaluate(() => S.releaseTrip)).toBe(true);
    await card.getByRole('button', { name: 'Keep places from our trip where they are' }).click();
    expect(await page.evaluate(() => S.releaseTrip)).toBe(false);
    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#convertcard')).toHaveCount(0);
    expect(await page.evaluate(() => S.copy)).toBe(true);
  });
  test('with no sheet open the notice is an inline card at the top of the editor, not a modal', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast&copy=dolomites');
    await page.evaluate(() => { rebuildNow(); });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#body #convertcard')).toBeVisible();
    await page.locator('#convertcard').getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#convertcard')).toHaveCount(0);
    expect(await page.evaluate(() => S.copy)).toBe(false);
  });
  test('with the opt-in on, a pace change can move places from our trip', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast&copy=dolomites');
    const r = await page.evaluate(() => {
      S.releaseTrip = true; S.pace = 'relaxed'; S.paceSet = true; S.driveDay = 120; U.convertOk = true; S.copy = false;
      const before = S.plan.days.map((d) => d.items.map((i) => i.pid).join());
      S.plan = buildPlan(S, S.plan);
      return { moved: S.plan.days.map((d) => d.items.map((i) => i.pid).join()).some((x, i) => x !== before[i]) };
    });
    expect(r.moved).toBe(true);
  });
});

test.describe('sun and daylight', () => {
  test('sunsetFor uses shared/sun.js for each day (not the SUNSET table) and moves from day to day', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const r = await page.evaluate(() => {
      const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.picks = ['ortisei', 'seceda']; S.nights = 6; S.when = { type: 'dates', from: '2027-10-20', to: '2027-10-26' };
      const plan = ProtoEngine.build(S); const d0 = plan.days[0], d5 = plan.days[5];
      const ref = (d, iso) => ProtoSun.sunFor(d.base.lat, d.base.lon, iso, 'Europe/Rome').setMin;
      return { a: ProtoEngine.sunsetFor(S, d0), b: ProtoEngine.sunsetFor(S, d5), ra: ref(d0, '2027-10-20'), rb: ref(d5, '2027-10-25'), table: (() => { const [h, m] = SUNSET[9].split(':').map(Number); return h * 60 + m; })() };
    });
    expect(r.a).toBeCloseTo(r.ra, 5);
    expect(r.b).toBeCloseTo(r.rb, 5);
    expect(Math.abs(r.a - r.table)).toBeGreaterThan(2); // the old table is not what is shown
    expect(r.b).not.toBeCloseTo(r.a, 0); // five days later the sun sets earlier
    expect(r.b).toBeLessThan(r.a);
  });
  test('Reykjavik: west longitude is handled (positive east) and matches core/bin/sun.ts', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const mins = await page.evaluate(() => { const S = newState('weekair'); S.when = { type: 'dates', from: '2027-09-08', to: '2027-09-10' }; return ProtoEngine.sunsetFor(S, { n: 0, base: { id: 'rey', lat: 64.1466, lon: -21.9426, cc: 'IS' } }); });
    const ref = JSON.parse(execFileSync('node', ['core/bin/sun.ts', '--lat', '64.1466', '--lon', '-21.9426', '--zone', 'Atlantic/Reykjavik', '--date', '2027-09-08', '--json'], { cwd: REPO, encoding: 'utf8' }))[0];
    const refMin = +ref.sunset.slice(0, 2) * 60 + +ref.sunset.slice(3, 5);
    expect(Math.abs(mins - refMin)).toBeLessThanOrEqual(1);
    expect(mins).toBeGreaterThan(19 * 60); // evening, not shifted by 8 minutes a degree
    expect(mins).toBeLessThan(21 * 60 + 30);
  });
  test('a hike that ends after sunset minus 30 minutes is flagged on the item, in the day warnings and in the plan', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    await page.evaluate(() => {
      U.ctx = null; chooseKind('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; setAirports(S); S.when = { type: 'dates', from: '2027-10-20', to: '2027-10-26' }; S.picks = ['ortisei', 'siusi', 'funes', 'carezza', 'braies', 'seceda'];
      S.nights = 6; S.nightsTouched = true; S.plan = buildPlan(S, null);
      const d = S.plan.days[2]; d.items = ['funes', 'carezza', 'braies', 'siusi', 'seceda'].map((pid) => ({ pid, placed: true }));
      recalc(S.plan, S); S.cfg0 = cfgSig(S); S.checklist = defaultChecklist(); histReset('Built'); S.stage = 7; U.justBuilt = false; U.day = 2; save(true); render();
    });
    const r = await page.evaluate(() => {
      const d = S.plan.days[2], ss = ProtoEngine.sunsetFor(S, d);
      const items = d.items.map((i) => ({ pid: i.pid, type: PL[i.pid].type, end: i.t + i.dur, flag: !!i.sunWarn }));
      return { ss, items, warns: d.warns.filter((w) => w.k === 'hike').map((w) => w.t) };
    });
    for (const it of r.items) expect(it.flag, it.pid).toBe(it.type === 'hike' && it.end > r.ss - 30);
    expect(r.items.some((i) => i.flag)).toBe(true);
    expect(r.warns.length).toBe(r.items.filter((i) => i.flag).length);
    await expect(page.locator('.chip[data-sun]').first()).toBeVisible();
    await page.getByRole('button', { name: /warnings? ·/ }).click();
    await expect(page.getByText(/sunset \(\d\d:\d\d\)/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Move it, or swap it for indoor/ }).first()).toBeVisible();
  });
  test('the dates hint shows a computed sunset and no longer says placeholder for the sun', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    await page.evaluate(() => { U.ctx = null; chooseKind('weekend'); S.when = { type: 'month', month: 7 }; S.stage = 1; render(); });
    await expect(page.getByText(/Sunset about \d\d:\d\d \(computed from the sun's position\)/)).toBeVisible();
  });
});

test.describe('calendar file from shared/ics.js', () => {
  test('Add to calendar downloads timed events per stop and all-day book-by events', async ({ page, base }) => {
    const id = await openSeeded(page, base, 1);
    await page.goto(base + '/builder/?fast&review=' + id);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/\.ics$/);
    const text = await page.evaluate(() => U.lastIcs);
    const info = await page.evaluate((t) => { const ev = ProtoICS.parse(t); const stops = S.plan.days.reduce((n, d) => n + d.items.length, 0);
      return { timed: ev.filter((e) => /T\d{6}$/.test(e.props.DTSTART)).length, allDay: ev.filter((e) => /VALUE=DATE/.test(e.params.DTSTART)).length, stops, hasEnd: ev.filter((e) => /T\d{6}$/.test(e.props.DTSTART)).every((e) => !!e.props.DTEND), books: planStats(S.plan, S).books.length, oldAllDayDay: ev.some((e) => /^Day \d+ /.test(e.props.SUMMARY || '')) }; }, text);
    expect(info.timed).toBe(info.stops);
    expect(info.hasEnd).toBe(true);
    expect(info.allDay).toBe(info.books);
    expect(info.allDay).toBeGreaterThan(0);
    expect(info.oldAllDayDay).toBe(false);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('\r\n');
    expect(text).toContain('SUMMARY:Book by today:');
    await expect(page.locator('#toast')).toContainText('Calendar file ready');
  });
  test('the engine icsOf delegates to shared/ics.js and is empty for an undated trip', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const r = await page.evaluate(() => {
      const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.picks = ['ortisei', 'seceda']; S.nights = 3; S.when = { type: 'unsure' };
      const plan = ProtoEngine.build(S); const none = ProtoEngine.icsOf(plan, S);
      S.when = { type: 'dates', from: '2027-07-13', to: '2027-07-16' }; const text = ProtoEngine.icsOf(plan, S);
      return { none, hasTimed: /DTSTART:2027071\dT\d{6}\r\n/.test(text), folded: text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75) };
    });
    expect(r.none).toBe('');
    expect(r.hasTimed).toBe(true);
    expect(r.folded).toBe(true);
  });
  test('"next weekend" is a dated trip in the contract, so the calendar works for it too', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const r = await page.evaluate(() => { const S = newState('weekend'); S.picks = ['algonquin']; S.nights = 2; const plan = ProtoEngine.build(S); S.plan = plan; const t = ProtoEngine.toTrip(S); return { from: t.dates.from, to: t.dates.to, ics: ProtoEngine.icsOf(plan, S).length > 0 }; });
    expect(r.from).toBe('2026-11-06');
    expect(r.to).toBe('2026-11-08');
    expect(r.ics).toBe(true);
  });
});

test.describe('rebuild keeps the contract rules (single source in the engine)', () => {
  test('ProtoEngine.rebuild drops picks that misfit the party unless they are placed or locked; they are listed in unfit', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const r = await page.evaluate(() => {
      const S = newState('weekair'); S.regions = ['dolomites']; S.cc = 'IT'; S.nights = 5; S.when = { type: 'month', month: 7 };
      S.party = [{ id: 1, type: 'adult', needs: [] }, { id: 2, type: 'child', age: 3, needs: [] }];
      S.picks = ['ortisei', 'siusi', 'sorapis', 'tre-cime']; // sorapis (kids 10, hard) and tre-cime (kids 7) misfit a 3 year old
      const first = ProtoEngine.build(S);
      const inFirst = first.days.flatMap((d) => d.items.map((i) => i.pid));
      const placed = ProtoEngine.build(S); placed.days[1].items.push({ pid: 'tre-cime', placed: true }); ProtoEngine.recalc(placed, S);
      const again = ProtoEngine.rebuild(S, first), keep = ProtoEngine.rebuild(S, placed);
      const ids = (p) => p.days.flatMap((d) => d.items.map((i) => i.pid));
      return { inFirst, again: ids(again), unfit: again.unfit.map((u) => u.pid), keep: ids(keep) };
    });
    expect(r.again).not.toContain('sorapis');
    expect(r.again).not.toContain('tre-cime');
    expect(r.unfit).toEqual(expect.arrayContaining(['sorapis', 'tre-cime']));
    expect(r.keep).toContain('tre-cime'); // placed by the person: kept
  });
  test('fromTrip maps dates.flexible to the flex type and keeps the month; toTrip writes the month as a number', async ({ page, base }) => {
    await page.goto(base + '/builder/?fast');
    const r = await page.evaluate(() => {
      const t = ProtoContract.normalise({ id: 'f1', title: 'F', kind: 'weekend', mode: 'near', start: { city: 'Toronto' }, party: [{ type: 'adult' }], dates: { month: '2027-07', flexible: true }, nights: 1, days: [] });
      const s = fromTrip(t); const when = JSON.parse(JSON.stringify(s.when)); const out = ProtoEngine.toTrip(Object.assign(s, { when: { type: 'month', month: 7 } }));
      return { when, month: out.dates.month, type: typeof out.dates.month };
    });
    expect(r.when).toEqual({ type: 'flex', month: 7 });
    expect(r.month).toBe(7);
    expect(r.type).toBe('number');
  });
});
