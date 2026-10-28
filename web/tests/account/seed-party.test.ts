// @vitest-environment node
// ACCT-P2: the seed rules of account-profile-and-travellers.md 5.2 and the sign-out rule of 5.4, against a fake window. ACCT-F2 (review
// ACCT-PSEC B2): a party the account writes carries its owner's hash, and a party another account wrote is replaced, removed or ignored.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTY_KEY } from '@/lib/storage/partyKey';
import { clearAccountParty, dropForeignParty, keepPartyAsOwn, ownerHash, prefillParty, seedFromAccount, seedParty, setAccountParty } from '@/lib/account/seed-party';
import { accountHash } from '@travel/core/favourites/account.ts';

// Two accounts on one browser: owner tags as accountHash would make them.
const A = 'b1f3e0c2a9d84e7f';
const B = '07c5d2e1f4a3b6c9';

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
const hashOf = async (id: string): Promise<string> => (await ownerHash(id)) as string;
afterEach(() => vi.unstubAllGlobals());

describe('seedParty', () => {
  it('nothing on the device: writes the account party with src and the owner', () => {
    fakeWindow();
    expect(seedParty({ adults: 2, children: [7, 9] }, A)).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account', by: A });
  });
  it('the same party: marked as the account\'s', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [7, 9] }));
    expect(seedParty({ adults: 2, children: [7, 9] }, A)).toBe('same');
    expect(stored()).toMatchObject({ src: 'account', by: A });
  });
  it('a different party the browser chose is left alone', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 1, children: [4] }));
    expect(seedParty({ adults: 2, children: [7, 9] }, A)).toBe('differs');
    expect(stored()).toEqual({ v: 1, adults: 1, children: [4] });
  });
  it('a different party an earlier seed of this account wrote is brought up to date (a birthday, another device)', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [6, 8], src: 'account', by: A }));
    expect(seedParty({ adults: 2, children: [7, 9] }, A)).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account', by: A });
  });
  it('blocked storage answers blocked and throws nothing', () => {
    fakeWindow(true);
    expect(seedParty({ adults: 2, children: [] }, A)).toBe('blocked');
  });
});

describe('save, remove and sign-out', () => {
  it('setAccountParty replaces anything; keepPartyAsOwn drops src and by but keeps the party', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 1, children: [] }));
    expect(setAccountParty({ adults: 2, children: [5] }, A)).toBe(true);
    expect(stored()).toMatchObject({ src: 'account', by: A });
    keepPartyAsOwn(A);
    expect(stored()).toEqual({ v: 1, adults: 2, children: [5] });
  });
  it('sign-out removes an account-seeded party and keeps the browser\'s own', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [5] }, A);
    expect(clearAccountParty()).toBe(true);
    expect(data.has(PARTY_KEY)).toBe(false);
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    expect(clearAccountParty()).toBe(false);
    expect(stored()).toEqual({ v: 1, adults: 3, children: [] });
  });
});

describe('two accounts on one browser (review ACCT-PSEC B2)', () => {
  it('the owner tag is accountHash(user id), the same 16 hex as the Mine cache, never the id', async () => {
    expect(await ownerHash('user-a')).toBe(await accountHash('user-a'));
    expect(await ownerHash('user-a')).toMatch(/^[0-9a-f]{16}$/);
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, await hashOf('user-a'));
    expect(data.get(PARTY_KEY)).not.toContain('user-a');
  });
  it('B with saved travellers: A\'s party is replaced, never reported as B\'s own "differs"', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, A);
    expect(seedParty({ adults: 1, children: [] }, B)).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 1, children: [], src: 'account', by: B });
  });
  it('B with the same party as A: rewritten as B\'s', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [] }, A);
    expect(seedParty({ adults: 2, children: [] }, B)).toBe('seeded');
    expect(stored().by).toBe(B);
  });
  it('B with nothing saved: A\'s party is removed; B\'s own earlier seed and the browser\'s own party stay', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, A);
    expect(dropForeignParty(B)).toBe(true);
    expect(data.has(PARTY_KEY)).toBe(false);
    setAccountParty({ adults: 2, children: [7, 9] }, B);
    expect(dropForeignParty(B)).toBe(false);
    expect(stored().by).toBe(B);
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    expect(dropForeignParty(B)).toBe(false);
    expect(stored()).toEqual({ v: 1, adults: 3, children: [] });
  });
  it('a party seeded before the owner tag (src account, no by) counts as another account\'s', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [7, 9], src: 'account' }));
    expect(prefillParty(B)).toBeNull();
    expect(dropForeignParty(B)).toBe(true);
  });
  it('the "Filled in from this browser" prefill ignores A\'s party for B, and offers B\'s own and the browser\'s own', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, A);
    expect(prefillParty(B)).toBeNull();
    expect(prefillParty(A)).toEqual({ adults: 2, children: [7, 9] });
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [4] }));
    expect(prefillParty(B)).toEqual({ adults: 3, children: [4] });
  });
  it('Remove saved travellers keeps this account\'s seed as the browser\'s, but removes another account\'s', () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [5] }, A);
    keepPartyAsOwn(B);
    expect(data.has(PARTY_KEY)).toBe(false);
  });
});

