import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Review 4.26: every place page's Globe button must land on the pin and the card. The fault was MapLibre's covered-marker rule: at pitch 55
// over real terrain it judged the pin and the card anchor covered and set their opacity to 0. So this runs on the real GPU with real tiles
// and real terrain (the chromium project's flags), never with the tile-blocked fixture.
const THEME_KEY = 'travel:v1:theme';
test.use({ allowRemote: true });
test.setTimeout(150_000);

const PLACES = [
  { name: 'a trail', slug: 'tre-cime-di-lavaredo-loop' },
  { name: 'a lake', slug: 'moraine-lake' },
  { name: 'a seeded lift', slug: 'lake-louise-summer-gondola' },
  { name: 'an older page', slug: 'lake-louise' },
];
const NO_POINT = 'aiguille-du-midi';
const SIZES = [
  { w: 1440, h: 900 },
  { w: 1024, h: 768 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
];

/** Whether the element is drawn: every ancestor opaque and visible, its centre on screen and on top of what is there. */
async function drawn(page: Page, selector: string, hitTest = true): Promise<{ ok: boolean; why: string }> {
  return page.evaluate(([sel, hit]) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return { ok: false, why: 'missing' };
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (Number(cs.opacity) < 0.99 || cs.visibility === 'hidden' || cs.display === 'none') return { ok: false, why: `${n.className} opacity ${cs.opacity} visibility ${cs.visibility}` };
    }
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + Math.min(b.height / 2, 40);
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return { ok: false, why: `off screen at ${Math.round(cx)},${Math.round(cy)}` };
    if (!hit) return { ok: true, why: '' }; // the selected pin takes no pointer events, so only the card is hit-tested
    const top = document.elementFromPoint(cx, cy);
    return top && (el.contains(top) || top.contains(el)) ? { ok: true, why: '' } : { ok: false, why: `covered by ${top?.className}` };
  }, [selector, hitTest] as const);
}

async function walk(page: Page, siteUrl: string, slug: string): Promise<void> {
  await page.goto(`${siteUrl}/places/${slug}/`);
  await page.locator('.pl-actions').getByRole('link', { name: /Globe/ }).click();
  await expect(page).toHaveURL(new RegExp(`/globe/place/${slug}/`));
  // the card opens when the camera lands; give the flight and the terrain time, then read it twice (the fault returned on the second read)
  await expect(page.locator('.globe-card').first()).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => document.querySelector('.globe-card-anchor, .globe-card-dock, .globe-card-sheet') !== null), { timeout: 10_000 }).toBe(true);
  for (let i = 0; i < 2; i++) {
    // fades (the canvas on its first idle, the pin and the card in) take a moment; the state must settle to drawn, and stay so
    await expect.poll(async () => (await drawn(page, '.globe-pin[data-hot="true"]', false)).why, { message: `the pin of ${slug}`, timeout: 30_000 }).toBe('');
    await expect.poll(async () => (await drawn(page, '.globe-card')).why, { message: `the card of ${slug}`, timeout: 30_000 }).toBe('');
    await page.waitForTimeout(2500);
    const open = await page.locator('.globe-card').first().getByRole('link', { name: /Open place/ }).boundingBox();
    expect(open && open.y + open.height <= page.viewportSize()!.height, 'Open place is on screen').toBe(true);
  }
}

for (const size of SIZES) {
  test.describe(`${size.w}x${size.h}`, () => {
    test.use({ viewport: { width: size.w, height: size.h } });
    for (const p of PLACES) {
      test(`the Globe button of ${p.name} (${p.slug}) lands on its pin and card, light`, async ({ page, site }) => {
        await walk(page, site.url, p.slug);
      });
    }
    test('moraine-lake in dark', async ({ page, site }) => {
      await page.addInitScript((k) => localStorage.setItem(k, 'dark'), THEME_KEY);
      await walk(page, site.url, 'moraine-lake');
    });
  });
}

test('a place with no map point has no Globe button and says so', async ({ page, site }) => {
  await page.goto(`${site.url}/places/${NO_POINT}/`);
  await expect(page.getByText(/No point is stored for this place yet/).first()).toBeVisible();
  await expect(page.locator('.pl-actions').getByRole('link', { name: /Globe/ })).toHaveCount(0);
  const res = await page.request.get(`${site.url}/globe/place/${NO_POINT}/`);
  expect(res.status(), 'no globe route for a place with no point').toBe(404);
});

test('a district that holds a trip base lists the trip (backlog 3.65)', async ({ page, site }) => {
  // the Canadian Rockies base is in Banff: the district the place page of Lake Louise sits in lists the trip as well as its places
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${site.url}/globe/place/lake-louise/`);
  const panel = page.getByRole('complementary', { name: 'Places and trips' });
  await expect(panel.locator('section[aria-label="Trips"]')).toContainText('Canadian Rockies', { timeout: 60_000 });
});
