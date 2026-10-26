/**
 * What the card remembers in the browser (spec 3.1): the way used last (`auth.lastMethod`, never an address, in localStorage),
 * and the address handed from "Forgot password?" to `/sign-in/reset/` (sessionStorage, this tab only, removed when read).
 * Storage can be blocked (private modes); every call fails quietly.
 */
import { readLocal, readSession, removeSession, writeLocal, writeSession } from '@/lib/storage/safe';
const METHOD = 'auth.lastMethod';
const HANDOFF = 'auth.resetEmail';

export type Method = 'code' | 'password';

export function lastMethod(): Method | null {
  const v = readLocal(METHOD);
  return v === 'code' || v === 'password' ? v : null;
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
