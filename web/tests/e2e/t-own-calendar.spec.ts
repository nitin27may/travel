import { readFileSync } from 'node:fs';
import type { Download, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Review STEP2-PRV PR-011 and PR-012: Mine's Add to calendar and the copy's cover Add to calendar give the same file (same UIDs, same events),
// made from the person's own days, and a stop whose Directions go to a car park with an address (Lake Louise, Wedge Pond in the C versions
// of Days 10 and 14) carries it as ICS LOCATION and on its print line. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1
// PW_SITE_URL=<that server> playwright test t-own-calendar (alone, on a free port). With the flag off /t/ answers 404 and every test skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: { '10': 'C', '14': 'C' }, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

/** The VEVENTs of a file, unfolded, as UID -> the event's text with DTSTAMP dropped (it is the moment the file was made). */
function events(text: string): Map<string, string> {
  const lines = text.replace(/\r\n[ \t]/g, '').split('\r\n');
  const out = new Map<string, string>();
  let cur: string[] | null = null;
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = [];
    else if (l === 'END:VEVENT' && cur) {
      const uid = cur.find((x) => x.startsWith('UID:'))!.slice(4);
      out.set(uid, cur.filter((x) => !x.startsWith('DTSTAMP:')).join('\n'));
      cur = null;
    } else cur?.push(l);
  }
  return out;
}
const read = async (d: Download) => readFileSync((await d.path())!, 'utf8');

test.describe('the own trip calendar (PR-011, PR-012)', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  const seed = (page: Page) =>
    page.addInitScript(([k, v]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k!, v!);
    }, [COPIES_KEY, envelope([copy(days)])]);

  test('Mine\'s Add to calendar and the cover\'s give the same file: the same UIDs and events, timed, with the car park address as LOCATION', async ({ page, site }) => {
    await seed(page);
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Canadian Rockies' }).click();
    const [fromMine] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('menuitem', { name: /Add to calendar/ }).click()]);
    // Mine opened the copy and its page made the file (the hand-off is read once: a reload downloads nothing)
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/`));
    await expect(page.locator('.toast-region')).toContainText(`Downloaded ${SLUG}.ics`);
    const mine = events(await read(fromMine));
    const [fromCover] = await Promise.all([page.waitForEvent('download'), page.locator('.trip-actions').getByRole('button', { name: 'Add to calendar' }).click()]);
    const cover = events(await read(fromCover));
    expect([...mine.keys()].sort()).toEqual([...cover.keys()].sort());
    for (const [uid, ev] of cover) expect(mine.get(uid), uid).toBe(ev);
    // the person's own days, not the published plan's 15 all-day events alone
    const timed = [...cover.values()].filter((e) => /^DTSTART;TZID=|^DTSTART:\d{8}T/m.test(e));
    expect(timed.length).toBeGreaterThan(30);
    // PR-012: the access-point address reaches LOCATION, named and with "near"
    const located = [...cover.values()].filter((e) => /^LOCATION:.*near Lake Louise Drive/m.test(e) || /^LOCATION:.*Wedge Pond parking/m.test(e));
    expect(located.length).toBeGreaterThan(0);
    for (const e of located) expect(e).toMatch(/^GEO:-?\d+(\.\d+)?;-?\d+(\.\d+)?$/m);
    let again = false;
    page.on('download', () => (again = true));
    await page.reload();
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(again).toBe(false);
  });

  test('the print of the copy carries the address line of the car park stops', async ({ page, site }) => {
    await seed(page);
    await page.goto(`${site.url}/t/${ID}/?view=day`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __printed: string[] }).__printed = [];
      window.print = () => (window as unknown as { __printed: string[] }).__printed.push(document.querySelector<HTMLElement>('[data-testid="trip-print-view"]')?.innerText ?? '');
    });
    await page.locator('.trip-actions').getByRole('button', { name: /Export trip/ }).click();
    await page.getByRole('menuitem', { name: /Print or save as PDF/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed.length)).toBeGreaterThan(0);
    const text = (await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed[0]))!;
    expect(text).toMatch(/Lake Louise Lakeshore parking, near Lake Louise Drive/);
    expect(text).toMatch(/Wedge Pond parking, near /);
  });
});
