// @vitest-environment node
// ACCT-P2: the seed rules of account-profile-and-travellers.md 5.2 and the sign-out rule of 5.4, against a fake window.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTY_KEY } from '@/lib/storage/partyKey';
import { clearAccountParty, keepPartyAsOwn, seedFromAccount, seedParty, setAccountParty } from '@/lib/account/seed-party';

let data: Map<string, string>;
function fakeWindow(blocked = false) {
  data = new Map();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const w = { dispatchEvent: () => true } as Record<string, unknown>;
  Object.defineProperty(w, 'localStorage', blocked ? { get: () => { throw new DOMException('denied', 'SecurityError'); } } : { value: store });
  vi.stubGlobal('window', w);
  vi.stubGlobal('Event', class { constructor(public type: string) {} });
}
const stored = () => JSON.parse(data.get(PARTY_KEY) ?? 'null');
afterEach(() => vi.unstubAllGlobals());

describe('seedParty', () => {
  it('nothing on the device: writes the account party with src', () => {
    fakeWindow();
    expect(seedParty({ adults: 2, children: [7, 9] })).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
  });
  it('the same party: marked as the account\'s', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [7, 9] }));
    expect(seedParty({ adults: 2, children: [7, 9] })).toBe('same');
    expect(stored().src).toBe('account');
  });
  it('a different party the browser chose is left alone', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 1, children: [4] }));
    expect(seedParty({ adults: 2, children: [7, 9] })).toBe('differs');
    expect(stored()).toEqual({ v: 1, adults: 1, children: [4] });
  });
  it('a different party an earlier seed wrote is brought up to date (a birthday, another device)', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [6, 8], src: 'account' }));
    expect(seedParty({ adults: 2, children: [7, 9] })).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
  });
  it('blocked storage answers blocked and throws nothing', () => {
    fakeWindow(true);
    expect(seedParty({ adults: 2, children: [] })).toBe('blocked');
  });
});

describe('save, remove and sign-out', () => {
  it('setAccountParty replaces anything; keepPartyAsOwn drops src but keeps the party', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 1, children: [] }));
    expect(setAccountParty({ adults: 2, children: [5] })).toBe(true);
    expect(stored().src).toBe('account');
    keepPartyAsOwn();
    expect(stored()).toEqual({ v: 1, adults: 2, children: [5] });
  });
  it('sign-out removes an account-seeded party and keeps the browser\'s own', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [5] });
    expect(clearAccountParty()).toBe(true);
    expect(data.has(PARTY_KEY)).toBe(false);
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    expect(clearAccountParty()).toBe(false);
    expect(stored()).toEqual({ v: 1, adults: 3, children: [] });
  });
});

describe('seedFromAccount', () => {
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  it('posts only the user id, and seeds from the ages it gets', async () => {
    fakeWindow();
    const f = answer({ adults: 2, children: [7, 9] });
    vi.stubGlobal('fetch', f);
    expect(await seedFromAccount('u1')).toBe('seeded');
    expect(f).toHaveBeenCalledWith('/api/account/profile/party/', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'u1' }) }));
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
  });
  it('nothing saved, a refusal, a bad body or a network failure all leave the device alone', async () => {
    fakeWindow();
    for (const f of [answer({ adults: null, children: [] }), answer({ error: 'x' }, 401), answer({ nope: 1 }), vi.fn(async () => { throw new Error('offline'); })]) {
      vi.stubGlobal('fetch', f);
      expect(await seedFromAccount('u1')).toBeNull();
    }
    expect(data.has(PARTY_KEY)).toBe(false);
  });
  it('gives up after the timeout', async () => {
    fakeWindow();
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener('abort', () => rej(new Error('abort'))))));
    expect(await seedFromAccount('u1', 20)).toBeNull();
  });
});
