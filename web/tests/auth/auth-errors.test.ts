import { describe, expect, it } from 'vitest';
import { authProblem, COPY, deadCodeMessage, maskAddress, resentMessage, waitPhrase, type AuthAction, type AuthPage } from '@/lib/auth/auth-errors';
import { timeLeft } from '@/components/auth/live';
import { authFlagsFrom } from '@/lib/auth/flags';
import { clock, codeDigits } from '@/components/auth/CodeStep';

const a = (status: number, code = '', retryAfterS: number | null = null) => ({ status, code, retryAfterS });

describe('auth answer copy (spec 3.3)', () => {
  it('is null for a success', () => {
    expect(authProblem(a(200), 'send', { page: 'sign-in' })).toBeNull();
  });

  it.each([
    ['send', a(429, 'RATE_LIMITED', 30), 'Please wait a minute, then try again.'],
    ['sign-up', a(429, 'RATE_LIMITED', 42), 'Please wait a minute, then try again.'],
    ['send', a(429, 'RATE_LIMITED', 900), "You've asked for several codes. Wait 15 minutes, or use your password."],
    ['send', a(429, 'RATE_LIMITED', 14 * 3600), "You've asked for several codes. Wait 14 hours, or use your password."],
    ['password', a(429, '', 600), 'Too many attempts. Wait 10 minutes, or sign in with a code.'],
    ['verify', a(429, 'RATE_LIMITED', 1800), 'Too many tries. Wait 30 minutes, then send a new code.'],
    ['send', a(403, 'TURNSTILE_FAILED'), COPY.browserCheck],
    ['send', a(503, 'TURNSTILE_UNAVAILABLE'), COPY.browserCheck],
    ['send', a(503, 'SEND_UNAVAILABLE', 3000), COPY.sendFailed],
    ['send', a(503, 'SEND_FAILED'), COPY.sendFailed],
    ['send', a(503, 'GUARD_UNAVAILABLE'), COPY.service],
    ['password', a(502, 'UPSTREAM_ERROR'), COPY.service],
    ['send', a(403, 'FORBIDDEN'), COPY.service],
    ['send', a(0, 'NETWORK'), COPY.service],
    ['send', a(0, 'OFFLINE'), COPY.offline],
    ['password', a(401, 'INVALID_EMAIL_OR_PASSWORD'), COPY.credentials],
    ['sign-up', a(400, 'EMAIL_PASSWORD_SIGN_UP_DISABLED'), COPY.signUpClosed],
    ['sign-up', a(400, 'SOMETHING_NEW'), COPY.signUpFailed],
  ] as const)('%s %j -> %s', (action, answer, message) => {
    expect(authProblem(answer, action as AuthAction, { page: 'sign-in' })?.message).toBe(message);
  });

  it.each([
    ['sign-in', "You've asked for several codes. Wait 15 minutes, or use your password.", "We couldn't send the email. Try again shortly, or use your password."],
    ['sign-up', "You've asked for several codes. Wait 15 minutes, then try again.", "We couldn't send the email. Try again shortly."],
    ['reset', "You've asked for several codes. Wait 15 minutes, then try again.", "We couldn't send the email. Try again shortly."],
  ] as const)('offers "use your password" only where it is another bucket: %s (review M1)', (page, quota, failed) => {
    expect(authProblem(a(429, 'RATE_LIMITED', 900), 'send', { page: page as AuthPage })?.message).toBe(quota);
    expect(authProblem(a(503, 'SEND_FAILED'), 'send', { page: page as AuthPage })?.message).toBe(failed);
    expect(authProblem(a(503, 'SEND_UNAVAILABLE'), 'send', { page: page as AuthPage })?.message).toBe(failed);
    if (page !== 'sign-in') expect(authProblem(a(429, '', 900), 'sign-up', { page: page as AuthPage })?.message).not.toMatch(/password/);
  });

  it('marks a dead code and words the wait (review M4)', () => {
    expect(authProblem(a(403, 'TOO_MANY_ATTEMPTS'), 'verify', { page: 'sign-in' })?.deadCode).toBe('TOO_MANY_ATTEMPTS');
    expect(authProblem(a(400, 'OTP_EXPIRED'), 'verify', { page: 'sign-in' })?.deadCode).toBe('OTP_EXPIRED');
    expect(authProblem(a(400, 'INVALID_OTP'), 'verify', { page: 'sign-in' })?.deadCode).toBeUndefined();
    expect(deadCodeMessage('TOO_MANY_ATTEMPTS', '0:24')).toBe('Too many tries. You can send a new code in 0:24.');
    expect(deadCodeMessage('OTP_EXPIRED', '0:24')).toBe('That code has expired. You can send a new code in 0:24.');
    expect(deadCodeMessage('TOO_MANY_ATTEMPTS', null)).toBe('Too many tries. Send a new code.');
  });

  it('acknowledges a resend with the masked address only (review M5)', () => {
    expect(resentMessage('nitin@gmail.com')).toBe('We sent a new code to n…@gmail.com. Use the newest email.');
    expect(resentMessage('nitin@gmail.com')).not.toContain('nitin@');
  });

  it('puts the time left in a button label (review M3)', () => {
    expect(timeLeft(42)).toBe('0:42');
    expect(timeLeft(600)).toBe('10:00');
    expect(timeLeft(601)).toBe('11 min');
    expect(timeLeft(900)).toBe('15 min');
  });

  it('says "or sign in with a code" only when the code option is on', () => {
    expect(authProblem(a(429, '', 600), 'password', { page: 'sign-in', codeOn: false })?.message).toBe('Too many attempts. Wait 10 minutes, then try again.');
  });

  it.each([
    ['INVALID_OTP', COPY.wrongCode, false],
    ['TOO_MANY_ATTEMPTS', COPY.tooManyTries, true],
    ['OTP_EXPIRED', COPY.expired, true],
  ] as const)('puts %s under the code field', (code, message, clear) => {
    const p = authProblem(a(code === 'TOO_MANY_ATTEMPTS' ? 403 : 400, code), 'verify', { page: 'sign-in' });
    expect(p).toMatchObject({ where: 'field', field: 'code', message });
    expect(Boolean(p?.clearCode)).toBe(clear);
  });

  it('puts address and password problems under their fields', () => {
    expect(authProblem(a(400, 'INVALID_EMAIL'), 'send', { page: 'sign-in' })).toMatchObject({ where: 'field', field: 'email', message: COPY.badEmail });
    expect(authProblem(a(400, 'PASSWORD_TOO_SHORT'), 'sign-up', { page: 'sign-up' })).toMatchObject({ where: 'field', field: 'password' });
    expect(authProblem(a(400, 'PASSWORD_TOO_LONG'), 'reset', { page: 'reset' })).toMatchObject({ where: 'field', field: 'password' });
  });

  it('never carries input text into a message', () => {
    for (const action of ['send', 'verify', 'password', 'sign-up', 'reset'] as const) {
      for (const status of [0, 400, 401, 403, 404, 413, 422, 429, 500, 503]) {
        const p = authProblem(a(status, 'visitor@example.test 482913', 60), action, { page: 'sign-in' });
        expect(p?.message ?? '').not.toMatch(/visitor|482913|example\.test/);
      }
    }
  });

  it('states the Phase 1 sender note and the 5-minute code life exactly', () => {
    expect(COPY.senderNote).toBe(
      "The email comes from Neon Auth (auth@mail.myneon.app), the service that runs our sign-in. If it isn't in your inbox within a minute, check your spam or junk folder.",
    );
    expect(COPY.codeLifetime).toBe('The code works once, for 5 minutes.');
    expect(Object.values(COPY).join(' ')).not.toMatch(/15 minutes/);
  });

  it('words a wait from Retry-After', () => {
    expect(waitPhrase(null)).toBe('a minute');
    expect(waitPhrase(60)).toBe('a minute');
    expect(waitPhrase(91)).toBe('2 minutes');
    expect(waitPhrase(3599)).toBe('60 minutes');
    expect(waitPhrase(7200)).toBe('2 hours');
  });

  it('masks the address after step 1', () => {
    expect(maskAddress('nitin@gmail.com')).toBe('n…@gmail.com');
    expect(maskAddress('x')).toBe('…');
  });
});

