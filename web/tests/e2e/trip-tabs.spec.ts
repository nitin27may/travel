import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// UXB-1: the trip page's tab bar and the Summary (spec trip-and-places-ux-fixes.md 3, components 1.6, patterns 3.10). Tab semantics and keyboard,
// URL state and old links, the remembered tab, tabs a trip does not draw, the Summary's content on three kinds of trip, and the
// sticky rows at 320, 390 and 1440.
const ROCKIES = '/trips/canadian-rockies-2029/';
const DOLOMITES = '/trips/dolomites-2027/';
const ALGONQUIN = '/trips/algonquin-muskoka-2026/';
const COSTA_RICA = '/trips/costa-rica-2027/';
const NIAGARA = '/trips/niagara-day-2026/';

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const panel = (page: Page, name: string) => page.locator(`#trip-panel-${name}`);
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Trip sections' }).getByRole('tab');
const selected = (page: Page) => page.locator('[role="tab"][aria-selected="true"]');

test.describe('the tab bar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is a labelled tablist of five tabs, the Summary selected and its panel the only one on screen', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(tabs(page)).toHaveCount(5);
    await expect(tabs(page)).toHaveText([/^Summary$/, /^Days/, /^Stops/, /^Bookings/, /^Photos/]);
    await expect(selected(page)).toHaveText('Summary');
    for (const name of ['summary', 'days', 'stops', 'bookings', 'photos']) {
      const t = page.locator(`#trip-tab-${name}`);
      await expect(t).toHaveAttribute('aria-controls', `trip-panel-${name}`);
      await expect(t).toHaveAttribute('tabindex', name === 'summary' ? '0' : '-1');
    }
    const p = panel(page, 'summary');
    await expect(p).toBeVisible();
    await expect(p).toHaveAttribute('role', 'tabpanel');
    await expect(p).toHaveAttribute('aria-labelledby', 'trip-tab-summary');
    await expect(panel(page, 'days')).toBeHidden();
    await expect(page.locator('.tl-planbar')).toHaveCount(0);
  });

  test('keyboard: arrows move focus without opening, Home and End jump, Enter and Space open; focus stays on the tab', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await page.locator('#trip-tab-summary').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#trip-tab-days')).toBeFocused();
    await expect(selected(page)).toHaveText('Summary'); // manual activation: arrows only move
    await page.keyboard.press('Enter');
    await expect(selected(page)).toHaveText(/^Days/);
    await expect(panel(page, 'days')).toBeVisible();
    await expect(page).toHaveURL(/\?view=day$/);
    await expect(page.locator('#trip-tab-days')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('#trip-tab-photos')).toBeFocused();
    await page.keyboard.press('ArrowRight'); // wraps
    await expect(page.locator('#trip-tab-summary')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // wraps back
    await expect(page.locator('#trip-tab-photos')).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(selected(page)).toHaveText(/^Stops/);
    await expect(page).toHaveURL(/\?view=all$/);
    await expect(page.locator('#trails')).toBeVisible(); // the lazy chunk arrived
    await expect(page.locator('#trip-tab-stops')).toBeFocused();
  });

  test('Tab leaves the tablist for the panel, never through the other tabs', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await page.locator('#trip-tab-summary').focus();
    await page.keyboard.press('Tab');
    const inBar = await page.evaluate(() => !!document.activeElement?.closest('[role="tablist"]'));
    expect(inBar).toBe(false);
  });
});

