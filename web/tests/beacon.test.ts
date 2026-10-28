// The analytics beacon stays off the account and sign-in pages (review GSI-S S7, Google spec 7.1), and off a person's own trip at
// `/t/<id>/` and Mine (review STEP2-ES ES-003).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beaconAllowed, NO_BEACON_PATHS } from '@/lib/beacon';

const nav = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));

describe('beaconAllowed', () => {
  it('is false on /account/*, /sign-in/ and /sign-up/, with or without the trailing slash or a query', () => {
    expect([...NO_BEACON_PATHS].sort()).toEqual(['/account/', '/mine/', '/sign-in/', '/sign-up/', '/t/']);
    for (const p of ['/account', '/account/', '/account/settings/', '/sign-in', '/sign-in/', '/sign-up', '/Sign-In/', '/sign-in/?neon_auth_session_verifier=x', '/account/?next=%2Fmine%2F'])
      expect(beaconAllowed(p), p).toBe(false);
  });

  it('is true everywhere else', () => {
    for (const p of ['/', '/trips/', '/trips/dolomites-2027/', '/places/lake-louise/', '/about', '/accounts-of-a-trip/', '/sign-inside/', '/tips/', '/minerals/', null, undefined])
      expect(beaconAllowed(p), String(p)).toBe(true);
  });

  it('is false on a person\'s own trip and on Mine (ES-003)', () => {
    for (const p of ['/t/6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b/', '/t/6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', '/t/6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b/?view=day&edit=1', '/t/', '/mine', '/mine/', '/mine/?show=favourites'])
      expect(beaconAllowed(p), p).toBe(false);
  });
});

describe('Beacon on /t/ with the token set', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('renders no script on /t/<id>/ or /mine/, and the script on a public trip', async () => {
    vi.stubEnv('NEXT_PUBLIC_CF_BEACON_TOKEN', 'beacon-test-token');
    const { Beacon } = await import('@/components/shell/Beacon');
    for (const p of ['/t/6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b/', '/mine/']) {
      nav.path = p;
      const html = renderToStaticMarkup(createElement(Beacon));
      expect(html, p).not.toContain('cloudflareinsights');
      expect(html, p).not.toContain('beacon-test-token');
    }
    nav.path = '/trips/dolomites-2027/';
    expect(renderToStaticMarkup(createElement(Beacon))).toContain('static.cloudflareinsights.com/beacon.min.js');
  });
});
