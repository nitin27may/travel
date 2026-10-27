/**
 * "Ways to sign in" on Account (GSI-WAYS; copy page docs/v2/design/shell/google-sign-in-copy-2026-10-26.md, section 2.5, strings 29 to
 * 51, and section 4's Account column). Pure, shared by the page (server), the section (browser) and the guard's three routes (server):
 * nothing here touches the DOM, storage or the network.
 *
 * The rows come from Neon's `list-accounts` (Better Auth: `id`, `providerId`, `accountId`, `userId`, `createdAt`, `updatedAt`, `scopes`).
 * Only `providerId` and `createdAt` ever leave the server (`publicRows`); the row `id` is read by the guard alone, to name the row it
 * removes, and the Google subject (`accountId`), user id and scopes are never passed on.
 */
import { AUTH_WAYS, EMAIL_CODE, GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { COPY, waitPhrase } from './auth-errors';
import { timeOf } from './landing';

/** Strings 29 to 51 (keys as the copy page), plus the three marked "proposed": they need the planner's and GSI-R's yes. */
export const WAYS_COPY = {
  /** 29 */ title: 'Ways to sign in',
  /** 30 */ email: 'Email',
  emailDetail: `A ${EMAIL_CODE.length}-digit code sent to this address`,
  /** 31 */ password: 'Password',
  passwordDetail: 'Set',
  /** 32 */ google: 'Google',
  googleAdded: (date: string) => `Added ${date}`,
  /** 33 */ add: 'Add Google',
  /** 34 */ addHelp: (masked: string) => `Sign in with Google as well as your email. Choose the Google account for ${masked}.`,
  /** 35 */ added: 'Google added. You can now sign in with Google or your email.',
  /** 36 */ addCancelled: "Google wasn't added because you cancelled. You can try again any time.",
  /** 37 */ emailMismatch: (masked: string) => `That Google account uses a different email address. Choose the Google account for ${masked}.`,
  /** 38 */ usedElsewhere: 'That Google account already signs in to another account here. To open that account, sign out and continue with Google.',
  /** 39 */ addFailed: "We couldn't add Google. Try again shortly.",
  /** 40, with the screen-reader tail. */
  remove: 'Remove',
  removeTail: ' Google',
  /** 41 */ removeTitle: 'Remove Google?',
  /** 42 */ removeBody: "You'll sign in with an emailed code instead. Your drafts, copies and favourites stay. Using Continue with Google again later adds it back.",
  /** 43, split around its link (opens in a new tab). */
  removeGoogleSideBefore: 'To stop Google sharing your details with this site, also remove Trip Plans at ',
  removeGoogleSideLink: 'myaccount.google.com/permissions',
  removeGoogleSideAfter: '.',
  newTab: ' (opens in a new tab)',
  /** 44 */ removeConfirm: 'Remove Google',
  /** 45 */ removeKeep: 'Keep Google',
  /** 46 */ removed: 'Google removed. Sign in with an emailed code from now on.',
  /**
   * 47, first sentence only. The copy page's second sentence ("Sign in once with an emailed code, then try again") is not true on
   * Better Auth 1.7.6: an emailed-code sign-in adds no account row, so the account would stay Google-only (spec 18, GSI-WAYS notes).
   */
  removeLast: "Google is the only way in saved on this account, so it can't be removed yet.",
  /** 48 */ removeFailed: "We couldn't remove Google. Try again shortly.",
  /** 49 */ signOutNote: "Signing out here doesn't sign you out of Google on this device.",
  /** 50 */ off: 'Google sign-in is switched off for now. Sign in with an emailed code meanwhile.',
  /** Proposed (not in the copy page): Neon refuses a removal from a sign-in older than a day (SESSION_NOT_FRESH), and so do we. */
  removeSignInAgain: 'For your safety, sign out and sign in again, then remove Google.',
  /** Proposed: the rows could not be read, so the section cannot say whether Google is a way in. */
  unreadable: "We couldn't check your other ways to sign in. Reload the page to try again.",
  /** Proposed: string 14 without "or use your email below", which has no meaning on Account. */
  rateLimited: (wait: string) => (wait === 'a minute' ? 'Too many attempts. Please wait a minute, then try again.' : `Too many attempts. Wait ${wait}, then try again.`),
} as const;

/** Google's page where a person removes our app's access (string 43). */
export const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/permissions';

/** One row as the page and the browser see it: the provider and when it was added (ms), nothing else. */
export interface WayRow {
  providerId: string;
  createdAt: number;
}

/** A row as the guard reads it: also Neon's row `id`, to name the row it removes. Never sent to the browser. */
export interface NeonWayRow extends WayRow {
  id: string;
}

const PROVIDER_SHAPE = /^[a-z][a-z0-9_-]{0,31}$/;
const ROW_ID_SHAPE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Neon's `list-accounts` answer, read strictly: an array of at most `maxRows` objects, each with a plain `providerId`, a readable
 * `createdAt` and a plain `id`. Anything else is null (fail closed), so a changed answer never reads as "no Google".
 */
export function parseNeonRows(raw: unknown): NeonWayRow[] | null {
  if (!Array.isArray(raw) || raw.length > AUTH_WAYS.maxRows) return null;
  const out: NeonWayRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const r = row as { id?: unknown; providerId?: unknown; createdAt?: unknown };
    if (typeof r.providerId !== 'string' || !PROVIDER_SHAPE.test(r.providerId)) return null;
    if (typeof r.id !== 'string' || !ROW_ID_SHAPE.test(r.id)) return null;
    const at = timeOf(r.createdAt);
    if (at === null) return null;
    out.push({ id: r.id, providerId: r.providerId, createdAt: at });
  }
  return out;
}

