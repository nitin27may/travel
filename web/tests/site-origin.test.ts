import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteOrigin } from '@/lib/site';
import { shareUrl } from '@/lib/export/share';

// REF-REVIEW S7: the default origin is the old site, whose home page links every dated trip folder. A production deploy must name its own.
describe('siteOrigin', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses SITE_ORIGIN when it is set, without a trailing slash', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://example.test/');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(siteOrigin()).toBe('https://example.test');
  });
  it('fails a production deploy with no SITE_ORIGIN instead of writing URLs on the old host', () => {
    vi.stubEnv('SITE_ORIGIN', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(() => siteOrigin()).toThrow(/SITE_ORIGIN is not set/);
    expect(() => shareUrl({ slug: 'dolomites-2027' })).toThrow(/SITE_ORIGIN is not set/);
  });
  it('fails a build that asks for the check (REQUIRE_SITE_ORIGIN=1) with no SITE_ORIGIN', () => {
    vi.stubEnv('SITE_ORIGIN', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('REQUIRE_SITE_ORIGIN', '1');
    expect(() => siteOrigin()).toThrow();
  });
  it('keeps dev, test and preview builds working with the default', () => {
    vi.stubEnv('SITE_ORIGIN', '');
    for (const env of ['', 'preview', 'development']) {
      vi.stubEnv('VERCEL_ENV', env);
      expect(siteOrigin()).toMatch(/^https:\/\//);
    }
  });
});
