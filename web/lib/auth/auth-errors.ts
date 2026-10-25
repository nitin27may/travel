/**
 * What the sign-in card says for every answer of the auth proxy (email spec 3.3, guard codes at the top of lib/auth/guard.ts).
 * Pure: an answer goes in, a message and where to show it come out. No input text (an address, a code) ever appears in a message.
 */
import { EMAIL_CODE, PASSWORD } from '@travel/core/config/auth-limits.ts';

/** An answer of `/api/auth/*`, as the card's fetch wrapper reads it. Status 0: no answer (offline or network). */
export interface AuthAnswer {
  status: number;
  code: string;
  retryAfterS: number | null;
}

/** Which call the answer belongs to; the same code reads differently on each. */
export type AuthAction = 'send' | 'verify' | 'password' | 'sign-up' | 'reset';

/**
 * Which page the card is on (review M1). A way out is offered only where it really is another way: on the sign-in page "use your
 * password" goes to `/sign-in/email`, whose guard buckets (`auth:password:*`) are separate from the send buckets (`auth:send:*`),
 * so it works while sends are limited. On sign-up, "Create a password" draws on the same per-address send bucket (the guard's
 * sign-up rules include `auth:send:addr`), and on the reset page the person has no password: no alternative is offered there.
 */
export type AuthPage = 'sign-in' | 'sign-up' | 'reset';

export interface ProblemContext {
  page: AuthPage;
  /** The code option is on this card. */
  codeOn?: boolean;
}

export interface AuthProblem {
  /** `field`: under the named field (`aria-describedby`); `banner`: a banner above the form. */
  where: 'field' | 'banner';
  field?: 'email' | 'code' | 'password';
  /** Banner kind (components 5.4). */
  tone: 'urgent' | 'notice' | 'offline';
  message: string;
  /** Empty the code field (too many tries). */
  clearCode?: boolean;
  /** The code is dead (`TOO_MANY_ATTEMPTS` or `OTP_EXPIRED`): the field locks until a new one is sent (review M4). */
  deadCode?: string;
}

export const COPY = {
  offline: "You're offline. Sign-in needs a connection.",
  service: 'Sign-in is unavailable right now. Try again shortly.',
  browserCheck: "We couldn't confirm this browser. Please try again.",
  sendFailed: "We couldn't send the email. Try again shortly, or use your password.",
  sendFailedNoAlternative: "We couldn't send the email. Try again shortly.",
  badEmail: 'Enter an email address, like name@example.com.',
  wrongCode: "That code didn't work. Check it, or send a new one.",
  tooManyTries: 'Too many tries. Send a new code.',
  expired: 'That code has expired. Send a new one.',
  credentials: "We couldn't sign you in. Check your email and password.",
  shortPassword: `Use at least ${PASSWORD.minLength} characters.`,
  longPassword: `Use at most ${PASSWORD.maxLength} characters.`,
  signUpClosed: "New accounts can't be created right now.",
  signUpFailed: "We couldn't create the account. Check the details and try again.",
  /** The Phase 1 sender note (email spec, Decision 25 Oct), exact words. */
  senderNote:
    "The email comes from Neon Auth (auth@mail.myneon.app), the service that runs our sign-in. If it isn't in your inbox within a minute, check your spam or junk folder.",
  codeLifetime: `The code works once, for ${EMAIL_CODE.lifetimeMin} minutes.`,
  /** The end of a wait on "Email me a code" (review M3). */
  canAskNow: 'You can ask for a code now.',
  /** The end of the resend wait on the code step. */
  canResendNow: 'You can send a new code now.',
  /** Turnstile wants a person (review S5). */
  challenge: 'Tick the box below to continue.',
  /** Shown before the default lead when a password sign-in finds the address unconfirmed (review S2). */
  confirmFirst: 'Confirm your email first.',
  /** Under "Email me a code" on the chooser (review S3). */
  codeHelp: `No password needed: we email you a ${EMAIL_CODE.length}-digit code.`,
} as const;

/** A resend worked (review M5). Masked address only, never the full one. */
export function resentMessage(email: string): string {
  return `We sent a new code to ${maskAddress(email)}. Use the newest email.`;
}

