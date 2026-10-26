import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/;

test.describe('trips list', () => {
  test('keeps cards, pills, the four views and the map camera in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await expect(page.locator('.card').first()).toBeVisible();
    for (const name of ['Where', 'When', 'Length', 'Youngest child']) await expect(page.getByRole('button', { name })).toBeVisible();
    for (const v of ['Cards', 'List', 'Table', 'Map']) await expect(page.getByRole('radio', { name: v })).toBeVisible();
    // every public trip reads as a published plan: no finished group, no done marker (PRIV-TD)
    await expect(page.getByRole('heading', { name: 'Finished plans, use as templates' })).toHaveCount(0);
    await expect(page.locator('[data-trip-done]')).toHaveCount(0);
    await expect(page.locator('.card').first().getByRole('link', { name: 'Public page' })).toHaveAttribute('href', /\/trips\/[a-z0-9-]+\/$/);
    expect(await page.locator('main').innerText()).not.toMatch(DATE);
    await page.goto(`${site.url}/trips/?view=map&c=12.1,46.5,7`);
    await expect(page.locator('[data-map-family="maplibre"]')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('view=map');
    expect(page.url()).toMatch(/c=12\.1/);
  });
  test('sort writes sort and dir', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/?sort=nights&dir=desc`);
    await expect(page.locator('.card').first()).toBeVisible();
    expect(page.url()).toContain('dir=desc');
  });
});

test.describe('trip page', () => {
  test('Dolomites: 14 day timelines in order; the Stops tab has six chips and picking one regroups', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/?view=day`);
    const rows = page.locator('li.tl-day');
    await expect(rows).toHaveCount(14);
    expect(await rows.evaluateAll((els) => els.map((e) => e.id))).toEqual(Array.from({ length: 14 }, (_, i) => `day-${i + 1}`));
    await expect(page.locator('.cat-chip')).toHaveCount(0); // the chips live in the Stops tab, which is not loaded yet
    await page.getByRole('tab', { name: /^Stops/ }).click();
    const chips = page.locator('.cat-chip');
    await expect(chips).toHaveCount(6);
    expect(await chips.allInnerTexts()).toEqual(['Stays\n4', 'Trails\n10', 'Sights\n11', 'Activities\n3', 'Food\n2', 'Logistics\n7']);
    expect(await page.locator('main').innerText()).not.toMatch(DATE);
    await chips.nth(1).click();
    await expect(page).toHaveURL(/view=all#trails/);
    await expect(page.getByRole('heading', { name: /^Trails/ })).toBeVisible();
    await page.goBack();
    await page.goBack();
    await expect(page.locator('li.tl-day').first()).toBeVisible();
  });
  test('anchors #day-3 and #stays work on load', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-3`);
    await expect(page.locator('#day-3')).toBeVisible();
    await expect(page.locator('#day-3 .tl-rail')).toBeVisible();
    await page.goto(`${site.url}/trips/dolomites-2027/#stays`);
    await expect(page.getByRole('heading', { name: /^Stays/ })).toBeVisible();
  });
  test('Rockies day 5 has a version menu, not a Track A, B, C segment on the day', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/#day-5`);
    await expect(page.getByRole('radiogroup', { name: 'Day 5 options' })).toHaveCount(0);
    await expect(page.locator('#day-5').getByRole('button', { name: /Version of Day 5/ })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Who is going' })).toBeVisible();
  });
  test('summary and overview trips are labelled', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/patagonia-2027/?view=day`);
    await expect(page.getByText('Condensed from the full plan').first()).toBeVisible();
    await page.goto(`${site.url}/trips/switzerland-2027/`);
    // an overview with a season (D6a-W) shows the season band and the "not converted" banner; the no-season notice is for an overview with none
    await expect(page.getByText('This plan has not been converted to days yet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This plan is valid for' })).toBeVisible();
    await expect(page.getByText('Last week of July to the second week of August').first()).toBeVisible();
    await expect(page.getByText('Overview only. No days and no season are written down yet')).toHaveCount(0);
    // a plan-only window says so: the hero stat, one line in the band and the strip's name (D6a-W review M2)
    await expect(page.locator('.trip-glance dt', { hasText: 'Planned for' })).toBeVisible();
    await expect(page.locator('.trip-glance dt', { hasText: 'Valid for' })).toHaveCount(0);
    await expect(page.getByText('The window this plan was written for. Other months and opening dates have not been checked yet.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Months this plan covers: July, August' })).toBeVisible();
    await expect(page.locator('.cat-chip')).toHaveCount(0);
    await expect(page.getByText('Season not set yet')).toHaveCount(0);
  });
  test('no horizontal scroll at 390 and axe is clean', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/trips/', '/trips/dolomites-2027/', '/trips/dolomites-2027/?view=day', '/trips/dolomites-2027/?view=all', '/trips/switzerland-2027/']) {
      await page.goto(`${site.url}${path}`);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-map-family]').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`), path).toEqual([]);
    }
  });
  test('the season chip is readable whole on every list card and on the map card (D6a-W: no clipped season)', async ({ page, site }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${site.url}/trips/?view=cards`);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll('.chip')].filter((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > (c.closest('li, article')?.getBoundingClientRect().right ?? 1e9) + 1).map((c) => c.textContent),
      );
      expect(clipped, `cards at ${width}`).toEqual([]);
      await expect(page.locator("[data-tone='season'] .chip").filter({ hasText: 'Last week of June into early July' }).first()).toBeVisible();
      // the map card for the Norway trip keeps its meta line and the button inside the card
      await page.goto(`${site.url}/trips/?view=map&c=12,64,5`);
      await page.locator('[data-pin-id="norway-summer-2028"]').first().dispatchEvent('click');
      const card = page.locator('.trips-map-card');
      await expect(card).toBeVisible();
      const box = (await card.boundingBox())!;
      const button = (await card.getByRole('link', { name: /Open the plan/ }).boundingBox())!;
      expect(button.x + button.width, `button inside the card at ${width}`).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `card does not overflow at ${width}`).toBe(true);
      await expect(card.locator('.chip-wrap')).toContainText('Last week of June into early July');
    }
  });
  test('private trips have no page', async ({ page, site }) => {
    const res = await page.goto(`${site.url}/trips/some-private-trip/`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('trip page extras', () => {
  test('a trip whose real dates have passed reads as a published plan and offers "Copy to my trips" (PRIV-TD)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/vermont-fall-2026/?view=day`);
    await expect(page.locator('.trip-kicker')).toContainText('Published plan');
    await expect(page.getByRole('button', { name: 'Copy to my trips' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use as a template' })).toHaveCount(0);
    await expect(page.getByText(/finished plan/i)).toHaveCount(0);
  });
  test('an open day offers a link to itself and every row has its anchor', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-3`);
    await expect(page.locator('#day-3')).toBeVisible();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const copy = page.locator('#day-3 [data-day-link="3"]').getByRole('button', { name: 'Copy link to this day' });
    await expect(copy).toBeVisible();
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/trips\/dolomites-2027\/#day-3$/);
    expect(await page.locator('li.tl-day[id^="day-"]').count()).toBeGreaterThan(10);
  });
});
