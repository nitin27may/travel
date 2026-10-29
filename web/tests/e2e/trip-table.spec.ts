import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// UXB-5: the Table view of each day (spec trip-and-places-ux-fixes 7, components 4.6, edit-mode-spec H10). A List | Table switch in the Days panel,
// `view=table`, one real table per day, three columns on a phone and six from 640 px with no sideways scroll, Stops only (`rows=stops`,
// remembered), the table a lazy chunk, and in your own trip the one line "Editing works in List".
const ROCKIES = '/trips/canadian-rockies-2029/';
const DOLOMITES = '/trips/dolomites-2027/';

const view = (page: Page) => page.getByRole('radiogroup', { name: 'Days view' });
const tables = (page: Page) => page.locator('table.dt');
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('the List | Table switch', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sits above the days, List chosen, and Table is the only other choice', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(view(page).getByRole('radio')).toHaveText(['List', 'Table']);
    await expect(view(page).getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await expect(tables(page)).toHaveCount(0);
  });

  test('Table writes view=table, draws one table per day, and List writes view=day back', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    const n = await page.locator('li.tl-day').count();
    await view(page).getByRole('radio', { name: 'Table' }).click();
    await expect(page).toHaveURL(/view=table/);
    await expect(tables(page)).toHaveCount(n);
    await expect(page.locator('.tl-rail')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Days/ })).toHaveAttribute('aria-selected', 'true');
    await view(page).getByRole('radio', { name: 'List' }).click();
    await expect(page).toHaveURL(/view=day/);
    await expect(tables(page)).toHaveCount(0);
    await expect(page.locator('li.tl-day')).toHaveCount(n);
    // Back returns to the Table: a view is a place in the history
    await page.goBack();
    await expect(tables(page)).toHaveCount(n);
  });

  test('a direct view=table link lands on the Table, and the timeline keys survive the switch', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?p=family-6&pace=relaxed&view=table`);
    await expect(tables(page).first()).toBeVisible();
    await expect(view(page).getByRole('radio', { name: 'Table' })).toHaveAttribute('aria-checked', 'true');
    await view(page).getByRole('radio', { name: 'List' }).click();
    await expect(page).toHaveURL(/p=family-6&pace=relaxed&view=day/);
  });

  test('keyboard: arrow keys choose the view, one tab stop, focus stays on the switch', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await view(page).getByRole('radio', { name: 'List' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/view=table/);
    await expect(view(page).getByRole('radio', { name: 'Table' })).toBeFocused();
    await expect(tables(page).first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/view=day/);
    await expect(view(page).getByRole('radio', { name: 'List' })).toBeFocused();
  });

  test('the table is a lazy chunk: the page and the List load none of it, the first Table choice loads it', async ({ page, site }) => {
    const bodies: string[] = [];
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'script') bodies.push(await r.text().catch(() => ''));
    });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(bodies.length).toBeGreaterThan(3);
    expect(bodies.some((b) => b.includes('Print this table'))).toBe(false);
    await view(page).getByRole('radio', { name: 'Table' }).click();
    await expect(tables(page).first()).toBeVisible();
    await expect.poll(() => bodies.some((b) => b.includes('Print this table'))).toBe(true);
  });
});

test.describe('the tables at 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('real table semantics: a caption naming the day, six column headers, the time a row header, and the table list equals the days', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table`);
    const n = await page.locator('li.tl-day').count();
    await expect(tables(page)).toHaveCount(n);
    const day4 = page.locator('#day-4 table');
    await expect(day4.locator('caption')).toContainText(/^DAY 04|^Day 04/i);
    await expect(day4.locator('caption')).toContainText('driving');
    await expect(day4.locator('thead th[scope="col"]')).toHaveText(['Time', 'What', 'Kind', 'Where', 'Takes', 'Notes, book']);
    await expect(day4.locator('thead th:visible')).toHaveCount(6);
    const rows = day4.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(3);
    await expect(rows.first().locator('th[scope="row"]')).toHaveText(/^~?\d\d:\d\d|^about/);
    // every table has its day in the caption, in order
    const caps = await page.locator('table.dt caption').allTextContents();
    caps.forEach((c, i) => expect(c.toLowerCase()).toContain(`day ${String(i + 1).padStart(2, '0')}`));
    // the rows stand in time order
    const times = await day4.locator('tbody th[scope="row"]').allTextContents();
    const clock = times.map((t) => /(\d\d):(\d\d)/.exec(t)).filter(Boolean).map((m) => Number(m![1]) * 60 + Number(m![2]));
    expect(clock).toEqual([...clock].sort((a, b) => a - b));
  });

  test('drives are quiet indented rows with their time and distance in Takes, and Takes never wraps', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?view=table`);
    const leg = page.locator('#day-14 tr[data-leg]', { hasText: /\d km/ }).first();
    await expect(leg.locator('.dt-kind')).toHaveText('drive');
    await expect(leg.locator('.dt-takes')).toHaveText(/\d+ (min|h).*\d+(\.\d)? km/);
    // the duration is one line in every row ("45 min" in two lines was the specimen's fault); a distance may stand under it
    const wraps = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.dt-t, .dt-d')].filter((el) => el.getBoundingClientRect().height > 24 || getComputedStyle(el).whiteSpace !== 'nowrap').length);
    expect(wraps).toBe(0);
  });

  test('a stop links to its place page', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table`);
    const link = page.locator('#day-4 tbody td.dt-what a').first();
    await expect(link).toHaveAttribute('href', /^\/places\/[a-z0-9-]+\/$/);
  });

  test('the head row sticks under the plan bar while a long day scrolls', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table#day-4`);
    await expect(page.locator('#day-4 table')).toBeVisible();
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForTimeout(300);
    const bar = await page.locator('.tl-planbar').boundingBox();
    const th = await page.locator('#day-4 thead th').first().boundingBox();
    expect(bar).not.toBeNull();
    expect(th!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 2);
    expect(th!.y).toBeLessThan(bar!.y + bar!.height + 40);
  });

  test('a day pick on the plan bar scrolls to that day\'s table, and the day in view stays in view when the view changes', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table`);
    await expect(tables(page).first()).toBeVisible();
    await page.locator('.tl-rail-days a[aria-label="Day 6"]').click();
    await expect.poll(() => page.locator('#day-6').evaluate((el) => el.getBoundingClientRect().top), { timeout: 8000 }).toBeLessThan(400);
    await view(page).getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await page.waitForTimeout(600);
    const after = await page.locator('#day-6').evaluate((el) => el.getBoundingClientRect().top);
    expect(after).toBeLessThan(500);
    expect(after).toBeGreaterThan(-200);
  });
});

test.describe('Stops only', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Show Everything | Stops only: fewer rows, no drives, rows=stops in the address, remembered on a reload without it', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?view=table`);
    const group = page.getByRole('radiogroup', { name: 'Rows shown' });
    await expect(group.getByRole('radio', { name: 'Everything' })).toHaveAttribute('aria-checked', 'true');
    const all = await page.locator('#day-1 tbody tr').count();
    await group.getByRole('radio', { name: 'Stops only' }).click();
    await expect(page).toHaveURL(/rows=stops/);
    await expect(page.locator('#day-2 tr[data-leg]')).toHaveCount(0);
    expect(await page.locator('#day-1 tbody tr').count()).toBeLessThanOrEqual(all);
    // remembered per trip on this device
    await page.goto(`${site.url}${DOLOMITES}?view=table`);
    await expect(page.getByRole('radiogroup', { name: 'Rows shown' }).getByRole('radio', { name: 'Stops only' })).toHaveAttribute('aria-checked', 'true');
    // the address wins over the memory
    await page.goto(`${site.url}${DOLOMITES}?view=table&rows=all`);
    await expect(page.getByRole('radiogroup', { name: 'Rows shown' }).getByRole('radio', { name: 'Everything' })).toHaveAttribute('aria-checked', 'true');
    await page.evaluate(() => localStorage.clear());
  });

  test('the public page never says "Editing works in List"', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?view=table`);
    await expect(tables(page).first()).toBeVisible();
    await expect(page.getByText('Editing works in List')).toHaveCount(0);
  });
});

for (const width of [320, 390]) {
  test.describe(`the tables at ${width}`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('three columns, the folded lines show, no sideways scroll, the table uses the full width', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}?view=table`);
      await expect(tables(page).first()).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const day4 = page.locator('#day-4 table');
      await expect(day4.locator('thead th:visible')).toHaveCount(3);
      await expect(day4.locator('thead th:visible')).toHaveText(['Time', 'What', 'Takes']);
      await expect(day4.locator('tbody tr').first().locator('td:visible')).toHaveCount(2);
      await expect(day4.locator('tbody tr').first().locator('.dt-fold').first()).toBeVisible();
      // the card spans the content width: no hugging the left edge
      const box = (await day4.boundingBox())!;
      const card = (await page.locator('#day-4').boundingBox())!;
      expect(box.width).toBeGreaterThan(card.width - 4);
      expect(card.x).toBeLessThan(20);
      expect(card.x + card.width).toBeGreaterThan(width - 20);
      // no row is shorter than a touch target, and a time never wraps
      const rows = await day4.locator('tbody tr').evaluateAll((trs) => trs.map((t) => t.getBoundingClientRect().height));
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(43);
      // a time stays on one line
      expect(await day4.locator('tbody th').first().evaluate((el) => (el.firstChild as HTMLElement | null) && el.getClientRects().length)).toBe(1);
      expect(await day4.locator('tbody th').first().evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      // every day, not only Day 4: nothing pokes out of its card
      const out = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.dt-day')].filter((li) => li.scrollWidth > li.clientWidth + 1).length);
      expect(out).toBe(0);
    });

    test('the switch and the tools are 44 px targets', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}?view=table`);
      await expect(tables(page).first()).toBeVisible();
      for (const loc of [view(page).getByRole('radio', { name: 'Table' }), page.getByRole('radiogroup', { name: 'Rows shown' }).getByRole('radio', { name: 'Stops only' }), page.getByRole('button', { name: 'Print this table' })]) {
        const hit = await loc.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const a = getComputedStyle(el, '::after');
          return { w: Math.max(r.width, parseFloat(a.width) || 0), h: Math.max(r.height, parseFloat(a.height) || 0) };
        });
        expect(hit.h).toBeGreaterThanOrEqual(34);
        expect(hit.w).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

test.describe('the tables at 768', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test('six columns, no sideways scroll', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table`);
    await expect(tables(page).first()).toBeVisible();
    await expect(page.locator('#day-4 thead th:visible')).toHaveCount(6);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('print', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('prints the six columns, hides the switch and the tools, and keeps the List unchanged', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=table`);
    await expect(tables(page).first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#day-4 thead th:visible')).toHaveCount(6);
    await expect(page.locator('.tl-viewbar')).toBeHidden();
    await expect(page.locator('.dt-fold').first()).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await view(page).getByRole('radio', { name: 'List' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.tl-viewbar')).toBeHidden();
    await expect(page.locator('li.tl-day').first()).toBeVisible();
  });
});

test.describe('accessibility', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('axe finds nothing on the Table view, and a phone width does not change that', async ({ page, site }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`${site.url}${DOLOMITES}?view=table`);
      await expect(tables(page).first()).toBeVisible();
      const res = await new AxeBuilder({ page }).include('#trip-panel-days').analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    }
  });
});

// Your own trip: needs the build with NEXT_PUBLIC_TRIP_EDIT=1 (the /t/ route answers 404 without it and these skip)
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
test.describe('your own trip', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    const model = (await (await ctx.get(`${site.url}/api/v1/trips/canadian-rockies-2029/plan-model/`)).json()) as { days: unknown[] };
    days = model.days.length;
    await ctx.dispose();
  });
  const copy = () => ({
    id: ID, slug: 'canadian-rockies-2029', title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
    profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
  });
  async function open(page: Page, site: { url: string }, query: string) {
    const envelope = JSON.stringify({ schema: 'copies/1', items: [copy()], noteSeen: null, snoozedUntil: null, merged: {} });
    await page.addInitScript((v) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('travel.copies.local', v);
    }, envelope);
    await page.goto(`${site.url}/t/${ID}/${query}`);
  }

  test('read mode: the Table works as on the public page, with no edit line', async ({ page, site }) => {
    await open(page, site, '?view=table');
    await expect(tables(page)).toHaveCount(days);
    await expect(page.getByTestId('table-edit-line')).toHaveCount(0);
    await view(page).getByRole('radio', { name: 'List' }).click();
    await expect(page).toHaveURL(/view=day/);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
  });

  test('edit mode: the Table is read-only and says "Editing works in List" once, with a button that switches to List', async ({ page, site }) => {
    await open(page, site, '?edit=1&view=table');
    await expect(tables(page)).toHaveCount(days);
    const line = page.getByTestId('table-edit-line');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText('Editing works in List');
    // read-only: no handle, no row menu, no add row in the table
    await expect(page.locator('table.dt .tl-edit-handle, table.dt .tl-edit-trail, table.dt .tl-add-open')).toHaveCount(0);
    await line.getByRole('button', { name: 'Switch to List' }).click();
    await expect(page).toHaveURL(/view=day/);
    await expect(page).toHaveURL(/edit=1/);
    await expect(tables(page)).toHaveCount(0);
    await expect(page.locator('li.tl-day').first().locator('.tl-edit-trail').first()).toBeVisible();
    await expect(page.getByTestId('table-edit-line')).toHaveCount(0);
  });
});
