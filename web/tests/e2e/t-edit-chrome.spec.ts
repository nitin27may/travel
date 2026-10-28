import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-UI1: the phone edit bar holds Undo and Redo (components 8.6, 360 and 390 wide), and on a laptop the day strip keeps every day
// while the edit tools take a second line below 1600 px (patterns 3.13 item 4). Needs the build with NEXT_PUBLIC_TRIP_EDIT=1.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();

test.describe('edit chrome by width', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }) {
    await page.addInitScript((kv) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(kv.k, kv.v);
    }, { k: COPIES_KEY, v: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('.tl-edit-trail').first()).toBeVisible();
  }

  for (const width of [360, 390]) {
    test(`phone ${width}: Undo and Redo stay in the edit bar after the toast is gone`, async ({ page, site }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page, site);
      const bar = page.locator('.edit-bar');
      const undo = bar.getByRole('button', { name: /^Undo/ });
      const redo = bar.getByRole('button', { name: /^Redo/ });
      await expect(undo).toBeDisabled();
      await expect(redo).toBeDisabled();
      const before = await titles(page, 1);
      await page.locator('#day-1 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
      await page.getByRole('menuitem', { name: 'Remove from Day 1' }).click();
      await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
      await expect(page.locator('.toast')).toHaveCount(0, { timeout: 12_000 });
      await expect(undo).toBeEnabled();
      await expect(undo).toHaveAttribute('aria-label', /^Undo: Removed/);
      // all four controls fit the bar: 44 px wide at least, inside the viewport, none over another
      const boxes = [];
      for (const b of [undo, redo, bar.getByRole('button', { name: 'Settings' }), bar.getByRole('button', { name: 'Done' })]) {
        const r = await b.boundingBox();
        expect(r).not.toBeNull();
        expect(r!.width).toBeGreaterThanOrEqual(44);
        expect(r!.height).toBeGreaterThanOrEqual(44);
        expect(r!.x).toBeGreaterThanOrEqual(0);
        expect(r!.x + r!.width).toBeLessThanOrEqual(width);
        boxes.push(r!);
      }
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width + 7);
      await undo.click();
      await expect.poll(() => titles(page, 1)).toEqual(before);
      await expect(redo).toBeEnabled();
      await expect(undo).toBeDisabled();
    });
  }

  // ER-022: the tools share the strip's line when every day and every tool fit there, measured, not a breakpoint; else a second line.
  // The 15-day Rockies copy: 1280 has no room (second line); 1440 and 1760 do once the party words step aside (Settings owns them).
  for (const [width, want] of [[1280, 'below'], [1440, 'bare'], [1760, 'bare']] as const) {
    test(`laptop ${width}: every day shows and the tools sit ${want === 'below' ? 'on a second line' : 'on the strip\'s line'}`, async ({ page, site }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, site);
      const bar = page.locator('.tl-planbar');
      await expect(bar).toHaveAttribute('data-tools', want);
      const rail = page.locator('.tl-planbar .tl-rail-days');
      expect(await rail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      expect(await rail.locator('li').count()).toBe(days);
      expect(await rail.locator('li[data-edge]').count()).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      const b = (await bar.boundingBox())!;
      const tools = (await page.locator('.tl-planbar .edit-tools').boundingBox())!;
      const r = (await rail.boundingBox())!;
      expect(tools.x + tools.width).toBeLessThanOrEqual(width);
      expect(tools.y + tools.height).toBeLessThanOrEqual(b.y + b.height + 1);
      if (want === 'below') expect(tools.y).toBeGreaterThanOrEqual(r.y + r.height - 1);
      else {
        expect(Math.abs(tools.y + tools.height / 2 - (r.y + r.height / 2))).toBeLessThan(6);
        expect(tools.x).toBeGreaterThanOrEqual(r.x + r.width);
        expect(b.height).toBeLessThan(70);
        // Export (its menu loads after the first paint) sits on the same line, centred with the tools
        const exp = page.locator('.tl-planbar-export button').first();
        await expect(exp).toBeVisible();
        const e = (await exp.boundingBox())!;
        expect(Math.abs(e.y + e.height / 2 - (tools.y + tools.height / 2))).toBeLessThan(6);
        expect(e.x + e.width).toBeLessThanOrEqual(width);
      }
      // the quiet sync word is in the cover meta, not the sticky row
      await expect(page.locator('.tl-planbar .own-sync')).toHaveCount(0);
      await expect(page.locator('.own-state .own-sync')).toHaveText('On this device');
    });
  }

  test('768: a day cut by the strip edge is not drawn, and the last whole day before more days is dimmed', async ({ page, site }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, site);
    await page.waitForTimeout(600);
    const rail = page.locator('.tl-planbar .tl-rail-days');
    const seen = await rail.evaluate((box) => {
      const b = box.getBoundingClientRect();
      return [...box.querySelectorAll('li')].map((li) => {
        const r = li.getBoundingClientRect();
        const cell = li.querySelector('a')!;
        const cut = r.right > b.left + 1 && r.left < b.right - 1 && (r.left < b.left - 1 || r.right > b.right + 1);
        return { cut, edge: li.dataset.edge ?? null, opacity: Number(getComputedStyle(cell).opacity) };
      });
    });
    expect(seen.some((c) => c.edge === 'dim')).toBe(true);
    for (const c of seen) if (c.cut) expect(c.opacity).toBe(0);
  });

  test('the public sticky row is unchanged: no tools, one line at 1440', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/trips/${SLUG}/?view=day`);
    await expect(page.locator('.tl-planbar')).toBeVisible();
    expect(await page.locator('.tl-planbar-tools').count()).toBe(0);
    expect((await page.locator('.tl-planbar').boundingBox())!.height).toBeLessThan(70);
  });
});