describe('seedFromAccount', () => {
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  it('posts only the user id, and seeds from the ages it gets, tagged with the owner\'s hash', async () => {
    fakeWindow();
    const f = answer({ adults: 2, children: [7, 9] });
    vi.stubGlobal('fetch', f);
    expect(await seedFromAccount('u1')).toBe('seeded');
    expect(f).toHaveBeenCalledWith('/api/account/profile/party/', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'u1' }) }));
    expect(stored()).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account', by: await accountHash('u1') });
  });
  it('nothing saved, a refusal, a bad body or a network failure write nothing', async () => {
    fakeWindow();
    for (const f of [answer({ adults: null, children: [] }), answer({ error: 'x' }, 401), answer({ error: 'x' }, 429), answer({ nope: 1 }), vi.fn(async () => { throw new Error('offline'); })]) {
      vi.stubGlobal('fetch', f);
      expect(await seedFromAccount('u1')).toBeNull();
    }
    expect(data.has(PARTY_KEY)).toBe(false);
  });
  it('session expiry without Sign out: A\'s party stays, B signs in with nothing saved, the party is removed', async () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, await hashOf('user-a'));
    vi.stubGlobal('fetch', answer({ adults: null, children: [] }));
    expect(await seedFromAccount('user-b')).toBeNull();
    expect(data.has(PARTY_KEY)).toBe(false);
  });
  it('nothing saved for the same account keeps its own seed, and the browser\'s own party stays for anyone', async () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, await hashOf('user-a'));
    vi.stubGlobal('fetch', answer({ adults: null, children: [] }));
    await seedFromAccount('user-a');
    expect(stored()).toMatchObject({ adults: 2, src: 'account' });
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    await seedFromAccount('user-b');
    expect(stored()).toEqual({ v: 1, adults: 3, children: [] });
  });
  it('a 401 (the session ended) removes any account\'s party and keeps the browser\'s own', async () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, await hashOf('user-a'));
    vi.stubGlobal('fetch', answer({ error: 'UNAUTHENTICATED' }, 401));
    expect(await seedFromAccount('user-a')).toBeNull();
    expect(data.has(PARTY_KEY)).toBe(false);
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 3, children: [] }));
    await seedFromAccount('user-a');
    expect(stored()).toEqual({ v: 1, adults: 3, children: [] });
  });
  it('B with saved travellers replaces A\'s party through the route', async () => {
    fakeWindow();
    setAccountParty({ adults: 2, children: [7, 9] }, await hashOf('user-a'));
    vi.stubGlobal('fetch', answer({ adults: 1, children: [3] }));
    expect(await seedFromAccount('user-b')).toBe('seeded');
    expect(stored()).toEqual({ v: 1, adults: 1, children: [3], src: 'account', by: await hashOf('user-b') });
  });
  it('gives up after the timeout', async () => {
    fakeWindow();
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener('abort', () => rej(new Error('abort'))))));
    expect(await seedFromAccount('u1', 20)).toBeNull();
  });
});
