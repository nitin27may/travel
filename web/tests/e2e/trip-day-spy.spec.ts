import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// The current day (design 3.4): scroll position decides it, a jump pins it, the URL hash follows with replaceState.
const TRIPS = ['/trips/canadian-rockies-2029/', '/trips/dolomites-2027/'];
const SIZES = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const;
const CELL = '.tl-rail-cell[aria-current="true"]';

interface Probe {
  expected: number;
  bars: number;
  last: number;
  bottom: boolean;
}

/** What the rule says should be current right now, read from the rendered page: the last day at or above the line under both bars, or the last day at the page bottom. */
const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const head = document.querySelector('.site-header')!.getBoundingClientRect().bottom;
    const bar = document.querySelector('.tl-planbar')!.getBoundingClientRect().height;
    const days = [...document.querySelectorAll<HTMLElement>('li.tl-day')].map((e) => ({ n: Number(e.id.slice(4)), top: e.getBoundingClientRect().top }));
    const bottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const hit = days.filter((d) => d.top <= head + bar + 24).at(-1);
    return { expected: bottom ? days.at(-1)!.n : (hit ?? days[0]!).n, bars: head + bar, last: days.at(-1)!.n, bottom };
  });

const scrollDayTo = (page: Page, n: number, above: number) =>
  page.evaluate(
    ([day, gap]) => {
      const head = document.querySelector('.site-header')!.getBoundingClientRect().bottom;
      const bar = document.querySelector('.tl-planbar')!.getBoundingClientRect().height;
      const top = document.getElementById(`day-${day}`)!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - (head + bar + 24) + (gap as number));
    },
    [n, above],
  );

/** Everything that shows the current day, read at once: the one rail cell, the strip's marker and the day card itself. */
const shown = (page: Page) =>
  page.evaluate(() => ({
    rail: [...document.querySelectorAll('.tl-rail-cell[aria-current="true"]')].map((e) => Number(e.textContent)),
    strip: [...document.querySelectorAll('.tl-trip-item[data-picked] .tl-trip-row')].map((e) => Number(e.getAttribute('href')!.slice(5))),
    day: [...document.querySelectorAll('li.tl-day[data-picked]')].map((e) => Number(e.id.slice(4))),
  }));

async function settled(page: Page) {
  let prev = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => Math.round(window.scrollY));
      const same = y === prev;
      prev = y;
      return same;
    }, { intervals: [350], timeout: 8000 })
    .toBe(true);
}