/** What may leave the server: provider and time only (no row id, no Google subject, no user id, no scopes). */
export function publicRows(rows: readonly NeonWayRow[]): WayRow[] {
  return rows.map((r) => ({ providerId: r.providerId, createdAt: r.createdAt }));
}

/** The guard's own answer of `list-accounts`, read back in the browser; null when it is not that shape. */
export function parsePublicRows(raw: unknown): WayRow[] | null {
  const list = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { accounts?: unknown }).accounts : undefined;
  if (!Array.isArray(list) || list.length > AUTH_WAYS.maxRows) return null;
  const out: WayRow[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') return null;
    const r = row as { providerId?: unknown; createdAt?: unknown };
    if (typeof r.providerId !== 'string' || !PROVIDER_SHAPE.test(r.providerId)) return null;
    const at = timeOf(r.createdAt);
    if (at === null) return null;
    out.push({ providerId: r.providerId, createdAt: at });
  }
  return out;
}

const isGoogle = (r: WayRow) => r.providerId === GOOGLE_SIGN_IN.provider;

/** The section's rows: Email always (A1), Password when a `credential` row exists, Google with its date when it exists. */
export interface WaysView {
  password: boolean;
  /** When Google was first added (ms), or null when it is not a way in. */
  google: number | null;
  /** Google is the only row Neon keeps: it cannot be removed (L6; the server refuses too). */
  googleOnly: boolean;
}

export function waysView(rows: readonly WayRow[]): WaysView {
  const google = rows.filter(isGoogle);
  return {
    password: rows.some((r) => r.providerId === 'credential'),
    google: google.length ? Math.min(...google.map((r) => r.createdAt)) : null,
    googleOnly: google.length > 0 && google.length === rows.length,
  };
}

/**
 * The guard's rule for a removal (L6; "the server must enforce, not only the UI"): the Google rows to remove, or why not. Removing
 * Google is allowed only while another row stays. The emailed code is not counted: Better Auth refuses to remove the last row
 * whatever the code option says (FAILED_TO_UNLINK_LAST_ACCOUNT), so our rule matches Neon's and the answer is the same either way.
 */
