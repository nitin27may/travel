// The passwordless-first sign-in card (EML-1; email spec 3, 13 acceptance), with every network call mocked (auth-mock.ts). Runs on
// chromium and webkit-iphone against the flagged build `.fixture-auth` (code and Continue with Google on, as release B+C ships); skips when
// that build is missing. The Google part of the card has its own spec, auth-google.spec.ts.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { startNext, type Server } from './fixtures';
import { AUTH_DIST_NOCODE, authBuildPresent, GOOD_CODE, GOOD_PASSWORD, mockAuth, noCodeBuildPresent, startAuthSite } from './auth-mock';

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
/** The card's one polite live region (review M2). */
const live = (page: Page) => page.locator('.auth-card p[aria-live="polite"]');

async function toChooser(page: Page, path = '/sign-in/', email = '  Nitin@Example.com ') {
  await page.goto(`${site.url}${path}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('signs in with an emailed code: masked address, sender note, 5-minute copy, paste, auto-submit', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await expect(page.getByRole('heading', { name: 'How do you want to sign in?' })).toBeFocused();
  await expect(page.getByText('n…@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Email me a code' }).click();

  // Focus goes into the code field, so a paste or autofill works at once (review S1); the field describes the lead and address.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByLabel('Code')).toBeFocused();
  const described = (await page.getByLabel('Code').getAttribute('aria-describedby'))!.split(' ');
  const descriptions = await Promise.all(described.map((id) => page.locator(`[id="${id}"]`).textContent()));
  expect(descriptions.join(' ')).toContain('We sent a 6-digit code to');
  expect(descriptions.join(' ')).toContain('n…@example.com');
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
  await expect(page.getByLabel('Code')).toBeFocused();
  await page.keyboard.type(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
});

test('a wrong code is announced and selected, so typing replaces it (review M2, S7)', async ({ page }) => {
  await mockAuth(page, { 'sign-in/email-otp': () => ({ status: 400, body: { code: 'INVALID_OTP' } }) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = page.getByLabel('Code');
  await code.fill('000000');
  const message = "That code didn't work. Check it, or send a new one.";
  await expect(page.getByText(message)).toBeVisible();
  await expect(live(page)).toHaveText(message);
  const describedBy = (await code.getAttribute('aria-describedby'))!.split(' ');
  const texts = await Promise.all(describedBy.map((id) => page.locator(`[id="${id}"]`).textContent()));
  expect(texts.join(' ')).toContain(message);
  expect(await code.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 6]);
  await page.keyboard.type('1');
  await expect(code).toHaveValue('1');
});

for (const [dead, status, lead] of [
  ['TOO_MANY_ATTEMPTS', 403, 'Too many tries.'],
  ['OTP_EXPIRED', 400, 'That code has expired.'],
] as const) {
  test(`after ${dead} the code is dead until a new one is sent, then a resend is acknowledged (review M4, M5)`, async ({ page }) => {
    await page.clock.install();
    const calls = await mockAuth(page, { 'sign-in/email-otp': (b) => (b.otp === GOOD_CODE ? undefined : { status, body: { code: dead } }) });
    await toChooser(page);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    const code = page.getByLabel('Code');
    await code.fill('000000');
    await expect(code).toBeDisabled();
    await expect(code).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
    const resend = page.locator('.auth-actions').getByRole('button', { name: /^Send a new code \(in 0:[0-5]\d\)$/ });
    await expect(resend).toBeDisabled();
    await expect(page.getByText(new RegExp(`${lead} You can send a new code in 0:[0-5]\\d\\.`))).toBeVisible();
    await expect(live(page)).toContainText(lead);

    await page.clock.fastForward(61_000);
    const ready = page.locator('.auth-actions').getByRole('button', { name: 'Send a new code' });
    await expect(ready).toBeEnabled();
    await expect(page.getByText(`${lead} Send a new code.`)).toBeVisible();
    await expect(live(page)).toHaveText('You can send a new code now.');
    await ready.click();

    const resent = 'We sent a new code to n…@example.com. Use the newest email.';
    await expect(page.locator('.auth-card .ban-notice')).toHaveText(resent);
    await expect(live(page)).toHaveText(resent);
    await expect(code).toBeEnabled();
    await expect(code).toHaveValue('');
    await expect(code).toBeFocused();
    expect(calls.filter((c) => c.path === 'email-otp/send-verification-otp')).toHaveLength(2);
    await code.fill(GOOD_CODE);
    await page.waitForURL(`${site.url}/account/`);
  });
}

test('asks for six digits before sending a short code', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Code').fill('123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter the 6-digit code from the email.')).toBeVisible();
  expect(calls.some((c) => c.path === 'sign-in/email-otp')).toBe(false);
});

test('says when sending fails, on the sign-in page with the password as the way out', async ({ page }) => {
  const answers = [
    { status: 503, body: { code: 'SEND_FAILED' } },
    { status: 503, body: { code: 'SEND_UNAVAILABLE' } },
    { status: 403, body: { code: 'TURNSTILE_FAILED' } },
    { status: 503, body: { code: 'GUARD_UNAVAILABLE' } },
  ];
  await mockAuth(page, { 'email-otp/send-verification-otp': (_b, n) => answers[n - 1] });
  await toChooser(page);
  const send = page.getByRole('button', { name: 'Email me a code' });
  for (const text of [
    // Continue with Google is on in this build (B+C ships it on), so the way out names it too (Google copy page 54).
    "We couldn't send the email. Try again shortly, or use your password or Google.",
    "We couldn't send the email. Try again shortly, or use your password or Google.",
    "We couldn't confirm this browser. Please try again.",
    'Sign-in is unavailable right now. Try again shortly.',
  ]) {
    await send.click();
    // A banner that offers Google carries "Use Google instead" under its words (GSI-R S1); the words read out are the same.
    await expect(page.locator('.auth-card .ban')).toHaveText(text.endsWith('Google.') ? `${text}Use Google instead` : text);
    // Notices are read through the one live region, not a status node that arrives full (review M2).
    await expect(live(page)).toHaveText(text);
  }
});

test('a 429 holds "Email me a code" with the time left, promotes the password, and ends with an announcement (review M3)', async ({ page }) => {
  await page.clock.install();
  const calls = await mockAuth(page, { 'email-otp/send-verification-otp': (_b, n) => (n === 1 ? { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '42' } } : undefined) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText('Please wait a minute, then try again.');
  const held = page.getByRole('button', { name: /^Email me a code \(in 0:4[0-2]\)$/ });
  await expect(held).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Use my password' })).toHaveClass(/btn-primary/);
  await expect(page.getByRole('button', { name: 'Use my password' })).toBeEnabled();
  await page.clock.fastForward(43_000);
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toHaveClass(/btn-primary/);
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveCount(0);
  await expect(live(page)).toHaveText('You can ask for a code now.');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
  expect(calls.filter((c) => c.path === 'email-otp/send-verification-otp')).toHaveLength(2);
});

test('a long wait reads in minutes, and editing the address drops it', async ({ page }) => {
  await mockAuth(page, { 'email-otp/send-verification-otp': (b) => (b.email === 'nitin@example.com' ? { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '900' } } : undefined) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText("You've asked for several codes. Wait 15 minutes, or use your password or Google.Use Google instead"); // Google copy page 52, and GSI-R S1
  await expect(page.getByRole('button', { name: /^Email me a code \(in 1[45] min\)$/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Change email address' }).click();
  await page.getByLabel('Email').fill('other@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeEnabled();
});

test('the same address again within a minute goes straight back to the code step (review S6)', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
  await page.getByRole('button', { name: 'Change email address' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
  await expect(page.getByRole('button', { name: /Send a new code \(in 0:[0-5]\d\)/ })).toBeDisabled();
  expect(calls.filter((c) => c.path === 'email-otp/send-verification-otp')).toHaveLength(1);
});

test('the chooser help belongs to the code button only (review S3)', async ({ page }) => {
  await mockAuth(page);
  await toChooser(page, '/sign-up/', 'new@example.com');
  const code = page.getByRole('button', { name: 'Email me a code' });
  const help = page.getByText('No password needed: we email you a 6-digit code.');
  await expect(help).toBeVisible();
  expect(await code.getAttribute('aria-describedby')).toBe(await help.getAttribute('id'));
});

test('Turnstile asking for a person says so and shows the box (review S5)', async ({ page }) => {
  await mockAuth(page, {}, { turnstile: 'challenge' });
  await toChooser(page);
  await expect(page.locator('.auth-card .ban')).toHaveText('Tick the box below to continue.');
  await expect(live(page)).toHaveText('Tick the box below to continue.');
  await expect(page.locator('.fake-turnstile-box')).toBeInViewport();
  await page.evaluate(() => (window as unknown as { __solveTurnstile: () => void }).__solveTurnstile());
  await expect(page.locator('.auth-card .ban')).toHaveCount(0);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
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
  // "Confirm your email first." is its own sentence, so "to" never sits alone on a line (review S2).
  await expect(page.getByText('Confirm your email first.', { exact: true })).toBeVisible();
  await expect(page.getByText('We sent a 6-digit code to', { exact: true })).toBeVisible();
  // Neon sends nothing on sign-in (review MF2): the card asks for the code through the guarded send, with a Turnstile token.
  const send = calls.filter((c) => c.path === 'email-otp/send-verification-otp');
  expect(send).toHaveLength(1);
  expect(send[0].body).toEqual({ email: 'nitin@example.com', type: 'email-verification' });
  expect(send[0].turnstile).toMatch(/^cf-token-/);
  await page.getByLabel('Code').fill(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
  expect(calls.some((c) => c.path === 'email-otp/verify-email' && c.body.otp === GOOD_CODE)).toBe(true);
});

test('an unverified password account whose confirmation send is refused stays on the password step with the wait', async ({ page }) => {
  await mockAuth(page, {
    'sign-in/email': () => ({ status: 403, body: { code: 'EMAIL_NOT_VERIFIED' } }),
    'email-otp/send-verification-otp': () => ({ status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '40' } }),
  });
  await toChooser(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
  await pw(page).fill(GOOD_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.auth-card .ban').first()).toBeVisible();
  await expect(page.getByLabel('Code')).toHaveCount(0);
  await expect(pw(page)).toBeVisible();
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
  await expect(page.getByLabel('Code')).toBeFocused();
  const signUp = calls.find((c) => c.path === 'sign-up/email');
  expect(signUp?.body).toEqual({ email: 'new@example.com', password: 'a-long-new-password', name: '' });
  expect(signUp?.turnstile).toMatch(/^cf-token-/);
  await page.getByLabel('Code').fill(GOOD_CODE);
  await page.waitForURL(`${site.url}/account/`);
  expect(calls.some((c) => c.path === 'email-otp/verify-email')).toBe(true);
});

test('a second sign-up within a minute is told to wait a minute, with the time on the button (review M3)', async ({ page }) => {
  await mockAuth(page, { 'sign-up/email': () => ({ status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '37' } }) });
  await toChooser(page, '/sign-up/', 'new@example.com');
  await page.getByRole('button', { name: 'Create a password' }).click();
  await pw(page).fill('a-long-new-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText('Please wait a minute, then try again.');
  await expect(page.getByRole('button', { name: /^Create account \(in 0:3[0-7]\)$/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Email me a code instead \(in 0:3[0-7]\)$/ })).toBeDisabled();
});

test('the sign-up password step offers the code too (review S4)', async ({ page }) => {
  const calls = await mockAuth(page);
  await toChooser(page, '/sign-up/', 'new@example.com');
  await page.getByRole('button', { name: 'Create a password' }).click();
  await page.getByRole('button', { name: 'Email me a code instead' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
  expect(calls.find((c) => c.path === 'email-otp/send-verification-otp')?.body).toEqual({ email: 'new@example.com', type: 'sign-in' });
});

test('the reset page offers no way out it cannot keep, and holds its button through a wait (review M1, M3)', async ({ page }) => {
  await mockAuth(page, {
    'email-otp/request-password-reset': (_b, n) =>
      n === 1 ? { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '900' } } : { status: 503, body: { code: 'SEND_FAILED' } },
  });
  await page.goto(`${site.url}/sign-in/reset/`);
  await page.getByLabel('Email').fill('nitin@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.locator('.auth-card').getByRole('alert')).toHaveText("You've asked for several codes. Wait 15 minutes, then try again.");
  await expect(page.getByRole('button', { name: /^Email me a code \(in 1[45] min\)$/ })).toBeDisabled();
  await page.getByLabel('Email').fill('other@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.locator('.auth-card .ban')).toHaveText("We couldn't send the email. Try again shortly.");
  await expect(page.locator('.auth-card')).not.toContainText('use your password');
});

test('resets a password by code, signs straight in, and hands the address over from "Forgot password?"', async ({ page }) => {
  const calls = await mockAuth(page, { 'sign-in/email': (b) => (b.password === 'a-new-long-password' ? { status: 200, body: { token: 't' } } : undefined) });
  await toChooser(page);
  await page.getByRole('button', { name: 'Use my password' }).click();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.waitForURL(`${site.url}/sign-in/reset/`);
  await expect(page.getByLabel('Email')).toHaveValue('nitin@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Code')).toBeFocused();
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

test('after a reset whose sign-in fails, says the password is set and to sign in, keeping next (review S8)', async ({ page }) => {
  await mockAuth(page, { 'sign-in/email': () => ({ status: 503, body: { code: 'GUARD_UNAVAILABLE' } }) });
  await page.goto(`${site.url}/sign-in/reset/?next=%2Ftrips%2F`);
  await page.getByLabel('Email').fill('nitin@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Code').fill(GOOD_CODE);
  await pw(page).fill('a-new-long-password');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByRole('heading', { name: 'Your password is set' })).toBeFocused();
  // The page sub-line describes the steps still to come, so it goes once they are done (EML-V F2).
  await expect(page.getByText('We email you a code, then you choose a new password.', { exact: false })).toBeHidden();
  await expect(page.locator('.auth-card').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in/?next=%2Ftrips%2F');
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
  await expect(page.locator('.auth-card .field-error')).toHaveText('Enter an email address, like name@example.com.');
  expect(calls.filter((c) => c.path !== 'get-session')).toHaveLength(0);
});

test('fits a phone: no sideways scroll, 44 px targets on every step', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAuth(page, { 'sign-in/email-otp': () => ({ status: 403, body: { code: 'TOO_MANY_ATTEMPTS' } }) });
  const fits = async () => {
    await page.locator('.auth-card').waitFor();
    await page.waitForTimeout(200); // let the 120 ms step fade settle before measuring
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => `${el.tagName}.${el.className}`).slice(0, 5),
    );
    expect(wide).toEqual([]);
    // Nothing inside the card may cross the card's inner edge (EML-V F1: the code field spilled 3 px at 320 px).
    const spill = await page.evaluate(() => {
      const card = document.querySelector('.auth-card') as HTMLElement;
      const box = card.getBoundingClientRect();
      const cs = getComputedStyle(card);
      const left = box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) - 0.5;
      const right = box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) + 0.5;
      return [...card.querySelectorAll('*')]
        // Text actions bleed their 44 px hit area 8 px into the padding on purpose (their text aligns with the column).
        .filter((el) => !el.closest('.auth-turnstile') && !el.closest('.auth-link') && !el.classList.contains('sr-only') && el.getClientRects().length > 0)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > right || r.left < left);
        })
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 5);
    });
    expect(spill).toEqual([]);
    for (const el of await page.locator('.auth-card button:visible, .auth-card a:visible').all()) {
      const box = await el.boundingBox();
      expect(box?.height ?? 0, (await el.textContent()) ?? '').toBeGreaterThanOrEqual(43.9); // 44 px, allowing WebKit's sub-pixel rounding
    }
  };
  await page.goto(`${site.url}/sign-in/`);
  await fits();
  await page.getByLabel('Email').fill('a.very.long.address.for.testing@example-long-domain.test');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await fits();
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await fits();
  await page.getByLabel('Code').fill('000000');
  await expect(page.getByLabel('Code')).toBeDisabled(); // the dead state, with the wait in the error
  await fits();
  await page.getByRole('button', { name: 'Use my password instead' }).click();
  await fits();
});

test.describe('with the code option off (NEXT_PUBLIC_SIGN_IN_CODE unset)', () => {
  test.skip(!noCodeBuildPresent(), 'needs web/.fixture-auth-nocode (see tests/e2e/auth-mock.ts)');
  let off: Server;
  test.beforeAll(async () => {
    off = await startNext(AUTH_DIST_NOCODE);
  });
  test.afterAll(() => off?.stop());

  test('sign-in goes from the email straight to the password, with no code option', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${off.url}/sign-in/`);
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await page.getByLabel('Email').fill('nitin@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeFocused();
    await expect(page.getByText(/Email me a code/)).toHaveCount(0);
    await pw(page).fill(GOOD_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(`${off.url}/account/`);
  });

  test('sign-up goes straight to creating a password, then confirms the email by code', async ({ page }) => {
    await mockAuth(page);
    await page.goto(`${off.url}/sign-up/`);
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create a password' })).toBeFocused();
    await expect(page.getByText(/Email me a code/)).toHaveCount(0);
    await pw(page).fill('a-long-new-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByLabel('Code')).toBeFocused();
  });
});
