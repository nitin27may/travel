import { expect, test } from './fixtures';

// Server mode: every globe level URL the UI can produce serves the globe shell, not only the paths pre-rendered at build. A static host
// reaches the same page through the /globe/* rewrite of web/redirects.json (untouched); `next start` renders the level on request.
test.setTimeout(90_000);

const LEVELS = [
  ['a country', '/globe/ca/'],
  ['a state', '/globe/ca/ontario/'],
  ['a district', '/globe/it/south-tyrol/'],
  ['a country with no saved place', '/globe/gb/'],
  ['a state with no saved place', '/globe/ca/nunavut/'],
  ['a district with no saved place', '/globe/ca/nunavut/iqaluit/'],
  ['a level written in capitals (it must not replace the cached page of the lower-case one)', '/globe/CA/ontario/'],
  ['the lower-case level after it', '/globe/ca/ontario/'],
] as const;

for (const [what, url] of LEVELS) {
  test(`${what} (${url}) answers 200 and renders the globe`, async ({ page, site }) => {
    const res = await page.goto(`${site.url}${url}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.globe-panel')).toBeVisible();
  });
}

for (const url of ['/globe/not-a-country/', '/globe/ca/a/b/c/', '/globe/ca/bad_slug/', '/globe/c/']) {
  test(`${url} is the 404 page`, async ({ page, site }) => {
    const res = await page.goto(`${site.url}${url}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not here' }).first()).toBeVisible();
  });
}
