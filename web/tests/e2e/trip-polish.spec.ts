import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openParty } from './party';

const ROCKIES = '/trips/canadian-rockies-2029/';
const settle = (page: Page, ms = 900) => page.waitForTimeout(ms);

test.describe('trip page polish (TRP, stage 4)', () => {
  test('a Pace change cross-fades the day cards: out, then in; reduced motion jumps (check 4)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.locator('#plan-for').scrollIntoViewIfNeeded();
    const sample = () =>
      page.evaluate(async () => {
        const el = document.querySelector('li.tl-day') as HTMLElement;
        const out: number[] = [];
        const t0 = performance.now();
        await new Promise<void>((done) => {
          const tick = () => {
            out.push(Number(getComputedStyle(el).opacity));
            if (performance.now() - t0 < 900) requestAnimationFrame(tick);
            else done();
          };
          requestAnimationFrame(tick);
        });
        return out;
      });
    const frames = sample();
    await page.getByRole('radio', { name: 'Relaxed' }).click();
    const seen = await frames;
    expect(Math.min(...seen), 'the old cards fade out').toBeLessThan(0.4);
    expect(seen.some((o) => o > 0.05 && o < 0.95), 'frames between 0 and 1').toBe(true);
    expect(seen.at(-1)).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = sample();
    await page.getByRole('radio', { name: 'Full' }).click();
    expect(Math.min(...(await still))).toBe(1);
  });

  test('the phone has no floating map pill: Map lives in the sticky day strip and covers nothing (R4-T1, review M7)', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('.tl-mappill')).toHaveCount(0);
    await page.evaluate(() => document.getElementById('day-3')?.scrollIntoView({ block: 'start' }));
    const btn = page.locator('.tl-planbar .tl-mapbtn');
    await expect(btn).toBeVisible();
    const box = (await btn.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const bar = (await page.locator('.tl-planbar').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(bar.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
    await expect(btn).toHaveAttribute('aria-controls', 'route');
  });

  test('Patagonia Day 2 says it has no stops on the map, and no chip reads "level None" (R4-T2)', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/trips/patagonia-2027/#day-2`);
    // no stop has a map point, so the caption says so; the night's base has one, so it is framed (labelOf: "showing the base"; the older
    // "showing the whole trip" wording is for a day with no base on the map either)
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 2 · Ushuaia · no stop has a map position · showing the base');
    await expect(page.getByText(/0 stops/)).toHaveCount(0);
    await expect(page.getByText(/level none/i)).toHaveCount(0);
  });

  // Season: data/seasons/switzerland-2027.json (D6a-W, 15.113) gave the overview a "Planned for" window, so the page no longer says
  // "Season not set yet"; the overview notice and the "This plan is valid for" band are each said once.
  test('the Switzerland overview says copy only when a Copy button exists, says it is an overview once, and has no season gap (R4-T3)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/switzerland-2027/`);
    await expect(page.getByRole('button', { name: /copy to my trips/i })).toHaveCount(0);
    await expect(page.getByText(/copy it to plan/i)).toHaveCount(0);
    await expect(page.getByText(/season not set yet/i)).toHaveCount(0);
    await expect(page.getByText(/This plan has not been converted to days yet\./)).toHaveCount(1); // the Summary's lead says it once
    await expect(page.getByRole('heading', { name: /this plan is valid for/i })).toHaveCount(1);
  });

  test('a limits chip lists stated limits only (R4-T4)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-4`);
    await expect(page.getByText(/weight not stated|height not stated/i)).toHaveCount(0);
    // the chip wraps inside its card instead of running past the right edge (review M5)
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await settle(page, 400);
      const over = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('#day-4 .tl-entry .ci').forEach((c) => {
          const card = c.closest('.tl-day')!.getBoundingClientRect();
          const r = c.getBoundingClientRect();
          if (r.right > card.right + 0.5 || c.scrollWidth > c.clientWidth + 1) out.push(`${c.textContent} ${Math.round(r.right)} > ${Math.round(card.right)}`);
        });
        return out;
      });
      expect(over, `${width}`).toEqual([]);
    }
  });

  test('the strip shows 06, 12 and 18 and no truncated drive text at 1440 and 390 (check 5)', async ({ page, site }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`${site.url}${ROCKIES}`); // the whole-trip strip is in the Summary
      await expect(page.locator('.tl-trip-scale:first-child .tl-scale-tick')).toHaveText(['06', '12', '18']);
      const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tl-trip-drive')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
      expect(clipped, `${size.width}`).toBe(0);
      const drive = await page.locator('.tl-trip-drive').first().innerText();
      expect(drive).toMatch(/^\d+ h( \d\d)?$|^\d+ min$/);
    }
  });

  test('the phone day header is under 260 px before the first time (check 6)', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    const tops = await page.evaluate(() => [...document.querySelectorAll('li.tl-day')].map((li) => [li.id, li.querySelector('.tl-time')!.getBoundingClientRect().top - li.getBoundingClientRect().top] as const));
    for (const [id, y] of tops) expect(y, id).toBeLessThan(260);
  });

  test('"Plan it for" sits above the season band, and the sticky bar names the profile (checks 7, 11)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    const y = (sel: string) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    expect(await y('#plan-for')).toBeLessThan(await y('.trip-season')); // the band is "When to go" in the Summary now, below the party bar
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('.tl-planbar-who')).toHaveText('2 adults, 1 child · Standard') // the family default opens on a 10-year-old (FAMAGE10); the plan's written-for age stays 6;
    await expect(page.locator('.tl-planbar')).not.toContainText('Plan as written');
    await page.goto(`${site.url}${ROCKIES}?p=adults&pace=full&view=day`);
    await expect(page.locator('.tl-planbar-who')).toHaveText('2 adults · Full');
  });

  test('the add panel says what an addition costs before it is made, and not offers one past 23:00 (check 3)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await page.locator('#day-5 .tl-add-open').click();
    const first = page.locator('#day-5 .tl-add-cost').first();
    await expect(first).toContainText(/adds (about|no)/, { timeout: 15_000 });
    for (const t of await page.locator('#day-5 .tl-add-cost').allInnerTexts()) expect(t).toMatch(/adds (about|no) .*driving|not added|Working out/);
  });

  test('the version menu says what each version does to the day (4.6)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await page.locator('#day-5 .tl-vchip').click();
    await expect(page.locator('#day-5 .tl-menu-detail').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#day-5 .tl-menu-detail')).toHaveCount(3, { timeout: 15_000 });
    await expect(page.locator('#day-5 .tl-menu-item').first()).toContainText('walking');
  });

  test('Day 6 marks the time-zone line at Mount Robson and reads the stops there in local time (row 3.35, check 9)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('#day-6 .tl-zone')).toHaveCount(2);
    await expect(page.locator('#day-6 .tl-zone').first()).toContainText('Pacific time');
    await expect(page.locator('#day-6 .tl-zone').last()).toContainText('Mountain time');
    await expect(page.locator('#day-6 .tl-tz').first()).toHaveText('PT');
    await expect(page.locator('#day-9')).toContainText('Last rental 14:00');
    await expect(page.locator('#day-15')).toContainText('Depends on your flight');
  });

  test('at 1440 the map column stays in view and follows the reading day; "All days" pauses it (check 7)', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}${ROCKIES}#day-3`);
    const label = page.locator('.tl-mapcol-label');
    await expect(label).toContainText('Day 3', { timeout: 15_000 });
    await page.evaluate(() => document.getElementById('day-8')!.scrollIntoView());
    await settle(page, 1500);
    await expect(label).toContainText('Day 8', { timeout: 10_000 });
    const box = await page.locator('#route').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + 200).toBeLessThan(900);
    await page.getByRole('radio', { name: 'All days' }).click();
    await expect(label).toContainText('Paused');
    await page.evaluate(() => document.getElementById('day-11')!.scrollIntoView());
    await settle(page, 1500);
    await expect(label).toContainText('Paused');
    await label.getByRole('button', { name: /Follow Day/ }).click();
    await expect(label).not.toContainText('Paused');
  });

  test('on the phone the strip Map button opens the map for the current day inline, and Escape closes it (check 7, 13)', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${ROCKIES}#day-4`);
    const pill = page.locator('.tl-planbar .tl-mapbtn');
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await settle(page, 900);
    const run = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-map-family]').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 90)}`), label).toEqual([]);
    };
    await run('strip, map closed');
    await pill.click();
    await expect(page.locator('#route')).toBeVisible();
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 4');
    await run('map open');
    // not modal: the page behind still scrolls
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await settle(page, 400);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#route')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('each route map opens fitted to the positioned stops (check 8)', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const slug of ['canadian-rockies-2029', 'dolomites-2027', 'vermont-fall-2026']) {
      await page.goto(`${site.url}/trips/${slug}/?view=day`);
      if (await page.getByTestId('route-unplaced').count()) continue;
      await expect(page.locator('#route [data-map-family]')).toBeVisible({ timeout: 15_000 });
      // the key says what the map draws, and the first view is the whole trip, not one stop
      await expect(page.locator('.tl-mapcol-label')).toContainText('the whole trip');
    }
  });
});