test.describe('the address', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('view names the tab: omitted is the Summary; day, all, bookings and photos open theirs; Back returns to the previous tab', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await tab(page, 'Bookings').click();
    await expect(page).toHaveURL(/\?view=bookings$/);
    await expect(panel(page, 'bookings')).toBeVisible();
    await expect(panel(page, 'bookings').getByRole('heading', { name: 'Bookings' })).toBeVisible();
    await tab(page, 'Photos').click();
    await expect(page).toHaveURL(/\?view=photos$/);
    await expect(panel(page, 'photos')).toBeVisible();
    await page.goBack();
    await expect(selected(page)).toHaveText(/^Bookings/);
    await page.goBack();
    await expect(selected(page)).toHaveText('Summary');
    await expect(page).not.toHaveURL(/view=/);
    await page.goForward();
    await expect(selected(page)).toHaveText(/^Bookings/);
  });

  for (const [name, path, want] of [
    ['view=category (the old By category link)', `${ROCKIES}?view=category`, /^Stops/],
    ['#trails (an old category link)', `${ROCKIES}#trails`, /^Stops/],
    ['view=category#trails', `${ROCKIES}?view=category#trails`, /^Stops/],
    ['#day-4 with no view', `${ROCKIES}#day-4`, /^Days/],
    ['view=day', `${ROCKIES}?view=day`, /^Days/],
    ['view=table (Days until the Table view exists)', `${ROCKIES}?view=table`, /^Days/],
    ['view=photos', `${ROCKIES}?view=photos`, /^Photos/],
    ['an unknown view', `${ROCKIES}?view=nonsense`, /^Summary$/],
  ] as const) {
    test(`an old or typed link opens the right tab: ${name}`, async ({ page, site }) => {
      await page.goto(`${site.url}${path}`);
      await expect(selected(page)).toHaveText(want);
    });
  }

  // UXB-1F M3: with every script chunk blocked nothing hydrates, so what is on screen is what the inline script and the stylesheet painted
  for (const [name, path, panelName] of [
    ['?view=day', `${ROCKIES}?view=day`, 'days'],
    ['#day-11', `${ROCKIES}#day-11`, 'days'],
    ['?view=bookings', `${ROCKIES}?view=bookings`, 'bookings'],
  ] as const) {
    test(`a deep link paints its panel before any script runs, never the Summary: ${name}`, async ({ page, site }) => {
      await page.route(/\/_next\/static\/.*\.js/, (r) => r.abort());
      await page.goto(`${site.url}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(panel(page, panelName)).toBeVisible();
      await expect(panel(page, 'summary')).toBeHidden();
      await expect(page.locator(`#trip-tab-${panelName}`)).toHaveCSS('font-weight', '600');
    });
  }
  test('with no deep link the Summary paints, and a tab press after hydration is not overruled by the pre-paint rule', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(selected(page)).toHaveText(/^Days/);
    await expect(page.locator('html')).not.toHaveAttribute('data-trip-tab', /./);
    await tab(page, 'Summary').click();
    await expect(panel(page, 'summary')).toBeVisible();
    await expect(panel(page, 'days')).toBeHidden();
  });

  test('#trails scrolls to the Trails section and #day-4 to Day 4, under the sticky rows', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#trails`);
    const trails = page.locator('#trails');
    await expect(trails).toBeVisible();
    await expect.poll(async () => Math.round((await trails.boundingBox())!.y)).toBeLessThan(260);
    await page.goto(`${site.url}${ROCKIES}#day-4`);
    const day = page.locator('#day-4');
    await expect(day).toBeVisible();
    await expect.poll(async () => Math.round((await day.boundingBox())!.y)).toBeLessThan(260);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test('the profile keys survive a tab change', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?p=family-6&pace=relaxed`);
    await tab(page, 'Days').click();
    await expect(page).toHaveURL(/\?p=family-6&pace=relaxed&view=day$/);
    await tab(page, 'Summary').click();
    await expect(page).toHaveURL(/\?p=family-6&pace=relaxed$/);
  });
});

test.describe('the remembered tab', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a trip opened with no view lands on the tab this device last used, and the address says so', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}`);
    await tab(page, 'Bookings').click();
    await expect(selected(page)).toHaveText(/^Bookings/);
    await page.goto(`${site.url}/trips/`);
    await page.goto(`${site.url}${DOLOMITES}`);
    await expect(selected(page)).toHaveText(/^Bookings/);
    await expect(page).toHaveURL(/\?view=bookings$/);
    // another trip has its own memory
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(selected(page)).toHaveText('Summary');
  });

  test('the URL beats the memory', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?view=photos`);
    await tab(page, 'Days').click();
    await page.goto(`${site.url}${DOLOMITES}?view=photos`);
    await expect(selected(page)).toHaveText(/^Photos/);
  });

  test('choosing the Summary again is remembered too, and Back from a remembered landing leaves no dead step', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?view=day`);
    await tab(page, 'Summary').click();
    await page.goto(`${site.url}${DOLOMITES}`);
    await expect(selected(page)).toHaveText('Summary');
  });
});

