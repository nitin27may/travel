// The passwordless-first sign-in card (EML-1; email spec 3, 13 acceptance), with every network call mocked (auth-mock.ts). Runs on
// chromium and webkit-iphone against the flagged build `.fixture-auth`; skips when that build is missing.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import type { Server } from './fixtures';
import { authBuildPresent, GOOD_CODE, GOOD_PASSWORD, mockAuth, startAuthSite } from './auth-mock';

const SENDER_NOTE =
  "The email comes from Neon Auth (auth@mail.myneon.app), the service that runs our sign-in. If it isn't in your inbox within a minute, check your spam or junk folder.";

test.skip(!authBuildPresent(), 'needs web/.fixture-auth (see tests/e2e/auth-mock.ts)');

let site: Server;
test.beforeAll(async () => {
  site = await startAuthSite();
});
test.afterAll(() => site?.stop());

/** The password field (its label also carries the required mark, so it is found by name). */
const pw = (page: Page) => page.locator('.auth-card input[name="password"]');

async function toChooser(page: Page, path = '/sign-in/', email = '  Nitin@Example.com ') {
  await page.goto(`${site.url}${path}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('signs in with an emailed code: masked address, sender note, 5-minute copy, paste, auto-submit', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await expect(page.getByRole('heading', { name: 'How do you want to sign in?' })).toBeFocused();
  await expect(page.getByText('n…@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Email me a code' }).click();

  const heading = page.getByRole('heading', { name: 'Check your email' });
  await expect(heading).toBeFocused();
  await expect(page.getByText(SENDER_NOTE)).toBeVisible();
  await expect(page.getByText('The code works once, for 5 minutes.')).toBeVisible();
  await expect(page.getByText(/15 minutes/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Send a new code \(in 0:[0-5]\d\)/ })).toBeDisabled();

  const send = calls.find((c) => c.path === 'email-otp/send-verification-otp');
  expect(send?.body).toEqual({ email: 'nitin@example.com', type: 'sign-in' });
  expect(send?.turnstile).toMatch(/^cf-token-\d+$/);

  const code = page.getByLabel('Code');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await code.focus();
  await page.evaluate(async (text) => {
    const el = document.activeElement as HTMLInputElement;
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, '482 913');
  await page.waitForURL(`${site.url}/account/`);
  const signIn = calls.find((c) => c.path === 'sign-in/email-otp');
  expect(signIn?.body).toEqual({ email: 'nitin@example.com', otp: GOOD_CODE });
  expect(await page.evaluate(() => localStorage.getItem('auth.lastMethod'))).toBe('code');
});

test('walks the code path with the keyboard only', async ({ page, browserName }) => {
  // WebKit does not Tab to buttons unless the system setting is on, so the keyboard walk is a Chromium check.
  test.skip(browserName === 'webkit', 'Safari tabs to form fields only by default');
  await mockAuth(page);
  await page.goto(`${site.url}/sign-in/`);
  await page.getByLabel('Email').focus();
  await page.keyboard.type('nitin@example.com');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'How do you want to sign in?' })).toBeFocused();
  // Heading, then "Change", then the primary choice.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();
  await page.getByLabel('Code').focus();
  await page.keyboard.type(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
});

test('shows each code error in place, tied to the field', async ({ page }) => {
  const answers = [
    { status: 400, body: { code: 'INVALID_OTP' } },
    { status: 400, body: { code: 'OTP_EXPIRED' } },
    { status: 403, body: { code: 'TOO_MANY_ATTEMPTS' } },
  ];
  await mockAuth(page, { 'sign-in/email-otp': (_b, n) => answers[n - 1] });
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = page.getByLabel('Code');
  for (const [i, message] of ["That code didn't work. Check it, or send a new one.", 'That code has expired. Send a new one.', 'Too many tries. Send a new code.'].entries()) {
    await code.fill('');
    await code.fill('000000');
    await expect(page.getByText(message)).toBeVisible();
    const describedBy = await code.getAttribute('aria-describedby');
    expect(await page.locator(`[id="${describedBy}"]`).textContent()).toContain(message);
    if (i > 0) await expect(code).toHaveValue('');
  }
});

test('asks for six digits before sending a short code', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Code').fill('123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter the 6-digit code from the email.')).toBeVisible();
  expect(calls.some((c) => c.path === 'sign-in/email-otp')).toBe(false);
});

test('says to wait a minute, or how long, from Retry-After; and when sending fails', async ({ page }) => {
  const answers = [
    { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '42' } },
    { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '900' } },
    { status: 503, body: { code: 'SEND_FAILED' } },
    { status: 503, body: { code: 'SEND_UNAVAILABLE' } },
    { status: 403, body: { code: 'TURNSTILE_FAILED' } },
    { status: 503, body: { code: 'GUARD_UNAVAILABLE' } },
  ];
  await mockAuth(page, { 'email-otp/send-verification-otp': (_b, n) => answers[n - 1] });
  await toChooser(page);
  const send = page.getByRole('button', { name: 'Email me a code' });
  for (const text of [
    'Please wait a minute, then try again.',
    "You've asked for several codes. Wait 15 minutes, or use your password.",
    "We couldn't send the email. Try again shortly, or use your password.",
    "We couldn't send the email. Try again shortly, or use your password.",
    "We couldn't confirm this browser. Please try again.",
    'Sign-in is unavailable right now. Try again shortly.',
  ]) {
    await send.click();
    await expect(page.locator('.auth-card').getByRole('alert').or(page.getByRole('status')).filter({ hasText: text })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'How do you want to sign in?' })).toBeVisible();
});

test('signs in with a password, and remembers it as the first choice next time', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeFocused();
  await pw(page).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText("We couldn't sign you in. Check your email and password.");
  await pw(page).fill(GOOD_PASSWORD);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(pw(page)).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${site.url}/account/`);
  expect(calls.filter((c) => c.path === 'sign-in/email').map((c) => c.body.email)).toEqual(['nitin@example.com', 'nitin@example.com']);
  // Password sign-in needs no Turnstile (spec 5.3).
  expect(calls.filter((c) => c.path === 'sign-in/email').every((c) => c.turnstile === null)).toBe(true);

  await toChooser(page);
  const choices = page.locator('.auth-choices .btn');
  await expect(choices.first()).toHaveText('Use my password');
  await expect(choices.first()).toHaveClass(/btn-primary/);
});

