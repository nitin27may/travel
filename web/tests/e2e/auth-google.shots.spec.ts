// Screenshots of every Continue with Google state on the sign-in card (GSI-1; copy page strings 1 to 22) at 320, 390 and 1440, light and
// dark, 2x, with the network mocked. Opt-in: set AUTH_SHOTS_DIR to the folder to write (kept outside web/test-results, which a later run
// wipes). Needs .fixture-auth (Google on).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import type { Server } from './fixtures';
import { authBuildPresent, mockAuth, type Override, startAuthSite } from './auth-mock';
import { setTheme, THEMES } from './shots';

const DIR = process.env.AUTH_SHOTS_DIR;
test.skip(!DIR || !authBuildPresent(), 'set AUTH_SHOTS_DIR and build web/.fixture-auth');
test.use({ deviceScaleFactor: 2 });

const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 640 },
] as const;

let site: Server;
test.beforeAll(async () => {
  site = await startAuthSite();
  mkdirSync(DIR as string, { recursive: true });
});
test.afterAll(() => site?.stop());

const google = (p: Page) => p.getByRole('button', { name: 'Continue with Google' });
const answer = (status: number, body: unknown, headers: Record<string, string> = {}): Override => () => ({ status, body, headers });

interface State {
  name: string;
  path: string;
  overrides?: Record<string, Override>;
  init?: string;
  userAgent?: string;
  steps?: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  { name: 'g01-sign-in', path: '/sign-in/' },
  { name: 'g02-sign-up', path: '/sign-up/' },
  {
    name: 'g03-opening',
    path: '/sign-in/',
    steps: async (p) => {
      await p.route('**/api/auth/sign-in/social/', () => new Promise(() => {})); // never answers: the in-flight state
      await google(p).click();
      await expect(google(p)).toHaveAttribute('aria-busy', 'true');
    },
  },
  { name: 'g04-cancelled', path: '/sign-in/?error=access_denied' },
  { name: 'g05-account-exists', path: '/sign-in/?error=account_not_linked' },
  { name: 'g06-restart', path: '/sign-up/?error=state_mismatch' },
  { name: 'g07-unavailable', path: '/sign-in/?error=unable_to_create_user' },
  {
    name: 'g08-rate-limited',
    path: '/sign-in/',
    overrides: { 'sign-in/social': answer(429, { code: 'RATE_LIMITED' }, { 'retry-after': '900' }) },
    steps: async (p) => {
      await google(p).click();
      await p.locator('.auth-card .ban').waitFor();
    },
  },
  {
    name: 'g09-start-failed',
    path: '/sign-in/',
    overrides: { 'sign-in/social': answer(200, { redirect: true }) },
    steps: async (p) => {
      await google(p).click();
      await p.locator('.auth-card .ban').waitFor();
    },
  },
  {
    name: 'g10-offline',
    path: '/sign-in/',
    steps: async (p) => {
      await p.context().setOffline(true);
      await google(p).click();
      await p.locator('.auth-card .ban').waitFor();
      await p.context().setOffline(false);
    },
  },
  { name: 'g11-last-used', path: '/sign-in/', init: "localStorage.setItem('auth.lastMethod', 'google')" },
  { name: 'g12-cookies-off', path: '/sign-in/', init: "Object.defineProperty(Navigator.prototype, 'cookieEnabled', { get: () => false })" },
  { name: 'g13-in-app', path: '/sign-in/', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0' },
  { name: 'g14-did-not-finish', path: '/sign-in/?neon_auth_session_verifier=v1', init: "sessionStorage.setItem('auth.googlePending', String(Date.now() - 5000))" },
  {
    name: 'g15-code-send-failed',
    path: '/sign-up/',
    overrides: { 'email-otp/send-verification-otp': answer(503, { code: 'SEND_FAILED' }) },
    steps: async (p) => {
      await p.getByLabel('Email').fill('nitin@example.com');
      await p.getByRole('button', { name: 'Continue', exact: true }).click();
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.locator('.auth-card .ban').waitFor();
    },
  },
];

for (const state of STATES) {
  for (const size of SIZES) {
    for (const theme of THEMES) {
      test(`${state.name} ${theme} ${size.width}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA', ...(state.userAgent ? { userAgent: state.userAgent } : {}) });
        const page = await context.newPage();
        await page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());
        await mockAuth(page, state.overrides ?? {});
        await page.route('https://accounts.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google</h1>' }));
        await setTheme(page, theme);
        if (state.init) await page.addInitScript(state.init);
        await page.goto(`${site.url}${state.path}`);
        await google(page).waitFor();
        await page.evaluate(() => document.fonts.ready);
        if (state.steps) await state.steps(page);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(DIR as string, `${state.name}-${size.width}-${theme}.png`), fullPage: true });
        await context.close();
      });
    }
  }
}