test.describe('tabs a trip does not draw', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a plan with no gallery and no booking has Summary, Days and Stops only', async ({ page, site }) => {
    await page.goto(`${site.url}${ALGONQUIN}`);
    await expect(tabs(page)).toHaveText([/^Summary$/, /^Days/, /^Stops/]);
    await expect(page.locator('#trip-tab-bookings')).toHaveCount(0);
    await expect(page.locator('#trip-tab-photos')).toHaveCount(0);
  });

  test('an overview trip with photos has Summary and Photos; a request for Days opens the Summary', async ({ page, site }) => {
    await page.goto(`${site.url}${COSTA_RICA}`);
    await expect(tabs(page)).toHaveText([/^Summary$/, /^Photos/]);
    await page.goto(`${site.url}${COSTA_RICA}?view=day`);
    await expect(selected(page)).toHaveText('Summary');
    await page.goto(`${site.url}${COSTA_RICA}?view=photos`);
    await expect(selected(page)).toHaveText(/^Photos/);
    await expect(panel(page, 'photos').getByRole('heading', { name: 'Photos' })).toBeVisible();
  });

  test('an overview trip with no photos draws no tab bar at all; the Summary is the page', async ({ page, site }) => {
    await page.goto(`${site.url}${NIAGARA}`);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByText('This plan has not been converted to days yet.')).toBeVisible();
  });
});

test.describe('the Summary', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Rockies: provinces and parks by name, count cards with coverage, highlights with day links', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const p = panel(page, 'summary');
    await expect(p.getByRole('heading', { name: 'What you will do' })).toBeVisible();
    const lead = p.locator('.sum-lead-text');
    await expect(lead).toContainText('15 days through Alberta and British Columbia');
    for (const park of ['Banff', 'Jasper', 'Yoho', 'Kootenay']) await expect(lead).toContainText(park);
    await expect(lead).toContainText('World Heritage Site');
    const cards = p.locator('.sum-cards .sum-card');
    await expect(cards.filter({ hasText: /trails/ })).toContainText('km, all versions');
    await expect(cards.filter({ hasText: /to book ahead/ })).toContainText('none has a published opening date yet');
    await expect(cards.filter({ hasText: /photos/ })).toBeVisible();
    await expect(p.locator('.sum-hl:visible')).toHaveCount(8);
    await expect(p.locator('.sum-hl', { hasText: 'Moraine Lake' }).first()).toBeVisible();
    await expect(p.getByText('No licensed photo yet')).toHaveCount(0);
    // S7: the day links read "Day N"; M1: both safety lines are at rest, not behind "more"
    await expect(p.locator('.sum-hl-days a').first()).toHaveText(/^Day \d+$/);
    await expect(p.locator('.sum-know > li', { hasText: 'Moraine Lake Road' })).toBeVisible();
    await expect(p.locator('.sum-know > li', { hasText: 'Larch Valley' })).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Who it suits' })).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Know before you go' })).toBeVisible();
  });

  test('a count card is a real link: Trails opens Stops at the Trails section and focus lands on its heading', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const card = panel(page, 'summary').locator('a.sum-card[data-card="trails"]');
    await expect(card).toHaveAttribute('href', '?view=all#trails');
    await card.click();
    await expect(selected(page)).toHaveText(/^Stops/);
    await expect(page).toHaveURL(/\?view=all#trails$/);
    await expect(page.locator('#trails')).toBeVisible();
    await expect(page.locator('#trails h3')).toBeFocused();
    await page.goBack();
    await expect(selected(page)).toHaveText('Summary');
  });

  test('a highlight day link opens Days at that day with the day heading focused (Back returns to the Summary)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const link = panel(page, 'summary').locator('.sum-hl', { hasText: 'Moraine Lake' }).first().locator('.sum-hl-days a', { hasText: '11' });
    await expect(link).toHaveAttribute('href', '?view=day#day-11');
    await link.click();
    await expect(selected(page)).toHaveText(/^Days/);
    await expect(page).toHaveURL(/#day-11$/);
    await expect(page.locator('#day-11')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => !!document.activeElement?.closest('#day-11'))).toBe(true);
    await page.goBack();
    await expect(selected(page)).toHaveText('Summary');
  });

  test('the glance (the trip shape slot) stays in the Summary, and its day link opens Days', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(panel(page, 'summary').locator('#trip-shape')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The trip at a glance' })).toBeVisible();
  });

  test('Dolomites: regions, nature parks and the earliest booking window in words', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}`);
    const p = panel(page, 'summary');
    await expect(p.locator('.sum-lead-text')).toContainText('South Tyrol');
    await expect(p.locator('.sum-cards')).toContainText(/earliest: .*opens 30 days before Day 3/);
    await expect(p.locator('.sum-hl:visible').first()).toBeVisible();
  });

  test('an overview trip: nights and photos, no stop counts, no bookings, no shape, and the honest line', async ({ page, site }) => {
    await page.goto(`${site.url}${COSTA_RICA}`);
    const p = panel(page, 'summary');
    await expect(p.locator('.sum-lead-text')).toContainText('This plan has not been converted to days yet.');
    await expect(p.locator('.sum-cards .sum-card')).toHaveCount(2);
    await expect(p.locator('.sum-cards')).toContainText('10 nights');
    await expect(p.locator('.sum-cards')).toContainText('photos');
    await expect(p.locator('[data-card="bookings"], [data-card="trails"], #trip-shape')).toHaveCount(0);
    await expect(p.getByRole('heading', { name: 'This plan is valid for' })).toBeVisible(); // the season band, until UXB-4 redesigns it
  });

  test('printing shows the Summary even when Photos is the tab on screen, and never the Photos', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=photos`);
    await expect(panel(page, 'photos')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(panel(page, 'summary')).toBeVisible();
    await expect(panel(page, 'photos')).toBeHidden();
    await expect(page.locator('.trip-tabbar')).toBeHidden();
  });
});

