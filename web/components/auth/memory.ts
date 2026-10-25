/**
 * What the card remembers in the browser (spec 3.1): the way used last (`auth.lastMethod`, never an address, in localStorage),
 * and the address handed from "Forgot password?" to `/sign-in/reset/` (sessionStorage, this tab only, removed when read).
 * Storage can be blocked (private modes); every call fails quietly.
 */
const METHOD = 'auth.lastMethod';
const HANDOFF = 'auth.resetEmail';

export type Method = 'code' | 'password';

export function lastMethod(): Method | null {
  try {
    const v = window.localStorage.getItem(METHOD);
    return v === 'code' || v === 'password' ? v : null;
  } catch {
    return null;
  }
}

export function rememberMethod(m: Method): void {
  try {
    window.localStorage.setItem(METHOD, m);
  } catch {
    /* storage blocked */
  }
}

export function handOffEmail(email: string): void {
  try {
    window.sessionStorage.setItem(HANDOFF, email);
  } catch {
    /* storage blocked */
  }
}

export function takeHandedOffEmail(): string {
  try {
    const v = window.sessionStorage.getItem(HANDOFF) ?? '';
    window.sessionStorage.removeItem(HANDOFF);
    return v;
  } catch {
    return '';
  }
}
