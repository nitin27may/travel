// Screenshots of every state of the sign-in card (EML-1) at 1440 x 900, 390 x 844 and 320 x 640 (GSI-UX), light and dark, 2x, with the
// network mocked.
// Opt-in: set AUTH_SHOTS_DIR to the folder to write (kept outside web/test-results, which a later run wipes). Needs .fixture-auth.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import type { Server } from './fixtures';
import { authBuildPresent, GOOD_CODE, mockAuth, type Override, startAuthSite } from './auth-mock';
import { setTheme, SIZES as SHOT_SIZES, THEMES } from './shots';

// The smallest phone too: the centred frame must hold every step at 320 px (GSI-UX).
const SIZES = [...SHOT_SIZES, { width: 320, height: 640 }] as const;

const DIR = process.env.AUTH_SHOTS_DIR;
test.skip(!DIR || !authBuildPresent(), 'set AUTH_SHOTS_DIR and build web/.fixture-auth');
test.use({ deviceScaleFactor: 2 });

let site: Server;
test.beforeAll(async () => {
  site = await startAuthSite();
  mkdirSync(DIR as string, { recursive: true });
});
test.afterAll(() => site?.stop());

interface State {
  name: string;
  path: string;
  overrides?: Record<string, Override>;
  /** Install Playwright's clock before loading (states that move time forward). */
  clock?: boolean;
  turnstile?: 'pass' | 'challenge';
  steps: (page: Page) => Promise<void>;
}