export function removalPlan(rows: readonly NeonWayRow[]): { ok: true; ids: string[] } | { ok: false; reason: 'not_linked' | 'last_method' | 'too_many' } {
  const google = rows.filter(isGoogle);
  if (google.length === 0) return { ok: false, reason: 'not_linked' };
  if (google.length === rows.length) return { ok: false, reason: 'last_method' };
  if (google.length > AUTH_WAYS.maxGoogleRows) return { ok: false, reason: 'too_many' };
  return { ok: true, ids: google.map((r) => r.id) };
}

/** True when the session started at most `removeFreshS` ago (Neon's clock may run ahead of ours by `clockSkewMs`). */
export function sessionFresh(createdAt: unknown, now: number): boolean {
  const at = timeOf(createdAt);
  if (at === null) return false;
  const age = now - at;
  return age >= -GOOGLE_SIGN_IN.clockSkewMs && age <= AUTH_WAYS.removeFreshS * 1000;
}

/** Google was added a moment ago (the return of Add Google): within the landing window of the stop (GSI-2). */
export function googleJustAdded(rows: readonly WayRow[], now: number): boolean {
  return rows.some((r) => isGoogle(r) && now - r.createdAt >= -GOOGLE_SIGN_IN.clockSkewMs && now - r.createdAt <= GOOGLE_SIGN_IN.landingWindowMs);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Oct 2026" (copy page conventions, `d MMM yyyy`), in UTC so the server and the browser agree. */
export function addedDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The Add Google return keys (section 4, the Account column). */
export type AddReturnKey = 'addCancelled' | 'emailMismatch' | 'usedElsewhere' | 'addFailed';

/**
 * Section 4, Account column. Better Auth 1.7.6 writes `email_does_not_match`; the copy page names the older `email_doesn't_match`;
 * both map to 37.
 */
const ADD_CODES: Record<string, AddReturnKey> = {
  access_denied: 'addCancelled',
  "email_doesn't_match": 'emailMismatch',
  email_does_not_match: 'emailMismatch',
  account_already_linked_to_different_user: 'usedElsewhere',
};

const CODE_SHAPE = new RegExp(`^[A-Za-z0-9_'.-]{1,${GOOGLE_SIGN_IN.errorCodeMaxLength}}$`);

/** The notice key for the `error` Neon appends to the Add Google return; anything else is 39. The raw value is never shown. */
export function addReturnKey(raw: unknown): AddReturnKey {
  if (typeof raw !== 'string' || !CODE_SHAPE.test(raw)) return 'addFailed';
  const code = raw.toLowerCase();
  return Object.hasOwn(ADD_CODES, code) ? ADD_CODES[code] : 'addFailed';
}

export function addReturnText(raw: unknown, masked: string): string {
  const key = addReturnKey(raw);
  if (key === 'emailMismatch') return WAYS_COPY.emailMismatch(masked);
  return WAYS_COPY[key];
}

/** An answer of the guard's `link-social` or `unlink-account` as the section reads it. Status 0: no answer. */
export interface WaysAnswer {
  status: number;
  code: string;
  retryAfterS: number | null;
}

/** What the section says when Add Google did not reach Google (section 4's last rows). */
export function addStartText(a: WaysAnswer): string {
  if (a.status === 0 && a.code === 'OFFLINE') return COPY.offline;
  if (a.status === 429) return WAYS_COPY.rateLimited(waitPhrase(a.retryAfterS));
  return WAYS_COPY.addFailed;
}

/** What the section says when a removal was refused or failed. */
export function removeText(a: WaysAnswer): string {
  if (a.status === 0 && a.code === 'OFFLINE') return COPY.offline;
  if (a.status === 429) return WAYS_COPY.rateLimited(waitPhrase(a.retryAfterS));
  if (a.code === 'LAST_METHOD') return WAYS_COPY.removeLast;
  if (a.code === 'REAUTH_REQUIRED') return WAYS_COPY.removeSignInAgain;
  return WAYS_COPY.removeFailed;
}

/** The parameters the Add Google return may carry, removed from the address at once (`added` chose the wording on the server). */
export const ADD_RETURN_PARAMS = [AUTH_WAYS.addedParam, 'error', 'error_description', 'neon_auth_session_verifier'] as const;
