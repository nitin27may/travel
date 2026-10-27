// @vitest-environment node
// The sign-in card's first-render read (GSI-UXF M1). React may run a first render twice before it commits; the read used to call
// undoGooglePress() inside the useState initialiser, so a restarted render found the mark gone and lost string 16 ("didn't finish")
// on most loads. These tests pin that the read is pure: the same answer twice in a row, and no storage written.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCardStart } from '@/components/auth/card-start';
import { lastMethod, markGooglePending, rememberMethod, undoGooglePress } from '@/components/auth/memory';
import { GOOGLE_COPY } from '@/lib/auth/oauth-errors';

let local: Map<string, string>;
let session: Map<string, string>;
let navType = 'navigate';
function fakeWindow(search: string) {
  local = new Map();
  session = new Map();
  const store = (data: Map<string, string>) => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) });
  vi.stubGlobal('window', { localStorage: store(local), sessionStorage: store(session), location: { search } });
  vi.stubGlobal('performance', { getEntriesByType: () => [{ type: navType }] });
}
beforeEach(() => {
  navType = 'navigate';
});
afterEach(() => vi.unstubAllGlobals());

const NOW = 1_000_000;
const snapshot = () => JSON.stringify([[...local], [...session]]);

describe('readCardStart', () => {
  it('a bounced verifier after a recent press: string 16, the same on a second read, nothing written', () => {
    fakeWindow('?neon_auth_session_verifier=');
    rememberMethod('code');
    markGooglePending(NOW - 5000);
    rememberMethod('google');
    const before = snapshot();
    const first = readCardStart(true, NOW);
    const second = readCardStart(true, NOW); // the restarted first render
    expect(first.returned).toEqual({ tone: 'notice', message: GOOGLE_COPY.didNotFinish });
    expect(second).toEqual(first);
    expect(first.last).toBe('code'); // the way in from before the press, shown before the effect writes it
    expect(snapshot()).toBe(before);
    undoGooglePress(); // what the mount effect does
    expect(lastMethod()).toBe('code');
  });
  it('Back from Google after a recent press: string 16 twice', () => {
    fakeWindow('');
    navType = 'back_forward';
    markGooglePending(NOW - 5000);
    expect(readCardStart(true, NOW).returned?.message).toBe(GOOGLE_COPY.didNotFinish);
    expect(readCardStart(true, NOW).returned?.message).toBe(GOOGLE_COPY.didNotFinish);
  });
  it('an error return: its banner twice, nothing written', () => {
    fakeWindow('?error=access_denied');
    markGooglePending(NOW - 5000);
    const before = snapshot();
    const a = readCardStart(true, NOW);
    expect(a.returned).not.toBeNull();
    expect(readCardStart(true, NOW)).toEqual(a);
    expect(snapshot()).toBe(before);
  });
  it('a fresh visit with a stale mark: no banner, the stored way in', () => {
    fakeWindow('');
    rememberMethod('password');
    markGooglePending(NOW - 10 * 60_000);
    rememberMethod('google');
    expect(readCardStart(true, NOW)).toEqual({ returned: null, last: 'google' });
  });
  it('Google off: never a banner', () => {
    fakeWindow('?neon_auth_session_verifier=');
    markGooglePending(NOW - 5000);
    expect(readCardStart(false, NOW).returned).toBeNull();
  });
});
