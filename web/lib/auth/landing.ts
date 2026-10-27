/**
 * The stop on `/account/` after Continue with Google (GSI-2; copy page W3, Q-GC3, strings 23 to 27). Pure: the signed-in user's
 * creation time and Neon's account rows go in, one of four landings comes out. Nothing here reads the address, so no flag, address or
 * code can ride in the URL to fake or hide a notice.
 *
 * - `new`: Google made this account a moment ago (string 23, and 24 when this browser had a way in before).
 * - `linked`: Google was just added to an account that already existed (L1, string 25). Never silent (W3).
 * - `returning`: neither; `/account/` follows `next` at once (string 28, P7).
 * - `unknown`: the rows could not be read or make no sense. The page fails closed: it stays on Account without a notice rather than
 *   risk passing over a link in silence.
 */
import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { pendingFresh } from './google';

export type Landing = 'new' | 'linked' | 'returning' | 'unknown';

/** Strings 23 to 27. `{masked}` is `maskAddress(email)` (W6). */
export const LANDING_COPY = {
  /** 23 */ new: (masked: string) => `Your account is ready. You signed up with Google as ${masked}.`,
  /** 24: only when this browser had a way in before this sign-in (a `lastMethod` before the press). */
  newHint: 'If you meant to use a different account, sign out and choose another Google account.',
  /** 25 */ linked: (masked: string) => `You already had an account for ${masked}, so we added Google to it as a way to sign in. Your drafts are unchanged.`,
  /** 26: the link after 25 to "Ways to sign in" (`#ways-to-sign-in`, GSI-WAYS). */
  linkedUndo: 'Not what you wanted? Remove Google',
  /** 27, with the screen-reader tail. */
  continue: 'Continue',
  continueTail: ' to the page you were on',
} as const;

/** A time from Neon (an ISO string, a Date, or ms) in ms; null for anything else. */
export function timeOf(value: unknown): number | null {
  let ms: number;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string' && value.length > 0 && value.length <= 40) ms = Date.parse(value);
  else return null;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** At most `landingWindowMs` ago, allowing `clockSkewMs` of Neon's clock running ahead of ours. */
function recent(at: number, now: number): boolean {
  const age = now - at;
  return age >= -GOOGLE_SIGN_IN.clockSkewMs && age <= GOOGLE_SIGN_IN.landingWindowMs;
}

/**
 * Which landing this is. `accounts` is Neon's `list-accounts` answer as it came (only `providerId` and `createdAt` are read);
 * `userCreatedAt` is the session user's `createdAt`.
 */
export function googleLanding(input: { userCreatedAt: unknown; accounts: unknown; now: number }): Landing {
  const { accounts, now } = input;
  if (!Array.isArray(accounts) || accounts.length > 50) return 'unknown';
  const rows: { provider: string; at: number | null }[] = [];
  for (const row of accounts) {
    if (!row || typeof row !== 'object') return 'unknown';
    const provider = (row as { providerId?: unknown }).providerId;
    if (typeof provider !== 'string') return 'unknown';
    rows.push({ provider, at: timeOf((row as { createdAt?: unknown }).createdAt) });
  }
  // Exact provider id: a look-alike ("Google", "google ") is another provider, never Google.
  const google = rows.filter((r) => r.provider === GOOGLE_SIGN_IN.provider);
  if (google.length === 0) return 'returning';
  if (google.some((r) => r.at === null)) return 'unknown';
  const user = timeOf(input.userCreatedAt);
  if (user === null) return 'unknown';
  // The newest Google row decides (there is one per Google account; more would mean two Google accounts on one user).
  const row = Math.max(...google.map((r) => r.at as number));
  if (!recent(row, now)) return 'returning';
  const gap = row - user;
  if (gap > GOOGLE_SIGN_IN.linkGapMs) return 'linked';
  // Google came with the user: new only while that is recent and Google is the only way in.
  if (gap >= -GOOGLE_SIGN_IN.linkGapMs && rows.length === 1 && recent(user, now)) return 'new';
  return 'returning';
}

/**
 * String 24 joins 23 only for a new account, after a press from this tab in the last `pendingMaxMs` (the mark), when this browser had
 * a way in before it: the "different Google account than last time" case, the most we can say without storing an address.
 */
export function landingHint(kind: 'new' | 'linked', trip: { mark: string | null; hadMethod: boolean }, now: number): boolean {
  return kind === 'new' && trip.hadMethod && pendingFresh(trip.mark, now);
}

/** The words of the notice, as shown and as read once by the live region. */
export function landingText(kind: 'new' | 'linked', masked: string, hint: boolean): string {
  if (kind === 'linked') return LANDING_COPY.linked(masked);
  return hint ? `${LANDING_COPY.new(masked)} ${LANDING_COPY.newHint}` : LANDING_COPY.new(masked);
}
