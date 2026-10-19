import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const TRAIL = '/places/tre-cime-di-lavaredo-loop/';

test.describe('places list', () => {
  test('shows four primary filter pills and More filters, and the four views with Map switched on (P4)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    const pills = page.locator('.facet-group .pill-trigger');
    await expect(pills).toHaveText([/^Country/, /^Kind/, /^Season/, /^Kids/, /^More filters/]);
    // the rest wait one tap away: Effort and Stroller (L3b) sit under More filters with the others
    for (const name of ['Tag', 'In a public trip', 'Effort', 'Stroller']) await expect(page.locator('.pill-trigger', { hasText: new RegExp(`^${name}`) })).toHaveCount(0);
    await page.getByRole('button', { name: 'More filters' }).click();
    const more = page.getByRole('dialog', { name: 'More filters' });
    for (const name of ['Tag', 'In a public trip', 'Effort', 'Stroller']) await expect(more.locator('summary', { hasText: name })).toBeVisible();
    await expect(more.getByText(/Region appears once you choose a country; Area once you choose a region/)).toBeVisible();
    await page.keyboard.press('Escape');
    const views = page.getByRole('radiogroup', { name: /view/i });
    await expect(views.getByRole('radio')).toHaveText(['Cards', 'List', 'Table', 'Map']);
    await expect(views.getByRole('radio', { name: 'Map' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the Kind menu lists the domains and categories with a count, and a pick filters and lands in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.locator('.pill-trigger', { hasText: /^Kind/ }).click();
    const menu = page.getByRole('dialog', { name: 'Kind' });
    for (const label of ['Nature', 'Water', 'Trails and walks']) await expect(menu.getByText(label, { exact: false }).first()).toBeAttached();
    await menu.getByLabel(/^Trails and walks/).check();
    await expect(page).toHaveURL(/k=nature\.trail/);
    expect(Number(await page.locator('.filter-bar .count strong').innerText())).toBeGreaterThan(0);
  });

  test('cards show the area chain, chips, honesty markers, source counts, footer links and group headings with counts', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=grand-sault`);
    const card = page.locator('article.card', { hasText: 'Grand-Sault waterfall' });
    await expect(card).toContainText('Canada');
    await expect(card.locator('.chip-kind')).toHaveText('Waterfall');
    // a place's personal status is household data and never shows on the public site
    for (const word of ['Idea', 'Shortlisted', 'Planned', 'Visited', 'Dropped']) await expect(card.getByText(word, { exact: true })).toHaveCount(0);
    await expect(card.getByText('Location unconfirmed')).toBeVisible();
    await expect(card.getByText('No source yet').first()).toBeVisible();
    await expect(card.getByRole('link', { name: /^Place page/ })).toHaveAttribute('href', '/places/grand-sault-waterfall/');
    // no stored position, so no Globe link (it would open on nothing)
    await expect(card.getByRole('link', { name: /^Globe/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Canada' })).toBeVisible();
  });

  test('a place with a position links to its spot on the globe', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=lake louise`);
    await expect(page.locator('article.card', { hasText: 'Lake Louise' }).getByRole('link', { name: /^Globe/ })).toHaveAttribute('href', '/globe/place/lake-louise/');
  });

  test('a saved Instagram place shows its source and a count of the rest', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=buton`);
    await expect(page.locator('article.card .src', { hasText: 'Instagram post' }).first()).toContainText('+1');
  });

  test('every researched trail is listed with its completeness badge', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?kind=trail&q=tre cime`);
    const card = page.locator('article.card', { hasText: 'Tre Cime di Lavaredo loop' });
    await expect(card.locator('.pc-complete')).toHaveText(/Usable · 13 of 15/);
    await expect(card.getByRole('link', { name: /^Place page/ })).toHaveAttribute('href', TRAIL);
  });

  test('table: tools row, completeness column, collapsible country groups', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?view=table`);
    for (const name of ['Saved views', 'Columns']) await expect(page.getByRole('button', { name })).toBeVisible();
    // no whole-list CSV on the public site (principle P8); elevation, length and climb stay (P3)
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Compact' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Elevation/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Length/ })).toBeAttached();
    await expect(page.getByRole('columnheader', { name: /Climb/ })).toBeAttached();
    await expect(page.getByRole('columnheader', { name: /Completeness/ })).toBeAttached();
  });

  test('the Map view opens with the filters kept and the camera in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?kind=trail&view=map&c=11.9,46.6,8`);
    const map = page.locator('[data-map-family="maplibre"]');
    await expect(map).toBeVisible();
    await expect(page.locator('.places-map')).toHaveAttribute('data-count', /^\d+$/);
    await expect(page).toHaveURL(/c=11\.9,46\.6,8/);
  });

  test('old query links still work: a legacy kind name (lighthouse is now a sight) and a region code', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?country=CA&region=QC&kind=lighthouse`);
    await expect.poll(async () => Number(await page.locator('.filter-bar .count strong').textContent()), { message: 'the count is written after hydration' }).toBeGreaterThan(0);
  });
});

test.describe('place page', () => {
  test('trail: cover, glance with text provenance, hazards first, route, access with map links, links as tabs', async ({ page, site }) => {
    await page.goto(`${site.url}${TRAIL}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tre Cime di Lavaredo loop');
    await expect(page.locator('.pl-kicker')).toHaveText(/Trail · Auronzo · Veneto/);
    await expect(page.locator('.pl-glance li').first()).toContainText('read 18 Oct 2026');
    const hazards = await page.locator('.pl-hazards-top').boundingBox();
    const route = await page.locator('#route').boundingBox();
    expect((hazards?.y ?? 0) < (route?.y ?? 0)).toBe(true);
    const dir = page.getByRole('link', { name: /Google Maps directions/ });
    await expect(dir).toHaveAttribute('href', /destination=46\.61285,12\.29267/);
    await expect(page.locator('section[aria-labelledby="h-dir"]').getByRole('link', { name: /^Apple Maps/ }).first()).toHaveAttribute('href', /maps\.apple\.com\/\?daddr=46\.61285,12\.29267/);
    await expect(page.getByRole('tab')).toHaveText([/Official\s*2/, /Booking\s*1/, /Route\s*10/, /Conditions\s*4/, /Report\s*2/]);
    await page.getByRole('tab', { name: /Conditions/ }).click();
    await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible();
    await expect(page.getByText(/Researched 18 Oct 2026/)).toBeVisible();
  });

  test('profile is ink at rest; scrubbing shows the one amber cursor and a readout; Escape clears it', async ({ page, site }) => {
    await page.goto(`${site.url}${TRAIL}`);
    const svg = page.getByRole('img', { name: /Sketch of the elevation profile/ });
    await expect(page.locator('.pl-cursor')).toHaveCount(0);
    const line = await page.locator('.pl-line').evaluate((el) => getComputedStyle(el).stroke);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(line).toBe(ink);
    await page.waitForLoadState('networkidle');
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.5, (box?.y ?? 0) + (box?.height ?? 0) * 0.5, { steps: 5 });
    await expect(page.locator('.pl-cursor')).toHaveCount(1);
    await expect(page.locator('.pl-readout')).toHaveText(/\d+\.\d km · [\d,]+ m/);
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    const stroke = await page.locator('.pl-cursor line').evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke.replace(/\s/g, '')).toBe(hexToRgb(accent));
    await page.mouse.move(5, 5);
    await expect(page.locator('.pl-cursor')).toHaveCount(0);
    await svg.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.pl-cursor')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pl-cursor')).toHaveCount(0);
  });

  test('one map family on the page: maplibre by default, and no Google script', async ({ page, site }) => {
    const google: string[] = [];
    page.on('request', (r) => {
      if (/googleapis\.com|google\.com\/maps/.test(r.url())) google.push(r.url());
    });
    await page.goto(`${site.url}/places/lago-di-braies/`);
    await expect(page.locator('[data-map-family]').first()).toBeVisible();
    expect(await page.locator('[data-map-family]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-map-family')))])).toEqual(['maplibre']);
    expect(google).toEqual([]);
  });

  test('Braies: unconfirmed marker, both fee values with their sources, directions to the stored car park', async ({ page, site }) => {
    await page.goto(`${site.url}/places/lago-di-braies/`);
    await expect(page.getByText('Location unconfirmed').first()).toBeVisible();
    const conflict = page.locator('.pl-conflict').first();
    await expect(conflict).toContainText('EUR 15/day');
    await expect(conflict).toContainText('EUR 44 incl. a EUR 22 voucher');
    await expect(page.getByRole('link', { name: /Google Maps directions/ })).toHaveAttribute('href', /destination=46\.70039,12\.0847/);
  });

  test('other kinds open with their own facts: a town, an area and a viewpoint', async ({ page, site }) => {
    for (const [slug, text] of [['bolzano', 'Bolzano'], ['capri', 'Places in Capri'], ['cadini-di-misurina-viewpoint', 'Light']] as const) {
      await page.goto(`${site.url}/places/${slug}/`);
      await expect(page.getByText(text).first()).toBeVisible();
      await expect(page.locator('.pl-glance')).toBeVisible();
    }
  });

  test('Save to a trip says it comes with the planner, with Copy link', async ({ page, site }) => {
    await page.goto(`${site.url}${TRAIL}`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    await expect(page.getByText(/comes with the planner/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy link/ })).toBeVisible();
  });

  test('an old nested place URL is no page on the site; the redirect file carries it', async ({ page, site }) => {
    const res = await page.goto(`${site.url}/places/CA/AB/banff-national-park/lake-louise/`);
    expect(res?.status()).toBe(404);
  });

  test('phone: no horizontal scroll on the list, the table container and a place page', async ({ browser, site }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const url of ['/places/', '/places/?view=table', '/places/?view=map', TRAIL, '/places/lago-di-braies/', '/places/capri/']) {
      await page.goto(`${site.url}${url}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, url).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  });
});

test.describe('places accessibility (axe, WCAG AA)', () => {
  for (const path of ['/places/', '/places/?view=table', '/places/?view=map', TRAIL, '/places/lago-di-braies/', '/places/capri/', '/places/million-dollar-highway/']) {
    for (const theme of ['light', 'dark']) {
      test(`${path} in ${theme}: no serious or critical violations`, async ({ page, site }) => {
        await page.addInitScript((t) => localStorage.setItem('travel:v1:theme', t), theme);
        await page.goto(`${site.url}${path}`);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  }
});

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${n.join(', ')})`.replace(/\s/g, '');
}