const email = (address = 'nitin@example.com') => async (page: Page) => {
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
};
const code = async (page: Page) => {
  await email()(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Code').waitFor();
};
const password = async (page: Page) => {
  await email()(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
};
const pw = (page: Page) => page.locator('.auth-card input[name="password"]');
const bad = (status: number, c: string, retry?: string): Override => () => ({ status, body: { code: c }, headers: retry ? { 'retry-after': retry } : ({} as Record<string, string>) });

const STATES: State[] = [
  { name: '01-email', path: '/sign-in/', steps: async (p) => void (await p.getByLabel('Email').waitFor()) },
  {
    name: '02-email-invalid',
    path: '/sign-in/',
    steps: async (p) => {
      await email('not an address')(p);
      await p.getByText('Enter an email address').waitFor();
    },
  },
  { name: '03-chooser', path: '/sign-in/', steps: email() },
  { name: '04-code', path: '/sign-in/', steps: code },
  {
    name: '05-code-wrong',
    path: '/sign-in/',
    overrides: { 'sign-in/email-otp': bad(400, 'INVALID_OTP') },
    steps: async (p) => {
      await code(p);
      await p.getByLabel('Code').fill('000000');
      await p.getByText("That code didn't work").waitFor();
    },
  },
  {
    name: '06-code-too-many',
    path: '/sign-in/',
    overrides: { 'sign-in/email-otp': bad(403, 'TOO_MANY_ATTEMPTS') },
    steps: async (p) => {
      await code(p);
      await p.getByLabel('Code').fill('000000');
      await p.getByText('Too many tries').waitFor();
    },
  },
  {
    name: '07-code-expired',
    path: '/sign-in/',
    overrides: { 'sign-in/email-otp': bad(400, 'OTP_EXPIRED') },
    steps: async (p) => {
      await code(p);
      await p.getByLabel('Code').fill('000000');
      await p.getByText('That code has expired').waitFor();
    },
  },
  { name: '08-password', path: '/sign-in/', steps: password },
  {
    name: '09-password-wrong',
    path: '/sign-in/',
    steps: async (p) => {
      await password(p);
      await pw(p).fill('wrong-password');
      await p.getByRole('button', { name: 'Sign in' }).click();
      await p.getByText("We couldn't sign you in").waitFor();
    },
  },
  {
    name: '10-rate-limit-minute',
    path: '/sign-in/',
    overrides: { 'email-otp/send-verification-otp': bad(429, 'RATE_LIMITED', '42') },
    steps: async (p) => {
      await email()(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByText('Please wait a minute').waitFor();
    },
  },
  {
    name: '11-rate-limit-long',
    path: '/sign-in/',
    overrides: { 'email-otp/send-verification-otp': bad(429, 'RATE_LIMITED', '900') },
    steps: async (p) => {
      await email()(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByText('Wait 15 minutes').waitFor();
    },
  },
  {
    name: '12-send-failed',
    path: '/sign-in/',
    overrides: { 'email-otp/send-verification-otp': bad(503, 'SEND_FAILED') },
    steps: async (p) => {
      await email()(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByText("We couldn't send the email").waitFor();
    },
  },
  {
    name: '13-unverified-confirm',
    path: '/sign-in/',
    overrides: { 'sign-in/email': bad(403, 'EMAIL_NOT_VERIFIED') },
    steps: async (p) => {
      await password(p);
      await pw(p).fill('a-long-password');
      await p.getByRole('button', { name: 'Sign in' }).click();
      await p.getByText('Confirm your email first').waitFor();
    },
  },
  { name: '14-signup-email', path: '/sign-up/', steps: async (p) => void (await p.getByLabel('Email').waitFor()) },
  { name: '15-signup-chooser', path: '/sign-up/', steps: email('new@example.com') },
  {
    name: '16-signup-password',
    path: '/sign-up/',
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Create a password' }).click();
      await pw(p).fill('short');
      await p.getByRole('button', { name: 'Create account' }).click();
      await p.getByText('Use at least 8 characters.').last().waitFor();
    },
  },
  {
    name: '17-signup-verify',
    path: '/sign-up/',
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Create a password' }).click();
      await pw(p).fill('a-long-new-password');
      await p.getByRole('button', { name: 'Create account' }).click();
      await p.getByRole('button', { name: 'Confirm email' }).waitFor();
    },
  },
  {
    name: '18-signup-wait-minute',
    path: '/sign-up/',
    overrides: { 'sign-up/email': bad(429, 'RATE_LIMITED', '37') },
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Create a password' }).click();
      await pw(p).fill('a-long-new-password');
      await p.getByRole('button', { name: 'Create account' }).click();
      await p.getByText('Please wait a minute').waitFor();
    },
  },
  { name: '19-reset-email', path: '/sign-in/reset/', steps: async (p) => void (await p.getByLabel('Email').waitFor()) },
  {
    name: '20-reset-code',
    path: '/sign-in/reset/',
    steps: async (p) => {
      await p.getByLabel('Email').fill('nitin@example.com');
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByLabel('Code').fill(GOOD_CODE);
    },
  },
  {
    name: '21-reset-done-signed-out',
    path: '/sign-in/reset/',
    overrides: { 'sign-in/email': bad(503, 'GUARD_UNAVAILABLE') },
    steps: async (p) => {
      await p.getByLabel('Email').fill('nitin@example.com');
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByLabel('Code').fill(GOOD_CODE);
      await pw(p).fill('a-new-long-password');
      await p.getByRole('button', { name: 'Set password' }).click();
      await p.getByRole('heading', { name: 'Your password is set' }).waitFor();
    },
  },
  // The EML-R fix round (review M1 to M5, S2 to S5).
  {
    name: '22-chooser-held-minute',
    path: '/sign-in/',
    overrides: { 'email-otp/send-verification-otp': bad(429, 'RATE_LIMITED', '42') },
    steps: async (p) => {
      await email()(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByRole('button', { name: /Email me a code \(in/ }).waitFor();
    },
  },
  {
    name: '23-chooser-held-long',
    path: '/sign-in/',
    overrides: { 'email-otp/send-verification-otp': bad(429, 'RATE_LIMITED', '900') },
    steps: async (p) => {
      await email()(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByRole('button', { name: /Email me a code \(in 1[45] min\)/ }).waitFor();
    },
  },
  {
    name: '24-signup-chooser-held',
    path: '/sign-up/',
    overrides: { 'email-otp/send-verification-otp': bad(429, 'RATE_LIMITED', '900') },
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByRole('button', { name: /Email me a code \(in/ }).waitFor();
    },
  },
  {
    name: '25-signup-create-held',
    path: '/sign-up/',
    overrides: { 'sign-up/email': bad(429, 'RATE_LIMITED', '37') },
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Create a password' }).click();
      await pw(p).fill('a-long-new-password');
      await p.getByRole('button', { name: 'Create account' }).click();
      await p.getByRole('button', { name: /Create account \(in/ }).waitFor();
    },
  },
  {
    name: '26-reset-held',
    path: '/sign-in/reset/',
    overrides: { 'email-otp/request-password-reset': bad(429, 'RATE_LIMITED', '900') },
    steps: async (p) => {
      await p.getByLabel('Email').fill('nitin@example.com');
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByRole('button', { name: /Email me a code \(in/ }).waitFor();
    },
  },
  {
    name: '27-reset-send-failed',
    path: '/sign-in/reset/',
    overrides: { 'email-otp/request-password-reset': bad(503, 'SEND_FAILED') },
    steps: async (p) => {
      await p.getByLabel('Email').fill('nitin@example.com');
      await p.getByRole('button', { name: 'Email me a code' }).click();
      await p.getByText("We couldn't send the email. Try again shortly.").first().waitFor();
    },
  },
  {
    name: '28-code-dead-waiting',
    path: '/sign-in/',
    clock: true,
    overrides: { 'sign-in/email-otp': bad(403, 'TOO_MANY_ATTEMPTS') },
    steps: async (p) => {
      await code(p);
      await p.getByLabel('Code').fill('000000');
      await p.getByText(/Too many tries. You can send a new code in/).waitFor();
    },
  },
  {
    name: '29-code-dead-ready',
    path: '/sign-in/',
    clock: true,
    overrides: { 'sign-in/email-otp': bad(400, 'OTP_EXPIRED') },
    steps: async (p) => {
      await code(p);
      await p.getByLabel('Code').fill('000000');
      await p.clock.fastForward(61_000);
      await p.getByText('That code has expired. Send a new code.').waitFor();
    },
  },
  {
    name: '30-code-resent',
    path: '/sign-in/',
    clock: true,
    steps: async (p) => {
      await code(p);
      await p.clock.fastForward(61_000);
      await p.locator('.auth-alt-actions').getByRole('button', { name: 'Send a new code' }).click();
      await p.locator('.auth-card .ban-notice').waitFor();
    },
  },
  {
    name: '31-turnstile-challenge',
    path: '/sign-in/',
    turnstile: 'challenge',
    steps: async (p) => {
      await email()(p);
      await p.locator('.auth-card .ban-notice').waitFor();
    },
  },
  {
    name: '32-signup-password-code-instead',
    path: '/sign-up/',
    steps: async (p) => {
      await email('new@example.com')(p);
      await p.getByRole('button', { name: 'Create a password' }).click();
      await p.getByRole('button', { name: 'Email me a code instead' }).waitFor();
    },
  },
];

const ONLY = process.env.AUTH_SHOTS_ONLY ? new RegExp(process.env.AUTH_SHOTS_ONLY) : null;

for (const state of STATES.filter((st) => !ONLY || ONLY.test(st.name))) {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      test(`${state.name} ${theme} ${size.width}`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setTheme(page, theme);
        await page.setViewportSize(size);
        if (state.clock) await page.clock.install();
        await mockAuth(page, state.overrides, { turnstile: state.turnstile });
        await page.goto(`${site.url}${state.path}`);
        await page.locator('.auth-card').waitFor();
        await state.steps(page);
        await page.waitForTimeout(250); // the 120 ms reduced-motion fade
        await expect(page.locator('.auth-card')).toBeVisible();
        await page.screenshot({ path: path.join(DIR as string, `${state.name}-${theme}-${size.width}.png`) });
      });
    }
  }
}
