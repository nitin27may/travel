// @vitest-environment node
// ACCT-PC (account-profile-and-travellers.md 5.2): `travel.party` gains one optional field, `src: 'account'`, written only by the
// account seed. `v` stays 1; every reader ignores the field; any other write drops it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTY_KEY, clearParty, readParty, readPartySource, writeParty } from '@/lib/storage/partyKey';
import { cleanParty } from '@travel/core/trips/party.ts';

let data: Map<string, string>;
function fakeWindow(blocked = false) {
  data = new Map();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const w = { dispatchEvent: () => true } as Record<string, unknown>;
  Object.defineProperty(w, 'localStorage', blocked ? { get: () => { throw new DOMException('denied', 'SecurityError'); } } : { value: store });
  vi.stubGlobal('window', w);
  vi.stubGlobal('Event', class { constructor(public type: string) {} });
}
afterEach(() => vi.unstubAllGlobals());

describe('travel.party src', () => {
  it('writes src only when the account seed asks, and keeps version 1', () => {
    fakeWindow();
    expect(writeParty({ adults: 2, children: [7, 9] }, { src: 'account' })).toBe(true);
    expect(JSON.parse(data.get(PARTY_KEY)!)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
    expect(readPartySource()).toBe('account');
  });

  it('any other write drops src: the party becomes this browser\'s own', () => {
    fakeWindow();
    writeParty({ adults: 2, children: [7, 9] }, { src: 'account' });
    writeParty({ adults: 3, children: [7, 9] });
    expect(JSON.parse(data.get(PARTY_KEY)!)).toEqual({ v: 1, adults: 3, children: [7, 9] });
    expect(readPartySource()).toBeNull();
  });

  it('readParty and cleanParty ignore src, and an old value without it reads the same', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [4], src: 'account' }));
    expect(readParty()).toEqual({ adults: 2, children: [4] });
    expect(cleanParty({ v: 1, adults: 2, children: [4], src: 'account' })).toEqual({ adults: 2, children: [4] });
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [4] }));
    expect(readParty()).toEqual({ adults: 2, children: [4] });
    expect(readPartySource()).toBeNull();
  });

  it('reads no source from anything that is not a kept version-1 party, an unknown src, or blocked storage', () => {
    fakeWindow();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, adults: 2, children: [], src: 'other' }));
    expect(readPartySource()).toBeNull();
    data.set(PARTY_KEY, JSON.stringify({ v: 2, adults: 2, children: [], src: 'account' }));
    expect(readPartySource()).toBeNull();
    data.set(PARTY_KEY, JSON.stringify({ v: 1, src: 'account' }));
    expect(readPartySource()).toBeNull();
    data.set(PARTY_KEY, '{not json');
    expect(readPartySource()).toBeNull();
    expect(clearParty()).toBe(true);
    expect(readPartySource()).toBeNull();
    fakeWindow(true);
    expect(readPartySource()).toBeNull();
    expect(writeParty({ adults: 2, children: [] }, { src: 'account' })).toBe(false);
  });
});