describe('code entry', () => {
  it.each([
    ['482913', '482913'],
    ['482 913', '482913'],
    ['482-913', '482913'],
    [' 4 8 2 9 1 3 ', '482913'],
    ['Your code is 482913.', '482913'],
    ['4829135', '482913'],
    ['abc', ''],
  ])('%j -> %s', (raw, want) => {
    expect(codeDigits(raw)).toBe(want);
  });

  it('formats the cooldown', () => {
    expect(clock(42)).toBe('0:42');
    expect(clock(60)).toBe('1:00');
    expect(clock(0.2)).toBe('0:01');
    expect(clock(-3)).toBe('0:00');
  });
});

describe('sign-in flags (spec 11.1)', () => {
  it('turns the code option on only with sign-in on', () => {
    expect(authFlagsFrom({ signIn: '1', code: '1' }).signInCode).toBe(true);
    expect(authFlagsFrom({ signIn: '', code: '1' }).signInCode).toBe(false);
    expect(authFlagsFrom({ signIn: '1' }).signInCode).toBe(false);
  });

  it('never offers a link without the code option', () => {
    expect(authFlagsFrom({ signIn: '1', code: '', link: '1' }).signInLink).toBe(false);
    expect(authFlagsFrom({ signIn: '1', code: '1', link: '1' }).signInLink).toBe(true);
    expect(authFlagsFrom({}).signInLink).toBe(false);
  });
});

