import { describe, expect, it } from 'vitest';
import { authProblem, COPY, maskAddress, waitPhrase, type AuthAction } from '@/lib/auth/auth-errors';
import { authFlagsFrom } from '@/lib/auth/flags';
import { clock, codeDigits } from '@/components/auth/CodeStep';

const a = (status: number, code = '', retryAfterS: number | null = null) => ({ status, code, retryAfterS });

describe('auth answer copy (spec 3.3)', () => {
  it('is null for a success', () => {
    expect(authProblem(a(200), 'send')).toBeNull();
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
    expect(authProblem(answer, action as AuthAction)?.message).toBe(message);
  });

  it('says "or sign in with a code" only when the code option is on', () => {
    expect(authProblem(a(429, '', 600), 'password', false)?.message).toBe('Too many attempts. Wait 10 minutes, then try again.');
  });

  it.each([
    ['INVALID_OTP', COPY.wrongCode, false],
    ['TOO_MANY_ATTEMPTS', COPY.tooManyTries, true],
    ['OTP_EXPIRED', COPY.expired, true],
  ] as const)('puts %s under the code field', (code, message, clear) => {
    const p = authProblem(a(code === 'TOO_MANY_ATTEMPTS' ? 403 : 400, code), 'verify');
    expect(p).toMatchObject({ where: 'field', field: 'code', message });
    expect(Boolean(p?.clearCode)).toBe(clear);
  });

  it('puts address and password problems under their fields', () => {
    expect(authProblem(a(400, 'INVALID_EMAIL'), 'send')).toMatchObject({ where: 'field', field: 'email', message: COPY.badEmail });
    expect(authProblem(a(400, 'PASSWORD_TOO_SHORT'), 'sign-up')).toMatchObject({ where: 'field', field: 'password' });
    expect(authProblem(a(400, 'PASSWORD_TOO_LONG'), 'reset')).toMatchObject({ where: 'field', field: 'password' });
  });

  it('never carries input text into a message', () => {
    for (const action of ['send', 'verify', 'password', 'sign-up', 'reset'] as const) {
      for (const status of [0, 400, 401, 403, 404, 413, 422, 429, 500, 503]) {
        const p = authProblem(a(status, 'visitor@example.test 482913', 60), action);
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