test('an unverified password account goes to the code step to confirm the email', async ({ page }) => {
  const calls = await mockAuth(page, { 'sign-in/email': () => ({ status: 403, body: { code: 'EMAIL_NOT_VERIFIED' } }) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
  await pw(page).fill(GOOD_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Confirm your email first. We sent a code to')).toBeVisible();
  await page.getByLabel('Code').fill(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
  expect(calls.some((c) => c.path === 'email-otp/verify-email' && c.body.otp === GOOD_CODE)).toBe(true);
});

test('sign-up with a password sends no name, then confirms the email by code', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page, '/sign-up/', 'new@example.com');
  await expect(page.getByLabel('Name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a password' }).click();
  await pw(page).fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Use at least 8 characters.').last()).toBeVisible();
  await pw(page).fill('a-long-new-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();
  const signUp = calls.find((c) => c.path === 'sign-up/email');
  expect(signUp?.body).toEqual({ email: 'new@example.com', password: 'a-long-new-password', name: '' });
  expect(signUp?.turnstile).toMatch(/^cf-token-/);
  await page.getByLabel('Code').fill(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
  expect(calls.some((c) => c.path === 'email-otp/verify-email')).toBe(true);
});

test('a second sign-up within a minute is told to wait a minute', async ({ page }) => {
  await mockAuth(page, { 'sign-up/email': () => ({ status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '37' } }) });
  await toChooser(page, '/sign-up/', 'new@example.com');
  await page.getByRole('button', { name: 'Create a password' }).click();
  await pw(page).fill('a-long-new-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText('Please wait a minute, then try again.');
});

test('resets a password by code, signs straight in, and hands the address over from "Forgot password?"', async ({ page }) => {
  const calls = await mockAuth(page, { 'sign-in/email': (b) => (b.password === 'a-new-long-password' ? { status: 200, body: { token: 't' } } : undefined) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.waitForURL(`${site.url}/sign-in/reset/`);
  await expect(page.getByLabel('Email')).toHaveValue('nitin@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();
  await expect(page.getByText(SENDER_NOTE)).toBeVisible();
  await page.getByLabel('Code').fill(GOOD_CODE);
  // Six digits do not submit here: the new password comes first.
  await expect(page).toHaveURL(`${site.url}/sign-in/reset/`);
  await pw(page).fill('a-new-long-password');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.waitForURL(`${site.url}/account/`);
  const order = calls.map((c) => c.path).filter((p) => p !== 'get-session');
  expect(order.slice(-2)).toEqual(['email-otp/reset-password', 'sign-in/email']);
  expect(calls.find((c) => c.path === 'email-otp/request-password-reset')?.turnstile).toMatch(/^cf-token-/);
});

test('after a reset whose sign-in fails, says the password is set and to sign in', async ({ page }) => {
  await mockAuth(page, { 'sign-in/email': () => ({ status: 503, body: { code: 'GUARD_UNAVAILABLE' } }) });
  await page.goto(`${site.url}/sign-in/reset/`);
  await page.getByLabel('Email').fill('nitin@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Code').fill(GOOD_CODE);
  await pw(page).fill('a-new-long-password');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByRole('heading', { name: 'Your password is set' })).toBeFocused();
  await expect(page.locator('.auth-card').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in/');
});

test('follows a checked next, and refuses a hostile one', async ({ page }) => {
  await mockAuth(page);
  await toChooser(page, '/sign-in/?next=%2Ftrips%2F');
  await page.getByRole('button', { name: 'Use my password' }).click();
  await pw(page).fill(GOOD_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${site.url}/trips/`);
  await toChooser(page, '/sign-in/?next=https%3A%2F%2Fevil.example%2F');
  await page.getByRole('button', { name: 'Use my password' }).click();
  await pw(page).fill(GOOD_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${site.url}/account/`);
});

test('"Change" goes back to the email with the address kept and focused', async ({ page }) => {
  await mockAuth(page);
  await toChooser(page);
  await page.getByRole('button', { name: 'Change email address' }).click();
  const email = page.getByLabel('Email');
  await expect(email).toBeFocused();
  await expect(email).toHaveValue('nitin@example.com');
});

test('refuses a malformed address before any call', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page, '/sign-in/', 'not an address');
  await expect(page.getByText('Enter an email address, like name@example.com.')).toBeVisible();
  expect(calls.filter((c) => c.path !== 'get-session')).toHaveLength(0);
});

test('fits a phone: no sideways scroll, 44 px targets on every step', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mockAuth(page);
  const fits = async () => {
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => `${el.tagName}.${el.className}`).slice(0, 5),
    );
    expect(wide).toEqual([]);
    for (const el of await page.locator('.auth-card button:visible, .auth-card a:visible').all()) {
      const box = await el.boundingBox();
      expect(box?.height ?? 0, (await el.textContent()) ?? '').toBeGreaterThanOrEqual(43.9); // 44 px, allowing WebKit's sub-pixel rounding
    }
  };
  await page.goto(`${site.url}/sign-in/`);
  await fits();
  await page.getByLabel('Email').fill('a.very.long.address.for.testing@example-long-domain.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await fits();
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await fits();
  await page.getByRole('button', { name: 'Use my password instead' }).click();
  await fits();
});
