// Continue with Google on the sign-in card (GSI-1; Google spec 4 and 10.2, copy page strings 1 to 22), with every network call mocked:
// the proxy's `sign-in/social` (auth-mock.ts) and Google's own page (a stand-in on accounts.google.com). No request leaves the browser,
// and no real Google login happens (the owner's live test, copy page section 5, is the real check). Runs against `.fixture-auth`.
import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import type { Server } from './fixtures';
import { authBuildPresent, mockAuth, type Override, startAuthSite } from './auth-mock';

test.skip(!authBuildPresent(), 'needs web/.fixture-auth (see tests/e2e/auth-mock.ts)');

let site: Server;
test.beforeAll(async () => {
  site = await startAuthSite();
});
test.afterAll(() => site?.stop());

const GOOGLE = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=openid%20email%20profile&state=s1&code_challenge=c1&code_challenge_method=S256';
const S = {
  consent: 'Google shares your name, email address and profile photo link with us. Never your password or contacts.',
  cookies: 'Your browser is blocking cookies for this site. Sign-in needs them. Allow cookies for this site, then reload this page.',
  inApp: "Google doesn't allow sign-in inside this app's browser. Open this page in Safari or Chrome, or use your email below.",
  offline: "You're offline. Sign-in needs a connection.",
  startFailed: "We couldn't open Google. Try again, or use your email below.",
  rateLimited: 'Too many sign-in attempts. Wait 15 minutes, then try again, or use your email below.',
  cancelled: 'You cancelled signing in with Google. Try again, or use your email below.',
  didNotFinish: "Signing in with Google didn't finish. Try again. If this keeps happening, allow cookies for this site, or use your email below.",
  restart: 'That sign-in took too long or was started in another tab. Please start again.',
  accountExists: "There's already an account here for this email. Sign in with your email first, then add Google on your account page.",
  unavailable: "Google sign-in isn't working right now. Try again shortly, or use your email below.",
};

const google = (page: Page) => page.getByRole('button', { name: 'Continue with Google' });
const banner = (page: Page) => page.locator('.auth-card .ban');
const live = (page: Page) => page.locator('.auth-card p[aria-live="polite"]');
const social = (answer: ReturnType<Override>): Override => () => answer;

/** Google's page, played locally: the card's navigation lands here and nothing reaches Google. */
async function fakeGoogle(target: Page | BrowserContext): Promise<string[]> {
  const seen: string[] = [];
  await target.route('https://accounts.google.com/**', (route: Route) => {
    seen.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Google</title><h1>Choose an account</h1>' });
  });
  return seen;
}

test.describe('the button on step 1 (strings 1 to 6)', () => {
  for (const path of ['/sign-in/', '/sign-up/']) {
    test(`${path}: first in the card and full width, then the consent line and "What we keep", the divider, the email form`, async ({ page }) => {
      await mockAuth(page);
      await page.goto(`${site.url}${path}`);
      const button = google(page);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('type', 'button');
      expect(await button.getAttribute('aria-label')).toBeNull();
      await expect(button.locator('img')).toHaveAttribute('alt', '');
      await expect(page.locator('.auth-google-consent')).toHaveText(`${S.consent} What we keep`);
      await expect(page.getByRole('link', { name: 'What we keep' })).toHaveAttribute('href', '/privacy/#accounts');
      await expect(page.locator('.auth-divider')).toHaveText('or');
      // The button is described by the consent line (screen readers hear it after the name).
      expect(await button.getAttribute('aria-describedby')).toContain('auth-google-consent');
      const b = (await button.boundingBox())!;
      const field = (await page.locator('.auth-card .field').boundingBox())!;
      const card = (await page.locator('.auth-card').boundingBox())!;
      expect(b.y).toBeLessThan(field.y);
      expect(Math.abs(b.width - field.width)).toBeLessThan(1);
      expect(b.y - card.y).toBeLessThan(60);
      // Light theme: Google's white fill, dark label (tokens.md 2.3).
      expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    });
  }

  test('tab order from the top of the card: Google, then "What we keep", then the email field', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari tabs to form fields only by default');
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/`);
    await google(page).waitFor();
    await page.locator('.auth-head h1').click();
    await page.keyboard.press('Tab');
    await expect(google(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'What we keep' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();
  });

  test('axe finds nothing on either page', async ({ page }) => {
    await mockAuth(page);
    for (const path of ['/sign-in/', '/sign-up/']) {
      await page.goto(`${site.url}${path}`);
      await google(page).waitFor();
      // The step fades in (auth.css): measure contrast after it ends, not on a half-transparent label (flaky on WebKit otherwise).
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    }
  });

  test('"Last used on this browser" after Google was the last way in', async ({ page }) => {
    await mockAuth(page);
    await page.addInitScript(() => localStorage.setItem('auth.lastMethod', 'google'));
    await page.goto(`${site.url}/sign-in/`);
    await expect(page.locator('.auth-google-last')).toHaveText('Last used on this browser');
    expect(await google(page).getAttribute('aria-describedby')).toBe('auth-google-last auth-google-consent');
  });

  test('dark theme: Google\'s dark button', async ({ page }) => {
    await mockAuth(page);
    await page.addInitScript(() => localStorage.setItem('travel:v1:theme', 'dark'));
    await page.goto(`${site.url}/sign-in/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await google(page).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(['rgb(19, 19, 20)', 'rgb(227, 227, 227)']);
  });
});

