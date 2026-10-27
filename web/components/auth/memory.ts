/**
 * What the card remembers in the browser (spec 3.1): the way used last (`auth.lastMethod`, never an address, in localStorage),
 * and the address handed from "Forgot password?" to `/sign-in/reset/` (sessionStorage, this tab only, removed when read).
 * Storage can be blocked (private modes); every call fails quietly.
 */
import { readLocal, readSession, removeSession, writeLocal, writeSession } from '@/lib/storage/safe';
const METHOD = 'auth.lastMethod';
const HANDOFF = 'auth.resetEmail';
/** The Google pending mark (copy page section 8): the press time in ms, this tab only, removed when read. Nothing else. */
const GOOGLE_PENDING = 'auth.googlePending';

/** `google` (GSI-1): written when Continue with Google is pressed, since its success lands on a page without the card. */
export type Method = 'code' | 'password' | 'google';

export function lastMethod(): Method | null {
  const v = readLocal(METHOD);
  return v === 'code' || v === 'password' || v === 'google' ? v : null;
}

export function rememberMethod(m: Method): void {
  writeLocal(METHOD, m);
}

export function handOffEmail(email: string): void {
  writeSession(HANDOFF, email);
}

export function takeHandedOffEmail(): string {
  const v = readSession(HANDOFF) ?? '';
  removeSession(HANDOFF);
  return v;
}

export function markGooglePending(now: number): void {
  writeSession(GOOGLE_PENDING, String(now));
}

/** The pending mark, if any. It explains one return only: `clearGooglePending` once it is read. */
export function peekGooglePending(): string | null {
  return readSession(GOOGLE_PENDING);
}

export function clearGooglePending(): void {
  removeSession(GOOGLE_PENDING);
}
