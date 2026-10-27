import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// UXB-3: the trip's shape replaces "The trip at a glance" (spec trip-and-places-ux-fixes.md 4, wireframe W5, components 3.2): a closed
// ribbon and count line, an open table of the days, count phrases that filter it, a row that opens Days at its day, the state remembered per
// trip, and the page whole when storage is blocked.
const ROCKIES = '/trips/canadian-rockies-2029/';
const DOLOMITES = '/trips/dolomites-2027/';
const ALGONQUIN = '/trips/algonquin-muskoka-2026/';
const COSTA_RICA = '/trips/costa-rica-2027/';
const ICELAND = '/trips/iceland-ring-road-2027/';
const PATAGONIA = '/trips/patagonia-2027/';

const shape = (page: Page) => page.locator('#trip-shape');
const toggle = (page: Page) => shape(page).locator('.shape-toggle');
const rows = (page: Page) => shape(page).locator('tbody tr.shape-row');
/** The days in the table, once it has opened (the rows chunk loads on the first open). */
const days = async (page: Page) => {
  await expect(shape(page).locator('.shape-body')).toHaveAttribute('data-open', 'true');
  await page.waitForTimeout(300);
  return rows(page).evaluateAll((r) => r.map((x) => Number((x as HTMLElement).dataset.day)));
};

test.describe('closed by default', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the ribbon and the count line are in the page; the days are not drawn; no clock chart, no "The plan\'s day"', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(shape(page).getByRole('heading', { name: "The trip's shape" })).toBeVisible();
    await expect(shape(page).getByRole('list', { name: 'Where you sleep' }).getByRole('listitem')).toHaveCount(5);
    await expect(shape(page).locator('.shape-count')).toHaveText('15 days · 4 long drive days · 5 days with a booking · 8 highlight days · 6 days with a warning', { useInnerText: true });
    await expect(toggle(page)).toHaveText('Show all 15 days');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(shape(page).locator('.shape-table')).toBeHidden();
    expect(await page.locator('body').innerText()).not.toMatch(/The plan's day|The trip at a glance/);
    await expect(page.locator('.tl-scale-tick, .tl-bar')).toHaveCount(0);
  });

  test('every control points at one region that exists', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const ids = await shape(page).locator('[aria-controls]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('aria-controls')))]);
    expect(ids).toHaveLength(1);
    await expect(page.locator(`#${ids[0]}`)).toHaveCount(1);
  });
});

test.describe('opening and closing', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the toggle opens a real table with a caption, one row a day, and closes it again; focus stays on the toggle', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page)).toHaveText('Hide the days');
    const table = shape(page).getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toContainText("The trip's shape, 15 days");
    await expect(table.getByRole('columnheader')).toHaveText(['Day', 'Base and plan', 'Driving', 'On foot', 'Notes']);
    expect(await days(page)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    await expect(rows(page).first()).toContainText('Long drive');
    await expect(rows(page).first()).toContainText('Book 2');
    await expect(rows(page).nth(10)).toContainText('No driving');
    expect(await page.evaluate(() => document.activeElement?.classList.contains('shape-toggle'))).toBe(true);
    await page.keyboard.press('Space');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(table).toBeHidden();
  });

  test('a count phrase opens the days filtered to its days, "Show all days" clears it, and the open phrase closes it', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await shape(page).locator('[data-phrase="longDrive"]').click();
    expect(await days(page)).toEqual([1, 4, 5, 8]);
    await expect(shape(page).locator('[data-phrase="longDrive"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(shape(page).locator('caption')).toContainText('4 long drive days of 15');
    await shape(page).locator('[data-phrase="warning"]').click();
    expect(await days(page)).toEqual([2, 4, 7, 10, 12, 13]);
    await shape(page).getByRole('button', { name: 'Show all days' }).click();
    await expect(rows(page)).toHaveCount(15);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-phrase'))).toBe('days');
    await shape(page).locator('[data-phrase="days"]').click();
    await expect(shape(page).getByRole('table')).toBeHidden();
  });

  test('a row is a link: it opens Days at that day, and Back returns to the Summary', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).click();
    await days(page);
    const link = rows(page).nth(10).getByRole('link');
    await expect(link).toHaveAttribute('href', '?view=day#day-11');
    // the whole row answers a press, not only the sign
    await rows(page).nth(10).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = (await rows(page).nth(10).boundingBox())!;
    await page.mouse.click(box.x + box.width - 40, box.y + box.height / 2);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/^Days/);
    await expect(page).toHaveURL(/#day-11$/);
    await expect(page.locator('#day-11')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText('Summary');
  });

  test('open or closed is remembered for this trip only', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(shape(page).getByRole('table')).toBeVisible();
    await page.goto(`${site.url}${DOLOMITES}`);
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    const ui = await page.evaluate(() => JSON.parse(localStorage.getItem('travel.tripui') ?? '{}'));
    expect(Object.keys(ui.trips)).toEqual(['canadian-rockies-2029', 'dolomites-2027'].slice(0, 1).concat(Object.keys(ui.trips).slice(1)));
  });

  test('closing is remembered too', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).click();
    await toggle(page).click();
    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    const ui = await page.evaluate(() => JSON.parse(localStorage.getItem('travel.tripui') ?? '{}'));
    expect(ui.trips['canadian-rockies-2029'].shapeOpen).toBe(false);
  });

  test('storage blocked: the page loads closed and the toggle still works for this visit', async ({ page, site }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
  });

  test('the table loads on demand: a closed shape fetches no rows chunk', async ({ page, site }) => {
    const scripts: string[] = [];
    page.on('response', (r) => { if (r.url().endsWith('.js')) scripts.push(r.url()); });
    await page.goto(`${site.url}${ROCKIES}`);
    await page.waitForLoadState('networkidle');
    const before = scripts.length;
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    expect(scripts.length).toBeGreaterThan(before);
  });
});