describe('with Continue with Google on (Google copy page 52 to 55)', () => {
  const send = (status: number, code: string, retryAfterS: number | null = null) => ({ status, code, retryAfterS });
  it('52 and 53: too many codes offers Google on sign-in and sign-up', () => {
    expect(authProblem(send(429, 'RATE_LIMITED', 900), 'send', { page: 'sign-in', googleOn: true })?.message).toBe("You've asked for several codes. Wait 15 minutes, or use your password or Google.");
    expect(authProblem(send(429, 'RATE_LIMITED', 900), 'send', { page: 'sign-up', googleOn: true })?.message).toBe("You've asked for several codes. Wait 15 minutes, or use Google.");
    expect(authProblem(send(429, 'RATE_LIMITED', 30), 'send', { page: 'sign-up', googleOn: true })?.message).toBe('Please wait a minute, then try again.');
  });
  it('54 and 55: a failed send offers Google; the reset page is unchanged', () => {
    expect(authProblem(send(503, 'SEND_FAILED'), 'send', { page: 'sign-in', googleOn: true })?.message).toBe("We couldn't send the email. Try again shortly, or use your password or Google.");
    expect(authProblem(send(503, 'SEND_FAILED'), 'send', { page: 'sign-up', googleOn: true })?.message).toBe("We couldn't send the email. Try again shortly, or use Google.");
    expect(authProblem(send(503, 'SEND_FAILED'), 'reset', { page: 'reset', googleOn: true })?.message).toBe("We couldn't send the email. Try again shortly.");
    expect(authProblem(send(429, 'RATE_LIMITED', 900), 'send', { page: 'reset', googleOn: true })?.message).toBe("You've asked for several codes. Wait 15 minutes, then try again.");
  });
  it('with Google off the words are as before', () => {
    expect(authProblem(send(503, 'SEND_FAILED'), 'send', { page: 'sign-in' })?.message).toBe(COPY.sendFailed);
    expect(authProblem(send(503, 'SEND_FAILED'), 'send', { page: 'sign-up' })?.message).toBe(COPY.sendFailedNoAlternative);
  });
});