/** The error under a dead code (too many tries or expired) while the resend wait runs (review M4). */
export function deadCodeMessage(code: string, secondsLeftLabel: string | null): string {
  const lead = code === 'OTP_EXPIRED' ? 'That code has expired.' : 'Too many tries.';
  return secondsLeftLabel ? `${lead} You can send a new code in ${secondsLeftLabel}.` : `${lead} Send a new code.`;
}

/** "a minute", "15 minutes", "3 hours": how long to wait, from a Retry-After in seconds. */
export function waitPhrase(seconds: number | null): string {
  const s = seconds && seconds > 0 ? seconds : 60;
  if (s <= 90) return 'a minute';
  const min = Math.ceil(s / 60);
  if (min < 90) return `${min} minutes`;
  return `${Math.round(min / 60)} hours`;
}

function tooMany(action: AuthAction, retry: number | null, codeOn: boolean, page: AuthPage): string {
  const wait = waitPhrase(retry);
  if (wait === 'a minute') return 'Please wait a minute, then try again.';
  switch (action) {
    case 'send':
      return page === 'sign-in' ? `You've asked for several codes. Wait ${wait}, or use your password.` : `You've asked for several codes. Wait ${wait}, then try again.`;
    case 'password':
      return codeOn ? `Too many attempts. Wait ${wait}, or sign in with a code.` : `Too many attempts. Wait ${wait}, then try again.`;
    case 'verify':
    case 'reset':
      return `Too many tries. Wait ${wait}, then send a new code.`;
    case 'sign-up':
      return `Too many attempts. Wait ${wait}, then try again.`;
  }
}

/** The problem to show for a failed answer, or null for a success. */
export function authProblem(answer: AuthAnswer, action: AuthAction, ctx: ProblemContext): AuthProblem | null {
  const { status, code } = answer;
  const page = ctx.page;
  const codeOn = ctx.codeOn ?? true;
  if (status >= 200 && status < 300) return null;
  const banner = (message: string, tone: AuthProblem['tone'] = 'notice'): AuthProblem => ({ where: 'banner', tone, message });
  if (status === 0) return code === 'OFFLINE' ? banner(COPY.offline, 'offline') : banner(COPY.service);
  if (status === 429) return banner(tooMany(action, answer.retryAfterS, codeOn, page), 'urgent');
  if (code === 'TURNSTILE_FAILED' || code === 'TURNSTILE_UNAVAILABLE') return banner(COPY.browserCheck);
  if (code === 'SEND_FAILED' || code === 'SEND_UNAVAILABLE') return banner(page === 'sign-in' ? COPY.sendFailed : COPY.sendFailedNoAlternative);
  if (code === 'INVALID_EMAIL') return { where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail };
  if (code === 'INVALID_OTP') return { where: 'field', field: 'code', tone: 'urgent', message: COPY.wrongCode };
  if (code === 'TOO_MANY_ATTEMPTS') return { where: 'field', field: 'code', tone: 'urgent', message: COPY.tooManyTries, clearCode: true, deadCode: code };
  if (code === 'OTP_EXPIRED') return { where: 'field', field: 'code', tone: 'urgent', message: COPY.expired, clearCode: true, deadCode: code };
  if (code === 'PASSWORD_TOO_SHORT') return { where: 'field', field: 'password', tone: 'urgent', message: COPY.shortPassword };
  if (code === 'PASSWORD_TOO_LONG') return { where: 'field', field: 'password', tone: 'urgent', message: COPY.longPassword };
  if (status >= 500 || code === 'FORBIDDEN' || code === 'GUARD_UNAVAILABLE' || code === 'BODY_TOO_LARGE' || code === 'NOT_FOUND') return banner(COPY.service);
  if (action === 'password' && (status === 401 || code === 'INVALID_EMAIL_OR_PASSWORD')) return banner(COPY.credentials, 'urgent');
  if (action === 'sign-up') return banner(code === 'EMAIL_PASSWORD_SIGN_UP_DISABLED' ? COPY.signUpClosed : COPY.signUpFailed, 'urgent');
  if (action === 'verify' || action === 'reset') return { where: 'field', field: 'code', tone: 'urgent', message: COPY.wrongCode };
  if (status === 400 || status === 422) return { where: 'field', field: 'email', tone: 'urgent', message: COPY.badEmail };
  return banner(COPY.service);
}

/** `n…@gmail.com`: the address after step 1, so a screenshot of the card shows less (spec 3.3). */
export function maskAddress(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '…';
  return `${email[0]}…${email.slice(at)}`;
}