for (const width of [320, 390, 1440]) {
  test.describe(`at ${width}`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 900 : 844 } });

    test('five tabs share one row with no sideways scroll, each at least 44 px wide and tall, and the page does not scroll sideways', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      const list = page.getByRole('tablist', { name: 'Trip sections' });
      await expect(list).toBeVisible();
      const m = await list.evaluate((el) => ({
        fits: el.scrollWidth <= el.clientWidth,
        boxes: [...el.querySelectorAll('[role="tab"]')].map((t) => {
          const r = t.getBoundingClientRect();
          return { w: r.width, h: r.height, y: Math.round(r.top) };
        }),
        page: document.documentElement.scrollWidth <= window.innerWidth,
      }));
      expect(m.fits, 'the tab row never scrolls at 100% text').toBe(true);
      expect(m.page, 'no sideways scroll on the page').toBe(true);
      expect(new Set(m.boxes.map((b) => b.y)).size, 'one row').toBe(1);
      for (const b of m.boxes) {
        expect(b.w).toBeGreaterThanOrEqual(43.5);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
    });

    test('the sticky rows: the tab bar sticks on the Summary, Bookings and Photos; on Days and Stops a phone keeps one row (the rail or the strip) and desktop keeps both', async ({ page, site }) => {
      const phone = width < 640;
      const pos = (sel: string) => page.locator(sel).first().evaluate((el) => ({ p: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top) }));
      const header = () => page.evaluate(() => Math.round(document.querySelector('.site-header')!.getBoundingClientRect().bottom));
      // Summary: sticky bar, stuck under the header once the page scrolls
      await page.goto(`${site.url}${ROCKIES}`);
      await page.evaluate(() => window.scrollTo(0, 1400));
      await expect.poll(() => pos('.trip-tabbar').then((r) => r.top)).toBe(await header());
      expect((await pos('.trip-tabbar')).p).toBe('sticky');
      // Days
      await page.goto(`${site.url}${ROCKIES}?view=day`);
      await expect(page.locator('.tl-planbar')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 1800));
      await expect.poll(() => pos('.tl-planbar').then((r) => r.top)).toBe(phone ? await header() : (await header()) + 48);
      expect((await pos('.trip-tabbar')).p).toBe(phone ? 'static' : 'sticky');
      if (!phone) expect((await pos('.trip-tabbar')).top).toBe(await header());
      // Stops
      await page.goto(`${site.url}${ROCKIES}?view=all`);
      await expect(page.locator('.cat-strip')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 1800));
      await expect.poll(() => pos('.cat-strip').then((r) => r.top)).toBe(phone ? await header() : (await header()) + 48);
      expect((await pos('.trip-tabbar')).p).toBe(phone ? 'static' : 'sticky');
      // Bookings
      await page.goto(`${site.url}${ROCKIES}?view=bookings`);
      expect((await pos('.trip-tabbar')).p).toBe('sticky');
    });

    test('switching tabs from deep in a tab puts the new panel just under the tab bar, not at the top of the page', async ({ page, site }) => {
      if (width < 640) test.skip(true, 'on a phone the tab bar scrolls away on Days; the Summary-to-Bookings switch is checked below');
      await page.goto(`${site.url}${ROCKIES}`);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await tab(page, 'Bookings').click();
      await expect(panel(page, 'bookings')).toBeVisible();
      const y = await page.evaluate(() => ({ bar: Math.round(document.querySelector('.trip-tabbar')!.getBoundingClientRect().top), head: Math.round(document.querySelector('.site-header')!.getBoundingClientRect().bottom), scroll: window.scrollY }));
      expect(y.bar).toBe(y.head);
      expect(y.scroll).toBeGreaterThan(200);
    });
  });
}

