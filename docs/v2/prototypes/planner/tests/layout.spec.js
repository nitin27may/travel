/* Layout sweep: no horizontal scroll and nothing wider than the viewport at 320, 360, 390, 600, 760 and 1440 px,
   on every page and trip tab, with a sheet open. */
const { test, expect, open } = require('./helpers.js');

const WIDTHS = [320, 360, 390, 600, 760, 1440];
const TABS = ['overview', 'itinerary', 'bookings', 'checklist', 'travellers', 'costs', 'notes', 'share'];
const PAGES = [
  '/planner/index.html',
  ...TABS.map((t) => '/planner/trip.html?id=t-dolomites#' + t),
  '/planner/trip.html?id=t-algonquin#overview',
  '/planner/trip.html?id=t-dolomites&shared=1',
  '/planner/today.html?id=t-dolomites&day=2',
  '/planner/print.html?id=t-dolomites',
];

function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push('document scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw);
    document.querySelectorAll('body *').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || e.closest('svg,[hidden],.tabs,.sr,#proto-btn,#toasts')) return;
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed' && e.id === 'proto-drawer') return;
      if (r.right > vw + 1 || r.left < -1) out.push((e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + Math.round(r.left) + '..' + Math.round(r.right)).slice(0, 90));
    });
    return out.slice(0, 6);
  });
}

for (const w of WIDTHS) {
  test(`layout at ${w}px: no horizontal scroll on any planner page`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, base, '/planner/index.html');
    for (const url of PAGES) {
      await page.goto(base + url);
      await page.waitForSelector('#app > *');
      await page.waitForTimeout(120);
      expect(await overflow(page), url).toEqual([]);
    }
  });

  test(`layout at ${w}px: sheets and the switcher fit`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
    await page.locator('#chip').click();
    expect(await overflow(page), 'switcher').toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add infant' }).click();
    await page.waitForTimeout(400);
    expect(await overflow(page), 'diff sheet').toEqual([]);
    await page.getByRole('button', { name: 'Apply to the plan' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Change dates' }).click();
    await page.waitForTimeout(400);
    expect(await overflow(page), 'dates sheet').toEqual([]);
  });
}