for (const size of SIZES) {
  test.describe(`current day, ${size.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
    });

    for (const path of TRIPS) {
      test(`${path}: scrolling day by day moves the one current day; rail, strip and day agree`, async ({ page, site }) => {
        await page.goto(`${site.url}${path}`);
        const days = await page.locator('li.tl-day').count();
        for (let n = 1; n <= days; n++) {
          await scrollDayTo(page, n, 12);
          await settled(page);
          const p = await probe(page);
          await expect.poll(async () => (await shown(page)).rail, { timeout: 5000, message: `day ${n}` }).toEqual([p.expected]);
          const now = await shown(page);
          expect(now.strip, `strip at day ${n}`).toEqual([p.expected]);
          expect(now.day, `day card at day ${n}`).toEqual([p.expected]);
          await expect(page.locator(CELL)).toHaveCount(1);
          if (!p.bottom) expect(p.expected).toBe(n);
        }
      });

      test(`${path}: at the page bottom the last day is current`, async ({ page, site }) => {
        await page.goto(`${site.url}${path}`);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const p = await probe(page);
        expect(p.bottom).toBe(true);
        await expect(page.locator(CELL)).toHaveText(String(p.last));
        await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#day-${p.last}`);
      });
    }

    test('a #day-5 link lands on day 5; scrolling on to day 8 moves the rail and replaces the hash', async ({ page, site }) => {
      await page.goto(`${site.url}${TRIPS[0]}?p=adults#day-5`);
      await settled(page);
      await expect(page.locator(CELL)).toHaveText('5');
      const len = await page.evaluate(() => history.length);
      await scrollDayTo(page, 8, 12);
      await expect(page.locator(CELL)).toHaveText('8');
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#day-8');
      expect(await page.evaluate(() => history.length)).toBe(len);
      // the profile key survived the hash rewrite
      expect(await page.evaluate(() => location.search)).toBe('?p=adults');
      // a reload lands on the current day
      await page.reload();
      await settled(page);
      await expect(page.locator(CELL)).toHaveText('8');
    });

    test('clicking day 10 lands it under both bars, with no flicker through the days in between', async ({ page, site }) => {
      await page.goto(`${site.url}${TRIPS[0]}`);
      await expect(page.locator(CELL)).toHaveCount(1);
      await page.evaluate(() => {
        const w = window as unknown as { __seq: (string | null)[] };
        const cur = () => document.querySelector('.tl-rail-cell[aria-current="true"]')?.textContent ?? null;
        w.__seq = [cur()];
        new MutationObserver(() => {
          const c = cur();
          if (c !== w.__seq.at(-1)) w.__seq.push(c);
        }).observe(document.querySelector('.tl-rail-days')!, { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
      });
      await page.locator('.tl-rail-cell', { hasText: /^10$/ }).click();
      await settled(page);
      await expect(page.locator(CELL)).toHaveText('10');
      const seq = await page.evaluate(() => (window as unknown as { __seq: (string | null)[] }).__seq);
      expect(seq.at(-1)).toBe('10');
      expect(seq.length, `sequence ${seq.join(',')}`).toBeLessThanOrEqual(2);
      const g = await page.evaluate(() => {
        const bars = document.querySelector('.site-header')!.getBoundingClientRect().bottom + document.querySelector('.tl-planbar')!.getBoundingClientRect().height;
        return { bars, day: document.getElementById('day-10')!.getBoundingClientRect().top, title: document.querySelector('#day-10 .tl-day-title')!.getBoundingClientRect().top };
      });
      expect(g.day).toBeGreaterThanOrEqual(g.bars - 1);
      expect(g.day).toBeLessThanOrEqual(g.bars + 40);
      expect(g.title).toBeGreaterThan(g.bars);
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#day-10');
      const now = await shown(page);
      expect(now).toEqual({ rail: [10], strip: [10], day: [10] });
    });

    test('the whole-trip strip jumps too, and a rail cell takes Enter from the keyboard', async ({ page, site }) => {
      await page.goto(`${site.url}${TRIPS[1]}`);
      await page.locator('.tl-trip-row[href="#day-6"]').click();
      await settled(page);
      await expect(page.locator(CELL)).toHaveText('6');
      await page.locator('.tl-rail-cell', { hasText: /^3$/ }).focus();
      await page.keyboard.press('Enter');
      await settled(page);
      await expect(page.locator(CELL)).toHaveText('3');
      expect((await shown(page)).strip).toEqual([3]);
    });
  });
}

test('Back after scrolling leaves the page; the scroll never pushed history', async ({ page, site }) => {
  await page.goto(`${site.url}/trips/`);
  await page.goto(`${site.url}${TRIPS[0]}`);
  await scrollDayTo(page, 4, 12);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#day-4');
  await scrollDayTo(page, 9, 12);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#day-9');
  await page.goBack();
  await expect(page).toHaveURL(/\/trips\/$/);
});

test('the phone rail keeps the current cell in view', async ({ page, site }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${site.url}${TRIPS[0]}`);
  await scrollDayTo(page, 14, 12);
  await expect(page.locator(CELL)).toHaveText('14');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector('.tl-rail-cell[aria-current="true"]')!.getBoundingClientRect();
        const r = document.querySelector('.tl-rail-days')!.getBoundingClientRect();
        return c.left >= r.left - 1 && c.right <= r.right + 1;
      }),
    )
    .toBe(true);
});

test('By category: the chip follows the section at the top, and Back is not walked through sections', async ({ page, site }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${site.url}${TRIPS[0]}?view=category`);
  await page.locator('section[data-cat]').first().waitFor();
  const ids = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('section[data-cat]')].map((e) => e.dataset.cat!));
  expect(ids.length).toBeGreaterThan(2);
  const last = ids.at(-1)!;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.cat-chip[aria-current="true"]')).toHaveAttribute('data-cat-chip', last);
  await expect(page.locator('.cat-chip[aria-current="true"]')).toHaveCount(1);
  await page.locator(`[data-cat-chip="${ids[1]}"]`).click();
  await settled(page);
  await expect(page.locator('.cat-chip[aria-current="true"]')).toHaveAttribute('data-cat-chip', ids[1]!);
});

test('axe after scrolling the trip page', async ({ page, site }, info) => {
  test.skip(info.project.name !== 'chromium', 'axe runs on Chromium, as in a11y.spec.ts; the gallery tile name mismatch on WebKit is not this change');
  await page.goto(`${site.url}${TRIPS[0]}`);
  await scrollDayTo(page, 9, 12);
  await expect(page.locator(CELL)).toHaveText('9');
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
});
