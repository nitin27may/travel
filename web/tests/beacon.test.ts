// The analytics beacon stays off the account and sign-in pages (review GSI-S S7, Google spec 7.1).
import { describe, expect, it } from 'vitest';
import { beaconAllowed, NO_BEACON_PATHS } from '@/lib/beacon';

describe('beaconAllowed', () => {
  it('is false on /account/*, /sign-in/ and /sign-up/, with or without the trailing slash or a query', () => {
    expect([...NO_BEACON_PATHS].sort()).toEqual(['/account/', '/sign-in/', '/sign-up/']);
    for (const p of ['/account', '/account/', '/account/settings/', '/sign-in', '/sign-in/', '/sign-up', '/Sign-In/', '/sign-in/?neon_auth_session_verifier=x', '/account/?next=%2Fmine%2F'])
      expect(beaconAllowed(p), p).toBe(false);
  });

  it('is true everywhere else', () => {
    for (const p of ['/', '/trips/', '/places/lake-louise/', '/about', '/mine/', '/accounts-of-a-trip/', '/sign-inside/', null, undefined]) expect(beaconAllowed(p), String(p)).toBe(true);
  });
});