test.describe('the press (strings 10 to 14)', () => {
  test('asks the proxy with paths only and the checked next, marks the press, and leaves for Google', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    const calls = await mockAuth(page);
    // Hold the answer, to see the in-flight state; then answer as Neon does.
    await page.route('**/api/auth/sign-in/social/', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: GOOGLE, redirect: true }) });
    });
    const seen = await fakeGoogle(page);
    await page.goto(`${site.url}/sign-in/?next=%2Fplaces%2Flake-louise%2F`);
    await google(page).click();
    await expect(google(page)).toHaveAttribute('aria-busy', 'true');
    await expect(google(page).locator('.btn-spin')).toBeVisible();
    await expect(google(page)).toHaveText('Continue with Google');
    await expect(page.getByLabel('Email')).toBeDisabled();
    await expect(live(page)).toHaveText('Opening Google.');
    release();
    await page.waitForURL(/accounts\.google\.com/);
    expect(seen[0]).toBe(GOOGLE);
    expect(calls.filter((c) => c.path === 'sign-in/social')).toHaveLength(0); // the held route answered, not the default mock
    await page.goBack();
    // GSI-2: Back from Google is a press that did not sign in, so no way in is claimed for it (there was none before)
    await expect(google(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('auth.lastMethod'))).toBeNull();
    await expect(page.locator('.auth-google-last')).toHaveCount(0);
  });

  test('GSI-2: the press keeps the earlier way in beside the mark; a cancelled return puts it back', async ({ page }) => {
    await mockAuth(page, { 'sign-in/social': social({ status: 200, body: { url: GOOGLE, redirect: true } }) });
    await fakeGoogle(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('auth.lastMethod', 'code');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto(`${site.url}/sign-in/?next=%2Fmine%2F`);
    await google(page).click();
    await page.waitForURL(/accounts\.google\.com/);
    // Neon sends a cancel back to the start page
    await page.goto(`${site.url}/sign-in/?next=%2Fmine%2F&error=access_denied`);
    await expect(banner(page)).toHaveText(S.cancelled);
    expect(await page.evaluate(() => [localStorage.getItem('auth.lastMethod'), sessionStorage.getItem('auth.googlePending'), sessionStorage.getItem('auth.googleBefore')])).toEqual(['code', null, null]);
    await expect(page.locator('.auth-google-last')).toHaveCount(0);
  });

  test('the body the card sends', async ({ page }) => {
    const calls = await mockAuth(page, { 'sign-in/social': social({ status: 200, body: { url: GOOGLE, redirect: true } }) });
    await fakeGoogle(page);
    await page.goto(`${site.url}/sign-up/?next=%2Fmine%2F`);
    await google(page).click();
    await page.waitForURL(/accounts\.google\.com/);
    expect(calls.find((c) => c.path === 'sign-in/social')?.body).toEqual({ provider: 'google', callbackURL: '/account/?next=%2Fmine%2F', errorCallbackURL: '/sign-up/?next=%2Fmine%2F' });
    expect(calls.find((c) => c.path === 'sign-in/social')?.turnstile).toBeNull();
  });

  test('a start that never answers ends after 15 s with string 13, the button ready and the email way open (GSI-R S3)', async ({ page }) => {
    await page.clock.install();
    await mockAuth(page);
    await page.route('**/api/auth/sign-in/social/', () => new Promise(() => {})); // held, as hotel wifi does
    await page.goto(`${site.url}/sign-in/`);
    await google(page).click();
    await expect(google(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('Email')).toBeDisabled();
    await page.clock.fastForward(14_000);
    await expect(google(page)).toHaveAttribute('aria-busy', 'true');
    await page.clock.fastForward(1_100);
    await expect(banner(page)).toHaveText(S.startFailed);
    await expect(live(page)).toHaveText(S.startFailed);
    await expect(google(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('Email')).toBeEnabled();
    expect(await page.evaluate(() => sessionStorage.getItem('auth.googlePending'))).toBeNull();
  });

  test('offline: string 12, and no call', async ({ page, context }) => {
    const calls = await mockAuth(page);
    await page.goto(`${site.url}/sign-in/`);
    await google(page).waitFor(); // the card's chunk is in before the connection goes
    await context.setOffline(true);
    await google(page).click();
    await expect(banner(page)).toHaveText(S.offline);
    await context.setOffline(false);
    expect(calls.filter((c) => c.path === 'sign-in/social')).toHaveLength(0);
    await expect(google(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('Email')).toBeEnabled();
  });

  const failures: [string, ReturnType<Override>, string, boolean][] = [
    ['a 200 without an address (13)', { status: 200, body: { redirect: true } }, S.startFailed, false],
    ["an address that is not Google's (13)", { status: 200, body: { url: 'https://evil.example/o/oauth2/auth', redirect: true } }, S.startFailed, false],
    ['a 429 (14)', { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '900' } }, S.rateLimited, true],
    ['a 404 with the flag off on the server (22)', { status: 404, body: { code: 'NOT_FOUND' } }, S.unavailable, false],
    ['a 503 (22)', { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } }, S.unavailable, false],
  ];
  for (const [name, answer, text, urgent] of failures) {
    test(`${name}: "${text.slice(0, 40)}...", the button ready again, still on the page`, async ({ page }) => {
      await mockAuth(page, { 'sign-in/social': social(answer) });
      const seen = await fakeGoogle(page);
      await page.goto(`${site.url}/sign-in/`);
      await google(page).click();
      await expect(banner(page)).toHaveText(text);
      if (urgent) await expect(page.locator('.auth-card').getByRole('alert')).toHaveText(text);
      else await expect(live(page)).toHaveText(text);
      await expect(google(page)).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.getByLabel('Email')).toBeEnabled();
      expect(seen).toHaveLength(0);
      expect(new URL(page.url()).pathname).toBe('/sign-in/');
    });
  }
});

