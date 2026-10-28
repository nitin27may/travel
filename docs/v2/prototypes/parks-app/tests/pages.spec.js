/* Park pages: one source with the index, every section, Basics only, placeholders, links and buttons that do something. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { PARKS, FULL, BASICS, LISTED, watchErrors, planVisitOk, addOk, stubExternal } = require('./helpers.js');

const SECTIONS = ['Entry and bookings', 'Safety and rules', 'Seasons and closures', 'Where to stay or camp', 'Things to do', 'Getting there', 'Sources'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

test('index chips (Open in, Entry, Camping) equal the page glance for all 10 parks', async ({ page, base }) => {
  const errs = watchErrors(page);
  await page.goto(base + '/parks-app/index.html?ps=100');
  const chip = {};
  for (const p of LISTED) {
    chip[p.slug] = await page.locator(`a.prow[href$="slug=${p.slug}"] [data-fact]`).evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.fact, e.textContent.trim()])));
    expect(Object.keys(chip[p.slug]).sort(), p.slug).toEqual(['camping', 'entry', 'season']);
  }
  // the cards view carries the same chips
  await page.goto(base + '/parks-app/index.html?view=cards');
  for (const p of LISTED) {
    const c = await page.locator(`a.pk[href$="slug=${p.slug}"] [data-fact]`).evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.fact, e.textContent.trim()])));
    expect(c, 'cards ' + p.slug).toEqual(chip[p.slug]);
  }
  // the page glance (Lake O'Hara is a zone: the index lists 9, the page is checked too)
  for (const p of PARKS) {
    await page.goto(base + '/parks-app/park.html?slug=' + p.slug);
    const g = await page.locator('.glance [data-fact]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.fact, e.textContent.trim()])));
    expect(Object.keys(g).sort(), p.slug).toEqual(['camping', 'entry', 'season']);
    if (chip[p.slug]) expect(g, 'page vs index ' + p.slug).toEqual(chip[p.slug]);
  }
  expect(LISTED).toHaveLength(9);
  expect(errs.list()).toEqual([]);
});

for (const slug of FULL) {
  test(`full page renders every section: ${slug}`, async ({ page, base }) => {
    const errs = watchErrors(page);
    await page.goto(base + '/parks-app/park.html?slug=' + slug);
    for (const s of SECTIONS) await expect(page.getByRole('heading', { level: 2, name: new RegExp('^' + s) }), s).toHaveCount(1);
    await expect(page.locator('.state')).toHaveCount(0);
    await expect(page.locator('.glance')).toBeVisible();
    // each section has real content, not just a heading
    for (const id of ['entry', 'safety', 'seasons', 'stay', 'todo', 'getting-there', 'sources']) expect((await page.locator('#' + id).innerText()).length, id).toBeGreaterThan(60);
    expect(await page.locator('#entry .req li').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('#stay .req li').count()).toBeGreaterThanOrEqual(1);
    expect(errs.list()).toEqual([]);
  });
}
for (const slug of BASICS) {
  test(`compact page shows the explicit Basics only state: ${slug}`, async ({ page, base }) => {
    const errs = watchErrors(page);
    await page.goto(base + '/parks-app/park.html?slug=' + slug);
    await expect(page.locator('.cover .state')).toHaveText('Basics only');
    await expect(page.locator('.basicsnote')).toContainText('Basics only');
    await expect(page.getByRole('heading', { level: 2, name: 'Places inside' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Seasons and closures' })).toHaveCount(0);
    await expect(page.locator('#not-checked')).toContainText('Not researched yet');
    expect(errs.list()).toEqual([]);
  });
}

test('placeholders: every flagged element carries the tag, and the word appears nowhere else', async ({ page, base }) => {
  for (const p of PARKS) {
    await page.goto(base + '/parks-app/park.html?slug=' + p.slug);
    const r = await page.evaluate(() => {
      const missing = [...document.querySelectorAll('[data-ph]')].filter((e) => !e.querySelector('.phtag')).map((e) => e.tagName + '.' + e.className);
      const stray = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!/placeholder/i.test(t.nodeValue) || !t.parentElement) continue;
        if (t.parentElement.closest('.phtag,.protonote,.compl,.printfoot,.urlx,script,style')) continue;
        stray.push(t.nodeValue.trim().slice(0, 60));
      }
      return { missing, stray, flagged: document.querySelectorAll('[data-ph]').length, tags: document.querySelectorAll('.phtag').length };
    });
    expect(r.missing, p.slug + ' data-ph without tag').toEqual([]);
    expect(r.stray, p.slug + ' unlabelled word').toEqual([]);
    expect(r.tags, p.slug).toBeGreaterThanOrEqual(r.flagged);
    // a record flagged in the data shows its tag: rows + camps (each its own li) and the sources
    const flaggedRecords = [...(p.rows || []), ...(p.camps || [])].filter((x) => x.ph).length + p.sources.length;
    const lis = await page.locator('#entry li[data-ph], #stay li[data-ph], #sources li[data-ph]').count();
    expect(lis, p.slug + ' flagged records on the page').toBeGreaterThanOrEqual(p.level === 'full' ? flaggedRecords : p.sources.length);
    // the airport and the camping glance, when invented, say so
    if (p.airport && p.airport.ph) await expect(page.locator('.glance > div[data-ph]').last().locator('.phtag')).toHaveCount(1);
  }
});

test('print footer carries the Placeholder tag and the page chrome is hidden', async ({ page, base }) => {
  await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
  await expect(page.locator('#printfoot')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#printfoot')).toBeVisible();
  await expect(page.locator('#printfoot .phtag')).toHaveText('Placeholder');
  await expect(page.locator('#hdr')).toBeHidden();
  await expect(page.locator('#bbar')).toBeHidden();
});

test('Plan a visit and Add to a trip links match the builder contract on every park page', async ({ page, base }) => {
  let plan = 0, add = 0;
  for (const p of PARKS) {
    await page.goto(base + '/parks-app/park.html?slug=' + p.slug);
    // show every place so every Add to a trip link is present
    for (const b of await page.locator('[data-expand]').all()) { await b.click(); }
    const pv = await page.locator('.planvisit a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    if (p.pts >= 3) {
      expect(pv, p.slug).toHaveLength(4);
      pv.forEach((h) => expect(planVisitOk(h, p), p.slug + ' ' + h).toBe(true));
      expect(pv.filter((h) => /m=near/.test(h)).map((h) => new URL(h, 'http://x').searchParams.get('n')).sort()).toEqual(['0', '1', '2']);
      expect(pv.filter((h) => /m=trip/.test(h))).toHaveLength(1);
      plan += pv.length;
    } else expect(pv, p.slug + ' has too few places for Plan a visit').toHaveLength(0);
    const ad = await page.locator('a[href*="?add="]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(ad.length, p.slug).toBeGreaterThan(0);
    ad.forEach((h) => expect(addOk(h, p), p.slug + ' ' + h).toBe(true));
    add += ad.length;
  }
  expect(plan).toBeGreaterThan(30); expect(add).toBeGreaterThan(40);
});

test('Plan a visit and Add to a trip hand over to the builder (round trip)', async ({ page, base }) => {
  await page.goto(base + '/parks-app/park.html?slug=jasper-national-park');
  await page.locator('.planvisit a', { hasText: '1 night' }).click();
  await expect(page).toHaveURL(/\/builder\/index\.html\?m=near&n=1&p=jasper-national-park/);
  await page.goBack();
  await page.locator('a[href*="?add="]').first().click();
  await expect(page).toHaveURL(/\/builder\/index\.html\?add=jasper-national-park--[a-z0-9-]+&p=jasper-national-park/);
});

test('Directions opens a maps URL for the park point in a new tab', async ({ page, base, context }) => {
  await stubExternal(context);
  for (const slug of ['banff-national-park', 'zion-national-park']) {
    const p = PARKS.find((x) => x.slug === slug);
    await page.goto(base + '/parks-app/park.html?slug=' + slug);
    const [pop] = await Promise.all([context.waitForEvent('page'), page.locator('#dir').click()]);
    expect(pop.url()).toBe(`https://www.google.com/maps/dir/?api=1&destination=${p.ll[0]},${p.ll[1]}`);
    await pop.close();
  }
  await page.goto(base + '/parks-app/park.html?slug=jasper-national-park');
  const [pop2] = await Promise.all([context.waitForEvent('page'), page.locator('[data-dir]').click()]);
  expect(pop2.url()).toContain('google.com/maps/dir/?api=1&destination=52.87,-118.08');
});

test('Share: Web Share API when present', async ({ page, base }) => {
  await page.addInitScript(() => { window.__shared = null; Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__shared = d; return Promise.resolve(); } }); });
  await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
  await page.locator('#share').click();
  const d = await page.evaluate(() => window.__shared);
  expect(d.title).toBe('Banff National Park'); expect(d.url).toContain('park.html?slug=banff-national-park');
  await expect(page.locator('#sharesheet')).toHaveCount(0);
});
test('Share: sheet with copy-link fallback, confirmation, focus returns to the button', async ({ page, base, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  await page.goto(base + '/parks-app/park.html?slug=killarney-provincial-park');
  await page.locator('#share').focus(); await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Share Killarney Provincial Park' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('#copylink')).toBeFocused();
  await page.locator('#copylink').click();
  await expect(page.locator('#sharemsg')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('park.html?slug=killarney-provincial-park');
  // Tab stays inside the sheet
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#sharesheet'))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#share')).toBeFocused();
});

test('source links and row links open their stored URL (a placeholder URL, shown as such)', async ({ page, base, context }) => {
  await stubExternal(context);
  const p = PARKS.find((x) => x.slug === 'yoho-national-park');
  await page.goto(base + '/parks-app/park.html?slug=yoho-national-park');
  const links = page.locator('#sources a');
  await expect(links).toHaveCount(p.sources.length);
  for (let i = 0; i < p.sources.length; i++) {
    await expect(links.nth(i)).toHaveAttribute('href', p.sources[i].url);
    await expect(links.nth(i)).toHaveAttribute('target', '_blank');
    await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('#sources li').nth(i).locator('.phtag')).toContainText('Placeholder');
    await expect(page.locator('#sources .urlx').nth(i)).toContainText('example.org/placeholder/yoho-national-park');
  }
  const [pop] = await Promise.all([context.waitForEvent('page'), links.first().click()]);
  expect(pop.url()).toBe(p.sources[0].url);
  await pop.close();
  const row = page.locator('#entry .lk a').first();
  const [pop2] = await Promise.all([context.waitForEvent('page'), row.click()]);
  expect(pop2.url()).toBe(p.rows[0].url);
  // no link on the page is a dead "#"
  expect(await page.locator('a[href="#"]').count()).toBe(0);
});

test('Save toggles and survives a reload; Saved drawer returns focus', async ({ page, base }) => {
  await page.goto(base + '/parks-app/park.html?slug=jasper-national-park');
  await page.locator('#save').click();
  await page.locator('#justsave').click();   // STEP2-PR: Save to a trip opens the trip picker; the last choice saves for later
  await expect(page.locator('#save')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#savedn')).toHaveText('1');
  await page.locator('#savedbtn').focus(); await page.keyboard.press('Enter');
  const dr = page.getByRole('dialog', { name: 'My saved places' });
  await expect(dr).toBeVisible();
  await expect(dr.getByRole('link', { name: 'Jasper National Park' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dr).toHaveCount(0);
  await expect(page.locator('#savedbtn')).toBeFocused();
});
