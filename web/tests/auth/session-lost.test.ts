// @vitest-environment node
// Review ACCT-PSEC B2: every path that ends a session in the page (Sign out, and a 401 on a write or a renewal) removes a party an
// account wrote to this browser before it navigates; the browser's own party stays.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropAccountParty, leaveSession, renewOrLeave } from '@/lib/auth/session-lost';

const KEY = 'travel.party';
let data: Map<string, string>;
let assigned: string[];
function fakeWindow() {
  data = new Map();
  assigned = [];
  const localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  vi.stubGlobal('window', { localStorage, location: { assign: (u: string) => void assigned.push(u) } });
}
afterEach(() => vi.unstubAllGlobals());

describe('leaveSession', () => {
  it('removes an account\'s party, then goes home', () => {
    fakeWindow();
    data.set(KEY, JSON.stringify({ v: 1, adults: 2, children: [7, 9], src: 'account', by: '0123456789abcdef' }));
    leaveSession();
    expect(data.has(KEY)).toBe(false);
    expect(assigned).toEqual(['/']);
  });
  it('keeps the browser\'s own party, and survives junk or blocked storage', () => {
    fakeWindow();
    data.set(KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    leaveSession();
    expect(data.get(KEY)).toBe(JSON.stringify({ v: 1, adults: 3, children: [] }));
    data.set(KEY, '{not json');
    expect(dropAccountParty()).toBe(false);
    vi.stubGlobal('window', { get localStorage() { throw new DOMException('denied', 'SecurityError'); }, location: { assign: () => {} } });
    expect(() => leaveSession()).not.toThrow();
  });
  it('a renewal answered 401 removes the party too', async () => {
    fakeWindow();
    data.set(KEY, JSON.stringify({ v: 1, adults: 2, children: [5], src: 'account' }));
    void renewOrLeave(async () => new Response('', { status: 401 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(data.has(KEY)).toBe(false);
    expect(assigned).toEqual(['/']);
  });
});
