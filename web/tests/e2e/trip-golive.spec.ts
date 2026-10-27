import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// TRP-GL: the trip page's "before go-live" fixes that show on paper and in the timeline (MUST-6 print, N2, N3). The map-key fixes (N1, N4)
// are asserted in trip-routes.spec.ts, which has the stand-in Google build.
const DOLOMITES = '/trips/dolomites-2027/';
const ROCKIES = '/trips/canadian-rockies-2029/';

/** What Print puts on the paper: the print view's text and its day sections, taken when the browser is asked to print. */
async function printed(page: Page, url: string) {
  await page.addInitScript(() => {
    (window as unknown as { __printed: unknown[] }).__printed = [];
    window.print = () => {
      const view = document.querySelector('[data-testid="trip-print-view"]');
      (window as unknown as { __printed: unknown[] }).__printed.push({
        text: view?.textContent ?? '',
        sections: [...(view?.querySelectorAll('section.print-model-day') ?? [])].map((s) => s.textContent ?? ''),
        book: view?.querySelector('section.print-model-book')?.textContent ?? null,
        // the park lines (PA-W) sit above the rows; the Book ahead section is the first section after them
        bookFirst: view?.querySelector('h1 ~ section:not(.print-model-parks)')?.classList.contains('print-model-book') ?? false,
      });
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.locator('.trip-cover').getByRole('button', { name: 'Export trip', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Print or save as PDF' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: unknown[] }).__printed.length)).toBe(1);
  return (await page.evaluate(() => (window as unknown as { __printed: { text: string; sections: string[]; book: string | null; bookFirst: boolean }[] }).__printed))[0]!;
}

test.describe('trip page go-live fixes', () => {
  test('N2: the Dolomites travel day prints the break and the arrival with their times', async ({ page, site }) => {
    const p = await printed(page, `${site.url}${DOLOMITES}?p=family-6#day-14`);
    const day = p.sections.find((s) => s.startsWith('Day 14:'))!;
    expect(day).toBeTruthy();
    expect(day).toContain('12:00');
    expect(day).toContain('At the airport');
    expect(day).toMatch(/Stretch break/);
    expect(day).toMatch(/Drive to /);
    expect(day).toMatch(/Drive on · /); // P1: the second half does not repeat the destination
    expect(day).not.toMatch(/Drive on to /);
  });

  test('MUST-6: the Rockies and Dolomites prints have a Book ahead section after the meta line, before Day 1; Dolomites words its windows dateless', async ({ page, site }) => {
    const r = await printed(page, `${site.url}${ROCKIES}?p=family-6#day-8`);
    expect(r.book, 'a Book ahead section').toBeTruthy();
    expect(r.bookFirst).toBe(true);
    expect(r.book).toMatch(/^Book ahead/);
    expect(r.book).not.toMatch(/INFERENCE|\bGAP\b|no booking expected/i);
    expect(r.text.indexOf('Book ahead')).toBeLessThan(r.text.indexOf('Day 1: '));
  });

  test('MUST-6: Dolomites prints each booking\'s rule, dateless', async ({ page, site }) => {
    const d = await printed(page, `${site.url}${DOLOMITES}?p=family-6#day-3`);
    expect(d.book).toMatch(/Opens \d+ days? (before Day \d+|ahead)/);
    expect(d.book).not.toMatch(/\b(19|20)\d\d\b/);
  });

  test('N3: a split drive says its distance once, as the whole drive\'s, never twice', async ({ page, site }) => {
    await page.goto(`${site.url}${DOLOMITES}?p=family-6#day-14`);
    const legs = page.locator('#day-14 li.tl-leg');
    await expect(legs.first()).toBeVisible();
    const texts = await legs.evaluateAll((els) => els.map((e) => (e.querySelector('.tl-leg-text > span:last-child')?.textContent ?? '').replace(/\s+/g, ' ')));
    const withKm = texts.filter((t) => /\d[\d.,]*\s?(mi|km)\b/.test(t));
    const halves = texts.filter((t) => /Drive/.test(t));
    expect(halves.length).toBeGreaterThanOrEqual(2);
    expect(withKm.length).toBe(1);
    expect(withKm[0]).toMatch(/to Venice Marco Polo Airport · [\d.,]+ (mi|km) in all$/);
  });
});