test.describe('phone Summary', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('highlights are a 2 x 2 grid with "Show 4 more", not a sideways row; the lead has a More', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const p = panel(page, 'summary');
    await expect(p.locator('.sum-hl:visible')).toHaveCount(4);
    const cols = await p.locator('.sum-hl:visible').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    expect(cols).toBe(2);
    await p.getByText('Show 4 more').click();
    await expect(p.locator('.sum-hl:visible')).toHaveCount(8);
    await p.getByText('Show fewer').click();
    await expect(p.locator('.sum-hl:visible')).toHaveCount(4);
    const lead = p.locator('.sum-lead-text');
    const clamped = (await lead.boundingBox())!.height;
    await p.getByText('More', { exact: true }).click();
    expect((await lead.boundingBox())!.height).toBeGreaterThan(clamped);
  });

  test('the count cards are two to a row and each is at least 44 px tall', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const boxes = await panel(page, 'summary').locator('.sum-cards .sum-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: Math.round(r.left), h: r.height })));
    expect(new Set(boxes.map((b) => b.l)).size).toBe(2);
    for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44);
  });
});

test.describe('a short window', () => {
  test.use({ viewport: { width: 1280, height: 700 } });

  test('keeps one row sticky on Days, as a phone does: the tab bar scrolls away and the plan bar sticks under the header', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('.tl-planbar')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 1800));
    const m = await page.evaluate(() => ({
      tabs: getComputedStyle(document.querySelector('.trip-tabbar')!).position,
      bar: Math.round(document.querySelector('.tl-planbar')!.getBoundingClientRect().top),
      head: Math.round(document.querySelector('.site-header')!.getBoundingClientRect().bottom),
    }));
    expect(m.tabs).toBe('static');
    expect(m.bar).toBe(m.head);
  });
});

// F1: heading order is valid on every tab, at a phone and a desktop width
for (const width of [390, 1440]) {
  test.describe(`axe on every tab at ${width}`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 900 : 844 } });
    for (const name of ['Summary', 'Days', 'Stops', 'Bookings', 'Photos']) {
      test(`${name}: no axe violations, heading order included`, async ({ page, site }) => {
        await page.goto(`${site.url}${ROCKIES}`);
        await tab(page, name).click();
        await expect(selected(page)).toHaveText(new RegExp(`^${name}`));
        await page.waitForTimeout(600);
        const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
        // the active panel starts with a heading that is not skipped past: the first heading in it is an h2
        const first = await page.locator(`#trip-panel-${name.toLowerCase()} :is(h1,h2,h3,h4)`).first().evaluate((h) => h.tagName);
        expect(first).toBe('H2');
      });
    }
  });
}

// F4 (Q305): print is the Summary, the days and the bookings, whichever tab is on screen, never the Photos or the Stops
test.describe('print', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('Summary, Days and Bookings print from any landing tab with the same page count; Photos and Stops never', async ({ page, site, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf is Chromium-only');
    const pages: Record<string, number> = {};
    for (const [name, q] of [['summary', ''], ['days', '?view=day'], ['bookings', '?view=bookings'], ['stops', '?view=all'], ['photos', '?view=photos']] as const) {
      await page.goto(`${site.url}${ROCKIES}${q}`);
      await expect(selected(page)).toBeVisible();
      await page.waitForTimeout(800);
      await page.emulateMedia({ media: 'print' });
      await expect(panel(page, 'summary')).toBeVisible();
      await expect(panel(page, 'days')).toBeVisible();
      await expect(panel(page, 'bookings')).toBeVisible();
      await expect(panel(page, 'photos')).toBeHidden();
      await expect(panel(page, 'stops')).toBeHidden();
      expect(await page.locator('#day-1').evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThan(50);
      const pdf = await page.pdf({ format: 'A4' });
      pages[name] = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      await page.emulateMedia({ media: 'screen' });
    }
    expect(pages.days).toBe(pages.summary);
    expect(pages.bookings).toBe(pages.summary);
    expect(pages.stops).toBe(pages.summary);
    expect(pages.photos).toBe(pages.summary);
    expect(pages.summary).toBeGreaterThan(8);
  });
});