test.describe('back on the card from Neon (strings 15 to 22)', () => {
  const returns: [string, string][] = [
    ['access_denied', S.cancelled],
    ['state_mismatch', S.restart],
    ['please_restart_the_process', S.restart],
    ['signup_disabled', "New accounts can't be created right now. Everything on this site works without one."],
    ['email_not_found', "Google didn't share an email address, so we couldn't sign you in. Try again and allow it, or use your email below."],
    ['unable_to_create_user', S.unavailable],
  ];
  for (const [code, text] of returns) {
    test(`?error=${code}: its banner, read once, and the address cleaned (next kept)`, async ({ page }) => {
      await mockAuth(page);
      await page.goto(`${site.url}/sign-in/?next=%2Fmine%2F&error=${code}&error_description=Something+Neon+said`);
      await expect(banner(page)).toHaveText(text);
      await expect(live(page)).toHaveText(text);
      await expect.poll(() => new URL(page.url()).search).toBe('?next=%2Fmine%2F');
      await expect(page.locator('body')).not.toContainText('Something Neon said');
      await page.reload();
      await expect(banner(page)).toHaveCount(0);
    });
  }

  test('account_not_linked (20): the banner, and focus in the email field, never prefilled', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/?error=account_not_linked&email=nitin%40example.com`);
    await expect(banner(page)).toHaveText(S.accountExists);
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Email')).toHaveValue('');
  });

  test('an unknown or hostile code reads the fallback (22) and never shows its text', async ({ page }) => {
    await mockAuth(page);
    const hostile = encodeURIComponent('<img src=x onerror=alert(1)>origin_not_trusted neon.tech');
    await page.goto(`${site.url}/sign-up/?error=${hostile}`);
    await expect(banner(page)).toHaveText(S.unavailable);
    const text = (await page.locator('main').textContent()) ?? '';
    for (const word of ['onerror', 'origin', 'neon.tech', 'domain']) expect(text).not.toContain(word);
    await expect.poll(() => new URL(page.url()).search).toBe('');
  });

  test("a bounced verifier after a recent press (cookies blocked): \"didn't finish\" (16), and the verifier removed", async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/`);
    await page.evaluate(() => sessionStorage.setItem('auth.googlePending', String(Date.now() - 5000)));
    await page.goto(`${site.url}/sign-in/?next=%2Fmine%2F&neon_auth_session_verifier=v123`);
    await expect(banner(page)).toHaveText(S.didNotFinish);
    await expect.poll(() => new URL(page.url()).search).toBe('?next=%2Fmine%2F');
    expect(await page.evaluate(() => sessionStorage.getItem('auth.googlePending'))).toBeNull();
  });

  // GSI-UXF M1: the banner went missing on most loads because the card's first render wrote storage (React can run a first render
  // twice before it commits). Every load at every width must show it, with the mark set before the page's own scripts (as the shots do).
  for (const width of [1440, 390, 320]) {
    test(`string 16 shows on every load of the bounced return at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await mockAuth(page);
      await page.addInitScript(() => sessionStorage.setItem('auth.googlePending', String(Date.now() - 5000)));
      for (let load = 0; load < 4; load++) {
        await page.goto(`${site.url}/sign-in/?neon_auth_session_verifier=`);
        await expect(banner(page)).toHaveText(S.didNotFinish);
        await expect(banner(page)).toBeVisible();
        await expect.poll(() => new URL(page.url()).search).toBe('');
        // The way in from before the press is put back after the commit, never during the render.
        expect(await page.evaluate(() => [sessionStorage.getItem('auth.googlePending'), localStorage.getItem('auth.lastMethod')])).toEqual([null, null]);
      }
    });
  }

  test('Back from Google: the card is ready (no spinner left), with "didn\'t finish" or nothing', async ({ page }) => {
    await mockAuth(page, { 'sign-in/social': social({ status: 200, body: { url: GOOGLE, redirect: true } }) });
    await fakeGoogle(page);
    await page.goto(`${site.url}/sign-in/`);
    await google(page).click();
    await page.waitForURL(/accounts\.google\.com/);
    await page.goBack();
    await expect(google(page)).toBeVisible();
    await expect(google(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('Email')).toBeEnabled();
    const shown = await banner(page).allTextContents();
    expect(shown.length === 0 || (shown.length === 1 && shown[0] === S.didNotFinish)).toBe(true);
  });

  test('a stale mark on a fresh visit (signed in, signed out, Sign in again) shows nothing', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/`);
    await page.evaluate(() => sessionStorage.setItem('auth.googlePending', String(Date.now() - 60_000)));
    await page.goto(`${site.url}/sign-in/`);
    await expect(google(page)).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe('"Use Google instead" on the banners that offer Google (strings 52 to 55, GSI-R S1)', () => {
  const cases: [string, string, Record<string, Override>, string, (p: Page) => Promise<void>][] = [
    ['sign-up, the code send failed (55)', '/sign-up/', { 'email-otp/send-verification-otp': social({ status: 503, body: { code: 'SEND_FAILED' } }) }, "We couldn't send the email. Try again shortly, or use Google.", async () => {}],
    ['sign-in, too many codes (52)', '/sign-in/', { 'email-otp/send-verification-otp': social({ status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '900' } }) }, "You've asked for several codes. Wait 15 minutes, or use your password or Google.", async () => {}],
  ];
  for (const [name, path, overrides, text] of cases) {
    test(`${name}: the banner keeps its words and carries the button back to step 1, focus on Google`, async ({ page }) => {
      await mockAuth(page, overrides);
      await page.goto(`${site.url}${path}`);
      await page.getByLabel('Email').fill('nitin@example.com');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Email me a code' }).click();
      const ban = page.locator('.auth-card .ban');
      await expect(ban.locator('.ban-text')).toContainText(text);
      const back = ban.getByRole('button', { name: 'Use Google instead' });
      await expect(back).toBeVisible();
      expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
      await back.click();
      await expect(google(page)).toBeFocused();
      await expect(page.locator('.auth-card .ban')).toHaveCount(0);
      // The address typed before stays in the field.
      await expect(page.getByLabel('Email')).toHaveValue('nitin@example.com');
    });
  }

  test('a banner without Google in its words has no such button', async ({ page }) => {
    await mockAuth(page, { 'email-otp/send-verification-otp': social({ status: 403, body: { code: 'TURNSTILE_FAILED' } }) });
    await page.goto(`${site.url}/sign-in/`);
    await page.getByLabel('Email').fill('nitin@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.locator('.auth-card .ban')).toHaveText("We couldn't confirm this browser. Please try again.");
    await expect(page.getByRole('button', { name: 'Use Google instead' })).toHaveCount(0);
  });
});

test.describe('the centred frame (GSI-UX)', () => {
  for (const width of [1440, 390, 320]) {
    test(`at ${width}: one panel centred on the page, the title inside it, privacy and terms under it`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
      await mockAuth(page);
      for (const path of ['/sign-in/', '/sign-up/', '/sign-in/reset/']) {
        await page.goto(`${site.url}${path}`);
        await page.locator('.auth-card').waitFor();
        const panel = (await page.locator('.auth-page').boundingBox())!;
        expect(Math.abs(panel.x + panel.width / 2 - width / 2), path).toBeLessThan(2);
        const h1 = (await page.locator('.auth-head h1').boundingBox())!;
        expect(h1.y).toBeGreaterThan(panel.y);
        expect(Math.abs(h1.x + h1.width / 2 - width / 2)).toBeLessThan(2);
        const card = (await page.locator('.auth-card').boundingBox())!;
        expect(card.y + card.height).toBeLessThanOrEqual(panel.y + panel.height);
        const legal = page.getByRole('navigation', { name: 'Privacy and terms' });
        await expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/#accounts');
        await expect(legal.getByRole('link', { name: 'Terms and copyright' })).toHaveAttribute('href', '/terms/');
        expect((await legal.boundingBox())!.y).toBeGreaterThan(panel.y + panel.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await context.close();
    });
  }

  test('sign-in step 1: what comes next, "Forgot password?" and "Create an account", each keeping next', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/?next=%2Fmine%2F`);
    const cont = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(page.locator('.auth-next')).toHaveText('Next, choose a code we email you or a password.');
    expect(await cont.getAttribute('aria-describedby')).toBe(await page.locator('.auth-next').getAttribute('id'));
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/sign-in/reset/?next=%2Fmine%2F');
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up/?next=%2Fmine%2F');
    // The address typed so far goes with "Forgot password?" to the reset page.
    await page.getByLabel('Email').fill('Nitin@Example.com');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.waitForURL(`${site.url}/sign-in/reset/?next=%2Fmine%2F`);
    await expect(page.getByLabel('Email')).toHaveValue('nitin@example.com');
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in/?next=%2Fmine%2F');
  });

  test('sign-up step 1: "Sign in" keeps next, and there is no "Forgot password?"', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-up/?next=%2Fplaces%2Flake-louise%2F`);
    await expect(page.locator('.auth-card').getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '/sign-in/?next=%2Fplaces%2Flake-louise%2F');
    await expect(page.locator('.auth-card').getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
  });

  test('a hostile next is never carried into the links', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/?next=https%3A%2F%2Fevil.example%2F`);
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up/');
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/sign-in/reset/');
  });
});

test.describe('browser hints (strings 8 and 9)', () => {
  test('cookies blocked: string 9 at the top of the card, every method still there', async ({ page }) => {
    await mockAuth(page);
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'cookieEnabled', { get: () => false }));
    await page.goto(`${site.url}/sign-in/`);
    await expect(banner(page).first()).toHaveText(S.cookies);
    await expect(google(page)).toBeEnabled();
    await expect(page.getByLabel('Email')).toBeEnabled();
  });

  test('an in-app browser: string 8 above the button, which stays enabled', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
    await mockAuth(page);
    await page.goto(`${site.url}/sign-in/`);
    await expect(banner(page)).toHaveText(S.inApp);
    await expect(google(page)).toBeEnabled();
    const ban = (await banner(page).boundingBox())!;
    const btn = (await google(page).boundingBox())!;
    expect(ban.y).toBeLessThan(btn.y);
    await context.close();
  });
});

test.describe('phones', () => {
  for (const width of [320, 390]) {
    test(`at ${width}: the button is above the fold on one line, no horizontal scroll, 44 px targets`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
      await mockAuth(page);
      await page.goto(`${site.url}/sign-in/`);
      const b = (await google(page).boundingBox())!;
      expect(b.y + b.height).toBeLessThan(844);
      expect(b.height).toBeGreaterThanOrEqual(43.9);
      const label = (await google(page).locator('.auth-google-label').boundingBox())!;
      expect(label.height).toBeLessThan(26); // one line
      const link = (await page.getByRole('link', { name: 'What we keep' }).boundingBox())!;
      expect(link.height).toBeGreaterThanOrEqual(43.9);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await context.close();
    });
  }
});
