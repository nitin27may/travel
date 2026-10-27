/**
 * What the card remembers in the browser (spec 3.1): the way used last (`auth.lastMethod`, never an address, in localStorage),
 * and the address handed from "Forgot password?" to `/sign-in/reset/` (sessionStorage, this tab only, removed when read).
 * Storage can be blocked (private modes); every call fails quietly.
 */
import { readLocal, readSession, removeLocal, removeSession, writeLocal, writeSession } from '@/lib/storage/safe';
const METHOD = 'auth.lastMethod';
const HANDOFF = 'auth.resetEmail';
/** The Google pending mark (copy page section 8): the press time in ms, this tab only, removed when read. Nothing else. */
const GOOGLE_PENDING = 'auth.googlePending';
/**
 * Beside the mark, for one round trip (GSI-2): the `auth.lastMethod` value from before the press (`code`, `password` or `google`),
 * absent when there was none. The same word `auth.lastMethod` already keeps, never an address; written and removed with the mark.
 * It lets a failed round trip put the earlier way back (string 6 stays true), and Account tell whether this browser had a way in
 * before (string 24).
 */
const GOOGLE_BEFORE = 'auth.googleBefore';

/** `google` (GSI-1): written when Continue with Google is pressed, since its success lands on a page without the card. */
export type Method = 'code' | 'password' | 'google';

const asMethod = (v: string | null): Method | null => (v === 'code' || v === 'password' || v === 'google' ? v : null);

export function lastMethod(): Method | null {
  return asMethod(readLocal(METHOD));
}

export function rememberMethod(m: Method): void {
  writeLocal(METHOD, m);
}

export function handOffEmail(email: string): void {
  writeSession(HANDOFF, email);
}

/** The handed-off address, read only (safe in a render, GSI-UXF M1); `dropHandedOffEmail` after the first commit. */
export function peekHandedOffEmail(): string {
  return readSession(HANDOFF) ?? '';
}

export function dropHandedOffEmail(): void {
  removeSession(HANDOFF);
}

/** The press: the mark, and the way in remembered before it. Call before `rememberMethod('google')`. */
export function markGooglePending(now: number): void {
  writeSession(GOOGLE_PENDING, String(now));
  const before = lastMethod();
  if (before) writeSession(GOOGLE_BEFORE, before);
  else removeSession(GOOGLE_BEFORE);
}

/** The pending mark, if any. It explains one return only: `clearGooglePending` once it is read. */
export function peekGooglePending(): string | null {
  return readSession(GOOGLE_PENDING);
}

export function clearGooglePending(): void {
  removeSession(GOOGLE_PENDING);
  removeSession(GOOGLE_BEFORE);
}

/**
 * The card is back after a press that did not sign in (an `error`, Back from Google, a bounced exchange): the press wrote `google`
 * as the last way in, so put back the way remembered before it (or none), then drop the round trip. Without a mark, nothing changes.
 */
export function undoGooglePress(): void {
  if (readSession(GOOGLE_PENDING) === null) return;
  const before = asMethod(readSession(GOOGLE_BEFORE));
  if (before) writeLocal(METHOD, before);
  else removeLocal(METHOD);
  clearGooglePending();
}

/**
 * What `undoGooglePress` would leave as the last way in, without writing anything (GSI-UXF M1): the way from before the press while
 * the mark is there, `lastMethod()` otherwise. Safe in a render.
 */
export function methodBeforePress(): Method | null {
  if (readSession(GOOGLE_PENDING) === null) return lastMethod();
  return asMethod(readSession(GOOGLE_BEFORE));
}

/** Account after Google (GSI-2) reads the round trip once: the mark and whether a way in was remembered before it; both removed. */
export function takeGoogleRoundTrip(): { mark: string | null; hadMethod: boolean } {
  const mark = readSession(GOOGLE_PENDING);
  const hadMethod = mark !== null && asMethod(readSession(GOOGLE_BEFORE)) !== null;
  clearGooglePending();
  return { mark, hadMethod };
}
