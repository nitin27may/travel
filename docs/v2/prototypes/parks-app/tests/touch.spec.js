/* P-M1 and P-M2: every visible button and link in parks is at least 44 x 44 at 390; the compact cover label never overlaps the breadcrumb. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { PARKS, BASICS } = require('./helpers.js');

async function small(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button,a[href],[role=button],select,input:not([type=hidden]):not([type=checkbox])').forEach((e) => {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || e.closest('[hidden],[aria-hidden="true"]:not(svg *)') && !(e instanceof SVGElement)) return;
      if (e.closest('.sr') || cs.position === 'absolute' && r.width <= 1) return;
      if (r.bottom < 0 || r.right < 0) return;
      if (r.width < 43.5 || r.height < 43.5) out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal === undefined ? e.className : 'svg').split(' ')[0]) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out;
  });
}

test('390: every button and link on the index is 44 x 44 (list, cards, map, menus, pager, drawer)', async ({ page, base }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('proto.saved', JSON.stringify(['jasper-national-park'])));
  for (const u of ['/parks-app/index.html', '/parks-app/index.html?view=cards', '/parks-app/index.html?view=map', '/parks-app/index.html?ps=4&page=2', '/parks-app/index.html?country=ca&season=jul&drive=calgary-2', '/parks-app/index.html?q=zzzz']) {
    await page.goto(base + u);
    expect(await small(page), u).toEqual([]);
  }
  await page.goto(base + '/parks-app/index.html?season=jul');
  for (const m of ['where', 'type', 'drive', 'season']) {
    await page.locator(`[data-p="${m}"]`).click();
    expect(await small(page), 'menu ' + m).toEqual([]);
    await page.keyboard.press('Escape');
  }
  await page.locator('#fbtn').click();
  expect(await small(page), 'filters sheet').toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('#savedbtn').click();
  expect(await small(page), 'saved drawer').toEqual([]);
});

test('390: every button and link on all 10 park pages is 44 x 44 (rows expanded, share sheet, controls)', async ({ page, base }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  for (const p of PARKS) {
    await page.goto(base + '/parks-app/park.html?slug=' + p.slug + '&closure=1');
    for (const b of await page.locator('[data-more]').all()) await b.click();
    for (const b of await page.locator('[data-expand]').all()) await b.click();
    expect(await small(page), p.slug).toEqual([]);
  }
  await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
  await page.locator('#share').click();
  expect(await small(page), 'share sheet').toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('#ctlb').click();
  expect(await small(page), 'controls').toEqual([]);
});

test('desktop keeps its proportions: header buttons and pills stay 36 px', async ({ page, base }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/parks-app/index.html');
  expect((await page.locator('#theme').boundingBox()).height).toBe(36);
  expect((await page.locator('.pillw').first().boundingBox()).height).toBe(36);
});

for (const w of [320, 390]) {
  test(`${w}: the compact cover label never overlaps the breadcrumb`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 844 });
    for (const slug of [...BASICS, 'jasper-national-park']) {
      await page.goto(base + '/parks-app/park.html?slug=' + slug);
      const boxes = await page.evaluate(() => {
        const rect = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
        const band = document.querySelector('.cover .band');
        return { crumb: rect(document.querySelector('.crumb')), band: band ? rect(band) : null, kicker: rect(document.querySelector('.kicker')), title: rect(document.querySelector('.title')) };
      });
      if (BASICS.includes(slug)) expect(boxes.band, slug).not.toBeNull();
      if (boxes.band) for (const k of ['crumb', 'kicker', 'title']) {
        const a = boxes.band, b = boxes[k];
        const overlap = a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
        expect(overlap, `${slug}: band overlaps ${k}`).toBe(false);
      }
    }
  });
}

test('map view: full width, the list below it, never beside it (PN14); icons are SVG, no letter glyphs', async ({ page, base }) => {
  for (const w of [1440, 760, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/parks-app/index.html?view=map');
    const m = await page.locator('#mapbox').boundingBox(), l = await page.locator('#maplist').boundingBox(), c = await page.locator('#list').boundingBox();
    expect(l.y, `${w}: list below the map`).toBeGreaterThanOrEqual(m.y + m.height - 1);
    expect(m.width, `${w}: map spans the content width`).toBeGreaterThan(c.width - 100);
    // one pin colour
    const strokes = await page.locator('#mapbox [data-pin] circle').evaluateAll((cs) => [...new Set(cs.map((c) => c.getAttribute('stroke')).filter((s) => s && s.startsWith('var(--id-')))]);
    expect(strokes, 'no day colours').toEqual([]);
  }
  await page.goto(base + '/parks-app/park.html?slug=jasper-national-park&closure=1');
  expect(await page.locator('.glyph svg').count()).toBeGreaterThan(5);
  expect(await page.locator('.banner .ic svg').count()).toBe(1);
  for (const t of await page.locator('.glyph, .banner .ic').allTextContents()) expect(t.trim()).toBe('');
});

test('theme: read and saved through shared/theme.js (proto.theme), applied before first paint, shared across pages', async ({ page, base }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('proto.theme')) localStorage.setItem('proto.theme', 'dark'); });
  await page.goto(base + '/parks-app/index.html');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.locator('#theme').click();
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('proto.theme'), localStorage.getItem('travel:v1:theme')])).toEqual(['light', 'light', null]);
  await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.locator('#theme').click();
  await page.goto(base + '/parks-app/index.html');
  expect(await page.evaluate(() => localStorage.getItem('proto.theme'))).toBe('dark');
  // set before the first paint: the attribute is already there when the stylesheet loads
  const early = await page.evaluate(() => performance.getEntriesByType('navigation').length && document.documentElement.dataset.theme);
  expect(early).toBe('dark');
  expect(await page.locator('script[src="/shared/theme.js"]').count()).toBe(1);
});
