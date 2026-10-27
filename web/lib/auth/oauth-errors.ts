/**
 * What the sign-in card says about Continue with Google (GSI-1; copy page docs/v2/design/shell/google-sign-in-copy-2026-10-26.md,
 * strings 1 to 22, and its section 4 code map). Pure: a code goes in, a key and its words come out. The raw `error` (or
 * `error_description`) Neon appends to the return address is never put on the page: unknown, empty or over-long values map to the
 * fallback, and nothing of the input appears in any output (Google spec 4.6, 10.1).
 */
import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { COPY, waitPhrase, type AuthProblem } from './auth-errors';

/** Strings 1 to 22 (the card). Keys follow the copy page; `opening` is read by the live region only. */
export const GOOGLE_COPY = {
  /** 1 */ button: 'Continue with Google',
  /** 2 */ divider: 'or',
  /** 3 */ consent: 'Google shares your name, email address and profile photo link with us. Never your password or contacts.',
  /** 4 */ consentLink: 'What we keep',
  /** 5: shown only if GSI-0 finds Google's screen names a Neon host (U7), until brand verification (O-7). Not shown today. */
  hostNote: "Google's screen may show neon.tech, the service that runs our sign-in.",
  /** 6 */ lastUsed: 'Last used on this browser',
  /** 7 */ flagOff: "Continue with Google is switched off for now. Enter the same email address and we'll email you a code.",
  /** 8 */ inApp: "Google doesn't allow sign-in inside this app's browser. Open this page in Safari or Chrome, or use your email below.",
  /** 11 */ opening: 'Opening Google.',
  /** 13 */ startFailed: "We couldn't open Google. Try again, or use your email below.",
  /** 15 */ cancelled: 'You cancelled signing in with Google. Try again, or use your email below.',
  /** 16 */ didNotFinish: "Signing in with Google didn't finish. Try again. If this keeps happening, allow cookies for this site, or use your email below.",
  /** 17 */ restart: 'That sign-in took too long or was started in another tab. Please start again.',
  /** 18 */ noEmail: "Google didn't share an email address, so we couldn't sign you in. Try again and allow it, or use your email below.",
  /** 19 */ emailUnconfirmed: "Google hasn't confirmed the email address on that Google account. Confirm it with Google first, or use your email below.",
  /** 20 */ accountExists: "There's already an account here for this email. Sign in with your email first, then add Google on your account page.",
  /** 21 */ signUpClosed: `${COPY.signUpClosed} Everything on this site works without one.`,
  /** 22: the fallback for every unknown code. Never names the cause, the origin, the domain or Neon. */
  unavailable: "Google sign-in isn't working right now. Try again shortly, or use your email below.",
} as const;

/** 14: a 429 on the start. "a minute" reads "Please wait a minute, ..." as the email card does (EML-1). */
export function googleRateLimited(retryAfterS: number | null): string {
  const wait = waitPhrase(retryAfterS);
  return wait === 'a minute' ? 'Please wait a minute, then try again, or use your email below.' : `Too many sign-in attempts. Wait ${wait}, then try again, or use your email below.`;
}

/** The card's banners for a return with `?error=` (section 2.3). */
export type GoogleReturnKey = 'cancelled' | 'restart' | 'noEmail' | 'emailUnconfirmed' | 'accountExists' | 'signUpClosed' | 'unavailable';

/** Section 4, the card column. Codes compare lower-case: Better Auth writes them in snake case. */
const CARD_CODES: Record<string, GoogleReturnKey> = {
  access_denied: 'cancelled',
  state_mismatch: 'restart',
  state_not_found: 'restart',
  please_restart_the_process: 'restart',
  invalid_code: 'restart',
  no_code: 'restart',
  email_not_found: 'noEmail',
  email_not_verified: 'emailUnconfirmed',
  account_not_linked: 'accountExists',
  signup_disabled: 'signUpClosed',
};

/** A code as Better Auth writes one: letters, digits, `_`, `'` (`email_doesn't_match`), `-` and `.`; at most 64 characters. */
const CODE_SHAPE = new RegExp(`^[A-Za-z0-9_'.-]{1,${GOOGLE_SIGN_IN.errorCodeMaxLength}}$`);

/** The banner key for the `error` value of the return address. Anything not in the map is the fallback (22). */
export function googleReturnKey(raw: unknown): GoogleReturnKey {
  if (typeof raw !== 'string' || !CODE_SHAPE.test(raw)) return 'unavailable';
  const code = raw.toLowerCase();
  return Object.hasOwn(CARD_CODES, code) ? CARD_CODES[code] : 'unavailable';
}

/** A Google banner on the card: always a notice (components 5.4). `focusEmail`: string 20 moves focus to the email field. */
export interface GoogleNotice {
  tone: AuthProblem['tone'];
  message: string;
  focusEmail?: boolean;
}

export function googleReturnNotice(raw: unknown): GoogleNotice {
  const key = googleReturnKey(raw);
  return { tone: 'notice', message: GOOGLE_COPY[key], focusEmail: key === 'accountExists' || undefined };
}

/** The answer of the start call (`POST /api/auth/sign-in/social/`) as the card reads it. Status 0: no answer. */
export interface GoogleStartAnswer {
  status: number;
  code: string;
  retryAfterS: number | null;
}

/** What to show when the start did not produce a Google address (section 4, the last four rows). */
export function googleStartNotice(answer: GoogleStartAnswer): GoogleNotice {
  if (answer.status === 0 && answer.code === 'OFFLINE') return { tone: 'offline', message: COPY.offline };
  if (answer.status === 429) return { tone: 'urgent', message: googleRateLimited(answer.retryAfterS) };
  if (answer.status === 0 || (answer.status >= 200 && answer.status < 300)) return { tone: 'notice', message: GOOGLE_COPY.startFailed };
  return { tone: 'notice', message: GOOGLE_COPY.unavailable };
}