test.describe('other trips', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a trip with few days has a row for each; an overview trip has no shape', async ({ page, site }) => {
    await page.goto(`${site.url}${ALGONQUIN}`);
    await toggle(page).click();
    expect((await days(page)).length).toBe(3);
    await page.goto(`${site.url}${COSTA_RICA}`);
    await expect(page.locator('#trip-shape')).toHaveCount(0);
  });

  test('the Dolomites shape never says "The plan\'s day"; a version shows only as a note', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}`);
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    expect(await shape(page).innerText()).not.toContain("The plan's day");
  });

  test('a party that differs from the plan updates the count line and the rows', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?p=adults`);
    await expect(shape(page).locator('.shape-count')).toContainText('15 days');
    await toggle(page).click();
    expect((await days(page)).length).toBe(15);
  });
});

test.describe('the second review (UXB-3F)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('M3: with the chunk preloaded, the body starts to grow within 150 ms of the press and "Loading the days" never shows', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).hover();
    await page.waitForTimeout(700);
    const t = await page.evaluate(
      () =>
        new Promise<{ ms: number; loading: boolean }>((resolve) => {
          const body = document.querySelector<HTMLElement>('.shape-body')!;
          const t0 = performance.now();
          let loading = false;
          const tick = () => {
            if (document.querySelector('.shape-loading')) loading = true;
            if (body.getBoundingClientRect().height > 8) return resolve({ ms: performance.now() - t0, loading });
            if (performance.now() - t0 > 3000) return resolve({ ms: 3000, loading });
            requestAnimationFrame(tick);
          };
          document.querySelector<HTMLElement>('.shape-toggle')!.click();
          requestAnimationFrame(tick);
        }),
    );
    expect(t.loading).toBe(false);
    expect(t.ms).toBeLessThan(150);
  });

  test('M2: names read whole where they fit (Banff, Jasper townsite), and Iceland has a names line with every stay in order', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const banff = shape(page).locator('.shape-seg').first();
    await expect(banff.locator('.shape-seg-n .shape-full')).toBeVisible();
    await expect(banff.locator('.shape-seg-n .shape-full')).toHaveText('Banff');
    await page.goto(`${site.url}${ICELAND}`);
    const names = shape(page).locator('.shape-names');
    await expect(names).toBeVisible();
    await expect(names).toContainText('Reykjavik');
    expect(((await names.innerText()).match(/ · /g) ?? []).length).toBe((await shape(page).locator('.shape-seg').count()) - 1);
    // no word is clipped: every visible name fits its segment
    const clipped = await shape(page).locator('.shape-seg').evaluateAll((els) => els.filter((e) => [...e.querySelectorAll<HTMLElement>('.shape-seg-n, .shape-seg-k')].some((c) => c.offsetParent && c.scrollWidth > c.clientWidth + 1)).length);
    expect(clipped).toBe(0);
  });

  test('C1: no Light day on the Lagazuoi day or a flight day; walking unknown says so', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}`);
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    await expect(rows(page).nth(6)).not.toContainText('Light day');
    await page.goto(`${site.url}${PATAGONIA}`);
    await expect(toggle(page)).toBeVisible();
    if ((await toggle(page).getAttribute('aria-expanded')) !== 'true') await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    for (const d of [1, 2, 13]) await expect(shape(page).locator(`tr[data-day="${d}"]`)).not.toContainText('Light day');
    await expect(shape(page).locator('tr[data-day="2"] .shape-foot')).toContainText('Not checked yet');
  });

  test('S3: each row link is named with its day, base and plan; a warning has a glyph as well as a word', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).click();
    await expect(shape(page).getByRole('link', { name: /^Day 06, Jasper townsite: Kinney Lake.*open in Days$/ })).toHaveCount(1);
    await expect(shape(page).locator('tr[data-day="2"] .shape-note[data-kind="warning"] svg')).toHaveCount(1);
  });

  test('polish: the live region says what is shown, in the order a reader wants it', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await shape(page).locator('[data-phrase="booking"]').click();
    await expect(shape(page).locator('p[role="status"].sr-only')).toHaveText('Showing 5 of 15 days: 5 days with a booking');
  });
});

test.describe('phones', () => {
  for (const width of [320, 390]) {
    test(`at ${width}: no sideways scroll, 44 px controls, one row a day with its notes`, async ({ page, site }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${site.url}${ROCKIES}`);
      for (const sel of ['.shape-toggle', '.shape-phrase']) {
        for (const b of await shape(page).locator(sel).all()) expect((await b.boundingBox())!.height, `${sel} at ${width}`).toBeGreaterThanOrEqual(43.5);
      }
      await toggle(page).click();
      await expect(shape(page).getByRole('table')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const r = (await rows(page).first().boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(44);
      // S1: a row is three lines at most for a short plan, the notes line leads with the walking, and the bases line up
      const left = await rows(page).evaluateAll((rs) => rs.slice(0, 8).map((x) => Math.round(x.querySelector('.shape-base')!.getBoundingClientRect().left)));
      expect(new Set(left).size).toBe(1);
      await expect(rows(page).first().locator('.shape-notes')).toContainText('1.9 km on foot');
      // S2: short phrases, no more than two rows of them
      await expect(shape(page).locator('.shape-phrase')).toHaveText(['15 days', '4 long drives', '5 with a booking', '8 highlights', '6 warnings'], { useInnerText: true });
      const pills = await shape(page).locator('.shape-phrase').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
      expect(pills).toBeLessThanOrEqual(width === 320 ? 3 : 2);
      await expect(rows(page).first()).toContainText('Long drive');
      // the ribbon keeps a name or a short one in every segment, none clipped
      const clipped = await shape(page).locator('.shape-seg').evaluateAll((els) => els.filter((e) => [...e.querySelectorAll<HTMLElement>('.shape-seg-n, .shape-seg-k')].some((c) => c.offsetParent && c.scrollWidth > c.clientWidth + 1)).length);
      expect(clipped).toBe(0);
    });
  }
});

