import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// L4b: stored OSM tracks and trail pages for every public trip.
const SORAPIS = '/places/lago-di-sorapis/'; // a track nothing holds back
const TRE_CIME = '/places/tre-cime-di-lavaredo-loop/'; // two relations cut and joined into one 9 km loop (3.28)
const NUVOLAU = '/places/rifugio-nuvolau-and-averau/'; // four relations that do not join (a 185 m gap): dashed pieces
const FANES = '/places/cascate-di-fanes/'; // listed as waiting for a person to confirm
const LARCH = '/places/larch-valley-to-sentinel-pass/'; // a Rockies trail with no track
const WILCOX = '/places/wilcox-pass/'; // named in the Rockies itinerary

test.describe('trail with a confirmed track', () => {
  test('the profile is sampled along the stored line and the map credits OpenStreetMap', async ({ page, site }) => {
    await page.goto(`${site.url}${SORAPIS}`);
    const svg = page.getByRole('img', { name: /Elevation profile along the stored route/ });
    await expect(svg).toBeVisible();
    await expect(page.getByText('Shape estimated from length and climb')).toHaveCount(0);
    await expect(page.getByText(/Elevation sampled every 25 m along the OpenStreetMap line/)).toBeVisible();
    await expect(page.getByText(/Route line: © OpenStreetMap contributors \(ODbL\), read \d+ \w+ 20\d\d/)).toBeVisible();
    await expect(page.getByText('Route not confirmed yet')).toHaveCount(0);
    // both figures show when the track and the research differ by more than 10%
    await expect(page.locator('dt', { hasText: /^Track$/ })).toBeVisible();
  });

  test('scrubbing moves the cursor along the real distance', async ({ page, site }) => {
    await page.goto(`${site.url}${SORAPIS}`);
    await page.waitForLoadState('networkidle');
    const svg = page.getByRole('img', { name: /Elevation profile along the stored route/ });
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.6, (box?.y ?? 0) + (box?.height ?? 0) * 0.5, { steps: 5 });
    await expect(page.locator('.pl-cursor')).toHaveCount(1);
    await expect(page.locator('.pl-readout')).toHaveText(/\d+\.\d km · [\d,]+ m/);
  });

  test('the export menu offers GPX and KML, and says the file holds the OSM track', async ({ page, site }) => {
    await page.goto(`${site.url}${SORAPIS}`);
    await page.getByRole('button', { name: /Export/ }).click();
    await expect(page.getByRole('menuitem', { name: /GPX/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /KML/ })).toBeVisible();
    await expect(page.getByText(/holds the OpenStreetMap track, with its licence notice/)).toBeVisible();
  });
});

test.describe('trail made of two relations', () => {
  test('Tre Cime is cut and joined into one confirmed loop with a real profile', async ({ page, site }) => {
    await page.goto(`${site.url}${TRE_CIME}`);
    await expect(page.getByRole('img', { name: /Elevation profile along the stored route\. 9 km/ })).toBeVisible();
    await expect(page.getByText('Route not confirmed yet')).toHaveCount(0);
    await expect(page.getByText('Shape estimated from length and climb')).toHaveCount(0);
  });
});

test.describe('trail whose route is not confirmed', () => {
  for (const url of [FANES, NUVOLAU]) {
    test(`${url}: dashed line label, no route in the export, and the reason`, async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      await expect(page.getByText('Route not confirmed yet', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/Route line left out of the file: not confirmed yet/)).toBeVisible();
      await page.getByRole('button', { name: /Export/ }).click();
      await expect(page.getByRole('menuitem', { name: /GPX/ })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /KML/ })).toHaveCount(0);
    });
  }
  test('an unstitched relation draws no elevation profile from the stored route', async ({ page, site }) => {
    await page.goto(`${site.url}${NUVOLAU}`);
    await expect(page.getByRole('img', { name: /Elevation profile along the stored route/ })).toHaveCount(0);
  });
});

test.describe('Rockies trail with no track', () => {
  test('has a page with the research, the link checklist and an honest empty map', async ({ page, site }) => {
    await page.goto(`${site.url}${LARCH}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Larch Valley to Sentinel Pass');
    await expect(page.locator('.pl-kicker')).toHaveText(/Trail · Banff · Alberta/);
    await expect(page.getByText('11.2 km').first()).toBeVisible();
    await expect(page.getByText('Shape estimated from length and climb')).toBeVisible();
    await expect(page.getByText(/No point is stored for this place yet, so there is no map/)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveText([/Official\s*[1-9]/, /Booking\s*· not checked yet/, /Route\s*[1-9]/, /Conditions\s*· not checked yet/, /Report\s*· not checked yet/]);
    await page.getByRole('tab', { name: /Route/ }).click();
    const alltrails = page.getByRole('tabpanel').locator('li', { hasText: 'AllTrails' });
    await expect(alltrails.getByText('link only')).toBeVisible();
    await expect(page.getByText('Used in').first()).toBeVisible();
  });

  test('a trail named in the Rockies itinerary has its page, which says which trip uses it', async ({ page, site }) => {
    // the day rows' links come from the same name lookup (unit test: every unambiguous itinerary trail has a placeSlug)
    await page.goto(`${site.url}${WILCOX}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wilcox Pass');
    await expect(page.getByRole('link', { name: /Canadian Rockies/ }).first()).toBeVisible();
  });
});

test.describe('trail pages: accessibility (axe, WCAG AA)', () => {
  for (const path of [SORAPIS, TRE_CIME, FANES, LARCH]) {
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