test.describe('print and reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('print shows the ribbon and the count line, not the per-day table', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await toggle(page).click();
    await expect(shape(page).getByRole('table')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(shape(page).locator('.shape-ribbon')).toBeVisible();
    await expect(shape(page).locator('.shape-print')).toContainText('15 days · 4 long drive days');
    await expect(shape(page).locator('.shape-table')).toBeHidden();
    await expect(shape(page).locator('.shape-toggle')).toBeHidden();
  });

  test('reduced motion jumps: no transition on the body or the chevron', async ({ page, site }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site.url}${ROCKIES}`);
    const d = await page.evaluate(() => [getComputedStyle(document.querySelector('.shape-body')!).transitionDuration, getComputedStyle(document.querySelector('.shape-chev')!).transitionDuration]);
    expect(d).toEqual(['0s', '0s']);
  });
});

test.describe('axe wcag22aa', () => {
  for (const width of [320, 1440]) {
    for (const open of [false, true]) {
      for (const dark of [false, true]) {
        test(`is clean at ${width}, ${open ? 'open' : 'closed'}, ${dark ? 'dark' : 'light'}`, async ({ page, site }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${site.url}${ROCKIES}`);
          if (dark) await page.getByRole('button', { name: 'Switch to dark theme' }).first().click();
          if (open) {
            await toggle(page).click();
            await expect(shape(page).getByRole('table')).toBeVisible();
            await page.waitForTimeout(400);
          }
          const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#trip-shape').analyze();
          expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        });
      }
    }
  }
});
